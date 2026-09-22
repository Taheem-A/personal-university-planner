import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export const SYNTHETIC_SEED_CONFIRMATION = "LOAD_SYNTHETIC_ENGINEERING_FIXTURE";

export function failSeedSafety(message) {
  throw new Error(`Synthetic seed refused: ${message}`);
}

export function getSeedDatabaseUrl(environment = process.env) {
  const rawUrl = environment.SEED_DATABASE_URL;
  if (!rawUrl) failSeedSafety("SEED_DATABASE_URL is required.");
  return rawUrl;
}

export function assertSafeSeedTarget(rawUrl, environment = process.env) {
  if (!new Set(["development", "test"]).has(environment.APP_ENV)) {
    failSeedSafety("APP_ENV must be exactly 'development' or 'test'.");
  }
  if (environment.CONFIRM_SYNTHETIC_SEED !== SYNTHETIC_SEED_CONFIRMATION) {
    failSeedSafety(`CONFIRM_SYNTHETIC_SEED must be exactly '${SYNTHETIC_SEED_CONFIRMATION}'.`);
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(rawUrl);
  } catch {
    failSeedSafety("SEED_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!new Set(["postgres:", "postgresql:"]).has(databaseUrl.protocol)) {
    failSeedSafety("only PostgreSQL URLs are accepted.");
  }
  if (databaseUrl.hostname.includes("-pooler")) {
    failSeedSafety("the seed target must use a direct, non-pooled endpoint.");
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
  const isNeon =
    databaseUrl.hostname.endsWith(".neon.tech") || databaseUrl.hostname.endsWith(".neon.build");
  const isLocal = new Set(["127.0.0.1", "localhost", "::1"]).has(databaseUrl.hostname);

  if (isNeon && !/^up_(?:m1_(?:migration|seed)|dev|test)_[a-z0-9_]+$/.test(databaseName)) {
    failSeedSafety("the Neon database name is not an approved development/test seed target.");
  }
  if (isLocal && !/^university_planner_(?:dev|test)$/.test(databaseName)) {
    failSeedSafety(
      "the local database name must be university_planner_dev or university_planner_test.",
    );
  }
  if (!isNeon && !isLocal) {
    failSeedSafety("the target must be a guarded Neon or localhost development/test database.");
  }

  return { databaseName, databaseUrl };
}

export function createSeedClient(rawUrl) {
  const adapter = new PrismaPg({ connectionString: rawUrl });
  return new PrismaClient({ adapter });
}
