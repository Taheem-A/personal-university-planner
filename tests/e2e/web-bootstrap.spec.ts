import { expect, test } from "@playwright/test";

test("production Next.js runtime boots without fixture UI", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000");
  await expect(page.getByRole("heading", { name: "University Planner" })).toBeVisible();
  await expect(page.getByText(/Production runtime/i)).toBeVisible();
  await expect(page.getByText(/Canonical UI data/i)).toBeVisible();
});
