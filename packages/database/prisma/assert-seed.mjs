import assert from "node:assert/strict";
import { expectedSeedCounts, fixtureIds } from "./synthetic-semester.mjs";
import { assertSafeSeedTarget, createSeedClient, getSeedDatabaseUrl } from "./seed-support.mjs";

async function assertCounts(prisma) {
  const userId = fixtureIds.user;
  const actual = {
    users: await prisma.user.count({ where: { id: userId } }),
    academicTerms: await prisma.academicTerm.count({ where: { userId } }),
    courses: await prisma.course.count({ where: { userId } }),
    courseMeetings: await prisma.courseMeeting.count({ where: { userId } }),
    assessments: await prisma.assessment.count({ where: { userId } }),
    tasks: await prisma.task.count({ where: { userId } }),
    taskDependencies: await prisma.taskDependency.count({ where: { userId } }),
    recurringWorkRules: await prisma.recurringWorkRule.count({ where: { userId } }),
    calendarEvents: await prisma.calendarEvent.count({ where: { userId } }),
    availabilityRules: await prisma.availabilityRule.count({ where: { userId } }),
    protectedTimeRules: await prisma.protectedTimeRule.count({ where: { userId } }),
    planningPreferences: await prisma.planningPreference.count({ where: { userId } }),
    workSessions: await prisma.workSession.count({ where: { userId } }),
    completionRecords: await prisma.completionRecord.count({ where: { userId } }),
    estimateProfiles: await prisma.estimateProfile.count({ where: { userId } }),
    plannerRuns: await prisma.plannerRun.count({ where: { userId } }),
    integrationAccounts: await prisma.integrationAccount.count({ where: { userId } }),
    externalObjectMaps: await prisma.externalObjectMap.count({ where: { userId } }),
    inboxItems: await prisma.inboxItem.count({ where: { userId } }),
  };
  assert.deepEqual(actual, expectedSeedCounts);
}

async function assertOwnership(prisma) {
  const userId = fixtureIds.user;
  const ownedModels = [
    prisma.academicTerm,
    prisma.course,
    prisma.courseMeeting,
    prisma.assessment,
    prisma.task,
    prisma.taskDependency,
    prisma.recurringWorkRule,
    prisma.calendarEvent,
    prisma.availabilityRule,
    prisma.protectedTimeRule,
    prisma.planningPreference,
    prisma.workSession,
    prisma.completionRecord,
    prisma.estimateProfile,
    prisma.plannerRun,
    prisma.integrationAccount,
    prisma.externalObjectMap,
    prisma.inboxItem,
  ];
  for (const model of ownedModels) {
    const rows = await model.findMany({ where: { userId }, select: { userId: true } });
    assert.ok(rows.every((row) => row.userId === userId));
  }
}

async function assertRelationships(prisma) {
  const parent = await prisma.task.findUniqueOrThrow({
    where: { id: fixtureIds.tasks.matParent },
    include: { subtasks: { orderBy: { id: "asc" } } },
  });
  assert.deepEqual(
    parent.subtasks.map((task) => task.id).sort(),
    [fixtureIds.tasks.matPolish, fixtureIds.tasks.matSolve, fixtureIds.tasks.matSubmit].sort(),
  );

  const dependencies = await prisma.taskDependency.findMany({
    where: { userId: fixtureIds.user },
    orderBy: { prerequisiteTaskId: "asc" },
  });
  assert.deepEqual(
    dependencies.map((edge) => [edge.prerequisiteTaskId, edge.dependentTaskId]),
    [
      [fixtureIds.tasks.matPolish, fixtureIds.tasks.matSubmit],
      [fixtureIds.tasks.matSolve, fixtureIds.tasks.matPolish],
    ],
  );

  const superseded = await prisma.workSession.findUniqueOrThrow({
    where: { id: fixtureIds.workSessions.superseded },
    include: { supersededBy: true },
  });
  assert.equal(superseded.state, "SUPERSEDED");
  assert.equal(superseded.supersededBy?.id, fixtureIds.workSessions.replacement);

  const completion = await prisma.completionRecord.findUniqueOrThrow({
    where: { id: fixtureIds.completion },
    include: { task: true, workSession: true },
  });
  assert.equal(completion.task.status, "COMPLETED");
  assert.equal(completion.workSession?.state, "COMPLETED");
  assert.equal(completion.actualMinutes, 50);
}

