import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const shared = {};
vm.runInNewContext(
  ts.transpileModule(readFileSync("packages/shared/src/time.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports: shared, Date, Intl, Map, Set, Number, Error, RangeError },
);
function load(file, stubs) {
  const source = readFileSync(`apps/web/src/server/application/${file}.ts`, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: (name) =>
      name === "@university-planner/shared" ? shared : (stubs[name] ?? webRequire(name)),
    Date,
    Map,
    Set,
    Intl,
    Number,
    Error,
  });
  return exports;
}

const errors = load("errors", {
  "@university-planner/database": { getDatabaseErrorDetails: () => null },
  "../monitoring": { reportInternalFailure: async () => {} },
});
const validation = load("validation", { "./errors": errors });
const dependencies = load("dependencies", { "./errors": errors });
const user = { userId: "owner" };
const other = { userId: "other" };
const rows = {
  terms: [],
  courses: [],
  meetings: [],
  assessments: [],
  tasks: [],
  edges: [],
  events: [],
  availability: [],
  protection: [],
  preferences: [],
  inbox: [],
  sessions: [],
  completions: [],
  runs: [],
  integrations: [],
  maps: [],
};
const owned = (collection, userId, id) =>
  rows[collection].find((r) => r.userId === userId && r.id === id) ?? null;
const repo = {
  academicTerms: {
    create: async (r) => {
      rows.terms.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("terms", u, id),
    listForUser: async (u) => rows.terms.filter((r) => r.userId === u),
    updateIfCurrent: async (u, id, version, patch) => conditional("terms", u, id, version, patch),
  },
  courses: {
    create: async (r) => {
      rows.courses.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("courses", u, id),
    listForTerm: async (u, t) =>
      rows.courses.filter((r) => r.userId === u && r.academicTermId === t),
    updateIfCurrent: async (u, id, version, patch) => conditional("courses", u, id, version, patch),
  },
  courseMeetings: {
    create: async (r) => {
      rows.meetings.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("meetings", u, id),
    listForCourse: async (u, c) => rows.meetings.filter((r) => r.userId === u && r.courseId === c),
    updateIfCurrent: async (u, id, version, patch) =>
      conditional("meetings", u, id, version, patch),
  },
  assessments: {
    create: async (r) => {
      rows.assessments.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("assessments", u, id),
    listForCourse: async (u, c) =>
      rows.assessments.filter((r) => r.userId === u && r.courseId === c),
    updateIfCurrent: async (u, id, version, patch) =>
      conditional("assessments", u, id, version, patch),
  },
  tasks: {
    create: async (r) => {
      rows.tasks.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("tasks", u, id),
    listForUser: async (u) => rows.tasks.filter((r) => r.userId === u),
    listSubtasks: async (u, parent) =>
      rows.tasks.filter((r) => r.userId === u && r.parentTaskId === parent),
    updateIfCurrent: async (u, id, version, patch) => conditional("tasks", u, id, version, patch),
  },
  taskDependencies: {
    listForUser: async (u) => rows.edges.filter((r) => r.userId === u),
    listForTask: async (u, id) =>
      rows.edges.filter(
        (r) => r.userId === u && (r.prerequisiteTaskId === id || r.dependentTaskId === id),
      ),
    add: async (r) => {
      rows.edges.push(r);
      return r;
    },
    remove: async (u, prerequisite, dependent) => {
      rows.edges.splice(
        rows.edges.findIndex(
          (r) =>
            r.userId === u &&
            r.prerequisiteTaskId === prerequisite &&
            r.dependentTaskId === dependent,
        ),
        1,
      );
    },
  },
  calendarEvents: {
    create: async (r) => {
      rows.events.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("events", u, id),
    listForRange: async (u, s, e) =>
      rows.events.filter((r) => r.userId === u && r.startAt < e && r.endAt > s),
    updateIfCurrent: async (u, id, version, patch) => conditional("events", u, id, version, patch),
  },
  availabilityRules: {
    create: async (r) => {
      rows.availability.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("availability", u, id),
    listActive: async (u) => rows.availability.filter((r) => r.userId === u && r.active),
    updateIfCurrent: async (u, id, version, patch) =>
      conditional("availability", u, id, version, patch),
  },
  protectedTimeRules: {
    create: async (r) => {
      rows.protection.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("protection", u, id),
    listActive: async (u) => rows.protection.filter((r) => r.userId === u && r.active),
    updateIfCurrent: async (u, id, version, patch) =>
      conditional("protection", u, id, version, patch),
  },
  planningPreferences: {
    create: async (r) => {
      rows.preferences.push(r);
      return r;
    },
    getForUser: async (u) => rows.preferences.find((r) => r.userId === u) ?? null,
    updateIfCurrent: async (u, version, patch) =>
      conditional(
        "preferences",
        u,
        rows.preferences.find((r) => r.userId === u)?.id,
        version,
        patch,
      ),
  },
  inboxItems: {
    create: async (r) => {
      rows.inbox.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("inbox", u, id),
    listByStatus: async (u, status) =>
      rows.inbox.filter((r) => r.userId === u && r.status === status),
    updateIfCurrent: async (u, id, version, patch) => conditional("inbox", u, id, version, patch),
  },
  workSessions: {
    create: async (r) => {
      rows.sessions.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("sessions", u, id),
    listForRange: async (u, s, e) =>
      rows.sessions.filter((r) => r.userId === u && r.startAt < e && r.endAt > s),
    updateIfCurrent: async (u, id, version, patch) =>
      conditional("sessions", u, id, version, patch),
  },
  completionRecords: {
    create: async (r) => {
      rows.completions.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("completions", u, id),
    listForTask: async (u, id) => rows.completions.filter((r) => r.userId === u && r.taskId === id),
  },
  plannerRuns: {
    getForUser: async (u, id) => owned("runs", u, id),
    listRecent: async (u, limit) => rows.runs.filter((r) => r.userId === u).slice(0, limit),
  },
  integrationAccounts: {
    create: async (r) => {
      rows.integrations.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("integrations", u, id),
    listForUser: async (u) => rows.integrations.filter((r) => r.userId === u),
    updateIfCurrent: async (u, id, version, patch) =>
      conditional("integrations", u, id, version, patch),
    disconnect: async (u, id, version) =>
      conditional("integrations", u, id, version, {
        status: "DISCONNECTED",
        credentialReference: null,
        disconnectedAt: new Date(),
      }),
  },
  externalObjectMaps: {
    getForExternalIdentity: async (u, provider, id) =>
      rows.maps.find((r) => r.userId === u && r.provider === provider && r.externalId === id) ??
      null,
    listForInternalObject: async (u, type, id) =>
      rows.maps.filter((r) => r.userId === u && r.internalType === type && r.internalId === id),
  },
  accountLifecycle: {
    snapshot: async (u) => ({
      user: { id: u, timezone: "America/Toronto" },
      ...Object.fromEntries(
        Object.entries(rows).map(([key, records]) => [
          key,
          records.filter((record) => record.userId === u),
        ]),
      ),
      integrationAccounts: rows.integrations.filter((r) => r.userId === u),
      plannerRuns: rows.runs.filter((r) => r.userId === u),
      tasks: rows.tasks.filter((r) => r.userId === u),
    }),
    deleteAccount: async (u) => {
      for (const records of Object.values(rows)) {
        const retained = records.filter((r) => r.userId !== u);
        records.splice(0, records.length, ...retained);
      }
      if (forceDeleteFailure) throw new Error("Forced transaction failure");
      return true;
    },
  },
};
let forceDeleteFailure = false;
function conditional(collection, userId, id, version, patch) {
  const row = owned(collection, userId, id);
  if (!row) return { status: "NOT_FOUND" };
  if (row.version !== version) return { status: "STALE" };
  Object.assign(row, patch);
  row.version++;
  return { status: "UPDATED", record: row };
}
const tx = { repositories: repo, locks: { userGraph: async () => {} } };
const auth = load("authorization", {
  "./errors": errors,
  "../auth": { authenticatedActor: async () => user },
});
const serviceUtils = load("service", {
  "./authorization": auth,
  "./errors": errors,
  "./validation": validation,
  "../database": { applicationDatabase: () => ({ transaction: (fn) => fn(tx) }) },
  "node:crypto": { randomUUID: () => `record-${Math.random()}` },
});
const plannerTriggerStub = {
  planAfterMutation: (mutation) => mutation,
  classifyTaskMutation: () => null,
  classifyCalendarMutation: () => null,
  classifyPlanningFields: () => null,
};
const academic = load("academic", {
  "./authorization": auth,
  "./dependencies": dependencies,
  "./errors": errors,
  "./service": serviceUtils,
  "./planner-triggers": plannerTriggerStub,
  "./validation": validation,
});
const schedule = load("schedule", {
  "./authorization": auth,
  "./errors": errors,
  "./service": serviceUtils,
  "./planner-triggers": plannerTriggerStub,
  "./validation": validation,
});
const inbox = load("inbox", {
  "./errors": errors,
  "./service": serviceUtils,
  "./validation": validation,
});
const transactionalService = load("service", {
  "./authorization": auth,
  "./errors": errors,
  "./validation": validation,
  "../database": {
    applicationDatabase: () => ({
      transaction: async (fn) => {
        const before = Object.fromEntries(
          Object.entries(rows).map(([key, values]) => [key, [...values]]),
        );
        try {
          return await fn(tx);
        } catch (error) {
          for (const [key, values] of Object.entries(before))
            rows[key].splice(0, rows[key].length, ...values);
          throw error;
        }
      },
    }),
  },
  "node:crypto": { randomUUID: () => `record-${Math.random()}` },
});
const lifecycle = load("lifecycle", {
  "./planner-reads": { planHistoryItem: (run) => run },
  "./authorization": auth,
  "./errors": errors,
  "./service": transactionalService,
  "./planner-triggers": plannerTriggerStub,
  "./validation": validation,
});

const replanRequests = [];
let nextPlan = { ok: true, value: { status: "SUCCEEDED", planStatus: "FEASIBLE" } };
const realTriggers = load("planner-triggers", {
  "../database": { applicationDatabase: () => ({}) },
  "./authorization": auth,
  "./errors": errors,
  "./planner": {
    generateAuthoritativePlan: async (request) => {
      replanRequests.push(request);
      return nextPlan;
    },
  },
});
const plannedAcademic = load("academic", {
  "./authorization": auth,
  "./dependencies": dependencies,
  "./errors": errors,
  "./service": serviceUtils,
  "./planner-triggers": realTriggers,
  "./validation": validation,
});
const plannedSchedule = load("schedule", {
  "./authorization": auth,
  "./errors": errors,
  "./service": serviceUtils,
  "./planner-triggers": realTriggers,
  "./validation": validation,
});
const manual = load("manual-management", {
  "./academic": plannedAcademic,
  "./schedule": plannedSchedule,
});

test("manual life constraints preserve recurrence, ownership, sleep and planner intent", async () => {
  const start = replanRequests.length;
  const base = {
    recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,WE",
    startTimeLocal: "09:00",
    endTimeLocal: "12:00",
    spansNextDay: false,
    timezone: "America/Toronto",
    effectiveFrom: "2026-03-01",
    effectiveUntil: null,
  };
  assert.equal(
    (
      await plannedSchedule.availabilityRules.create({
        ...base,
        recurrenceRule: "BOGUS",
        capacityFactor: 1,
        energyLevel: "HIGH",
      })
    ).error.code,
    "VALIDATION_ERROR",
  );
  const created = await plannedSchedule.availabilityRules.create({
    ...base,
    capacityFactor: 1,
    energyLevel: "HIGH",
    allowedLocationTags: ["DESK"],
  });
  assert.equal(created.ok, true);
  const availability = created.value;
  assert.equal(replanRequests.length, start + 1);
  const occurrences = shared.expandRecurringWindows(availability, "2026-03-02", "2026-03-09");
  assert.equal(occurrences[0].startAt.toISOString(), "2026-03-02T14:00:00.000Z");
  assert.equal(occurrences.at(-1).startAt.toISOString(), "2026-03-09T13:00:00.000Z");
  const adjusted = await plannedSchedule.availabilityRules.update({
    id: availability.id,
    expectedVersion: 0,
    capacityFactor: 0.5,
  });
  assert.equal(adjusted.ok, true);
  assert.equal(adjusted.value.spansNextDay, false);
  assert.equal(adjusted.value.effectiveUntil, null);
  assert.equal(adjusted.value.capacityFactor, 0.5);
  assert.equal(
    (
      await plannedSchedule.availabilityRules.update({
        id: availability.id,
        expectedVersion: 0,
        capacityFactor: 0.7,
      })
    ).error.code,
    "STALE_WRITE",
  );
  assert.equal(
    (
      await plannedSchedule.availabilityRules.update({
        id: availability.id,
        expectedVersion: 1,
        endTimeLocal: "08:00",
      })
    ).error.code,
    "VALIDATION_ERROR",
  );
  assert.equal(owned("availability", user.userId, availability.id).endTimeLocal, "12:00");
  assert.equal(
    (
      await plannedSchedule.availabilityRules.update({
        id: "other-person-rule",
        expectedVersion: 0,
        capacityFactor: 1,
      })
    ).error.code,
    "NOT_FOUND",
  );
  assert.equal(
    (
      await plannedSchedule.availabilityRules.deactivate({
        id: availability.id,
        expectedVersion: 1,
      })
    ).value.active,
    false,
  );
  const overnight = await plannedSchedule.protectedTimeRules.create({
    ...base,
    recurrenceRule: "FREQ=DAILY",
    startTimeLocal: "22:00",
    endTimeLocal: "07:00",
    spansNextDay: true,
    reason: "Sleep",
    protectionLevel: "HARD",
    isSleep: true,
  });
  assert.equal(overnight.ok, true);
  const sleep = overnight.value;
  const springSleep = shared.expandRecurringWindows(sleep, "2026-03-07", "2026-03-07");
  const fallSleep = shared.expandRecurringWindows(sleep, "2026-10-31", "2026-10-31");
  assert.equal((springSleep[0].endAt - springSleep[0].startAt) / 3600000, 8);
  assert.equal((fallSleep[0].endAt - fallSleep[0].startAt) / 3600000, 10);
  assert.equal(
    (
      await plannedSchedule.protectedTimeRules.update({
        id: sleep.id,
        expectedVersion: 0,
        protectionLevel: "SOFT",
      })
    ).error.code,
    "VALIDATION_ERROR",
  );
  assert.equal(
    (
      await plannedSchedule.protectedTimeRules.create({
        ...base,
        reason: "Invalid sleep",
        protectionLevel: "SOFT",
        isSleep: true,
      })
    ).error.code,
    "VALIDATION_ERROR",
  );
  const soft = (
    await plannedSchedule.protectedTimeRules.create({
      ...base,
      reason: "Gym",
      protectionLevel: "SOFT",
    })
  ).value;
  const afterSoft = replanRequests.length;
  assert.equal(
    (
      await plannedSchedule.protectedTimeRules.update({
        id: soft.id,
        expectedVersion: 0,
        reason: "Gym session",
      })
    ).ok,
    true,
  );
  assert.equal(replanRequests.length, afterSoft);
  assert.equal(
    (
      await plannedSchedule.protectedTimeRules.update({
        id: soft.id,
        expectedVersion: 1,
        protectionLevel: "HARD",
      })
    ).ok,
    true,
  );
  assert.equal(replanRequests.length, afterSoft + 1);
  const beforeInformation = replanRequests.length;
  const information = (
    await plannedSchedule.protectedTimeRules.create({
      ...base,
      reason: "Reminder",
      protectionLevel: "INFORMATIONAL",
    })
  ).value;
  assert.equal(replanRequests.length, beforeInformation);
  assert.equal(
    (
      await plannedSchedule.protectedTimeRules.deactivate({
        id: information.id,
        expectedVersion: 0,
      })
    ).value.active,
    false,
  );
  assert.equal(replanRequests.length, beforeInformation);
  assert.equal(
    (await plannedSchedule.protectedTimeRules.deactivate({ id: soft.id, expectedVersion: 2 })).value
      .active,
    false,
  );
  assert.equal(
    (await plannedSchedule.protectedTimeRules.deactivate({ id: sleep.id, expectedVersion: 0 }))
      .value.active,
    false,
  );
});

test("planning preferences create once, update conditionally and classify policy changes", async () => {
  const before = replanRequests.length;
  const input = {
    preferredDailyStudyLimitMinutes: 240,
    minimumFreeTimeMinutes: 30,
    preferredDeadlineBufferHours: 12,
    avoidLateHighEnergyTasks: true,
    maximumConsecutiveWorkMinutes: 90,
    minimumBreakMinutes: 10,
    scheduleCommuteWork: false,
    weekendWorkBias: 0,
    planStabilityWindowMinutes: 120,
    minimumSleepMinutes: 420,
  };
  const created = await plannedSchedule.planningPreferences.create(input);
  assert.equal(created.ok, true);
  assert.equal(created.value.minimumSleepMinutes, 420);
  assert.equal(replanRequests.length, before + 1);
  assert.equal((await plannedSchedule.planningPreferences.create(input)).error.code, "CONFLICT");
  assert.equal(
    (
      await plannedSchedule.planningPreferences.update({
        expectedVersion: 0,
        scheduleCommuteWork: true,
      })
    ).value.scheduleCommuteWork,
    true,
  );
  assert.equal(replanRequests.length, before + 2);
  assert.equal(
    (
      await plannedSchedule.planningPreferences.update({
        expectedVersion: 0,
        scheduleCommuteWork: false,
      })
    ).error.code,
    "STALE_WRITE",
  );
  assert.equal(
    (
      await plannedSchedule.planningPreferences.update({
        expectedVersion: 1,
        minimumSleepMinutes: -5,
      })
    ).error.code,
    "VALIDATION_ERROR",
  );
  assert.equal(owned("preferences", user.userId, created.value.id).minimumSleepMinutes, 420);
});

test("academic service module loads and enforces two-user scoping, dates, and optimistic versions", async () => {
  const bad = await academic.academicTerms.create({
    name: "Fall",
    startDate: "2026-12-01",
    endDate: "2026-09-01",
  });
  assert.equal(bad.error.code, "VALIDATION_ERROR");
  const term = (
    await academic.academicTerms.create({
      name: "Fall",
      startDate: "2026-09-01",
      endDate: "2026-12-20",
    })
  ).value;
  assert.equal(term.startDate, "2026-09-01");
  assert.equal(
    (await academic.academicTerms.update({ id: term.id, expectedVersion: 0, name: "Fall 2026" }))
      .value.version,
    1,
  );
  assert.equal(
    (await academic.academicTerms.update({ id: term.id, expectedVersion: 0, name: "Stale" })).error
      .code,
    "STALE_WRITE",
  );
  rows.terms.push({ ...term, id: "foreign-term", userId: other.userId });
  assert.equal(
    (
      await academic.courses.create({
        academicTermId: "foreign-term",
        code: "MAT186",
        name: "Calculus",
      })
    ).error.code,
    "NOT_FOUND",
  );
  const course = (
    await academic.courses.create({ academicTermId: term.id, code: "MAT186", name: "Calculus" })
  ).value;
  assert.equal(
    (await academic.courses.archive({ id: course.id, expectedVersion: 0 })).value
      .archivedAt instanceof Date,
    true,
  );
  assert.equal((await academic.courses.get({ id: course.id })).error.code, "NOT_FOUND");
});

test("task relations, unknown deadlines, hierarchy, and dependency cycles", async () => {
  rows.terms.push({ id: "active-term", userId: user.userId, status: "ACTIVE" });
  const course = {
    id: "active-course",
    userId: user.userId,
    academicTermId: "active-term",
    archivedAt: null,
  };
  rows.courses.push(course);
  rows.courses.push({ ...course, id: "foreign-course", userId: other.userId });
  const bad = await academic.tasks.create({ title: "Cross-user", courseId: "foreign-course" });
  assert.equal(bad.error.code, "NOT_FOUND");
  const a = (await academic.tasks.create({ title: "A", courseId: course.id })).value;
  const b = (await academic.tasks.create({ title: "B", parentTaskId: a.id })).value;
  assert.equal(a.dueAt, null);
  assert.equal(a.originalEstimatedMinutes, null);
  assert.equal(
    (await academic.tasks.update({ id: a.id, expectedVersion: 0, parentTaskId: b.id })).error.code,
    "CONFLICT",
  );
  const dep = await academic.taskDependencies.add({
    prerequisiteTaskId: a.id,
    dependentTaskId: b.id,
    expectedDependentVersion: 0,
  });
  assert.equal(dep.ok, true);
  assert.equal(
    (
      await academic.taskDependencies.add({
        prerequisiteTaskId: b.id,
        dependentTaskId: a.id,
        expectedDependentVersion: 0,
      })
    ).error.code,
    "CONFLICT",
  );
  assert.equal(rows.edges.length, 1);
});

test("migration extends academic versions without changing the foundation", () => {
  const sql = readFileSync(
    "packages/database/prisma/migrations/0004_academic_service_versions/migration.sql",
    "utf8",
  );
  for (const table of ["AcademicTerm", "Course", "CourseMeeting", "Assessment"])
    assert.match(
      sql,
      new RegExp(`ALTER TABLE "${table}" ADD COLUMN[\\s\\S]*?"version" INTEGER NOT NULL DEFAULT 0`),
    );
  assert.match(sql, /"CourseMeeting" ADD COLUMN\s+"archivedAt" TIMESTAMPTZ\(3\)/);
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|CASCADE/);
});

test("ordinary academic capture cannot claim external or system provenance", async () => {
  const result = await academic.tasks.create({ title: "Forged", source: "INTEGRATION" });
  assert.equal(result.error.code, "VALIDATION_ERROR");
  const created = (await academic.tasks.create({ title: "Manual" })).value;
  assert.equal(created.source, "MANUAL");
  assert.equal(created.sourceAuthority, "USER");
});

test("calendar isolation, recurrence validation, inbox text and stale edits", async () => {
  const bad = await schedule.calendarEvents.create({
    title: "Exam",
    eventType: "EXAM",
    startAt: "2026-10-01T12:00:00Z",
    endAt: "2026-10-01T11:00:00Z",
    constraintLevel: "HARD",
  });
  assert.equal(bad.error.code, "VALIDATION_ERROR");
  const event = (
    await schedule.calendarEvents.create({
      title: "Lecture",
      eventType: "CLASS",
      startAt: "2026-10-01T11:00:00Z",
      endAt: "2026-10-01T12:00:00Z",
      constraintLevel: "HARD",
    })
  ).value;
  rows.events.push({ ...event, id: "other-event", userId: other.userId });
  assert.equal((await schedule.calendarEvents.get({ id: "other-event" })).error.code, "NOT_FOUND");
  assert.equal(
    (await schedule.calendarEvents.update({ id: event.id, expectedVersion: 0, title: "Updated" }))
      .value.version,
    1,
  );
  assert.equal(
    (await schedule.calendarEvents.update({ id: event.id, expectedVersion: 0, title: "Stale" }))
      .error.code,
    "STALE_WRITE",
  );
  const rule = (
    await schedule.availabilityRules.create({
      recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
      startTimeLocal: "09:00",
      endTimeLocal: "17:00",
      timezone: "America/Toronto",
      effectiveFrom: "2026-03-01",
      capacityFactor: 1,
      energyLevel: "HIGH",
    })
  ).value;
  assert.equal(rule.startTimeLocal, "09:00");
  assert.equal(rule.effectiveUntil, null);
  assert.equal(
    (
      await schedule.availabilityRules.update({
        id: rule.id,
        expectedVersion: 0,
        endTimeLocal: "08:00",
      })
    ).error.code,
    "VALIDATION_ERROR",
  );
  const captured = (await inbox.inboxItems.capture({ rawText: "Maybe assignment due Tuesday" }))
    .value;
  assert.equal(captured.rawText, "Maybe assignment due Tuesday");
  assert.equal(captured.source, "MANUAL");
  assert.equal(
    (await inbox.inboxItems.process({ id: captured.id, expectedVersion: 0 })).value.status,
    "PROCESSED",
  );
});

test("preferences and protected time use versions and retain local wall-clock fields", async () => {
  const preference = (await schedule.planningPreferences.get()).value;
  assert.equal(preference.version, 1);
  assert.equal(
    (await schedule.planningPreferences.update({ expectedVersion: 1, weekendWorkBias: 0 })).value
      .version,
    2,
  );
  assert.equal(
    (await schedule.planningPreferences.update({ expectedVersion: 1, weekendWorkBias: 0.5 })).error
      .code,
    "STALE_WRITE",
  );
  const protection = (
    await schedule.protectedTimeRules.create({
      recurrenceRule: "FREQ=DAILY",
      startTimeLocal: "23:00",
      endTimeLocal: "07:00",
      spansNextDay: true,
      timezone: "America/Toronto",
      effectiveFrom: "2026-03-01",
      protectionLevel: "HARD",
      reason: "Sleep",
    })
  ).value;
  assert.equal(protection.spansNextDay, true);
  assert.equal(protection.startTimeLocal, "23:00");
  assert.equal(
    (await schedule.protectedTimeRules.deactivate({ id: protection.id, expectedVersion: 0 })).value
      .active,
    false,
  );
});

test("migration 0005 retains canonical rows and adds conditional versions", () => {
  const sql = readFileSync(
    "packages/database/prisma/migrations/0005_schedule_state_versions/migration.sql",
    "utf8",
  );
  for (const table of [
    "CalendarEvent",
    "AvailabilityRule",
    "ProtectedTimeRule",
    "PlanningPreference",
    "InboxItem",
  ])
    assert.match(
      sql,
      new RegExp(`ALTER TABLE "${table}" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0`),
    );
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|CASCADE/);
});

test("history is scoped, export redacts credentials, disconnect preserves history, deletion rolls back", async () => {
  const task = (await academic.tasks.create({ title: "Practice" })).value;
  const session = (
    await lifecycle.workSessions.create({
      taskId: task.id,
      startAt: "2026-10-01T11:00:00Z",
      endAt: "2026-10-01T12:00:00Z",
    })
  ).value;
  assert.equal(session.generatedBy, "USER");
  const completion = (
    await lifecycle.completionRecords.record({
      taskId: task.id,
      workSessionId: session.id,
      outcome: "PARTIAL",
      actualMinutes: 25,
    })
  ).value;
  assert.equal(completion.actualMinutes, 25);
  rows.sessions.push({ ...session, id: "other-session", userId: other.userId });
  assert.equal((await lifecycle.workSessions.get({ id: "other-session" })).error.code, "NOT_FOUND");
  assert.equal((await lifecycle.plannerRuns.get({ id: "guessed-run" })).error.code, "NOT_FOUND");
  rows.runs.push({
    id: "run",
    userId: user.userId,
    inputSnapshot: { accessToken: "private", taskId: task.id },
  });
  const integration = (
    await lifecycle.integrationAccounts.create({
      provider: "google-calendar",
      externalAccountId: "calendar-identity",
    })
  ).value;
  assert.equal(integration.credentialReference, undefined);
  rows.integrations[0].credentialReference = "secret-reference";
  const exported = (await lifecycle.accountData.export()).value;
  assert.equal(exported.version, 1);
  assert.equal(JSON.stringify(exported).includes("secret-reference"), false);
  assert.equal(JSON.stringify(exported).includes("private"), false);
  assert.equal(
    exported.data.tasks.some((r) => r.id === task.id),
    true,
  );
  assert.equal(
    (await lifecycle.integrationAccounts.disconnect({ id: integration.id, expectedVersion: 0 }))
      .value.status,
    "DISCONNECTED",
  );
  assert.equal((await lifecycle.workSessions.get({ id: session.id })).value.id, session.id);
  forceDeleteFailure = true;
  assert.equal(
    (await lifecycle.accountData.delete({ confirmation: "DELETE MY ACCOUNT" })).error.code,
    "INTERNAL_ERROR",
  );
  forceDeleteFailure = false;
  assert.equal(
    rows.sessions.some((r) => r.id === session.id),
    true,
  );
  assert.equal(
    (await lifecycle.accountData.delete({ confirmation: "DELETE MY ACCOUNT" })).value.deleted,
    true,
  );
  assert.equal(
    rows.sessions.some((r) => r.id === session.id),
    false,
  );
  assert.equal(
    rows.sessions.some((r) => r.id === "other-session"),
    true,
  );
});

test("lifecycle migration is forward-only and account deletion orders restrictive relations", async () => {
  const sql = readFileSync(
    "packages/database/prisma/migrations/0006_lifecycle_versions/migration.sql",
    "utf8",
  );
  assert.match(sql, /ALTER TABLE "WorkSession" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0/);
  assert.match(
    sql,
    /ALTER TABLE "IntegrationAccount" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0/,
  );
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|CASCADE/);
  const dbSource = readFileSync("packages/database/src/repositories/lifecycle.ts", "utf8");
  const before = (first, last) => assert.ok(dbSource.indexOf(first) < dbSource.indexOf(last));
  before("db.completionRecord.deleteMany", "db.workSession.deleteMany");
  before("db.workSession.deleteMany", "db.task.deleteMany");
  before("db.task.deleteMany", "db.recurringWorkRule.deleteMany");
  before("db.calendarEvent.deleteMany", "db.integrationAccount.deleteMany");
  before("db.externalObjectMap.deleteMany", "db.integrationAccount.deleteMany");
  before("db.course.deleteMany", "db.academicTerm.deleteMany");
  before("db.authIdentity.deleteMany", "db.user.delete");
});

test("manual academic structure uses scoped versions, archived parents and classified triggers", async () => {
  const term = (
    await manual.manualTerms.create({
      name: "Synthetic autumn",
      startDate: "2026-09-01",
      endDate: "2026-12-20",
    })
  ).value;
  assert.equal(term.version, 0);
  assert.equal(term.planning.status, "NOT_REQUESTED");
  const active = (
    await manual.manualTerms.update({ id: term.id, expectedVersion: 0, status: "ACTIVE" })
  ).value;
  assert.equal(active.planning.status, "SUCCEEDED");
  assert.equal(replanRequests.at(-1).trigger.entityType, "ACADEMIC_TERM");
  const countAfterActivation = replanRequests.length;
  const renamed = (
    await manual.manualTerms.update({ id: term.id, expectedVersion: 1, name: "Autumn" })
  ).value;
  assert.equal(renamed.planning.status, "NOT_REQUESTED");
  assert.equal(replanRequests.length, countAfterActivation);
  assert.equal(
    (await manual.manualTerms.update({ id: term.id, expectedVersion: 1, name: "Stale" })).error
      .code,
    "STALE_WRITE",
  );
  const course = (
    await manual.manualCourses.create({
      academicTermId: term.id,
      code: "SYN200",
      name: "Synthetic course",
    })
  ).value;
  assert.equal(course.planning.status, "NOT_REQUESTED");
  const cosmetic = (
    await manual.manualCourses.update({ id: course.id, expectedVersion: 0, name: "Renamed" })
  ).value;
  assert.equal(cosmetic.planning.status, "NOT_REQUESTED");
  const energy = (
    await manual.manualCourses.update({
      id: course.id,
      expectedVersion: 1,
      defaultTaskEnergy: "HIGH",
    })
  ).value;
  assert.equal(energy.planning.status, "SUCCEEDED");
  assert.equal(replanRequests.at(-1).trigger.entityType, "COURSE");
  const beforeMeetings = rows.meetings.length;
  const bad = await manual.manualMeetings.create({
    courseId: course.id,
    meetingType: "LECTURE",
    recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
    startTimeLocal: "10:00",
    endTimeLocal: "09:00",
    timezone: "America/Toronto",
    effectiveFrom: "2026-09-01",
  });
  assert.equal(bad.error.code, "VALIDATION_ERROR");
  assert.equal(rows.meetings.length, beforeMeetings);
  const meeting = (
    await manual.manualMeetings.create({
      courseId: course.id,
      meetingType: "LECTURE",
      recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
      startTimeLocal: "23:00",
      endTimeLocal: "01:00",
      spansNextDay: true,
      timezone: "America/Toronto",
      effectiveFrom: "2026-09-01",
    })
  ).value;
  assert.equal(meeting.planning.status, "SUCCEEDED");
  assert.equal(replanRequests.at(-1).trigger.entityType, "COURSE_MEETING");
  const rawMeeting = rows.meetings.find((row) => row.id === meeting.id);
  const windows = shared.expandRecurringWindows(rawMeeting, "2026-11-02", "2026-11-02");
  assert.equal(windows.length, 1);
  assert.equal(shared.instantToLocal(windows[0].startAt, "America/Toronto").time, "23:00:00");
  const location = (
    await manual.manualMeetings.update({ id: meeting.id, expectedVersion: 0, location: "Room A" })
  ).value;
  assert.equal(location.planning.status, "NOT_REQUESTED");
  const time = (
    await manual.manualMeetings.update({
      id: meeting.id,
      expectedVersion: 1,
      startTimeLocal: "22:00",
    })
  ).value;
  assert.equal(time.planning.status, "SUCCEEDED");
  assert.equal(
    (await manual.manualMeetings.update({ id: meeting.id, expectedVersion: 1, location: "Stale" }))
      .error.code,
    "STALE_WRITE",
  );
  assert.equal(
    (await manual.manualMeetings.archive({ id: meeting.id, expectedVersion: 2 })).value.planning
      .status,
    "SUCCEEDED",
  );
  assert.equal(
    (await manual.manualCourses.archive({ id: course.id, expectedVersion: 2 })).value.planning
      .status,
    "SUCCEEDED",
  );
  const another = (
    await manual.manualCourses.create({ academicTermId: term.id, code: "SYN201", name: "Another" })
  ).value;
  assert.equal(
    (await manual.manualTerms.archive({ id: term.id, expectedVersion: 2 })).value.planning.status,
    "SUCCEEDED",
  );
  assert.equal(
    (await manual.manualTerms.update({ id: term.id, expectedVersion: 3, name: "Resurrect" })).error
      .code,
    "CONFLICT",
  );
  assert.equal(
    (await manual.manualCourses.update({ id: another.id, expectedVersion: 0, name: "Blocked" }))
      .error.code,
    "NOT_FOUND",
  );
  assert.equal(
    (
      await manual.manualCourses.create({
        academicTermId: term.id,
        code: "SYN202",
        name: "Blocked",
      })
    ).error.code,
    "NOT_FOUND",
  );
  assert.equal(
    (
      await manual.manualMeetings.create({
        courseId: another.id,
        meetingType: "LAB",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=TU",
        startTimeLocal: "10:00",
        endTimeLocal: "11:00",
        timezone: "America/Toronto",
        effectiveFrom: "2026-09-01",
      })
    ).error.code,
    "NOT_FOUND",
  );
  assert.equal(
    (
      await manual.manualAssessments.create({
        courseId: another.id,
        title: "Blocked",
        assessmentType: "Exam",
      })
    ).error.code,
    "NOT_FOUND",
  );
  assert.equal(
    (await manual.manualTasks.create({ title: "Blocked", courseId: another.id, status: "READY" }))
      .error.code,
    "NOT_FOUND",
  );
});

test("manual fixed events persist without provider fields and report failed planning separately", async () => {
  const prior = rows.events.length;
  const invalid = await manual.manualEvents.create({
    title: "Appointment",
    eventType: "PERSONAL",
    startAt: "2026-10-01T12:00:00Z",
    endAt: "2026-10-01T11:00:00Z",
    constraintLevel: "HARD",
  });
  assert.equal(invalid.error.code, "VALIDATION_ERROR");
  assert.equal(rows.events.length, prior);
  nextPlan = {
    ok: true,
    value: { status: "FAILED", code: "INVALID_OUTPUT", runId: "private-run" },
  };
  const event = (
    await manual.manualEvents.create({
      title: "Appointment",
      eventType: "PERSONAL",
      startAt: "2026-10-01T11:00:00Z",
      endAt: "2026-10-01T12:00:00Z",
      constraintLevel: "HARD",
    })
  ).value;
  assert.equal(event.planning.status, "FAILED");
  assert.equal(rows.events.length, prior + 1);
  assert.equal(rows.events.at(-1).source, "MANUAL");
  assert.equal(rows.events.at(-1).externalId, null);
  assert.doesNotMatch(JSON.stringify(event), /private-run|userId|externalId/);
  nextPlan = { ok: true, value: { status: "SUCCEEDED", planStatus: "FEASIBLE" } };
  assert.equal(
    (await manual.manualEvents.update({ id: event.id, expectedVersion: 0, title: "Edited" })).value
      .planning.status,
    "NOT_REQUESTED",
  );
  assert.equal(
    (await manual.manualEvents.update({ id: event.id, expectedVersion: 0, title: "Stale" })).error
      .code,
    "STALE_WRITE",
  );
  assert.equal(
    (
      await manual.manualEvents.update({
        id: event.id,
        expectedVersion: 1,
        startAt: "2026-10-01T10:00:00Z",
      })
    ).value.planning.status,
    "SUCCEEDED",
  );
  assert.equal(
    (await manual.manualEvents.archive({ id: event.id, expectedVersion: 2 })).value.planning.status,
    "SUCCEEDED",
  );
  const imported = {
    ...rows.events.at(-1),
    id: "external-manual-guard",
    version: 0,
    archivedAt: null,
    source: "INTEGRATION",
  };
  rows.events.push(imported);
  assert.equal(
    (await manual.manualEvents.update({ id: imported.id, expectedVersion: 0, title: "Forbidden" }))
      .error.code,
    "NOT_FOUND",
  );
  rows.events.push({
    ...imported,
    id: "other-owned-event",
    userId: other.userId,
    source: "MANUAL",
  });
  assert.equal(
    (await manual.manualEvents.archive({ id: "other-owned-event", expectedVersion: 0 })).error.code,
    "NOT_FOUND",
  );
});

test("assessment and task manual workflow preserves unknowns, hierarchy, versions and planner intent", async () => {
  const term = (
    await manual.manualTerms.create({
      name: "Workload term",
      startDate: "2026-09-01",
      endDate: "2026-12-20",
    })
  ).value;
  const course = (
    await manual.manualCourses.create({
      academicTermId: term.id,
      code: "CIV100",
      name: "Civil engineering",
    })
  ).value;
  const beforeInvalid = rows.assessments.length;
  const invalid = await manual.manualAssessments.create({
    courseId: course.id,
    title: "Wrong dates",
    assessmentType: "Assignment",
    releaseAt: "2026-10-10T12:00:00Z",
    dueAt: "2026-10-09T12:00:00Z",
  });
  assert.equal(invalid.error.code, "VALIDATION_ERROR");
  assert.equal(rows.assessments.length, beforeInvalid);
  const assignment = (
    await manual.manualAssessments.create({
      courseId: course.id,
      title: "Assignment 3",
      assessmentType: "Assignment",
      dueAt: "2026-10-15T20:00:00Z",
    })
  ).value;
  assert.equal(assignment.planning.status, "NOT_REQUESTED");
  const unknown = (
    await manual.manualAssessments.create({
      courseId: course.id,
      title: "Exam",
      assessmentType: "Exam",
    })
  ).value;
  assert.equal(owned("assessments", user.userId, unknown.id).dueAt, null);
  const changedDeadline = (
    await manual.manualAssessments.update({
      id: assignment.id,
      expectedVersion: 0,
      dueAt: "2026-10-16T20:00:00Z",
    })
  ).value;
  assert.equal(changedDeadline.planning.status, "SUCCEEDED");
  assert.equal(replanRequests.at(-1).trigger.type, "DEADLINE_CHANGED");
  assert.equal(
    (
      await manual.manualAssessments.update({
        id: assignment.id,
        expectedVersion: 0,
        title: "Stale",
      })
    ).error.code,
    "STALE_WRITE",
  );
  const base = {
    title: "Solve",
    courseId: course.id,
    assessmentId: assignment.id,
    status: "READY",
    availableFrom: "2026-10-10T12:00:00Z",
    originalEstimatedMinutes: 180,
    minimumSessionMinutes: 45,
    preferredSessionMinutes: 45,
    maximumSessionMinutes: 45,
  };
  const beforeTask = rows.tasks.length;
  const badTask = await manual.manualTasks.create({ ...base, dueAt: "2026-10-09T12:00:00Z" });
  assert.equal(badTask.error.code, "VALIDATION_ERROR");
  assert.equal(rows.tasks.length, beforeTask);
  const parent = (await manual.manualTasks.create(base)).value;
  assert.equal(parent.planning.status, "SUCCEEDED");
  assert.equal(replanRequests.at(-1).trigger.type, "TASK_CREATED");
  assert.equal(owned("tasks", user.userId, parent.id).remainingMinutes, 180);
  assert.equal(owned("tasks", user.userId, parent.id).dueAt, null);
  const subtask = (
    await manual.manualTasks.create({
      ...base,
      title: "Review / submit",
      parentTaskId: parent.id,
      originalEstimatedMinutes: 30,
    })
  ).value;
  assert.equal(owned("tasks", user.userId, subtask.id).parentTaskId, parent.id);
  assert.equal(
    (
      await manual.manualTasks.create({
        ...base,
        title: "Foreign child",
        parentTaskId: "other-parent",
      })
    ).error.code,
    "NOT_FOUND",
  );
  assert.equal(
    (
      await manual.manualTasks.create({
        ...base,
        title: "Foreign course",
        courseId: "other-course",
      })
    ).error.code,
    "NOT_FOUND",
  );
  assert.equal(
    (
      await manual.manualTasks.create({
        ...base,
        title: "Foreign assessment",
        assessmentId: "other-assessment",
      })
    ).error.code,
    "NOT_FOUND",
  );
  const corrected = (
    await manual.manualTasks.update({
      id: parent.id,
      expectedVersion: 0,
      currentEstimatedMinutes: 240,
      remainingMinutes: 240,
    })
  ).value;
  assert.equal(corrected.planning.status, "SUCCEEDED");
  assert.equal(replanRequests.at(-1).trigger.type, "TASK_UPDATED");
  assert.equal(
    (await manual.manualTasks.update({ id: parent.id, expectedVersion: 0, title: "Stale" })).error
      .code,
    "STALE_WRITE",
  );
  const dueChanged = (
    await manual.manualTasks.update({
      id: parent.id,
      expectedVersion: 1,
      dueAt: "2026-10-15T12:00:00Z",
    })
  ).value;
  assert.equal(
    owned("tasks", user.userId, parent.id).dueAt?.toISOString(),
    "2026-10-15T12:00:00.000Z",
  );
  assert.equal(owned("tasks", user.userId, parent.id).status, "READY");
  assert.equal(owned("tasks", user.userId, parent.id).planningMode, "AUTO");
  assert.ok(
    realTriggers.classifyTaskMutation(
      { ...owned("tasks", user.userId, parent.id), dueAt: null },
      owned("tasks", user.userId, parent.id),
    ),
  );
  assert.equal(dueChanged.planning.status, "SUCCEEDED");
  assert.equal(replanRequests.at(-1).trigger.type, "DEADLINE_CHANGED");
  const preferred = (
    await manual.manualTasks.update({
      id: parent.id,
      expectedVersion: 2,
      preferredCompletionAt: "2026-10-14T12:00:00Z",
    })
  ).value;
  assert.equal(preferred.planning.status, "SUCCEEDED");
  const manualMode = (
    await manual.manualTasks.update({ id: parent.id, expectedVersion: 3, planningMode: "MANUAL" })
  ).value;
  assert.equal(manualMode.planning.status, "SUCCEEDED");
  assert.equal(
    (await manual.manualTasks.update({ id: parent.id, expectedVersion: 4, planningMode: "AUTO" }))
      .value.planning.status,
    "SUCCEEDED",
  );
  assert.equal(
    (await manual.manualTasks.archive({ id: parent.id, expectedVersion: 5 })).error.code,
    "CONFLICT",
  );
  assert.equal(
    (await manual.manualAssessments.archive({ id: assignment.id, expectedVersion: 1 })).error.code,
    "CONFLICT",
  );
  assert.equal(
    (await manual.manualTasks.archive({ id: subtask.id, expectedVersion: 0 })).value.planning
      .status,
    "SUCCEEDED",
  );
  const manualArchive = (await manual.manualTasks.archive({ id: parent.id, expectedVersion: 5 }))
    .value;
  assert.equal(manualArchive.planning.status, "SUCCEEDED");
  assert.equal(
    (await manual.manualTasks.update({ id: parent.id, expectedVersion: 6, title: "Resurrect" }))
      .error.code,
    "NOT_FOUND",
  );
  assert.equal(
    (await manual.manualAssessments.archive({ id: assignment.id, expectedVersion: 1 })).value
      .planning.status,
    "SUCCEEDED",
  );
  assert.equal(
    (
      await manual.manualTasks.create({
        ...base,
        title: "Archived assessment",
        assessmentId: assignment.id,
      })
    ).error.code,
    "NOT_FOUND",
  );
  rows.tasks.push({
    ...rows.tasks.at(-1),
    id: "foreign-owned-task",
    userId: other.userId,
    archivedAt: null,
    version: 0,
  });
  assert.equal(
    (
      await manual.manualTasks.update({
        id: "foreign-owned-task",
        expectedVersion: 0,
        title: "Stolen",
      })
    ).error.code,
    "NOT_FOUND",
  );
  assert.equal(
    (await manual.manualAssessments.update({ id: unknown.id, expectedVersion: 0, dueAt: null }))
      .value.planning.status,
    "NOT_REQUESTED",
  );
  const initiallyUnknown = (
    await manual.manualTasks.create({
      title: "Estimate later",
      courseId: course.id,
      status: "READY",
      availableFrom: "2026-10-10T12:00:00Z",
      minimumSessionMinutes: 45,
      preferredSessionMinutes: 45,
      maximumSessionMinutes: 45,
    })
  ).value;
  assert.equal(owned("tasks", user.userId, initiallyUnknown.id).originalEstimatedMinutes, null);
  assert.equal(
    (
      await manual.manualTasks.update({
        id: initiallyUnknown.id,
        expectedVersion: 0,
        originalEstimatedMinutes: 90,
        currentEstimatedMinutes: 90,
        remainingMinutes: 90,
      })
    ).value.planning.status,
    "SUCCEEDED",
  );
  assert.equal(owned("tasks", user.userId, initiallyUnknown.id).originalEstimatedMinutes, 90);
  assert.equal(
    (
      await manual.manualTasks.update({
        id: initiallyUnknown.id,
        expectedVersion: 1,
        originalEstimatedMinutes: 120,
      })
    ).error.code,
    "CONFLICT",
  );
});
