const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const shared = require("../../dist/packages/shared/src/index.js");

const app = path.resolve(__dirname, "../../apps/web/src/server/application");
const webRequire = Module.createRequire(path.resolve(__dirname, "../../apps/web/package.json"));
function load(file, overrides = {}) {
  const filename = path.join(app, file);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = (id) =>
    overrides[id] ?? (id === "@university-planner/shared" ? shared : webRequire(id));
  loaded._compile(source, filename);
  return loaded.exports;
}
const d = (value) => new Date(value);
const owner = "synthetic-user";
const other = "other-user";
const recurrence = (id, startTimeLocal, endTimeLocal, spansNextDay = false) => ({
  id,
  userId: owner,
  recurrenceRule: "FREQ=DAILY",
  startTimeLocal,
  endTimeLocal,
  spansNextDay,
  timezone: "America/Toronto",
  effectiveFrom: "2026-03-01",
  effectiveUntil: null,
});
function state() {
  return {
    user: { id: owner, timezone: "America/Toronto", planningRevision: 7 },
    academicTerms: [
      {
        id: "term",
        userId: owner,
        status: "ACTIVE",
        startDate: "2026-01-05",
        endDate: "2026-04-30",
      },
    ],
    courses: [
      {
        id: "course",
        userId: owner,
        academicTermId: "term",
        code: "SYN101",
        colorReference: "indigo",
        archivedAt: null,
      },
    ],
    courseMeetings: [
      {
        ...recurrence("meeting", "10:00", "11:00"),
        courseId: "course",
        meetingType: "LECTURE",
        attendanceRequired: true,
        archivedAt: null,
      },
    ],
    assessments: [
      {
        id: "assessment",
        userId: owner,
        courseId: "course",
        title: "Synthetic exam",
        dueAt: d("2026-03-10T20:00:00Z"),
        archivedAt: null,
      },
    ],
    tasks: [
      {
        id: "task",
        userId: owner,
        courseId: "course",
        title: "Synthetic study",
        status: "READY",
        remainingMinutes: 90,
        dueAt: d("2026-03-10T19:00:00Z"),
        assessmentId: "assessment",
        archivedAt: null,
      },
      {
        id: "foreign-task",
        userId: other,
        title: "Foreign",
        status: "READY",
        remainingMinutes: 20,
        dueAt: null,
        assessmentId: null,
        archivedAt: null,
      },
    ],
    taskDependencies: [],
    calendarEvents: [
      {
        id: "event",
        userId: owner,
        title: "Appointment",
        startAt: d("2026-03-09T17:00:00Z"),
        endAt: d("2026-03-09T18:00:00Z"),
        constraintLevel: "HARD",
        archivedAt: null,
      },
    ],
    availabilityRules: [
      {
        ...recurrence("commute", "08:00", "09:00"),
        active: true,
        allowedLocationTags: ["TRANSIT_OK"],
      },
    ],
    protectedTimeRules: [
      {
        ...recurrence("sleep", "23:00", "07:00", true),
        active: true,
        isSleep: true,
        reason: "Sleep",
        protectionLevel: "HARD",
      },
    ],
    planningPreferences: [],
    workSessions: [
      {
        id: "generated",
        userId: owner,
        taskId: "task",
        startAt: d("2026-03-09T18:00:00Z"),
        endAt: d("2026-03-09T19:00:00Z"),
        plannedMinutes: 60,
        state: "PLANNED",
        generatedBy: "PLANNER",
        locked: false,
        supersededById: null,
      },
      {
        id: "manual",
        userId: owner,
        taskId: "task",
        startAt: d("2026-03-09T20:00:00Z"),
        endAt: d("2026-03-09T20:30:00Z"),
        plannedMinutes: 30,
        state: "PLANNED",
        generatedBy: "USER",
        locked: true,
        supersededById: null,
      },
      {
        id: "obsolete",
        userId: owner,
        taskId: "task",
        startAt: d("2026-03-09T21:00:00Z"),
        endAt: d("2026-03-09T21:30:00Z"),
        plannedMinutes: 30,
        state: "SUPERSEDED",
        generatedBy: "PLANNER",
        locked: false,
        supersededById: "generated",
      },
      {
        id: "cancelled",
        userId: owner,
        taskId: "task",
        startAt: d("2026-03-09T22:00:00Z"),
        endAt: d("2026-03-09T22:30:00Z"),
        plannedMinutes: 30,
        state: "CANCELLED",
        generatedBy: "USER",
        locked: false,
        supersededById: null,
      },
      {
        id: "foreign-session",
        userId: other,
        taskId: "foreign-task",
        startAt: d("2026-03-09T18:00:00Z"),
        endAt: d("2026-03-09T19:00:00Z"),
        plannedMinutes: 60,
        state: "PLANNED",
        generatedBy: "PLANNER",
        locked: false,
        supersededById: null,
      },
    ],
  };
}
function run(status = "SUCCEEDED", id = "run-1") {
  return {
    id,
    userId: owner,
    status,
    triggerType: "TASK_UPDATED",
    triggerEntityType: "TASK",
    triggerEntityId: "task",
    idempotencyScope: "private-scope",
    idempotencyKey: "private-event",
    startedAt: d("2026-03-09T15:00:00Z"),
    completedAt: d("2026-03-09T15:01:00Z"),
    plannerVersion: "heuristic-v1",
    planningHorizonStart: d("2026-03-09T15:00:00Z"),
    planningHorizonEnd: d("2026-03-16T04:00:00Z"),
    inputSnapshot: { private: "diagnostic" },
    warnings: [{ code: "LOW_SLACK", reasonCodes: ["LOW_SLACK"], taskId: "task" }],
    summary: {
      planStatus: "VALID",
      generatedSessionCount: 1,
      retainedSessionCount: 1,
      unscheduledMinutes: 0,
      risk: [{ taskId: "task", feasibility: "CONSTRAINED", deficitMinutes: 0, slackMinutes: 15 }],
      sessionReasons: {
        generated: ["DEADLINE_PRESSURE", "ENERGY_MATCH"],
        manual: ["LOCK_PRESERVED"],
      },
      delta: {
        retained: ["manual"],
        moved: [],
        added: ["generated"],
        removed: ["obsolete"],
        newlyAtRisk: ["task"],
        worsenedRisk: [],
        improvedRisk: [],
        resolvedRisk: [],
        unchangedRisk: [],
      },
    },
  };
}
class ApplicationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const read = load("planner-reads.ts", {
  "./errors": {
    ApplicationError,
    resultOf: async (fn) => {
      try {
        return { ok: true, value: await fn() };
      } catch (error) {
        return { ok: false, error: { code: error.code, message: error.message } };
      }
    },
  },
  "./authorization": { requireActor: async () => ({ userId: owner }) },
  "./validation": {
    calendarDateSchema: webRequire("zod").iso.date(),
    validateInput: (schema, value) => schema.parse(value),
  },
  "../database": {
    applicationDatabase: () => {
      throw new Error("No database in pure projection");
    },
  },
});

