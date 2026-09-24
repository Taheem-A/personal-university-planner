const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generatePlan,
  simulateProtectedWindow,
  validatePlan,
  PLANNER_VERSION,
} = require("../../dist/packages/planner-core/src/index.js");

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

test("baseline rejects explicit constraints it cannot yet enforce", () => {
  const input = baseInput();
  input.sleepWindows = [{ id: "sleep", startAt: d("2026-09-21T04:00:00-04:00"), endAt: input.now }];
  assert.throws(() => generatePlan(input), /does not yet support sleep windows/);
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
