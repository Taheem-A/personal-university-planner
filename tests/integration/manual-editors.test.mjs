import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const React = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
function component(file, stubs = {}) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(`apps/web/src/components/${file}.tsx`, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(js, {
    exports,
    require: (name) => stubs[name] ?? webRequire(name),
    Date,
    Intl,
    Number,
    Object,
    Array,
    Boolean,
    Error,
  });
  return exports;
}
const shared = {
  instantToLocal: () => ({ date: "2026-09-01", time: "09:00" }),
  localDateTimeToInstant: () => new Date("2026-09-01T13:00:00Z"),
};
const fields = component("mutation-form", { "@university-planner/shared": shared });
const editors = component("manual-editors", {
  "next/navigation": { useRouter: () => ({ refresh() {}, replace() {} }) },
  "@university-planner/shared": shared,
  "./mutation-form": fields,
  "./mutation-client": {
    submitMutation: async () => {
      throw Error("SSR must not mutate");
    },
  },
});
function render(Component, props) {
  return renderToStaticMarkup(React.createElement(Component, props));
}
const term = {
  id: "term",
  version: 0,
  name: "Fall",
  startDate: "2026-09-01",
  endDate: "2026-12-20",
  status: "ACTIVE",
};

test("manual editors expose labelled keyboard controls and explicit archive confirmation", () => {
  const termHtml = render(editors.TermEditor, { term, returnTo: "/courses" });
  assert.match(termHtml, /Term status/);
  assert.match(termHtml, /I understand that term will be archived/);
  assert.match(termHtml, /disabled=""[^>]*>Archive term/);
  assert.match(termHtml, /href="\/courses"/);
  const courseHtml = render(editors.CourseEditor, {
    terms: [term],
    timezone: "America/Toronto",
    returnTo: "/courses",
  });
  assert.match(courseHtml, /Academic term/);
  assert.match(courseHtml, /Course code/);
  assert.match(courseHtml, /Default task energy/);
  const meetingHtml = render(editors.MeetingEditor, {
    courses: [{ id: "course", code: "CSC101", name: "Computing", termStatus: "ACTIVE" }],
    timezone: "America/Toronto",
    returnTo: "/courses?course=course",
  });
  assert.match(meetingHtml, /Meeting days/);
  assert.match(meetingHtml, /Local start time/);
  assert.match(meetingHtml, /Attendance required/);
  assert.match(meetingHtml, /href="\/courses\?course=course"/);
  const eventHtml = render(editors.EventEditor, {
    model: { timezone: "America/Toronto", courseChoices: [] },
    returnTo: "/availability?date=2026-09-01",
  });
  assert.match(eventHtml, /Hard commitment/);
  assert.match(eventHtml, /Local time in America\/Toronto/);
  assert.match(eventHtml, /type="datetime-local"/);
  for (const html of [termHtml, courseHtml, meetingHtml, eventHtml]) {
    assert.match(html, /<label for="[^"]+">/);
    assert.match(html, /<button[^>]+type="submit"/);
    assert.match(html, /<button[^>]+type="button"[^>]*>Cancel/);
  }
});
