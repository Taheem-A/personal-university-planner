import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
function compile(source, stubs = {}) {
  const exports = {};
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(javascript, {
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
  });
  return exports;
}
const shared = compile(readFileSync("packages/shared/src/time.ts", "utf8"));
function app(file, stubs) {
  return compile(readFileSync(`apps/web/src/server/${file}.ts`, "utf8"), {
    "@university-planner/shared": shared,
    ...stubs,
  });
}
let currentUser = "a";
let forcedFailure = false;
let internalSignals = 0;
const rows = { terms: [], courses: [], tasks: [], availability: [], integrations: [] };
const owned = (collection, user, id) =>
  rows[collection].find((r) => r.userId === user && r.id === id) ?? null;
const conditional = (collection, user, id, version, patch) => {
  const row = owned(collection, user, id);
  if (!row) return { status: "NOT_FOUND" };
  if (row.version !== version) return { status: "STALE" };
  Object.assign(row, patch);
  row.version++;
  return { status: "UPDATED", record: row };
};
const repo = {
  academicTerms: {
    create: async (r) => {
      rows.terms.push(r);
      if (forcedFailure) throw Error("private db detail");
      return r;
    },
    getForUser: async (u, id) => owned("terms", u, id),
    listForUser: async (u) => rows.terms.filter((r) => r.userId === u),
    updateIfCurrent: async (u, id, v, p) => conditional("terms", u, id, v, p),
  },
  courses: {
    create: async (r) => {
      rows.courses.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("courses", u, id),
    listForTerm: async (u, id) =>
      rows.courses.filter((r) => r.userId === u && r.academicTermId === id),
  },
  tasks: {
    create: async (r) => {
      rows.tasks.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("tasks", u, id),
    listForUser: async (u) => rows.tasks.filter((r) => r.userId === u),
    updateIfCurrent: async (u, id, v, p) => conditional("tasks", u, id, v, p),
  },
  availabilityRules: {
    create: async (r) => {
      rows.availability.push(r);
      return r;
    },
    listActive: async (u) => rows.availability.filter((r) => r.userId === u && r.active),
  },
  accountLifecycle: {
    snapshot: async (u) => ({
      user: { id: u, timezone: "America/Toronto" },
      academicTerms: rows.terms.filter((r) => r.userId === u),
      integrationAccounts: rows.integrations.filter((r) => r.userId === u),
      plannerRuns: [{ inputSnapshot: { accessToken: "server-secret" } }],
    }),
  },
};
const tx = { repositories: repo, locks: { userGraph: async () => {} } };
const errors = app("application/errors", {
  "@university-planner/database": { getDatabaseErrorDetails: () => null },
  "../monitoring": {
    reportInternalFailure: async () => {
      internalSignals++;
    },
  },
});
const validation = app("application/validation", { "./errors": errors });
const auth = app("application/authorization", {
  "./errors": errors,
  "../auth": { authenticatedActor: async () => (currentUser ? { userId: currentUser } : null) },
});
const serviceUtils = app("application/service", {
  "./authorization": auth,
  "./errors": errors,
  "./validation": validation,
  "../database": {
    applicationDatabase: () => ({
      transaction: async (operation) => {
        const before = Object.fromEntries(
          Object.entries(rows).map(([name, records]) => [name, [...records]]),
        );
        try {
          return await operation(tx);
        } catch (error) {
          for (const [name, records] of Object.entries(before))
            rows[name].splice(0, rows[name].length, ...records);
          throw error;
        }
      },
    }),
  },
  "node:crypto": { randomUUID: () => `new-${Math.random()}` },
});
const plannerTriggerStub = {
  planAfterMutation: (mutation) => mutation,
  classifyTaskMutation: () => null,
  classifyCalendarMutation: () => null,
  classifyPlanningFields: () => null,
};
function academic() {
  return app("application/academic", {
    "./authorization": auth,
    "./dependencies": app("application/dependencies", { "./errors": errors }),
    "./errors": errors,
    "./service": serviceUtils,
    "./planner-triggers": plannerTriggerStub,
    "./validation": validation,
  });
}
const schedule = app("application/schedule", {
  "./authorization": auth,
  "./errors": errors,
  "./service": serviceUtils,
  "./planner-triggers": plannerTriggerStub,
  "./validation": validation,
});
const lifecycle = app("application/lifecycle", {
  "./authorization": auth,
  "./errors": errors,
  "./service": serviceUtils,
  "./planner-triggers": plannerTriggerStub,
  "./validation": validation,
});
const transport = app("transport", {});
const base = "apps/web/src/app/api/v1/";
function route(path, stubs) {
  return compile(readFileSync(`${base}${path}/route.ts`, "utf8"), stubs);
}
const terms = route("terms", {
  "../../../../server/application/academic": academic(),
  "../../../../server/transport": transport,
});
const term = route("terms/[id]", {
  "../../../../../server/application/academic": academic(),
  "../../../../../server/transport": transport,
});
const courses = route("courses", {
  "../../../../server/application/academic": academic(),
  "../../../../server/transport": transport,
});
const tasks = route("tasks", {
  "../../../../server/application/academic": academic(),
  "../../../../server/transport": transport,
});
const availability = route("availability", {
  "../../../../server/application/schedule": schedule,
  "../../../../server/transport": transport,
});
const exportRoute = route("account/export", {
  "../../../../../server/application/lifecycle": lifecycle,
  "../../../../../server/transport": transport,
});
function request(path, payload, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000/api/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(payload),
  });
}
async function parsed(response) {
  return { status: response.status, body: await response.json() };
}
const context = (id) => ({ params: Promise.resolve({ id }) });

