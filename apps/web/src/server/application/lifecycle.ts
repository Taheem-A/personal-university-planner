import { z } from "zod";
import type { IntegrationAccountRecord } from "@university-planner/database";
import { requireAssessment, requireCourse, requireTask } from "./authorization";
import { ApplicationError } from "./errors";
import { planAfterMutation } from "./planner-triggers";
import { planHistoryItem } from "./planner-reads";
import { auditNow, newRecordId, requireUpdated, service } from "./service";
import {
  expectedVersionSchema,
  idSchema,
  instantSchema,
  nonnegativeMinutesSchema,
  parseInstant,
  textSchema,
  validateOrderedInstants,
} from "./validation";

const id = z.object({ id: idSchema }).strict();
const versioned = z.object({ id: idSchema, expectedVersion: expectedVersionSchema }).strict();
const range = z.object({ startAt: instantSchema, endAt: instantSchema }).strict();
const manualSession = range.extend({ taskId: idSchema, locked: z.boolean().default(false) });
function safeIntegration({ credentialReference: _removed, ...metadata }: IntegrationAccountRecord) {
  void _removed;
  return metadata;
}

/** This slice records manually created sessions; planner-generated sessions belong to Milestone 4. */
export const workSessions = {
  create(input: unknown) {
    return planAfterMutation(
      service(manualSession, input, async (data, actor, tx) => {
        await requireTask(tx.repositories, actor, data.taskId);
        const startAt = parseInstant(data.startAt)!,
          endAt = parseInstant(data.endAt)!;
        validateOrderedInstants(startAt, endAt);
        const elapsed = (endAt.getTime() - startAt.getTime()) / 60_000;
        if (!Number.isInteger(elapsed) || elapsed <= 0)
          throw new ApplicationError(
            "VALIDATION_ERROR",
            "Session duration must be whole positive minutes.",
          );
        return tx.repositories.workSessions.create({
          id: newRecordId(),
          userId: actor.userId,
          version: 0,
          taskId: data.taskId,
          plannerRunId: null,
          startAt,
          endAt,
          plannedMinutes: elapsed,
          state: "PLANNED",
          generatedBy: "USER",
          locked: data.locked,
          supersededById: null,
          ...auditNow(),
        });
      }),
      (record) => ({
        trigger: { type: "CALENDAR_CHANGED", entityType: "WORK_SESSION", entityId: record.id },
      }),
    );
  },
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) => {
      const record = await tx.repositories.workSessions.getForUser(actor.userId, id);
      if (!record) throw new ApplicationError("NOT_FOUND", "Record not found.");
      return record;
    });
  },
  list(input: unknown) {
    return service(range, input, async (data, actor, tx) => {
      const startAt = parseInstant(data.startAt)!,
        endAt = parseInstant(data.endAt)!;
      validateOrderedInstants(startAt, endAt);
      return tx.repositories.workSessions.listForRange(actor.userId, startAt, endAt);
    });
  },
  setLocked(input: unknown) {
    return service(
      versioned.extend({ locked: z.boolean() }).strict(),
      input,
      async ({ id, expectedVersion, locked }, actor, tx) => {
        const current = await tx.repositories.workSessions.getForUser(actor.userId, id);
        if (!current) throw new ApplicationError("NOT_FOUND", "Record not found.");
        if (current.state !== "PLANNED" || current.generatedBy !== "USER")
          throw new ApplicationError("CONFLICT", "Only a planned manual session can be edited.");
        return requireUpdated(
          await tx.repositories.workSessions.updateIfCurrent(actor.userId, id, expectedVersion, {
            locked,
          }),
        );
      },
    );
  },
  cancel(input: unknown) {
    return planAfterMutation(
      service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
        const current = await tx.repositories.workSessions.getForUser(actor.userId, id);
        if (!current) throw new ApplicationError("NOT_FOUND", "Record not found.");
        if (current.state !== "PLANNED" || current.generatedBy !== "USER" || current.locked)
          throw new ApplicationError("CONFLICT", "This session cannot be cancelled here.");
        return requireUpdated(
          await tx.repositories.workSessions.updateIfCurrent(actor.userId, id, expectedVersion, {
            state: "CANCELLED",
          }),
        );
      }),
      (record) => ({
        trigger: {
          type: "CALENDAR_CHANGED",
          entityType: "WORK_SESSION",
          entityId: record.id,
          releasedWindows: [{ id: record.id, startAt: record.startAt, endAt: record.endAt }],
        },
        releasedTimePolicy: "REPLAN_IF_USEFUL",
      }),
    );
  },
};

const completionCreate = z
  .object({
    taskId: idSchema,
    workSessionId: idSchema.nullable().default(null),
    outcome: z.enum(["COMPLETED", "PARTIAL", "SKIPPED", "DONE_EARLY", "CANCELLED"]),
    actualMinutes: nonnegativeMinutesSchema.nullable().default(null),
    remainingAfterMinutes: nonnegativeMinutesSchema.nullable().default(null),
    note: z.string().nullable().default(null),
  })
  .strict();