test("Today projects real active work, commitments, sleep, commute and durable reasons", () => {
  const today = read.buildToday(state(), run(), run(), "2026-03-09", d("2026-03-09T18:15:00Z"));
  assert.equal(today.date, "2026-03-09");
  assert.equal(today.plannedWorkMinutes, 90);
  assert.equal(today.remainingPlannedWorkMinutes, 75);
  assert.equal(today.currentItem.id, "generated");
  assert.equal(today.nextItem.id, "manual");
  assert.deepEqual(
    today.timeline.filter((item) => item.kind === "WORK").map((item) => item.id),
    ["generated", "manual"],
  );
  assert.deepEqual(today.timeline.find((item) => item.id === "generated").reasonCodes, [
    "DEADLINE_PRESSURE",
    "ENERGY_MATCH",
  ]);
  assert.equal(today.timeline.find((item) => item.id === "manual").locked, true);
  assert.equal(today.timeline.find((item) => item.id === "generated").courseCode, "SYN101");
  assert.equal(
    today.timeline.find((item) => item.id === "generated").courseColorReference,
    "indigo",
  );
  assert.equal(today.timeline.find((item) => item.id === "generated").remainingMinutes, 90);
  assert.equal(today.nextWorkItem.id, "manual");
  assert.ok(today.timeline.some((item) => item.kind === "COURSE_MEETING"));
  assert.ok(today.timeline.some((item) => item.kind === "EVENT"));
  assert.ok(today.timeline.some((item) => item.kind === "SLEEP"));
  assert.ok(today.timeline.some((item) => item.kind === "COMMUTE_WINDOW"));
  assert.deepEqual(
    today.remainingTasks.map((task) => task.id),
    ["task"],
  );
  assert.equal(today.risks[0].taskId, "task");
  assert.equal(today.risks[0].title, "Synthetic study");
  assert.equal(today.remainingTasks[0].courseCode, "SYN101");
  assert.equal(today.planner.authoritativeRun.plannerVersion, "heuristic-v1");
});

