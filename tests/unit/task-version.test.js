import assert from "node:assert/strict";
import test from "node:test";
import { createPlanningRepositories } from "../../packages/database/dist/repositories/planning.js";

test("conditional task update rejects stale and cross-user writes", async () => {
  const row = { id: "task", userId: "owner", version: 0, title: "Original", updatedAt: new Date() };
  const db = {
    task: {
      async updateManyAndReturn({ where, data }) {
        if (where.id !== row.id || where.userId !== row.userId || where.version !== row.version)
          return [];
        row.title = data.title;
        row.version += data.version.increment;
        return [{ ...row }];
      },
      async findFirst({ where }) {
        return where.userId === row.userId && where.id === row.id ? row : null;
      },
    },
  };
  const repo = createPlanningRepositories(db).tasks;
  assert.equal(
    (await repo.updateIfCurrent("owner", "task", 0, { title: "New" })).status,
    "UPDATED",
  );
  assert.equal(row.version, 1);
  assert.equal(
    (await repo.updateIfCurrent("owner", "task", 0, { title: "Stale" })).status,
    "STALE",
  );
  assert.equal(
    (await repo.updateIfCurrent("intruder", "task", 1, { title: "Attack" })).status,
    "NOT_FOUND",
  );
  assert.equal(row.title, "New");
  assert.equal(
    (await repo.updateIfCurrent("owner", "task", 1, { title: "Fresh" })).status,
    "UPDATED",
  );
  assert.equal(row.version, 2);
});
