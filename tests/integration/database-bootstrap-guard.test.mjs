import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const script = path.resolve("scripts/verify-database-bootstrap.mjs");

function run(overrides) {
  return spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      APP_ENV: "test",
      CONFIRM_DISPOSABLE_DATABASE: "RESET_MILESTONE_1_DATABASE",
      ...overrides,
    },
    encoding: "utf8",
  });
}

test("database bootstrap verifier refuses a missing target", () => {
  const result = run({});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MIGRATION_TEST_DATABASE_URL is required/);
});

test("database bootstrap verifier refuses pooled and non-Neon targets", () => {
  const pooled = run({
    MIGRATION_TEST_DATABASE_URL:
      "postgresql://user:password@ep-test-pooler.us-east-2.aws.neon.tech/up_m1_migration_guard",
  });
  assert.notEqual(pooled.status, 0);
  assert.match(pooled.stderr, /direct, non-pooled endpoint/);

  const local = run({
    MIGRATION_TEST_DATABASE_URL: "postgresql://user:password@localhost/up_m1_migration_guard",
  });
  assert.notEqual(local.status, 0);
  assert.match(local.stderr, /target must be a Neon hostname/);
});

test("database bootstrap verifier requires an unmistakable disposable database name", () => {
  const result = run({
    MIGRATION_TEST_DATABASE_URL:
      "postgresql://user:password@ep-test.us-east-2.aws.neon.tech/neondb",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /database name must match/);
});