test("Today keeps unknown task facts unknown and distinguishes running and empty states", () => {
  const persisted = state();
  persisted.tasks[0].dueAt = null;
  persisted.tasks[0].remainingMinutes = null;
  persisted.assessments[0].dueAt = null;
  const running = read.buildToday(
    persisted,
    run("RUNNING", "running"),
    run(),
    "2026-03-09",
    d("2026-03-09T18:15:00Z"),
  );
  assert.equal(running.planner.status, "RUNNING");
  assert.equal(running.planner.authoritativeRun.id, "run-1");
  assert.equal(running.remainingTasks[0].dueAt, null);
  assert.equal(running.remainingTasks[0].remainingMinutes, null);
  persisted.tasks = [];
  persisted.workSessions = [];
  persisted.courseMeetings = [];
  persisted.calendarEvents = [];
  persisted.protectedTimeRules = [];
  persisted.availabilityRules = [];
  const empty = read.buildToday(persisted, null, null, "2026-03-09", d("2026-03-09T18:15:00Z"));
  assert.equal(empty.planner.status, "UNPLANNED");
  assert.equal(empty.currentItem, null);
  assert.equal(empty.nextItem, null);
  assert.equal(empty.nextWorkItem, null);
  assert.equal(empty.remainingTasks.length, 0);
});

test("Week is local Monday through next Monday across Toronto DST and keeps risk and deadlines", () => {
  const week = read.buildWeek(state(), run(), run(), "2026-03-09");
  assert.equal(week.weekStart, "2026-03-09");
  assert.equal(week.weekEnd, "2026-03-16");
  assert.equal(week.days.length, 7);
  assert.equal(week.days[0].plannedWorkMinutes, 90);
  assert.ok(week.days[0].availabilityWindowMinutes > 0);
  assert.deepEqual(
    week.deadlines.map((item) => item.kind),
    ["TASK", "ASSESSMENT"],
  );
  assert.equal(week.deadlines[0].courseCode, "SYN101");
  assert.equal(week.risks[0].title, "Synthetic study");
  assert.equal(week.risks[0].courseCode, "SYN101");
  assert.deepEqual(week.activeTermRange, { startDate: "2026-01-05", endDate: "2026-04-30" });
  assert.deepEqual(week.latestChange.added, ["generated"]);
  assert.deepEqual(week.planner.authoritativeRun.riskChanges.newlyAtRisk, ["task"]);
  assert.equal(
    week.schedule.find((item) => item.kind === "COURSE_MEETING").startAt.toISOString(),
    "2026-03-09T14:00:00.000Z",
  );
});

test("a failed latest run leaves prior authoritative schedule visible and foreign facts excluded", () => {
  const persisted = state();
  persisted.calendarEvents.push({
    id: "foreign-event",
    userId: other,
    title: "Private",
    startAt: d("2026-03-09T18:00:00Z"),
    endAt: d("2026-03-09T18:30:00Z"),
    constraintLevel: "HARD",
    archivedAt: null,
  });
  const failed = {
    ...run("FAILED", "failed-run"),
    summary: null,
    warnings: [{ code: "INVALID_OUTPUT", reasonCodes: [] }],
  };
  const today = read.buildToday(persisted, failed, run(), "2026-03-09", d("2026-03-09T18:15:00Z"));
  assert.equal(today.planner.status, "FAILED");
  assert.equal(today.planner.authoritativeRun.id, "run-1");
  assert.ok(today.timeline.some((item) => item.id === "generated"));
  assert.ok(
    today.timeline.every(
      (item) => item.sourceId !== "foreign-event" && item.id !== "foreign-session",
    ),
  );
  assert.equal(today.warnings[0].code, "INVALID_OUTPUT");
});

test("history projection omits raw input and event identity but retains provenance, delta and warnings", () => {
  const item = read.planHistoryItem(run());
  assert.equal(item.trigger.type, "TASK_UPDATED");
  assert.equal(item.plannerVersion, "heuristic-v1");
  assert.deepEqual(item.delta.removed, ["obsolete"]);
  assert.deepEqual(item.riskChanges.newlyAtRisk, ["task"]);
  assert.equal(item.warnings[0].code, "LOW_SLACK");
  assert.equal("inputSnapshot" in item, false);
  assert.equal("idempotencyKey" in item, false);
});

