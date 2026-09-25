import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { renderOnboarding, renderPlannerSurface } from "../support/presentation-ui-render.mjs";

const css = readFileSync("apps/web/src/app/styles.css", "utf8");
function documentFor(html: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="main-content">${html}</main></body></html>`;
}
for (const width of [1440, 640, 390]) {
  test(`Planner and onboarding presentation fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(documentFor(renderOnboarding(4)));
    await expect(page.getByRole("heading", { name: "Availability" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.setContent(
      documentFor(
        `<aside class="right-panel" role="dialog" aria-modal="true" aria-label="Scenario preview"><div class="panel-heading"><h2>Scenario preview</h2></div>${renderPlannerSurface("scenario")}</aside>`,
      ),
    );
    await expect(page.getByRole("dialog", { name: "Scenario preview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply changes unavailable" })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test("Onboarding step URLs preserve browser Back and Forward", async ({ page }) => {
  await page.route("https://planner.test/onboarding**", async (route) => {
    const step = Number(new URL(route.request().url()).searchParams.get("step") ?? "1");
    await route.fulfill({ contentType: "text/html", body: documentFor(renderOnboarding(step)) });
  });
  await page.goto("https://planner.test/onboarding");
  await page.getByRole("link", { name: "Next step" }).click();
  expect(page.url()).toContain("step=2");
  await page.goBack();
  expect(page.url()).toBe("https://planner.test/onboarding");
  await page.goForward();
  expect(page.url()).toContain("step=2");
});
