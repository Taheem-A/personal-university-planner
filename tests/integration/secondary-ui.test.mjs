import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  renderCourses,
  renderAvailability,
  renderSettings,
  renderIntegrations,
  courseModel,
  settingsModel,
  integrationsModel,
} from "../support/secondary-ui-render.mjs";

test("Course detail renders canonical context and does not invent unknown data", () => {
  const html = renderCourses();
  assert.match(html, /Synthetic Mechanics/);
  assert.match(html, /Synthetic report/);
  assert.match(html, /Review lecture/);
  assert.match(html, /1h 30m remaining/);
  assert.match(html, /Room 1/);
  const missing = courseModel();
  missing.selectedCourse = null;
  missing.selectionUnavailable = true;
  assert.match(renderCourses(missing), /Course unavailable/);
});
test("Availability retains text identity for fixed, available and protected time", () => {
  const html = renderAvailability();
  assert.match(html, /Time type/);
  assert.match(html, /Course meeting/);
  assert.match(html, /Available for planning/);
  assert.match(html, /Sleep/);
  assert.match(html, /Week as an ordered agenda/);
  assert.match(html, /date=2026-02-23/);
});
test("Settings renders only persisted preferences and a real appearance control", () => {
  assert.match(renderSettings(), /America\/Toronto/);
  const planning = renderSettings(settingsModel(), "planning");
  assert.match(planning, /240 minutes/);
  assert.match(planning, /Not specified/);
  assert.match(renderSettings(settingsModel(), "appearance"), /Use dark appearance/);
  const empty = settingsModel();
  empty.preferences = null;
  assert.match(renderSettings(empty, "planning"), /not been provisioned/);
});
test("Integrations use stored connected/disconnected status only", () => {
  const html = renderIntegrations();
  assert.match(html, /Synthetic calendar/);
  assert.match(html, /Connected/);
  assert.match(html, /Disconnected/);
  assert.match(html, /Last successful sync: Never/);
  const disconnected = integrationsModel();
  disconnected.accounts = [];
  const plain = renderIntegrations(disconnected);
  assert.match(plain, /No account recorded/);
  assert.doesNotMatch(plain, />Connected</);
});
test("Secondary routes stay fixture-free and contain no provider synchronization", () => {
  for (const file of [
    "apps/web/src/server/application/secondary-reads.ts",
    "apps/web/src/components/courses-view.tsx",
    "apps/web/src/components/availability-view.tsx",
    "apps/web/src/components/settings-view.tsx",
    "apps/web/src/components/integrations-view.tsx",
    "apps/web/src/app/(planner)/courses/page.tsx",
    "apps/web/src/app/(planner)/availability/page.tsx",
    "apps/web/src/app/(planner)/settings/page.tsx",
    "apps/web/src/app/(planner)/integrations/page.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /prototypes\/approved-preview|demoState|fixtures\//);
    assert.doesNotMatch(source, /googleapis|calendar\.events\.|provider\.sync|fetch\(/);
  }
});
