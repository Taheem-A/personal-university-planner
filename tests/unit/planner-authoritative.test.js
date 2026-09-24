const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const core = require("../../dist/packages/planner-core/src/index.js");
const shared = require("../../dist/packages/shared/src/index.js");

function load(relative, overrides = {}) {
  const filename = path.resolve(__dirname, "../../apps/web/src/server/application", relative);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = (id) =>
    overrides[id] ??
    (id === "@university-planner/shared"
      ? shared
      : id === "@university-planner/planner-core"
        ? core
        : require(id));
  loaded._compile(source, filename);
  return loaded.exports;
}
const mapper = load("planner-input.ts");
const service = load("planner-execution.ts", { "./planner-input": mapper });
const d = (value) => new Date(value);
const now = d("2026-09-21T12:00:00-04:00");
const userId = "synthetic-user";
const otherId = "other-user";
const recurrence = (startTimeLocal, endTimeLocal, spansNextDay = false) => ({
  recurrenceRule: "FREQ=DAILY",
  startTimeLocal,
  endTimeLocal,
  spansNextDay,
  timezone: "America/Toronto",
  effectiveFrom: "2026-09-01",
  effectiveUntil: null,
});
function task(id = "task-1", owner = userId) {
  return {
    id,
    userId: owner,
    courseId: "course-1",
    assessmentId: null,
    title: "Synthetic coursework",
    status: "READY",
    planningMode: "AUTO",
    archivedAt: null,
    sourceConfidence: "MANUAL",
    availableFrom: d("2026-09-20T08:00:00-04:00"),
    dueAt: d("2026-09-24T17:00:00-04:00"),
    preferredCompletionAt: null,
    originalEstimatedMinutes: 120,
    currentEstimatedMinutes: 120,
    remainingMinutes: 90,
    energyRequirement: "HIGH",
    locationRequirements: ["DESK"],
    minimumSessionMinutes: 20,
    preferredSessionMinutes: 45,
    maximumSessionMinutes: 90,
    splittable: true,
    interruptible: true,
    priorityOverride: null,
  };
}
function state(owner = userId) {
  return {
    user: { id: owner, timezone: "America/Toronto", planningRevision: 0 },
    academicTerms: [{ id: "term-1", userId: owner, status: "ACTIVE" }],
    courses: [
      {
        id: "course-1",
        userId: owner,
        academicTermId: "term-1",
        archivedAt: null,
        defaultTaskEnergy: null,
      },
    ],
    courseMeetings: [
      {
        id: "lecture",
        userId: owner,
        courseId: "course-1",
        meetingType: "LECTURE",
        attendanceRequired: true,
        archivedAt: null,
        ...recurrence("10:00", "11:00"),
        recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
      },
    ],
    assessments: [],
    tasks: [task("task-1", owner)],
    taskDependencies: [],
    calendarEvents: [],
    availabilityRules: [
      {
        id: "available",
        userId: owner,
        active: true,
        capacityFactor: 1,
        energyLevel: "HIGH",
        allowedLocationTags: ["DESK"],
        ...recurrence("08:00", "22:00"),
      },
    ],
    protectedTimeRules: [
      {
        id: "sleep",
        userId: owner,
        active: true,
        isSleep: true,
        protectionLevel: "HARD",
        reason: "Sleep",
        ...recurrence("23:00", "07:00", true),
      },
    ],
    planningPreferences: [
      {
        userId: owner,
        minimumSleepMinutes: 420,
        preferredDailyStudyLimitMinutes: 240,
        minimumFreeTimeMinutes: 30,
        preferredDeadlineBufferHours: 12,
        avoidLateHighEnergyTasks: true,
        maximumConsecutiveWorkMinutes: 120,
        minimumBreakMinutes: 10,
        scheduleCommuteWork: false,
        weekendWorkBias: -0.5,
        planStabilityWindowMinutes: 120,
      },
    ],
    workSessions: [],
  };
}
function request(trigger = { type: "MANUAL" }) {
  return {
    operation: "AUTHORITATIVE_GENERATION",
    mode: "INCREMENTAL",
    trigger,
    now,
    plannerVersion: "heuristic-v1",
    releasedTimePolicy: "REPLAN_IF_USEFUL",
  };
}

