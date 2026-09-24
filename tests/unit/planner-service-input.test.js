const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const {
  generatePlan,
  normalizePlannerInput,
} = require("../../dist/packages/planner-core/src/index.js");

const mapperPath = path.resolve(
  __dirname,
  "../../apps/web/src/server/application/planner-input.ts",
);
const source = fs.readFileSync(mapperPath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = new Module(mapperPath, module);
loaded.filename = mapperPath;
loaded.paths = module.paths;
loaded.require = (id) =>
  id === "@university-planner/shared"
    ? require("../../dist/packages/shared/src/index.js")
    : require(id);
loaded._compile(compiled, mapperPath);
const mapper = Promise.resolve(loaded.exports);
const d = (value) => new Date(value);
const actor = "synthetic-user";
const now = d("2026-09-21T12:00:00-04:00");
const recurrence = (start, end, spansNextDay = false) => ({
  recurrenceRule: "FREQ=DAILY",
  startTimeLocal: start,
  endTimeLocal: end,
  spansNextDay,
  timezone: "America/Toronto",
  effectiveFrom: "2026-09-01",
  effectiveUntil: null,
});
function task(id = "task-1") {
  return {
    id,
    userId: actor,
    courseId: "course-1",
    assessmentId: null,
    title: "Synthetic problem set",
    status: "READY",
    planningMode: "AUTO",
    archivedAt: null,
    sourceConfidence: "MANUAL",
    availableFrom: d("2026-09-20T08:00:00-04:00"),
    dueAt: d("2026-09-24T17:00:00-04:00"),
    preferredCompletionAt: d("2026-09-23T17:00:00-04:00"),
    originalEstimatedMinutes: 120,
    currentEstimatedMinutes: 150,
    remainingMinutes: 90,
    energyRequirement: "HIGH",
    locationRequirements: ["DESK"],
    minimumSessionMinutes: 20,
    preferredSessionMinutes: 45,
    maximumSessionMinutes: 90,
    splittable: true,
    interruptible: true,
    priorityOverride: 2,
  };
}
function state() {
  return {
    user: { id: actor, timezone: "America/Toronto" },
    academicTerms: [{ id: "term-1", userId: actor, status: "ACTIVE" }],
    courses: [
      {
        id: "course-1",
        userId: actor,
        academicTermId: "term-1",
        archivedAt: null,
        defaultTaskEnergy: null,
      },
    ],
    courseMeetings: [
      {
        id: "lecture",
        userId: actor,
        courseId: "course-1",
        meetingType: "LECTURE",
        attendanceRequired: true,
        archivedAt: null,
        ...recurrence("10:00", "11:00"),
        recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
      },
    ],
    assessments: [],
    tasks: [task()],
    taskDependencies: [],
    calendarEvents: [],
    availabilityRules: [
      {
        id: "available",
        userId: actor,
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
        userId: actor,
        active: true,
        isSleep: true,
        protectionLevel: "HARD",
        reason: "Sleep",
        ...recurrence("23:00", "07:00", true),
      },
      {
        id: "rest",
        userId: actor,
        active: true,
        isSleep: false,
        protectionLevel: "SOFT",
        reason: "Rest",
        ...recurrence("18:00", "19:00"),
      },
    ],
    planningPreferences: [
      {
        userId: actor,
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
function request(at = now) {
  return {
    operation: "AUTHORITATIVE_GENERATION",
    mode: "INCREMENTAL",
    trigger: { type: "MANUAL" },
    now: at,
    plannerVersion: "heuristic-v1",
    releasedTimePolicy: "REPLAN_IF_USEFUL",
  };
}
async function assemble(s = state(), r = request()) {
  const { selectPlannerHorizon, assemblePlannerInput } = await mapper;
  const horizon = selectPlannerHorizon(r.now, s.user.timezone, r.trigger.type, s);
  return assemblePlannerInput(s, actor, r, horizon);
}

test("canonical state maps task facts and unknown deadlines without invention", async () => {
  const result = await assemble();
  assert.equal(result.status, "READY");
  const input = result.input;
  assert.equal(input.tasks[0].remainingMinutes, 90);
  assert.equal(input.tasks[0].currentEstimatedMinutes, 150);
  assert.equal(input.tasks[0].priorityOverride, 2);
  assert.equal(input.tasks[0].preferredCompletionAt.toISOString(), "2026-09-23T21:00:00.000Z");
  assert.equal(input.minimumSleepMinutes, 420);
  assert.equal(input.preferences.minimumBreakMinutes, 10);
  const unknown = state();
  unknown.tasks[0].dueAt = null;
  const mapped = await assemble(unknown);
  assert.equal(mapped.status, "READY");
  assert.equal(mapped.input.tasks[0].dueAt, undefined);
  assert.equal(mapped.input.tasks[0].deadlineConfidence, "UNKNOWN");
});

test("isolation, inactive records, and dependency completion are explicit", async () => {
  const s = state();
  s.tasks.push({ ...task("done"), status: "COMPLETED", archivedAt: d("2026-09-20T00:00:00Z") });
  s.tasks.push({ ...task("archived"), archivedAt: d("2026-09-20T00:00:00Z") });
  s.tasks.push({ ...task("other"), userId: "another-user" });
  s.taskDependencies.push({ userId: actor, prerequisiteTaskId: "done", dependentTaskId: "task-1" });
  s.calendarEvents.push({
    id: "foreign",
    userId: "another-user",
    archivedAt: null,
    constraintLevel: "HARD",
    startAt: now,
    endAt: d("2026-09-21T13:00:00-04:00"),
  });
  const result = await assemble(s);
  assert.equal(result.status, "READY");
  assert.deepEqual(
    result.input.tasks.map((row) => row.id),
    ["task-1"],
  );
  assert.deepEqual(result.input.completedTaskIds, ["done"]);
  assert.deepEqual(result.input.dependencies, [
    { prerequisiteTaskId: "done", dependentTaskId: "task-1", type: "FINISH_TO_START" },
  ]);
  assert.deepEqual(result.input.events, []);
  assert.equal(
    (await assemble({ ...s, user: { id: "another-user", timezone: "America/Toronto" } })).status,
    "INPUT_FAILURE",
  );
});

test("manual, locked and previous generated sessions remain distinct", async () => {
  const s = state();
  const session = (id, generatedBy, locked) => ({
    id,
    userId: actor,
    taskId: "task-1",
    startAt: d("2026-09-22T14:00:00-04:00"),
    endAt: d("2026-09-22T14:30:00-04:00"),
    plannedMinutes: 30,
    state: "PLANNED",
    generatedBy,
    locked,
    supersededById: null,
  });
  s.workSessions = [
    session("manual", "USER", false),
    session("locked", "PLANNER", true),
    session("previous", "PLANNER", false),
    { ...session("old", "PLANNER", false), state: "SUPERSEDED" },
  ];
  const result = await assemble(s);
  assert.equal(result.status, "READY");
  assert.deepEqual(
    result.input.manualSessions.map((row) => row.id),
    ["manual"],
  );
  assert.deepEqual(
    result.input.lockedSessions.map((row) => row.id),
    ["locked"],
  );
  assert.deepEqual(
    result.input.previousSessions.map((row) => row.id),
    ["previous"],
  );
});

test("course, protected, availability and sleep recurrence cross Toronto DST", async () => {
  const s = state();
  const fall = d("2026-10-31T12:00:00-04:00");
  s.courseMeetings[0].recurrenceRule = "FREQ=DAILY";
  s.courseMeetings[0].effectiveFrom = "2026-10-30";
  s.availabilityRules[0].effectiveFrom = "2026-10-30";
  s.protectedTimeRules.forEach((row) => (row.effectiveFrom = "2026-10-30"));
  const result = await assemble(s, request(fall));
  assert.equal(result.status, "READY");
  const normalized = normalizePlannerInput(result.input);
  assert(normalized.input.events.some((row) => row.id === "lecture:2026-11-01"));
  assert(normalized.input.availability.some((row) => row.id === "available:2026-11-01"));
  assert(normalized.input.protectedWindows.some((row) => row.id === "rest:2026-11-01"));
  const sleep = normalized.input.sleepWindows.find((row) => row.id === "sleep:2026-10-31");
  assert.equal((sleep.endAt - sleep.startAt) / 60000, 540);
});

test("horizon uses explicit now and local midnight across DST", async () => {
  const { selectPlannerHorizon } = await mapper;
  const at = d("2026-10-31T12:00:00-04:00");
  const a = selectPlannerHorizon(at, "America/Toronto", "DAILY_REFRESH", state());
  const b = selectPlannerHorizon(at, "America/Toronto", "DAILY_REFRESH", state());
  assert.deepEqual(a, b);
  assert.equal(a.endAt.toISOString(), "2026-11-07T05:00:00.000Z");
  assert.equal(a.immediateEndAt.toISOString(), "2026-11-01T16:00:00.000Z");
});

test("missing canonical estimates, sleep policy, and dependencies fail explicitly", async () => {
  const missingEstimate = state();
  missingEstimate.tasks[0].currentEstimatedMinutes = null;
  missingEstimate.tasks[0].originalEstimatedMinutes = null;
  assert(
    (await assemble(missingEstimate)).issues.some((issue) => issue.code === "MISSING_ESTIMATE"),
  );
  const missingOriginal = state();
  missingOriginal.tasks[0].originalEstimatedMinutes = null;
  assert(
    (await assemble(missingOriginal)).issues.some((issue) => issue.code === "MISSING_ESTIMATE"),
  );
  const missingSleep = state();
  missingSleep.planningPreferences[0].minimumSleepMinutes = null;
  assert(
    (await assemble(missingSleep)).issues.some((issue) => issue.code === "MISSING_SLEEP_POLICY"),
  );
  const missingWindow = state();
  missingWindow.protectedTimeRules = [];
  assert(
    (await assemble(missingWindow)).issues.some((issue) => issue.code === "MISSING_SLEEP_WINDOW"),
  );
  const missingDependency = state();
  missingDependency.taskDependencies.push({
    userId: actor,
    prerequisiteTaskId: "unknown",
    dependentTaskId: "task-1",
  });
  assert(
    (await assemble(missingDependency)).issues.some((issue) => issue.code === "INVALID_DEPENDENCY"),
  );
});

test("assembled synthetic semester can enter heuristic-v1", async () => {
  const result = await assemble();
  assert.equal(result.status, "READY");
  const output = generatePlan(result.input);
  assert.equal(output.plannerVersion, "heuristic-v1");
  assert(output.sessions.some((row) => row.taskId === "task-1"));
});
