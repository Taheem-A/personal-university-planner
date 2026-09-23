import { z } from "zod";
import type { JsonValue } from "@university-planner/database";
import { ApplicationError } from "./errors";
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
