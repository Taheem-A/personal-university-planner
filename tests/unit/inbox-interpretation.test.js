const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const shared = require("../../dist/packages/shared/src/index.js");
const filename = path.resolve("apps/web/src/server/application/inbox-interpretation.ts");
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded.require = (id) => (id === "@university-planner/shared" ? shared : require(id));
loaded._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  filename,
);
const { interpretInboxText } = loaded.exports;
const own = [{ id: "owned-course", code: "CIV100" }];

test("explicit task grammar proposes only scoped, exact facts", () => {
  const result = interpretInboxText(
    "task: Solve problem set; course CIV100; duration 2h; due 2026-10-05 17:00",
    own,
    "America/Toronto",
  );
  assert.equal(result.proposedEntityType, "TASK");
  assert.deepEqual(result.proposedPayload, {
    title: "Solve problem set",
    courseId: "owned-course",
    durationMinutes: 120,
    dueAt: "2026-10-05T21:00:00.000Z",
  });
  assert.equal(
    interpretInboxText("task: Solve; duration 90m", own, "America/Toronto").proposedPayload
      .durationMinutes,
    90,
  );
});

test("ambiguous or unsupported captures remain raw without invented deadlines", () => {
  assert.equal(interpretInboxText("CIV assignment", own, "America/Toronto"), null);
  assert.equal(
    interpretInboxText("task: Maybe next Sunday", own, "America/Toronto").proposedPayload.dueAt,
    null,
  );
  assert.equal(interpretInboxText("task: Work; course OTHER100", own, "America/Toronto"), null);
  assert.equal(interpretInboxText("task: Work; duration about 2h", own, "America/Toronto"), null);
  assert.equal(
    interpretInboxText("task: Work; due 2026-03-08 02:30", own, "America/Toronto"),
    null,
  );
  assert.equal(
    interpretInboxText("task: Work; due 2026-11-01 01:30", own, "America/Toronto"),
    null,
  );
});

test("assignment and event proposals preserve unknowns and exact fixed times", () => {
  assert.deepEqual(
    interpretInboxText("assignment: Lab report; course CIV100", own, "America/Toronto"),
    {
      proposedEntityType: "ASSESSMENT",
      proposedPayload: { title: "Lab report", courseId: "owned-course", dueAt: null },
    },
  );
  const event = interpretInboxText(
    "event: Appointment; start 2026-10-05 13:00; end 2026-10-05 14:00",
    own,
    "America/Toronto",
  );
  assert.equal(event.proposedEntityType, "CALENDAR_EVENT");
  assert.equal(event.proposedPayload.startAt, "2026-10-05T17:00:00.000Z");
  assert.equal(
    interpretInboxText(
      "event: Reverse; start 2026-10-05 14:00; end 2026-10-05 13:00",
      own,
      "America/Toronto",
    ),
    null,
  );
});
