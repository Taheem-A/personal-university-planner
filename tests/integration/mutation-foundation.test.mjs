import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const requireWeb = createRequire(path.resolve("apps/web/package.json"));
function load(file, stubs = {}, globals = {}) {
  const exports = {};
  const source = readFileSync(file, "utf8");
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    {
      exports,
      require: (name) => stubs[name] ?? requireWeb(name),
      Date,
      Intl,
      Map,
      Set,
      Error,
      RangeError,
      Request,
      Response,
      URL,
      JSON,
      ...globals,
    },
    { filename: file },
  );
  return exports;
}
const server = (name, stubs) => load(`apps/web/src/server/${name}.ts`, stubs);
let actor = null;
let user = {
  id: "owner",
  timezone: "America/Toronto",
  credentialRef: "secret",
  planningRevision: 0,
};
let plannerResult = { ok: true, value: { status: "SUCCEEDED", planStatus: "FEASIBLE" } };
let failWrite = false;
const errors = server("application/errors", {
  "@university-planner/database": { getDatabaseErrorDetails: () => null },
  "../monitoring": { reportInternalFailure: async () => {} },
});
const validation = server("application/validation", {
  "./errors": errors,
  "@university-planner/shared": { expandRecurringWindows: () => [] },
});
const authorization = server("application/authorization", {
  "./errors": errors,
  "../auth": { authenticatedActor: async () => actor && { userId: actor } },
});
const service = server("application/service", {
  "node:crypto": { randomUUID: () => "new-id" },
  "./authorization": authorization,
  "./errors": errors,
  "./validation": validation,
  "../database": {
    applicationDatabase: () => ({
      transaction: async (operation) => {
        const before = { ...user };
        try {
          return await operation({
            repositories: {
              users: {
                updateTimezoneIfCurrent: async (id, expected, timezone) => {
                  if (id !== user.id) return { status: "NOT_FOUND" };
                  if (expected !== user.timezone) return { status: "STALE" };
                  user = { ...user, timezone, planningRevision: user.planningRevision + 1 };
                  if (failWrite) throw Error("database secret");
                  return { status: "UPDATED", record: user };
                },
              },
            },
          });
        } catch (error) {
          user = before;
          throw error;
        }
      },
    }),
  },
});
const account = server("application/account", {
  "./service": service,
  "./validation": validation,
  "./planner-triggers": {
    planAfterMutation: async (mutation, intent) => {
      const result = await mutation;
      if (!result.ok) return result;
      intent(result.value);
      return { ok: true, value: { ...result.value, planning: plannerResult } };
    },
  },
});
const transport = server("transport", {});
const route = load("apps/web/src/app/api/v1/account/timezone/route.ts", {
  "../../../../../server/application/account": account,
  "../../../../../server/transport": transport,
});
function request(body, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/v1/account/timezone", {
    method: "PATCH",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const change = (timezone, extra = {}) =>
  request({ timezone, expectedTimezone: "America/Toronto", ...extra });

test("same-origin validation uses the browser-facing Host when Next rewrites request URL", async () => {
  const browserRequest = new Request("http://localhost:3000/api/v1/account/timezone", {
    method: "PATCH",
    headers: {
      Host: "127.0.0.1:3000",
      Origin: "http://127.0.0.1:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ timezone: "Europe/London", expectedTimezone: "America/Toronto" }),
  });
  assert.deepEqual(await transport.bodyOf(browserRequest), {
    timezone: "Europe/London",
    expectedTimezone: "America/Toronto",
  });
  const foreignRequest = new Request("http://localhost:3000/api/v1/account/timezone", {
    method: "PATCH",
    headers: {
      Host: "127.0.0.1:3000",
      Origin: "http://evil.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal((await transport.bodyOf(foreignRequest)).status, 403);
});

test("timezone mutation keeps actor server-owned, validates and rejects cross-origin requests", async () => {
  user.timezone = "America/Toronto";
  actor = null;
  assert.equal((await route.PATCH(change("Europe/London"))).status, 401);
  actor = "owner";
  assert.equal((await route.PATCH(change("Invalid/Zone"))).status, 400);
  assert.equal(user.timezone, "America/Toronto");
  assert.equal((await route.PATCH(change("Europe/London", { userId: "victim" }))).status, 400);
  assert.equal(
    (
      await route.PATCH(
        request(
          { timezone: "Europe/London", expectedTimezone: "America/Toronto" },
          "https://evil.example",
        ),
      )
    ).status,
    403,
  );
  assert.equal(user.timezone, "America/Toronto");
});

test("canonical persistence gates success; stale and internal errors stay structured", async () => {
  actor = "owner";
  user.timezone = "America/Toronto";
  failWrite = true;
  const failed = await route.PATCH(change("Europe/London"));
  assert.equal(failed.status, 500);
  assert.equal(user.timezone, "America/Toronto");
  assert.doesNotMatch(JSON.stringify(await failed.json()), /database secret|credentialRef/);
  failWrite = false;
  plannerResult = {
    ok: false,
    error: { code: "PLANNER_INFEASIBLE", message: "private diagnostic" },
  };
  const saved = await route.PATCH(change("Europe/London"));
  assert.equal(saved.status, 200);
  const body = await saved.json();
  assert.equal(body.data.timezone, "Europe/London");
  assert.equal(body.data.planning.status, "FAILED");
  assert.doesNotMatch(JSON.stringify(body), /private diagnostic|credentialRef|planningRevision/);
  const stale = await route.PATCH(change("Asia/Tokyo"));
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.code, "STALE_WRITE");
  assert.equal(user.timezone, "Europe/London");
});

test("client vocabulary requires a persisted marker and does not display server diagnostics", async () => {
  const client = load(
    "apps/web/src/components/mutation-client.ts",
    {},
    {
      fetch: async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }),
    },
  );
  const marker = (value) => typeof value?.id === "string";
  assert.equal((await client.submitMutation("/x", "POST", {}, marker)).ok, false);
  const safe = load(
    "apps/web/src/components/mutation-client.ts",
    {},
    {
      fetch: async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: "INTERNAL_ERROR", message: "secret query" } }),
      }),
    },
  );
  assert.doesNotMatch((await safe.submitMutation("/x", "POST", {}, marker)).message, /secret/);
});

