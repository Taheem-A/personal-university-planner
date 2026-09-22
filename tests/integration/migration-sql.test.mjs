import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.resolve(
  "packages/database/prisma/migrations/0001_canonical_foundation/migration.sql",
);

test("canonical foundation migration contains the audited PostgreSQL shape", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const models = [
    "User",
    "AcademicTerm",
    "Course",
    "CourseMeeting",
    "Assessment",
    "Task",
    "TaskDependency",
    "RecurringWorkRule",
    "CalendarEvent",
    "AvailabilityRule",
    "ProtectedTimeRule",
    "PlanningPreference",
    "WorkSession",
    "CompletionRecord",
    "EstimateProfile",
    "PlannerRun",
    "IntegrationAccount",
    "ExternalObjectMap",
    "InboxItem",
  ];

  for (const model of models) assert.match(sql, new RegExp(`CREATE TABLE "${model}"`));
  assert.match(sql, /TIMESTAMPTZ\(3\)/);
  assert.match(sql, /"startDate" DATE NOT NULL/);
  assert.match(sql, /"startTimeLocal" TIME\(0\) NOT NULL/);
  assert.match(sql, /JSONB/);
  assert.match(sql, /TEXT\[\]/);
  assert.match(sql, /CREATE TYPE "WorkSessionState" AS ENUM/);
  assert.match(sql, /ON DELETE RESTRICT/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(sql, /TaskDependency_no_self_edge_check/);
  assert.match(sql, /CalendarEvent_interval_check/);
  assert.match(sql, /ExternalObjectMap_integrationAccountId_userId_provider_fkey/);
  assert.match(sql, /IntegrationAccount_id_userId_provider_key/);
  assert.doesNotMatch(sql, /postgres(?:ql)?:\/\//i);
});
