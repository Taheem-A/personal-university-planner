import assert from "node:assert/strict";
import test from "node:test";
import { renderConstraintEditor } from "../support/secondary-ui-render.mjs";

test("recurring constraint forms expose wall-clock, capacity and hard sleep semantics", () => {
  const available = renderConstraintEditor("availability");
  assert.match(available, /Work may be scheduled in this window/);
  assert.match(available, /Recurring days/);
  assert.match(available, /Local start time/);
  assert.match(available, /Ends on the next day/);
  assert.match(available, /Usable capacity/);
  assert.match(available, /Transit or commute/);
  const protection = renderConstraintEditor("protection");
  assert.match(protection, /This is sleep/);
  assert.match(protection, /Hard · never schedule through/);
  assert.match(protection, /Soft · avoid if possible/);
  assert.match(protection, /daylight-saving changes/);
  const saved = renderConstraintEditor("protection", {
    rule: {
      id: "sleep-rule",
      version: 3,
      recurrenceRule: "FREQ=DAILY",
      startTimeLocal: "22:00",
      endTimeLocal: "07:00",
      spansNextDay: true,
      timezone: "America/Toronto",
      effectiveFrom: "2026-03-01",
      effectiveUntil: null,
      reason: "Sleep",
      protectionLevel: "HARD",
      isSleep: true,
    },
  });
  assert.match(saved, /disabled=""[^>]*>Deactivate rule/);
  assert.match(saved, /Protection strength[^]*disabled=""/);
  assert.match(saved, /I understand this recurring rule will be deactivated/);
  for (const html of [available, protection, saved]) {
    assert.match(html, /<label for="[^"]+">/);
    assert.match(html, /<button[^>]+type="submit"/);
    assert.match(html, /<button[^>]+type="button"[^>]*>Cancel/);
  }
});

test("Balanced initializes inspectable canonical planning fields", () => {
  const html = renderConstraintEditor("preferences");
  assert.match(html, /Use Balanced values/);
  assert.match(html, /Preferred daily study limit \(minutes\)/);
  assert.match(html, /value="240"/);
  assert.match(html, /value="420"/);
  assert.match(html, /commute availability/);
  assert.match(html, /Minimum sleep/);
  assert.doesNotMatch(html, /name="preset"|name="mode"/);
});
