const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(
  __dirname,
  "../../apps/web/src/server/application/planner-triggers.ts",
);
const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
const calls = [];
const facts = {
  task: { id: "task-1", remainingMinutes: 40 },
  session: { id: "session-1", taskId: "task-1", state: "COMPLETED" },
  completion: {
    id: "outcome-1",
    taskId: "task-1",
    workSessionId: "session-1",
    outcome: "COMPLETED",
    remainingAfterMinutes: 40,
  },
};
const database = {
  async transaction(operation) {
    return operation({ repositories: {}, locks: {} });
  },
  async readSnapshot(operation) {
    return operation({
      repositories: {
        completionRecords: { getForUser: async () => facts.completion },
        workSessions: { getForUser: async () => facts.session },
        tasks: { getForUser: async () => facts.task },
      },
    });
  },
};
loaded.require = (id) =>
  ({
    "../database": { applicationDatabase: () => database },
    "./authorization": { requireActor: async () => ({ userId: "synthetic-user" }) },
    "./errors": {
      resultOf: async (operation) => {
        try {
          return { ok: true, value: await operation() };
        } catch {
          return { ok: false, error: { code: "INTERNAL_ERROR", message: "Synthetic failure" } };
        }
      },
    },
    "./planner": {
      generateAuthoritativePlan: async (request) => {
        calls.push(request);
        return { ok: true, value: { status: "SUCCEEDED", runId: `run-${calls.length}` } };
      },
    },
  })[id] ?? require(id);
loaded._compile(source, filename);
const triggers = loaded.exports;
const now = new Date("2026-09-21T16:00:00Z");
function task() {
  return {
    id: "task-1",
    userId: "synthetic-user",
    status: "READY",
    planningMode: "AUTO",
    archivedAt: null,
    dueAt: null,
    title: "Synthetic coursework",
    description: null,
    currentEstimatedMinutes: 90,
    remainingMinutes: 90,
    availableFrom: now,
  };
}
function calendar() {
  return {
    id: "event-1",
    constraintLevel: "HARD",
    archivedAt: null,
    startAt: now,
    endAt: new Date("2026-09-21T17:00:00Z"),
    title: "Synthetic",
  };
}

test("task trigger classification distinguishes creation, deadline, estimate and cosmetic text", () => {
  const base = task();
  assert.equal(triggers.classifyTaskMutation(null, base).trigger.type, "TASK_CREATED");
  assert.equal(
    triggers.classifyTaskMutation(base, { ...base, dueAt: new Date("2026-09-22T16:00:00Z") })
      .trigger.type,
    "DEADLINE_CHANGED",
  );
  assert.equal(
    triggers.classifyTaskMutation(base, { ...base, remainingMinutes: 50 }).trigger.type,
    "TASK_UPDATED",
  );
  assert.equal(
    triggers.classifyTaskMutation(base, {
      ...base,
      availableFrom: new Date("2026-09-22T16:00:00Z"),
    }).trigger.type,
    "TASK_UPDATED",
  );
  assert.equal(triggers.classifyTaskMutation(base, { ...base, title: "Edited title" }), null);
  assert.equal(triggers.classifyTaskMutation(null, { ...base, status: "INBOX" }), null);
});

test("hard calendar changes replan and cosmetic or informational changes do not", () => {
  const base = calendar();
  assert.equal(triggers.classifyCalendarMutation(null, base).trigger.type, "CALENDAR_CHANGED");
  assert.equal(
    triggers.classifyCalendarMutation(base, { ...base, endAt: new Date("2026-09-21T18:00:00Z") })
      .trigger.type,
    "CALENDAR_CHANGED",
  );
  assert.equal(
    triggers.classifyCalendarMutation(base, { ...base, archivedAt: now }).trigger.type,
    "CALENDAR_CHANGED",
  );
  assert.equal(triggers.classifyCalendarMutation(base, { ...base, title: "Edited title" }), null);
  assert.equal(
    triggers.classifyCalendarMutation(null, { ...base, constraintLevel: "INFORMATIONAL" }),
    null,
  );
});

test("post-commit helper retains mutation success and attaches accurate incremental provenance", async () => {
  calls.length = 0;
  const result = await triggers.planAfterMutation(
    Promise.resolve({ ok: true, value: task() }),
    (record) => triggers.classifyTaskMutation(null, record),
    () => now,
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.planning.value.status, "SUCCEEDED");
  assert.equal(calls[0].trigger.type, "TASK_CREATED");
  assert.equal(calls[0].mode, "INCREMENTAL");
  assert.equal(calls[0].now, now);
  const cosmetic = await triggers.planAfterMutation(
    Promise.resolve({ ok: true, value: task() }),
    () => null,
    () => now,
  );
  assert.equal(cosmetic.value.planning, undefined);
  assert.equal(calls.length, 1);
});

test("manual, daily refresh and integration batch keep distinct provenance and one post-batch replan", async () => {
  calls.length = 0;
  await triggers.replanManually({ full: true, now, releasedTimePolicy: "ALWAYS_REPLAN" });
  await triggers.refreshDailyPlan(now);
  let writes = 0;
  const batch = await triggers.commitIntegrationBatchAndReplan(
    { scope: "provider", key: "event-1", entityId: "batch-1" },
    async () => {
      writes += 3;
      return writes;
    },
    now,
  );
  assert.equal(batch.ok, true);
  assert.equal(batch.value.batch, 3);
  assert.equal(writes, 3);
  assert.deepEqual(
    calls.map((request) => request.trigger.type),
    ["MANUAL", "DAILY_REFRESH", "INTEGRATION_SYNC"],
  );
  assert.equal(calls[0].mode, "FULL");
  assert.equal(calls[0].releasedTimePolicy, "ALWAYS_REPLAN");
  assert.equal(calls[1].mode, "INCREMENTAL");
  assert.equal(calls[2].trigger.idempotencyKey, "event-1");
  assert.equal(calls[2].trigger.entityId, "batch-1");
});

test("completion and skip paths require already-consistent canonical facts", async () => {
  calls.length = 0;
  const completed = await triggers.replanAfterCommittedOutcome({
    completionRecordId: "outcome-1",
    kind: "COMPLETED",
    now,
  });
  assert.equal(completed.value.status, "SUCCEEDED");
  assert.equal(calls[0].trigger.type, "SESSION_COMPLETED");
  assert.equal(calls[0].trigger.entityId, "session-1");
  assert.equal(calls[0].trigger.idempotencyKey, "outcome-1");
  facts.session.state = "SKIPPED";
  facts.completion.outcome = "SKIPPED";
  const skipped = await triggers.replanAfterCommittedOutcome({
    completionRecordId: "outcome-1",
    kind: "SKIPPED",
    now,
    releasedWindows: [{ id: "released", startAt: now, endAt: new Date("2026-09-21T17:00:00Z") }],
    releasedTimePolicy: "KEEP_FREE",
  });
  assert.equal(skipped.value.status, "SUCCEEDED");
  assert.equal(calls[1].trigger.type, "SESSION_SKIPPED");
  assert.equal(calls[1].releasedTimePolicy, "KEEP_FREE");
  facts.task.remainingMinutes = null;
  const invalid = await triggers.replanAfterCommittedOutcome({
    completionRecordId: "outcome-1",
    kind: "SKIPPED",
    now,
  });
  assert.equal(invalid.value.status, "INPUT_FAILURE");
  assert.equal(calls.length, 2);
  facts.task.remainingMinutes = 40;
});
