import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import typescript from "typescript";

const webRequire = createRequire(path.resolve("apps/web/package.json"));
const React = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const root = path.resolve("apps/web/src/components");
const Link = React.forwardRef(({ href, children, ...props }, ref) =>
  React.createElement("a", { ...props, href, ref }, children),
);
Link.displayName = "TestLink";
function load(file, dependencies = {}) {
  const source = readFileSync(path.join(root, file), "utf8");
  const javascript = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      jsx: typescript.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  const require = (name) => {
    if (name === "next/link") return { __esModule: true, default: Link };
    if (name === "lucide-react") return webRequire(name);
    if (name === "./planner-primitives") return dependencies.primitives;
    if (name === "./course-color") return dependencies.courseColor;
    if (name === "./assessment-close")
      return {
        AssessmentClose: () =>
          React.createElement(
            "button",
            { className: "icon-button", "aria-label": "Close detail" },
            "Close",
          ),
      };
    if (name === "./quick-capture")
      return {
        QuickCapture: () =>
          React.createElement(
            "div",
            { className: "quick-capture" },
            React.createElement(
              "form",
              { "aria-label": "Quick capture" },
              React.createElement("input", { "aria-label": "Quick capture" }),
            ),
          ),
      };
    return webRequire(name);
  };
  vm.runInNewContext(javascript, { exports, require, Intl, Date, Map, Set, URL, Math });
  return exports;
}
const primitives = load("planner-primitives.tsx");
const courseColor = load("course-color.ts");
const { UpcomingView } = load("upcoming-view.tsx", { primitives, courseColor });
const { InboxView } = load("inbox-view.tsx");

export function syntheticInformationModel(selected = true) {
  const detail = {
    id: "synthetic-assessment",
    title: "Synthetic lab report",
    type: "Report",
    courseCode: "SYN101",
    courseName: "Synthetic course",
    courseColorReference: "indigo",
    releaseAt: null,
    dueAt: new Date("2026-03-12T20:00:00Z"),
    preferredCompletionAt: null,
    gradeWeight: 15,
    gradeReceived: null,
    notes: "Use synthetic measurements.",
    instructionsUrl: null,
    submissionUrl: null,
    submissionStatus: "NOT_SUBMITTED",
    submittedAt: null,
    source: "MANUAL",
    sourceAuthority: "USER",
    sourceConfidence: "MANUAL",
    remainingMinutes: 90,
    risk: "CRITICAL",
    tasks: [
      {
        id: "synthetic-task",
        title: "Draft report",
        status: "READY",
        remainingMinutes: 90,
        dueAt: null,
      },
    ],
    sessions: [
      {
        id: "synthetic-session",
        taskTitle: "Draft report",
        startAt: new Date("2026-03-10T14:00:00Z"),
        endAt: new Date("2026-03-10T15:00:00Z"),
        generatedBy: "PLANNER",
        locked: false,
      },
    ],
  };
  const groups = ["OVERDUE", "NEXT_7", "NEXT_14", "LATER", "UNKNOWN"].map((id) => ({
    id,
    items:
      id === "NEXT_7"
        ? [
            {
              id: detail.id,
              kind: "ASSESSMENT",
              title: detail.title,
              type: detail.type,
              courseCode: detail.courseCode,
              courseColorReference: detail.courseColorReference,
              dueAt: detail.dueAt,
              remainingMinutes: 90,
              status: "NOT_SUBMITTED",
              submissionStatus: "NOT_SUBMITTED",
              risk: "CRITICAL",
              group: id,
            },
          ]
        : [],
  }));
  return {
    timezone: "America/Toronto",
    anchorDate: "2026-03-09",
    groups,
    selectedAssessment: selected ? detail : null,
    selectionUnavailable: false,
    planner: { status: "CURRENT", authoritativeRun: { id: "synthetic-run" } },
  };
}
export function renderUpcoming(
  model = syntheticInformationModel(),
  range = "all",
  sort = "PRESSURE",
  view = "overview",
) {
  return renderToStaticMarkup(React.createElement(UpcomingView, { model, range, sort, view }));
}
export function renderInbox(model, status = "ACTIVE") {
  return renderToStaticMarkup(
    React.createElement(InboxView, { model, status, focusCapture: false }),
  );
}