test("read service rejects missing actor before database access", async () => {
  let touched = false;
  const unauthorized = load("planner-reads.ts", {
    "./errors": {
      ApplicationError,
      resultOf: async (fn) => {
        try {
          return { ok: true, value: await fn() };
        } catch (error) {
          return { ok: false, error: { code: error.code } };
        }
      },
    },
    "./authorization": {
      requireActor: async () => {
        throw new ApplicationError("UNAUTHORIZED", "Sign in required");
      },
    },
    "./validation": {
      calendarDateSchema: webRequire("zod").iso.date(),
      validateInput: (schema, value) => schema.parse(value),
    },
    "../database": {
      applicationDatabase: () => {
        touched = true;
      },
    },
  });
  const result = await unauthorized.plannerViews.today({ date: "2026-03-09" });
  assert.equal(result.error.code, "UNAUTHORIZED");
  assert.equal(touched, false);
});

test("authenticated Today and Week reads use one scoped database snapshot", async () => {
  const calls = [];
  const persisted = state();
  const success = run();
  const database = {
    async readSnapshot(operation) {
      calls.push("snapshot");
      return operation({
        repositories: {
          users: {
            async getById(userId) {
              calls.push(`user:${userId}`);
              return userId === owner ? persisted.user : null;
            },
          },
          planningState: {
            async snapshot(userId, startAt, endAt) {
              calls.push(`state:${userId}`);
              assert.ok(startAt < endAt);
              return userId === owner ? persisted : null;
            },
          },
          plannerRuns: {
            async listRecent(userId) {
              calls.push(`recent:${userId}`);
              return userId === owner ? [success] : [];
            },
            async latestSuccessful(userId) {
              calls.push(`success:${userId}`);
              return userId === owner ? success : null;
            },
          },
        },
      });
    },
  };
  const connected = load("planner-reads.ts", {
    "./errors": {
      ApplicationError,
      resultOf: async (fn) => {
        try {
          return { ok: true, value: await fn() };
        } catch (error) {
          return { ok: false, error: { code: error.code } };
        }
      },
    },
    "./authorization": { requireActor: async () => ({ userId: owner }) },
    "./validation": {
      calendarDateSchema: webRequire("zod").iso.date(),
      validateInput: (schema, value) => schema.parse(value),
    },
    "../database": { applicationDatabase: () => database },
  });
  const today = await connected.plannerViews.today({ date: "2026-03-09" });
  const week = await connected.plannerViews.week({ date: "2026-03-11" });
  assert.equal(today.ok, true);
  assert.equal(today.value.timeline.find((item) => item.id === "generated").taskId, "task");
  assert.equal(week.ok, true);
  assert.equal(week.value.weekStart, "2026-03-09");
  assert.deepEqual(calls, [
    "snapshot",
    `user:${owner}`,
    `state:${owner}`,
    `recent:${owner}`,
    `success:${owner}`,
    "snapshot",
    `user:${owner}`,
    `state:${owner}`,
    `recent:${owner}`,
    `success:${owner}`,
  ]);
});

test("Today transport maps an unauthenticated service result to HTTP 401", async () => {
  const route = load("../../app/api/v1/planner/today/route.ts", {
    "../../../../../server/application/planner-reads": {
      plannerViews: {
        today: async () => ({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "Sign in is required." },
        }),
      },
    },
    "../../../../../server/transport": load("../transport.ts"),
  });
  const response = await route.GET(
    new Request("http://localhost/api/v1/planner/today?date=2026-03-09"),
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "UNAUTHORIZED");
});

test("production planner read module and routes do not import visual fixtures or repositories", () => {
  const paths = [
    "apps/web/src/server/application/planner-reads.ts",
    "apps/web/src/app/api/v1/planner/today/route.ts",
    "apps/web/src/app/api/v1/planner/week/route.ts",
    "apps/web/src/app/api/v1/planner/runs/route.ts",
  ];
  for (const relative of paths) {
    const source = fs.readFileSync(path.resolve(__dirname, "../..", relative), "utf8");
    assert.doesNotMatch(source, /prototypes|fixtures|@prisma\/client|repositories\//);
  }
});
