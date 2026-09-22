import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseRoot = path.join(repositoryRoot, "packages", "database");
const requireFromDatabase = createRequire(path.join(databaseRoot, "package.json"));
const prismaPackage = requireFromDatabase.resolve("prisma/package.json");
const prismaCli = path.join(path.dirname(prismaPackage), "build", "index.js");
const seedAssertion = path.join(databaseRoot, "prisma", "assert-seed.mjs");

function fail(message) {
  console.error(`Seed bootstrap verification refused: ${message}`);
  process.exit(1);
}

if (process.env.APP_ENV !== "test") fail("APP_ENV must be exactly 'test'.");
if (process.env.CONFIRM_SYNTHETIC_SEED !== "LOAD_SYNTHETIC_ENGINEERING_FIXTURE") {
  fail("CONFIRM_SYNTHETIC_SEED must be exactly 'LOAD_SYNTHETIC_ENGINEERING_FIXTURE'.");
}

const rawUrl = process.env.SEED_DATABASE_URL;
if (!rawUrl) fail("SEED_DATABASE_URL is required.");

let databaseUrl;
try {
  databaseUrl = new URL(rawUrl);
} catch {
  fail("SEED_DATABASE_URL must be a valid PostgreSQL URL.");
}

if (!new Set(["postgres:", "postgresql:"]).has(databaseUrl.protocol)) {
  fail("only PostgreSQL URLs are accepted.");
}
if (!databaseUrl.hostname.endsWith(".neon.tech") && !databaseUrl.hostname.endsWith(".neon.build")) {
  fail("the target must be a Neon hostname.");
}
if (databaseUrl.hostname.includes("-pooler")) {
  fail("the target must use a direct, non-pooled endpoint.");
}

const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
if (!/^up_m1_seed_[a-z0-9_]+$/.test(databaseName)) {
  fail("the database name must match /^up_m1_seed_[a-z0-9_]+$/.");
}
if (
  process.env.DATABASE_URL === rawUrl ||
  process.env.DATABASE_URL_UNPOOLED === rawUrl ||
  process.env.MIGRATION_DATABASE_URL === rawUrl
) {
  fail("the seed verification URL must differ from ordinary runtime and migration URLs.");
}

const childEnvironment = {
  ...process.env,
  APP_ENV: "test",
  MIGRATION_DATABASE_URL: rawUrl,
  SEED_DATABASE_URL: rawUrl,
};
delete childEnvironment.DATABASE_URL;
delete childEnvironment.DATABASE_URL_UNPOOLED;
delete childEnvironment.MIGRATION_TEST_DATABASE_URL;

function run(label, executable, args) {
  console.log(`Seed bootstrap: ${label}`);
  const result = spawnSync(executable, args, {
    cwd: databaseRoot,
    env: childEnvironment,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const configArgs = ["--config", "prisma.config.ts"];
run("deploying source-controlled migration history", process.execPath, [
  prismaCli,
  "migrate",
  "deploy",
  ...configArgs,
]);
run("checking migration status", process.execPath, [prismaCli, "migrate", "status", ...configArgs]);
run("loading the deterministic synthetic semester", process.execPath, [
  prismaCli,
  "db",
  "seed",
  ...configArgs,
]);
run("checking fixture counts and relational integrity", process.execPath, [seedAssertion]);
run("re-running the idempotent seed", process.execPath, [prismaCli, "db", "seed", ...configArgs]);
run("checking repeat-seed stability", process.execPath, [seedAssertion]);

console.log(`Seed bootstrap verified on disposable Neon database '${databaseName}'.`);
