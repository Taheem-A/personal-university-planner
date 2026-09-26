import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { createDatabase } from "../../packages/database/dist/index.js";
import { renderToday } from "../support/today-ui-render.mjs";
import { renderWeek } from "../support/week-ui-render.mjs";
import { renderUpcoming, renderInbox } from "../support/information-ui-render.mjs";
import {
  renderCourses,
  renderAvailability,
  renderSettings,
  renderIntegrations,
} from "../support/secondary-ui-render.mjs";
import { renderOnboarding } from "../support/presentation-ui-render.mjs";
import { renderShell } from "../support/shell-ui-render.mjs";

const url = process.env.M5_UI_TEST_DATABASE_URL;
if (
  process.env.APP_ENV !== "test" ||
  process.env.CONFIRM_M5_UI_DATABASE !== "RUN_M5_REAL_STATE_PROOF" ||
  !url
)
  throw new Error("A confirmed disposable Milestone-5 UI database is required.");
const parsed = new URL(url);
if (
  !parsed.hostname.endsWith(".neon.tech") ||
  parsed.hostname.includes("-pooler") ||
  !/^up_test_m5_ui_gate_[a-z0-9_]+$/.test(decodeURIComponent(parsed.pathname.slice(1)))
)
  throw new Error("Use a direct Neon up_test_m5_ui_gate_* database only.");

