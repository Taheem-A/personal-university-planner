import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import typescript from "typescript";
import { renderPlannerSurface } from "./presentation-ui-render.mjs";

const webRequire = createRequire(path.resolve("apps/web/package.json"));
const React = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const Link = React.forwardRef(({ href, children, ...props }, ref) =>
  React.createElement("a", { ...props, href, ref }, children),
);
Link.displayName = "TestLink";
const source = readFileSync("apps/web/src/components/app-shell.tsx", "utf8");
const javascript = typescript.transpileModule(source, {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    jsx: typescript.JsxEmit.ReactJSX,
    esModuleInterop: true,
    target: typescript.ScriptTarget.ES2022,
  },
}).outputText;

export function renderShell(pathname, content, query = "") {
  const exports = {};
  const require = (name) => {
    if (name === "next/link") return { __esModule: true, default: Link };
    if (name === "next/navigation")
      return {
        usePathname: () => pathname,
        useSearchParams: () => new URLSearchParams(query),
        useRouter: () => ({ replace() {}, push() {} }),
      };
    if (name === "next-auth/react") return { signOut() {} };
    if (name === "motion/react")
      return {
        AnimatePresence: ({ children }) => children,
        motion: { aside: "aside" },
        useReducedMotion: () => false,
      };
    if (name === "lucide-react") return webRequire(name);
    if (name === "./appearance-control")
      return {
        AppearanceControl: () =>
          React.createElement(
            "button",
            { className: "icon-button", "aria-label": "Use dark appearance" },
            React.createElement(webRequire("lucide-react").Sun, {
              size: 18,
              "aria-hidden": "true",
            }),
          ),
      };
    if (name === "./planner-surface")
      return {
        PlannerSurface: ({ kind }) =>
          React.createElement("div", {
            dangerouslySetInnerHTML: { __html: renderPlannerSurface(kind) },
          }),
      };
    return webRequire(name);
  };
  vm.runInNewContext(javascript, { exports, require, URLSearchParams });
  return renderToStaticMarkup(
    React.createElement(
      exports.AppShell,
      null,
      React.createElement("div", { dangerouslySetInnerHTML: { __html: content } }),
    ),
  );
}