export const completionRecords = {
  record(input: unknown) {
    return service(completionCreate, input, async (data, actor, tx) => {
      await requireTask(tx.repositories, actor, data.taskId);
      if (data.workSessionId) {
        const session = await tx.repositories.workSessions.getForUser(
          actor.userId,
          data.workSessionId,
        );
        if (!session || session.taskId !== data.taskId)
          throw new ApplicationError("NOT_FOUND", "Record not found.");
      }
      return tx.repositories.completionRecords.create({
        ...data,
        id: newRecordId(),
        userId: actor.userId,
        recordedAt: new Date(),
      });
    });
  },
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) => {
      const record = await tx.repositories.completionRecords.getForUser(actor.userId, id);
      if (!record) throw new ApplicationError("NOT_FOUND", "Record not found.");
      return record;
    });
  },
  listForTask(input: unknown) {
    return service(
      z.object({ taskId: idSchema }).strict(),
      input,
      async ({ taskId }, actor, tx) => {
        await requireTask(tx.repositories, actor, taskId);
        return tx.repositories.completionRecords.listForTask(actor.userId, taskId);
      },
    );
  },
};

export const plannerRuns = {
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) => {
      const run = await tx.repositories.plannerRuns.getForUser(actor.userId, id);
      if (!run) throw new ApplicationError("NOT_FOUND", "Record not found.");
      return planHistoryItem(run);
    });
  },
  list(input: unknown = {}) {
    return service(
      z.object({ limit: z.number().int().min(1).max(100).default(20) }).strict(),
      input,
      async ({ limit }, actor, tx) =>
        (await tx.repositories.plannerRuns.listRecent(actor.userId, limit)).map(planHistoryItem),
    );
  },
};

const integrationCreate = z
  .object({
    provider: z.literal("google-calendar"),
    externalAccountId: idSchema,
    displayName: textSchema.nullable().default(null),
  })
  .strict();
export const integrationAccounts = {
  create(input: unknown) {
    return service(integrationCreate, input, async (data, actor, tx) =>
      safeIntegration(
        await tx.repositories.integrationAccounts.create({
          ...data,
          id: newRecordId(),
          userId: actor.userId,
          version: 0,
          status: "DISCONNECTED",
          credentialReference: null,
          lastSyncAt: null,
          lastSuccessAt: null,
          disconnectedAt: new Date(),
          ...auditNow(),
        }),
      ),
    );
  },
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) => {
      const row = await tx.repositories.integrationAccounts.getForUser(actor.userId, id);
      if (!row) throw new ApplicationError("NOT_FOUND", "Record not found.");
      return safeIntegration(row);
    });
  },
  list() {
    return service(z.undefined(), undefined, async (_, actor, tx) =>
      (await tx.repositories.integrationAccounts.listForUser(actor.userId)).map(safeIntegration),
    );
  },
  update(input: unknown) {
    return service(
      versioned.extend({ displayName: textSchema.nullable() }).strict(),
      input,
      async ({ id, expectedVersion, displayName }, actor, tx) => {
        const row = requireUpdated(
          await tx.repositories.integrationAccounts.updateIfCurrent(
            actor.userId,
            id,
            expectedVersion,
            { displayName },
          ),
        );
        return safeIntegration(row);
      },
    );
  },
  disconnect(input: unknown) {
    return service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
      const row = requireUpdated(
        await tx.repositories.integrationAccounts.disconnect(actor.userId, id, expectedVersion),
      );
      return safeIntegration(row);
    });
  },
};

export const externalObjectMaps = {
  get(input: unknown) {
    return service(
      z.object({ provider: textSchema, externalId: idSchema }).strict(),
      input,
      async ({ provider, externalId }, actor, tx) => {
        const row = await tx.repositories.externalObjectMaps.getForExternalIdentity(
          actor.userId,
          provider,
          externalId,
        );
        if (!row) throw new ApplicationError("NOT_FOUND", "Record not found.");
        return row;
      },
    );
  },
  listForObject(input: unknown) {
    return service(
      z
        .object({
          internalType: z.enum(["COURSE", "ASSESSMENT", "CALENDAR_EVENT", "TASK"]),
          internalId: idSchema,
        })
        .strict(),
      input,
      async ({ internalType, internalId }, actor, tx) => {
        if (internalType === "COURSE") await requireCourse(tx.repositories, actor, internalId);
        if (internalType === "ASSESSMENT")
          await requireAssessment(tx.repositories, actor, internalId);
        if (internalType === "TASK") await requireTask(tx.repositories, actor, internalId);
        if (internalType === "CALENDAR_EVENT") {
          const event = await tx.repositories.calendarEvents.getForUser(actor.userId, internalId);
          if (!event) throw new ApplicationError("NOT_FOUND", "Record not found.");
        }
        return tx.repositories.externalObjectMaps.listForInternalObject(
          actor.userId,
          internalType,
          internalId,
        );
      },
    );
  },
};

const secretKey =
  /credential|access.?token|refresh.?token|auth.?secret|client.?secret|api.?key|private.?key|authorization|password/i;
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object" && !(value instanceof Date))
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !secretKey.test(key))
        .map(([key, item]) => [key, redact(item)]),
    );
  return value;
}
export const accountData = {
  export() {
    return service(z.undefined(), undefined, async (_, actor, tx) => {
      const snapshot = await tx.repositories.accountLifecycle.snapshot(actor.userId);
      if (!snapshot) throw new ApplicationError("UNAUTHORIZED", "Sign in is required.");
      return {
        format: "university-planner-canonical",
        version: 1,
        exportedAt: new Date().toISOString(),
        data: redact(snapshot),
      };
    });
  },
  delete(input: unknown) {
    return service(
      z.object({ confirmation: z.literal("DELETE MY ACCOUNT") }).strict(),
      input,
      async (_, actor, tx) => {
        const deleted = await tx.repositories.accountLifecycle.deleteAccount(actor.userId);
        if (!deleted) throw new ApplicationError("NOT_FOUND", "Account not found.");
        return { deleted: true as const };
      },
    );
  },
};
