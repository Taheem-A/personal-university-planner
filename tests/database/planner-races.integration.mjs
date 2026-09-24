import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../../packages/database/dist/index.js";

const url = process.env.PLANNER_RACE_TEST_DATABASE_URL;
if (
  process.env.APP_ENV !== "test" ||
  process.env.CONFIRM_PLANNER_RACE_DATABASE !== "RUN_M4_PLANNER_RACES" ||
  !url
)
  throw new Error("A confirmed, disposable Milestone-4 planner race database is required.");
const parsed = new URL(url);
if (
  !parsed.hostname.endsWith(".neon.tech") ||
  parsed.hostname.includes("-pooler") ||
  !/^up_m4_planner_races_[a-z0-9_]+$/.test(decodeURIComponent(parsed.pathname.slice(1)))
)
  throw new Error("Use a direct Neon up_m4_planner_races_* database only.");

const a = createDatabase({ connectionString: url });
const b = createDatabase({ connectionString: url });
const prefix = `race-${randomUUID()}`;
const userA = `${prefix}-a`;
const userB = `${prefix}-b`;
const now = new Date("2026-09-21T16:00:00.000Z");
function user(id) {
  return {
    id,
    name: "Synthetic",
    timezone: "America/Toronto",
    defaultDayStart: "08:00:00",
    defaultDayEnd: "22:00:00",
    locale: "en-CA",
    createdAt: now,
    updatedAt: now,
  };
}
function run(id, userId, key) {
  return {
    id,
    userId,
    startedAt: now,
    completedAt: null,
    triggerType: "INTEGRATION_SYNC",
    triggerEntityType: null,
    triggerEntityId: null,
    idempotencyScope: "synthetic-provider",
    idempotencyKey: key,
    planningHorizonStart: now,
    planningHorizonEnd: new Date(now.getTime() + 86_400_000),
    plannerVersion: "heuristic-v1",
    inputSnapshot: { schemaVersion: 1 },
    summary: null,
    warnings: null,
    status: "RUNNING",
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("PostgreSQL serializes same-user claims, isolates users, guards canonical edits and deduplicates events", async () => {
  await a.transaction(async ({ repositories }) => {
    await repositories.users.create(user(userA));
    await repositories.users.create(user(userB));
  });
  try {
    const claimed = deferred();
    const release = deferred();
    const first = a.transaction(async ({ repositories }) => {
      const result = await repositories.planningState.claimRevision(userA, 0);
      claimed.resolve();
      await release.promise;
      return result;
    });
    await claimed.promise;
    const competing = b.transaction(({ repositories }) =>
      repositories.planningState.claimRevision(userA, 0),
    );
    const independent = await Promise.race([
      b.transaction(({ repositories }) => repositories.planningState.claimRevision(userB, 0)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Different user blocked by user A")), 3000),
      ),
    ]);
    assert.equal(independent.status, "CLAIMED");
    release.resolve();
    assert.equal((await first).status, "CLAIMED");
    assert.equal((await competing).status, "STALE");

    const snapshot = await a.readSnapshot(({ repositories }) =>
      repositories.planningState.snapshot(userA, now, new Date(now.getTime() + 86_400_000)),
    );
    await b.transaction(({ repositories }) =>
      repositories.users.updateProfile(userA, {
        name: "Synthetic",
        timezone: "America/Vancouver",
        defaultDayStart: "08:00:00",
        defaultDayEnd: "22:00:00",
        locale: "en-CA",
      }),
    );
    assert.equal(
      (
        await a.transaction(({ repositories }) =>
          repositories.planningState.claimRevision(userA, snapshot.user.planningRevision),
        )
      ).status,
      "STALE",
    );

    const firstRun = await a.transaction(({ repositories }) =>
      repositories.plannerRuns.start(run(`${prefix}-r1`, userA, "event-1")),
    );
    const duplicate = await b.transaction(({ repositories }) =>
      repositories.plannerRuns.start(run(`${prefix}-r2`, userA, "event-1")),
    );
    assert.equal(firstRun.status, "CREATED");
    assert.equal(duplicate.status, "EXISTING");
    assert.equal(duplicate.record.id, firstRun.record.id);
    assert.equal(
      (
        await b.transaction(({ repositories }) =>
          repositories.plannerRuns.start(run(`${prefix}-r3`, userA, "event-2")),
        )
      ).status,
      "CREATED",
    );
    await a.transaction(({ repositories }) =>
      repositories.plannerRuns.failExpiredRunning(
        userA,
        new Date(now.getTime() + 60_000),
        new Date(now.getTime() + 120_000),
      ),
    );
    assert.equal(
      (await b.repositories.plannerRuns.getForUser(userA, firstRun.record.id)).status,
      "FAILED",
    );
    assert.equal(
      (
        await a.transaction(({ repositories }) =>
          repositories.plannerRuns.complete(userA, firstRun.record.id, {
            status: "SUCCEEDED",
            completedAt: new Date(now.getTime() + 180_000),
            summary: null,
            warnings: null,
          }),
        )
      ).status,
      "STALE",
    );
  } finally {
    await a.transaction(async ({ repositories }) => {
      await repositories.accountLifecycle.deleteAccount(userA);
      await repositories.accountLifecycle.deleteAccount(userB);
    });
    await Promise.all([a.disconnect(), b.disconnect()]);
  }
});
