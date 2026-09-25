const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const shared = require("../../dist/packages/shared/src/index.js");
const filename = path.resolve("apps/web/src/server/application/information-reads.ts");
const webRequire = Module.createRequire(path.resolve("apps/web/package.json"));
const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function load(overrides = {}) {
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = (id) =>
    overrides[id] ?? (id === "@university-planner/shared" ? shared : webRequire(id));
  loaded._compile(source, filename);
  return loaded.exports;
}
const now = new Date("2026-03-09T12:00:00Z");
function state() {
  return {
    user: { id: "owner", timezone: "America/Toronto" },
    courses: [
      {
        id: "course",
        userId: "owner",
        code: "SYN101",
        name: "Synthetic Course",
        colorReference: "indigo",
        archivedAt: null,
      },
      { id: "foreign-course", userId: "other", code: "PRIVATE", name: "Private", archivedAt: null },
    ],
    assessments: [
      {
        id: "exam",
        userId: "owner",
        courseId: "course",
        title: "Synthetic exam",
        assessmentType: "Exam",
        dueAt: new Date("2026-03-12T20:00:00Z"),
        releaseAt: null,
        preferredCompletionAt: null,
        gradeWeight: 15,
        gradeReceived: null,
        notes: null,
        instructionsUrl: null,
        submissionUrl: null,
        submissionStatus: "NOT_SUBMITTED",
        submittedAt: null,
        source: "MANUAL",
        sourceAuthority: "USER",
        sourceConfidence: "MANUAL",
        archivedAt: null,
      },
      {
        id: "unknown",
        userId: "owner",
        courseId: "course",
        title: "Undated essay",
        assessmentType: "Essay",
        dueAt: null,
        releaseAt: null,
        preferredCompletionAt: null,
        gradeWeight: null,
        gradeReceived: null,
        notes: null,
        instructionsUrl: null,
        submissionUrl: null,
        submissionStatus: "NOT_SUBMITTED",
        submittedAt: null,
        source: "MANUAL",
        sourceAuthority: "USER",
        sourceConfidence: null,
        archivedAt: null,
      },
      {
        id: "foreign",
        userId: "other",
        courseId: "foreign-course",
        title: "Private exam",
        archivedAt: null,
      },
    ],
    tasks: [
      {
        id: "study",
        userId: "owner",
        courseId: "course",
        assessmentId: "exam",
        title: "Study",
        status: "READY",
        remainingMinutes: 90,
        dueAt: null,
        archivedAt: null,
      },
      {
        id: "unresolved",
        userId: "owner",
        courseId: null,
        assessmentId: null,
        title: "Unresolved note",
        status: "INBOX",
        remainingMinutes: null,
        dueAt: null,
        archivedAt: null,
      },
      {
        id: "independent",
        userId: "owner",
        courseId: "course",
        assessmentId: null,
        title: "Read notes",
        status: "READY",
        remainingMinutes: null,
        dueAt: null,
        archivedAt: null,
      },
    ],
    workSessions: [
      {
        id: "session",
        userId: "owner",
        taskId: "study",
        startAt: new Date("2026-03-10T14:00:00Z"),
        endAt: new Date("2026-03-10T15:00:00Z"),
        generatedBy: "PLANNER",
        locked: false,
        supersededById: null,
      },
    ],
  };
}
const reads = load({
  "./planner-reads": { planHistoryItem: (run) => run },
  "../database": {},
  "./authorization": {},
  "./errors": {},
  "./validation": { idSchema: webRequire("zod").z.string() },
});

test("Upcoming projects owner commitments, unknowns, risk and assessment context", () => {
  const run = {
    status: "SUCCEEDED",
    summary: { risk: [{ taskId: "study", feasibility: "CRITICAL" }] },
  };
  const model = reads.buildUpcoming(state(), run, run, now, "exam", "PRESSURE");
  assert.equal(model.planner.status, "CURRENT");
  assert.deepEqual(
    model.groups.map((group) => group.id),
    ["OVERDUE", "NEXT_7", "NEXT_14", "LATER", "UNKNOWN"],
  );
  const next = model.groups.find((group) => group.id === "NEXT_7").items;
  assert.equal(next[0].title, "Synthetic exam");
  assert.equal(next[0].remainingMinutes, 90);
  assert.equal(next[0].risk, "CRITICAL");
  assert.equal(model.groups.find((group) => group.id === "UNKNOWN").items.length, 2);
  assert.equal(
    model.groups
      .flatMap((group) => group.items)
      .some((item) => item.title === "Private exam" || item.title === "Unresolved note"),
    false,
  );
  assert.equal(model.selectedAssessment.gradeWeight, 15);
  assert.equal(model.selectedAssessment.sessions[0].taskTitle, "Study");
  assert.equal(model.selectedAssessment.sourceAuthority, "USER");
});

test("Unknown and unauthorized selections disclose no assessment facts", () => {
  const unknown = reads.buildUpcoming(state(), null, null, now, "unknown", "DUE");
  assert.equal(unknown.selectedAssessment.dueAt, null);
  assert.equal(unknown.selectedAssessment.remainingMinutes, null);
  assert.equal(unknown.planner.status, "UNPLANNED");
  const foreign = reads.buildUpcoming(state(), null, null, now, "foreign", "DUE");
  assert.equal(foreign.selectedAssessment, null);
  assert.equal(foreign.selectionUnavailable, true);
  const absent = reads.buildUpcoming(state(), null, null, now, "missing", "DUE");
  assert.equal(absent.selectedAssessment, null);
  assert.equal(absent.selectionUnavailable, true);
});

test("FAILED and RUNNING preserve last successful plan authority", () => {
  const good = {
    status: "SUCCEEDED",
    summary: { risk: [{ taskId: "study", feasibility: "CRITICAL" }] },
  };
  for (const status of ["FAILED", "RUNNING"]) {
    const model = reads.buildUpcoming(state(), { status }, good, now, null, "PRESSURE");
    assert.equal(model.planner.status, status);
    assert.equal(model.groups.find((group) => group.id === "NEXT_7").items[0].risk, "CRITICAL");
    assert.equal(model.planner.authoritativeRun, good);
  }
});

test("Inbox preserves canonical raw capture and only declared proposals", () => {
  const rows = [
    {
      id: "older",
      rawText: "Synthetic lab reminder",
      status: "ACTIVE",
      source: "MANUAL",
      sourceAuthority: "USER",
      proposedEntityType: null,
      proposedPayload: null,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      processedAt: null,
    },
    {
      id: "newer",
      rawText: "Essay on Friday",
      status: "PROCESSED",
      source: "MANUAL",
      sourceAuthority: "USER",
      proposedEntityType: "ASSESSMENT",
      proposedPayload: { title: "Essay" },
      createdAt: new Date("2026-03-02T00:00:00Z"),
      processedAt: new Date("2026-03-03T00:00:00Z"),
    },
  ];
  const model = reads.buildInbox(rows, "America/Toronto");
  assert.equal(model.timezone, "America/Toronto");
  assert.deepEqual(
    model.tabs.map((tab) => tab.count),
    [1, 1, 0],
  );
  assert.equal(model.items[0].proposedTitle, "Essay");
  assert.equal(model.items[1].proposedTitle, null);
  assert.equal(rows[0].id, "older");
  assert.deepEqual(
    reads.buildInbox([], "America/Toronto").tabs.map((tab) => tab.count),
    [0, 0, 0],
  );
});
