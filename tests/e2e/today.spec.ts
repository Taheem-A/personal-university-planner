import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { renderToday, syntheticTodayModel } from "../support/today-ui-render.mjs";

const css = readFileSync("apps/web/src/app/styles.css", "utf8");
const html = renderToday(syntheticTodayModel());

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`synthetic Today renders and stays usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.setContent(
      `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="main-content">${html}</main></body></html>`,
    );
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Review synthetic lab notes" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Today's schedule" })).toBeVisible();
    await expect(page.getByText("Synthetic appointment")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const session = page.getByRole("link", { name: /Open session: SYN101/ });
    await session.focus();
    await expect(session).toBeFocused();
    if (viewport.width < 640) {
      const target = await session.boundingBox();
      expect(target?.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test("Today remains readable at a 200% equivalent viewport", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await page.setContent(
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="main-content">${html}</main></body></html>`,
  );
  await expect(page.getByText("Review synthetic lab notes").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