const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const require = createRequire(import.meta.url);
const shared = require("../../dist/packages/shared/src/index.js");
const core = require("../../dist/packages/planner-core/src/index.js");
const database = createDatabase({ connectionString: url });
let actorId = "seed-user-engineering-fall-2026";
const appDir = path.resolve("apps/web/src/server/application");
const errors = {
  ApplicationError: class ApplicationError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
  async resultOf(operation) {
    try {
      return { ok: true, value: await operation() };
    } catch (error) {
      return { ok: false, error: { code: error.code ?? "INTERNAL_ERROR", message: error.message } };
    }
  },
};
const validation = {
  calendarDateSchema: webRequire("zod").z.iso.date(),
  idSchema: webRequire("zod").z.string().trim().min(1).max(191),
  validateInput(schema, input) {
    return schema.parse(input);
  },
};
function load(file, overrides = {}) {
  const filename = path.join(appDir, file);
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) =>
    overrides[name] ??
    {
      "@university-planner/shared": shared,
      "@university-planner/planner-core": core,
      "../database": { applicationDatabase: () => database },
      "./authorization": { requireActor: async () => ({ userId: actorId }) },
      "./errors": errors,
      "./validation": validation,
    }[name] ??
    webRequire(name);
  loaded._compile(
    ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return loaded.exports;
}
const planner = load("planner-reads.ts");
const information = load("information-reads.ts", { "./planner-reads": planner });
const secondary = load("secondary-reads.ts", { "./planner-reads": planner });
const read = async (result) => {
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.value;
};
async function ensurePlanReadyUser() {
  const id = "m5-ui-gate-plan-ready";
  if (await database.repositories.users.getById(id)) return id;
  const at = new Date("2026-09-25T16:00:00.000Z");
  const audit = { createdAt: at, updatedAt: at };
  await database.transaction(async ({ repositories: r }) => {
    await r.users.create({
      id,
      name: "Synthetic planned student",
      timezone: "America/Toronto",
      defaultDayStart: "08:00:00",
      defaultDayEnd: "22:00:00",
      locale: "en-CA",
      ...audit,
    });
    await r.academicTerms.create({
      id: `${id}-term`,
      userId: id,
      name: "Synthetic Fall 2026",
      startDate: "2026-09-01",
      endDate: "2026-12-20",
      status: "ACTIVE",
      version: 0,
      ...audit,
    });
    await r.courses.create({
      id: `${id}-course`,
      userId: id,
      academicTermId: `${id}-term`,
      code: "SYN101",
      name: "Synthetic planned course",
      section: null,
      instructorName: null,
      colorReference: "green",
      creditValue: null,
      defaultTaskEnergy: "MEDIUM",
      defaultTaskLocation: ["DESK"],
      archivedAt: null,
      version: 0,
      source: "MANUAL",
      sourceAuthority: "USER",
      sourceConfidence: "MANUAL",
      ...audit,
    });
    await r.tasks.create({
      id: `${id}-task`,
      version: 0,
      userId: id,
      courseId: `${id}-course`,
      assessmentId: null,
      recurringWorkRuleId: null,
      parentTaskId: null,
      title: "Complete synthetic design exercise",
      description: null,
      status: "READY",
      priorityOverride: null,
      availableFrom: at,
      dueAt: new Date("2026-09-28T21:00:00.000Z"),
      preferredCompletionAt: null,
      originalEstimatedMinutes: 150,
      currentEstimatedMinutes: 150,
      remainingMinutes: 150,
      energyRequirement: "MEDIUM",
      locationRequirements: ["DESK"],
      minimumSessionMinutes: 20,
      preferredSessionMinutes: 45,
      maximumSessionMinutes: 90,
      splittable: true,
      interruptible: true,
      planningMode: "AUTO",
      completedAt: null,
      archivedAt: null,
      source: "MANUAL",
      sourceAuthority: "USER",
      sourceConfidence: "MANUAL",
      ...audit,
    });
    await r.availabilityRules.create({
      id: `${id}-availability`,
      userId: id,
      recurrenceRule: "FREQ=DAILY",
      startTimeLocal: "08:00:00",
      endTimeLocal: "22:00:00",
      spansNextDay: false,
      timezone: "America/Toronto",
      effectiveFrom: "2026-09-01",
      effectiveUntil: "2026-12-20",
      capacityFactor: 1,
      energyLevel: "HIGH",
      allowedLocationTags: ["DESK"],
      active: true,
      version: 0,
      ...audit,
    });
    await r.protectedTimeRules.create({
      id: `${id}-sleep`,
      userId: id,
      recurrenceRule: "FREQ=DAILY",
      startTimeLocal: "23:00:00",
      endTimeLocal: "07:00:00",
      spansNextDay: true,
      timezone: "America/Toronto",
      effectiveFrom: "2026-09-01",
      effectiveUntil: "2026-12-20",
      protectionLevel: "HARD",
      reason: "Sleep",
      isSleep: true,
      active: true,
      version: 0,
      ...audit,
    });
    await r.planningPreferences.create({
      id: `${id}-preference`,
      userId: id,
      version: 0,
      preferredDailyStudyLimitMinutes: 300,
      minimumFreeTimeMinutes: 30,
      preferredDeadlineBufferHours: 6,
      avoidLateHighEnergyTasks: true,
      maximumConsecutiveWorkMinutes: 120,
      minimumBreakMinutes: 10,
      scheduleCommuteWork: false,
      weekendWorkBias: 0,
      planStabilityWindowMinutes: 120,
      minimumSleepMinutes: 420,
      ...audit,
    });
  });
  return id;
}

