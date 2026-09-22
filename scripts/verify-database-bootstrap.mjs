import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseRoot = path.join(repositoryRoot, "packages", "database");
const requireFromDatabase = createRequire(path.join(databaseRoot, "package.json"));
const prismaPackage = requireFromDatabase.resolve("prisma/package.json");
const prismaCli = path.join(path.dirname(prismaPackage), "build", "index.js");

function fail(message) {
  console.error(`Database bootstrap verification refused: ${message}`);
  process.exit(1);
}

if (process.env.APP_ENV !== "test") fail("APP_ENV must be exactly 'test'.");
if (process.env.CONFIRM_DISPOSABLE_DATABASE !== "RESET_MILESTONE_1_DATABASE") {
  fail("CONFIRM_DISPOSABLE_DATABASE must be exactly 'RESET_MILESTONE_1_DATABASE'.");
}

const rawUrl = process.env.MIGRATION_TEST_DATABASE_URL;
if (!rawUrl) fail("MIGRATION_TEST_DATABASE_URL is required.");

let databaseUrl;
try {
  databaseUrl = new URL(rawUrl);
} catch {
  fail("MIGRATION_TEST_DATABASE_URL must be a valid PostgreSQL URL.");
}

if (!new Set(["postgres:", "postgresql:"]).has(databaseUrl.protocol)) {
  fail("only PostgreSQL URLs are accepted.");
}
if (!databaseUrl.hostname.endsWith(".neon.tech") && !databaseUrl.hostname.endsWith(".neon.build")) {
  fail("the target must be a Neon hostname.");
}
if (databaseUrl.hostname.includes("-pooler"))
  fail("the target must use a direct, non-pooled endpoint.");

const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
if (!/^up_m1_migration_[a-z0-9_]+$/.test(databaseName)) {
  fail("the database name must match /^up_m1_migration_[a-z0-9_]+$/.");
}
if (process.env.DATABASE_URL === rawUrl || process.env.MIGRATION_DATABASE_URL === rawUrl) {
  fail("the destructive test URL must differ from runtime and ordinary migration URLs.");
}

const childEnvironment = { ...process.env, MIGRATION_DATABASE_URL: rawUrl };
delete childEnvironment.DATABASE_URL;
delete childEnvironment.DATABASE_URL_UNPOOLED;
delete childEnvironment.MIGRATION_TEST_DATABASE_URL;

function prisma(label, args, options = {}) {
  console.log(`Database bootstrap: ${label}`);
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: databaseRoot,
    env: childEnvironment,
    encoding: "utf8",
    stdio: options.quiet ? ["ignore", "ignore", "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

prisma("resetting the disposable database and applying migration history", [
  "migrate",
  "reset",
  "--force",
  "--config",
  "prisma.config.ts",
]);
prisma("checking migration status", ["migrate", "status", "--config", "prisma.config.ts"]);
prisma("checking Prisma-representable schema drift", [
  "migrate",
  "diff",
  "--from-schema",
  "prisma/schema.prisma",
  "--to-config-datasource",
  "--exit-code",
  "--config",
  "prisma.config.ts",
]);
prisma(
  "proving the migrated database can be introspected",
  ["db", "pull", "--print", "--config", "prisma.config.ts"],
  { quiet: true },
);

console.log(`Database bootstrap verified on disposable Neon database '${databaseName}'.`);
