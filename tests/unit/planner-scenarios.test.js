const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generatePlan,
  normalizePlannerInput,
  simulateProtectedWindow,
  validatePlan,
  PLANNER_VERSION,
} = require("../../dist/packages/planner-core/src/index.js");
const { instantToLocal } = require("../../dist/packages/shared/src/index.js");
const {
  instant,
  task,
  availability,
  event,
  session,
  weekInput,
  narrowInput,
} = require("../fixtures/planner/semester.js");

function workFor(output, taskId) {
  return output.sessions
    .filter((item) => item.taskId === taskId)
    .reduce((sum, item) => sum + item.plannedMinutes, 0);
}

function check(input, expectedStatus = "VALID") {
  const before = structuredClone(input);
  const output = generatePlan(input);
  assert.deepEqual(input, before, "planner must leave the caller's snapshot untouched");
  assert.deepEqual(generatePlan(input), output, "same version and input must reproduce exactly");
  assert.equal(output.plannerVersion, PLANNER_VERSION);
  assert.equal(output.status, expectedStatus);
  for (let index = 1; index < output.sessions.length; index += 1)
    assert.ok(output.sessions[index - 1].startAt <= output.sessions[index].startAt);
  for (const task of input.tasks) {
    if (!["READY", "IN_PROGRESS"].includes(task.status) || task.planningMode !== "AUTO") continue;
    assert.equal(
      workFor(output, task.id) + (output.unscheduledMinutesByTask[task.id] ?? 0),
      task.remainingMinutes,
      `work must be conserved for ${task.id}`,
    );
  }
  for (const session of output.sessions) {
    assert.ok(output.reasonsBySession[session.id], `missing reasons for ${session.id}`);
    if (session.generatedBy === "PLANNER" && !session.locked)
      assert.deepEqual(
        output.reasonsBySession[session.id],
        [...output.reasonsBySession[session.id]].sort(),
      );
  }
  for (const warning of output.warnings) {
    if (warning.taskId) assert.ok(input.tasks.some((task) => task.id === warning.taskId));
    if (warning.deficitMinutes !== undefined) assert.ok(warning.deficitMinutes >= 0);
  }
  if (expectedStatus === "VALID") {
    assert.deepEqual(output.validationIssues, []);
    assert.deepEqual(output.infeasibilities, []);
    assert.deepEqual(validatePlan(output.sessions, input), []);
  } else {
    assert.ok(output.infeasibilities.length > 0 || output.validationIssues.length > 0);
  }
  return output;
}

function postOutcome(input, before, chosen, actualMinutes) {
  const next = structuredClone(input);
  next.now = new Date(chosen.endAt);
  next.previousSessions = before.sessions.filter((item) => item.startAt >= next.now);
  next.tasks = next.tasks.map((item) => {
    const completedBefore = before.sessions
      .filter(
        (session) =>
          session.taskId === item.id && session.endAt <= next.now && session.id !== chosen.id,
      )
      .reduce((sum, session) => sum + session.plannedMinutes, 0);
    const remainingMinutes = Math.max(
      0,
      item.remainingMinutes - completedBefore - (item.id === chosen.taskId ? actualMinutes : 0),
    );
    return {
      ...item,
      remainingMinutes,
      status: remainingMinutes === 0 ? "COMPLETED" : item.status,
    };
  });
  return next;
}

test("canonical 01: normal engineering week fits with hard time and buffers", () => {
  const input = weekInput();
  const output = check(input);
  assert.deepEqual(output.unscheduledMinutesByTask, {});
  assert.ok(output.sessions.length >= 3);
  assert.ok(output.pressures.every((pressure) => pressure.slackMinutes > 0));
  assert.ok(!output.warnings.some((warning) => warning.code === "INFEASIBLE"));
  assert.ok(
    output.sessions.every((session) =>
      input.events.every(
        (fixed) => !(session.startAt < fixed.endAt && fixed.startAt < session.endAt),
      ),
    ),
  );
});