test("seeded canonical state reaches production Milestone-5 screen components", async () => {
  try {
    const today = await read(await planner.plannerViews.today({ date: "2026-09-25" }));
    const week = await read(await planner.plannerViews.week({ date: "2026-09-25" }));
    const upcoming = await read(await information.informationViews.upcoming());
    const inbox = await read(await information.informationViews.inbox());
    const courses = await read(await secondary.secondaryViews.courses());
    const availability = await read(
      await secondary.secondaryViews.availability({ date: "2026-09-25" }),
    );
    const settings = await read(await secondary.secondaryViews.settings());
    const integrations = await read(await secondary.secondaryViews.integrations());
    const onboarding = await read(await secondary.secondaryViews.onboarding());
    assert.equal(today.timezone, "America/Toronto");
    const overnight = today.timeline.find((item) => item.startAt < item.visibleStartAt);
    assert.ok(
      overnight,
      `previous-night item is clipped to the selected local day: ${JSON.stringify(today.timeline.map((item) => [item.kind, item.startAt, item.endAt, item.visibleStartAt, item.visibleEndAt]))}`,
    );
    assert.equal(overnight.visibleStartAt.toISOString(), "2026-09-25T04:00:00.000Z");
    assert.ok(today.timeline.every((item) => item.visibleStartAt < item.visibleEndAt));
    assert.equal(week.weekStart, "2026-09-21");
    assert.ok(courses.courses.length > 0);
    assert.ok(upcoming.groups.some((group) => group.items.length > 0));
    const html = [
      renderToday(today),
      renderWeek(week),
      renderUpcoming(upcoming),
      renderInbox(inbox),
      renderCourses(courses),
      renderAvailability(availability),
      renderSettings(settings),
      renderIntegrations(integrations),
      renderOnboarding(1, onboarding),
    ];
    for (const screen of html) assert.ok(screen.length > 100);
    assert.match(html[0], /MAT186|CIV100|APS110|APS111/);
    assert.match(html[1], /MAT186|CIV100|APS110|APS111/);
    assert.match(html[4], /MAT186/);
    assert.doesNotMatch(html.join("\n"), /Synthetic Spring|Review synthetic lab notes/);
    if (process.env.M5_UI_CAPTURE_DIR) {
      const { chromium } = await import("@playwright/test");
      const output = path.resolve(process.env.M5_UI_CAPTURE_DIR);
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
      const captures = [
        ["today-desktop-light", "/today", html[0], "light", 1440, 900],
        ["today-desktop-dark", "/today", html[0], "dark", 1440, 900],
        ["today-mobile-light", "/today", html[0], "light", 390, 844],
        ["week-desktop-light", "/week", html[1], "light", 1440, 900],
        ["week-mobile-light", "/week", html[1], "light", 390, 844],
        ["upcoming-desktop-light", "/upcoming", html[2], "light", 1440, 900],
        ["courses-desktop-light", "/courses", html[4], "light", 1440, 900],
      ];
      mkdirSync(output, { recursive: true });
      const browser = await chromium.launch();
      try {
        for (const [name, pathname, body, theme, width, height] of captures) {
          const page = await browser.newPage({
            viewport: { width, height },
            deviceScaleFactor: 1,
            reducedMotion: "reduce",
          });
          await page.setContent(
            `<!doctype html><html lang="en" data-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fonts}${css}</style></head><body>${renderShell(pathname, body)}</body></html>`,
          );
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({
            path: path.join(output, `${name}.png`),
            fullPage: true,
            animations: "disabled",
          });
          await page.close();
        }
      } finally {
        await browser.close();
      }
    }
    actorId = await ensurePlanReadyUser();
    const input = load("planner-input.ts");
    const execution = load("planner-execution.ts", { "./planner-input": input });
    const plan = await execution.executePlannerForActor(database, actorId, {
      operation: "AUTHORITATIVE_GENERATION",
      mode: "INCREMENTAL",
      trigger: { type: "MANUAL" },
      now: new Date("2026-09-25T16:00:00.000Z"),
      plannerVersion: "heuristic-v1",
      releasedTimePolicy: "REPLAN_IF_USEFUL",
    });
    assert.equal(plan.status, "SUCCEEDED", JSON.stringify(plan));
    const plannedToday = await read(await planner.plannerViews.today({ date: "2026-09-28" }));
    const plannedWeek = await read(await planner.plannerViews.week({ date: "2026-09-28" }));
    assert.equal(plannedToday.planner.status, "CURRENT");
    assert.equal(plannedWeek.planner.status, "CURRENT");
    assert.ok(
      plannedWeek.schedule.some((item) => item.generatedBy === "PLANNER"),
      JSON.stringify({
        plan,
        schedule: plannedWeek.schedule.map((item) => [item.kind, item.generatedBy, item.startAt]),
      }),
    );
    assert.match(renderToday(plannedToday), /Complete synthetic design exercise/);
    assert.match(renderWeek(plannedWeek), /Complete synthetic design exercise/);
  } finally {
    await database.disconnect();
  }
});
