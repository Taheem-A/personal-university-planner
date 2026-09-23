import { randomUUID } from "node:crypto";
import type { ConditionalMutation, TransactionContext } from "@university-planner/database";
import type { z } from "zod";
import { applicationDatabase } from "../database";
import { requireActor, type Actor } from "./authorization";
import { ApplicationError, resultOf, type ApplicationResult } from "./errors";
import { validateInput } from "./validation";

export function newRecordId(): string {
  return randomUUID();
}
export function auditNow() {
  const now = new Date();
  return { createdAt: now, updatedAt: now };
}

export function requireUpdated<T>(outcome: ConditionalMutation<T>): T {
  if (outcome.status === "NOT_FOUND") throw new ApplicationError("NOT_FOUND", "Record not found.");
  if (outcome.status === "STALE")
    throw new ApplicationError("STALE_WRITE", "Record changed; reload before saving.");
  return outcome.record;
}

/** No browser-provided owner ID; validation and every repository call share one actor. */
export async function service<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  operation: (data: z.output<S>, actor: Actor, tx: TransactionContext) => Promise<T>,
): Promise<ApplicationResult<T>> {
  return resultOf(async () => {
    const actor = await requireActor();
    const data = validateInput(schema, input);
    return applicationDatabase().transaction((tx) => operation(data, actor, tx));
  });
}

export function requireActive<T extends { archivedAt: Date | null }>(record: T | null): T {
  if (!record || record.archivedAt) throw new ApplicationError("NOT_FOUND", "Record not found.");
  return record;
}
