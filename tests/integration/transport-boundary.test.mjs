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
const rows = {
  terms: [],
  courses: [],
  meetings: [],
  assessments: [],
  events: [],
  tasks: [],
  availability: [],
  protection: [],
  preferences: [],
  integrations: [],
};
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
    updateIfCurrent: async (u, id, v, p) => conditional("courses", u, id, v, p),
  },
  courseMeetings: {
    create: async (r) => {
      rows.meetings.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("meetings", u, id),
    listForCourse: async (u, id) =>
      rows.meetings.filter((r) => r.userId === u && r.courseId === id),
    updateIfCurrent: async (u, id, v, p) => conditional("meetings", u, id, v, p),
  },
  assessments: {
    create: async (r) => {
      rows.assessments.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("assessments", u, id),
    listForCourse: async (u, id) =>
      rows.assessments.filter((r) => r.userId === u && r.courseId === id),
    updateIfCurrent: async (u, id, v, p) => conditional("assessments", u, id, v, p),
  },
  calendarEvents: {
    create: async (r) => {
      rows.events.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("events", u, id),
    listForRange: async (u) => rows.events.filter((r) => r.userId === u),
    updateIfCurrent: async (u, id, v, p) => conditional("events", u, id, v, p),
  },
  tasks: {
    create: async (r) => {
      rows.tasks.push(r);
      return r;
    },
    getForUser: async (u, id) => owned("tasks", u, id),
    listForUser: async (u) => rows.tasks.filter((r) => r.userId === u),
    listSubtasks: async (u, id) =>
      rows.tasks.filter((r) => r.userId === u && r.parentTaskId === id),
    updateIfCurrent: async (u, id, v, p) => conditional("tasks", u, id, v, p),
  },
  availabilityRules: {
    create: async (r) => {
      rows.availability.push(r);
      return r;
    },
    listActive: async (u) => rows.availability.filter((r) => r.userId === u && r.active),
    getForUser: async (u, id) => owned("availability", u, id),
    updateIfCurrent: async (u, id, v, p) => conditional("availability", u, id, v, p),
  },
  protectedTimeRules: {
    create: async (r) => {
      rows.protection.push(r);
      return r;
    },
    listActive: async (u) => rows.protection.filter((r) => r.userId === u && r.active),
    getForUser: async (u, id) => owned("protection", u, id),
    updateIfCurrent: async (u, id, v, p) => conditional("protection", u, id, v, p),
  },
  planningPreferences: {
    create: async (r) => {
      rows.preferences.push(r);
      return r;
    },
    getForUser: async (u) => rows.preferences.find((r) => r.userId === u) ?? null,
    updateIfCurrent: async (u, v, p) =>
      conditional("preferences", u, rows.preferences.find((r) => r.userId === u)?.id, v, p),
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
const manual = app("application/manual-management", {
  "./academic": academic(),
  "./schedule": schedule,
});
const lifecycle = app("application/lifecycle", {
  "./planner-reads": { planHistoryItem: (run) => run },
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
const manualTerms = route("manual/terms", {
  "../../../../../server/application/manual-management": manual,
  "../../../../../server/transport": transport,
});
const manualTerm = route("manual/terms/[id]", {
  "../../../../../../server/application/manual-management": manual,
  "../../../../../../server/transport": transport,
});
const manualCourses = route("manual/courses", {
  "../../../../../server/application/manual-management": manual,
  "../../../../../server/transport": transport,
});
const manualCourse = route("manual/courses/[id]", {
  "../../../../../../server/application/manual-management": manual,
  "../../../../../../server/transport": transport,
});
const manualMeetings = route("manual/meetings", {
  "../../../../../server/application/manual-management": manual,
  "../../../../../server/transport": transport,
});
const manualMeeting = route("manual/meetings/[id]", {
  "../../../../../../server/application/manual-management": manual,
  "../../../../../../server/transport": transport,
});
const manualEvents = route("manual/events", {
  "../../../../../server/application/manual-management": manual,
  "../../../../../server/transport": transport,
});
const manualEvent = route("manual/events/[id]", {
  "../../../../../../server/application/manual-management": manual,
  "../../../../../../server/transport": transport,
});
const manualAssessments = route("manual/assessments", {
  "../../../../../server/application/manual-management": manual,
  "../../../../../server/transport": transport,
});
const manualAssessment = route("manual/assessments/[id]", {
  "../../../../../../server/application/manual-management": manual,
  "../../../../../../server/transport": transport,
});
const manualTasks = route("manual/tasks", {
  "../../../../../server/application/manual-management": manual,
  "../../../../../server/transport": transport,
});
const manualTask = route("manual/tasks/[id]", {
  "../../../../../../server/application/manual-management": manual,
  "../../../../../../server/transport": transport,
});
const manualAvailability = route("manual/availability", {
  "../../../../../server/application/manual-management": manual,
  "../../../../../server/transport": transport,
});
const manualAvailabilityItem = route("manual/availability/[id]", {
  "../../../../../../server/application/manual-management": manual,
  "../../../../../../server/transport": transport,
});
const manualProtection = route("manual/protected-time", {
  "../../../../../server/application/manual-management": manual,
  "../../../../../server/transport": transport,
});
const manualProtectionItem = route("manual/protected-time/[id]", {
  "../../../../../../server/application/manual-management": manual,
  "../../../../../../server/transport": transport,
});
const manualPreferences = route("manual/preferences", {
  "../../../../../server/application/manual-management": manual,
  "../../../../../server/transport": transport,
});
const manualPreferencesCurrent = route("manual/preferences/current", {
  "../../../../../../server/application/manual-management": manual,
  "../../../../../../server/transport": transport,
});

test("life-constraint routes require session and origin, persist owned versions, and redact records", async () => {
  const common = {
    recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
    startTimeLocal: "09:00",
    endTimeLocal: "12:00",
    spansNextDay: false,
    timezone: "America/Toronto",
    effectiveFrom: "2026-03-01",
    effectiveUntil: null,
  };
  const availabilityInput = {
    ...common,
    capacityFactor: 1,
    energyLevel: "HIGH",
    allowedLocationTags: ["DESK"],
  };
  currentUser = null;
  assert.equal(
    (
      await parsed(
        await manualAvailability.POST(mutation("availability", "POST", availabilityInput)),
      )
    ).status,
    401,
  );
  currentUser = "constraint-a";
  assert.equal(
    (
      await parsed(
        await manualAvailability.POST(
          mutation("availability", "POST", availabilityInput, "https://other.test"),
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await parsed(
        await manualAvailability.POST(
          mutation("availability", "POST", { ...availabilityInput, userId: "constraint-b" }),
        ),
      )
    ).status,
    400,
  );
  const added = await parsed(
    await manualAvailability.POST(mutation("availability", "POST", availabilityInput)),
  );
  assert.equal(added.status, 200);
  assert.deepEqual(Object.keys(added.body.data).sort(), ["id", "planning", "version"]);
  const id = added.body.data.id;
  assert.equal(owned("availability", "constraint-a", id).capacityFactor, 1);
  assert.equal(
    (
      await parsed(
        await manualAvailabilityItem.PATCH(
          mutation(`availability/${id}`, "PATCH", { expectedVersion: 0, capacityFactor: 0.5 }),
          context(id),
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await parsed(
        await manualAvailabilityItem.PATCH(
          mutation(`availability/${id}`, "PATCH", { expectedVersion: 0, capacityFactor: 0.8 }),
          context(id),
        ),
      )
    ).body.error.code,
    "STALE_WRITE",
  );
  assert.equal(
    (
      await parsed(
        await manualAvailabilityItem.PATCH(
          mutation(`availability/${id}`, "PATCH", { expectedVersion: 1, endTimeLocal: "08:00" }),
          context(id),
        ),
      )
    ).body.error.code,
    "VALIDATION_ERROR",
  );
  currentUser = "constraint-b";
  assert.equal(
    (
      await parsed(
        await manualAvailabilityItem.DELETE(
          mutation(`availability/${id}`, "DELETE", { expectedVersion: 1 }),
          context(id),
        ),
      )
    ).status,
    404,
  );
  currentUser = "constraint-a";
  assert.equal(
    (
      await parsed(
        await manualAvailabilityItem.DELETE(
          mutation(`availability/${id}`, "DELETE", { expectedVersion: 1 }),
          context(id),
        ),
      )
    ).status,
    200,
  );
  const badSleep = await parsed(
    await manualProtection.POST(
      mutation("protected-time", "POST", {
        ...common,
        reason: "Sleep",
        protectionLevel: "SOFT",
        isSleep: true,
      }),
    ),
  );
  assert.equal(badSleep.body.error.code, "VALIDATION_ERROR");
  const protection = await parsed(
    await manualProtection.POST(
      mutation("protected-time", "POST", {
        ...common,
        reason: "Commute",
        protectionLevel: "SOFT",
        isSleep: false,
      }),
    ),
  );
  assert.equal(protection.status, 200);
  const protectedId = protection.body.data.id;
  assert.equal(
    (
      await parsed(
        await manualProtectionItem.PATCH(
          mutation(`protected-time/${protectedId}`, "PATCH", {
            expectedVersion: 0,
            protectionLevel: "HARD",
          }),
          context(protectedId),
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await parsed(
        await manualProtectionItem.DELETE(
          mutation(`protected-time/${protectedId}`, "DELETE", { expectedVersion: 1 }),
          context(protectedId),
        ),
      )
    ).status,
    200,
  );
  const balanced = {
    preferredDailyStudyLimitMinutes: 240,
    minimumFreeTimeMinutes: 30,
    preferredDeadlineBufferHours: 12,
    avoidLateHighEnergyTasks: true,
    maximumConsecutiveWorkMinutes: 90,
    minimumBreakMinutes: 10,
    scheduleCommuteWork: false,
    weekendWorkBias: 0,
    planStabilityWindowMinutes: 120,
    minimumSleepMinutes: 420,
  };
  const pref = await parsed(
    await manualPreferences.POST(mutation("preferences", "POST", balanced)),
  );
  assert.equal(pref.status, 200);
  assert.deepEqual(Object.keys(pref.body.data).sort(), ["id", "planning", "version"]);
  assert.equal(
    (
      await parsed(
        await manualPreferencesCurrent.PATCH(
          mutation("preferences/current", "PATCH", {
            expectedVersion: 0,
            scheduleCommuteWork: true,
          }),
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await parsed(
        await manualPreferencesCurrent.PATCH(
          mutation("preferences/current", "PATCH", {
            expectedVersion: 0,
            scheduleCommuteWork: false,
          }),
        ),
      )
    ).body.error.code,
    "STALE_WRITE",
  );
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
function mutation(path, method, payload, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000/api/v1/manual/${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(payload),
  });
}

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
    assert.match(check().stderr, /transport\/client cannot query/);
    writeFileSync(routeFile, 'import { tasks } from "../../../../server/application/academic";\n');
    assert.equal(check().status, 0);
    const clientFile = path.join(root, "apps/web/src/components/unsafe.tsx");
    mkdirSync(path.dirname(clientFile), { recursive: true });
    writeFileSync(clientFile, '"use client";\nconst row = tx.repositories.users.getById(id);\n');
    assert.match(check().stderr, /transport\/client cannot query/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("manual route adapters persist owned facts and return narrow safe outcomes", async () => {
  currentUser = null;
  assert.equal(
    (
      await parsed(
        await manualTerms.POST(
          mutation("terms", "POST", {
            name: "Fall",
            startDate: "2026-09-01",
            endDate: "2026-12-20",
          }),
        ),
      )
    ).status,
    401,
  );
  currentUser = "manual-a";
  const termInput = { name: "Fall", startDate: "2026-09-01", endDate: "2026-12-20" };
  assert.equal(
    (
      await parsed(
        await manualTerms.POST(mutation("terms", "POST", { ...termInput, userId: "manual-b" })),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await parsed(
        await manualTerms.POST(mutation("terms", "POST", termInput, "https://evil.test")),
      )
    ).status,
    403,
  );
  assert.equal(rows.terms.filter((r) => r.userId === "manual-a").length, 0);
  const created = await parsed(await manualTerms.POST(mutation("terms", "POST", termInput)));
  assert.equal(created.status, 200);
  assert.deepEqual(Object.keys(created.body.data).sort(), ["id", "planning", "version"]);
  assert.equal(created.body.data.planning.status, "NOT_REQUESTED");
  const termId = created.body.data.id;
  assert.equal(owned("terms", "manual-a", termId).name, "Fall");
  const patchTerm = (version, body) =>
    mutation(`terms/${termId}`, "PATCH", { expectedVersion: version, ...body });
  assert.equal(
    (await parsed(await manualTerm.PATCH(patchTerm(0, { name: "Autumn" }), context(termId))))
      .status,
    200,
  );
  assert.equal(
    (await parsed(await manualTerm.PATCH(patchTerm(0, { name: "Stale" }), context(termId)))).body
      .error.code,
    "STALE_WRITE",
  );
  assert.equal(owned("terms", "manual-a", termId).name, "Autumn");
  const course = await parsed(
    await manualCourses.POST(
      mutation("courses", "POST", { academicTermId: termId, code: "CSC101", name: "Computing" }),
    ),
  );
  assert.equal(course.status, 200);
  const courseId = course.body.data.id;
  assert.equal(owned("courses", "manual-a", courseId).code, "CSC101");
  assert.equal(
    (
      await parsed(
        await manualCourse.PATCH(
          mutation(`courses/${courseId}`, "PATCH", { expectedVersion: 0, name: "Computing I" }),
          context(courseId),
        ),
      )
    ).status,
    200,
  );
  const meetingInput = {
    courseId,
    meetingType: "LECTURE",
    recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
    startTimeLocal: "09:00",
    endTimeLocal: "10:00",
    spansNextDay: false,
    timezone: "America/Toronto",
    effectiveFrom: "2026-09-01",
    attendanceRequired: true,
  };
  const meeting = await parsed(
    await manualMeetings.POST(mutation("meetings", "POST", meetingInput)),
  );
  assert.equal(meeting.status, 200);
  const meetingId = meeting.body.data.id;
  assert.equal(
    (
      await parsed(
        await manualMeeting.PATCH(
          mutation(`meetings/${meetingId}`, "PATCH", { expectedVersion: 0, location: "Room 1" }),
          context(meetingId),
        ),
      )
    ).status,
    200,
  );
  const eventInput = {
    title: "Appointment",
    eventType: "APPOINTMENT",
    startAt: "2026-09-02T13:00:00.000Z",
    endAt: "2026-09-02T14:00:00.000Z",
    constraintLevel: "HARD",
  };
  const event = await parsed(await manualEvents.POST(mutation("events", "POST", eventInput)));
  assert.equal(event.status, 200);
  const eventId = event.body.data.id;
  assert.equal(
    (
      await parsed(
        await manualEvent.PATCH(
          mutation(`events/${eventId}`, "PATCH", { expectedVersion: 0, title: "Doctor" }),
          context(eventId),
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await parsed(
        await manualEvents.POST(
          mutation("events", "POST", { ...eventInput, endAt: "2026-09-02T12:00:00.000Z" }),
        ),
      )
    ).status,
    400,
  );
  assert.equal(rows.events.filter((r) => r.userId === "manual-a").length, 1);
  currentUser = "manual-b";
  assert.equal(
    (await parsed(await manualTerm.PATCH(patchTerm(1, { name: "Stolen" }), context(termId))))
      .status,
    404,
  );
  assert.equal(
    (
      await parsed(
        await manualCourse.PATCH(
          mutation(`courses/${courseId}`, "PATCH", { expectedVersion: 1, name: "Stolen" }),
          context(courseId),
        ),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await parsed(
        await manualEvent.DELETE(
          mutation(`events/${eventId}`, "DELETE", { expectedVersion: 1 }),
          context(eventId),
        ),
      )
    ).status,
    404,
  );
  currentUser = "manual-a";
  assert.equal(
    (
      await parsed(
        await manualMeeting.DELETE(
          mutation(`meetings/${meetingId}`, "DELETE", { expectedVersion: 1 }),
          context(meetingId),
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await parsed(
        await manualEvent.DELETE(
          mutation(`events/${eventId}`, "DELETE", { expectedVersion: 1 }),
          context(eventId),
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await parsed(
        await manualCourse.DELETE(
          mutation(`courses/${courseId}`, "DELETE", { expectedVersion: 1 }),
          context(courseId),
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await parsed(
        await manualTerm.DELETE(
          mutation(`terms/${termId}`, "DELETE", { expectedVersion: 1 }),
          context(termId),
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await parsed(
        await manualCourses.POST(
          mutation("courses", "POST", {
            academicTermId: termId,
            code: "NEW",
            name: "Cannot create",
          }),
        ),
      )
    ).status,
    404,
  );
});

test("assessment and task routes enforce owner, validation, stale writes and committed response", async () => {
  currentUser = null;
  assert.equal(
    (await parsed(await manualTasks.POST(mutation("tasks", "POST", { title: "No actor" })))).status,
    401,
  );
  currentUser = "work-a";
  const term = (
    await parsed(
      await manualTerms.POST(
        mutation("terms", "POST", { name: "Fall", startDate: "2026-09-01", endDate: "2026-12-20" }),
      ),
    )
  ).body.data;
  const course = (
    await parsed(
      await manualCourses.POST(
        mutation("courses", "POST", { academicTermId: term.id, code: "CIV100", name: "Civil" }),
      ),
    )
  ).body.data;
  assert.equal(
    (
      await parsed(
        await manualAssessments.POST(
          mutation("assessments", "POST", {
            courseId: course.id,
            title: "Forged",
            assessmentType: "Assignment",
            userId: "work-b",
          }),
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await parsed(
        await manualAssessments.POST(
          mutation(
            "assessments",
            "POST",
            { courseId: course.id, title: "Cross origin", assessmentType: "Assignment" },
            "https://evil.test",
          ),
        ),
      )
    ).status,
    403,
  );
  assert.equal(rows.assessments.filter((r) => r.userId === "work-a").length, 0);
  const assessment = await parsed(
    await manualAssessments.POST(
      mutation("assessments", "POST", {
        courseId: course.id,
        title: "Assignment 3",
        assessmentType: "Assignment",
      }),
    ),
  );
  assert.equal(assessment.status, 200);
  assert.deepEqual(Object.keys(assessment.body.data).sort(), ["id", "planning", "version"]);
  assert.equal(owned("assessments", "work-a", assessment.body.data.id).dueAt, null);
  const assignmentId = assessment.body.data.id;
  assert.equal(
    (
      await parsed(
        await manualAssessment.PATCH(
          mutation(`assessments/${assignmentId}`, "PATCH", {
            expectedVersion: 0,
            dueAt: "2026-10-15T20:00:00Z",
          }),
          context(assignmentId),
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await parsed(
        await manualAssessment.PATCH(
          mutation(`assessments/${assignmentId}`, "PATCH", { expectedVersion: 0, title: "Stale" }),
          context(assignmentId),
        ),
      )
    ).body.error.code,
    "STALE_WRITE",
  );
  const taskInput = {
    title: "Solve",
    courseId: course.id,
    assessmentId: assignmentId,
    status: "READY",
    originalEstimatedMinutes: 180,
    availableFrom: "2026-10-01T12:00:00Z",
    minimumSessionMinutes: 45,
    preferredSessionMinutes: 45,
    maximumSessionMinutes: 45,
  };
  const bad = await parsed(
    await manualTasks.POST(
      mutation("tasks", "POST", { ...taskInput, dueAt: "2026-09-01T12:00:00Z" }),
    ),
  );
  assert.equal(bad.status, 400);
  assert.equal(rows.tasks.filter((r) => r.userId === "work-a" && r.title === "Solve").length, 0);
  const task = await parsed(await manualTasks.POST(mutation("tasks", "POST", taskInput)));
  assert.equal(task.status, 200);
  assert.deepEqual(Object.keys(task.body.data).sort(), ["id", "planning", "version"]);
  const taskId = task.body.data.id;
  assert.equal(owned("tasks", "work-a", taskId).remainingMinutes, 180);
  assert.equal(
    (
      await parsed(
        await manualTask.PATCH(
          mutation(`tasks/${taskId}`, "PATCH", {
            expectedVersion: 0,
            currentEstimatedMinutes: 240,
            remainingMinutes: 240,
          }),
          context(taskId),
        ),
      )
    ).status,
    200,
  );
  assert.equal(owned("tasks", "work-a", taskId).status, "READY");
  assert.equal(
    (
      await parsed(
        await manualTask.PATCH(
          mutation(`tasks/${taskId}`, "PATCH", { expectedVersion: 0, title: "Stale" }),
          context(taskId),
        ),
      )
    ).body.error.code,
    "STALE_WRITE",
  );
  currentUser = "work-b";
  assert.equal(
    (
      await parsed(
        await manualAssessment.DELETE(
          mutation(`assessments/${assignmentId}`, "DELETE", { expectedVersion: 1 }),
          context(assignmentId),
        ),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await parsed(
        await manualTask.DELETE(
          mutation(`tasks/${taskId}`, "DELETE", { expectedVersion: 1 }),
          context(taskId),
        ),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await parsed(
        await manualTasks.POST(
          mutation("tasks", "POST", { ...taskInput, title: "Foreign relation" }),
        ),
      )
    ).status,
    404,
  );
  currentUser = "work-a";
  assert.equal(
    (
      await parsed(
        await manualTask.DELETE(
          mutation(`tasks/${taskId}`, "DELETE", { expectedVersion: 1 }),
          context(taskId),
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await parsed(
        await manualAssessment.DELETE(
          mutation(`assessments/${assignmentId}`, "DELETE", { expectedVersion: 1 }),
          context(assignmentId),
        ),
      )
    ).status,
    200,
  );
});
