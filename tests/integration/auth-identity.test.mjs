import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";

const schema = readFileSync("packages/database/prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "packages/database/prisma/migrations/0002_auth_identity/migration.sql",
  "utf8",
);
const versionMigration = readFileSync(
  "packages/database/prisma/migrations/0003_task_optimistic_version/migration.sql",
  "utf8",
);

test("provider subject is globally unique and user deletion removes only its identities", () => {
  assert.match(schema, /model AuthIdentity {[\s\S]*@@unique\(\[provider, providerAccountId\]\)/);
  assert.match(migration, /CREATE UNIQUE INDEX "AuthIdentity_provider_providerAccountId_key"/);
  assert.match(migration, /REFERENCES "User"\("id"\) ON DELETE CASCADE/);
  assert.doesNotMatch(migration, /DROP TABLE|ALTER TABLE "(?:Course|Task|User)"/);
  assert.doesNotMatch(migration, /accessToken|refreshToken|email|secret/i);
});

test("migration 0002 is a narrow, forward-only addition after 0001", () => {
  const baseline = readFileSync(
    "packages/database/prisma/migrations/0001_canonical_foundation/migration.sql",
    "utf8",
  );
  assert.match(baseline, /CREATE TABLE "User"/);
  assert.match(migration, /CREATE TABLE "AuthIdentity"/);
  assert.match(migration, /"providerAccountId" TEXT NOT NULL/);
  assert.match(
    versionMigration,
    /ALTER TABLE "Task" ADD COLUMN\s+"version" INTEGER NOT NULL DEFAULT 0/,
  );
  assert.match(versionMigration, /Task_version_nonnegative_check/);
});

test("web database imports are confined to server application area", () => {
  const source = readFileSync("scripts/check-package-boundaries.mjs", "utf8");
  assert.match(source, /apps\/web\/src\/server\//);
  const result = execFileSync("node", ["scripts/check-package-boundaries.mjs"], {
    encoding: "utf8",
  });
  assert.match(result, /Package boundaries passed/);
});
