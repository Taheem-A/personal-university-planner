import type { Prisma } from "@prisma/client";
import type { DatabaseExecutor } from "../internal.js";
import { toPersistenceData, toPlainRecord } from "../mapping.js";
import type {
  CompletionRecordRecord,
  EstimateProfileRecord,
  PlannerRunRecord,
  WorkSessionRecord,
} from "../records.js";
import type {
  CompletionRecordRepository,
  EstimateProfileRepository,
  PlannerRunRepository,
  WorkSessionRepository,
} from "./types.js";

export function createHistoryRepositories(db: DatabaseExecutor): {
  workSessions: WorkSessionRepository;
  completionRecords: CompletionRecordRepository;
  estimateProfiles: EstimateProfileRepository;
  plannerRuns: PlannerRunRepository;
} {
  return {
    workSessions: {
      async create(record) {
        const row = await db.workSession.create({
          data: toPersistenceData(record) as unknown as Prisma.WorkSessionUncheckedCreateInput,
        });
        return toPlainRecord<WorkSessionRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.workSession.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<WorkSessionRecord>(row) : null;
      },
      async listForRange(userId, startAt, endAt) {
        const rows = await db.workSession.findMany({
          where: { userId, startAt: { lt: endAt }, endAt: { gt: startAt } },
          orderBy: [{ startAt: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<WorkSessionRecord>(row));
      },
      async updateState(userId, id, state) {
        const row = await db.workSession.update({
          where: { id_userId: { id, userId } },
          data: { state },
        });
        return toPlainRecord<WorkSessionRecord>(row);
      },
      async supersede(userId, id, supersededById) {
        const row = await db.workSession.update({
          where: { id_userId: { id, userId } },
          data: { state: "SUPERSEDED", supersededById },
        });
        return toPlainRecord<WorkSessionRecord>(row);
      },
    },
    completionRecords: {
      async create(record) {
        const row = await db.completionRecord.create({
          data: toPersistenceData(record) as unknown as Prisma.CompletionRecordUncheckedCreateInput,
        });
        return toPlainRecord<CompletionRecordRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.completionRecord.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<CompletionRecordRecord>(row) : null;
      },
      async listForTask(userId, taskId) {
        const rows = await db.completionRecord.findMany({
          where: { userId, taskId },
          orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<CompletionRecordRecord>(row));
      },
    },
    estimateProfiles: {
      async getForContext(userId, contextType, contextKey) {
        const row = await db.estimateProfile.findUnique({
          where: { userId_contextType_contextKey: { userId, contextType, contextKey } },
        });
        return row ? toPlainRecord<EstimateProfileRecord>(row) : null;
      },
      async upsert(record) {
        const data = toPersistenceData(record);
        const row = await db.estimateProfile.upsert({
          where: {
            userId_contextType_contextKey: {
              userId: record.userId,
              contextType: record.contextType,
              contextKey: record.contextKey,
            },
          },
          create: data as unknown as Prisma.EstimateProfileUncheckedCreateInput,
          update: data as Prisma.EstimateProfileUncheckedUpdateInput,
        });
        return toPlainRecord<EstimateProfileRecord>(row);
      },
    },
    plannerRuns: {
      async create(record) {
        const row = await db.plannerRun.create({
          data: toPersistenceData(record) as unknown as Prisma.PlannerRunUncheckedCreateInput,
        });
        return toPlainRecord<PlannerRunRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.plannerRun.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<PlannerRunRecord>(row) : null;
      },
      async listRecent(userId, limit) {
        if (!Number.isInteger(limit) || limit <= 0) throw new RangeError("limit must be positive");
        const rows = await db.plannerRun.findMany({
          where: { userId },
          orderBy: [{ startedAt: "desc" }, { id: "asc" }],
          take: limit,
        });
        return rows.map((row) => toPlainRecord<PlannerRunRecord>(row));
      },
      async updateStatus(userId, id, status, completedAt) {
        const row = await db.plannerRun.update({
          where: { id_userId: { id, userId } },
          data: { status, completedAt },
        });
        return toPlainRecord<PlannerRunRecord>(row);
      },
    },
  };
}
