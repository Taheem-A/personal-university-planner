import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import typescript from "typescript";

const webRequire = createRequire(path.resolve("apps/web/package.json"));
const React = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const root = path.resolve("apps/web/src/components");

function load(file, overrides = {}) {
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
  const Link = React.forwardRef(({ href, children, ...props }, ref) =>
    React.createElement("a", { ...props, href, ref }, children),
  );
  Link.displayName = "TestLink";
  const require = (name) => {
    if (name === "next/link") return { __esModule: true, default: Link };
    if (name === "lucide-react") return webRequire(name);
    if (name === "./planner-primitives") return overrides.primitives;
    if (name === "./course-color") return { courseColor: () => "violet" };
    if (name === "./today-selection-close")
      return {
        TodaySelectionClose: () =>
          React.createElement("button", { "aria-label": "Close detail" }, "Close"),
      };
    return webRequire(name);
  };
  vm.runInNewContext(javascript, { exports, require, Intl, Date, Map, Set, URLSearchParams });
  return exports;
}

const primitives = load("planner-primitives.tsx");
const { TodayView } = load("today-view.tsx", { primitives });

export function renderToday(model, selectedSession = null, selectedTask = null) {
  return renderToStaticMarkup(
    React.createElement(TodayView, { model, selectedSession, selectedTask }),
  );
}

export function syntheticTodayModel(status = "CURRENT") {
  const at = (value) => new Date(value);
  const run = { id: "synthetic-run" };
  const work = {
    id: "synthetic-session",
    kind: "WORK",
    startAt: at("2026-03-09T18:00:00Z"),
    endAt: at("2026-03-09T19:00:00Z"),
    title: "Review synthetic lab notes",
    taskId: "synthetic-task",
    sourceId: "synthetic-session",
    courseCode: "SYN101",
    courseColorReference: "indigo",
    remainingMinutes: 90,
    dueAt: at("2026-03-11T20:00:00Z"),
    generatedBy: "PLANNER",
    locked: false,
    reasonCodes: [],
  };
  const fixed = {
    id: "synthetic-fixed",
    kind: "EVENT",
    startAt: at("2026-03-09T16:00:00Z"),
    endAt: at("2026-03-09T17:00:00Z"),
    title: "Synthetic appointment",
    sourceId: "synthetic-fixed",
    reasonCodes: [],
  };
  return {
    date: "2026-03-09",
    timezone: "America/Toronto",
    plannedWorkMinutes: 60,
    remainingPlannedWorkMinutes: 60,
    currentItem: null,
    nextItem: work,
    nextWorkItem: work,
    timeline: [fixed, work],
    remainingTasks: [
      {
        id: "synthetic-task",
        title: "Review synthetic lab notes",
        remainingMinutes: 90,
        dueAt: work.dueAt,
        assessmentId: null,
        courseCode: "SYN101",
        courseColorReference: "indigo",
      },
    ],
    risks: [],
    warnings: [],
    planner: {
      status,
      latestRun: status === "UNPLANNED" ? null : run,
      authoritativeRun:
        status === "CURRENT" || status === "RUNNING" || status === "FAILED" ? run : null,
      planningRevision: 1,
    },
  };
}
