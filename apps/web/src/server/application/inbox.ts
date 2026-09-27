import { z } from "zod";
import type {
  AssessmentRecord,
  CalendarEventRecord,
  InboxItemRecord,
  JsonValue,
  TaskRecord,
} from "@university-planner/database";
import { createAssessmentInTransaction, createTaskInTransaction } from "./academic";
import { interpretInboxText } from "./inbox-interpretation";
import {
  classifyCalendarMutation,
  classifyTaskMutation,
  planAfterMutation,
  type PlannedMutation,
} from "./planner-triggers";
import { createCalendarEventInTransaction } from "./schedule";
import { ApplicationError, type ApplicationResult } from "./errors";
import { auditNow, newRecordId, requireUpdated, service } from "./service";
import { expectedVersionSchema, idSchema, manualProvenanceSchema, textSchema } from "./validation";

const id = z.object({ id: idSchema }).strict();
const versioned = z.object({ id: idSchema, expectedVersion: expectedVersionSchema }).strict();
const json = z.json();
const capture = manualProvenanceSchema.extend({ rawText: textSchema.max(100_000) }).strict();
const proposal = z
  .object({
    id: idSchema,
    expectedVersion: expectedVersionSchema,
    proposedEntityType: textSchema.nullable(),
    proposedPayload: json.nullable(),
  })
  .strict();
const status = z.enum(["ACTIVE", "PROCESSED", "DISMISSED"]);
const resolution = z
  .object({
    id: idSchema,
    expectedVersion: expectedVersionSchema,
    entityType: z.enum(["TASK", "ASSESSMENT", "CALENDAR_EVENT"]),
    payload: json,
  })
  .strict();

type Resolved =
  | { entityType: "TASK"; record: TaskRecord; inbox: InboxItemRecord }
  | { entityType: "ASSESSMENT"; record: AssessmentRecord; inbox: InboxItemRecord }
  | { entityType: "CALENDAR_EVENT"; record: CalendarEventRecord; inbox: InboxItemRecord };

function planningResult(planning: ApplicationResult<PlannedMutation<Resolved>>) {
  if (!planning.ok) return planning;
  const value = planning.value;
  const outcome = value.planning;
  return {
    ok: true as const,
    value: {
      id: value.inbox.id,
      version: value.inbox.version,
      status: value.inbox.status,
      entityType: value.entityType,
      entityId: value.record.id,
      planning: !outcome
        ? { status: "NOT_REQUESTED" as const }
        : !outcome.ok
          ? { status: "FAILED" as const, code: outcome.error.code }
          : outcome.value.status === "SUCCEEDED"
            ? { status: "SUCCEEDED" as const, planStatus: outcome.value.planStatus }
            : outcome.value.status === "INPUT_FAILURE"
              ? { status: "INFEASIBLE" as const }
              : { status: "FAILED" as const },
    },
  };
}

