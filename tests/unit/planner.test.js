const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generatePlan,
  simulateProtectedWindow,
  validatePlan,
  PLANNER_VERSION,
  normalizePlannerInput,
  calculatePressure,
  rankTasks,
} = require("../../dist/packages/planner-core/src/index.js");
const { windowUsableMinutes } = require("../../dist/packages/planner-core/src/windows.js");
const { minutesByLocalDay } = require("../../dist/packages/planner-core/src/sustainability.js");

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

function priorityInput() {
  const input = baseInput();
  input.horizonEnd = d("2026-09-21T18:00:00-04:00");
  input.events = [];
  input.availability = [
    {
      ...input.availability[0],
      endAt: input.horizonEnd,
      allowedLocationTags: ["ANYWHERE", "DESK", "TRANSIT_OK"],
    },
  ];
  input.preferences.preferredDeadlineBufferHours = 0;
  input.tasks = [];
  return input;
}

function priorityTask(id, work, due, changes = {}) {
  return {
    ...baseInput().tasks[0],
    id,
    title: id,
    dueAt: d(due),
    currentEstimatedMinutes: Math.max(1, work),
    originalEstimatedMinutes: Math.max(1, work),
    remainingMinutes: work,
    energyRequirement: "LOW",
    minimumSessionMinutes: 5,
    preferredSessionMinutes: 30,
    importance: undefined,
    ...changes,
  };
}

function pressureFor(input, id) {
  const state = normalizePlannerInput(input);
  return calculatePressure(
    state.input.tasks.find((task) => task.id === id),
    state.candidates,
    state.input,
  );
}

test("low slack and large workload outrank deceptively sooner small work", () => {
  const input = priorityInput();
  input.availability[0].endAt = d("2026-09-21T12:00:00-04:00");
  input.tasks = [
    priorityTask("tiny", 10, "2026-09-21T10:00:00-04:00"),
    priorityTask("large", 180, "2026-09-21T12:00:00-04:00"),
  ];
  const out = generatePlan(input);
  assert.equal(out.rankedTaskIds[0], "large");
  assert.ok(out.pressures[0].pressureRatio > 0.7);
  assert.ok(out.pressures[0].slackMinutes < out.pressures[1].slackMinutes);
});

test("deadline urgency rises nonlinearly and preferred targets do not replace deadlines", () => {
  const input = priorityInput();
  input.tasks = [priorityTask("essay", 120, "2026-09-21T14:00:00-04:00")];
  const sixHours = pressureFor(input, "essay").scoreComponents.deadlinePressure;
  input.tasks[0].dueAt = d("2026-09-21T11:00:00-04:00");
  const threeHours = pressureFor(input, "essay").scoreComponents.deadlinePressure;
  assert.ok(threeHours > 2 * sixHours);
  input.tasks[0].dueAt = d("2026-09-21T18:00:00-04:00");
  input.tasks[0].preferredCompletionAt = d("2026-09-21T09:00:00-04:00");
  const preferred = pressureFor(input, "essay");
  assert.equal(preferred.actualDeadlineAt.toISOString(), "2026-09-21T22:00:00.000Z");
  assert.ok(preferred.preferredSlackMinutes < 0);
  assert.ok(preferred.scoreComponents.preferredCompletionPressure > 0);
  input.tasks[0].preferredCompletionAt = undefined;
  input.preferences.preferredDeadlineBufferHours = 9;
  const buffered = pressureFor(input, "essay");
  assert.equal(buffered.preferredTargetSource, "BUFFER");
  assert.equal(buffered.actualDeadlineAt.toISOString(), preferred.actualDeadlineAt.toISOString());
});

test("late high-energy windows carry an explicit undesirable-time cost", () => {
  const input = priorityInput();
  input.now = d("2026-09-21T20:00:00-04:00");
  input.horizonStart = input.now;
  input.horizonEnd = d("2026-09-21T23:00:00-04:00");
  input.availability[0].startAt = d("2026-09-21T21:00:00-04:00");
  input.availability[0].endAt = input.horizonEnd;
  input.tasks = [
    priorityTask("late", 30, "2026-09-21T23:00:00-04:00", {
      energyRequirement: "HIGH",
    }),
  ];
  const late = pressureFor(input, "late");
  assert.ok(late.scoreComponents.undesirableTimeCost > 0);
  input.preferences.avoidLateHighEnergyTasks = false;
  assert.equal(pressureFor(input, "late").scoreComponents.undesirableTimeCost, 0);
});