test("actual route adapters enforce actor, validation, ownership, versions, rollback and redacted export", async () => {
  currentUser = null;
  assert.equal((await parsed(await terms.GET())).status, 401);
  assert.equal(
    (
      await parsed(
        await terms.POST(
          request("terms", { name: "Fall", startDate: "2026-09-01", endDate: "2026-12-20" }),
        ),
      )
    ).status,
    401,
  );
  currentUser = "a";
  const invalid = await parsed(
    await terms.POST(
      request("terms", { name: "Wrong", startDate: "2026-12-20", endDate: "2026-09-01" }),
    ),
  );
  assert.equal(invalid.status, 400);
  assert.equal(rows.terms.length, 0);
  const malformed = await parsed(
    await terms.POST(
      new Request("http://localhost:3000/api/v1/terms", {
        method: "POST",
        headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
        body: "{",
      }),
    ),
  );
  assert.equal(malformed.status, 400);
  assert.equal(rows.terms.length, 0);
  assert.equal(
    (
      await parsed(
        await terms.POST(
          request("terms", {
            name: "Forgery",
            userId: "b",
            startDate: "2026-09-01",
            endDate: "2026-12-20",
          }),
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await parsed(
        await terms.POST(
          request(
            "terms",
            { name: "CSRF", startDate: "2026-09-01", endDate: "2026-12-20" },
            "https://evil.test",
          ),
        ),
      )
    ).status,
    403,
  );
  const aTerm = (
    await parsed(
      await terms.POST(
        request("terms", { name: "Fall", startDate: "2026-09-01", endDate: "2026-12-20" }),
      ),
    )
  ).body.data;
  assert.equal(aTerm.userId, "a");
  currentUser = "b";
  const bTerm = (
    await parsed(
      await terms.POST(
        request("terms", { name: "Spring", startDate: "2027-01-01", endDate: "2027-04-01" }),
      ),
    )
  ).body.data;
  currentUser = "a";
  assert.equal(
    (await parsed(await term.GET(new Request("http://localhost:3000"), context(bTerm.id)))).status,
    404,
  );
  const guessed = new Request("http://localhost:3000/api/v1/terms/other", {
    method: "PATCH",
    headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify({ expectedVersion: 0, name: "Stolen" }),
  });
  assert.equal((await parsed(await term.PATCH(guessed, context(bTerm.id)))).status, 404);
  assert.equal(
    (
      await parsed(
        await courses.POST(
          request("courses", { academicTermId: bTerm.id, code: "MAT186", name: "Math" }),
        ),
      )
    ).status,
    404,
  );
  const updated = () =>
    new Request("http://localhost:3000/api/v1/terms/own", {
      method: "PATCH",
      headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: 0, name: "Fall 2026" }),
    });
  assert.equal((await parsed(await term.PATCH(updated(), context(aTerm.id)))).body.data.version, 1);
  assert.equal(
    (await parsed(await term.PATCH(updated(), context(aTerm.id)))).body.error.code,
    "STALE_WRITE",
  );
  assert.equal(
    (
      await parsed(
        await tasks.POST(request("tasks", { title: "Foreign", courseId: "other-course" })),
      )
    ).status,
    404,
  );
  const task = (await parsed(await tasks.POST(request("tasks", { title: "Practice" })))).body.data;
  assert.equal(task.dueAt, null);
  const recurrence = (
    await parsed(
      await availability.POST(
        request("availability", {
          recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
          startTimeLocal: "09:00",
          endTimeLocal: "17:00",
          timezone: "America/Toronto",
          effectiveFrom: "2026-09-01",
          capacityFactor: 1,
          energyLevel: "HIGH",
        }),
      ),
    )
  ).body.data;
  assert.equal(recurrence.startTimeLocal, "09:00");
  forcedFailure = true;
  const failure = await parsed(
    await terms.POST(
      request("terms", { name: "Rollback", startDate: "2026-09-01", endDate: "2026-12-20" }),
    ),
  );
  forcedFailure = false;
  assert.equal(failure.body.error.code, "INTERNAL_ERROR");
  assert.equal(JSON.stringify(failure).includes("private db detail"), false);
  assert.equal(
    rows.terms.some((r) => r.name === "Rollback"),
    false,
  );
  assert.equal(internalSignals, 1);
  rows.integrations.push({ id: "integration", userId: "a", credentialReference: "private-token" });
  const exported = await parsed(await exportRoute.GET());
  assert.equal(exported.status, 200);
  assert.equal(exported.body.data.version, 1);
  assert.equal(JSON.stringify(exported).includes("private-token"), false);
  assert.equal(JSON.stringify(exported).includes("server-secret"), false);
  currentUser = "b";
  const bExport = await parsed(await exportRoute.GET());
  assert.equal(bExport.body.data.data.user.id, "b");
  assert.equal(
    bExport.body.data.data.academicTerms.some((r) => r.id === aTerm.id),
    false,
  );
  currentUser = null;
  assert.equal((await parsed(await exportRoute.GET())).status, 401);
  currentUser = "a";
  const restarted = route("terms", {
    "../../../../server/application/academic": academic(),
    "../../../../server/transport": transport,
  });
  assert.equal(
    (await parsed(await restarted.GET())).body.data.some((r) => r.id === aTerm.id),
    true,
  );
});

test("package policy rejects transport imports and direct repository use", () => {
  const root = mkdtempSync(path.join(tmpdir(), "planner-boundary-"));
  const routeFile = path.join(root, "apps/web/src/app/api/proof/route.ts");
  const script = path.resolve("scripts/check-package-boundaries.mjs");
  mkdirSync(path.dirname(routeFile), { recursive: true });
  mkdirSync(path.join(root, "packages/shared"), { recursive: true });
  writeFileSync(path.join(root, "packages/shared/index.ts"), "export {};\n");
  const check = () => spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  try {
    writeFileSync(routeFile, 'import { getDatabase } from "@university-planner/database";\n');
    assert.match(check().stderr, /transport may import services/);
    writeFileSync(routeFile, "const row = tx.repositories.tasks.getForUser(id, id);\n");
    assert.match(check().stderr, /transport cannot query/);
    writeFileSync(routeFile, 'import { tasks } from "../../../../server/application/academic";\n');
    assert.equal(check().status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
