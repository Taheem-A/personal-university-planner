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
const rows = { terms: [], courses: [], meetings: [], assessments: [], tasks: [], edges: [] };
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
};
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
