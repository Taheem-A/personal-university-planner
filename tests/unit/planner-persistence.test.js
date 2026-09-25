const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { createRequire } = Module;
const ts = require("typescript");

function loadRepository(relative) {
  const filename = path.resolve(__dirname, "../../packages/database/src/repositories", relative);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  const localRequire = createRequire(filename);
  loaded.require = (id) =>
    id === "../mapping.js"
      ? { toPersistenceData: (value) => value, toPlainRecord: (value) => value }
      : localRequire(id);
  loaded._compile(compiled, filename);
  return loaded.exports;
}
const { createPlanningStateRepository } = loadRepository("planning-state.ts");
const { createHistoryRepositories } = loadRepository("history.ts");
const d = (value) => new Date(value);
const a = d("2026-09-21T12:00:00Z");
const b = d("2026-09-21T13:00:00Z");

function fakeDatabase() {
  const users = new Map([
    ["u1", { id: "u1", planningRevision: 0 }],
    ["u2", { id: "u2", planningRevision: 0 }],
  ]);
  const runs = new Map();
  const sessions = new Map();
  const matchSession = (row, where) =>
    row.userId === where.userId &&
    (!where.id || row.id === where.id) &&
    ((!where.version && where.version !== 0) || row.version === where.version) &&
    (!where.generatedBy || row.generatedBy === where.generatedBy) &&
    ((!where.locked && where.locked !== false) || row.locked === where.locked) &&
    (!where.state ||
      (where.state.in ? where.state.in.includes(row.state) : row.state === where.state)) &&
    (where.supersededById === undefined || row.supersededById === where.supersededById) &&
    (!where.startAt || row.startAt < where.startAt.lt) &&
    (!where.endAt || row.endAt > where.endAt.gt) &&
    (!where.OR ||
      where.OR.some((item) => Object.entries(item).every(([key, value]) => row[key] === value)));
  const db = {
    user: {
      async updateManyAndReturn({ where }) {
        const row = users.get(where.id);
        if (!row || row.planningRevision !== where.planningRevision) return [];
        row.planningRevision++;
        return [{ ...row }];
      },
      async findUnique({ where }) {
        return users.get(where.id) ?? null;
      },
    },
    plannerRun: {
      async create({ data }) {
        if (runs.has(data.id)) throw new Error("duplicate run id");
        runs.set(data.id, { ...data });
        return runs.get(data.id);
      },
      async createMany({ data }) {
        const row = data[0];
        if (
          [...runs.values()].some(
            (existing) =>
              existing.userId === row.userId &&
              existing.triggerType === row.triggerType &&
              existing.idempotencyScope === row.idempotencyScope &&
              existing.idempotencyKey === row.idempotencyKey,
          )
        )
          return { count: 0 };
        runs.set(row.id, { ...row });
        return { count: 1 };
      },
      async findUnique({ where }) {
        const identity = where.userId_triggerType_idempotencyScope_idempotencyKey;
        return (
          [...runs.values()].find(
            (row) =>
              row.userId === identity.userId &&
              row.triggerType === identity.triggerType &&
              row.idempotencyScope === identity.idempotencyScope &&
              row.idempotencyKey === identity.idempotencyKey,
          ) ?? null
        );
      },
      async findFirst({ where }) {
        if (where.id)
          return runs.get(where.id)?.userId === where.userId ? runs.get(where.id) : null;
        return (
          [...runs.values()]
            .filter((row) => row.userId === where.userId && row.status === where.status)
            .sort((x, y) => y.completedAt - x.completedAt)[0] ?? null
        );
      },
      async findMany({ where, take }) {
        return [...runs.values()]
          .filter((row) => row.userId === where.userId)
          .sort((x, y) => y.startedAt - x.startedAt || x.id.localeCompare(y.id))
          .slice(0, take);
      },
      async updateManyAndReturn({ where, data }) {
        const row = runs.get(where.id);
        if (
          !row ||
          row.userId !== where.userId ||
          row.status !== where.status ||
          row.completedAt !== where.completedAt
        )
          return [];
        Object.assign(row, data);
        return [{ ...row }];
      },
    },
    workSession: {
      async createManyAndReturn({ data }) {
        for (const row of data) if (sessions.has(row.id)) throw new Error("duplicate session");
        for (const row of data) sessions.set(row.id, { ...row });
        return data.map((row) => ({ ...row }));
      },
      async findMany({ where }) {
        return [...sessions.values()].filter((row) => matchSession(row, where));
      },
      async findFirst({ where }) {
        return [...sessions.values()].find((row) => matchSession(row, where)) ?? null;
      },
      async updateManyAndReturn({ where, data }) {
        const row = sessions.get(where.id);
        if (!row || !matchSession(row, where)) return [];
        Object.assign(row, data, { version: row.version + 1 });
        return [{ ...row }];
      },
    },
  };
  const rollback = async (operation) => {
    const copies = [users, runs, sessions].map(
      (map) => new Map([...map].map(([id, row]) => [id, { ...row }])),
    );
    try {
      return await operation();
    } catch (error) {
      [users, runs, sessions].forEach((map, index) => {
        map.clear();
        for (const [id, row] of copies[index]) map.set(id, row);
      });
      throw error;
    }
  };
  return { db, users, runs, sessions, rollback };
}
function run(id, userId = "u1", key = null, scope = null) {
  return {
    id,
    userId,
    startedAt: a,
    completedAt: null,
    triggerType: "MANUAL",
    triggerEntityType: null,
    triggerEntityId: null,
    idempotencyScope: scope,
    idempotencyKey: key,
    planningHorizonStart: a,
    planningHorizonEnd: b,
    plannerVersion: "heuristic-v1",
    inputSnapshot: {},
    summary: null,
    warnings: null,
    status: "RUNNING",
  };
}
function session(id, generatedBy = "PLANNER", locked = false, userId = "u1") {
  return {
    id,
    version: 0,
    userId,
    taskId: "task",
    plannerRunId: "run",
    startAt: a,
    endAt: b,
    plannedMinutes: 60,
    state: "PLANNED",
    generatedBy,
    locked,
    supersededById: null,
  };
}

