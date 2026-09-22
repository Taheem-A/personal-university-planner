import { syntheticSemester } from "./synthetic-semester.mjs";
import { assertSafeSeedTarget, createSeedClient, getSeedDatabaseUrl } from "./seed-support.mjs";

function withoutId(row) {
  const values = { ...row };
  delete values.id;
  return values;
}

async function upsertById(model, row) {
  return model.upsert({
    where: { id: row.id },
    update: withoutId(row),
    create: row,
  });
}

export async function seedSyntheticSemester(prisma) {
  const fixture = syntheticSemester;

  await prisma.$transaction(
    async (tx) => {
      await upsertById(tx.user, fixture.user);
      await upsertById(tx.academicTerm, fixture.academicTerm);

      for (const row of fixture.courses) await upsertById(tx.course, row);
      for (const row of fixture.courseMeetings) await upsertById(tx.courseMeeting, row);
      for (const row of fixture.assessments) await upsertById(tx.assessment, row);
      for (const row of fixture.recurringWorkRules) await upsertById(tx.recurringWorkRule, row);
      for (const row of fixture.tasks) await upsertById(tx.task, row);

      for (const row of fixture.taskDependencies) {
        const key = {
          userId: row.userId,
          prerequisiteTaskId: row.prerequisiteTaskId,
          dependentTaskId: row.dependentTaskId,
        };
        await tx.taskDependency.upsert({
          where: { userId_prerequisiteTaskId_dependentTaskId: key },
          update: {
            dependencyType: row.dependencyType,
            createdAt: row.createdAt,
          },
          create: row,
        });
      }

      await upsertById(tx.integrationAccount, fixture.integrationAccount);
      for (const row of fixture.calendarEvents) await upsertById(tx.calendarEvent, row);
      for (const row of fixture.availabilityRules) await upsertById(tx.availabilityRule, row);
      for (const row of fixture.protectedTimeRules) await upsertById(tx.protectedTimeRule, row);
      await upsertById(tx.planningPreference, fixture.planningPreference);

      for (const row of fixture.workSessions) await upsertById(tx.workSession, row);
      await upsertById(tx.completionRecord, fixture.completionRecord);
      await upsertById(tx.estimateProfile, fixture.estimateProfile);
      await upsertById(tx.externalObjectMap, fixture.externalObjectMap);
      await upsertById(tx.inboxItem, fixture.inboxItem);
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

async function main() {
  const databaseUrl = getSeedDatabaseUrl();
  const { databaseName } = assertSafeSeedTarget(databaseUrl);
  const prisma = createSeedClient(databaseUrl);

  try {
    await seedSyntheticSemester(prisma);
    console.log(
      `Deterministic synthetic Fall 2026 engineering semester seeded into '${databaseName}'.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
