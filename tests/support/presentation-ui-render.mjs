import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import typescript from "typescript";

const webRequire = createRequire(path.resolve("apps/web/package.json"));
const React = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const Link = ({ href, children, ...props }) =>
  React.createElement("a", { ...props, href }, children);
const icon = () => React.createElement("svg", { "aria-hidden": "true" });
function load(file) {
  const source = readFileSync(path.resolve("apps/web/src/components", file), "utf8");
  const javascript = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      jsx: typescript.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  const require = (name) =>
    name === "next/link"
      ? { __esModule: true, default: Link }
      : name === "lucide-react"
        ? new Proxy({}, { get: () => icon })
        : webRequire(name);
  vm.runInNewContext(
    javascript,
    { exports, require, Date, Intl, URLSearchParams },
    { filename: file },
  );
  return exports;
}
const { OnboardingView } = load("onboarding-view.tsx");
const { PlannerSurface } = load("planner-surface.tsx");
export const onboardingModel = {
  timezone: "America/Toronto",
  term: { name: "Synthetic Spring", status: "ACTIVE" },
  courseCount: 2,
  meetingCount: 3,
  availabilityCount: 2,
  protectedCount: 1,
  assessmentCount: 4,
  taskCount: 6,
  hasSuccessfulPlan: false,
  needsSetup: true,
};
export const renderOnboarding = (step = 1, model = onboardingModel) =>
  renderToStaticMarkup(React.createElement(OnboardingView, { model, step }));
export const renderPlannerSurface = (kind = "planner") =>
  renderToStaticMarkup(
    React.createElement(PlannerSurface, {
      kind,
      pathname: "/week",
      search: "date=2026-03-02&panel=planner",
      onClose: () => {},
    }),
  );
