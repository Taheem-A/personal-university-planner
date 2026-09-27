import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { chromium } from "@playwright/test";
import { createDatabase } from "../../packages/database/dist/index.js";

const url = process.env.M6_TEST_DATABASE_URL;
if (
  process.env.APP_ENV !== "test" ||
  process.env.CONFIRM_M6_DATABASE !== "RUN_M6_FINAL_ACCEPTANCE" ||
  !url
)
  throw new Error("A confirmed disposable M6 database is required.");
const parsed = new URL(url);
if (
  !["postgres:", "postgresql:"].includes(parsed.protocol) ||
  !parsed.hostname.endsWith(".neon.tech") ||
  parsed.hostname.includes("-pooler") ||
  !/^up_test_m6_gate_[a-z0-9_]+$/.test(decodeURIComponent(parsed.pathname.slice(1))) ||
  url === process.env.DATABASE_URL
)
  throw new Error("Use a distinct, direct Neon up_test_m6_gate_* database only.");

const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { encode } = webRequire("next-auth/jwt");
const nextBin = webRequire.resolve("next/dist/bin/next");
const database = createDatabase({ connectionString: url });
const secret = randomBytes(48).toString("hex");
const port = 3106;
const base = `http://127.0.0.1:${port}`;
const output = path.resolve("test-results/m6-live");
let server;
let serverLog = "";