test("importance influences ranking without overpowering feasibility", () => {
  const input = priorityInput();
  input.tasks = [
    priorityTask("low", 30, "2026-09-21T18:00:00-04:00", { importance: 0 }),
    priorityTask("high", 30, "2026-09-21T18:00:00-04:00", { importance: 1 }),
  ];
  assert.equal(generatePlan(input).rankedTaskIds[0], "high");
  input.tasks[0].remainingMinutes = 500;
  assert.equal(generatePlan(input).rankedTaskIds[0], "low");
  input.tasks[1].importance = undefined;
  assert.equal(pressureFor(input, "high").scoreComponents.importanceKnown, false);
});

test("prerequisites gain importance and dependent capacity starts after prerequisite work", () => {
  const input = priorityInput();
  input.tasks = [
    priorityTask("prerequisite", 60, "2026-09-21T18:00:00-04:00"),
    priorityTask("dependent", 60, "2026-09-21T18:00:00-04:00"),
  ];
  input.dependencies = [
    {
      prerequisiteTaskId: "prerequisite",
      dependentTaskId: "dependent",
      type: "FINISH_TO_START",
    },
  ];
  const ranked = rankTasks(normalizePlannerInput(input));
  const prerequisite = ranked.find((item) => item.taskId === "prerequisite");
  const dependent = ranked.find((item) => item.taskId === "dependent");
  assert.ok(prerequisite.scoreComponents.dependencyImportance > 0);
  assert.ok(dependent.dependencyReadyAt > input.now);
  assert.ok(dependent.suitableCapacityMinutes < prerequisite.suitableCapacityMinutes);
});

test("capacity respects factor, energy, capability, and commute policy", () => {
  const input = priorityInput();
  input.availability[0].capacityFactor = 0.5;
  input.availability[0].energyLevel = "LOW";
  input.tasks = [priorityTask("desk", 30, "2026-09-21T18:00:00-04:00")];
  const lowEnergy = pressureFor(input, "desk");
  input.tasks[0].energyRequirement = "HIGH";
  assert.ok(pressureFor(input, "desk").suitableCapacityMinutes < lowEnergy.suitableCapacityMinutes);
  input.availability[0].allowedLocationTags = ["TRANSIT_OK"];
  assert.equal(pressureFor(input, "desk").suitableCapacityMinutes, 0);
  input.tasks[0].locationRequirements = ["TRANSIT_OK"];
  input.availability[0].kind = "COMMUTE";
  assert.equal(pressureFor(input, "desk").suitableCapacityMinutes, 0);
  input.preferences.scheduleCommuteWork = true;
  assert.ok(pressureFor(input, "desk").suitableCapacityMinutes > 0);
});

test("zero, tiny, and large workloads retain explicit finite pressure diagnostics", () => {
  const input = priorityInput();
  input.availability = [];
  input.tasks = [priorityTask("edge", 30, "2026-09-21T18:00:00-04:00")];
  const empty = pressureFor(input, "edge");
  assert.equal(empty.pressureRatio, null);
  assert.equal(empty.feasibility, "INFEASIBLE");
  assert.ok(Number.isFinite(empty.score));
  input.tasks[0].remainingMinutes = 0;
  assert.equal(pressureFor(input, "edge").pressureRatio, 0);
  input.availability = priorityInput().availability;
  input.tasks[0].remainingMinutes = 1;
  assert.ok(Number.isFinite(pressureFor(input, "edge").pressureRatio));
  input.tasks[0].remainingMinutes = 1_000_000_000;
  assert.ok(Number.isFinite(pressureFor(input, "edge").score));
});

test("priority inputs reject non-finite values before ranking", () => {
  const input = priorityInput();
  input.tasks = [priorityTask("bad", 30, "2026-09-21T18:00:00-04:00")];
  input.tasks[0].priorityOverride = Number.NaN;
  assert.throws(() => normalizePlannerInput(input), /priority override/);
  input.tasks[0].priorityOverride = 0;
  input.preferences.preferredDeadlineBufferHours = Number.POSITIVE_INFINITY;
  assert.throws(() => normalizePlannerInput(input), /preferredDeadlineBufferHours/);
});