/** Transactional repository double: clones all persisted records before every write transaction. */
function database(states = [state()]) {
  let data = {
    states: Object.fromEntries(states.map((item) => [item.user.id, item])),
    sessions: [],
    runs: [],
  };
  let failBatch = false;
  let beforeClaim = null;
  let transactionTail = Promise.resolve();
  const repos = (working) => ({
    planningState: {
      async snapshot(owner) {
        const entry = working.states[owner];
        if (!entry) return null;
        return {
          ...entry,
          workSessions: working.sessions.filter(
            (row) =>
              row.userId === owner &&
              ["PLANNED", "ACTIVE"].includes(row.state) &&
              !row.supersededById,
          ),
        };
      },
      async claimRevision(owner, expected) {
        if (beforeClaim) {
          const action = beforeClaim;
          beforeClaim = null;
          action(working);
        }
        const entry = working.states[owner];
        if (!entry) return { status: "NOT_FOUND" };
        if (entry.user.planningRevision !== expected) return { status: "STALE" };
        entry.user.planningRevision++;
        return { status: "CLAIMED", revision: entry.user.planningRevision };
      },
    },
    plannerRuns: {
      async failExpiredRunning(owner, cutoff, completedAt) {
        let count = 0;
        for (const row of working.runs) {
          if (row.userId !== owner || row.status !== "RUNNING" || row.startedAt >= cutoff) continue;
          Object.assign(row, {
            status: "FAILED",
            completedAt,
            warnings: [{ code: "ABANDONED", reasonCodes: [] }],
          });
          count++;
        }
        return count;
      },
      async start(row) {
        const existing =
          row.idempotencyKey &&
          working.runs.find(
            (item) =>
              item.userId === row.userId &&
              item.triggerType === row.triggerType &&
              item.idempotencyScope === row.idempotencyScope &&
              item.idempotencyKey === row.idempotencyKey,
          );
        if (existing) return { status: "EXISTING", record: existing };
        working.runs.push(row);
        return { status: "CREATED", record: row };
      },
      async latestSuccessful(owner) {
        return (
          working.runs.filter((row) => row.userId === owner && row.status === "SUCCEEDED").at(-1) ??
          null
        );
      },
      async complete(owner, id, result) {
        const row = working.runs.find(
          (item) => item.id === id && item.userId === owner && item.status === "RUNNING",
        );
        if (!row) return { status: "STALE" };
        Object.assign(row, result);
        return { status: "UPDATED", record: row };
      },
    },
    workSessions: {
      async listActiveGenerated(owner, start, end) {
        return working.sessions.filter(
          (row) =>
            row.userId === owner &&
            row.generatedBy === "PLANNER" &&
            ["PLANNED", "ACTIVE"].includes(row.state) &&
            row.startAt < end &&
            row.endAt > start &&
            !row.supersededById,
        );
      },
      async createGeneratedBatch(owner, rows) {
        if (failBatch) throw new Error("Synthetic persistence failure");
        assert.ok(rows.every((row) => row.userId === owner && row.generatedBy === "PLANNER"));
        working.sessions.push(...rows);
        working.states[owner].user.planningRevision++;
        return rows;
      },
      async supersedeGenerated(owner, changes) {
        return changes.map((change) => {
          const row = working.sessions.find(
            (item) =>
              item.id === change.id &&
              item.userId === owner &&
              item.generatedBy === "PLANNER" &&
              !item.locked &&
              ["PLANNED", "ACTIVE"].includes(item.state),
          );
          if (!row) throw new Error("Invalid supersession");
          row.state = "SUPERSEDED";
          row.supersededById = change.replacementId;
          working.states[owner].user.planningRevision++;
          return row;
        });
      },
    },
  });
  return {
    get data() {
      return data;
    },
    set failBatch(value) {
      failBatch = value;
    },
    set beforeClaim(value) {
      beforeClaim = value;
    },
    async readSnapshot(operation) {
      return operation({ repositories: repos(structuredClone(data)) });
    },
    async transaction(operation) {
      const previous = transactionTail;
      let release;
      transactionTail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      const working = structuredClone(data);
      try {
        const result = await operation({ repositories: repos(working) });
        data = working;
        return result;
      } finally {
        release();
      }
    },
  };
}
function dependencies(generate) {
  let next = 0;
  return { id: () => `durable-${++next}`, clock: () => now, ...(generate ? { generate } : {}) };
}
function active(db, owner = userId) {
  return db.data.sessions.filter(
    (row) => row.userId === owner && row.state === "PLANNED" && row.generatedBy === "PLANNER",
  );
}

