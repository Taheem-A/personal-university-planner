const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generatePlan,
  simulateProtectedWindow,
  validatePlan,
  PLANNER_VERSION,
  normalizePlannerInput,
} = require("../../dist/packages/planner-core/src/index.js");
const { windowUsableMinutes } = require("../../dist/packages/planner-core/src/windows.js");

function d(value) {
  return new Date(value);
}

function baseInput() {
  return {
    userId: "user-1",
    timezone: "America/Toronto",
    now: d("2026-09-21T08:00:00-04:00"),
    horizonStart: d("2026-09-21T08:00:00-04:00"),
    horizonEnd: d("2026-09-24T22:00:00-04:00"),
    tasks: [
      {
        id: "civ",
        userId: "user-1",
        title: "CIV100 Assignment 2",
        status: "READY",
        availableFrom: d("2026-09-21T08:00:00-04:00"),
        dueAt: d("2026-09-23T23:59:00-04:00"),
        currentEstimatedMinutes: 120,
        originalEstimatedMinutes: 120,
        remainingMinutes: 120,
        energyRequirement: "HIGH",
        locationRequirements: ["DESK"],
        minimumSessionMinutes: 20,
        preferredSessionMinutes: 50,
        maximumSessionMinutes: 90,
        splittable: true,
        interruptible: true,
        planningMode: "AUTO",
        importance: 0.5,
        deadlineConfidence: "FIXED",
      },
      {
        id: "aps",
        userId: "user-1",
        title: "APS110 Reading",
        status: "READY",
        availableFrom: d("2026-09-21T08:00:00-04:00"),
        dueAt: d("2026-09-22T18:00:00-04:00"),
        currentEstimatedMinutes: 30,
        originalEstimatedMinutes: 30,
        remainingMinutes: 30,
        energyRequirement: "LOW",
        locationRequirements: ["ANYWHERE"],
        minimumSessionMinutes: 20,
        preferredSessionMinutes: 30,
        maximumSessionMinutes: 60,
        splittable: true,
        interruptible: true,
        planningMode: "AUTO",
        importance: 0.5,
        deadlineConfidence: "FIXED",
      },
    ],
    completedTaskIds: [],
    events: [
      {
        id: "class",
        userId: "user-1",
        title: "MAT186 Lecture",
        startAt: d("2026-09-21T10:00:00-04:00"),
        endAt: d("2026-09-21T11:00:00-04:00"),
        constraintLevel: "HARD",
      },
    ],
    availability: [
      {
        id: "monday",
        userId: "user-1",
        startAt: d("2026-09-21T08:00:00-04:00"),
        endAt: d("2026-09-21T18:00:00-04:00"),
        capacityFactor: 1,
        energyLevel: "HIGH",
        allowedLocationTags: ["ANYWHERE", "DESK", "COMPUTER", "HANDWRITING", "CAMPUS"],
      },
      {
        id: "tuesday",
        userId: "user-1",
        startAt: d("2026-09-22T09:00:00-04:00"),
        endAt: d("2026-09-22T18:00:00-04:00"),
        capacityFactor: 1,
        energyLevel: "MEDIUM",
        allowedLocationTags: ["ANYWHERE", "DESK", "COMPUTER", "HANDWRITING", "HOME"],
      },
    ],
    lockedSessions: [],
    manualSessions: [],
    previousSessions: [],
    dependencies: [],
    protectedWindows: [],
    sleepWindows: [],
    recurringWindows: [],
    replanMode: "INCREMENTAL",
    releasedTimePolicy: "REPLAN_IF_USEFUL",
    minimumSleepMinutes: 0,
    preferences: {
      preferredDailyStudyLimitMinutes: 240,
      minimumFreeTimeMinutes: 60,
      preferredDeadlineBufferHours: 24,
      avoidLateHighEnergyTasks: true,
      maximumConsecutiveWorkMinutes: 90,
      minimumBreakMinutes: 10,
      scheduleCommuteWork: false,
      weekendWorkBias: 0,
      planStabilityWindowMinutes: 120,
    },
  };
}

test("planner never overlaps hard events", () => {
  const input = baseInput();
  const out = generatePlan(input);
  assert.equal(validatePlan(out.sessions, input).length, 0);
  for (const session of out.sessions) {
    assert.ok(
      !(session.startAt < input.events[0].endAt && input.events[0].startAt < session.endAt),
    );
  }
});

