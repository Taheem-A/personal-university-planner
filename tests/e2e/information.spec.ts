import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  renderInbox,
  renderUpcoming,
  syntheticInformationModel,
} from "../support/information-ui-render.mjs";

const css = readFileSync("apps/web/src/app/styles.css", "utf8");
const inbox = renderInbox({
  timezone: "America/Toronto",
  tabs: [
    { status: "ACTIVE", count: 0 },
    { status: "PROCESSED", count: 0 },
    { status: "DISMISSED", count: 0 },
  ],
  items: [],
});
for (const width of [1440, 390, 640]) {
  test(`Assessment detail and Inbox fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(
      `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="main-content">${renderUpcoming()}</main></body></html>`,
    );
    await expect(page.getByRole("heading", { name: "Synthetic lab report" })).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
    const trigger = page.getByRole("link", { name: "Open assessment: Synthetic lab report" });
    await trigger.focus();
    await expect(trigger).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (width < 900) {
      const close = page.getByRole("button", { name: "Close detail" });
      expect((await close.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await page.setContent(
      `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="main-content">${inbox}</main></body></html>`,
    );
    await expect(page.getByText("Your inbox is clear")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test("Assessment URLs preserve parent range and browser history", async ({ page }) => {
  const model = syntheticInformationModel(false);
  const parent = renderUpcoming(model, "14", "DUE");
  const selected = renderUpcoming(syntheticInformationModel(), "14", "DUE");
  await page.route("https://planner.test/upcoming**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><style>${css}</style></head><body><main class="main-content">${url.searchParams.has("assessment") ? selected : parent}</main></body></html>`,
    });
  });
  await page.goto("https://planner.test/upcoming?range=14&sort=due");
  await page.getByRole("link", { name: "Open assessment: Synthetic lab report" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(page.url()).toContain("range=14&sort=due&assessment=synthetic-assessment");
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(page.url()).toContain("range=14&sort=due");
  await page.goForward();
  await expect(page.getByRole("dialog")).toBeVisible();
});
