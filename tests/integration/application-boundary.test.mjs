import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import typescript from "typescript";

const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));

function load(file, stubs = {}) {
  const source = readFileSync(`apps/web/src/server/application/${file}.ts`, "utf8");
  const javascript = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  const require = (name) => stubs[name] ?? webRequire(name);
  vm.runInNewContext(javascript, { exports, require, Intl, Date, Error, Map, Set, Number });
  return exports;
}

const databaseErrors = { getDatabaseErrorDetails: (error) => error?.dbError ?? null };
const errors = load("errors", { "@university-planner/database": databaseErrors });

test("untrusted input and domain ordering reject malformed payloads", () => {
  const v = load("validation", { "./errors": errors });
  assert.equal(v.validateInput(v.textSchema, "  Study  "), "Study");
  assert.throws(
    () => v.validateInput(v.textSchema, " \t"),
    (e) => e.code === "VALIDATION_ERROR",
  );
  assert.throws(
    () => v.validateInput(v.timezoneSchema, "Earth/Toronto"),
    (e) => e.code === "VALIDATION_ERROR",
  );
  assert.equal(v.validateInput(v.calendarDateSchema, "2026-09-22"), "2026-09-22");
  assert.throws(
    () => v.validateInput(v.calendarDateSchema, "2026-09-22T10:00:00Z"),
    (e) => e.code === "VALIDATION_ERROR",
  );
  assert.throws(
    () =>
      v.validateInput(v.sessionLengthsSchema, {
        minimumSessionMinutes: 60,
        preferredSessionMinutes: 30,
        maximumSessionMinutes: 90,
      }),
    (e) => e.code === "VALIDATION_ERROR",
  );
  assert.throws(
    () => v.validateOrderedInstants(new Date("2026-01-02"), new Date("2026-01-01")),
    (e) => e.code === "VALIDATION_ERROR",
  );
  assert.throws(
    () => v.validateCompletionDeadline(new Date("2026-01-03"), new Date("2026-01-02")),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("database constraints map to safe structured application results", async () => {
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(errors.applicationFailure({ dbError: { kind: "UNIQUE_CONSTRAINT" } })),
    ),
    { code: "CONFLICT", message: "This record conflicts with an existing record." },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(errors.applicationFailure(new Error("private connection detail")))),
    { code: "INTERNAL_ERROR", message: "The operation could not be completed." },
  );
  const result = await errors.resultOf(async () => {
    throw new errors.ApplicationError("STALE_WRITE", "Reload first.");
  });
  assert.equal(result.error.code, "STALE_WRITE");
});

test("dependency addition detects self-edges and multi-hop cycles", () => {
  const { assertAcyclicDependency } = load("dependencies", { "./errors": errors });
  const edges = [
    { prerequisiteTaskId: "a", dependentTaskId: "b" },
    { prerequisiteTaskId: "b", dependentTaskId: "c" },
  ];
  assertAcyclicDependency(edges, { prerequisiteTaskId: "a", dependentTaskId: "d" });
  assert.throws(
    () => assertAcyclicDependency(edges, { prerequisiteTaskId: "c", dependentTaskId: "a" }),
    (e) => e.code === "CONFLICT",
  );
  assert.throws(
    () => assertAcyclicDependency(edges, { prerequisiteTaskId: "a", dependentTaskId: "a" }),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("owned and nested resources hide guessed cross-user IDs", async () => {
  const auth = load("authorization", {
    "./errors": errors,
    "../auth": { authenticatedActor: async () => null },
  });
  await assert.rejects(auth.requireActor(), (e) => e.code === "UNAUTHORIZED");
  const repos = {
    courses: {
      getForUser: async (userId, id) =>
        userId === "owner" && id === "mine" ? { id, archivedAt: null } : null,
    },
    assessments: {
      getForUser: async () => ({ id: "assessment", courseId: "other", archivedAt: null }),
    },
    tasks: { getForUser: async () => null },
  };
  await assert.rejects(
    auth.requireCourse(repos, { userId: "owner" }, "other"),
    (e) => e.code === "NOT_FOUND",
  );
  await assert.rejects(
    auth.requireAssessment(repos, { userId: "owner" }, "assessment"),
    (e) => e.code === "NOT_FOUND",
  );
  await assert.rejects(
    auth.requireTaskRelationships(repos, { userId: "owner" }, { parentTaskId: "other" }),
    (e) => e.code === "NOT_FOUND",
  );
  repos.assessments.getForUser = async () => ({
    id: "assessment",
    courseId: "mine",
    archivedAt: null,
  });
  repos.courses.getForUser = async (userId, id) =>
    userId === "owner" ? { id, archivedAt: null } : null;
  await assert.rejects(
    auth.requireTaskRelationships(
      repos,
      { userId: "owner" },
      { courseId: "second", assessmentId: "assessment" },
    ),
    (e) => e.code === "NOT_FOUND",
  );
});
