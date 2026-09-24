import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createRepositories } from "./repositories/index.js";
import type { CanonicalRepositories, TransactionContext } from "./repositories/types.js";
import { runInTransaction } from "./transaction.js";

export interface Database {
  repositories: CanonicalRepositories;
  transaction<T>(operation: (context: TransactionContext) => Promise<T>): Promise<T>;
  readSnapshot<T>(operation: (context: TransactionContext) => Promise<T>): Promise<T>;
  disconnect(): Promise<void>;
}

export interface CreateDatabaseOptions {
  connectionString: string;
}

class PrismaDatabase implements Database {
  readonly repositories: CanonicalRepositories;

  constructor(private readonly client: PrismaClient) {
    this.repositories = createRepositories(client);
  }

  transaction<T>(operation: (context: TransactionContext) => Promise<T>): Promise<T> {
    return runInTransaction(this.client, operation);
  }

  readSnapshot<T>(operation: (context: TransactionContext) => Promise<T>): Promise<T> {
    return runInTransaction(this.client, operation, "RepeatableRead");
  }

  disconnect(): Promise<void> {
    return this.client.$disconnect();
  }
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("@university-planner/database is server-only and cannot run in a browser.");
  }
}

export function createDatabase(options: CreateDatabaseOptions): Database {
  assertServerRuntime();
  if (!options.connectionString) throw new Error("A database connection string is required.");
  const adapter = new PrismaPg({ connectionString: options.connectionString });
  return new PrismaDatabase(new PrismaClient({ adapter }));
}

type DatabaseGlobal = typeof globalThis & {
  __universityPlannerDatabase?: Database;
};

const databaseGlobal = globalThis as DatabaseGlobal;
let productionDatabase: Database | undefined;

/**
 * Returns the process-wide production/runtime database boundary. Tests must use
 * createDatabase with an explicit disposable connection instead of relying on
 * ambient production configuration.
 */
export function getDatabase(): Database {
  assertServerRuntime();
  if (process.env.APP_ENV === "test" || process.env.NODE_ENV === "test") {
    throw new Error("Tests must call createDatabase with an explicit disposable connection.");
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the runtime database.");

  if (process.env.NODE_ENV === "production") {
    productionDatabase ??= createDatabase({ connectionString });
    return productionDatabase;
  }

  databaseGlobal.__universityPlannerDatabase ??= createDatabase({ connectionString });
  return databaseGlobal.__universityPlannerDatabase;
}

export async function disconnectDatabase(): Promise<void> {
  const databases = new Set(
    [productionDatabase, databaseGlobal.__universityPlannerDatabase].filter(
      (database): database is Database => database !== undefined,
    ),
  );
  for (const database of databases) await database.disconnect();
  productionDatabase = undefined;
  delete databaseGlobal.__universityPlannerDatabase;
}