test("canonical snapshot invokes heuristic-v1 and persists a reloadable run and sessions", async () => {
  const db = database([state(), state(otherId)]);
  db.data.states[userId].tasks.push({ ...task("foreign", otherId) });
  const result = await service.executePlannerForActor(
    db,
    userId,
    request({ type: "TASK_UPDATED", entityType: "TASK", entityId: "task-1" }),
    dependencies(),
  );
  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.plannerVersion, "heuristic-v1");
  assert.ok(active(db).length > 0);
  assert.ok(
    active(db).every((row) => row.plannerRunId === result.runId && row.taskId === "task-1"),
  );
  const run = db.data.runs[0];
  assert.equal(run.status, "SUCCEEDED");
  assert.equal(run.triggerType, "TASK_UPDATED");
  assert.equal(run.triggerEntityType, "TASK");
  assert.equal(run.plannerVersion, "heuristic-v1");
  assert.equal(run.inputSnapshot.schemaVersion, 1);
  assert.equal(run.inputSnapshot.input.now, now.toISOString());
  assert.equal(run.inputSnapshot.input.tasks.length, 1);
  assert.equal(run.summary.delta.added.length, active(db).length);
  assert.equal(db.data.sessions.filter((row) => row.userId === otherId).length, 0);
});

test("repeat incremental run retains stable session IDs without duplicates", async () => {
  const db = database();
  const deps = dependencies();
  const first = await service.executePlannerForActor(db, userId, request(), deps);
  assert.equal(first.status, "SUCCEEDED");
  const original = active(db).map((row) => row.id);
  const second = await service.executePlannerForActor(db, userId, request(), deps);
  assert.equal(second.status, "SUCCEEDED", JSON.stringify(second));
  assert.deepEqual(
    active(db).map((row) => row.id),
    original,
  );
  assert.deepEqual(second.delta.retained, original);
  assert.deepEqual(second.delta.added, []);
});

test("an identical full replan retains existing durable IDs despite new core IDs", async () => {
  const db = database();
  const deps = dependencies();
  assert.equal(
    (await service.executePlannerForActor(db, userId, request(), deps)).status,
    "SUCCEEDED",
  );
  const original = active(db).map((row) => row.id);
  const result = await service.executePlannerForActor(
    db,
    userId,
    { ...request(), operation: "FULL_REPLAN", mode: "FULL" },
    deps,
  );
  assert.equal(result.status, "SUCCEEDED", JSON.stringify(result));
  assert.deepEqual(
    active(db).map((row) => row.id),
    original,
  );
  assert.deepEqual(result.delta.retained, original);
  assert.deepEqual(result.delta.moved, []);
});

