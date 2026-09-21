const test = require("node:test");
const assert = require("node:assert/strict");
const { deriveEstimateLearning } = require("../../dist/packages/analytics/src/index.js");

const date = new Date("2026-09-21T12:00:00-04:00");

test("estimate learning does not adapt before three useful observations", () => {
  const result = deriveEstimateLearning([
    { estimatedMinutes: 60, actualMinutes: 90, occurredAt: date },
    { estimatedMinutes: 60, actualMinutes: 84, occurredAt: date },
  ]);
  assert.equal(result.sampleCount, 2);
  assert.equal(result.multiplier, 1);
  assert.equal(result.confidence, 0);
});

test("estimate learning uses a bounded robust multiplier after enough evidence", () => {
  const result = deriveEstimateLearning([
    { estimatedMinutes: 60, actualMinutes: 90, occurredAt: date },
    { estimatedMinutes: 60, actualMinutes: 84, occurredAt: date },
    { estimatedMinutes: 60, actualMinutes: 96, occurredAt: date },
    { estimatedMinutes: 60, actualMinutes: 400, occurredAt: date, atypical: true },
  ]);
  assert.equal(result.sampleCount, 3);
  assert.equal(result.multiplier, 1.5);
  assert.equal(result.confidence, 0.3);
});
