import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const script = path.resolve("scripts/verify-seed-bootstrap.mjs");

function run(overrides) {
  return spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      APP_ENV: "test",
      CONFIRM_SYNTHETIC_SEED: "LOAD_SYNTHETIC_ENGINEERING_FIXTURE",
      ...overrides,
    },
    encoding: "utf8",
  });
}

test("seed bootstrap refuses a missing target", () => {
  const result = run({});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SEED_DATABASE_URL is required/);
});

test("seed bootstrap requires the test environment and exact confirmation", () => {
  const target = "postgresql://user:password@ep-test.us-east-2.aws.neon.tech/up_m1_seed_guard";
  const wrongEnvironment = run({ APP_ENV: "production", SEED_DATABASE_URL: target });
  assert.notEqual(wrongEnvironment.status, 0);
  assert.match(wrongEnvironment.stderr, /APP_ENV must be exactly 'test'/);

  const wrongConfirmation = run({
    CONFIRM_SYNTHETIC_SEED: "yes",
    SEED_DATABASE_URL: target,
  });
  assert.notEqual(wrongConfirmation.status, 0);
  assert.match(wrongConfirmation.stderr, /CONFIRM_SYNTHETIC_SEED must be exactly/);
});

test("seed bootstrap refuses pooled and non-Neon targets", () => {
  const pooled = run({
    SEED_DATABASE_URL:
      "postgresql://user:password@ep-test-pooler.us-east-2.aws.neon.tech/up_m1_seed_guard",
  });
  assert.notEqual(pooled.status, 0);
  assert.match(pooled.stderr, /direct, non-pooled endpoint/);

  const local = run({
    SEED_DATABASE_URL: "postgresql://user:password@localhost/up_m1_seed_guard",
  });
  assert.notEqual(local.status, 0);
  assert.match(local.stderr, /target must be a Neon hostname/);
});

test("seed bootstrap requires an unmistakable seed database name", () => {
  const result = run({
    SEED_DATABASE_URL: "postgresql://user:password@ep-test.us-east-2.aws.neon.tech/neondb",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /database name must match/);
});