test("incremental task change keeps unaffected near-term sessions stable", async () => {
  const s = state();
  s.tasks.push({
    ...task("task-2"),
    availableFrom: d("2026-09-22T12:00:00-04:00"),
    dueAt: d("2026-09-25T17:00:00-04:00"),
  });
  const db = database([s]);
  const deps = dependencies();
  assert.equal(
    (await service.executePlannerForActor(db, userId, request(), deps)).status,
    "SUCCEEDED",
  );
  const unaffected = active(db)
    .filter((row) => row.taskId === "task-1")
    .map((row) => row.id);
  assert.ok(unaffected.length > 0);
  db.data.states[userId].tasks[1].dueAt = d("2026-09-26T17:00:00-04:00");
  db.data.states[userId].user.planningRevision++;
  const result = await service.executePlannerForActor(
    db,
    userId,
    request({ type: "DEADLINE_CHANGED", entityType: "TASK", entityId: "task-2" }),
    deps,
  );
  assert.equal(result.status, "SUCCEEDED", JSON.stringify(result));
  assert.ok(unaffected.every((id) => result.delta.retained.includes(id)));
  assert.equal(db.data.runs.at(-1).triggerType, "DEADLINE_CHANGED");
});

test("released-time KEEP_FREE leaves the window empty while REPLAN_IF_USEFUL can refill it", async () => {
  const s = state();
  s.tasks[0].dueAt = d("2026-09-21T18:00:00Z");
  const released = { id: "released", startAt: now, endAt: d("2026-09-21T18:00:00Z") };
  const trigger = {
    type: "SESSION_SKIPPED",
    entityType: "WORK_SESSION",
    entityId: "synthetic-skip",
    releasedWindows: [released],
  };
  const free = database([structuredClone(s)]);
  const keep = await service.executePlannerForActor(
    free,
    userId,
    { ...request(trigger), releasedTimePolicy: "KEEP_FREE" },
    dependencies(),
  );
  assert.equal(keep.status, "SUCCEEDED", JSON.stringify(keep));
  assert.equal(active(free).length, 0);
  assert.ok(keep.summary.unscheduledMinutes > 0);
  const refill = database([structuredClone(s)]);
  const useful = await service.executePlannerForActor(
    refill,
    userId,
    { ...request(trigger), releasedTimePolicy: "REPLAN_IF_USEFUL" },
    dependencies(),
  );
  assert.equal(useful.status, "SUCCEEDED", JSON.stringify(useful));
  assert.ok(
    active(refill).some((row) => row.startAt < released.endAt && row.endAt > released.startAt),
  );
});

test("risk delta distinguishes new, worsened, unchanged and resolved core risk", async () => {
  const db = database();
  let feasibility = "CONSTRAINED";
  const deps = dependencies((input) => {
    const output = core.generatePlan(input);
    output.pressures = [
      { taskId: "task-1", feasibility, capacityDeficitMinutes: 0, slackMinutes: 30 },
    ];
    return output;
  });
  const first = await service.executePlannerForActor(db, userId, request(), deps);
  assert.deepEqual(first.delta.newlyAtRisk, ["task-1"]);
  feasibility = "CRITICAL";
  const worse = await service.executePlannerForActor(db, userId, request(), deps);
  assert.deepEqual(worse.delta.worsenedRisk, ["task-1"]);
  const same = await service.executePlannerForActor(db, userId, request(), deps);
  assert.deepEqual(same.delta.unchangedRisk, ["task-1"]);
  feasibility = "CONSTRAINED";
  const improved = await service.executePlannerForActor(db, userId, request(), deps);
  assert.deepEqual(improved.delta.improvedRisk, ["task-1"]);
  feasibility = "COMFORTABLE";
  const resolved = await service.executePlannerForActor(db, userId, request(), deps);
  assert.deepEqual(resolved.delta.resolvedRisk, ["task-1"]);
});

test("stable idempotency identity returns the prior outcome", async () => {
  const db = database();
  const deps = dependencies();
  const req = request({
    type: "INTEGRATION_SYNC",
    idempotencyScope: "provider-event",
    idempotencyKey: "synthetic-event-1",
  });
  const first = await service.executePlannerForActor(db, userId, req, deps);
  const second = await service.executePlannerForActor(db, userId, req, deps);
  assert.equal(first.status, "SUCCEEDED");
  assert.deepEqual(second, { status: "DUPLICATE", runId: first.runId, runStatus: "SUCCEEDED" });
  assert.equal(db.data.runs.length, 1);
});

