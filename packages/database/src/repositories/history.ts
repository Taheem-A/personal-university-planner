import { Prisma } from "@prisma/client";
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

function validateIdempotency(record: PlannerRunRecord): PlannerRunRecord {
  const scope = record.idempotencyScope ?? null;
  const key = record.idempotencyKey ?? null;
  if (
    (scope === null) !== (key === null) ||
    (scope !== null && !scope.trim()) ||
    (key !== null && !key.trim())
  )
    throw new RangeError("PlannerRun idempotency scope and key must be supplied together");
  return { ...record, idempotencyScope: scope, idempotencyKey: key };
}

async function supersedeGeneratedOne(
  db: DatabaseExecutor,
  userId: string,
  id: string,
  replacementId: string | null,
): Promise<WorkSessionRecord> {
  const old = await db.workSession.findFirst({ where: { id, userId } });
  if (
    !old ||
    old.generatedBy !== "PLANNER" ||
    old.locked ||
    (old.state !== "PLANNED" && old.state !== "ACTIVE") ||
    old.supersededById
  )
    throw new Error("Only an active unlocked planner session can be superseded");
  if (replacementId) {
    const replacement = await db.workSession.findFirst({
      where: {
        id: replacementId,
        userId,
        generatedBy: "PLANNER",
        state: { in: ["PLANNED", "ACTIVE"] },
        supersededById: null,
      },
    });
    if (!replacement || replacement.id === id || replacement.taskId !== old.taskId)
      throw new Error("Replacement must be a distinct active planner session for the same task");
  }
  const rows = await db.workSession.updateManyAndReturn({
    where: {
      id,
      userId,
      version: old.version,
      generatedBy: "PLANNER",
      locked: false,
      state: { in: ["PLANNED", "ACTIVE"] },
      supersededById: null,
    },
    data: { state: "SUPERSEDED", supersededById: replacementId, version: { increment: 1 } },
  });
  if (!rows[0]) throw new Error("Session changed before supersession");
  return toPlainRecord<WorkSessionRecord>(rows[0]);
}

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
      async createGeneratedBatch(userId, records) {
        if (records.length === 0) return [];
        if (
          new Set(records.map((record) => record.id)).size !== records.length ||
          records.some(
            (record) =>
              record.userId !== userId ||
              record.generatedBy !== "PLANNER" ||
              record.plannerRunId === null ||
              record.locked ||
              record.state !== "PLANNED" ||
              record.supersededById !== null ||
              record.endAt <= record.startAt ||
              record.plannedMinutes <= 0,
          )
        )
          throw new RangeError("Generated batch contains an invalid planner session");
        const rows = await db.workSession.createManyAndReturn({
          data: records.map(
            (record) => toPersistenceData(record) as unknown as Prisma.WorkSessionCreateManyInput,
          ),
        });
        return rows.map((row) => toPlainRecord<WorkSessionRecord>(row));
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
      async listActiveGenerated(userId, startAt, endAt) {
        const rows = await db.workSession.findMany({
          where: {
            userId,
            generatedBy: "PLANNER",
            state: { in: ["PLANNED", "ACTIVE"] },
            supersededById: null,
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
          orderBy: [{ startAt: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<WorkSessionRecord>(row));
      },
      async listRetainedIntent(userId, startAt, endAt) {
        const rows = await db.workSession.findMany({
          where: {
            userId,
            OR: [{ generatedBy: "USER" }, { locked: true }],
            state: { in: ["PLANNED", "ACTIVE"] },
            supersededById: null,
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
          orderBy: [{ startAt: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<WorkSessionRecord>(row));
      },
      async updateState(userId, id, state) {
        const row = await db.workSession.update({
          where: { id_userId: { id, userId } },
          data: { state, version: { increment: 1 } },
        });
        return toPlainRecord<WorkSessionRecord>(row);
      },
      async supersede(userId, id, supersededById) {
        return supersedeGeneratedOne(db, userId, id, supersededById);
      },
      async supersedeGenerated(userId, changes) {
        if (new Set(changes.map((change) => change.id)).size !== changes.length)
          throw new RangeError("Duplicate supersession ID");
        const result: WorkSessionRecord[] = [];
        for (const change of changes)
          result.push(await supersedeGeneratedOne(db, userId, change.id, change.replacementId));
        return result;
      },
      async updateIfCurrent(userId, id, version, patch) {
        const rows = await db.workSession.updateManyAndReturn({
          where: { id, userId, version },
          data: {
            ...toPersistenceData(patch),
            version: { increment: 1 },
          } as Prisma.WorkSessionUncheckedUpdateManyInput,
        });
        if (rows[0])
          return { status: "UPDATED", record: toPlainRecord<WorkSessionRecord>(rows[0]) };
        return {
          status: (await db.workSession.findFirst({ where: { id, userId } }))
            ? "STALE"
            : "NOT_FOUND",
        };
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
        record = validateIdempotency(record);
        const row = await db.plannerRun.create({
          data: toPersistenceData(record) as unknown as Prisma.PlannerRunUncheckedCreateInput,
        });
        return toPlainRecord<PlannerRunRecord>(row);
      },
      async start(record) {
        record = validateIdempotency(record);
        if (
          record.status !== "RUNNING" ||
          record.completedAt !== null ||
          record.summary !== null ||
          record.warnings !== null
        )
          throw new RangeError("New PlannerRun must start RUNNING without a result");
        if (record.idempotencyKey === null) {
          const row = await db.plannerRun.create({
            data: toPersistenceData(record) as unknown as Prisma.PlannerRunUncheckedCreateInput,
          });
          return { status: "CREATED", record: toPlainRecord<PlannerRunRecord>(row) };
        }
        const inserted = await db.plannerRun.createMany({
          data: [toPersistenceData(record) as unknown as Prisma.PlannerRunCreateManyInput],
          skipDuplicates: true,
        });
        const row = await db.plannerRun.findUnique({
          where: {
            userId_triggerType_idempotencyScope_idempotencyKey: {
              userId: record.userId,
              triggerType: record.triggerType,
              idempotencyScope: record.idempotencyScope!,
              idempotencyKey: record.idempotencyKey,
            },
          },
        });
        if (!row) throw new Error("PlannerRun idempotency identity was not found");
        return {
          status: inserted.count ? "CREATED" : "EXISTING",
          record: toPlainRecord<PlannerRunRecord>(row),
        };
      },
      async getForUser(userId, id) {
        const row = await db.plannerRun.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<PlannerRunRecord>(row) : null;
      },
      async getByIdempotency(userId, trigger, scope, key) {
        const row = await db.plannerRun.findUnique({
          where: {
            userId_triggerType_idempotencyScope_idempotencyKey: {
              userId,
              triggerType: trigger,
              idempotencyScope: scope,
              idempotencyKey: key,
            },
          },
        });
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
      async latestSuccessful(userId) {
        const row = await db.plannerRun.findFirst({
          where: { userId, status: "SUCCEEDED" },
          orderBy: [{ completedAt: "desc" }, { id: "desc" }],
        });
        return row ? toPlainRecord<PlannerRunRecord>(row) : null;
      },
      async complete(userId, id, result) {
        if (result.status !== "SUCCEEDED" && result.status !== "FAILED")
          throw new RangeError("PlannerRun completion must be terminal");
        if (!Number.isFinite(result.completedAt.getTime()))
          throw new RangeError("Invalid completion time");
        const summary =
          result.summary === null
            ? null
            : {
                planStatus: result.summary.planStatus,
                generatedSessionCount: result.summary.generatedSessionCount,
                retainedSessionCount: result.summary.retainedSessionCount,
                unscheduledMinutes: result.summary.unscheduledMinutes,
                risk: result.summary.risk.map((item) => ({ ...item })),
                delta: {
                  retained: [...result.summary.delta.retained],
                  moved: result.summary.delta.moved.map((item) => ({ ...item })),
                  added: [...result.summary.delta.added],
                  removed: [...result.summary.delta.removed],
                  newlyAtRisk: [...result.summary.delta.newlyAtRisk],
                  worsenedRisk: [...result.summary.delta.worsenedRisk],
                  improvedRisk: [...result.summary.delta.improvedRisk],
                  resolvedRisk: [...result.summary.delta.resolvedRisk],
                  unchangedRisk: [...result.summary.delta.unchangedRisk],
                },
              };
        if (
          summary &&
          ((summary.planStatus !== "VALID" && summary.planStatus !== "INFEASIBLE") ||
            [
              summary.generatedSessionCount,
              summary.retainedSessionCount,
              summary.unscheduledMinutes,
            ].some((value) => !Number.isSafeInteger(value) || value < 0))
        )
          throw new RangeError("Invalid PlannerRun summary");
        const warnings =
          result.warnings?.map((warning) => ({
            code: warning.code,
            ...(warning.taskId ? { taskId: warning.taskId } : {}),
            ...(warning.deficitMinutes !== undefined
              ? { deficitMinutes: warning.deficitMinutes }
              : {}),
            reasonCodes: [...warning.reasonCodes],
          })) ?? null;
        if (
          warnings?.some(
            (warning) =>
              !warning.code ||
              warning.reasonCodes.some((code) => !code) ||
              (warning.deficitMinutes !== undefined &&
                (!Number.isSafeInteger(warning.deficitMinutes) || warning.deficitMinutes < 0)),
          )
        )
          throw new RangeError("Invalid PlannerRun warnings");
        const rows = await db.plannerRun.updateManyAndReturn({
          where: { id, userId, status: "RUNNING", completedAt: null },
          data: {
            status: result.status,
            completedAt: result.completedAt,
            summary: summary === null ? Prisma.DbNull : summary,
            warnings: warnings === null ? Prisma.DbNull : warnings,
          },
        });
        if (rows[0]) return { status: "UPDATED", record: toPlainRecord<PlannerRunRecord>(rows[0]) };
        return {
          status: (await db.plannerRun.findFirst({ where: { id, userId } }))
            ? "STALE"
            : "NOT_FOUND",
        };
      },
    },
  };
}
