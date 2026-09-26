import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import typescript from "typescript";
const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
import {
  renderInbox,
  renderUpcoming,
  syntheticInformationModel,
} from "../support/information-ui-render.mjs";

function loadTs(file, require) {
  const javascript = typescript.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      jsx: typescript.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(javascript, { exports, require, Response, Request, URL, URLSearchParams });
  return exports;
}

test("Upcoming renders canonical commitment, risk and selected assessment sections", () => {
  const html = renderUpcoming();
  assert.match(html, /Synthetic lab report/);
  assert.match(html, /At risk/);
  assert.match(html, /15%/);
  assert.match(html, /Open assessment: Synthetic lab report/);
  assert.match(html, /assessment=synthetic-assessment/);
  assert.match(
    renderUpcoming(syntheticInformationModel(), "all", "PRESSURE", "tasks"),
    /Draft report/,
  );
  assert.match(
    renderUpcoming(syntheticInformationModel(), "all", "PRESSURE", "sessions"),
    /Planned sessions/,
  );
});

test("Upcoming unknowns and inaccessible detail remain honest", () => {
  const model = syntheticInformationModel();
  model.selectedAssessment.dueAt = null;
  model.selectedAssessment.remainingMinutes = null;
  const html = renderUpcoming(model);
  assert.match(html, /Due date unknown/);
  assert.match(html, /Estimate unknown/);
  model.selectedAssessment = null;
  model.selectionUnavailable = true;
  const missing = renderUpcoming(model);
  assert.match(missing, /Assessment unavailable/);
  assert.doesNotMatch(missing, /Private exam/);
});

test("Inbox presents persisted raw state and a truthful empty state", () => {
  const model = {
    timezone: "America/Toronto",
    tabs: [
      { status: "ACTIVE", count: 1 },
      { status: "PROCESSED", count: 0 },
      { status: "DISMISSED", count: 0 },
    ],
    items: [
      {
        id: "synthetic-item",
        rawText: "Check synthetic lab notes",
        status: "ACTIVE",
        source: "MANUAL",
        sourceAuthority: "USER",
        proposedEntityType: null,
        proposedTitle: null,
        createdAt: new Date("2026-03-09T12:00:00Z"),
        processedAt: null,
      },
    ],
  };
  const html = renderInbox(model);
  assert.match(html, /Check synthetic lab notes/);
  assert.match(html, /Captured as raw text · details unresolved/);
  assert.match(html, /Quick capture/);
  assert.match(
    renderInbox({ tabs: model.tabs.map((tab) => ({ ...tab, count: 0 })), items: [] }),
    /Your inbox is clear/,
  );
});

test("Production information surfaces and route do not import preview fixtures", () => {
  for (const file of [
    "apps/web/src/server/application/information-reads.ts",
    "apps/web/src/components/upcoming-view.tsx",
    "apps/web/src/components/inbox-view.tsx",
    "apps/web/src/components/quick-capture.tsx",
    "apps/web/src/app/(planner)/upcoming/page.tsx",
    "apps/web/src/app/(planner)/inbox/page.tsx",
  ]) {
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /prototypes\/approved-preview|fixture|demoState/,
    );
  }
});

test("Upcoming route forwards only selected state and redirects signed-out users", async () => {
  const calls = [];
  let signedOut = false;
  const route = loadTs("apps/web/src/app/(planner)/upcoming/page.tsx", (name) => {
    if (name === "react/jsx-runtime") return webRequire(name);
    if (name === "../../../server/application/information-reads")
      return {
        informationViews: {
          upcoming: async (input) => {
            calls.push(input);
            return signedOut
              ? { ok: false, error: { code: "UNAUTHORIZED" } }
              : { ok: true, value: syntheticInformationModel(false) };
          },
        },
      };
    if (name === "next/navigation")
      return {
        redirect: (path) => {
          throw new Error(`redirect:${path}`);
        },
      };
    if (name === "../../../components/upcoming-view") return { UpcomingView: "div" };
    if (name === "../../../components/planner-primitives") return { InlineState: "div" };
    throw new Error(name);
  });
  await route.default({
    searchParams: Promise.resolve({
      assessment: "synthetic-id",
      range: "14",
      sort: "due",
      userId: "untrusted",
    }),
  });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { assessmentId: "synthetic-id", sort: "DUE" },
  ]);
  signedOut = true;
  await assert.rejects(
    () => route.default({ searchParams: Promise.resolve({}) }),
    /redirect:\/sign-in/,
  );
});

test("Quick Capture endpoint reports only confirmed raw-text persistence", async () => {
  const captured = [];
  const route = loadTs("apps/web/src/app/api/v1/inbox/capture/route.ts", (name) => {
    if (name === "../../../../../server/application/inbox")
      return {
        inboxItems: {
          capture: async (body) => {
            captured.push(body);
            return {
              ok: true,
              value: { id: "saved-id", status: "ACTIVE", userId: "private-user" },
            };
          },
        },
      };
    if (name === "../../../../../server/transport")
      return {
        bodyOf: async (request) =>
          request.headers.get("origin") === "https://planner.test"
            ? request.json()
            : Response.json({ error: "same origin required" }, { status: 403 }),
        respond: (result) =>
          Response.json(result.ok ? { data: result.value } : { error: result.error }, {
            status: result.ok ? 200 : 400,
          }),
      };
    throw new Error(name);
  });
  const make = (origin) =>
    new Request("https://planner.test/api/v1/inbox/capture", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ rawText: "Synthetic note" }),
    });
  assert.equal((await route.POST(make("https://other.test"))).status, 403);
  assert.equal(captured.length, 0);
  const saved = await route.POST(make("https://planner.test"));
  assert.deepEqual(JSON.parse(JSON.stringify(captured)), [{ rawText: "Synthetic note" }]);
  assert.deepEqual(await saved.json(), { data: { id: "saved-id", status: "ACTIVE" } });
});
