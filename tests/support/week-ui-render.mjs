import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import typescript from "typescript";
import { syntheticTodayModel } from "./today-ui-render.mjs";

const webRequire = createRequire(path.resolve("apps/web/package.json"));
const React = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const root = path.resolve("apps/web/src/components");
const sharedSource = readFileSync("packages/shared/src/time.ts", "utf8");
const sharedExports = {};
vm.runInNewContext(
  typescript.transpileModule(sharedSource, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText,
  { exports: sharedExports, Date, Intl, Math, RangeError, Error, Number, String, Set, Map },
);
const Link = React.forwardRef(({ href, children, ...props }, ref) =>
  React.createElement("a", { ...props, href, ref }, children),
);
Link.displayName = "TestLink";

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
  const require = (name) => {
    if (name === "next/link") return { __esModule: true, default: Link };
    if (name === "lucide-react") return webRequire(name);
    if (name === "./planner-primitives") return overrides.primitives;
    if (name === "./course-color") return overrides.courseColor;
    if (name === "./week-layout") return overrides.layout;
    if (name === "./week-interactions")
      return {
        WeekSelectionClose: () =>
          React.createElement("button", { "aria-label": "Close detail" }, "Close"),
        WeekSwipe: ({ children }) => React.createElement("div", null, children),
      };
    if (name === "@university-planner/shared") return sharedExports;
    return webRequire(name);
  };
  vm.runInNewContext(javascript, { exports, require, Intl, Date, Map, Set, URLSearchParams, Math });
  return exports;
}
const primitives = load("planner-primitives.tsx");
const courseColor = load("course-color.ts");
const layout = load("week-layout.ts");
const { WeekView } = load("week-view.tsx", { primitives, courseColor, layout });

export const layoutWeek = layout.layoutWeek;
export function renderWeek(
  model,
  selectedDay = model.weekStart,
  selectedSession = null,
  selectedEvent = null,
  selectedDeadline = null,
) {
  return renderToStaticMarkup(
    React.createElement(WeekView, {
      model,
      selectedDay,
      selectedSession,
      selectedEvent,
      selectedDeadline,
      currentDate: "2026-03-09",
    }),
  );
}
export function syntheticWeekModel(status = "CURRENT") {
  const today = syntheticTodayModel(status);
  const days = Array.from({ length: 7 }, (_, index) => ({
    date: `2026-03-${String(9 + index).padStart(2, "0")}`,
    plannedWorkMinutes: index === 0 ? 60 : 0,
    availabilityWindowMinutes: index === 0 ? 120 : 0,
    riskTaskIds: index === 0 ? ["synthetic-task"] : [],
  }));
  return {
    weekStart: "2026-03-09",
    weekEnd: "2026-03-16",
    timezone: "America/Toronto",
    days,
    schedule: today.timeline,
    deadlines: [
      {
        id: "synthetic-assessment",
        kind: "ASSESSMENT",
        title: "Synthetic lab report",
        dueAt: new Date("2026-03-12T20:00:00Z"),
        courseCode: "SYN101",
        courseColorReference: "indigo",
      },
    ],
    risks: today.risks,
    warnings: today.warnings,
    planner: today.planner,
    latestChange: {
      moved: [],
      added: [],
      removed: [],
      retained: [],
      newlyAtRisk: [],
      worsenedRisk: [],
      improvedRisk: [],
      resolvedRisk: [],
      unchangedRisk: [],
    },
    activeTermRange: { startDate: "2026-01-01", endDate: "2026-04-30" },
  };
}
