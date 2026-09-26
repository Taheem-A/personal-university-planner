import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderOnboarding, renderPlannerSurface } from "../support/presentation-ui-render.mjs";

test("Planner panel offers navigation and a truthful command boundary", () => {
  const html = renderPlannerSurface("planner");
  assert.match(html, /Search destinations or ask Planner/);
  assert.match(html, /Planner destinations/);
  assert.match(html, /\/week\?date=2026-03-02&amp;panel=planner&amp;scenario=preview/);
  assert.match(html, /Loading recorded plan context/);
  const source = readFileSync("apps/web/src/components/planner-surface.tsx", "utf8");
  assert.doesNotMatch(
    source,
    /@university-planner\/assistant|interpret\(|execute\(|method:\s*["']POST/,
  );
  assert.match(source, /fetch\("\/api\/v1\/planner\/presentation"/);
});
test("Scenario and conflict shells cannot apply or simulate in the browser", () => {
  const scenario = renderPlannerSurface("scenario");
  const conflict = renderPlannerSurface("conflict");
  assert.match(scenario, /No structured scenario has been prepared/);
  assert.match(scenario, /Apply changes unavailable/);
  assert.match(scenario, />Cancel<\/button>/);
  assert.match(scenario, /disabled=""/);
  assert.match(conflict, /Only recorded planner findings are shown/);
  assert.match(conflict, /Apply resolution unavailable/);
  assert.doesNotMatch(
    readFileSync("apps/web/src/components/planner-surface.tsx", "utf8"),
    /simulateProtectedWindow|plannerRuns\.create|workSessions\.create/,
  );
});
test("Onboarding steps are URL-backed and never claim canonical completion", () => {
  const first = renderOnboarding();
  const last = renderOnboarding(6);
  assert.match(first, /Synthetic Spring · active/);
  assert.match(first, /href="\/onboarding\?step=2"/);
  assert.match(last, /No successful plan recorded/);
  assert.match(last, /does not create a term or generate a plan/);
  assert.doesNotMatch(last, /Generate plan<\/button>/);
});
test("presentation routes stay authenticated and fixture-free", () => {
  const paths = [
    "apps/web/src/app/(planner)/onboarding/page.tsx",
    "apps/web/src/app/api/v1/planner/presentation/route.ts",
    "apps/web/src/server/application/planner-presentation-reads.ts",
  ];
  const contents = paths.map((path) => readFileSync(path, "utf8")).join("\n");
  assert.match(contents, /secondaryViews\.onboarding\(\)/);
  assert.match(contents, /plannerViews\.today\(\)/);
  assert.match(contents, /redirect\("\/sign-in"\)/);
  assert.doesNotMatch(contents, /prototypes\/approved-preview|fixtures/);
});