export const inboxItems = {
  capture(input: unknown) {
    return service(capture, input, async (data, actor, tx) =>
      tx.repositories.inboxItems.create({
        ...data,
        id: newRecordId(),
        userId: actor.userId,
        version: 0,
        status: "ACTIVE",
        proposedEntityType: null,
        proposedPayload: null,
        resolvedEntityType: null,
        resolvedEntityId: null,
        processedAt: null,
        ...auditNow(),
      }),
    );
  },
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) => {
      const row = await tx.repositories.inboxItems.getForUser(actor.userId, id);
      if (!row) throw new ApplicationError("NOT_FOUND", "Record not found.");
      return row;
    });
  },
  list(input: unknown = {}) {
    return service(
      z.object({ status: status.default("ACTIVE") }).strict(),
      input,
      async ({ status }, actor, tx) =>
        tx.repositories.inboxItems.listByStatus(actor.userId, status),
    );
  },
  propose(input: unknown) {
    return service(proposal, input, async ({ id, expectedVersion, ...patch }, actor, tx) => {
      const current = await tx.repositories.inboxItems.getForUser(actor.userId, id);
      if (!current) throw new ApplicationError("NOT_FOUND", "Record not found.");
      if (current.status !== "ACTIVE")
        throw new ApplicationError("CONFLICT", "Inbox item is already resolved.");
      if (Boolean(patch.proposedEntityType) !== Boolean(patch.proposedPayload))
        throw new ApplicationError("VALIDATION_ERROR", "Proposal type and payload must agree.");
      return requireUpdated(
        await tx.repositories.inboxItems.updateIfCurrent(actor.userId, id, expectedVersion, {
          ...patch,
          proposedPayload: patch.proposedPayload as JsonValue | null,
        }),
      );
    });
  },
  suggest(input: unknown) {
    return service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
      const current = await tx.repositories.inboxItems.getForUser(actor.userId, id);
      if (!current) throw new ApplicationError("NOT_FOUND", "Record not found.");
      if (current.status !== "ACTIVE")
        throw new ApplicationError("CONFLICT", "Inbox item is already resolved.");
      if (current.version !== expectedVersion)
        throw new ApplicationError("STALE_WRITE", "Record changed; reload before saving.");
      const user = await tx.repositories.users.getById(actor.userId);
      if (!user) throw new ApplicationError("NOT_FOUND", "Record not found.");
      const terms = await tx.repositories.academicTerms.listForUser(actor.userId);
      const courses = (
        await Promise.all(
          terms
            .filter((term) => term.status !== "ARCHIVED")
            .map((term) => tx.repositories.courses.listForTerm(actor.userId, term.id)),
        )
      )
        .flat()
        .filter((course) => !course.archivedAt);
      const suggestion = interpretInboxText(current.rawText, courses, user.timezone);
      if (!suggestion)
        throw new ApplicationError("VALIDATION_ERROR", "No safe interpretation matched.");
      const saved = requireUpdated(
        await tx.repositories.inboxItems.updateIfCurrent(actor.userId, id, expectedVersion, {
          proposedEntityType: suggestion.proposedEntityType,
          proposedPayload: suggestion.proposedPayload,
        }),
      );
      return { id, status: "PROPOSED" as const, version: saved.version };
    });
  },
  async resolve(input: unknown) {
    const mutation = service(
      resolution,
      input,
      async ({ id, expectedVersion, entityType, payload }, actor, tx): Promise<Resolved> => {
        const current = await tx.repositories.inboxItems.getForUser(actor.userId, id);
        if (!current) throw new ApplicationError("NOT_FOUND", "Record not found.");
        if (current.status !== "ACTIVE")
          throw new ApplicationError("CONFLICT", "Inbox item is already resolved.");
        if (current.version !== expectedVersion)
          throw new ApplicationError("STALE_WRITE", "Record changed; reload before saving.");
        const record =
          entityType === "TASK"
            ? await createTaskInTransaction(payload, actor, tx)
            : entityType === "ASSESSMENT"
              ? await createAssessmentInTransaction(payload, actor, tx)
              : await createCalendarEventInTransaction(payload, actor, tx);
        const inbox = requireUpdated(
          await tx.repositories.inboxItems.updateIfCurrent(actor.userId, id, expectedVersion, {
            status: "PROCESSED",
            processedAt: new Date(),
            resolvedEntityType: entityType,
            resolvedEntityId: record.id,
          }),
        );
        if (entityType === "TASK") return { entityType, record: record as TaskRecord, inbox };
        if (entityType === "ASSESSMENT")
          return { entityType, record: record as AssessmentRecord, inbox };
        return { entityType, record: record as CalendarEventRecord, inbox };
      },
    );
    return planningResult(
      await planAfterMutation(mutation, (value) =>
        value.entityType === "TASK"
          ? classifyTaskMutation(null, value.record)
          : value.entityType === "CALENDAR_EVENT"
            ? classifyCalendarMutation(null, value.record)
            : null,
      ),
    );
  },
  process(input: unknown) {
    return service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
      const current = await tx.repositories.inboxItems.getForUser(actor.userId, id);
      if (!current) throw new ApplicationError("NOT_FOUND", "Record not found.");
      if (current.status !== "ACTIVE")
        throw new ApplicationError("CONFLICT", "Inbox item is already resolved.");
      return requireUpdated(
        await tx.repositories.inboxItems.updateIfCurrent(actor.userId, id, expectedVersion, {
          status: "PROCESSED",
          processedAt: new Date(),
        }),
      );
    });
  },
  dismiss(input: unknown) {
    return service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
      const current = await tx.repositories.inboxItems.getForUser(actor.userId, id);
      if (!current) throw new ApplicationError("NOT_FOUND", "Record not found.");
      if (current.status !== "ACTIVE")
        throw new ApplicationError("CONFLICT", "Inbox item is already resolved.");
      return requireUpdated(
        await tx.repositories.inboxItems.updateIfCurrent(actor.userId, id, expectedVersion, {
          status: "DISMISSED",
          processedAt: new Date(),
        }),
      );
    });
  },
};
