import type { PrismaClient } from "@prisma/client";
import { createRepositories } from "./repositories/index.js";
import type { TransactionContext } from "./repositories/types.js";

export async function runInTransaction<T>(
  client: PrismaClient,
  operation: (context: TransactionContext) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (transactionClient) =>
    operation({ repositories: createRepositories(transactionClient) }),
  );
}
