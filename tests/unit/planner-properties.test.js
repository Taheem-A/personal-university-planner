const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generatePlan,
  normalizePlannerInput,
  validatePlanDetailed,
  PLANNER_VERSION,
} = require("../../dist/packages/planner-core/src/index.js");
const {
  instant,
  task,
  availability,
  event,
  session,
  narrowInput,
} = require("../fixtures/planner/semester.js");

// A fixed-seed generator avoids a runtime dependency and makes every failure reproducible.
// Set PLANNER_PROPERTY_SEED to replay one case, or PLANNER_PROPERTY_CASES to extend the sweep.
const FIRST_SEED = 0x5eed2026;
const CASES = Number(process.env.PLANNER_PROPERTY_CASES ?? 1000);
const replay = process.env.PLANNER_PROPERTY_SEED;

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 2 ** 32;
  };
}

function choose(next, items) {
  return items[Math.floor(next() * items.length)];
}

function minute(day, minutes) {
  return instant(day, "00:00").getTime() + minutes * 60_000;
}

function at(day, minutes) {
  return new Date(minute(day, minutes));
}

function overlaps(a, b) {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

function fixture(seed) {
  const next = random(seed);
  const input = narrowInput();
  const day = "2026-09-21";
  input.horizonEnd = at(day, 22 * 60);
  input.events = next() < 0.7 ? [event("lecture", day, "10:00", "10:45")] : [];
  input.protectedWindows =
    next() < 0.7
      ? [
          {
            id: "leisure",
            startAt: at(day, 15 * 60),
            endAt: at(day, 16 * 60),
            level: choose(next, ["HARD", "SOFT"]),
            reason: "synthetic protection",
          },
        ]
      : [];
  input.sleepWindows = [{ id: "sleep", startAt: at(day, 20 * 60), endAt: at(day, 22 * 60) }];
  input.availability = [
    availability("campus", day, "09:00", "12:00", {
      capacityFactor: choose(next, [0.5, 0.75, 1]),
      energyLevel: choose(next, ["LOW", "MEDIUM", "HIGH"]),
      allowedLocationTags: ["ANYWHERE", "DESK", "HANDWRITING", "CAMPUS"],
    }),
    availability("home", day, "13:00", "19:00", {
      capacityFactor: choose(next, [0.5, 0.75, 1]),
      energyLevel: choose(next, ["LOW", "MEDIUM", "HIGH"]),
      allowedLocationTags: ["ANYWHERE", "DESK", "COMPUTER"],
    }),
  ];
  if (next() < 0.5)
    input.availability.push(
      availability("transit", day, "12:00", "13:00", {
        kind: "COMMUTE",
        capacityFactor: choose(next, [0.5, 1]),
        energyLevel: "LOW",
        allowedLocationTags: ["TRANSIT_OK"],
      }),
    );
  input.preferences = {
    ...input.preferences,
    scheduleCommuteWork: next() < 0.5,
    preferredDailyStudyLimitMinutes: choose(next, [60, 180, 360]),
    minimumFreeTimeMinutes: choose(next, [0, 30, 60]),
    minimumBreakMinutes: choose(next, [5, 10, 15]),
    maximumConsecutiveWorkMinutes: choose(next, [45, 90, 120]),
    weekendWorkBias: choose(next, [-0.5, 0, 0.5]),
    planStabilityWindowMinutes: choose(next, [0, 120]),
  };
  input.tasks = [];
  input.dependencies = [];
  const count = 1 + Math.floor(next() * 5);
  for (let i = 0; i < count; i += 1) {
    const remaining = choose(next, [0, 5, 15, 30, 45, 90, 180, 300]);
    const min = choose(next, [5, 15, 25]);
    const max = choose(next, [30, 45, 90]);
    const status = choose(next, [
      "READY",
      "READY",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
      "INBOX",
    ]);
    const mode = choose(next, ["AUTO", "AUTO", "AUTO", "MANUAL", "UNSCHEDULED"]);
    input.tasks.push(
      task(
        `task-${i}`,
        remaining,
        next() < 0.15 ? undefined : at(day, choose(next, [12, 15, 18, 20]) * 60),
        {
          status,
          planningMode: mode,
          availableFrom: at(day, choose(next, [8, 9, 11, 13, 16]) * 60),
          currentEstimatedMinutes: Math.max(5, remaining),
          originalEstimatedMinutes: Math.max(5, remaining),
          energyRequirement: choose(next, ["LOW", "MEDIUM", "HIGH"]),
          locationRequirements: choose(next, [
            ["ANYWHERE"],
            ["DESK"],
            ["HANDWRITING"],
            ["COMPUTER"],
            ["TRANSIT_OK"],
          ]),
          minimumSessionMinutes: min,
          preferredSessionMinutes: Math.max(min, choose(next, [30, 45, 60])),
          maximumSessionMinutes: Math.max(min, max),
          splittable: next() < 0.8,
          preferredCompletionAt: next() < 0.3 ? at(day, 14 * 60) : undefined,
        },
      ),
    );
    if (i > 0 && next() < 0.3)
      input.dependencies.push({
        prerequisiteTaskId: `task-${i - 1}`,
        dependentTaskId: `task-${i}`,
        type: "FINISH_TO_START",
      });
  }
  // Explicit retained intent uses a separate valid window; the other tasks remain varied.
  if (next() < 0.35) {
    input.tasks[0] = task("task-0", 60, at(day, 18 * 60), {
      locationRequirements: ["DESK"],
      availableFrom: at(day, 8 * 60),
      minimumSessionMinutes: 15,
      maximumSessionMinutes: 90,
    });
    const fixed = session("fixed-0", "task-0", day, "09:00", "09:30", 30, {
      locked: next() < 0.5,
    });
    if (fixed.locked) input.lockedSessions = [fixed];
    else input.manualSessions = [fixed];
  }
  if (next() < 0.4)
    input.previousSessions = [
      session("previous-0", "task-0", day, "13:00", "13:30", 30, {
        generatedBy: "PLANNER",
        locked: false,
      }),
    ];
  return input;
}

function assertInvariants(input, output, seed) {
  const context = `seed=${seed} (PLANNER_PROPERTY_SEED=${seed})`;
  assert.equal(output.plannerVersion, "heuristic-v1", context);
  assert.equal(PLANNER_VERSION, "heuristic-v1", context);
  assert.deepEqual(validatePlanDetailed(output.sessions, input), output.validationIssues, context);
  assert.equal(
    output.status,
    output.validationIssues.length || output.infeasibilities.length ? "INFEASIBLE" : "VALID",
    context,
  );
  const active = output.sessions.filter((item) => ["PLANNED", "ACTIVE"].includes(item.state));
  const generated = active.filter(
    (item) =>
      item.generatedBy === "PLANNER" && !input.previousSessions.some((old) => old.id === item.id),
  );
  for (let i = 0; i < active.length; i += 1) {
    const item = active[i];
    if (i > 0) assert.ok(active[i - 1].startAt <= item.startAt, context);
    if (i > 0)
      for (let j = 0; j < i; j += 1)
        if (
          output.status === "VALID" ||
          (item.generatedBy === "PLANNER" &&
            !input.previousSessions.some((old) => old.id === item.id)) ||
          (active[j].generatedBy === "PLANNER" &&
            !input.previousSessions.some((old) => old.id === active[j].id))
        )
          assert.equal(overlaps(active[j], item), false, `${context}: active overlap`);
  }
  for (const item of generated) {
    const source = input.tasks.find((candidate) => candidate.id === item.taskId);
    assert.ok(source, context);
    assert.ok(
      ["READY", "IN_PROGRESS"].includes(source.status) && source.planningMode === "AUTO",
      context,
    );
    assert.ok(
      item.startAt >= source.availableFrom && (!source.dueAt || item.endAt <= source.dueAt),
      context,
    );
    assert.ok(item.startAt >= input.now && item.endAt <= input.horizonEnd, context);
    assert.ok(item.endAt > item.startAt && item.plannedMinutes > 0, context);
    assert.ok(item.plannedMinutes <= (item.endAt - item.startAt) / 60_000, context);
    assert.equal(item.startAt.getTime() % 300_000, 0, context);
    assert.equal(item.endAt.getTime() % 300_000, 0, context);
    assert.ok((item.endAt - item.startAt) / 60_000 <= source.maximumSessionMinutes, context);
    for (const hard of [
      ...input.events.filter((e) => e.constraintLevel === "HARD"),
      ...input.protectedWindows.filter((w) => w.level === "HARD"),
      ...input.sleepWindows,
    ])
      assert.equal(overlaps(item, hard), false, `${context}: hard overlap`);
    const covering = input.availability.filter(
      (window) =>
        window.startAt <= item.startAt &&
        item.endAt <= window.endAt &&
        (window.kind !== "COMMUTE" ||
          (input.preferences.scheduleCommuteWork &&
            source.locationRequirements.includes("TRANSIT_OK"))) &&
        (source.locationRequirements.includes("ANYWHERE") ||
          source.locationRequirements.every((tag) => window.allowedLocationTags.includes(tag))),
    );
    assert.ok(covering.length > 0, `${context}: no compatible capacity for ${item.id}`);
    for (const edge of input.dependencies.filter((d) => d.dependentTaskId === item.taskId)) {
      const prerequisite = input.tasks.find(
        (candidate) => candidate.id === edge.prerequisiteTaskId,
      );
      if (prerequisite?.status === "COMPLETED") continue;
      const before = active
        .filter(
          (candidate) =>
            candidate.taskId === edge.prerequisiteTaskId && candidate.endAt <= item.startAt,
        )
        .reduce((sum, candidate) => sum + candidate.plannedMinutes, 0);
      assert.ok(before >= prerequisite.remainingMinutes, `${context}: dependency order`);
    }
    assert.ok(
      output.reasonsBySession[item.id]?.length > 0,
      `${context}: missing reasons ${JSON.stringify({ item, source, issues: output.validationIssues })}`,
    );
    assert.deepEqual(
      output.reasonsBySession[item.id],
      [...output.reasonsBySession[item.id]].sort(),
      context,
    );
  }
  for (const fixed of [...input.manualSessions, ...input.lockedSessions])
    assert.deepEqual(
      output.sessions.find((item) => item.id === fixed.id),
      fixed,
      `${context}: retained intent`,
    );
  for (const warning of output.warnings) {
    assert.ok(
      warning.reasonCodes?.length > 0,
      `${context}: warning ${warning.code} lacks a reason`,
    );
    if (warning.deficitMinutes !== undefined) assert.ok(warning.deficitMinutes >= 0, context);
  }
  for (const source of input.tasks) {
    const planned = active
      .filter((item) => item.taskId === source.id)
      .reduce((sum, item) => sum + item.plannedMinutes, 0);
    assert.ok(planned <= source.remainingMinutes, `${context}: overscheduled ${source.id}`);
    if (["READY", "IN_PROGRESS"].includes(source.status) && source.planningMode === "AUTO")
      assert.equal(
        planned + (output.unscheduledMinutesByTask[source.id] ?? 0),
        source.remainingMinutes,
        `${context}: workload accounting`,
      );
    if (!["READY", "IN_PROGRESS"].includes(source.status))
      assert.equal(
        generated.some((item) => item.taskId === source.id),
        false,
        `${context}: inactive task`,
      );
  }
  if (output.status === "VALID") {
    assert.deepEqual(output.validationIssues, [], context);
    assert.deepEqual(output.infeasibilities, [], context);
  } else {
    assert.ok(output.infeasibilities.length > 0 || output.validationIssues.length > 0, context);
    for (const deficit of output.infeasibilities) {
      assert.ok(deficit.requiredMinutes >= deficit.scheduledMinutes, context);
      assert.equal(deficit.unscheduledMinutes, deficit.deficitMinutes, context);
      assert.ok(deficit.suitableCapacityMinutes >= 0, context);
      assert.ok(
        deficit.limitingFactors.length > 0,
        `${context}: ${JSON.stringify({ deficit, issues: output.validationIssues })}`,
      );
    }
  }
}

test("seeded planner property sweep preserves hard invariants, input purity and accounting", () => {
  const seeds =
    replay === undefined
      ? Array.from({ length: CASES }, (_, i) => FIRST_SEED + i)
      : [Number(replay)];
  const coverage = new Set();
  for (const seed of seeds) {
    const input = fixture(seed);
    const before = structuredClone(input);
    const output = generatePlan(input);
    coverage.add(output.status);
    if (input.dependencies.length) coverage.add("DEPENDENCIES");
    if (input.lockedSessions.length) coverage.add("LOCKS");
    if (input.manualSessions.length) coverage.add("MANUAL");
    if (input.previousSessions.length) coverage.add("PREVIOUS");
    if (input.preferences.scheduleCommuteWork) coverage.add("COMMUTE_ENABLED");
    else coverage.add("COMMUTE_DISABLED");
    if (input.tasks.some((item) => !item.dueAt)) coverage.add("UNKNOWN_DEADLINE");
    if (input.protectedWindows.some((item) => item.level === "HARD"))
      coverage.add("HARD_PROTECTION");
    assert.deepEqual(input, before, `input mutated at seed=${seed}`);
    assertInvariants(input, output, seed);
  }
  if (replay === undefined)
    for (const family of [
      "VALID",
      "INFEASIBLE",
      "DEPENDENCIES",
      "LOCKS",
      "MANUAL",
      "PREVIOUS",
      "COMMUTE_ENABLED",
      "COMMUTE_DISABLED",
      "UNKNOWN_DEADLINE",
      "HARD_PROTECTION",
    ])
      assert.ok(coverage.has(family), `property generator missed ${family}`);
});

test("identical normalized input and version reproduce complete output", () => {
  for (let i = 0; i < 64; i += 1) {
    const input = fixture(FIRST_SEED + 10_000 + i);
    const normalized = normalizePlannerInput(input).input;
    const first = generatePlan(normalized);
    for (let repeat = 0; repeat < 5; repeat += 1)
      assert.deepEqual(
        generatePlan(normalized),
        first,
        `determinism seed=${FIRST_SEED + 10_000 + i}, repetition=${repeat}`,
      );
  }
});
