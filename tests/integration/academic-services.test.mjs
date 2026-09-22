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
const academic = load("academic", {
  "./authorization": auth,
  "./dependencies": dependencies,
  "./errors": errors,
  "./service": serviceUtils,
  "./validation": validation,
});
const schedule = load("schedule", {
  "./authorization": auth,
  "./errors": errors,
  "./service": serviceUtils,
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
  "./authorization": auth,
  "./errors": errors,
  "./service": transactionalService,
  "./validation": validation,
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
  const course = { id: "active-course", userId: user.userId, archivedAt: null };
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
  const preference = (
    await schedule.planningPreferences.create({
      preferredDailyStudyLimitMinutes: 300,
      minimumFreeTimeMinutes: 30,
      preferredDeadlineBufferHours: 12,
      avoidLateHighEnergyTasks: true,
      maximumConsecutiveWorkMinutes: 120,
      minimumBreakMinutes: 10,
      scheduleCommuteWork: false,
      weekendWorkBias: -0.5,
      planStabilityWindowMinutes: 180,
    })
  ).value;
  assert.equal(preference.version, 0);
  assert.equal(
    (await schedule.planningPreferences.update({ expectedVersion: 0, weekendWorkBias: 0 })).value
      .version,
    1,
  );
  assert.equal(
    (await schedule.planningPreferences.update({ expectedVersion: 0, weekendWorkBias: 0.5 })).error
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