test("form primitives have labels, associated errors, status regions and keyboard buttons", () => {
  const React = requireWeb("react");
  const { renderToStaticMarkup } = requireWeb("react-dom/server");
  const form = load("apps/web/src/components/mutation-form.tsx", {
    "@university-planner/shared": { localDateTimeToInstant: () => new Date() },
  });
  const html = renderToStaticMarkup(
    React.createElement(
      "form",
      null,
      React.createElement(form.FormField, { label: "Title", error: "Required" }),
      React.createElement(
        form.SelectField,
        { label: "Course" },
        React.createElement("option", null, "One"),
      ),
      React.createElement(form.CheckField, { label: "Confirm" }),
      React.createElement(form.ValidationSummary, { errors: ["Required"] }),
      React.createElement(form.FormActions, { saving: false, onCancel: () => {} }),
      React.createElement(form.FormStatus, { message: "Saved" }),
    ),
  );
  assert.match(html, /<label for="[^"]+">Title<\/label>/);
  assert.match(html, /aria-describedby="[^"]+-error"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /role="status"/);
  assert.match(html, /type="button"[^>]*>Cancel/);
  assert.match(
    readFileSync("apps/web/src/app/styles.css", "utf8"),
    /:focus-visible\s*\{\s*outline: 2px/,
  );
});

test("deadline input converts with an explicit zone and rejects DST ambiguity", () => {
  const time = requireWeb(path.resolve("dist/packages/shared/src/index.js"));
  const form = load("apps/web/src/components/mutation-form.tsx", {
    "@university-planner/shared": time,
  });
  assert.equal(
    form.deadlineInstant("2026-09-26T12:00", "America/Toronto"),
    "2026-09-26T16:00:00.000Z",
  );
  assert.throws(() => form.deadlineInstant("2026-03-08T02:30", "America/Toronto"));
  assert.throws(() => form.deadlineInstant("2026-11-01T01:30", "America/Toronto"));
  assert.equal(
    form.editedInstant("2026-11-01T01:30", "America/Toronto", new Date("2026-11-01T05:30:00Z")),
    "2026-11-01T05:30:00.000Z",
  );
  assert.throws(() =>
    form.editedInstant("2026-11-01T01:30", "America/Toronto", new Date("2026-11-01T08:00:00Z")),
  );
});