async function startServer() {
  const env = {
    ...process.env,
    DATABASE_URL: url,
    AUTH_SECRET: secret,
    AUTH_GOOGLE_ID: "m6-synthetic-client",
    AUTH_GOOGLE_SECRET: "m6-synthetic-secret",
    NEXTAUTH_URL: base,
    NODE_ENV: "production",
  };
  delete env.APP_ENV;
  delete env.M6_TEST_DATABASE_URL;
  server = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { cwd: path.resolve("apps/web"), env, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (chunk) => {
    serverLog = (serverLog + chunk.toString()).slice(-4000);
  });
  server.stderr.on("data", (chunk) => {
    serverLog = (serverLog + chunk.toString()).slice(-4000);
  });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Next server exited: ${serverLog}`);
    try {
      if ((await fetch(`${base}/sign-in`)).ok) return;
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next server did not start: ${serverLog}`);
}
async function stopServer() {
  if (!server) return;
  const stopped = new Promise((resolve) => server.once("exit", resolve));
  server.kill();
  await Promise.race([stopped, new Promise((resolve) => setTimeout(resolve, 5000))]);
  server = undefined;
}
async function visit(page, route) {
  const response = await page.goto(`${base}${route}`);
  assert.equal(response?.status(), 200, `${route}: ${await page.locator("main").innerText()}`);
  assert.ok(!page.url().endsWith("/sign-in"), route);
}
async function save(page) {
  const editor = page.locator(".manual-editor").last();
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/v1/manual/"),
  );
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  const response = await responsePromise;
  const payload = await response.json();
  await editor.locator(".manual-editor-feedback").waitFor({ timeout: 12000 });
  const feedback = await editor.locator(".manual-editor-feedback").innerText();
  assert.equal(
    response.status(),
    200,
    `${feedback}: ${JSON.stringify(payload)}; request ${response.request().postData()} ${serverLog}`,
  );
  assert.match(feedback, /\bsaved\./i, `${feedback}: ${JSON.stringify(payload)}`);
  assert.ok(payload.data?.id, JSON.stringify(payload));
  return payload.data;
}
async function api(page, route, method, body) {
  return page.evaluate(
    async ({ route, method, body }) => {
      const response = await fetch(route, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
    { route, method, body },
  );
}

test(
  "M6 fresh account configures and uses a canonical plan through protected UI",
  { timeout: 180000 },
  async () => {
    mkdirSync(output, { recursive: true });
    const browser = await chromium.launch();
    let context;
    try {
      const actor = await database.repositories.authIdentities.provisionUser(
        "google",
        `m6-final-synthetic-actor-${randomBytes(4).toString("hex")}`,
      );
      assert.equal((await database.repositories.academicTerms.listForUser(actor.id)).length, 0);
      assert.equal((await database.repositories.tasks.listForUser(actor.id)).length, 0);
      await startServer();
      context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(`${base}/onboarding?step=1`);
      assert.match(page.url(), /\/sign-in/);
      const token = await encode({
        token: { userId: actor.id, sub: actor.id },
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
      await visit(page, "/onboarding?step=1");
      assert.match(await page.locator("main").innerText(), /No active academic term recorded/);
      await page.getByRole("button", { name: "Change time zone" }).click();
      await page.getByLabel("IANA time zone").fill("America/Toronto");
      await page.locator(".timezone-form").getByRole("button", { name: "Save" }).click();

      await visit(page, "/courses?edit=term-new");
      await page.getByLabel("Term name").fill("Synthetic Fall 2026");
      await page.getByLabel("Start date").fill("2026-09-01");
      await page.getByLabel("End date").fill("2026-12-20");
      await save(page);
      await page.getByLabel("Term status").selectOption("ACTIVE");
      await save(page);
      await visit(page, "/courses?edit=course-new");
      await page.getByLabel("Course code").fill("SYN101");
      await page.getByLabel("Course name").fill("Synthetic Mechanics");
      await save(page);
      await visit(page, "/courses?edit=meeting-new");
      await page.getByLabel("Effective from").fill("2026-09-01");
      await page.getByLabel("Local start time").fill("11:00");
      await page.getByLabel("Local end time").fill("12:00");
      const meeting = await save(page);

      await visit(page, "/availability?edit=event-new");
      await page.getByLabel("Title", { exact: true }).fill("Synthetic appointment");
      await page.getByLabel("Start", { exact: true }).fill("2026-09-29T15:00");
      await page.getByLabel("End", { exact: true }).fill("2026-09-29T16:00");
      const fixedEvent = await save(page);
      await visit(page, "/availability?edit=availability-new");
      await page.getByLabel("Repeats").selectOption("DAILY");
      await page.getByLabel("Local start time").fill("08:00");
      await page.getByLabel("Local end time").fill("22:00");
      await page.getByLabel("First effective date").fill("2026-09-01");
      const availability = await save(page);
      await visit(page, "/availability?edit=protection-new");
      await page.getByLabel("Protection label").fill("Synthetic sleep");
      await page.getByLabel("This is sleep").check();
      await page.getByLabel("First effective date").fill("2026-09-01");
      const sleep = await save(page);
      await visit(page, "/availability?edit=protection-new");
      await page.getByLabel("Protection label").fill("Synthetic leisure");
      await page.getByLabel("Protection strength").selectOption("SOFT");
      await page.getByLabel("First effective date").fill("2026-09-01");
      const softProtection = await save(page);
      await visit(page, "/settings?section=planning&edit=preferences");
      await page.getByRole("button", { name: "Use Balanced values" }).click();
      await save(page);
      await visit(page, "/upcoming?edit=assessment-new");
      assert.ok(
        await page.getByLabel("Assessment title").count(),
        `Assessment editor absent: ${await page.locator("main").innerText()} ${serverLog}`,
      );
      await page.getByLabel("Assessment title").fill("Synthetic assignment");
      await page.getByLabel("True due date and time").fill("2026-10-02T17:00");
      const assessment = await save(page);
      await visit(page, "/upcoming?edit=task-new");
      await page.getByLabel("Task title").fill("Solve synthetic assignment");
      await page.getByLabel("Estimated work (minutes)").fill("180");
      await page.getByLabel("True task deadline").fill("2026-10-02T17:00");
      await page.getByLabel("Available from").fill("2026-09-27T08:00");
      await page.getByLabel("Typical session length (minutes)").fill("45");
      await page
        .getByLabel("Assessment", { exact: true })
        .selectOption({ label: "Synthetic assignment" });
      const createdTask = await save(page);
      const createdTasks = await database.repositories.tasks.listForUser(actor.id);
      assert.equal(
        createdTasks.length,
        1,
        `Tasks after save: ${JSON.stringify({ createdTask, createdTasks })}`,
      );
      assert.equal(createdTasks[0].planningMode, "AUTO");
      assert.equal(createdTasks[0].status, "READY");

      await visit(page, "/onboarding?step=6");
      await page.waitForLoadState("networkidle");
      const readyLink = page.getByRole("link", { name: "Open your plan in Today" });
      if (await readyLink.count()) {
        await readyLink.click();
      } else {
        const planResponse = page.waitForResponse(
          (response) => response.url().includes("/api/v1/onboarding/plan"),
          { timeout: 45000 },
        );
        await page.getByRole("button", { name: "Generate first plan" }).click();
        const planResult = await planResponse;
        assert.equal(
          planResult.status(),
          200,
          `First plan HTTP ${planResult.status()}: ${await planResult.text()}`,
        );
        assert.equal((await planResult.json()).data.status, "READY");
      }
      await page.waitForURL(/\/today/, { timeout: 45000 });
      await page.getByText("Solve synthetic assignment").first().waitFor();
      await page.screenshot({
        path: path.join(output, "today-first-plan-desktop-light.png"),
        fullPage: true,
      });
      await visit(page, "/week?date=2026-09-28");
      await page.getByText("Solve synthetic assignment").first().waitFor();
      await page.screenshot({
        path: path.join(output, "week-first-plan-desktop-light.png"),
        fullPage: true,
      });
      const terms = await database.repositories.academicTerms.listForUser(actor.id);
      const courses = await database.repositories.courses.listForTerm(actor.id, terms[0].id);
      const tasks = await database.repositories.tasks.listForUser(actor.id);
      const latestRun = await database.repositories.plannerRuns.latestSuccessful(actor.id);
      const sessions = await database.repositories.workSessions.listForRange(
        actor.id,
        new Date("2026-09-27T00:00:00Z"),
        new Date("2026-10-04T00:00:00Z"),
      );
      assert.equal(courses.length, 1);
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].remainingMinutes, 180);
      assert.ok(latestRun);
      assert.ok(sessions.some((session) => session.taskId === tasks[0].id));
      assert.equal(
        (await database.repositories.integrationAccounts.listForUser(actor.id)).length,
        0,
      );
      await stopServer();
      await startServer();
      await visit(page, "/onboarding?step=6");
      await page.getByText("A usable plan with work sessions is recorded").waitFor();
      assert.match(
        await page.locator("main").innerText(),
        /usable plan with work sessions is recorded/i,
      );

      await visit(page, `/courses?course=${courses[0].id}&edit=meeting:${meeting.id}`);
      await page.getByLabel("Local start time").fill("10:30");
      await save(page);
      assert.equal(
        (await database.repositories.courseMeetings.getForUser(actor.id, meeting.id))
          .startTimeLocal,
        "10:30:00",
      );
      await visit(page, `/upcoming?assessment=${assessment.id}&edit=assessment:${assessment.id}`);
      await page.getByLabel("True due date and time").fill("2026-10-03T17:00");
      await save(page);
      assert.equal(
        (
          await database.repositories.assessments.getForUser(actor.id, assessment.id)
        ).dueAt.toISOString(),
        "2026-10-03T21:00:00.000Z",
      );
      await visit(page, `/availability?edit=availability:${availability.id}`);
      await page.getByLabel("Local end time").fill("21:00");
      await save(page);
      assert.equal(
        (await database.repositories.availabilityRules.getForUser(actor.id, availability.id))
          .endTimeLocal,
        "21:00:00",
      );
      await visit(page, `/availability?edit=protection:${sleep.id}`);
      await page.getByLabel("Protection label").fill("Synthetic sleep revised");
      await save(page);
      assert.equal(
        (await database.repositories.protectedTimeRules.getForUser(actor.id, sleep.id)).reason,
        "Synthetic sleep revised",
      );
      await visit(page, "/settings?section=planning&edit=preferences");
      await page.getByLabel("Preferred daily study limit (minutes)").fill("300");
      await save(page);
      assert.equal(
        (await database.repositories.planningPreferences.getForUser(actor.id))
          .preferredDailyStudyLimitMinutes,
        300,
      );

      await visit(page, `/courses?course=${courses[0].id}&edit=course`);
      await page.getByLabel("Course name").fill("Synthetic Mechanics revised");
      await save(page);
      assert.equal(
        (await database.repositories.courses.getForUser(actor.id, courses[0].id)).name,
        "Synthetic Mechanics revised",
      );
      const stale = await api(page, `/api/v1/manual/courses/${courses[0].id}`, "PATCH", {
        expectedVersion: courses[0].version,
        name: "Stale overwrite",
      });
      assert.equal(stale.status, 409);
      assert.equal(stale.body.error.code, "STALE_WRITE");
      assert.equal(
        (await database.repositories.courses.getForUser(actor.id, courses[0].id)).name,
        "Synthetic Mechanics revised",
      );
      const invalid = await api(page, "/api/v1/manual/courses", "POST", {
        academicTermId: terms[0].id,
        code: "",
        name: "Invalid course",
      });
      assert.equal(invalid.status, 400);
      assert.equal(
        (await database.repositories.courses.listForTerm(actor.id, terms[0].id)).length,
        1,
      );
      const archivedEvent = await api(page, `/api/v1/manual/events/${fixedEvent.id}`, "DELETE", {
        expectedVersion: fixedEvent.version,
      });
      assert.equal(archivedEvent.status, 200);
      assert.ok(
        (await database.repositories.calendarEvents.getForUser(actor.id, fixedEvent.id)).archivedAt,
      );
      const deactivatedProtection = await api(
        page,
        `/api/v1/manual/protected-time/${softProtection.id}`,
        "DELETE",
        { expectedVersion: softProtection.version },
      );
      assert.equal(deactivatedProtection.status, 200);
      assert.equal(
        (await database.repositories.protectedTimeRules.getForUser(actor.id, softProtection.id))
          .active,
        false,
      );
      const secondActor = await database.repositories.authIdentities.provisionUser(
        "google",
        `m6-other-synthetic-${randomBytes(4).toString("hex")}`,
      );
      const otherContext = await browser.newContext();
      try {
        const otherToken = await encode({
          token: { userId: secondActor.id, sub: secondActor.id },
          secret,
          maxAge: 3600,
        });
        await otherContext.addCookies([
          {
            name: "next-auth.session-token",
            value: otherToken,
            url: base,
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
        const otherPage = await otherContext.newPage();
        await visit(otherPage, "/courses");
        const foreign = await api(otherPage, `/api/v1/manual/courses/${courses[0].id}`, "PATCH", {
          expectedVersion: 1,
          name: "Foreign overwrite",
        });
        assert.equal(foreign.status, 404);
      } finally {
        await otherContext.close();
      }
      await visit(page, `/upcoming?edit=task:${tasks[0].id}`);
      await page.getByLabel("Estimated work (minutes)").fill("240");
      await save(page);
      assert.equal(
        (await database.repositories.tasks.getForUser(actor.id, tasks[0].id))
          .currentEstimatedMinutes,
        240,
      );
      await visit(page, "/today");
      await page.getByText("Solve synthetic assignment").first().waitFor();

      await visit(page, "/inbox?capture=1");
      await page.getByLabel("Quick capture").fill("SYN101 assignment maybe due later");
      const captureResponse = page.waitForResponse((response) =>
        response.url().includes("/api/v1/inbox/capture"),
      );
      await page.getByRole("button", { name: "Add", exact: true }).last().click();
      assert.equal((await captureResponse).status(), 200);
      const captured = (
        await database.repositories.inboxItems.listByStatus(actor.id, "ACTIVE")
      ).find((item) => item.rawText === "SYN101 assignment maybe due later");
      assert.ok(captured);
      assert.equal(captured.proposedPayload, null);
      await visit(page, `/inbox?status=ACTIVE&item=${captured.id}`);
      await page.getByLabel("Create as").selectOption("ASSESSMENT");
      await page.getByLabel("Title", { exact: true }).fill("Synthetic late idea");
      await page.getByLabel("Course · required").selectOption(courses[0].id);
      const resolveResponse = page.waitForResponse((response) =>
        response.url().includes(`/api/v1/inbox/${captured.id}/resolve`),
      );
      await page.getByRole("button", { name: "Save canonical object and process" }).click();
      assert.equal((await resolveResponse).status(), 200);
      const processed = await database.repositories.inboxItems.getForUser(actor.id, captured.id);
      assert.equal(processed.status, "PROCESSED");
      assert.equal(processed.rawText, "SYN101 assignment maybe due later");
      const savedAssessment = await database.repositories.assessments.getForUser(
        actor.id,
        processed.resolvedEntityId,
      );
      assert.equal(savedAssessment.dueAt, null);

      await visit(page, "/inbox?capture=1");
      const proposedText = "assignment: Synthetic report; course SYN101";
      await page.getByLabel("Quick capture").fill(proposedText);
      const secondCaptureResponse = page.waitForResponse((response) =>
        response.url().includes("/api/v1/inbox/capture"),
      );
      await page.getByRole("button", { name: "Add", exact: true }).last().click();
      assert.equal((await secondCaptureResponse).status(), 200);
      const proposedItem = (
        await database.repositories.inboxItems.listByStatus(actor.id, "ACTIVE")
      ).find((item) => item.rawText === proposedText);
      assert.ok(proposedItem);
      await visit(page, `/inbox?status=ACTIVE&item=${proposedItem.id}`);
      const suggestResponse = page.waitForResponse((response) =>
        response.url().includes(`/api/v1/inbox/${proposedItem.id}/suggest`),
      );
      await page.getByRole("button", { name: "Suggest limited interpretation" }).click();
      assert.equal((await suggestResponse).status(), 200);
      const proposal = await database.repositories.inboxItems.getForUser(actor.id, proposedItem.id);
      assert.equal(proposal.proposedEntityType, "ASSESSMENT");
      assert.equal(proposal.proposedPayload.dueAt, null);
      await page.getByText("ASSESSMENT: Synthetic report").waitFor();
      await page.getByLabel("Title", { exact: true }).fill("Corrected synthetic report");
      const proposedResolveResponse = page.waitForResponse((response) =>
        response.url().includes(`/api/v1/inbox/${proposedItem.id}/resolve`),
      );
      await page.getByRole("button", { name: "Save canonical object and process" }).click();
      assert.equal((await proposedResolveResponse).status(), 200);
      const resolvedProposal = await database.repositories.inboxItems.getForUser(
        actor.id,
        proposedItem.id,
      );
      assert.equal(resolvedProposal.status, "PROCESSED");
      assert.equal(
        (
          await database.repositories.assessments.getForUser(
            actor.id,
            resolvedProposal.resolvedEntityId,
          )
        ).title,
        "Corrected synthetic report",
      );

      await visit(page, "/inbox?capture=1");
      await page.getByLabel("Quick capture").fill("Unclear synthetic reminder");
      const thirdCaptureResponse = page.waitForResponse((response) =>
        response.url().includes("/api/v1/inbox/capture"),
      );
      await page.getByRole("button", { name: "Add", exact: true }).last().click();
      assert.equal((await thirdCaptureResponse).status(), 200);
      const dismissedItem = (
        await database.repositories.inboxItems.listByStatus(actor.id, "ACTIVE")
      ).find((item) => item.rawText === "Unclear synthetic reminder");
      assert.ok(dismissedItem);
      await visit(page, `/inbox?status=ACTIVE&item=${dismissedItem.id}`);
      await page.getByRole("button", { name: "Dismiss capture" }).click();
      const dismissResponse = page.waitForResponse((response) =>
        response.url().includes(`/api/v1/inbox/${dismissedItem.id}/dismiss`),
      );
      await page.getByRole("button", { name: "Confirm dismissal" }).click();
      assert.equal((await dismissResponse).status(), 200);
      assert.equal(
        (await database.repositories.inboxItems.getForUser(actor.id, dismissedItem.id)).status,
        "DISMISSED",
      );

      await visit(page, "/today");
      await page.getByRole("link", { name: "Manual Add" }).click();
      await page.getByRole("navigation", { name: "Manual Add choices" }).getByText("Task").click();
      await page.waitForURL(/\/upcoming\?.*edit=task-new/);
      assert.match(page.url(), /\/upcoming\?.*edit=task-new/);
      await page.getByLabel("Task title").waitFor();
    } finally {
      await context?.close();
      await browser.close();
      await stopServer();
      await database.disconnect();
    }
  },
);