test("replanning supersedes old generated history with stable delta identities", async () => {
  const db = database();
  const deps = dependencies();
  const first = await service.executePlannerForActor(db, userId, request(), deps);
  assert.equal(first.status, "SUCCEEDED");
  // Supersession semantics are exercised by a full replan after canonical availability moves.
  db.data.states[userId].availabilityRules[0].startTimeLocal = "12:00";
  db.data.states[userId].user.planningRevision++;
  const full = { ...request(), operation: "FULL_REPLAN", mode: "FULL" };
  const second = await service.executePlannerForActor(db, userId, full, deps);
  assert.equal(second.status, "SUCCEEDED", JSON.stringify(second));
  assert.ok(db.data.sessions.some((row) => row.state === "SUPERSEDED"));
  assert.ok(second.delta.moved.length > 0, JSON.stringify(second.delta));
});

test("a disappeared task's old sessions are superseded without a fake replacement", async () => {
  const db = database();
  const deps = dependencies();
  assert.equal(
    (await service.executePlannerForActor(db, userId, request(), deps)).status,
    "SUCCEEDED",
  );
  const oldIds = active(db).map((row) => row.id);
  db.data.states[userId].tasks[0].remainingMinutes = 0;
  db.data.states[userId].user.planningRevision++;
  const result = await service.executePlannerForActor(
    db,
    userId,
    { ...request(), operation: "FULL_REPLAN", mode: "FULL" },
    deps,
  );
  assert.equal(result.status, "SUCCEEDED", JSON.stringify(result));
  assert.deepEqual(result.delta.removed.sort(), oldIds.sort());
  assert.ok(
    db.data.sessions
      .filter((row) => oldIds.includes(row.id))
      .every((row) => row.state === "SUPERSEDED" && row.supersededById === null),
  );
});

test("archived task releases obsolete generated sessions from planner input and supersedes them", async () => {
  const db = database();
  const deps = dependencies();
  assert.equal(
    (await service.executePlannerForActor(db, userId, request(), deps)).status,
    "SUCCEEDED",
  );
  const oldIds = active(db).map((row) => row.id);
  db.data.states[userId].tasks[0].archivedAt = now;
  db.data.states[userId].user.planningRevision++;
  const result = await service.executePlannerForActor(
    db,
    userId,
    request({ type: "TASK_UPDATED", entityType: "TASK", entityId: "task-1" }),
    deps,
  );
  assert.equal(result.status, "SUCCEEDED", JSON.stringify(result));
  assert.deepEqual(result.delta.removed.sort(), oldIds.sort());
  assert.equal(active(db).length, 0);
  assert.deepEqual(db.data.runs.at(-1).inputSnapshot.input.tasks, []);
});

test("manual and locked sessions remain unchanged during authoritative generation", async () => {
  const db = database();
  const base = {
    version: 0,
    userId,
    taskId: "task-1",
    plannerRunId: null,
    plannedMinutes: 30,
    state: "PLANNED",
    supersededById: null,
    createdAt: now,
    updatedAt: now,
  };
  const manual = {
    ...base,
    id: "manual",
    generatedBy: "USER",
    locked: false,
    startAt: d("2026-09-22T16:00:00Z"),
    endAt: d("2026-09-22T16:30:00Z"),
  };
  const locked = {
    ...base,
    id: "locked",
    generatedBy: "PLANNER",
    locked: true,
    startAt: d("2026-09-22T17:00:00Z"),
    endAt: d("2026-09-22T17:30:00Z"),
  };
  db.data.sessions.push(manual, locked);
  const result = await service.executePlannerForActor(db, userId, request(), dependencies());
  assert.equal(result.status, "SUCCEEDED", JSON.stringify(result));
  assert.deepEqual(
    db.data.sessions.find((row) => row.id === "manual"),
    manual,
  );
  assert.deepEqual(
    db.data.sessions.find((row) => row.id === "locked"),
    locked,
  );
  assert.ok(result.delta.retained.includes("locked"));
});