async function assertTimeSemantics(prisma) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: fixtureIds.user } });
  assert.equal(user.createdAt.toISOString(), "2026-08-15T16:00:00.000Z");
  assert.equal(user.updatedAt.toISOString(), "2026-08-15T16:00:00.000Z");

  const term = await prisma.academicTerm.findUniqueOrThrow({ where: { id: fixtureIds.term } });
  assert.equal(term.startDate.toISOString(), "2026-09-08T00:00:00.000Z");
  assert.equal(term.endDate.toISOString(), "2026-12-18T00:00:00.000Z");

  const meeting = await prisma.courseMeeting.findUniqueOrThrow({
    where: { id: fixtureIds.meetings.matLecture },
  });
  assert.equal(meeting.startTimeLocal.toISOString(), "1970-01-01T09:00:00.000Z");
  assert.equal(meeting.timezone, "America/Toronto");
  assert.equal(meeting.recurrenceRule, "FREQ=WEEKLY;BYDAY=MO,WE,FR");
  assert.equal(meeting.effectiveFrom.toISOString(), "2026-09-08T00:00:00.000Z");

  const rule = await prisma.recurringWorkRule.findUniqueOrThrow({
    where: { id: fixtureIds.rules.reviewAfterLecture },
  });
  assert.equal(rule.anchorTimeLocal.toISOString(), "1970-01-01T10:15:00.000Z");
  assert.equal(rule.timezone, "America/Toronto");

  const event = await prisma.calendarEvent.findUniqueOrThrow({
    where: { id: fixtureIds.calendarEvents.designTeam },
  });
  assert.equal(event.startAt.toISOString(), "2026-09-24T22:00:00.000Z");
  assert.equal(event.endAt.toISOString(), "2026-09-24T23:30:00.000Z");
}

async function assertNullAndEstimateSemantics(prisma) {
  const unknownAssessment = await prisma.assessment.findUniqueOrThrow({
    where: { id: fixtureIds.assessments.aps111Unknown },
  });
  assert.equal(unknownAssessment.dueAt, null);
  assert.equal(unknownAssessment.gradeWeight, null);

  const unknownTask = await prisma.task.findUniqueOrThrow({
    where: { id: fixtureIds.tasks.unknownEstimate },
  });
  assert.equal(unknownTask.originalEstimatedMinutes, null);
  assert.equal(unknownTask.currentEstimatedMinutes, null);
  assert.equal(unknownTask.remainingMinutes, null);

  const estimatedTask = await prisma.task.findUniqueOrThrow({
    where: { id: fixtureIds.tasks.matParent },
  });
  assert.equal(estimatedTask.originalEstimatedMinutes, 240);
  assert.equal(estimatedTask.currentEstimatedMinutes, 270);
  assert.equal(estimatedTask.remainingMinutes, 210);

  const preferredAssessment = await prisma.assessment.findUniqueOrThrow({
    where: { id: fixtureIds.assessments.matProblemSet },
  });
  assert.ok(preferredAssessment.preferredCompletionAt < preferredAssessment.dueAt);
}

async function assertExternalIdentity(prisma) {
  const map = await prisma.externalObjectMap.findUniqueOrThrow({
    where: { id: fixtureIds.externalMap },
    include: { integrationAccount: true },
  });
  assert.equal(map.provider, map.integrationAccount.provider);
  assert.equal(map.userId, map.integrationAccount.userId);
  assert.equal(map.integrationAccount.credentialReference, null);
  assert.equal(map.integrationAccount.status, "DISCONNECTED");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.externalObjectMap.create({
        data: {
          id: "seed-duplicate-external-identity-probe",
          userId: map.userId,
          integrationAccountId: map.integrationAccountId,
          provider: map.provider,
          externalId: map.externalId,
          internalType: "TASK",
          internalId: fixtureIds.tasks.civReview,
        },
      });
      throw new Error("duplicate external identity was accepted");
    });
    assert.fail("duplicate external identity should be rejected");
  } catch (error) {
    assert.equal(error?.code, "P2002", "external identity uniqueness must reject duplicates");
  }
}

export async function assertSyntheticSemester(prisma) {
  await assertCounts(prisma);
  await assertOwnership(prisma);
  await assertRelationships(prisma);
  await assertTimeSemantics(prisma);
  await assertNullAndEstimateSemantics(prisma);
  await assertExternalIdentity(prisma);
}

async function main() {
  const databaseUrl = getSeedDatabaseUrl();
  const { databaseName } = assertSafeSeedTarget(databaseUrl);
  const prisma = createSeedClient(databaseUrl);

  try {
    await assertSyntheticSemester(prisma);
    console.log(`Synthetic semester integrity verified on '${databaseName}'.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
