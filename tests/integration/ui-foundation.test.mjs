import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import typescript from "typescript";

const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const React = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");

function renderShell(pathname, query = "") {
  const source = readFileSync("apps/web/src/components/app-shell.tsx", "utf8");
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
  const icon = () => React.createElement("svg", { "aria-hidden": "true" });
  const require = (name) => {
    if (name === "next/link") return { __esModule: true, default: Link };
    if (name === "next/navigation")
      return {
        usePathname: () => pathname,
        useSearchParams: () => new URLSearchParams(query),
        useRouter: () => ({ replace() {}, push() {} }),
      };
    if (name === "motion/react")
      return {
        AnimatePresence: ({ children }) => children,
        motion: { aside: "aside" },
        useReducedMotion: () => false,
      };
    if (name === "lucide-react") return new Proxy({}, { get: () => icon });
    if (name === "./appearance-control")
      return {
        AppearanceControl: () =>
          React.createElement("button", { "aria-label": "Use dark appearance" }),
      };
    if (name === "./planner-surface")
      return { PlannerSurface: ({ kind }) => React.createElement("div", null, `${kind} context`) };
    return webRequire(name);
  };
  vm.runInNewContext(javascript, { exports, require, URLSearchParams });
  return renderToStaticMarkup(
    React.createElement(exports.AppShell, null, React.createElement("h1", null, "Week")),
  );
}

test("authenticated shell renders primary and mobile navigation with selected state", () => {
  const html = renderShell("/week");
  assert.match(html, /aria-label="Primary navigation"/);
  assert.match(html, /aria-label="Mobile navigation"/);
  assert.match(html, /class="nav-link active" aria-current="page" title="Week" href="\/week"/);
  for (const label of [
    "Today",
    "Week",
    "Upcoming",
    "Inbox",
    "Courses",
    "Availability",
    "Integrations",
    "Settings",
  ])
    assert.match(html, new RegExp(label));
  assert.match(html, /aria-label="Quick Add"/);
  assert.match(html, /Search or ask planner/);
  assert.match(html, /class="skip-link" href="#main-content"/);
  assert.match(html, /id="main-content" tabindex="-1"/);
});

test("URL-driven Planner panel and theme, reduced-motion tokens are present", () => {
  const html = renderShell("/week", "panel=planner");
  assert.match(html, /aria-label="Planner panel"/);
  assert.match(html, /<h2>Planner<\/h2>/);
  assert.match(html, /aria-modal="true"/);
  assert.doesNotMatch(renderShell("/week"), /aria-label="Planner panel"/);
  assert.match(renderShell("/week", "scenario=preview"), /aria-label="Scenario preview"/);
  assert.match(renderShell("/week", "conflict=overview"), /aria-label="Conflict resolution"/);
  const shellSource = readFileSync("apps/web/src/components/app-shell.tsx", "utf8");
  assert.match(shellSource, /event\.key === "Escape"\) closePanel\(\)/);
  assert.match(shellSource, /event\.key === "Tab" && panelRef\.current/);
  assert.match(shellSource, /triggerRef\.current\?\.focus\(\)/);
  assert.match(shellSource, /menuCloseRef\.current\?\.focus\(\)/);
  assert.match(shellSource, /menuTriggerRef\.current\?\.focus\(\)/);
  assert.match(shellSource, /accountTriggerRef\.current\?\.focus\(\)/);
  assert.match(shellSource, /role="dialog"/);
  assert.match(shellSource, /aria-modal="true"/);
  assert.match(shellSource, /next\.delete\("scenario"\)/);
  const css = readFileSync("apps/web/src/app/styles.css", "utf8");
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /--sidebar-width: 228px/);
  assert.match(css, /--sidebar-rail-width: 64px/);
  assert.match(css, /--topbar-height: 56px/);
  assert.match(css, /max-width: 639px/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /\.skip-link:focus/);
});

test("client/server and preview fixture imports fail the package boundary", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ui-boundary-"));
  const checker = path.resolve("scripts/check-package-boundaries.mjs");
  try {
    mkdirSync(path.join(root, "apps/web/src/components"), { recursive: true });
    mkdirSync(path.join(root, "packages/planner-core"), { recursive: true });
    writeFileSync(
      path.join(root, "packages/planner-core/package.json"),
      JSON.stringify({ dependencies: {} }),
    );
    const source = path.join(root, "apps/web/src/components/bad.tsx");
    for (const [code, message] of [
      [
        '"use client"; import x from "../server/application/planner";',
        /client components cannot import server/,
      ],
      [
        'import x from "prototypes/approved-preview/app.js";',
        /cannot import preview or test fixtures/,
      ],
      [
        'import x from "../../../../tests/support/today-ui-render.mjs";',
        /cannot import preview or test fixtures/,
      ],
      [
        'export const copiedDemo = "CIV100 at Robarts Library";',
        /approved-preview fixture signature/,
      ],
    ]) {
      writeFileSync(source, code);
      const result = spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, message);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