test("canonical 02: overloaded week exposes risk and never consumes sleep", () => {
  const input = weekInput();
  const normal = check(input);
  input.tasks[0] = {
    ...input.tasks[0],
    remainingMinutes: 5000,
    currentEstimatedMinutes: 5000,
  };
  const output = check(input, "INFEASIBLE");
  const risk = output.pressures.find((pressure) => pressure.taskId === input.tasks[0].id);
  assert.ok(risk.slackMinutes < 0);
  assert.ok(
    risk.pressureRatio >
      normal.pressures.find((item) => item.taskId === input.tasks[0].id).pressureRatio,
  );
  assert.ok(risk.capacityDeficitMinutes > 0);
  assert.ok(
    output.infeasibilities.some(
      (item) => item.taskId === input.tasks[0].id && item.deficitMinutes > 0,
    ),
  );
  assert.deepEqual(validatePlan(output.sessions, input), []);
  assert.ok(
    output.sessions.every((session) =>
      input.sleepWindows.every(
        (sleep) => !(session.startAt < sleep.endAt && sleep.startAt < session.endAt),
      ),
    ),
  );
});

test("canonical 03: skipped session restores unfinished work with stable future intent", () => {
  const input = weekInput();
  const before = check(input);
  const skipped = before.sessions[0];
  const next = postOutcome(input, before, skipped, 0);
  const output = check(next);
  assert.ok(output.sessions.some((item) => item.taskId === skipped.taskId));
  const unaffected = next.previousSessions.filter((item) => item.taskId !== skipped.taskId);
  assert.ok(unaffected.length > 0);
  assert.ok(
    unaffected.some((item) =>
      output.sessions.some(
        (kept) => kept.id === item.id && kept.startAt.getTime() === item.startAt.getTime(),
      ),
    ),
  );
});

test("canonical 04: partial completion conserves reduced work and retains useful sessions", () => {
  const input = weekInput();
  const before = check(input);
  const chosen = before.sessions[0];
  const actual = Math.max(1, Math.floor(chosen.plannedMinutes / 2));
  const next = postOutcome(input, before, chosen, actual);
  const output = check(next);
  assert.ok(next.tasks.find((item) => item.id === chosen.taskId).remainingMinutes > 0);
  assert.ok(output.sessions.some((item) => item.taskId === chosen.taskId));
  assert.ok(
    next.previousSessions.some((item) => output.sessions.some((kept) => kept.id === item.id)),
  );
});

test("canonical 05: early finish removes unnecessary future work and honors released time", () => {
  const input = narrowInput();
  const completed = { ...input.tasks[0], status: "COMPLETED", remainingMinutes: 0 };
  const urgent = task("APS110 urgent reading", 30, instant("2026-09-21", "09:30"), {
    availableFrom: instant("2026-09-21", "09:00"),
    locationRequirements: ["ANYWHERE"],
    energyRequirement: "LOW",
  });
  input.tasks = [completed, urgent];
  input.previousSessions = [
    session("old-civ-plan", completed.id, "2026-09-21", "09:00", "09:30", 30, {
      generatedBy: "PLANNER",
    }),
  ];
  input.releasedWindows = [
    {
      id: "finished-early",
      startAt: instant("2026-09-21", "09:00"),
      endAt: instant("2026-09-21", "09:30"),
    },
  ];
  input.releasedTimePolicy = "KEEP_FREE";
  const free = check(input, "INFEASIBLE");
  assert.equal(workFor(free, completed.id), 0);
  assert.equal(workFor(free, urgent.id), 0);
  input.releasedTimePolicy = "REPLAN_IF_USEFUL";
  assert.equal(workFor(check(input), urgent.id), 30);
  input.releasedTimePolicy = "ALWAYS_REPLAN";
  assert.equal(workFor(check(input), urgent.id), 30);
});

test("canonical 06: new urgent task gains pressure without reshuffling all prior work", () => {
  const input = weekInput();
  const before = check(input);
  input.previousSessions = before.sessions;
  const urgent = task("MAT188 urgent quiz", 30, instant("2026-09-21", "20:00"), {
    availableFrom: instant("2026-09-21", "17:00"),
    locationRequirements: ["HANDWRITING"],
  });
  input.tasks.push(urgent);
  const output = check(input);
  assert.equal(workFor(output, urgent.id), 30);
  assert.ok(
    output.pressures.find((item) => item.taskId === urgent.id).deadlineHoursRemaining <
      before.pressures.find((item) => item.taskId === "APS110 reading").deadlineHoursRemaining,
  );
  assert.ok(
    before.sessions.some((old) =>
      output.sessions.some(
        (current) => current.id === old.id && current.startAt.getTime() === old.startAt.getTime(),
      ),
    ),
  );
});