test("planner output carries its named heuristic version", () => {
  const output = generatePlan(baseInput());
  assert.equal(PLANNER_VERSION, "heuristic-v1");
  assert.equal(output.plannerVersion, PLANNER_VERSION);
  assert.deepEqual(output.reasonsBySession, {});
});

test("hard events, protected time, and sleep merge into one occupied interval", () => {
  const input = baseInput();
  input.events = [
    {
      ...input.events[0],
      startAt: d("2026-09-21T09:00:00-04:00"),
      endAt: d("2026-09-21T10:00:00-04:00"),
    },
  ];
  input.protectedWindows = [
    {
      id: "hard",
      startAt: d("2026-09-21T09:30:00-04:00"),
      endAt: d("2026-09-21T10:30:00-04:00"),
      level: "HARD",
      reason: "Rest",
    },
    {
      id: "soft",
      startAt: d("2026-09-21T11:00:00-04:00"),
      endAt: d("2026-09-21T11:30:00-04:00"),
      level: "SOFT",
      reason: "Preferred leisure",
    },
  ];
  input.sleepWindows = [
    { id: "sleep", startAt: d("2026-09-21T10:00:00-04:00"), endAt: d("2026-09-21T11:00:00-04:00") },
  ];
  input.availability = [{ ...input.availability[0], endAt: d("2026-09-21T12:00:00-04:00") }];
  const state = normalizePlannerInput(input);
  assert.equal(state.occupied.length, 1);
  assert.equal(
    state.occupied[0].startAt.toISOString(),
    d("2026-09-21T09:00:00-04:00").toISOString(),
  );
  assert.equal(state.occupied[0].endAt.toISOString(), d("2026-09-21T11:00:00-04:00").toISOString());
  assert.deepEqual(
    state.candidates.map((window) => [window.startAt.toISOString(), window.endAt.toISOString()]),
    [
      [d("2026-09-21T08:00:00-04:00").toISOString(), d("2026-09-21T09:00:00-04:00").toISOString()],
      [d("2026-09-21T11:00:00-04:00").toISOString(), d("2026-09-21T12:00:00-04:00").toISOString()],
    ],
  );
  assert.equal(validatePlan(generatePlan(input).sessions, input).length, 0);
});

test("minimum sleep requires supplied qualifying blocks on complete local days", () => {
  const input = baseInput();
  input.now = d("2026-09-21T00:00:00-04:00");
  input.horizonStart = input.now;
  input.horizonEnd = d("2026-09-23T00:00:00-04:00");
  input.minimumSleepMinutes = 420;
  assert.throws(() => normalizePlannerInput(input), /minimum-sleep window/);
  input.sleepWindows = [
    {
      id: "monday",
      startAt: d("2026-09-21T23:00:00-04:00"),
      endAt: d("2026-09-22T06:00:00-04:00"),
    },
    {
      id: "tuesday",
      startAt: d("2026-09-22T23:00:00-04:00"),
      endAt: d("2026-09-23T06:00:00-04:00"),
    },
  ];
  assert.ok(normalizePlannerInput(input).occupied.length >= 1);
});

test("eligibility excludes inactive, inbox, manual, unscheduled, and future work", () => {
  const input = baseInput();
  const task = input.tasks[0];
  input.tasks = [
    task,
    ...[
      ["complete", "COMPLETED", "AUTO"],
      ["cancelled", "CANCELLED", "AUTO"],
      ["inbox", "INBOX", "AUTO"],
      ["deferred", "DEFERRED", "AUTO"],
      ["manual", "READY", "MANUAL"],
      ["unscheduled", "READY", "UNSCHEDULED"],
    ].map(([id, status, planningMode]) => ({ ...task, id, status, planningMode })),
    { ...task, id: "future", availableFrom: d("2026-09-25T00:00:00-04:00") },
  ];
  const state = normalizePlannerInput(input);
  assert.deepEqual([...state.eligibility.eligibleTaskIds], [task.id]);
  assert.deepEqual(
    generatePlan(input)
      .sessions.map((session) => session.taskId)
      .filter((id) => id !== task.id),
    [],
  );
});