test("exact ties and repeated plans use stable task IDs", () => {
  const input = priorityInput();
  input.tasks = [
    priorityTask("z", 30, "2026-09-21T18:00:00-04:00"),
    priorityTask("a", 30, "2026-09-21T18:00:00-04:00"),
  ];
  const first = generatePlan(input);
  assert.deepEqual(first.rankedTaskIds, ["a", "z"]);
  assert.deepEqual(generatePlan(input), first);
  input.tasks.reverse();
  assert.deepEqual(generatePlan(input).rankedTaskIds, ["a", "z"]);
});

test("splittable work is balanced into useful preferred-sized sessions", () => {
  const input = priorityInput();
  input.tasks = [priorityTask("essay", 170, "2026-09-21T18:00:00-04:00")];
  input.tasks[0].minimumSessionMinutes = 20;
  input.tasks[0].preferredSessionMinutes = 50;
  input.tasks[0].maximumSessionMinutes = 90;
  const out = generatePlan(input);
  const work = out.sessions.filter((session) => session.taskId === "essay");
  assert.equal(work.length, 3);
  assert.equal(
    work.reduce((total, session) => total + session.plannedMinutes, 0),
    170,
  );
  assert.ok(work.every((session) => session.plannedMinutes >= 50 && session.plannedMinutes <= 60));
  assert.equal(out.unscheduledMinutesByTask.essay, undefined);
});

test("non-splittable work fits one session or remains explicitly unscheduled", () => {
  const input = priorityInput();
  input.tasks = [
    priorityTask("exam", 100, "2026-09-21T18:00:00-04:00", {
      splittable: false,
      maximumSessionMinutes: 90,
    }),
  ];
  const impossible = generatePlan(input);
  assert.equal(impossible.sessions.length, 0);
  assert.equal(impossible.unscheduledMinutesByTask.exam, 100);
  input.tasks[0].remainingMinutes = 75;
  const feasible = generatePlan(input);
  assert.equal(feasible.sessions.length, 1);
  assert.equal(feasible.sessions[0].plannedMinutes, 75);
});

test("small final work and tiny complete tasks conserve exact remaining minutes", () => {
  const input = priorityInput();
  input.tasks = [
    priorityTask("odd", 67, "2026-09-21T18:00:00-04:00", {
      minimumSessionMinutes: 20,
    }),
  ];
  let out = generatePlan(input);
  assert.equal(
    out.sessions.reduce((sum, session) => sum + session.plannedMinutes, 0),
    67,
  );
  assert.ok(out.sessions.every((session) => session.plannedMinutes >= 20));
  input.tasks[0].remainingMinutes = 7;
  out = generatePlan(input);
  assert.equal(out.sessions.length, 1);
  assert.equal(out.sessions[0].plannedMinutes, 7);
});

test("minimum breaks and maximum consecutive work hold across different tasks", () => {
  const input = priorityInput();
  input.preferences.maximumConsecutiveWorkMinutes = 60;
  input.preferences.minimumBreakMinutes = 10;
  input.tasks = [
    priorityTask("one", 120, "2026-09-21T18:00:00-04:00"),
    priorityTask("two", 60, "2026-09-21T18:00:00-04:00"),
  ];
  const out = generatePlan(input);
  const sorted = [...out.sessions].sort((a, b) => a.startAt - b.startAt);
  assert.equal(
    sorted.reduce((sum, session) => sum + session.plannedMinutes, 0),
    180,
  );
  for (let index = 0; index < sorted.length; index += 1) {
    assert.ok((sorted[index].endAt - sorted[index].startAt) / 60_000 <= 60);
    if (index > 0) assert.ok((sorted[index].startAt - sorted[index - 1].endAt) / 60_000 >= 10);
  }
});

