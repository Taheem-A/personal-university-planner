import assert from "node:assert/strict";
import test from "node:test";
import {
  expectedSeedCounts,
  fixtureIds,
  syntheticSemester,
} from "../../packages/database/prisma/synthetic-semester.mjs";

test("synthetic semester has stable IDs, fixed dates, and broad canonical coverage", () => {
  assert.equal(syntheticSemester.user.id, "seed-user-engineering-fall-2026");
  assert.equal(syntheticSemester.user.timezone, "America/Toronto");
  assert.equal(syntheticSemester.academicTerm.startDate.toISOString(), "2026-09-08T00:00:00.000Z");
  assert.equal(syntheticSemester.academicTerm.endDate.toISOString(), "2026-12-18T00:00:00.000Z");
  assert.equal(syntheticSemester.courses.length, expectedSeedCounts.courses);
  assert.equal(syntheticSemester.courseMeetings.length, expectedSeedCounts.courseMeetings);
  assert.equal(syntheticSemester.assessments.length, expectedSeedCounts.assessments);
  assert.equal(syntheticSemester.tasks.length, expectedSeedCounts.tasks);
  assert.equal(syntheticSemester.taskDependencies.length, expectedSeedCounts.taskDependencies);
  assert.equal(syntheticSemester.recurringWorkRules.length, expectedSeedCounts.recurringWorkRules);
  assert.equal(syntheticSemester.calendarEvents.length, expectedSeedCounts.calendarEvents);
});

test("fixture exercises hierarchy, dependencies, unknowns, archives, and safe external identity", () => {
  const subtasks = syntheticSemester.tasks.filter(
    (task) => task.parentTaskId === fixtureIds.tasks.matParent,
  );
  assert.deepEqual(
    new Set(subtasks.map((task) => task.id)),
    new Set([fixtureIds.tasks.matSolve, fixtureIds.tasks.matPolish, fixtureIds.tasks.matSubmit]),
  );
  assert.equal(syntheticSemester.taskDependencies.length, 2);

  const unknown = syntheticSemester.tasks.find(
    (task) => task.id === fixtureIds.tasks.unknownEstimate,
  );
  assert.equal(unknown?.dueAt, null);
  assert.equal(unknown?.originalEstimatedMinutes, null);
  assert.equal(unknown?.currentEstimatedMinutes, null);
  assert.equal(unknown?.remainingMinutes, null);

  assert.ok(syntheticSemester.courses.some((course) => course.archivedAt instanceof Date));
  assert.equal(syntheticSemester.integrationAccount.status, "DISCONNECTED");
  assert.equal(syntheticSemester.integrationAccount.credentialReference, null);
  assert.equal(
    syntheticSemester.externalObjectMap.provider,
    syntheticSemester.integrationAccount.provider,
  );
});

test("fixture content is explicitly synthetic and contains no token-like credentials", () => {
  const serialized = JSON.stringify(syntheticSemester);
  assert.match(serialized, /Synthetic/i);
  assert.doesNotMatch(serialized, /refresh[_-]?token|access[_-]?token|client[_-]?secret/i);
  assert.doesNotMatch(serialized, /AIza[0-9A-Za-z_-]{20,}/);
});
