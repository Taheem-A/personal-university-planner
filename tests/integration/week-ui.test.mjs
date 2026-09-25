import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import typescript from "typescript";
import { layoutWeek, renderWeek, syntheticWeekModel } from "../support/week-ui-render.mjs";

test("Week renders canonical-shaped schedule, capacity, deadline and navigation", () => {
  const html = renderWeek(syntheticWeekModel());
  assert.match(html, /Seven-day planning calendar/);
  assert.equal((html.match(/data-week-column=/g) ?? []).length, 7);
  assert.match(html, /Review synthetic lab notes/);
  assert.match(html, /Synthetic appointment/);
  assert.match(html, /Synthetic lab report/);
  assert.match(html, /2h available/);
  assert.match(html, /Previous week/);
  assert.match(html, /date=2026-03-02/);
  assert.match(html, /date=2026-03-16/);
  assert.match(html, /Read week as a day-by-day list/);
  assert.doesNotMatch(html, /CIV100|MAT186|Production foundation ready/);
});

test("Week states, empty periods, risks and plan changes remain honest", () => {
  for (const [status, message] of [
    ["CURRENT", "Plan current"],
    ["RUNNING", "Updating plan"],
    ["FAILED", "Plan update failed"],
    ["UNPLANNED", "No plan yet"],
  ]) {
    const model = syntheticWeekModel(status);
    if (status === "UNPLANNED")
      model.schedule = model.schedule.filter((item) => item.kind !== "WORK");
    const html = renderWeek(model);
    assert.match(html, new RegExp(message));
    if (status === "FAILED") assert.match(html, /failed update did not replace/);
  }
  const model = syntheticWeekModel();
  model.schedule = [];
  model.deadlines = [];
  model.activeTermRange = { startDate: "2026-04-01", endDate: "2026-08-30" };
  model.risks = [
    {
      taskId: "synthetic-task",
      title: "Synthetic work",
      courseCode: "SYN101",
      feasibility: "INFEASIBLE",
      deficitMinutes: 45,
      slackMinutes: null,
    },
  ];
  model.latestChange.moved = [
    {
      fromSessionId: "a",
      toSessionId: "b",
      taskId: "synthetic-task",
      fromStartAt: "2026-03-09T18:00:00Z",
      toStartAt: "2026-03-10T18:00:00Z",
    },
  ];
  const html = renderWeek(model);
  assert.match(html, /No commitments scheduled for this day/);
  assert.match(html, /No deadlines this week/);
  assert.match(html, /outside the active academic term/);
  assert.match(html, /45m does not fit/);
  assert.match(html, /1 moved/);
});

test("pure layout clips midnight and assigns deterministic overlap lanes", () => {
  const item = (id, start, end) => ({
    id,
    kind: "EVENT",
    startAt: new Date(start),
    endAt: new Date(end),
    title: id,
    sourceId: id,
    reasonCodes: [],
  });
  const segments = layoutWeek(
    [
      item("cross", "2026-03-10T02:00:00Z", "2026-03-10T06:00:00Z"),
      item("a", "2026-03-09T14:00:00Z", "2026-03-09T15:00:00Z"),
      item("b", "2026-03-09T14:30:00Z", "2026-03-09T15:30:00Z"),
      item("c", "2026-03-09T15:30:00Z", "2026-03-09T16:00:00Z"),
    ],
    "2026-03-09",
    "America/Toronto",
  );
  const monday = segments[0];
  assert.equal(monday.find((s) => s.item.id === "a").startMinute, 600);
  assert.equal(monday.find((s) => s.item.id === "a").laneCount, 2);
  assert.equal(monday.find((s) => s.item.id === "b").lane, 1);
  assert.equal(monday.find((s) => s.item.id === "c").lane, 0);
  assert.equal(monday.find((s) => s.item.id === "cross").continuesAfter, true);
  assert.equal(segments[1].find((s) => s.item.id === "cross").continuesBefore, true);
});

test("layout uses explicit timezone through DST and never browser-local time", () => {
  const item = (start, end) => ({
    id: "dst",
    kind: "EVENT",
    startAt: new Date(start),
    endAt: new Date(end),
    title: "DST",
    sourceId: "dst",
    reasonCodes: [],
  });
  const spring = layoutWeek(
    [item("2026-03-08T06:30:00Z", "2026-03-08T07:30:00Z")],
    "2026-03-02",
    "America/Toronto",
  )[6][0];
  assert.equal(spring.startMinute, 90);
  assert.equal(spring.endMinute, 210);
  const fall = layoutWeek(
    [item("2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z")],
    "2026-10-26",
    "America/Toronto",
  )[6][0];
  assert.equal(fall.startMinute, 90);
  assert.ok(fall.endMinute > fall.startMinute);
});

test("Week route sends only date to authenticated service and validates selected day", async () => {
  const source = readFileSync("apps/web/src/app/(planner)/week/page.tsx", "utf8");
  const js = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      jsx: typescript.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
  const calls = [];
  const values = {};
  const require = (name) => {
    if (name === "../../../server/application/planner-reads")
      return {
        plannerViews: {
          week: async (input) => {
            calls.push(input);
            return { ok: true, value: syntheticWeekModel() };
          },
        },
      };
    if (name === "../../../components/week-view")
      return {
        WeekView: (props) => {
          values.props = props;
          return null;
        },
      };
    if (name === "@university-planner/shared")
      return { instantToLocal: () => ({ date: "2026-03-09" }) };
    if (name === "next/navigation") return { redirect: () => {} };
    if (name === "next/link") return { __esModule: true, default: () => null };
    if (name === "../../../components/planner-primitives") return { InlineState: () => null };
    return webRequire(name);
  };
  vm.runInNewContext(js, { exports: values, require, Date, Intl });
  const element = await values.default({
    searchParams: Promise.resolve({ date: "2026-03-10", day: "2026-04-01", userId: "forged" }),
  });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ date: "2026-03-10" }]);
  assert.equal(element.props.selectedDay, "2026-03-09");
  assert.doesNotMatch(source, /approved-preview|fixtures/);
});