test("daily ceiling and free-time buffer are kept when another day can carry work", () => {
  const input = priorityInput();
  input.horizonEnd = d("2026-09-22T18:00:00-04:00");
  input.availability.push({
    ...input.availability[0],
    id: "next-day",
    startAt: d("2026-09-22T08:00:00-04:00"),
    endAt: input.horizonEnd,
  });
  input.preferences.preferredDailyStudyLimitMinutes = 90;
  input.preferences.minimumFreeTimeMinutes = 60;
  input.tasks = [priorityTask("spread", 170, "2026-09-22T18:00:00-04:00")];
  const out = generatePlan(input);
  assert.equal(
    out.sessions.reduce((sum, session) => sum + session.plannedMinutes, 0),
    170,
  );
  assert.ok(out.sessions.some((session) => session.startAt.toISOString().startsWith("2026-09-22")));
  assert.ok(!out.warnings.some((warning) => warning.code === "DAILY_STUDY_LIMIT_EXCEEDED"));
  assert.ok(!out.warnings.some((warning) => warning.code === "FREE_TIME_BUFFER_USED"));
});

test("required work may consume soft daily and free-time limits with quantified warnings", () => {
  const input = priorityInput();
  input.availability[0].endAt = d("2026-09-21T12:00:00-04:00");
  input.preferences.preferredDailyStudyLimitMinutes = 90;
  input.preferences.minimumFreeTimeMinutes = 60;
  input.tasks = [priorityTask("urgent", 190, "2026-09-21T12:00:00-04:00")];
  const out = generatePlan(input);
  assert.equal(
    out.sessions.reduce((sum, session) => sum + session.plannedMinutes, 0),
    190,
  );
  assert.ok(
    out.warnings.some(
      (warning) => warning.code === "DAILY_STUDY_LIMIT_EXCEEDED" && warning.deficitMinutes > 0,
    ),
  );
  assert.ok(
    out.warnings.some(
      (warning) => warning.code === "FREE_TIME_BUFFER_USED" && warning.deficitMinutes > 0,
    ),
  );
});

test("free-time reserve remains when a manageable workload fits", () => {
  const input = priorityInput();
  input.availability[0].endAt = d("2026-09-21T12:00:00-04:00");
  input.preferences.preferredDailyStudyLimitMinutes = 1_000;
  input.preferences.minimumFreeTimeMinutes = 60;
  input.tasks = [priorityTask("manageable", 150, "2026-09-21T12:00:00-04:00")];
  const out = generatePlan(input);
  const study = out.sessions.reduce(
    (sum, session) => sum + (session.endAt - session.startAt) / 60_000,
    0,
  );
  assert.equal(
    out.sessions.reduce((sum, session) => sum + session.plannedMinutes, 0),
    150,
  );
  assert.ok(240 - study >= 60);
  assert.ok(!out.warnings.some((warning) => warning.code === "FREE_TIME_BUFFER_USED"));
});

test("generated work leaves a meaningful break after a retained session", () => {
  const input = priorityInput();
  input.tasks = [priorityTask("study", 90, "2026-09-21T18:00:00-04:00")];
  input.manualSessions = [
    {
      id: "retained",
      userId: input.userId,
      taskId: "study",
      startAt: d("2026-09-21T08:00:00-04:00"),
      endAt: d("2026-09-21T08:30:00-04:00"),
      plannedMinutes: 30,
      state: "PLANNED",
      generatedBy: "USER",
      locked: false,
    },
  ];
  const out = generatePlan(input);
  const generated = out.sessions.filter((session) => session.generatedBy === "PLANNER");
  assert.ok(generated.every((session) => session.startAt >= d("2026-09-21T08:40:00-04:00")));
  assert.equal(
    generated.reduce((sum, session) => sum + session.plannedMinutes, 0),
    60,
  );
});

test("usable-work factor prevents over-allocation and sessions stay on five-minute boundaries", () => {
  const input = priorityInput();
  input.now = d("2026-09-21T08:02:00-04:00");
  input.availability[0].capacityFactor = 0.5;
  input.tasks = [priorityTask("slow", 60, "2026-09-21T18:00:00-04:00")];
  const out = generatePlan(input);
  assert.equal(
    out.sessions.reduce((sum, session) => sum + session.plannedMinutes, 0),
    60,
  );
  assert.ok(
    out.sessions.every(
      (session) => session.plannedMinutes <= (session.endAt - session.startAt) / 120_000,
    ),
  );
  assert.ok(
    out.sessions.every(
      (session) =>
        session.startAt.getTime() % 300_000 === 0 && session.endAt.getTime() % 300_000 === 0,
    ),
  );
});

