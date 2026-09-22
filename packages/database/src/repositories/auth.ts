import type { DatabaseExecutor } from "../internal.js";
import { getDatabaseErrorDetails } from "../errors.js";
import { toPlainRecord } from "../mapping.js";
import type { UserRecord } from "../records.js";
import type { AuthIdentityRepository } from "./types.js";

/** Only stable provider subject IDs are retained; no email or OAuth tokens. */
export function createAuthIdentityRepository(db: DatabaseExecutor): AuthIdentityRepository {
  async function findUser(provider: string, providerAccountId: string): Promise<UserRecord | null> {
    const identity = await db.authIdentity.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });
    return identity ? toPlainRecord<UserRecord>(identity.user) : null;
  }

  return {
    findUser,
    async provisionUser(provider, providerAccountId) {
      const existing = await findUser(provider, providerAccountId);
      if (existing) return existing;
      try {
        // The nested create and unique subject constraint form one atomic write.
        // A losing concurrent callback rolls back its newly created User.
        const identity = await db.authIdentity.create({
          data: {
            provider,
            providerAccountId,
            user: { create: { timezone: "America/Toronto" } },
          },
          include: { user: true },
        });
        return toPlainRecord<UserRecord>(identity.user);
      } catch (error) {
        if (getDatabaseErrorDetails(error)?.kind !== "UNIQUE_CONSTRAINT") throw error;
        const winner = await findUser(provider, providerAccountId);
        if (winner) return winner;
        throw error;
      }
    },
  };
}
