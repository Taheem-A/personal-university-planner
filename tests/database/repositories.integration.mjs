import assert from "node:assert/strict";
import test from "node:test";
import {
  createDatabase,
  getDatabase,
  getDatabaseErrorDetails,
} from "../../packages/database/dist/index.js";

const connectionString = process.env.REPOSITORY_TEST_DATABASE_URL;
const confirmation = process.env.CONFIRM_REPOSITORY_TEST_DATABASE;

if (process.env.APP_ENV !== "test") throw new Error("APP_ENV must be exactly 'test'.");
if (confirmation !== "RUN_REPOSITORY_INTEGRATION_TESTS") {
  throw new Error("CONFIRM_REPOSITORY_TEST_DATABASE must be RUN_REPOSITORY_INTEGRATION_TESTS.");
}
if (!connectionString) throw new Error("REPOSITORY_TEST_DATABASE_URL is required.");

const parsedUrl = new URL(connectionString);
const databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
if (
  !parsedUrl.hostname.endsWith(".neon.tech") ||
  parsedUrl.hostname.includes("-pooler") ||
  !/^up_m1_seed_[a-z0-9_]+$/.test(databaseName)
) {
  throw new Error("Repository tests require a direct disposable up_m1_seed_* Neon database.");
}

const database = createDatabase({ connectionString });
const seededUserId = "seed-user-engineering-fall-2026";
const audit = {
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
  updatedAt: new Date("2026-09-01T12:00:00.000Z"),
};
const provenance = {
  source: "MANUAL",
  sourceAuthority: "USER",
  sourceConfidence: "MANUAL",
};
const testIds = {
  userA: "repository-test-user-a",
  userB: "repository-test-user-b",
  term: "repository-test-term",
  course: "repository-test-course",
  meeting: "repository-test-meeting",
  assessment: "repository-test-assessment",
  rule: "repository-test-rule",
  parent: "repository-test-parent-task",
  childA: "repository-test-child-a",
  childB: "repository-test-child-b",
  plannerRun: "repository-test-planner-run",
  replacementSession: "repository-test-session-replacement",
  originalSession: "repository-test-session-original",
  completion: "repository-test-completion",
  availability: "repository-test-availability",
  protectedTime: "repository-test-protected-time",
  preference: "repository-test-preference",
  calendarEvent: "repository-test-calendar-event",
  estimate: "repository-test-estimate",
  integration: "repository-test-integration",
  externalMap: "repository-test-external-map",
  inbox: "repository-test-inbox",
};

function user(id) {
  return {
    id,
    name: `Synthetic ${id}`,
    timezone: "America/Toronto",
    defaultDayStart: "08:00:00",
    defaultDayEnd: "22:00:00",
    locale: "en-CA",
    ...audit,
  };
}

function taskRecord(id, parentTaskId, title) {
  return {
    id,
    userId: testIds.userA,
    courseId: testIds.course,
    assessmentId: testIds.assessment,
    recurringWorkRuleId: null,
    parentTaskId,
    title,
    description: null,
    status: "READY",
    priorityOverride: null,
    availableFrom: new Date("2026-09-15T13:00:00.000Z"),
    dueAt: new Date("2026-09-20T20:00:00.000Z"),
    preferredCompletionAt: null,
    originalEstimatedMinutes: 60,
    currentEstimatedMinutes: 60,
    remainingMinutes: 60,
    energyRequirement: "MEDIUM",
    locationRequirements: ["desk"],
    minimumSessionMinutes: 15,
    preferredSessionMinutes: 30,
    maximumSessionMinutes: 60,
    splittable: true,
    interruptible: true,
    planningMode: "AUTO",
    completedAt: null,
    archivedAt: null,
    ...provenance,
    ...audit,
  };
}

test.after(async () => {
  await database.disconnect();
});

test("ambient production database access is disabled in tests", () => {
  assert.throws(() => getDatabase(), /explicit disposable connection/);
});

