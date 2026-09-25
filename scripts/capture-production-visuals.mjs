import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { renderShell } from "../tests/support/shell-ui-render.mjs";
import { renderToday, syntheticTodayModel } from "../tests/support/today-ui-render.mjs";
import { renderWeek, syntheticWeekModel } from "../tests/support/week-ui-render.mjs";
import { renderInbox, renderUpcoming } from "../tests/support/information-ui-render.mjs";
import { renderSettings } from "../tests/support/secondary-ui-render.mjs";
import { renderOnboarding } from "../tests/support/presentation-ui-render.mjs";

const output = path.resolve("docs/regression-reference/production-qa");
const css = readFileSync("apps/web/src/app/styles.css", "utf8");
const font = (family, weight) => {
  const file = `apps/web/node_modules/@fontsource/${family}/files/${family}-latin-${weight}-normal.woff2`;
  return `@font-face{font-family:"${family === "ibm-plex-sans" ? "IBM Plex Sans" : "IBM Plex Mono"}";font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(file).toString("base64")}) format("woff2")}`;
};
const fonts = [
  font("ibm-plex-sans", 400),
  font("ibm-plex-sans", 500),
  font("ibm-plex-sans", 600),
  font("ibm-plex-mono", 400),
].join("");
const emptyInbox = renderInbox({
  timezone: "America/Toronto",
  tabs: [
    { status: "ACTIVE", count: 0 },
    { status: "PROCESSED", count: 0 },
    { status: "DISMISSED", count: 0 },
  ],
  items: [],
});
const today = renderToday(syntheticTodayModel());
const week = renderWeek(syntheticWeekModel());
const captures = [
  ["today-desktop-light", "/today", today, "", "light", 1440, 900],
  ["today-desktop-dark", "/today", today, "", "dark", 1440, 900],
  ["today-mobile-light", "/today", today, "", "light", 390, 844],
  ["week-desktop-light", "/week", week, "", "light", 1440, 900],
  ["week-desktop-dark", "/week", week, "", "dark", 1440, 900],
  ["week-mobile-light", "/week", week, "", "light", 390, 844],
  ["upcoming-desktop-light", "/upcoming", renderUpcoming(), "", "light", 1440, 900],
  ["inbox-mobile-light", "/inbox", emptyInbox, "", "light", 390, 844],
  ["planner-mobile-dark", "/week", week, "panel=planner", "dark", 390, 844],
  ["scenario-desktop-dark", "/week", week, "scenario=preview", "dark", 1440, 900],
  ["settings-tablet-light", "/settings", renderSettings(), "", "light", 768, 900],
  ["onboarding-mobile-light", "/onboarding", renderOnboarding(), "", "light", 390, 844],
];

mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, pathname, body, query, theme, width, height] of captures) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await page.setContent(
      `<!doctype html><html lang="en" data-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fonts}${css}</style></head><body>${renderShell(pathname, body, query)}</body></html>`,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(output, `${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.close();
    console.log(`Captured ${name}`);
  }
} finally {
  await browser.close();
}
