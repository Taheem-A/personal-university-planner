import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createDatabase, getDatabaseErrorDetails } from "../../packages/database/dist/index.js";

const url = process.env.SERVICE_TEST_DATABASE_URL;
if (
  process.env.APP_ENV !== "test" ||
  process.env.CONFIRM_SERVICE_TEST_DATABASE !== "RUN_M2_SERVICE_TESTS" ||
  !url
)
  throw new Error("A confirmed, disposable Milestone-2 service database is required.");
const parsed = new URL(url);
if (
  !parsed.hostname.endsWith(".neon.tech") ||
  parsed.hostname.includes("-pooler") ||
  !/^up_m2_service_[a-z0-9_]+$/.test(decodeURIComponent(parsed.pathname.slice(1)))
)
  throw new Error("Use a direct Neon up_m2_service_* database only.");

const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
function compile(source, stubs = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (name) => stubs[name] ?? webRequire(name),
      Date,
      Map,
      Set,
      Intl,
      Number,
      Error,
      RangeError,
      URL,
      JSON,
      Request,
      Response,
    },
  );
  return exports;
}
const shared = compile(readFileSync("packages/shared/src/time.ts", "utf8"));
function load(file, stubs = {}) {
  return compile(readFileSync(`apps/web/src/server/${file}.ts`, "utf8"), {
    "@university-planner/shared": shared,
    ...stubs,
  });
}
const ids = { a: `m2-a-${crypto.randomUUID()}`, b: `m2-b-${crypto.randomUUID()}` };
let actorId = ids.a;
let database = createDatabase({ connectionString: url });
let forceRollback = false;
const errors = load("application/errors", {
  "@university-planner/database": { getDatabaseErrorDetails },
  "../monitoring": { reportInternalFailure: async () => {} },
});
const validation = load("application/validation", { "./errors": errors });
const auth = load("application/authorization", {
  "./errors": errors,
  "../auth": { authenticatedActor: async () => (actorId ? { userId: actorId } : null) },
});
const service = load("application/service", {
  "./authorization": auth,
  "./errors": errors,
  "./validation": validation,
  "../database": {
    applicationDatabase: () => ({
      transaction: (operation) =>
        database.transaction(async (tx) => {
          const result = await operation(tx);
          if (forceRollback) throw Error("forced rollback");
          return result;
        }),
    }),
  },
});
const academic = load("application/academic", {
  "./authorization": auth,
  "./dependencies": load("application/dependencies", { "./errors": errors }),
  "./errors": errors,
  "./validation": validation,
  "./service": service,
});
const lifecycle = load("application/lifecycle", {
  "./authorization": auth,
  "./errors": errors,
  "./validation": validation,
  "./service": service,
});
const transport = load("transport");
function route(path, stubs) {
  return compile(readFileSync(`apps/web/src/app/api/v1/${path}/route.ts`, "utf8"), stubs);
}
const terms = route("terms", {
  "../../../../server/application/academic": academic,
  "../../../../server/transport": transport,
});
const term = route("terms/[id]", {
  "../../../../../server/application/academic": academic,
  "../../../../../server/transport": transport,
});
const courses = route("courses", {
  "../../../../server/application/academic": academic,
  "../../../../server/transport": transport,
});
const exportRoute = route("account/export", {
  "../../../../../server/application/lifecycle": lifecycle,
  "../../../../../server/transport": transport,
});
const req = (path, payload, method = "POST") =>
  new Request(`http://localhost:3000/api/v1/${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify(payload),
  });
const read = async (response) => ({ status: response.status, body: await response.json() });
const context = (id) => ({ params: Promise.resolve({ id }) });
const user = (id) => ({
  id,
  name: null,
  timezone: "America/Toronto",
  defaultDayStart: null,
  defaultDayEnd: null,
  locale: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

test.after(async () => {
  for (const id of Object.values(ids)) {
    try {
      await database.transaction((tx) => tx.repositories.accountLifecycle.deleteAccount(id));
    } catch {
      /* Preserve original assertion failure; database is explicitly disposable. */
    }
  }
  await database.disconnect();
});

test("transport through application services round-trips isolated PostgreSQL state", async () => {
  await database.repositories.users.create(user(ids.a));
  await database.repositories.users.create(user(ids.b));
  actorId = null;
  assert.equal((await read(await terms.GET())).status, 401);
  assert.equal(
    (
      await read(
        await terms.POST(
          req("terms", { name: "Fall", startDate: "2026-09-01", endDate: "2026-12-20" }),
        ),
      )
    ).status,
    401,
  );
  actorId = ids.a;
  const malformed = await read(
    await terms.POST(
      new Request("http://localhost:3000/api/v1/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: "{invalid-json",
      }),
    ),
  );
  assert.equal(malformed.status, 400);
  assert.equal((await database.repositories.academicTerms.listForUser(ids.a)).length, 0);
  const invalid = await read(
    await terms.POST(
      req("terms", { name: "Invalid", startDate: "2026-12-20", endDate: "2026-09-01" }),
    ),
  );
  assert.equal(invalid.body.error.code, "VALIDATION_ERROR");
  assert.equal((await database.repositories.academicTerms.listForUser(ids.a)).length, 0);
  const a = (
    await read(
      await terms.POST(
        req("terms", { name: "Fall", startDate: "2026-09-01", endDate: "2026-12-20" }),
      ),
    )
  ).body.data;
  actorId = ids.b;
  const b = (
    await read(
      await terms.POST(
        req("terms", { name: "Spring", startDate: "2027-01-01", endDate: "2027-04-01" }),
      ),
    )
  ).body.data;
  actorId = ids.a;
  assert.equal(
    (await read(await term.GET(new Request("http://localhost:3000"), context(b.id)))).status,
    404,
  );
  assert.equal(
    (
      await read(
        await term.PATCH(
          req(`terms/${b.id}`, { expectedVersion: 0, name: "Foreign" }, "PATCH"),
          context(b.id),
        ),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await read(
        await term.DELETE(req(`terms/${b.id}`, { expectedVersion: 0 }, "DELETE"), context(b.id)),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await read(
        await courses.POST(
          req("courses", { academicTermId: b.id, code: "MAT186", name: "Foreign" }),
        ),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await read(
        await term.PATCH(
          req(`terms/${a.id}`, { expectedVersion: 0, name: "Fall revised" }, "PATCH"),
          context(a.id),
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await read(
        await term.PATCH(
          req(`terms/${a.id}`, { expectedVersion: 0, name: "Stale" }, "PATCH"),
          context(a.id),
        ),
      )
    ).body.error.code,
    "STALE_WRITE",
  );
  forceRollback = true;
  const failed = await read(
    await terms.POST(
      req("terms", { name: "Rolled back", startDate: "2026-08-01", endDate: "2026-12-20" }),
    ),
  );
  forceRollback = false;
  assert.equal(failed.status, 500);
  assert.equal((await database.repositories.academicTerms.listForUser(ids.a)).length, 1);
  const ownedCourse = await read(
    await courses.POST(req("courses", { academicTermId: a.id, code: "MAT186", name: "Calculus" })),
  );
  assert.equal(ownedCourse.status, 200);
  const fakeCredential = `synthetic-secret-${crypto.randomUUID()}`;
  await database.repositories.integrationAccounts.create({
    id: `m2-integration-${crypto.randomUUID()}`,
    version: 0,
    userId: ids.a,
    provider: "synthetic",
    externalAccountId: "m2-test-account",
    displayName: null,
    status: "ACTIVE",
    credentialReference: fakeCredential,
    lastSyncAt: null,
    lastSuccessAt: null,
    disconnectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const exported = (await read(await exportRoute.GET())).body.data;
  assert.equal(exported.version, 1);
  assert.equal(exported.data.academicTerms.length, 1);
  assert.equal(exported.data.courses.length, 1);
  assert.equal(JSON.stringify(exported).includes("credentialReference"), false);
  assert.equal(JSON.stringify(exported).includes(fakeCredential), false);
  await database.disconnect();
  database = createDatabase({ connectionString: url });
  assert.equal(
    (await read(await term.GET(new Request("http://localhost:3000"), context(a.id)))).body.data
      .name,
    "Fall revised",
  );
  assert.equal(
    (
      await read(
        await term.DELETE(req(`terms/${a.id}`, { expectedVersion: 1 }, "DELETE"), context(a.id)),
      )
    ).body.data.status,
    "ARCHIVED",
  );
  assert.equal(
    (await lifecycle.accountData.delete({ confirmation: "DELETE MY ACCOUNT" })).value.deleted,
    true,
  );
  assert.equal(await database.repositories.users.getById(ids.a), null);
  assert.notEqual(await database.repositories.users.getById(ids.b), null);
});