test("every canonical repository reads the deterministic seed through plain records", async () => {
  const repositories = database.repositories;
  const userRecord = await repositories.users.getById(seededUserId);
  assert.equal(userRecord?.timezone, "America/Toronto");
  assert.equal(userRecord?.defaultDayStart, "08:00:00");

  const terms = await repositories.academicTerms.listForUser(seededUserId);
  assert.equal(terms[0]?.startDate, "2026-09-08");
  const termId = terms[0].id;

  assert.equal((await repositories.courses.listForTerm(seededUserId, termId)).length, 5);
  assert.equal(
    (await repositories.courseMeetings.listForCourse(seededUserId, "seed-course-mat186"))[0]
      .startTimeLocal,
    "09:00:00",
  );
  assert.ok(
    (await repositories.assessments.listForCourse(seededUserId, "seed-course-mat186")).length > 0,
  );
  assert.equal(
    (await repositories.tasks.listSubtasks(seededUserId, "seed-task-mat186-problem-set-parent"))
      .length,
    3,
  );
  assert.equal(
    (await repositories.taskDependencies.listForTask(seededUserId, "seed-task-mat186-polish"))
      .length,
    2,
  );
  assert.equal(
    (await repositories.recurringWorkRules.listForCourse(seededUserId, "seed-course-mat186"))
      .length,
    1,
  );
  assert.equal(
    (
      await repositories.calendarEvents.listForRange(
        seededUserId,
        new Date("2026-09-01T00:00:00.000Z"),
        new Date("2026-11-01T00:00:00.000Z"),
      )
    ).length,
    3,
  );
  assert.equal((await repositories.availabilityRules.listActive(seededUserId)).length, 2);
  assert.equal((await repositories.protectedTimeRules.listActive(seededUserId)).length, 3);
  assert.equal(
    (await repositories.planningPreferences.getForUser(seededUserId))
      ?.preferredDailyStudyLimitMinutes,
    300,
  );
  assert.equal(
    (
      await repositories.workSessions.listForRange(
        seededUserId,
        new Date("2026-09-01T00:00:00.000Z"),
        new Date("2026-11-01T00:00:00.000Z"),
      )
    ).length,
    3,
  );
  assert.equal(
    (
      await repositories.completionRecords.listForTask(
        seededUserId,
        "seed-task-aps110-reading-complete",
      )
    ).length,
    1,
  );
  assert.equal(
    (await repositories.estimateProfiles.getForContext(seededUserId, "TASK_TYPE", "problem-set"))
      ?.confidence,
    0.2,
  );
  assert.deepEqual(await repositories.plannerRuns.listRecent(seededUserId, 5), []);
  assert.equal((await repositories.integrationAccounts.listForUser(seededUserId)).length, 1);
  assert.equal(
    (
      await repositories.externalObjectMaps.getForExternalIdentity(
        seededUserId,
        "mock-calendar",
        "mock-event-2026-10-01-001",
      )
    )?.internalType,
    "CALENDAR_EVENT",
  );
  assert.equal((await repositories.inboxItems.listByStatus(seededUserId, "ACTIVE")).length, 1);
});

