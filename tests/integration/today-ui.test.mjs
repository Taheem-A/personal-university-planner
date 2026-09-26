import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import typescript from "typescript";
import { renderToday, syntheticTodayModel } from "../support/today-ui-render.mjs";

test("Today renders canonical-shaped work, fixed events, due context and deferred actions", () => {
  const html = renderToday(syntheticTodayModel());
  assert.match(html, /Review synthetic lab notes/);
  assert.match(html, /Synthetic appointment/);
  assert.match(html, /SYN101/);
  assert.match(html, /1h planned work remaining/);
  assert.match(html, /Due Mar 11/);
  assert.match(html, /href="\/today\?date=2026-03-09&amp;session=synthetic-session"/);
  assert.match(html, /Mark complete<\/button>/);
  assert.match(html, /disabled=""/);
  assert.doesNotMatch(html, /Production foundation ready|CIV100|MAT186/);
});

test("CURRENT, RUNNING, FAILED and UNPLANNED have honest planner language", () => {
  const current = renderToday(syntheticTodayModel("CURRENT"));
  assert.match(current, /Plan current/);
  const running = renderToday(syntheticTodayModel("RUNNING"));
  assert.match(running, /Updating plan/);
  assert.match(running, /Showing the last successful plan/);
  const failed = renderToday(syntheticTodayModel("FAILED"));
  assert.match(failed, /Plan update failed/);
  assert.match(failed, /failed update did not replace it/);
  assert.doesNotMatch(failed, /Plan current/);
  const unplanned = syntheticTodayModel("UNPLANNED");
  unplanned.timeline = unplanned.timeline.filter((item) => item.kind !== "WORK");
  unplanned.currentItem = null;
  unplanned.nextItem = unplanned.timeline[0];
  unplanned.nextWorkItem = null;
  unplanned.plannedWorkMinutes = 0;
  unplanned.remainingPlannedWorkMinutes = 0;
  const unplannedHtml = renderToday(unplanned);
  assert.match(unplannedHtml, /No plan yet/);
  assert.match(unplannedHtml, /Synthetic appointment/);
  assert.doesNotMatch(unplannedHtml, /Review synthetic lab notes, 2:00/);
});

test("Today covers empty, no current/next, unknowns, long titles and risk", () => {
  const model = syntheticTodayModel();
  model.currentItem = null;
  model.nextItem = null;
  model.nextWorkItem = null;
  model.timeline = [];
  model.remainingTasks = [];
  model.plannedWorkMinutes = 0;
  model.remainingPlannedWorkMinutes = 0;
  let html = renderToday(model);
  assert.match(html, /Nothing else is scheduled today/);
  assert.match(html, /Nothing else needs your attention today/);
  model.remainingTasks = [
    {
      id: "long-task",
      title: "A very long synthetic assignment title ".repeat(15),
      remainingMinutes: null,
      dueAt: null,
      assessmentId: null,
      courseCode: null,
      courseColorReference: null,
    },
  ];
  model.risks = [
    {
      taskId: "long-task",
      title: "Long task",
      courseCode: null,
      feasibility: "INFEASIBLE",
      deficitMinutes: 45,
      slackMinutes: null,
    },
  ];
  model.warnings = [{ code: "NO_SUITABLE_WINDOW", reasonCodes: [] }];
  html = renderToday(model, null, "long-task");
  assert.match(html, /Estimate unknown/);
  assert.match(html, /Due date unknown/);
  assert.match(html, /Doesn’t currently fit/);
  assert.match(html, /45m short/);
  assert.match(html, /Some work has no suitable time window/);
  assert.match(html, /aria-labelledby="today-detail-title"/);
});

test("Today route passes only the validated date query to the application read service", async () => {
  const source = readFileSync("apps/web/src/app/(planner)/today/page.tsx", "utf8");
  const javascript = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      jsx: typescript.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
  const calls = [];
  const exports = {};
  const require = (name) => {
    if (name === "../../../server/application/planner-reads")
      return {
        plannerViews: {
          today: async (input) => {
            calls.push(input);
            return { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid date" } };
          },
        },
      };
    if (name === "next/navigation")
      return {
        redirect: () => {
          throw new Error("unexpected redirect");
        },
      };
    if (name === "next/link") return { __esModule: true, default: "a" };
    if (name === "../../../components/planner-primitives") return { InlineState: "div" };
    if (name === "../../../components/today-view") return { TodayView: "div" };
    return webRequire(name);
  };
  vm.runInNewContext(javascript, { exports, require });
  const result = await exports.default({
    searchParams: Promise.resolve({ date: "bad-date", userId: "untrusted" }),
  });
  assert.equal(result.type, "div");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ date: "bad-date" }]);
});
