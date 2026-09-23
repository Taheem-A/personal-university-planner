import type { Prisma } from "@prisma/client";
import type { DatabaseExecutor } from "../internal.js";
import { toPersistenceData, toPlainRecord } from "../mapping.js";
import type {
  PlanningPreferenceRecord,
  RecurringWorkRuleRecord,
  TaskDependencyRecord,
  TaskRecord,
} from "../records.js";
import type {
  PlanningPreferenceRepository,
  RecurringWorkRuleRepository,
  TaskDependencyRepository,
  TaskRepository,
} from "./types.js";

export function createPlanningRepositories(db: DatabaseExecutor): {
  tasks: TaskRepository;
  taskDependencies: TaskDependencyRepository;
  recurringWorkRules: RecurringWorkRuleRepository;
  planningPreferences: PlanningPreferenceRepository;
} {
  return {
    tasks: {
      async create(record) {
        const row = await db.task.create({
          data: toPersistenceData(record) as unknown as Prisma.TaskUncheckedCreateInput,
        });
        return toPlainRecord<TaskRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.task.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<TaskRecord>(row) : null;
      },
      async listForUser(userId, statuses) {
        const rows = await db.task.findMany({
          where: { userId, ...(statuses ? { status: { in: statuses } } : {}) },
          orderBy: [{ dueAt: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<TaskRecord>(row));
      },
      async listSubtasks(userId, parentTaskId) {
        const rows = await db.task.findMany({
          where: { userId, parentTaskId },
          orderBy: { id: "asc" },
        });
        return rows.map((row) => toPlainRecord<TaskRecord>(row));
      },
      async update(userId, id, patch) {
        const row = await db.task.update({
          where: { id_userId: { id, userId } },
          data: {
            ...toPersistenceData(patch),
            version: { increment: 1 },
          } as Prisma.TaskUncheckedUpdateInput,
        });
        return toPlainRecord<TaskRecord>(row);
      },
      async updateIfCurrent(userId, id, expectedVersion, patch) {
        const rows = await db.task.updateManyAndReturn({
          where: { id, userId, version: expectedVersion },
          data: {
            ...toPersistenceData(patch),
            version: { increment: 1 },
          } as Prisma.TaskUncheckedUpdateManyInput,
        });
        if (rows[0]) return { status: "UPDATED", record: toPlainRecord<TaskRecord>(rows[0]) };
        const existing = await db.task.findFirst({ where: { id, userId } });
        return { status: existing ? "STALE" : "NOT_FOUND" };
      },
      async archive(userId, id, archivedAt) {
        const row = await db.task.update({
          where: { id_userId: { id, userId } },
          data: { archivedAt, version: { increment: 1 } },
        });
        return toPlainRecord<TaskRecord>(row);
      },
    },
    taskDependencies: {
      async add(record) {
        const row = await db.taskDependency.create({
          data: toPersistenceData(record) as unknown as Prisma.TaskDependencyUncheckedCreateInput,
        });
        return toPlainRecord<TaskDependencyRecord>(row);
      },
      async listForTask(userId, taskId) {
        const rows = await db.taskDependency.findMany({
          where: {
            userId,
            OR: [{ prerequisiteTaskId: taskId }, { dependentTaskId: taskId }],
          },
          orderBy: [{ prerequisiteTaskId: "asc" }, { dependentTaskId: "asc" }],
        });
        return rows.map((row) => toPlainRecord<TaskDependencyRecord>(row));
      },
      async listForUser(userId) {
        const rows = await db.taskDependency.findMany({
          where: { userId },
          orderBy: [{ prerequisiteTaskId: "asc" }, { dependentTaskId: "asc" }],
        });
        return rows.map((row) => toPlainRecord<TaskDependencyRecord>(row));
      },
      async remove(userId, prerequisiteTaskId, dependentTaskId) {
        await db.taskDependency.delete({
          where: {
            userId_prerequisiteTaskId_dependentTaskId: {
              userId,
              prerequisiteTaskId,
              dependentTaskId,
            },
          },
        });
      },
    },
    recurringWorkRules: {
      async create(record) {
        const row = await db.recurringWorkRule.create({
          data: toPersistenceData(
            record,
          ) as unknown as Prisma.RecurringWorkRuleUncheckedCreateInput,
        });
        return toPlainRecord<RecurringWorkRuleRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.recurringWorkRule.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<RecurringWorkRuleRecord>(row) : null;
      },
      async listForCourse(userId, courseId) {
        const rows = await db.recurringWorkRule.findMany({
          where: { userId, courseId },
          orderBy: [{ effectiveFrom: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<RecurringWorkRuleRecord>(row));
      },
      async setActive(userId, id, active) {
        const row = await db.recurringWorkRule.update({
          where: { id_userId: { id, userId } },
          data: { active },
        });
        return toPlainRecord<RecurringWorkRuleRecord>(row);
      },
    },
    planningPreferences: {
      async create(record) {
        const row = await db.planningPreference.create({
          data: toPersistenceData(
            record,
          ) as unknown as Prisma.PlanningPreferenceUncheckedCreateInput,
        });
        return toPlainRecord<PlanningPreferenceRecord>(row);
      },
      async getForUser(userId) {
        const row = await db.planningPreference.findUnique({ where: { userId } });
        return row ? toPlainRecord<PlanningPreferenceRecord>(row) : null;
      },
      async upsert(record) {
        const data = toPersistenceData(record);
        const row = await db.planningPreference.upsert({
          where: { userId: record.userId },
          create: data as unknown as Prisma.PlanningPreferenceUncheckedCreateInput,
          update: data as Prisma.PlanningPreferenceUncheckedUpdateInput,
        });
        return toPlainRecord<PlanningPreferenceRecord>(row);
      },
      async updateIfCurrent(userId, version, patch) {
        const rows = await db.planningPreference.updateManyAndReturn({
          where: { userId, version },
          data: {
            ...toPersistenceData(patch),
            version: { increment: 1 },
          } as Prisma.PlanningPreferenceUncheckedUpdateManyInput,
        });
        if (rows[0])
          return { status: "UPDATED", record: toPlainRecord<PlanningPreferenceRecord>(rows[0]) };
        return {
          status: (await db.planningPreference.findUnique({ where: { userId } }))
            ? "STALE"
            : "NOT_FOUND",
        };
      },
    },
  };
}