test("transaction context round-trips all canonical relationships and rolls back on failure", async () => {
  const forcedFailure = new Error("forced repository transaction rollback");

  await assert.rejects(
    database.transaction(async ({ repositories }) => {
      await repositories.users.create(user(testIds.userA));
      await repositories.users.create(user(testIds.userB));
      await repositories.academicTerms.create({
        id: testIds.term,
        userId: testIds.userA,
        name: "Repository Test Fall 2026",
        startDate: "2026-09-08",
        endDate: "2026-12-18",
        status: "ACTIVE",
        ...audit,
      });
      await repositories.courses.create({
        id: testIds.course,
        userId: testIds.userA,
        academicTermId: testIds.term,
        code: "TST100",
        name: "Synthetic Repository Engineering",
        section: null,
        instructorName: null,
        colorReference: "violet",
        creditValue: 0.5,
        defaultTaskEnergy: "MEDIUM",
        defaultTaskLocation: ["desk"],
        archivedAt: null,
        ...provenance,
        ...audit,
      });
      await repositories.courseMeetings.create({
        id: testIds.meeting,
        userId: testIds.userA,
        courseId: testIds.course,
        meetingType: "LECTURE",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
        startTimeLocal: "09:30:00",
        endTimeLocal: "10:30:00",
        spansNextDay: false,
        timezone: "America/Toronto",
        location: "Synthetic Room",
        effectiveFrom: "2026-09-08",
        effectiveUntil: "2026-12-18",
        attendanceRequired: true,
        ...audit,
      });
      await repositories.assessments.create({
        id: testIds.assessment,
        userId: testIds.userA,
        courseId: testIds.course,
        title: "Synthetic assessment",
        assessmentType: "ASSIGNMENT",
        releaseAt: null,
        dueAt: new Date("2026-09-20T20:00:00.000Z"),
        preferredCompletionAt: new Date("2026-09-19T20:00:00.000Z"),
        gradeWeight: null,
        gradeReceived: null,
        notes: null,
        instructionsUrl: null,
        submissionUrl: null,
        submissionStatus: "NOT_SUBMITTED",
        submittedAt: null,
        archivedAt: null,
        ...provenance,
        ...audit,
      });
      await repositories.recurringWorkRules.create({
        id: testIds.rule,
        userId: testIds.userA,
        courseId: testIds.course,
        anchorCourseMeetingId: testIds.meeting,
        titleTemplate: "Review synthetic lecture",
        descriptionTemplate: null,
        recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
        anchorTimeLocal: "10:45:00",
        timezone: "America/Toronto",
        effectiveFrom: "2026-09-08",
        effectiveUntil: "2026-12-18",
        availableOffsetMinutes: 0,
        dueOffsetMinutes: 600,
        originalEstimatedMinutes: 30,
        energyRequirement: "MEDIUM",
        locationRequirements: ["desk"],
        minimumSessionMinutes: 15,
        preferredSessionMinutes: 30,
        maximumSessionMinutes: 30,
        splittable: false,
        interruptible: true,
        planningMode: "AUTO",
        active: true,
        ...audit,
      });

      await repositories.tasks.create(taskRecord(testIds.parent, null, "Synthetic parent"));
      await repositories.tasks.create(
        taskRecord(testIds.childA, testIds.parent, "Synthetic solve"),
      );
      await repositories.tasks.create(
        taskRecord(testIds.childB, testIds.parent, "Synthetic polish"),
      );
      await repositories.taskDependencies.add({
        userId: testIds.userA,
        prerequisiteTaskId: testIds.childA,
        dependentTaskId: testIds.childB,
        dependencyType: "FINISH_TO_START",
        createdAt: audit.createdAt,
      });

      assert.equal(
        (await repositories.tasks.listSubtasks(testIds.userA, testIds.parent)).length,
        2,
      );
      assert.equal(
        (await repositories.taskDependencies.listForTask(testIds.userA, testIds.childA)).length,
        1,
      );
      assert.equal(await repositories.tasks.getForUser(testIds.userB, testIds.childA), null);

      const updatedTask = await repositories.tasks.update(testIds.userA, testIds.childA, {
        title: "Updated synthetic solve",
        remainingMinutes: 45,
      });
      assert.equal(updatedTask.remainingMinutes, 45);
      assert.equal(
        (
          await repositories.tasks.archive(testIds.userA, testIds.childA, audit.updatedAt)
        ).archivedAt?.toISOString(),
        audit.updatedAt.toISOString(),
      );
      assert.equal(
        (
          await repositories.courses.archive(testIds.userA, testIds.course, audit.updatedAt)
        ).archivedAt?.toISOString(),
        audit.updatedAt.toISOString(),
      );

      await repositories.availabilityRules.create({
        id: testIds.availability,
        userId: testIds.userA,
        recurrenceRule: "FREQ=WEEKLY;BYDAY=TU",
        startTimeLocal: "18:00:00",
        endTimeLocal: "20:00:00",
        spansNextDay: false,
        timezone: "America/Toronto",
        capacityFactor: 1,
        energyLevel: "MEDIUM",
        allowedLocationTags: ["home"],
        effectiveFrom: "2026-09-08",
        effectiveUntil: "2026-12-18",
        active: true,
        ...audit,
      });
      await repositories.protectedTimeRules.create({
        id: testIds.protectedTime,
        userId: testIds.userA,
        recurrenceRule: "FREQ=DAILY",
        startTimeLocal: "23:00:00",
        endTimeLocal: "07:00:00",
        spansNextDay: true,
        timezone: "America/Toronto",
        protectionLevel: "HARD",
        reason: "Synthetic sleep",
        effectiveFrom: "2026-09-08",
        effectiveUntil: "2026-12-18",
        active: true,
        ...audit,
      });
      await repositories.planningPreferences.upsert({
        id: testIds.preference,
        userId: testIds.userA,
        preferredDailyStudyLimitMinutes: 240,
        minimumFreeTimeMinutes: 90,
        preferredDeadlineBufferHours: 12,
        avoidLateHighEnergyTasks: true,
        maximumConsecutiveWorkMinutes: 90,
        minimumBreakMinutes: 15,
        scheduleCommuteWork: false,
        weekendWorkBias: 0,
        planStabilityWindowMinutes: 60,
        ...audit,
      });
      await repositories.plannerRuns.create({
        id: testIds.plannerRun,
        userId: testIds.userA,
        startedAt: new Date("2026-09-15T12:00:00.000Z"),
        completedAt: new Date("2026-09-15T12:00:01.000Z"),
        triggerType: "MANUAL",
        triggerEntityType: null,
        triggerEntityId: null,
        planningHorizonStart: new Date("2026-09-15T12:00:00.000Z"),
        planningHorizonEnd: new Date("2026-09-22T12:00:00.000Z"),
        plannerVersion: "repository-test-only",
        inputSnapshot: { mode: "test", taskIds: [testIds.childA] },
        summary: { sessions: 1 },
        warnings: [],
        status: "SUCCEEDED",
      });
      assert.deepEqual(
        (await repositories.plannerRuns.getForUser(testIds.userA, testIds.plannerRun))
          ?.inputSnapshot,
        { mode: "test", taskIds: [testIds.childA] },
      );

      await repositories.workSessions.create({
        id: testIds.replacementSession,
        userId: testIds.userA,
        taskId: testIds.childA,
        plannerRunId: testIds.plannerRun,
        startAt: new Date("2026-09-16T15:00:00.000Z"),
        endAt: new Date("2026-09-16T15:30:00.000Z"),
        plannedMinutes: 30,
        state: "PLANNED",
        generatedBy: "PLANNER",
        locked: false,
        supersededById: null,
        ...audit,
      });
      await repositories.workSessions.create({
        id: testIds.originalSession,
        userId: testIds.userA,
        taskId: testIds.childA,
        plannerRunId: testIds.plannerRun,
        startAt: new Date("2026-09-16T14:00:00.000Z"),
        endAt: new Date("2026-09-16T14:30:00.000Z"),
        plannedMinutes: 30,
        state: "PLANNED",
        generatedBy: "PLANNER",
        locked: true,
        supersededById: null,
        ...audit,
      });
      const superseded = await repositories.workSessions.supersede(
        testIds.userA,
        testIds.originalSession,
        testIds.replacementSession,
      );
      assert.equal(superseded.state, "SUPERSEDED");
      assert.equal(superseded.supersededById, testIds.replacementSession);

      await repositories.completionRecords.create({
        id: testIds.completion,
        userId: testIds.userA,
        taskId: testIds.childA,
        workSessionId: testIds.replacementSession,
        outcome: "PARTIAL",
        actualMinutes: 25,
        remainingAfterMinutes: 20,
        recordedAt: new Date("2026-09-16T15:25:00.000Z"),
        note: "Synthetic repository test",
      });
      await repositories.estimateProfiles.upsert({
        id: testIds.estimate,
        userId: testIds.userA,
        contextType: "TASK_TYPE",
        contextKey: "repository-test",
        sampleCount: 1,
        meanRatio: 1.1,
        medianRatio: 1.1,
        recentRatio: 1.1,
        confidence: 0.1,
        modelVersion: "repository-test",
        ...audit,
      });
      await repositories.integrationAccounts.create({
        id: testIds.integration,
        userId: testIds.userA,
        provider: "repository-mock",
        externalAccountId: "repository-account",
        displayName: "Synthetic repository integration",
        status: "DISCONNECTED",
        credentialReference: null,
        lastSyncAt: null,
        lastSuccessAt: null,
        disconnectedAt: audit.updatedAt,
        ...audit,
      });
      await repositories.calendarEvents.create({
        id: testIds.calendarEvent,
        userId: testIds.userA,
        courseId: testIds.course,
        integrationAccountId: testIds.integration,
        title: "Synthetic repository event",
        eventType: "TEST",
        startAt: new Date("2026-09-17T18:00:00.000Z"),
        endAt: new Date("2026-09-17T19:00:00.000Z"),
        location: null,
        constraintLevel: "HARD",
        externalId: "repository-event",
        externalUpdatedAt: audit.updatedAt,
        archivedAt: null,
        source: "INTEGRATION",
        sourceAuthority: "EXTERNAL",
        sourceConfidence: "DIRECT_API",
        ...audit,
      });
      assert.equal(
        (
          await repositories.calendarEvents.getForUser(testIds.userA, testIds.calendarEvent)
        )?.startAt.toISOString(),
        "2026-09-17T18:00:00.000Z",
      );
      await repositories.externalObjectMaps.create({
        id: testIds.externalMap,
        userId: testIds.userA,
        integrationAccountId: testIds.integration,
        provider: "repository-mock",
        externalId: "repository-event",
        internalType: "CALENDAR_EVENT",
        internalId: testIds.calendarEvent,
        externalUpdatedAt: audit.updatedAt,
        lastSyncedAt: audit.updatedAt,
        sourceHash: "repository-test-hash",
        ...audit,
      });
      await repositories.inboxItems.create({
        id: testIds.inbox,
        userId: testIds.userA,
        rawText: "Synthetic repository inbox item",
        status: "ACTIVE",
        proposedEntityType: "TASK",
        proposedPayload: { title: "Synthetic proposal", dueAt: null },
        processedAt: null,
        ...provenance,
        ...audit,
      });
      assert.deepEqual(
        (await repositories.inboxItems.getForUser(testIds.userA, testIds.inbox))?.proposedPayload,
        { title: "Synthetic proposal", dueAt: null },
      );

      assert.equal(
        (await repositories.academicTerms.getForUser(testIds.userA, testIds.term))?.startDate,
        "2026-09-08",
      );
      throw forcedFailure;
    }),
    forcedFailure,
  );

  assert.equal(await database.repositories.users.getById(testIds.userA), null);
  assert.equal(await database.repositories.users.getById(testIds.userB), null);
});

test("duplicate external identity surfaces structured constraint details", async () => {
  let thrown;
  try {
    await database.transaction(async ({ repositories }) => {
      await repositories.externalObjectMaps.create({
        id: "repository-test-duplicate-external-map",
        userId: seededUserId,
        integrationAccountId: "seed-integration-mock-calendar-disconnected",
        provider: "mock-calendar",
        externalId: "mock-event-2026-10-01-001",
        internalType: "TASK",
        internalId: "seed-task-civ100-review",
        externalUpdatedAt: null,
        lastSyncedAt: null,
        sourceHash: null,
        ...audit,
      });
    });
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown, "duplicate external identity must fail");
  assert.deepEqual(getDatabaseErrorDetails(thrown), {
    kind: "UNIQUE_CONSTRAINT",
    code: "P2002",
    fields: ["integrationAccountId", "externalId"],
    constraint: "ExternalObjectMap_integrationAccountId_externalId_key",
  });
});