test("valid infeasible work persists quantified deficit", async () => {
  const s = state();
  s.tasks[0].remainingMinutes = 3000;
  s.tasks[0].currentEstimatedMinutes = 3000;
  s.tasks[0].originalEstimatedMinutes = 3000;
  const db = database([s]);
  const result = await service.executePlannerForActor(db, userId, request(), dependencies());
  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.planStatus, "INFEASIBLE");
  assert.ok(result.summary.unscheduledMinutes > 0);
  assert.ok(result.warnings.some((warning) => warning.deficitMinutes > 0));
});

test("invalid output, core throw, stale snapshot, and rollback retain the prior schedule", async () => {
  const db = database();
  const deps = dependencies();
  const first = await service.executePlannerForActor(db, userId, request(), deps);
  assert.equal(first.status, "SUCCEEDED");
  const original = structuredClone(active(db));
  const invalid = await service.executePlannerForActor(
    db,
    userId,
    request(),
    dependencies((input) => {
      const output = core.generatePlan(input);
      output.sessions.push({ ...output.sessions[0], id: "alien", userId: otherId });
      return output;
    }),
  );
  assert.deepEqual(
    { status: invalid.status, code: invalid.code },
    { status: "FAILED", code: "INVALID_OUTPUT" },
  );
  const omittedWork = await service.executePlannerForActor(
    db,
    userId,
    request(),
    dependencies((input) => ({
      ...core.generatePlan(input),
      sessions: [],
      unscheduledMinutesByTask: {},
      infeasibilities: [],
      validationIssues: [],
      status: "VALID",
    })),
  );
  assert.equal(omittedWork.code, "INVALID_OUTPUT");
  const thrown = await service.executePlannerForActor(
    db,
    userId,
    request(),
    dependencies(() => {
      throw new Error("synthetic core fault");
    }),
  );
  assert.equal(thrown.code, "CORE_FAILURE");
  db.beforeClaim = (working) => {
    working.states[userId].user.planningRevision++;
  };
  const stale = await service.executePlannerForActor(db, userId, request(), deps);
  assert.equal(stale.code, "STALE_SNAPSHOT");
  db.failBatch = true;
  const failedWrite = await service.executePlannerForActor(db, userId, request(), deps);
  assert.equal(failedWrite.code, "PERSISTENCE_FAILURE");
  assert.deepEqual(active(db), original);
  assert.ok(db.data.runs.slice(1).every((row) => row.status === "FAILED" && row.completedAt));
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("overlapping same-user computations allow one authoritative commit", async () => {
  const db = database();
  const entered = deferred();
  const release = deferred();
  let waiting = 0;
  const deps = dependencies(async (input) => {
    if (++waiting === 2) entered.resolve();
    await release.promise;
    return core.generatePlan(input);
  });
  const first = service.executePlannerForActor(db, userId, request(), deps);
  const second = service.executePlannerForActor(db, userId, request(), deps);
  await entered.promise;
  assert.equal(db.data.runs.filter((run) => run.status === "RUNNING").length, 2);
  release.resolve();
  const results = await Promise.all([first, second]);
  assert.deepEqual(results.map((result) => result.status).sort(), ["FAILED", "SUCCEEDED"]);
  assert.equal(results.find((result) => result.status === "FAILED").code, "STALE_SNAPSHOT");
  assert.equal(db.data.runs.filter((run) => run.status === "SUCCEEDED").length, 1);
  assert.equal(new Set(active(db).map((row) => row.id)).size, active(db).length);
  assert.ok(db.data.sessions.every((row) => row.state !== "SUPERSEDED"));
});

test("a canonical edit during computation rejects the old snapshot; another user can finish", async () => {
  const db = database([state(), state(otherId)]);
  const entered = deferred();
  const release = deferred();
  const old = service.executePlannerForActor(
    db,
    userId,
    request(),
    dependencies(async (input) => {
      entered.resolve();
      await release.promise;
      return core.generatePlan(input);
    }),
  );
  await entered.promise;
  db.data.states[userId].tasks[0].remainingMinutes += 30;
  db.data.states[userId].user.planningRevision++;
  const independent = await service.executePlannerForActor(db, otherId, request(), dependencies());
  assert.equal(independent.status, "SUCCEEDED");
  release.resolve();
  const stale = await old;
  assert.deepEqual(
    { status: stale.status, code: stale.code },
    { status: "FAILED", code: "STALE_SNAPSHOT" },
  );
  assert.equal(active(db).length, 0);
  const fresh = await service.executePlannerForActor(db, userId, request(), dependencies());
  assert.equal(fresh.status, "SUCCEEDED");
  assert.equal(
    db.data.runs.findLast((run) => run.userId === userId && run.status === "SUCCEEDED")
      .inputSnapshot.input.tasks[0].remainingMinutes,
    120,
  );
});

test("keyed delivery reuses one run, distinct keys and unkeyed retries remain independent", async () => {
  const db = database();
  const keyed = (key) =>
    request({
      type: "INTEGRATION_SYNC",
      idempotencyScope: "synthetic-provider",
      idempotencyKey: key,
    });
  const deps = dependencies();
  const first = await service.executePlannerForActor(db, userId, keyed("event-1"), deps);
  assert.equal(first.status, "SUCCEEDED");
  const count = active(db).length;
  const duplicate = await service.executePlannerForActor(db, userId, keyed("event-1"), deps);
  assert.deepEqual(duplicate, { status: "DUPLICATE", runId: first.runId, runStatus: "SUCCEEDED" });
  assert.equal(db.data.runs.length, 1);
  assert.equal(active(db).length, count);
  assert.equal(
    (await service.executePlannerForActor(db, userId, keyed("event-2"), deps)).status,
    "SUCCEEDED",
  );
  assert.equal(
    (await service.executePlannerForActor(db, userId, request(), deps)).status,
    "SUCCEEDED",
  );
  assert.equal(db.data.runs.length, 3);
});

test("duplicate delivery during computation observes RUNNING without a second plan", async () => {
  const db = database();
  const entered = deferred();
  const release = deferred();
  const keyed = request({
    type: "INTEGRATION_SYNC",
    idempotencyScope: "synthetic-provider",
    idempotencyKey: "concurrent-event",
  });
  const first = service.executePlannerForActor(db, userId, keyed, {
    ...dependencies(),
    generate: async (input) => {
      entered.resolve();
      await release.promise;
      return core.generatePlan(input);
    },
  });
  await entered.promise;
  const duplicate = await service.executePlannerForActor(db, userId, keyed, dependencies());
  assert.equal(duplicate.status, "DUPLICATE");
  assert.equal(duplicate.runStatus, "RUNNING");
  release.resolve();
  const result = await first;
  assert.equal(result.status, "SUCCEEDED");
  assert.equal(duplicate.runId, result.runId);
  assert.equal(db.data.runs.length, 1);
  assert.ok(active(db).length > 0);
});

test("abandoned keyed run is failed on demand and cannot publish a late result", async () => {
  const db = database();
  const entered = deferred();
  const release = deferred();
  const keyed = request({
    type: "INTEGRATION_SYNC",
    idempotencyScope: "synthetic-provider",
    idempotencyKey: "event-1",
  });
  const old = service.executePlannerForActor(db, userId, keyed, {
    ...dependencies(),
    generate: async (input) => {
      entered.resolve();
      await release.promise;
      return core.generatePlan(input);
    },
  });
  await entered.promise;
  db.data.runs[0].startedAt = new Date(now.getTime() - 31 * 60_000);
  const duplicate = await service.executePlannerForActor(db, userId, keyed, dependencies());
  assert.equal(duplicate.status, "DUPLICATE");
  assert.equal(duplicate.runStatus, "FAILED");
  assert.equal(db.data.runs[0].warnings[0].code, "ABANDONED");
  release.resolve();
  const late = await old;
  assert.equal(late.status, "FAILED");
  assert.equal(active(db).length, 0);
  assert.equal(db.data.runs[0].status, "FAILED");
});
