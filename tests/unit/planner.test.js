const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generatePlan,
  simulateProtectedWindow,
  validatePlan,
} = require("../../dist/packages/planner-core/src/index.js");

function d(value) {
  return new Date(value);
}

function baseInput() {
  return {
    userId: "user-1",
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
