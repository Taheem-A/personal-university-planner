import { expect, test } from "@playwright/test";

test("production Next.js shell and health boundary boot", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Production foundation ready.");
  await expect(page.getByText("Modular monolith")).toBeVisible();

  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    service: "university-planner-web",
  });
});

test("approved preview remains interactive and isolated", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173");
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText("Today");

  await page.locator('[data-route="week"]').first().click();
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText("Week");
  expect(await page.locator(".week-event").count()).toBeGreaterThanOrEqual(20);

  await page.locator('[data-action="scenario-saturday"]').click();
  await expect(page.locator(".right-panel")).toContainText("Take Saturday off");
  await expect(page.locator(".week-event.ghost")).toHaveCount(1);
});
