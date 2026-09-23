import type { Prisma } from "@prisma/client";
import type { DatabaseExecutor } from "../internal.js";
import { toPersistenceData, toPlainRecord } from "../mapping.js";
import type {
  AvailabilityRuleRecord,
  CalendarEventRecord,
  ProtectedTimeRuleRecord,
} from "../records.js";
import type {
  AvailabilityRuleRepository,
  CalendarEventRepository,
  ProtectedTimeRuleRepository,
} from "./types.js";

export function createCalendarRepositories(db: DatabaseExecutor): {
  calendarEvents: CalendarEventRepository;
  availabilityRules: AvailabilityRuleRepository;
  protectedTimeRules: ProtectedTimeRuleRepository;
} {
  return {
    calendarEvents: {
      async create(record) {
        const row = await db.calendarEvent.create({
          data: toPersistenceData(record) as unknown as Prisma.CalendarEventUncheckedCreateInput,
        });
        return toPlainRecord<CalendarEventRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.calendarEvent.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<CalendarEventRecord>(row) : null;
      },
      async listForRange(userId, startAt, endAt) {
        const rows = await db.calendarEvent.findMany({
          where: { userId, startAt: { lt: endAt }, endAt: { gt: startAt } },
          orderBy: [{ startAt: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<CalendarEventRecord>(row));
      },
      async archive(userId, id, archivedAt) {
        const row = await db.calendarEvent.update({
          where: { id, userId },
          data: { archivedAt, version: { increment: 1 } },
        });
        return toPlainRecord<CalendarEventRecord>(row);
      },
      async updateIfCurrent(userId, id, version, patch) {
        const rows = await db.calendarEvent.updateManyAndReturn({
          where: { id, userId, version },
          data: {
            ...toPersistenceData(patch),
            version: { increment: 1 },
          } as Prisma.CalendarEventUncheckedUpdateManyInput,
        });
        if (rows[0])
          return { status: "UPDATED", record: toPlainRecord<CalendarEventRecord>(rows[0]) };
        return {
          status: (await db.calendarEvent.findFirst({ where: { id, userId } }))
            ? "STALE"
            : "NOT_FOUND",
        };
      },
    },
    availabilityRules: {
      async create(record) {
        const row = await db.availabilityRule.create({
          data: toPersistenceData(record) as unknown as Prisma.AvailabilityRuleUncheckedCreateInput,
        });
        return toPlainRecord<AvailabilityRuleRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.availabilityRule.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<AvailabilityRuleRecord>(row) : null;
      },
      async listActive(userId) {
        const rows = await db.availabilityRule.findMany({
          where: { userId, active: true },
          orderBy: [{ effectiveFrom: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<AvailabilityRuleRecord>(row));
      },
      async setActive(userId, id, active) {
        const row = await db.availabilityRule.update({
          where: { id, userId },
          data: { active, version: { increment: 1 } },
        });
        return toPlainRecord<AvailabilityRuleRecord>(row);
      },
      async updateIfCurrent(userId, id, version, patch) {
        const rows = await db.availabilityRule.updateManyAndReturn({
          where: { id, userId, version },
          data: {
            ...toPersistenceData(patch),
            version: { increment: 1 },
          } as Prisma.AvailabilityRuleUncheckedUpdateManyInput,
        });
        if (rows[0])
          return { status: "UPDATED", record: toPlainRecord<AvailabilityRuleRecord>(rows[0]) };
        return {
          status: (await db.availabilityRule.findFirst({ where: { id, userId } }))
            ? "STALE"
            : "NOT_FOUND",
        };
      },
    },
    protectedTimeRules: {
      async create(record) {
        const row = await db.protectedTimeRule.create({
          data: toPersistenceData(
            record,
          ) as unknown as Prisma.ProtectedTimeRuleUncheckedCreateInput,
        });
        return toPlainRecord<ProtectedTimeRuleRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.protectedTimeRule.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<ProtectedTimeRuleRecord>(row) : null;
      },
      async listActive(userId) {
        const rows = await db.protectedTimeRule.findMany({
          where: { userId, active: true },
          orderBy: [{ effectiveFrom: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<ProtectedTimeRuleRecord>(row));
      },
      async setActive(userId, id, active) {
        const row = await db.protectedTimeRule.update({
          where: { id, userId },
          data: { active, version: { increment: 1 } },
        });
        return toPlainRecord<ProtectedTimeRuleRecord>(row);
      },
      async updateIfCurrent(userId, id, version, patch) {
        const rows = await db.protectedTimeRule.updateManyAndReturn({
          where: { id, userId, version },
          data: {
            ...toPersistenceData(patch),
            version: { increment: 1 },
          } as Prisma.ProtectedTimeRuleUncheckedUpdateManyInput,
        });
        if (rows[0])
          return { status: "UPDATED", record: toPlainRecord<ProtectedTimeRuleRecord>(rows[0]) };
        return {
          status: (await db.protectedTimeRule.findFirst({ where: { id, userId } }))
            ? "STALE"
            : "NOT_FOUND",
        };
      },
    },
  };
}