test("task availability and explicit effective estimate are enforced", () => {
  const input = baseInput();
  input.tasks = [
    {
      ...input.tasks[0],
      availableFrom: d("2026-09-21T11:03:00-04:00"),
      remainingMinutes: 20,
      currentEstimatedMinutes: 20,
    },
  ];
  input.events = [];
  const output = generatePlan(input);
  assert.ok(output.sessions.every((session) => session.startAt >= d("2026-09-21T11:05:00-04:00")));
  input.tasks[0] = { ...input.tasks[0], currentEstimatedMinutes: Number.NaN };
  assert.throws(() => normalizePlannerInput(input), /explicit valid estimates/);
});

test("dependencies wait for fully allocated prerequisites and block impossible chains", () => {
  const input = baseInput();
  input.events = [];
  input.tasks = [
    {
      ...input.tasks[0],
      id: "first",
      remainingMinutes: 30,
      currentEstimatedMinutes: 30,
      minimumSessionMinutes: 30,
      preferredSessionMinutes: 30,
      maximumSessionMinutes: 30,
    },
    {
      ...input.tasks[1],
      id: "second",
      remainingMinutes: 30,
      currentEstimatedMinutes: 30,
      minimumSessionMinutes: 30,
      preferredSessionMinutes: 30,
      maximumSessionMinutes: 30,
      dueAt: d("2026-09-21T12:00:00-04:00"),
    },
  ];
  input.dependencies = [
    { prerequisiteTaskId: "first", dependentTaskId: "second", type: "FINISH_TO_START" },
  ];
  const output = generatePlan(input);
  const firstEnd = Math.max(
    ...output.sessions
      .filter((session) => session.taskId === "first")
      .map((session) => session.endAt.getTime()),
  );
  assert.ok(
    output.sessions
      .filter((session) => session.taskId === "second")
      .every((session) => session.startAt.getTime() >= firstEnd),
  );
  input.tasks[0] = { ...input.tasks[0], planningMode: "MANUAL" };
  const blocked = generatePlan(input);
  assert.equal(blocked.unscheduledMinutesByTask.second, 30);
  assert.ok(blocked.warnings.some((warning) => warning.code === "DEPENDENCY_BLOCKED"));
});

test("completed prerequisite IDs need no fabricated estimate snapshot", () => {
  const input = baseInput();
  input.tasks = [{ ...input.tasks[1], id: "dependent", remainingMinutes: 30 }];
  input.completedTaskIds = ["previously-done"];
  input.dependencies = [
    {
      prerequisiteTaskId: "previously-done",
      dependentTaskId: "dependent",
      type: "FINISH_TO_START",
    },
  ];
  assert.ok(generatePlan(input).sessions.some((session) => session.taskId === "dependent"));
  assert.equal(
    normalizePlannerInput(input).input.tasks[0].dueAt.toISOString(),
    input.tasks[0].dueAt.toISOString(),
  );
  delete input.tasks[0].dueAt;
  assert.equal(normalizePlannerInput(input).input.tasks[0].dueAt, undefined);
});

test("manual and locked sessions occupy capacity and remain preserved", () => {
  const input = baseInput();
  input.events = [];
  const manual = {
    id: "manual",
    userId: input.userId,
    taskId: "civ",
    startAt: d("2026-09-21T08:00:00-04:00"),
    endAt: d("2026-09-21T09:00:00-04:00"),
    plannedMinutes: 60,
    state: "PLANNED",
    generatedBy: "USER",
    locked: false,
  };
  const locked = {
    ...manual,
    id: "locked",
    startAt: d("2026-09-21T09:00:00-04:00"),
    endAt: d("2026-09-21T10:00:00-04:00"),
    locked: true,
  };
  input.manualSessions = [manual];
  input.lockedSessions = [locked];
  const state = normalizePlannerInput(input);
  assert.equal(state.occupied[0].endAt.toISOString(), locked.endAt.toISOString());
  assert.equal(state.unallocatedMinutesByTask.get("civ"), 0);
  const output = generatePlan(input);
  assert.ok(output.sessions.some((session) => session.id === manual.id));
  assert.ok(output.sessions.some((session) => session.id === locked.id));
  assert.equal(output.sessions.filter((session) => session.taskId === "civ").length, 2);
  assert.ok(
    output.sessions
      .filter((session) => session.generatedBy === "PLANNER")
      .every((session) => session.startAt >= locked.endAt),
  );
});

