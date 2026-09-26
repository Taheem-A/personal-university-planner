import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { chromium } from "@playwright/test";

const url = process.env.M5_UI_TEST_DATABASE_URL;
const base = process.env.M5_UI_BROWSER_URL;
const secret = process.env.AUTH_SECRET;
if (
  process.env.CONFIRM_M5_UI_DATABASE !== "RUN_M5_REAL_STATE_PROOF" ||
  !url ||
  !base ||
  !secret ||
  secret.length < 32
)
  throw new Error("A confirmed disposable Milestone-5 browser environment is required.");
const parsed = new URL(url);
const origin = new URL(base);
if (
  !parsed.hostname.endsWith(".neon.tech") ||
  parsed.hostname.includes("-pooler") ||
  !/^up_test_m5_ui_gate_[a-z0-9_]+$/.test(decodeURIComponent(parsed.pathname.slice(1))) ||
  !["127.0.0.1", "localhost"].includes(origin.hostname)
)
  throw new Error("Use a direct disposable Neon database and a localhost browser server only.");

const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { encode } = webRequire("next-auth/jwt");
const actorId = "seed-user-engineering-fall-2026";

test("real protected routes render canonical synthetic state in Chromium", async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${base}/today?date=2026-09-25`);
    assert.match(page.url(), /\/sign-in$/);
    const token = await encode({
      token: { userId: actorId, sub: actorId },
      secret,
      maxAge: 3600,
    });
    await context.addCookies([
      {
        name: "next-auth.session-token",
        value: token,
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const screens = [
      ["today", "/today?date=2026-09-25", "MAT186"],
      ["week", "/week?date=2026-09-25", "MAT186"],
      ["upcoming", "/upcoming", "Materials Comparison Memo"],
      ["inbox", "/inbox", "Ask the design team"],
      ["courses", "/courses", "MAT186"],
      ["availability", "/availability?date=2026-09-25", "Synthetic sleep window"],
      ["settings", "/settings", "America/Toronto"],
      ["integrations", "/integrations", "Google Calendar"],
      ["onboarding", "/onboarding?step=1", "Fall 2026"],
    ];
    const output = process.env.M5_UI_AUTH_CAPTURE_DIR
      ? path.resolve(process.env.M5_UI_AUTH_CAPTURE_DIR)
      : null;
    if (output) mkdirSync(output, { recursive: true });
    for (const [name, route, expected] of screens) {
      const response = await page.goto(`${base}${route}`);
      assert.equal(response?.status(), 200, `${route} should be a protected successful route`);
      await page.getByText(new RegExp(expected, "i")).first().waitFor();
      assert.match(await page.locator("main").innerText(), new RegExp(expected, "i"));
      assert.equal(page.url().endsWith("/sign-in"), false);
      if (output && ["today", "week", "upcoming", "courses"].includes(name)) {
        await page.screenshot({
          path: path.join(output, `${name}-desktop-light.png`),
          fullPage: true,
        });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/today?date=2026-09-25`);
    assert.equal(
      await page.getByRole("navigation", { name: "Mobile navigation" }).isVisible(),
      true,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    if (output)
      await page.screenshot({ path: path.join(output, "today-mobile-light.png"), fullPage: true });
    await context.close();

    // A second canonical actor has a real successful PlannerRun and generated sessions.
    const plannedId = "m5-ui-gate-plan-ready";
    const plannedContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const plannedToken = await encode({
      token: { userId: plannedId, sub: plannedId },
      secret,
      maxAge: 3600,
    });
    await plannedContext.addCookies([
      {
        name: "next-auth.session-token",
        value: plannedToken,
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const plannedPage = await plannedContext.newPage();
    await plannedPage.goto(`${base}/today?date=2026-09-28`);
    await plannedPage.getByText("Complete synthetic design exercise").first().waitFor();
    assert.match(await plannedPage.locator("main").innerText(), /Plan current/);
    if (output)
      await plannedPage.screenshot({
        path: path.join(output, "today-planned-desktop-light.png"),
        fullPage: true,
      });
    await plannedPage.getByRole("button", { name: "Use dark appearance" }).click();
    assert.equal(await plannedPage.locator("html").getAttribute("data-theme"), "dark");
    await plannedPage.reload();
    assert.equal(await plannedPage.locator("html").getAttribute("data-theme"), "dark");
    if (output)
      await plannedPage.screenshot({
        path: path.join(output, "today-planned-desktop-dark.png"),
        fullPage: true,
      });
    await plannedPage.goto(`${base}/week?date=2026-09-28`);
    await plannedPage.getByText("Complete synthetic design exercise").first().waitFor();
    assert.match(await plannedPage.locator("main").innerText(), /Plan current/);
    if (output)
      await plannedPage.screenshot({
        path: path.join(output, "week-planned-desktop-dark.png"),
        fullPage: true,
      });
    await plannedContext.close();
  } finally {
    await browser.close();
  }
});
