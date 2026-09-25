const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve("apps/web/src/server/application/planner-presentation-reads.ts");
const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.require = (id) => ({ "./planner-reads": {}, "./errors": {} })[id] ?? require(id);
loaded._compile(source, filename);
const { buildPlannerPresentation } = loaded.exports;

test("Planner panel projection exposes only recorded status, work, risk and warning", () => {
  const model = buildPlannerPresentation({
    date: "2026-03-02",
    timezone: "America/Toronto",
    planner: {
      status: "FAILED",
      authoritativeRun: { completedAt: new Date("2026-03-01T20:00:00Z") },
    },
    remainingPlannedWorkMinutes: 85,
    nextWorkItem: {
      title: "Synthetic report",
      courseCode: "SYN101",
      startAt: new Date("2026-03-02T19:00:00Z"),
    },
    risks: [
      {
        taskId: "task",
        title: "Synthetic report",
        courseCode: "SYN101",
        feasibility: "INFEASIBLE",
        deficitMinutes: 45,
        slackMinutes: null,
      },
    ],
    warnings: [
      {
        code: "CAPACITY_SHORTFALL",
        taskId: "task",
        deficitMinutes: 45,
        reasonCodes: ["NO_SUITABLE_WINDOW"],
      },
    ],
  });
  assert.equal(model.status, "FAILED");
  assert.equal(model.authoritativePlanAt, "2026-03-01T20:00:00.000Z");
  assert.equal(model.risks[0].deficitMinutes, 45);
  assert.deepEqual(model.warnings[0].reasonCodes, ["NO_SUITABLE_WINDOW"]);
  assert.equal(model.nextWork.title, "Synthetic report");
  assert.equal("sessions" in model, false);
});