test("future retained work reduces only unallocated work and unblocks dependencies at its end", () => {
  const input = baseInput();
  input.events = [];
  input.tasks = [
    { ...input.tasks[0], id: "prereq", remainingMinutes: 60, currentEstimatedMinutes: 60 },
    { ...input.tasks[1], id: "dependent", remainingMinutes: 30, currentEstimatedMinutes: 30 },
  ];
  input.dependencies = [
    { prerequisiteTaskId: "prereq", dependentTaskId: "dependent", type: "FINISH_TO_START" },
  ];
  input.lockedSessions = [
    {
      id: "reserved",
      userId: input.userId,
      taskId: "prereq",
      startAt: d("2026-09-21T08:00:00-04:00"),
      endAt: d("2026-09-21T09:00:00-04:00"),
      plannedMinutes: 60,
      state: "PLANNED",
      generatedBy: "USER",
      locked: true,
    },
  ];
  const output = generatePlan(input);
  assert.equal(output.sessions.filter((session) => session.taskId === "prereq").length, 1);
  assert.ok(
    output.sessions
      .filter((session) => session.taskId === "dependent")
      .every((session) => session.startAt >= input.lockedSessions[0].endAt),
  );
});

test("candidate boundaries round inward to the five-minute quantum", () => {
  const input = baseInput();
  input.events = [];
  input.availability = [
    {
      ...input.availability[0],
      startAt: d("2026-09-21T08:02:00-04:00"),
      endAt: d("2026-09-21T09:09:00-04:00"),
    },
  ];
  const candidate = normalizePlannerInput(input).candidates[0];
  assert.equal(candidate.startAt.toISOString(), d("2026-09-21T08:05:00-04:00").toISOString());
  assert.equal(candidate.endAt.toISOString(), d("2026-09-21T09:05:00-04:00").toISOString());
  assert.equal(candidate.clockMinutes, 60);
});

test("overlapping availability preserves alternatives without double-counting time", () => {
  const input = baseInput();
  input.events = [];
  input.availability = [
    {
      ...input.availability[0],
      endAt: d("2026-09-21T10:00:00-04:00"),
      allowedLocationTags: ["DESK"],
    },
    {
      ...input.availability[0],
      id: "campus",
      endAt: d("2026-09-21T10:00:00-04:00"),
      allowedLocationTags: ["CAMPUS"],
    },
    {
      ...input.availability[0],
      id: "duplicate",
      endAt: d("2026-09-21T10:00:00-04:00"),
      allowedLocationTags: ["DESK"],
    },
  ];
  const state = normalizePlannerInput(input);
  assert.equal(state.candidates.length, 1);
  assert.equal(state.candidates[0].clockMinutes, 120);
  assert.equal(state.candidates[0].alternatives.length, 2);
  assert.deepEqual(
    state.candidates[0].alternatives.map((option) => option.allowedLocationTags[0]).sort(),
    ["CAMPUS", "DESK"],
  );
});

test("commute capacity requires both user policy and task transit capability", () => {
  const input = baseInput();
  input.events = [];
  input.availability = [
    { ...input.availability[0], kind: "COMMUTE", allowedLocationTags: ["TRANSIT_OK"] },
  ];
  const candidate = normalizePlannerInput(input).candidates[0];
  assert.equal(candidate.kind, "COMMUTE");
  assert.equal(candidate.remainingUsableMinutes, 0);
  const transitTask = { ...input.tasks[0], locationRequirements: ["TRANSIT_OK"] };
  assert.equal(windowUsableMinutes(transitTask, candidate, input), 0);
  input.preferences.scheduleCommuteWork = true;
  assert.ok(normalizePlannerInput(input).candidates[0].remainingUsableMinutes > 0);
  assert.ok(windowUsableMinutes(transitTask, candidate, input) > 0);
  assert.equal(
    windowUsableMinutes({ ...transitTask, locationRequirements: ["ANYWHERE"] }, candidate, input),
    0,
  );
});

