import assert from "node:assert/strict";
import test from "node:test";
import { createAuthIdentityRepository } from "../../packages/database/dist/repositories/auth.js";

function fakeDatabase() {
  const identities = new Map();
  const users = new Map();
  let next = 0;
  const key = (provider, id) => `${provider}:${id}`;
  return {
    users,
    authIdentity: {
      async findUnique({ where }) {
        return (
          identities.get(
            key(
              where.provider_providerAccountId.provider,
              where.provider_providerAccountId.providerAccountId,
            ),
          ) ?? null
        );
      },
      async create({ data }) {
        const subject = key(data.provider, data.providerAccountId);
        if (identities.has(subject))
          throw { code: "P2002", meta: { target: ["provider", "providerAccountId"] } };
        const user = {
          id: `user-${++next}`,
          name: null,
          timezone: data.user.create.timezone,
          defaultDayStart: null,
          defaultDayEnd: null,
          locale: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        users.set(user.id, user);
        const identity = {
          user,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
        };
        identities.set(subject, identity);
        return identity;
      },
    },
  };
}

test("repeat and concurrent identity provisioning produce one canonical user", async () => {
  const db = fakeDatabase();
  const identities = createAuthIdentityRepository(db);
  const [first, second] = await Promise.all([
    identities.provisionUser("google", "subject-1"),
    identities.provisionUser("google", "subject-1"),
  ]);
  assert.equal(first.id, second.id);
  assert.equal(first.timezone, "America/Toronto");
  assert.equal(db.users.size, 1);
  assert.equal((await identities.provisionUser("google", "subject-1")).id, first.id);
  const other = await identities.provisionUser("google", "subject-2");
  assert.notEqual(other.id, first.id);
  assert.equal(db.users.size, 2);
});

test("unexpected unique errors are never treated as a successful provision", async () => {
  const db = fakeDatabase();
  db.authIdentity.create = async () => {
    throw { code: "P2002" };
  };
  await assert.rejects(
    createAuthIdentityRepository(db).provisionUser("google", "absent"),
    (error) => error.code === "P2002",
  );
  assert.equal(db.users.size, 0);
});