test("canonical 07: cancelled class releases capacity only under explicit policy", () => {
  const input = narrowInput();
  input.events = [event("cancelled CIV100 class", "2026-09-21", "09:00", "09:30")];
  const blocked = check(input, "INFEASIBLE");
  assert.equal(workFor(blocked, input.tasks[0].id), 0);
  input.events = [];
  input.releasedWindows = [
    {
      id: "class-released",
      startAt: instant("2026-09-21", "09:00"),
      endAt: instant("2026-09-21", "09:30"),
    },
  ];
  input.releasedTimePolicy = "KEEP_FREE";
  assert.equal(workFor(check(input, "INFEASIBLE"), input.tasks[0].id), 0);
  input.releasedTimePolicy = "REPLAN_IF_USEFUL";
  assert.equal(workFor(check(input), input.tasks[0].id), 30);
  input.releasedTimePolicy = "ALWAYS_REPLAN";
  assert.equal(workFor(check(input), input.tasks[0].id), 30);
});

test("canonical 08: deadline moves change pressure without rewriting the true due time", () => {
  const input = narrowInput(60);
  input.availability = [
    availability("Monday", "2026-09-21", "09:00", "10:00"),
    availability("Wednesday", "2026-09-23", "09:00", "10:00"),
  ];
  input.horizonEnd = instant("2026-09-24", "20:00");
  input.tasks[0].dueAt = instant("2026-09-24", "18:00");
  const later = check(input);
  input.tasks[0].dueAt = instant("2026-09-21", "10:00");
  const earlier = check(input);
  assert.ok(
    earlier.pressures[0].deadlineHoursRemaining < later.pressures[0].deadlineHoursRemaining,
  );
  assert.equal(earlier.pressures[0].actualDeadlineAt.getTime(), input.tasks[0].dueAt.getTime());
  assert.ok(earlier.sessions.every((item) => item.endAt <= input.tasks[0].dueAt));
  assert.ok(earlier.warnings.some((warning) => warning.code === "FREE_TIME_BUFFER_USED"));
});

test("canonical 09: hard lock stays exact while the planner adapts", () => {
  const input = weekInput();
  const fixed = session("user-locked-CIV", input.tasks[0].id, "2026-09-22", "18:00", "18:30", 30, {
    locked: true,
  });
  input.lockedSessions = [fixed];
  const output = check(input);
  assert.ok(
    output.sessions.some(
      (item) =>
        item.id === fixed.id &&
        item.startAt.getTime() === fixed.startAt.getTime() &&
        item.endAt.getTime() === fixed.endAt.getTime(),
    ),
  );
  assert.ok(output.sessions.some((item) => item.taskId === fixed.taskId && item.id !== fixed.id));
});

test("canonical 10: Saturday-off preview is pure, quantified and honest", () => {
  const input = weekInput();
  input.now = instant("2026-09-25", "08:00");
  input.horizonStart = input.now;
  input.horizonEnd = instant("2026-09-27", "22:00");
  input.minimumSleepMinutes = 480;
  input.events = [];
  input.availability = [
    availability("Friday", "2026-09-25", "15:00", "17:00"),
    availability("Saturday", "2026-09-26", "10:00", "12:00"),
    availability("Sunday", "2026-09-27", "10:00", "12:00"),
  ];
  input.tasks = [
    task("CIV100 weekend design", 120, instant("2026-09-27", "18:00"), {
      availableFrom: input.now,
    }),
  ];
  const original = structuredClone(input);
  const request = {
    title: "Saturday off",
    startAt: instant("2026-09-26", "00:00"),
    endAt: instant("2026-09-27", "00:00"),
    protectionLevel: "HARD",
  };
  const preview = simulateProtectedWindow(input, request);
  assert.deepEqual(input, original);
  assert.equal(preview.after.status, "VALID");
  assert.ok(preview.capacityDeltaMinutes < 0);
  assert.equal(preview.deficitDeltaMinutes, 0);
  assert.ok(
    preview.after.sessions.every(
      (item) => !(item.startAt < request.endAt && request.startAt < item.endAt),
    ),
  );
  const untouched = preview.before.sessions.filter(
    (item) => !(item.startAt < request.endAt && request.startAt < item.endAt),
  );
  assert.ok(
    untouched.every((item) =>
      preview.after.sessions.some(
        (next) => next.id === item.id && next.startAt.getTime() === item.startAt.getTime(),
      ),
    ),
  );
  assert.equal(preview.movedSessionIds.length, 1);
  const alternativeInput = {
    ...input,
    events: [
      ...input.events,
      {
        id: "scenario:Saturday off",
        userId: input.userId,
        title: request.title,
        startAt: request.startAt,
        endAt: request.endAt,
        constraintLevel: "HARD",
        source: "SCENARIO",
      },
    ],
    previousSessions: preview.before.sessions,
  };
  assert.deepEqual(validatePlan(preview.after.sessions, alternativeInput), []);
  input.availability = input.availability.filter((item) => item.id !== "Sunday");
  input.availability[0].endAt = instant("2026-09-25", "16:00");
  input.tasks[0].remainingMinutes = 90;
  input.tasks[0].currentEstimatedMinutes = 90;
  const impossible = simulateProtectedWindow(input, request);
  assert.equal(impossible.after.status, "INFEASIBLE");
  assert.equal(impossible.deadlineSafe, false);
  assert.ok(impossible.deficitDeltaMinutes > 0);
});