test("recurrence retains Toronto wall time across DST and normalization is pure", () => {
  const input = baseInput();
  input.now = d("2026-10-25T00:00:00-04:00");
  input.horizonStart = input.now;
  input.horizonEnd = d("2026-11-09T00:00:00-05:00");
  input.events = [];
  input.availability = [];
  input.recurringWindows = [
    {
      id: "sunday",
      source: "EVENT",
      title: "Class",
      constraintLevel: "HARD",
      recurrenceRule: "FREQ=WEEKLY;BYDAY=SU",
      startTimeLocal: "09:00",
      endTimeLocal: "10:00",
      spansNextDay: false,
      timezone: "America/Toronto",
      effectiveFrom: "2026-10-25",
      effectiveUntil: "2026-11-08",
    },
  ];
  const original = input.recurringWindows[0];
  const a = normalizePlannerInput(input);
  const b = normalizePlannerInput(input);
  assert.deepEqual(a, b);
  assert.equal(input.recurringWindows[0], original);
  assert.deepEqual(
    a.input.events.map((event) => event.startAt.toISOString()),
    ["2026-10-25T13:00:00.000Z", "2026-11-01T14:00:00.000Z", "2026-11-08T14:00:00.000Z"],
  );
  assert.deepEqual(normalizePlannerInput(a.input).input.events, a.input.events);
  assert.equal(a.input.tasks[0].dueAt.toISOString(), input.tasks[0].dueAt.toISOString());
});

test("planner schedules all feasible work", () => {
  const out = generatePlan(baseInput());
  assert.deepEqual(out.unscheduledMinutesByTask, {});
  const totals = out.sessions.reduce((map, session) => {
    map[session.taskId] = (map[session.taskId] || 0) + session.plannedMinutes;
    return map;
  }, {});
  assert.equal(totals.civ, 120);
  assert.equal(totals.aps, 30);
});

test("protected-window scenario never mutates canonical input and returns a preview", () => {
  const input = baseInput();
  const originalEvents = input.events.length;
  const scenario = simulateProtectedWindow(input, {
    title: "Take Monday afternoon off",
    startAt: d("2026-09-21T13:00:00-04:00"),
    endAt: d("2026-09-21T18:00:00-04:00"),
    protectionLevel: "HARD",
  });
  assert.equal(input.events.length, originalEvents);
  assert.ok(Array.isArray(scenario.movedTaskIds));
  assert.ok(scenario.after.sessions.length > 0);
});

test("infeasible workload is surfaced explicitly", () => {
  const input = baseInput();
  input.tasks[0] = { ...input.tasks[0], remainingMinutes: 1500, currentEstimatedMinutes: 1500 };
  const out = generatePlan(input);
  assert.ok(
    out.warnings.some(
      (warning) => warning.code === "INFEASIBLE" || warning.code === "NO_SUITABLE_WINDOW",
    ),
  );
  assert.ok(out.unscheduledMinutesByTask.civ > 0);
});

test("late-work policy uses the user's explicit timezone, not the host timezone", () => {
  const input = baseInput();
  input.tasks = [
    {
      ...input.tasks[0],
      availableFrom: d("2026-09-22T00:00:00.000Z"),
      dueAt: d("2026-09-22T12:00:00.000Z"),
      remainingMinutes: 30,
      currentEstimatedMinutes: 30,
      originalEstimatedMinutes: 30,
      minimumSessionMinutes: 30,
      preferredSessionMinutes: 30,
      maximumSessionMinutes: 30,
    },
  ];
  input.events = [];
  input.availability = [
    {
      id: "toronto-daytime",
      userId: "user-1",
      startAt: d("2026-09-22T00:00:00.000Z"),
      endAt: d("2026-09-22T00:30:00.000Z"),
      capacityFactor: 1,
      energyLevel: "HIGH",
      allowedLocationTags: ["DESK"],
    },
    {
      id: "toronto-late",
      userId: "user-1",
      startAt: d("2026-09-22T01:00:00.000Z"),
      endAt: d("2026-09-22T01:30:00.000Z"),
      capacityFactor: 1,
      energyLevel: "HIGH",
      allowedLocationTags: ["DESK"],
    },
  ];
  input.now = d("2026-09-22T00:00:00.000Z");
  input.horizonStart = input.now;
  input.horizonEnd = d("2026-09-22T12:00:00.000Z");

  const out = generatePlan(input);
  assert.equal(out.sessions[0].startAt.toISOString(), "2026-09-22T00:00:00.000Z");
});
