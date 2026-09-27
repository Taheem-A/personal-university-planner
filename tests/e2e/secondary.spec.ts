import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { renderShell } from "../support/shell-ui-render.mjs";
import {
  renderCourses,
  renderAvailability,
  renderSettings,
  renderIntegrations,
  courseModel,
  renderManualEditor,
  renderWorkloadEditor,
  renderConstraintEditor,
} from "../support/secondary-ui-render.mjs";

const css = readFileSync("apps/web/src/app/styles.css", "utf8");
function documentFor(html: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="main-content">${html}</main></body></html>`;
}
for (const width of [1440, 640, 390]) {
  test(`secondary screens fit ${width}px and preserve readable sections`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [html, heading] of [
      [renderCourses(), "Courses"],
      [renderAvailability(), "Calendar & Availability"],
      [renderSettings(), "Settings"],
      [renderIntegrations(), "Integrations"],
    ] as const) {
      await page.setContent(documentFor(html));
      if (width < 640 && heading === "Courses") {
        await expect(page.getByRole("heading", { name: "Synthetic Mechanics" })).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    await page.setContent(documentFor(renderAvailability()));
    expect(await page.locator(".availability-agenda section").count()).toBe(7);
    await expect(
      page
        .locator(width < 900 ? ".availability-agenda" : ".availability-matrix")
        .getByText("Available for planning"),
    ).toBeVisible();
    await page.setContent(documentFor(renderCourses()));
    if (width < 640) {
      await expect(page.getByRole("navigation", { name: "Courses" })).toBeHidden();
      const close = page.getByRole("button", { name: "Close course detail" });
      expect((await close.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
  });
}
test("Course selection URL and Back retain the prior list context", async ({ page }) => {
  const list = renderCourses(courseModel(false));
  const detail = renderCourses(courseModel(true));
  await page.route("https://planner.test/courses**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      contentType: "text/html",
      body: documentFor(url.searchParams.has("course") ? detail : list),
    });
  });
  await page.goto("https://planner.test/courses");
  await page.getByRole("link", { name: /Synthetic Mechanics/ }).click();
  expect(page.url()).toContain("course=synthetic-course");
  await page.goBack();
  expect(page.url()).toBe("https://planner.test/courses");
  await page.goForward();
  expect(page.url()).toContain("course=synthetic-course");
});
test("global Add reaches course creation, then course facts and archive confirmation", async ({
  page,
}) => {
  await page.route("https://planner.test/**", async (route) => {
    const url = new URL(route.request().url());
    const course = {
      id: "synthetic-course",
      version: 2,
      academicTermId: "synthetic-term",
      code: "SYN101",
      name: "Synthetic Mechanics",
      section: null,
      instructorName: null,
      creditValue: null,
      colorReference: null,
      defaultTaskEnergy: null,
      defaultTaskLocation: [],
    };
    const content =
      url.pathname === "/today"
        ? renderShell("/today", "<h1>Today</h1>", url.searchParams.toString())
        : url.searchParams.get("edit") === "course-new"
          ? renderManualEditor("course")
          : url.searchParams.get("edit") === "course"
            ? renderManualEditor("course", { course, returnTo: "/courses?course=synthetic-course" })
            : renderCourses(courseModel(url.searchParams.has("course")));
    await route.fulfill({ contentType: "text/html", body: documentFor(content) });
  });
  await page.goto("https://planner.test/today?panel=add");
  await page
    .getByRole("navigation", { name: "Manual Add choices" })
    .getByRole("link", { name: /Course Add/ })
    .click();
  expect(page.url()).toBe("https://planner.test/courses?edit=course-new");
  await expect(page.getByRole("heading", { name: "Add course" })).toBeVisible();
  await page.getByRole("link", { name: "Close" }).click();
  await page.getByRole("link", { name: /Synthetic Mechanics/ }).click();
  await page.getByRole("link", { name: "Edit course" }).click();
  await expect(page.getByLabel("Course code")).toHaveValue("SYN101");
  await expect(page.getByLabel("Course name")).toHaveValue("Synthetic Mechanics");
  await expect(page.getByLabel("I understand that course will be archived.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Archive course" })).toBeDisabled();
  await page.goBack();
  await expect(page.getByRole("link", { name: "Edit assessment" })).toHaveAttribute(
    "href",
    /edit=assessment%3Aassessment|edit=assessment:assessment/,
  );
  await expect(page.getByRole("link", { name: "Edit task" })).toHaveAttribute(
    "href",
    "/upcoming?edit=task:task",
  );
  await expect(page.getByRole("link", { name: "Edit meeting" })).toHaveAttribute(
    "href",
    /edit=meeting%3Ameeting|edit=meeting:meeting/,
  );
});
test("assessment and task forms remain operable by keyboard at phone and zoom widths", async ({
  page,
}) => {
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: 800 });
    for (const kind of ["assessment", "task"] as const) {
      await page.setContent(documentFor(renderWorkloadEditor(kind)));
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
      const save = page.getByRole("button", { name: "Save", exact: true });
      expect((await save.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      const more = page.locator(".manual-advanced summary");
      expect((await more.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await more.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".manual-advanced")).toHaveAttribute("open", "");
    }
  }
});
test("life constraint and preference forms work by keyboard on phone and zoom widths", async ({
  page,
}) => {
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: 800 });
    for (const kind of ["availability", "protection", "preferences"] as const) {
      await page.setContent(documentFor(renderConstraintEditor(kind)));
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
      const save = page.getByRole("button", { name: "Save", exact: true });
      expect((await save.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      if (kind !== "preferences") {
        const more = page.locator(".manual-advanced summary");
        expect((await more.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await more.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator(".manual-advanced")).toHaveAttribute("open", "");
      }
    }
  }
});
test("manual editors stay keyboard usable on a phone and at 200% equivalent zoom", async ({
  page,
}) => {
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: 800 });
    for (const kind of ["term", "course", "meeting", "event"] as const) {
      await page.setContent(documentFor(renderManualEditor(kind)));
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const save = page.getByRole("button", { name: "Save", exact: true });
      const cancel = page.getByRole("button", { name: "Cancel" });
      expect((await save.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      expect((await cancel.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).focus();
      expect(await cancel.evaluate((button) => getComputedStyle(button).outlineStyle)).not.toBe(
        "none",
      );
    }
  }
});
