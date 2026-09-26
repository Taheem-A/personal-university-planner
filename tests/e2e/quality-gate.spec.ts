import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { renderShell } from "../support/shell-ui-render.mjs";
import { renderToday, syntheticTodayModel } from "../support/today-ui-render.mjs";
import { renderWeek, syntheticWeekModel } from "../support/week-ui-render.mjs";
import { renderInbox, renderUpcoming } from "../support/information-ui-render.mjs";
import {
  renderAvailability,
  renderCourses,
  renderIntegrations,
  renderSettings,
} from "../support/secondary-ui-render.mjs";
import { renderOnboarding } from "../support/presentation-ui-render.mjs";

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
const screens = [
  ["today", "/today", renderToday(syntheticTodayModel()), ""],
  ["week", "/week", renderWeek(syntheticWeekModel()), ""],
  ["upcoming", "/upcoming", renderUpcoming(), ""],
  ["inbox", "/inbox", inbox, ""],
  ["courses", "/courses", renderCourses(), "course=synthetic-course"],
  ["availability", "/availability", renderAvailability(), ""],
  ["integrations", "/integrations", renderIntegrations(), ""],
  ["settings", "/settings", renderSettings(), ""],
  ["onboarding", "/onboarding", renderOnboarding(), ""],
  ["planner", "/week", renderWeek(syntheticWeekModel()), "panel=planner"],
  ["scenario", "/week", renderWeek(syntheticWeekModel()), "scenario=preview"],
  ["conflict", "/week", renderWeek(syntheticWeekModel()), "conflict=overview"],
] as const;
function documentFor(pathname: string, content: string, query: string, theme: string) {
  return `<!doctype html><html lang="en" data-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${renderShell(pathname, content, query)}</body></html>`;
}

for (const width of [1440, 1024, 768, 640, 390]) {
  test(`production screen families fit ${width}px in light and dark`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      for (const [name, pathname, content, query] of screens) {
        await page.setContent(documentFor(pathname, content, query, theme));
        const sizing = await page.evaluate(() => ({
          viewport: innerWidth,
          scroll: document.documentElement.scrollWidth,
          sidebar: document.querySelector(".sidebar")?.getBoundingClientRect().width,
          topbar: document.querySelector(".topbar")?.getBoundingClientRect().height,
          mobileNav: getComputedStyle(document.querySelector(".mobile-bottom-nav")!).display,
        }));
        expect(sizing.scroll, `${name} ${theme} at ${width}px overflowed`).toBeLessThanOrEqual(
          width,
        );
        expect(sizing.topbar).toBe(56);
        if (width >= 1200) expect(sizing.sidebar).toBe(228);
        if (width >= 900 && width < 1200) expect(sizing.sidebar).toBe(64);
        if (width < 900) expect(sizing.sidebar).toBe(0);
        expect(sizing.mobileNav === "none").toBe(width >= 640);
        if (name === "courses" && width < 640)
          await expect(page.getByRole("heading", { name: "Synthetic Mechanics" })).toBeVisible();
        else await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        if (name === "week") {
          if (width >= 900)
            await expect(page.getByLabel("Seven-day planning calendar")).toBeVisible();
          else await expect(page.getByRole("navigation", { name: "Select day" })).toBeVisible();
        }
        if (name === "planner" || name === "scenario" || name === "conflict")
          await expect(page.getByRole("dialog")).toBeVisible();
      }
    }
  });
}

test("mobile controls and 200% equivalent view remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, pathname, content, query] of screens) {
    await page.setContent(documentFor(pathname, content, query, "light"));
    const undersized = await page.evaluate(() =>
      [...document.querySelectorAll("a,button,input,select,textarea")]
        .filter((node) => {
          const element = node as HTMLElement;
          const rect = element.getBoundingClientRect();
          return (
            rect.width &&
            rect.height &&
            getComputedStyle(element).visibility !== "hidden" &&
            rect.height < 44
          );
        })
        .map(
          (node) =>
            `${node.tagName.toLowerCase()}:${(node.textContent ?? node.getAttribute("aria-label") ?? "").trim().slice(0, 35)}:${Math.round(node.getBoundingClientRect().height)}`,
        ),
    );
    expect(undersized, `${name} mobile targets`).toEqual([]);
  }
  await page.setViewportSize({ width: 640, height: 800 });
  await page.setContent(documentFor("/today", renderToday(syntheticTodayModel()), "", "dark"));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("keyboard focus and week list offer a complete semantic route through the calendar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent(documentFor("/week", renderWeek(syntheticWeekModel()), "", "light"));
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const element = document.activeElement;
    return {
      name: element?.textContent?.trim(),
      width: getComputedStyle(element!).outlineWidth,
      style: getComputedStyle(element!).outlineStyle,
    };
  });
  expect(focus.name).toBe("Skip to main content");
  expect(focus.width).toBe("2px");
  expect(focus.style).toBe("solid");
  const list = page.getByText("Read week as a day-by-day list");
  await list.focus();
  await page.keyboard.press("Enter");
  const days = page.locator(".week-accessible section");
  await expect(days).toHaveCount(7);
  await expect(page.locator(".week-accessible")).toContainText("Synthetic appointment");
  await expect(page.locator(".week-accessible")).toContainText("Review synthetic lab notes");
});

test("both themes retain readable muted text and reduced motion removes transitions", async ({
  page,
}) => {
  for (const theme of ["light", "dark"]) {
    await page.setContent(documentFor("/today", renderToday(syntheticTodayModel()), "", theme));
    const contrast = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const channels = (color: string) => {
        const hex = color.trim().replace("#", "");
        return (hex.length === 3 ? [...hex].map((value) => value + value) : hex.match(/.{2}/g)!)
          .slice(0, 3)
          .map((value) => parseInt(value, 16))
          .map((v) => {
            const s = v / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
      };
      const luminance = (color: string) => {
        const [r, g, b] = channels(color);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const values = [
        luminance(root.getPropertyValue("--color-text-muted")),
        luminance(root.getPropertyValue("--color-bg-hover")),
      ];
      return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
    });
    expect(contrast, `${theme} muted text contrast`).toBeGreaterThanOrEqual(4.5);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  const motion = await page.evaluate(() => ({
    prefersReduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    duration: getComputedStyle(document.documentElement)
      .getPropertyValue("--duration-panel")
      .trim(),
  }));
  expect(motion).toEqual({ prefersReduced: true, duration: "0ms" });
});