test("canonical 11: insufficient capacity reports exact required, suitable and missing work", () => {
  const input = narrowInput(60);
  const output = check(input, "INFEASIBLE");
  const evidence = output.infeasibilities[0];
  assert.equal(evidence.requiredMinutes, 60);
  assert.equal(evidence.suitableCapacityMinutes, 30);
  assert.equal(evidence.scheduledMinutes, 30);
  assert.equal(evidence.unscheduledMinutes, 30);
  assert.equal(evidence.deficitMinutes, 30);
});

test("canonical 12: commute is opt-in and task-specific", () => {
  const input = narrowInput();
  input.availability = [
    availability("train commute", "2026-09-21", "09:00", "09:30", {
      kind: "COMMUTE",
      allowedLocationTags: ["TRANSIT_OK"],
    }),
  ];
  input.tasks = [
    task("APS110 transit reading", 30, instant("2026-09-21", "09:30"), {
      locationRequirements: ["TRANSIT_OK"],
      energyRequirement: "LOW",
    }),
    task("MAT186 handwriting", 30, instant("2026-09-21", "09:30"), {
      locationRequirements: ["HANDWRITING"],
    }),
  ];
  const disabled = check(input, "INFEASIBLE");
  assert.equal(disabled.sessions.length, 0);
  input.preferences.scheduleCommuteWork = true;
  const enabled = check(input, "INFEASIBLE");
  assert.equal(workFor(enabled, "APS110 transit reading"), 30);
  assert.equal(workFor(enabled, "MAT186 handwriting"), 0);
  assert.ok(enabled.sessions.every((item) => item.taskId === "APS110 transit reading"));
});

test("canonical 13: Toronto DST recurrence keeps the intended local study time", () => {
  const input = narrowInput(30);
  input.now = instant("2026-10-25", "00:00");
  input.horizonStart = input.now;
  input.horizonEnd = instant("2026-11-02", "00:00", "-05:00");
  input.tasks[0].availableFrom = input.now;
  input.tasks[0].dueAt = instant("2026-11-01", "18:00", "-05:00");
  input.availability = [];
  input.recurringWindows = [
    {
      id: "Sunday home study",
      source: "AVAILABILITY",
      recurrenceRule: "FREQ=WEEKLY;BYDAY=SU",
      startTimeLocal: "09:00",
      endTimeLocal: "10:00",
      spansNextDay: false,
      timezone: "America/Toronto",
      effectiveFrom: "2026-10-25",
      effectiveUntil: "2026-11-01",
      capacityFactor: 1,
      energyLevel: "HIGH",
      allowedLocationTags: ["DESK"],
      availabilityKind: "ORDINARY",
    },
  ];
  const candidates = normalizePlannerInput(input).candidates;
  assert.deepEqual(
    candidates.map((item) => item.startAt.toISOString()),
    ["2026-10-25T13:00:00.000Z", "2026-11-01T14:00:00.000Z"],
  );
  const output = check(input);
  assert.ok(
    output.sessions.every((item) =>
      instantToLocal(item.startAt, "America/Toronto").time.startsWith("09:"),
    ),
  );
});
