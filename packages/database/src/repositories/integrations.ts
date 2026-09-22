import type { Prisma } from "@prisma/client";
import type { DatabaseExecutor } from "../internal.js";
import { toPersistenceData, toPlainRecord } from "../mapping.js";
import type {
  ExternalObjectMapRecord,
  InboxItemRecord,
  IntegrationAccountRecord,
} from "../records.js";
import type {
  ExternalObjectMapRepository,
  InboxItemRepository,
  IntegrationAccountRepository,
} from "./types.js";

export function createIntegrationRepositories(db: DatabaseExecutor): {
  integrationAccounts: IntegrationAccountRepository;
  externalObjectMaps: ExternalObjectMapRepository;
  inboxItems: InboxItemRepository;
} {
  return {
    integrationAccounts: {
      async create(record) {
        const row = await db.integrationAccount.create({
          data: toPersistenceData(
            record,
          ) as unknown as Prisma.IntegrationAccountUncheckedCreateInput,
        });
        return toPlainRecord<IntegrationAccountRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.integrationAccount.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<IntegrationAccountRecord>(row) : null;
      },
      async listForUser(userId) {
        const rows = await db.integrationAccount.findMany({
          where: { userId },
          orderBy: [{ provider: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<IntegrationAccountRecord>(row));
      },
      async updateStatus(userId, id, status, disconnectedAt) {
        const row = await db.integrationAccount.update({
          where: { id_userId: { id, userId } },
          data: { status, disconnectedAt },
        });
        return toPlainRecord<IntegrationAccountRecord>(row);
      },
    },
    externalObjectMaps: {
      async create(record) {
        const row = await db.externalObjectMap.create({
          data: toPersistenceData(
            record,
          ) as unknown as Prisma.ExternalObjectMapUncheckedCreateInput,
        });
        return toPlainRecord<ExternalObjectMapRecord>(row);
      },
      async getForExternalIdentity(userId, provider, externalId) {
        const row = await db.externalObjectMap.findUnique({
          where: { userId_provider_externalId: { userId, provider, externalId } },
        });
        return row ? toPlainRecord<ExternalObjectMapRecord>(row) : null;
      },
      async listForInternalObject(userId, internalType, internalId) {
        const rows = await db.externalObjectMap.findMany({
          where: { userId, internalType, internalId },
          orderBy: [{ provider: "asc" }, { externalId: "asc" }],
        });
        return rows.map((row) => toPlainRecord<ExternalObjectMapRecord>(row));
      },
    },
    inboxItems: {
      async create(record) {
        const row = await db.inboxItem.create({
          data: toPersistenceData(record) as unknown as Prisma.InboxItemUncheckedCreateInput,
        });
        return toPlainRecord<InboxItemRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.inboxItem.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<InboxItemRecord>(row) : null;
      },
      async listByStatus(userId, status) {
        const rows = await db.inboxItem.findMany({
          where: { userId, status },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<InboxItemRecord>(row));
      },
      async updateStatus(userId, id, status, processedAt) {
        const row = await db.inboxItem.update({
          where: { id, userId },
          data: { status, processedAt, version: { increment: 1 } },
        });
        return toPlainRecord<InboxItemRecord>(row);
      },
      async updateIfCurrent(userId, id, version, patch) {
        const rows = await db.inboxItem.updateManyAndReturn({
          where: { id, userId, version },
          data: {
            ...toPersistenceData(patch),
            version: { increment: 1 },
          } as Prisma.InboxItemUncheckedUpdateManyInput,
        });
        if (rows[0]) return { status: "UPDATED", record: toPlainRecord<InboxItemRecord>(rows[0]) };
        return {
          status: (await db.inboxItem.findFirst({ where: { id, userId } })) ? "STALE" : "NOT_FOUND",
        };
      },
    },
  };
}
