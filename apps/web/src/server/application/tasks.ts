import { z } from "zod";
import { applicationDatabase } from "../database";
import { requireActor, requireTask } from "./authorization";
import { ApplicationError, resultOf } from "./errors";
import { expectedVersionSchema, idSchema, textSchema, validateInput } from "./validation";

const updateTaskSchema = z
  .object({
    id: idSchema,
    expectedVersion: expectedVersionSchema,
    title: textSchema,
  })
  .strict();

/** Narrow proof of the trusted service flow; later task operations extend this service. */
export async function renameTask(input: unknown) {
  return resultOf(async () => {
    const actor = await requireActor();
    const command = validateInput(updateTaskSchema, input);
    return applicationDatabase().transaction(async ({ repositories }) => {
      await requireTask(repositories, actor, command.id);
      const outcome = await repositories.tasks.updateIfCurrent(
        actor.userId,
        command.id,
        command.expectedVersion,
        { title: command.title },
      );
      if (outcome.status === "NOT_FOUND")
        throw new ApplicationError("NOT_FOUND", "Record not found.");
      if (outcome.status === "STALE")
        throw new ApplicationError("STALE_WRITE", "This task changed; reload it before saving.");
      return outcome.record;
    });
  });
}
