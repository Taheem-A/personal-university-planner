import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { renderWeek, syntheticWeekModel } from "../support/week-ui-render.mjs";

const css = readFileSync("apps/web/src/app/styles.css", "utf8");
const html = renderWeek(syntheticWeekModel());

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Week uses the approved ${viewport.width}px representation`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.setContent(
      `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="main-content">${html}</main></body></html>`,
    );
    await expect(page.getByRole("heading", { level: 1, name: "Week" })).toBeVisible();
    if (viewport.width > 899) {
      await expect(page.getByLabel("Seven-day planning calendar")).toBeVisible();
      expect(await page.locator("[data-week-column]").count()).toBe(7);
    } else {
      await expect(page.getByRole("navigation", { name: "Select day" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Monday, March 9" })).toBeVisible();
      const day = page
        .getByRole("navigation", { name: "Select day" })
        .getByRole("link", { name: /Mon/ });
      expect((await day.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    const link = page
      .getByRole("link", { name: /Open SYN101, Review synthetic lab notes/ })
      .first();
    await link.focus();
    await expect(link).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test("Week remains usable at a 200% equivalent viewport", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await page.setContent(
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="main-content">${html}</main></body></html>`,
  );
  await expect(page.getByRole("heading", { name: "Workload overview" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Select day" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
