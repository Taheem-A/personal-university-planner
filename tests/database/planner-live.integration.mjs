import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { createDatabase } from "../../packages/database/dist/index.js";

const url = process.env.PLANNER_RACE_TEST_DATABASE_URL;
if (
  process.env.APP_ENV !== "test" ||
  process.env.CONFIRM_PLANNER_RACE_DATABASE !== "RUN_M4_PLANNER_RACES" ||
  !url
)
  throw new Error("A confirmed, disposable Milestone-4 planner database is required.");
const parsed = new URL(url);
if (
  !parsed.hostname.endsWith(".neon.tech") ||
  parsed.hostname.includes("-pooler") ||
  !/^up_m4_planner_races_[a-z0-9_]+$/.test(decodeURIComponent(parsed.pathname.slice(1)))
)
  throw new Error("Use a direct Neon up_m4_planner_races_* database only.");

const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const require = createRequire(import.meta.url);
const core = require("../../dist/packages/planner-core/src/index.js");
const shared = require("../../dist/packages/shared/src/index.js");
const appDir = path.resolve("apps/web/src/server/application");
function load(file, overrides = {}) {
  const filename = path.join(appDir, file);
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) =>
    overrides[name] ??
    (name === "@university-planner/shared"
      ? shared
      : name === "@university-planner/planner-core"
        ? core
        : webRequire(name));
  loaded._compile(
    ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return loaded.exports;
}
const input = load("planner-input.ts");
const execution = load("planner-execution.ts", { "./planner-input": input });
const database = createDatabase({ connectionString: url });
const prefix = `m4-${randomUUID()}`;
const userA = `${prefix}-a`;
const userB = `${prefix}-b`;
const now = new Date("2026-09-24T16:00:00.000Z");
const audit = { createdAt: now, updatedAt: now };
const provenance = { source: "MANUAL", sourceAuthority: "USER", sourceConfidence: "MANUAL" };
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
function user(id) {
  return {
    id,
    name: "Synthetic student",
    timezone: "America/Toronto",
    defaultDayStart: "08:00:00",
    defaultDayEnd: "22:00:00",
    locale: "en-CA",
    ...audit,
  };
}
function task(id, owner, courseId, minutes, dueAt) {
  return {
    id,
    userId: owner,
    courseId,
    assessmentId: null,
    recurringWorkRuleId: null,
    parentTaskId: null,
    title: `Synthetic ${id}`,
    description: null,
    status: "READY",
    priorityOverride: null,
    availableFrom: now,
    dueAt,
    preferredCompletionAt: null,
    originalEstimatedMinutes: minutes,
    currentEstimatedMinutes: minutes,
    remainingMinutes: minutes,
    energyRequirement: "MEDIUM",
    locationRequirements: ["DESK"],
    minimumSessionMinutes: 20,
    preferredSessionMinutes: 45,
    maximumSessionMinutes: 90,
    splittable: true,
    interruptible: true,
    planningMode: "AUTO",
    completedAt: null,
    archivedAt: null,
    ...provenance,
    ...audit,
  };
}
function session(id, owner, taskId, startAt, endAt, generatedBy, locked) {
  return {
    id,
    version: 0,
    userId: owner,
    taskId,
    plannerRunId: null,
    startAt,
    endAt,
    plannedMinutes: (endAt - startAt) / 60_000,
    state: "PLANNED",
    generatedBy,
    locked,
    supersededById: null,
    ...audit,
  };
}
async function seedUser(owner, taskMinutes) {
  const courseId = `${owner}-course`;
  await database.transaction(async ({ repositories: r }) => {
    await r.users.create(user(owner));
    await r.academicTerms.create({
      id: `${owner}-term`,
      userId: owner,
      name: "Synthetic Fall 2026",
      startDate: "2026-09-01",
      endDate: "2026-12-20",
      status: "ACTIVE",
      version: 0,
      ...audit,
    });
    await r.courses.create({
      id: courseId,
      userId: owner,
      academicTermId: `${owner}-term`,
      code: "SYN101",
      name: "Synthetic Engineering",
      section: null,
      instructorName: null,
      colorReference: null,
      creditValue: null,
      defaultTaskEnergy: "MEDIUM",
      defaultTaskLocation: ["DESK"],
      archivedAt: null,
      version: 0,
      ...provenance,
      ...audit,
    });
    await r.courseMeetings.create({
      id: `${owner}-meeting`,
      userId: owner,
      courseId,
      meetingType: "LECTURE",
      recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
      startTimeLocal: "10:00:00",
      endTimeLocal: "11:00:00",
      spansNextDay: false,
      timezone: "America/Toronto",
      location: null,
      effectiveFrom: "2026-09-01",
      effectiveUntil: "2026-12-20",
      attendanceRequired: true,
      version: 0,
      archivedAt: null,
      ...audit,
    });
    await r.tasks.create(
      task(`${owner}-task`, owner, courseId, taskMinutes, new Date("2026-09-28T21:00:00Z")),
    );
    if (owner === userA) {
      await r.tasks.create(
        task(`${owner}-other`, owner, courseId, 90, new Date("2026-09-30T21:00:00Z")),
      );
      await r.workSessions.create(
        session(
          `${owner}-manual`,
          owner,
          `${owner}-task`,
          new Date("2026-09-25T16:00:00Z"),
          new Date("2026-09-25T16:30:00Z"),
          "USER",
          false,
        ),
      );
      await r.workSessions.create(
        session(
          `${owner}-locked`,
          owner,
          `${owner}-task`,
          new Date("2026-09-25T19:00:00Z"),
          new Date("2026-09-25T19:30:00Z"),
          "PLANNER",
          true,
        ),
      );
    }
    await r.availabilityRules.create({
      id: `${owner}-availability`,
      userId: owner,
      recurrenceRule: "FREQ=DAILY",
      startTimeLocal: "08:00:00",
      endTimeLocal: "22:00:00",
      spansNextDay: false,
      timezone: "America/Toronto",
      effectiveFrom: "2026-09-01",
      effectiveUntil: "2026-12-20",
      capacityFactor: 1,
      energyLevel: "HIGH",
      allowedLocationTags: ["DESK"],
      active: true,
      version: 0,
      ...audit,
    });
    await r.protectedTimeRules.create({
      id: `${owner}-sleep`,
      userId: owner,
      recurrenceRule: "FREQ=DAILY",
      startTimeLocal: "23:00:00",
      endTimeLocal: "07:00:00",
      spansNextDay: true,
      timezone: "America/Toronto",
      effectiveFrom: "2026-09-01",
      effectiveUntil: "2026-12-20",
      protectionLevel: "HARD",
      reason: "Sleep",
      isSleep: true,
      active: true,
      version: 0,
      ...audit,
    });
    await r.planningPreferences.create({
      id: `${owner}-preference`,
      userId: owner,
      version: 0,
      preferredDailyStudyLimitMinutes: 300,
      minimumFreeTimeMinutes: 30,
      preferredDeadlineBufferHours: 6,
      avoidLateHighEnergyTasks: true,
      maximumConsecutiveWorkMinutes: 120,
      minimumBreakMinutes: 10,
      scheduleCommuteWork: false,
      weekendWorkBias: 0,
      planStabilityWindowMinutes: 120,
      minimumSleepMinutes: 420,
      ...audit,
    });
  });
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function active(owner) {
  return database.repositories.workSessions.listActiveGenerated(
    owner,
    now,
    new Date("2026-10-01T04:00:00Z"),
  );
}
async function view(owner, date = "2026-09-25") {
  return database.readSnapshot(async ({ repositories: r }) => {
    const [state, recent, successful] = await Promise.all([
      r.planningState.snapshot(
        owner,
        new Date("2026-09-24T04:00:00Z"),
        new Date("2026-10-02T04:00:00Z"),
      ),
      r.plannerRuns.listRecent(owner, 1),
      r.plannerRuns.latestSuccessful(owner),
    ]);
    return {
      today: reads.buildToday(state, recent[0] ?? null, successful, date, now),
      week: reads.buildWeek(state, recent[0] ?? null, successful, "2026-09-21"),
    };
  });
}
class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const reads = load("planner-reads.ts", {
  "../database": { applicationDatabase: () => database },
  "./authorization": { requireActor: async () => ({ userId: userA }) },
  "./errors": {
    ApplicationError: AppError,
    resultOf: async (fn) => {
      try {
        return { ok: true, value: await fn() };
      } catch (error) {
        return { ok: false, error: { code: error.code ?? "INTERNAL_ERROR" } };
      }
    },
  },
  "./validation": {
    calendarDateSchema: webRequire("zod").iso.date(),
    validateInput: (schema, value) => schema.parse(value),
  },
});

test("live authoritative planner acceptance on disposable PostgreSQL", async () => {
  await seedUser(userA, 150);
  await seedUser(userB, 5000);
  try {
    const first = await execution.executePlannerForActor(database, userA, request());
    assert.equal(first.status, "SUCCEEDED", JSON.stringify(first));
    assert.equal(first.plannerVersion, "heuristic-v1");
    const initial = await active(userA);
    assert.ok(initial.length > 0);
    assert.ok(initial.every((row) => row.plannerRunId === first.runId || row.locked));
    const firstRun = await database.repositories.plannerRuns.getForUser(userA, first.runId);
    assert.equal(firstRun.status, "SUCCEEDED");
    assert.equal(firstRun.triggerType, "MANUAL");
    assert.equal(firstRun.plannerVersion, "heuristic-v1");
    assert.equal(firstRun.inputSnapshot.schemaVersion, 1);
    assert.ok(firstRun.summary.sessionReasons);
    const firstViews = await view(userA);
    assert.ok(
      firstViews.today.timeline.some(
        (item) => item.kind === "WORK" && item.generatedBy === "PLANNER",
      ),
    );
    assert.ok(firstViews.week.schedule.some((item) => item.kind === "COURSE_MEETING"));
    assert.equal(firstViews.today.planner.authoritativeRun.id, first.runId);
    const serviceView = await reads.plannerViews.today({ date: "2026-09-25" });
    assert.equal(serviceView.ok, true);
    assert.equal(serviceView.value.planner.authoritativeRun.id, first.runId);

    const conflict = initial.find((row) => !row.locked);
    assert.ok(conflict);
    await database.repositories.calendarEvents.create({
      id: `${prefix}-conflict`,
      userId: userA,
      courseId: null,
      integrationAccountId: null,
      title: "Synthetic lab conflict",
      eventType: "LAB",
      startAt: conflict.startAt,
      endAt: conflict.endAt,
      location: null,
      constraintLevel: "HARD",
      externalId: null,
      externalUpdatedAt: null,
      archivedAt: null,
      version: 0,
      ...provenance,
      ...audit,
    });
    const second = await execution.executePlannerForActor(
      database,
      userA,
      request({
        type: "CALENDAR_CHANGED",
        entityType: "CALENDAR_EVENT",
        entityId: `${prefix}-conflict`,
      }),
    );
    assert.equal(second.status, "SUCCEEDED", JSON.stringify(second));
    assert.notEqual(second.runId, first.runId);
    assert.ok(second.delta.moved.length + second.delta.removed.length > 0);
    const obsolete = await database.repositories.workSessions.getForUser(userA, conflict.id);
    assert.equal(obsolete.state, "SUPERSEDED");
    assert.ok((await active(userA)).some((row) => initial.some((prior) => prior.id === row.id)));
    assert.ok(second.delta.retained.length > 0);
    assert.ok(
      second.delta.moved.some((row) => row.fromSessionId === conflict.id) ||
        second.delta.removed.includes(conflict.id),
    );
    const history = await database.repositories.plannerRuns.listRecent(userA, 5);
    assert.equal(history[0].id, second.runId);
    assert.equal(history[1].id, first.runId);
    assert.deepEqual(history[0].summary.delta, second.delta);
    assert.ok(await database.repositories.workSessions.getForUser(userA, `${userA}-manual`));
    assert.equal(
      (await database.repositories.workSessions.getForUser(userA, `${userA}-locked`)).state,
      "PLANNED",
    );
    assert.ok((await active(userA)).every((row) => row.state !== "SUPERSEDED"));

    const infeasible = await execution.executePlannerForActor(database, userB, request());
    assert.equal(infeasible.status, "SUCCEEDED", JSON.stringify(infeasible));
    assert.equal(infeasible.planStatus, "INFEASIBLE");
    assert.ok(infeasible.summary.unscheduledMinutes > 0);
    assert.ok((await view(userB)).today.risks.some((risk) => risk.deficitMinutes > 0));

    const beforeFailure = (await active(userA)).map((row) => row.id).sort();
    const failed = await execution.executePlannerForActor(database, userA, request(), {
      generate: () => {
        throw new Error("synthetic core failure");
      },
    });
    assert.equal(failed.code, "CORE_FAILURE");
    assert.equal(
      (await database.repositories.plannerRuns.getForUser(userA, failed.runId)).status,
      "FAILED",
    );
    assert.deepEqual((await active(userA)).map((row) => row.id).sort(), beforeFailure);
    assert.equal((await view(userA)).today.planner.authoritativeRun.id, second.runId);

    const keyed = request({
      type: "INTEGRATION_SYNC",
      idempotencyScope: "synthetic-provider",
      idempotencyKey: `${prefix}-event`,
    });
    const keyedFirst = await execution.executePlannerForActor(database, userA, keyed);
    assert.equal(keyedFirst.status, "SUCCEEDED");
    const count = (await active(userA)).length;
    const keyedAgain = await execution.executePlannerForActor(database, userA, keyed);
    assert.deepEqual(keyedAgain, {
      status: "DUPLICATE",
      runId: keyedFirst.runId,
      runStatus: "SUCCEEDED",
    });
    assert.equal((await active(userA)).length, count);

    const entered = deferred(),
      release = deferred();
    const race = execution.executePlannerForActor(database, userA, request(), {
      generate: async (plannerInput) => {
        entered.resolve();
        await release.promise;
        return core.generatePlan(plannerInput);
      },
    });
    await entered.promise;
    const otherUser = await execution.executePlannerForActor(database, userB, request());
    assert.equal(otherUser.status, "SUCCEEDED");
    const rival = await execution.executePlannerForActor(database, userA, request());
    assert.equal(rival.status, "SUCCEEDED");
    release.resolve();
    assert.equal((await race).code, "STALE_SNAPSHOT");

    const changed = deferred(),
      finish = deferred();
    const old = execution.executePlannerForActor(database, userA, request(), {
      generate: async (plannerInput) => {
        changed.resolve();
        await finish.promise;
        return core.generatePlan(plannerInput);
      },
    });
    await changed.promise;
    await database.repositories.tasks.update(userA, `${userA}-other`, {
      remainingMinutes: 120,
      currentEstimatedMinutes: 120,
    });
    finish.resolve();
    assert.equal((await old).code, "STALE_SNAPSHOT");
    const fresh = await execution.executePlannerForActor(database, userA, request());
    assert.equal(fresh.status, "SUCCEEDED");
    assert.equal(
      (
        await database.repositories.plannerRuns.getForUser(userA, fresh.runId)
      ).inputSnapshot.input.tasks.find((row) => row.id === `${userA}-other`).remainingMinutes,
      120,
    );
    assert.equal(await database.repositories.workSessions.getForUser(userB, conflict.id), null);
  } finally {
    await database.transaction(async ({ repositories: r }) => {
      await r.accountLifecycle.deleteAccount(userA);
      await r.accountLifecycle.deleteAccount(userB);
    });
    await database.disconnect();
  }
});