test("guarded revision claim is per-user and only one expected revision wins", async () => {
  const { db } = fakeDatabase();
  const repository = createPlanningStateRepository(db);
  assert.deepEqual(await repository.claimRevision("u1", 0), { status: "CLAIMED", revision: 1 });
  assert.deepEqual(await repository.claimRevision("u1", 0), { status: "STALE" });
  assert.deepEqual(await repository.claimRevision("u2", 0), { status: "CLAIMED", revision: 1 });
  assert.deepEqual(await repository.claimRevision("missing", 0), { status: "NOT_FOUND" });
});

test("idempotent start, guarded lifecycle, lookup and latest successful run", async () => {
  const { db } = fakeDatabase();
  const repository = createHistoryRepositories(db).plannerRuns;
  const first = run("r1", "u1", "event-1", "provider");
  assert.equal((await repository.start(first)).status, "CREATED");
  assert.equal((await repository.start({ ...first, id: "duplicate" })).status, "EXISTING");
  assert.equal(await repository.getByIdempotency("u2", "MANUAL", "provider", "event-1"), null);
  assert.equal((await repository.start(run("r2", "u2", "event-1", "provider"))).status, "CREATED");
  assert.equal((await repository.start(run("manual-1"))).status, "CREATED");
  assert.equal((await repository.start(run("manual-2"))).status, "CREATED");
  assert.equal(
    (
      await repository.complete("u1", "r1", {
        status: "SUCCEEDED",
        completedAt: b,
        summary: {
          planStatus: "VALID",
          generatedSessionCount: 1,
          retainedSessionCount: 0,
          unscheduledMinutes: 0,
          risk: [],
          sessionReasons: { "session-1": ["AVAILABLE_CAPACITY", "DEADLINE_PRESSURE"] },
          delta: {
            retained: [],
            moved: [],
            added: ["session-1"],
            removed: [],
            newlyAtRisk: [],
            worsenedRisk: [],
            improvedRisk: [],
            resolvedRisk: [],
            unchangedRisk: [],
          },
          secret: "must-not-persist",
        },
        warnings: [
          { code: "LOW_SLACK", reasonCodes: ["LOW_SLACK"], providerPayload: "must-not-persist" },
        ],
      })
    ).status,
    "UPDATED",
  );
  const stored = await repository.getForUser("u1", "r1");
  assert.equal(stored.summary.secret, undefined);
  assert.deepEqual(stored.summary.sessionReasons["session-1"], [
    "AVAILABLE_CAPACITY",
    "DEADLINE_PRESSURE",
  ]);
  assert.equal(stored.warnings[0].providerPayload, undefined);
  assert.equal(
    (
      await repository.complete("u1", "r1", {
        status: "FAILED",
        completedAt: b,
        summary: null,
        warnings: null,
      })
    ).status,
    "STALE",
  );
  assert.equal((await repository.latestSuccessful("u1")).id, "r1");
  assert.equal((await repository.listRecent("u1", 10)).length, 3);
  assert.deepEqual(
    (await repository.listRecent("u1", 10)).map((row) => row.id),
    ["manual-1", "manual-2", "r1"],
  );
  assert.equal((await repository.listRecent("u2", 10)).length, 1);
  assert.equal(
    (
      await repository.complete("u1", "manual-1", {
        status: "FAILED",
        completedAt: b,
        summary: null,
        warnings: null,
      })
    ).status,
    "UPDATED",
  );
});

test("generated batches, intent queries and both supersession forms preserve manual and locked work", async () => {
  const { db, sessions, rollback } = fakeDatabase();
  const repository = createHistoryRepositories(db).workSessions;
  const created = await repository.createGeneratedBatch("u1", [
    session("old"),
    session("replacement"),
    session("vanish"),
  ]);
  assert.equal(created.length, 3);
  sessions.set("manual", session("manual", "USER"));
  sessions.set("locked", session("locked", "PLANNER", true));
  sessions.set("other", session("other", "PLANNER", false, "u2"));
  assert.equal((await repository.listActiveGenerated("u1", a, b)).length, 4);
  assert.deepEqual((await repository.listRetainedIntent("u1", a, b)).map((row) => row.id).sort(), [
    "locked",
    "manual",
  ]);
  const changed = await repository.supersedeGenerated("u1", [
    { id: "old", replacementId: "replacement" },
    { id: "vanish", replacementId: null },
  ]);
  assert.deepEqual(
    changed.map((row) => row.supersededById),
    ["replacement", null],
  );
  assert.equal(sessions.get("old").state, "SUPERSEDED");
  assert.equal(sessions.get("manual").state, "PLANNED");
  await assert.rejects(() => repository.supersede("u1", "manual", null));
  await assert.rejects(() => repository.supersede("u1", "locked", null));
  await assert.rejects(() => repository.createGeneratedBatch("u1", [session("bad", "USER")]));
  await assert.rejects(() =>
    rollback(() =>
      repository.supersedeGenerated("u1", [
        { id: "replacement", replacementId: null },
        { id: "locked", replacementId: null },
      ]),
    ),
  );
  assert.equal(sessions.get("replacement").state, "PLANNED");
});
