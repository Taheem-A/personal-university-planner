import { expect, test } from "@playwright/test";

test("approved preview remains navigable as a regression reference", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173");
  await expect(page.getByRole("heading", { name: "Today" }).first()).toBeVisible();

  await page.locator('[data-route="week"]').first().click();
  await expect(page.getByRole("heading", { name: "Week" }).first()).toBeVisible();

  await page.locator('[data-action="scenario-saturday"]').click();
  await expect(page.locator(".right-panel")).toContainText("Take Saturday off");

  await page.locator('[data-action="cancel-scenario"]').click();
  await page.locator('[data-route="inbox"]').first().click();
  await expect(page.getByRole("heading", { name: "Inbox" }).first()).toBeVisible();
});
