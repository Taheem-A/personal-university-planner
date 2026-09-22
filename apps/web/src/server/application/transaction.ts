import type { TransactionContext } from "@university-planner/database";
import { applicationDatabase } from "../database";
import { requireActor, type Actor } from "./authorization";
import { resultOf, type ApplicationResult } from "./errors";

/** Auth is resolved once; all repository work inside the callback shares one transaction. */
export async function applicationTransaction<T>(
  operation: (actor: Actor, context: TransactionContext) => Promise<T>,
): Promise<ApplicationResult<T>> {
  return resultOf(async () => {
    const actor = await requireActor();
    return applicationDatabase().transaction((context) => operation(actor, context));
  });
}
