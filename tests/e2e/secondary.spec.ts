import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  renderCourses,
  renderAvailability,
  renderSettings,
  renderIntegrations,
  courseModel,
} from "../support/secondary-ui-render.mjs";

const css = readFileSync("apps/web/src/app/styles.css", "utf8");
function documentFor(html: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="main-content">${html}</main></body></html>`;
}
for (const width of [1440, 640, 390]) {
  test(`secondary screens fit ${width}px and preserve readable sections`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [html, heading] of [
      [renderCourses(), "Courses"],
      [renderAvailability(), "Calendar & Availability"],
      [renderSettings(), "Settings"],
      [renderIntegrations(), "Integrations"],
    ] as const) {
      await page.setContent(documentFor(html));
      if (width < 640 && heading === "Courses") {
        await expect(page.getByRole("heading", { name: "Synthetic Mechanics" })).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    await page.setContent(documentFor(renderAvailability()));
    expect(await page.locator(".availability-agenda section").count()).toBe(7);
    await expect(
      page
        .locator(width < 900 ? ".availability-agenda" : ".availability-matrix")
        .getByText("Available for planning"),
    ).toBeVisible();
    await page.setContent(documentFor(renderCourses()));
    if (width < 640) {
      await expect(page.getByRole("navigation", { name: "Courses" })).toBeHidden();
      const close = page.getByRole("button", { name: "Close course detail" });
      expect((await close.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
  });
}
test("Course selection URL and Back retain the prior list context", async ({ page }) => {
  const list = renderCourses(courseModel(false));
  const detail = renderCourses(courseModel(true));
  await page.route("https://planner.test/courses**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      contentType: "text/html",
      body: documentFor(url.searchParams.has("course") ? detail : list),
    });
  });
  await page.goto("https://planner.test/courses");
  await page.getByRole("link", { name: /Synthetic Mechanics/ }).click();
  expect(page.url()).toContain("course=synthetic-course");
  await page.goBack();
  expect(page.url()).toBe("https://planner.test/courses");
  await page.goForward();
  expect(page.url()).toContain("course=synthetic-course");
});
