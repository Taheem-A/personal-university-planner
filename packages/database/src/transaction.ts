import type { Prisma, PrismaClient } from "@prisma/client";
import { createRepositories } from "./repositories/index.js";
import type { TransactionContext } from "./repositories/types.js";

export async function runInTransaction<T>(
  client: PrismaClient,
  operation: (context: TransactionContext) => Promise<T>,
  isolationLevel: Prisma.TransactionIsolationLevel = "ReadCommitted",
): Promise<T> {
  return client.$transaction(
    async (transactionClient) =>
      operation({
        repositories: createRepositories(transactionClient),
        locks: {
          async userGraph(userId) {
            await transactionClient.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
          },
        },
      }),
    { maxWait: 10_000, timeout: 30_000, isolationLevel },
  );
}