test("a later better-fit window can beat the first free gap", () => {
  const input = priorityInput();
  input.availability = [
    {
      ...input.availability[0],
      id: "low",
      endAt: d("2026-09-21T09:00:00-04:00"),
      energyLevel: "LOW",
    },
    {
      ...input.availability[0],
      id: "high",
      startAt: d("2026-09-21T10:00:00-04:00"),
      endAt: d("2026-09-21T11:00:00-04:00"),
      energyLevel: "HIGH",
    },
  ];
  input.tasks = [
    priorityTask("focus", 30, "2026-09-21T12:00:00-04:00", { energyRequirement: "HIGH" }),
  ];
  const out = generatePlan(input);
  assert.equal(out.sessions[0].startAt.toISOString(), "2026-09-21T14:00:00.000Z");
});

test("task grouping avoids repeated context switches when a coherent plan fits", () => {
  const input = priorityInput();
  input.tasks = [
    priorityTask("civ", 170, "2026-09-21T18:00:00-04:00"),
    priorityTask("mat", 30, "2026-09-21T18:00:00-04:00"),
  ];
  const out = generatePlan(input);
  const ids = out.sessions.map((session) => session.taskId);
  const switches = ids.slice(1).filter((id, index) => id !== ids[index]).length;
  assert.ok(switches <= 1);
  assert.equal(
    out.sessions.reduce((sum, session) => sum + session.plannedMinutes, 0),
    200,
  );
});

test("infeasible work conserves scheduled plus explicit unscheduled minutes", () => {
  const input = priorityInput();
  input.availability[0].endAt = d("2026-09-21T08:40:00-04:00");
  input.tasks = [priorityTask("too-large", 100, "2026-09-21T18:00:00-04:00")];
  const out = generatePlan(input);
  const scheduled = out.sessions.reduce((sum, session) => sum + session.plannedMinutes, 0);
  assert.equal(scheduled + out.unscheduledMinutesByTask["too-large"], 100);
  assert.ok(scheduled < 100);
});

test("maximum consecutive work still reserves a gap with zero configured break", () => {
  const input = priorityInput();
  input.preferences.minimumBreakMinutes = 0;
  input.preferences.maximumConsecutiveWorkMinutes = 50;
  input.tasks = [priorityTask("long", 100, "2026-09-21T18:00:00-04:00")];
  const out = generatePlan(input);
  assert.equal(
    out.sessions.reduce((sum, session) => sum + session.plannedMinutes, 0),
    100,
  );
  assert.ok(out.sessions.every((session) => (session.endAt - session.startAt) / 60_000 <= 50));
  for (let index = 1; index < out.sessions.length; index += 1)
    assert.ok((out.sessions[index].startAt - out.sessions[index - 1].endAt) / 60_000 >= 5);
});

test("preferred completion buffer use is visible without changing the hard deadline", () => {
  const input = priorityInput();
  input.availability[0].startAt = d("2026-09-21T14:00:00-04:00");
  input.preferences.preferredDeadlineBufferHours = 6;
  input.tasks = [priorityTask("buffered", 60, "2026-09-21T18:00:00-04:00")];
  const out = generatePlan(input);
  assert.equal(
    out.sessions.reduce((sum, session) => sum + session.plannedMinutes, 0),
    60,
  );
  assert.ok(out.warnings.some((warning) => warning.code === "DEADLINE_BUFFER_USED"));
  assert.ok(out.sessions.every((session) => session.endAt <= input.tasks[0].dueAt));
});

test("daily accounting follows the explicit timezone through a DST change", () => {
  const minutes = minutesByLocalDay(
    d("2026-11-01T00:30:00-04:00"),
    d("2026-11-01T02:30:00-05:00"),
    "America/Toronto",
  );
  assert.deepEqual([...minutes], [["2026-11-01", 180]]);
  const acrossMidnight = minutesByLocalDay(
    d("2026-09-21T23:30:00-04:00"),
    d("2026-09-22T00:30:00-04:00"),
    "America/Toronto",
  );
  assert.deepEqual(
    [...acrossMidnight],
    [
      ["2026-09-21", 30],
      ["2026-09-22", 30],
    ],
  );
});

test("an elapsed planning horizon has no available session capacity", () => {
  const input = priorityInput();
  input.now = d("2026-09-22T08:00:00-04:00");
  input.tasks = [priorityTask("late", 30, "2026-09-22T18:00:00-04:00")];
  assert.deepEqual(generatePlan(input).sessions, []);
});
