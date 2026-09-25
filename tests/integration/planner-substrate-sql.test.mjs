import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrations = path.resolve("packages/database/prisma/migrations");
const names = (await readdir(migrations)).filter((name) => /^\d{4}_/.test(name)).sort();
async function apply(db, name) {
  await db.exec(await readFile(path.join(migrations, name, "migration.sql"), "utf8"));
}
async function revision(db, userId) {
  return (await db.query('SELECT "planningRevision" FROM "User" WHERE "id" = $1', [userId])).rows[0]
    .planningRevision;
}
async function insertUser(db, id) {
  await db.query('INSERT INTO "User" ("id", "timezone", "updatedAt") VALUES ($1, $2, now())', [
    id,
    "America/Toronto",
  ]);
}
const runSql = `INSERT INTO "PlannerRun"
  ("id","userId","triggerType","idempotencyScope","idempotencyKey",
   "planningHorizonStart","planningHorizonEnd","plannerVersion","inputSnapshot","status")
  VALUES ($1,$2,$3,$4,$5,'2026-09-21T12:00:00Z','2026-09-28T12:00:00Z','heuristic-v1','{}','RUNNING')`;

test("zero-to-current migrations enforce per-user revision, idempotency and rollback", async () => {
  const db = new PGlite();
  try {
    for (const name of names) await apply(db, name);
    await insertUser(db, "a");
    await insertUser(db, "b");
    assert.equal(await revision(db, "a"), 0);
    await db.query('UPDATE "User" SET "name" = $1 WHERE "id" = $2', ["Profile", "a"]);
    assert.equal(await revision(db, "a"), 0);
    await db.query(`INSERT INTO "Task" ("id","userId","title","status","updatedAt")
      VALUES ('task-a','a','Synthetic task','READY',now())`);
    assert.equal(await revision(db, "a"), 1);
    await db.query(`UPDATE "Task" SET "title" = 'Edited title' WHERE "id" = 'task-a'`);
    assert.equal(await revision(db, "a"), 1);
    await db.query(`UPDATE "Task" SET "remainingMinutes" = 60 WHERE "id" = 'task-a'`);
    assert.equal(await revision(db, "a"), 2);
    assert.equal(await revision(db, "b"), 0);
    const claim = async (userId, expected) =>
      (
        await db.query(
          'UPDATE "User" SET "planningRevision" = "planningRevision" + 1 WHERE "id" = $1 AND "planningRevision" = $2 RETURNING "planningRevision"',
          [userId, expected],
        )
      ).rows;
    assert.equal((await claim("a", 2))[0].planningRevision, 3);
    assert.deepEqual(await claim("a", 2), []);
    assert.equal((await claim("b", 0))[0].planningRevision, 1);
    await db.exec("BEGIN");
    await db.query(`UPDATE "Task" SET "remainingMinutes" = 30 WHERE "id" = 'task-a'`);
    assert.equal(await revision(db, "a"), 4);
    await db.exec("ROLLBACK");
    assert.equal(await revision(db, "a"), 3);
    await db.query(runSql, ["r1", "a", "INTEGRATION_SYNC", "google-calendar", "event-1"]);
    await assert.rejects(
      () => db.query(runSql, ["r2", "a", "INTEGRATION_SYNC", "google-calendar", "event-1"]),
      /unique/i,
    );
    await db.query(runSql, ["r3", "b", "INTEGRATION_SYNC", "google-calendar", "event-1"]);
    await db.query(runSql, ["r4", "a", "TASK_UPDATED", "google-calendar", "event-1"]);
    await db.query(runSql, ["r5", "a", "MANUAL", null, null]);
    await db.query(runSql, ["r6", "a", "MANUAL", null, null]);
    await assert.rejects(
      () => db.query(runSql, ["bad", "a", "MANUAL", null, "one-sided"]),
      /check/i,
    );
    for (const id of ["old-1", "old-2", "replacement", "disappears"]) {
      await db.query(
        `INSERT INTO "WorkSession"
        ("id","userId","taskId","plannerRunId","startAt","endAt","plannedMinutes",
         "state","generatedBy","updatedAt")
        VALUES ($1,'a','task-a','r1','2026-09-22T12:00:00Z','2026-09-22T13:00:00Z',
                60,'PLANNED','PLANNER',now())`,
        [id],
      );
    }
    await db.query(`UPDATE "WorkSession" SET "state" = 'SUPERSEDED',
      "supersededById" = 'replacement' WHERE "id" IN ('old-1','old-2')`);
    await db.query(`UPDATE "WorkSession" SET "state" = 'SUPERSEDED'
      WHERE "id" = 'disappears'`);
    const history = (
      await db.query(`SELECT "id","supersededById" FROM "WorkSession"
      WHERE "state" = 'SUPERSEDED' ORDER BY "id"`)
    ).rows;
    assert.deepEqual(
      history.map((row) => row.supersededById),
      [null, "replacement", "replacement"],
    );
  } finally {
    await db.close();
  }
});

test("Milestone-3 schema upgrades through all Milestone-4 migrations without losing records", async () => {
  const db = new PGlite();
  try {
    for (const name of names.filter((name) => name < "0007_")) await apply(db, name);
    await insertUser(db, "existing-user");
    for (const name of names.filter((name) => name >= "0007_")) await apply(db, name);
    assert.equal(await revision(db, "existing-user"), 0);
    const columns = (
      await db.query(`SELECT column_name FROM information_schema.columns
      WHERE table_name = 'PlannerRun' AND column_name IN ('idempotencyScope','idempotencyKey')`)
    ).rows;
    assert.equal(columns.length, 2);
    assert.equal(
      (
        await db.query(`SELECT count(*)::int AS count FROM pg_indexes
        WHERE tablename = 'PlannerRun'
          AND indexname = 'PlannerRun_userId_triggerType_idempotencyScope_idempotencyK_key'`)
      ).rows[0].count,
      1,
    );
    await db.query(runSql, ["upgrade-run", "existing-user", "MANUAL", null, null]);
    assert.equal(
      (await db.query(`SELECT "status" FROM "PlannerRun" WHERE "id" = 'upgrade-run'`)).rows[0]
        .status,
      "RUNNING",
    );
  } finally {
    await db.close();
  }
});
