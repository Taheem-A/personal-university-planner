const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const shared = require("../../dist/packages/shared/src/index.js");
const filename = path.resolve("apps/web/src/server/application/secondary-reads.ts");
const webRequire = Module.createRequire(path.resolve("apps/web/package.json"));
const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded.require = (id) =>
  ({
    "@university-planner/shared": shared,
    "../database": {},
    "./authorization": {},
    "./errors": {},
    "./planner-reads": { planHistoryItem: (run) => run },
    "./validation": {
      idSchema: webRequire("zod").z.string(),
      calendarDateSchema: webRequire("zod").z.string(),
    },
  })[id] ?? webRequire(id);
loaded._compile(source, filename);
const reads = loaded.exports;
const owner = "synthetic-owner";
const now = new Date("2026-03-02T12:00:00Z");
function state() {
  return {
    user: {
      id: owner,
      name: "Synthetic Student",
      timezone: "America/Toronto",
      locale: "en-CA",
      defaultDayStart: "08:00",
      defaultDayEnd: "22:00",
    },
    academicTerms: [
      {
        id: "term",
        userId: owner,
        name: "Synthetic Spring",
        status: "ACTIVE",
        startDate: "2026-01-01",
        endDate: "2026-04-30",
      },
    ],
    courses: [
      {
        id: "course",
        userId: owner,
        academicTermId: "term",
        code: "SYN101",
        name: "Synthetic Mechanics",
        colorReference: "indigo",
        section: "A",
        instructorName: "Synthetic Instructor",
        creditValue: 3,
        defaultTaskEnergy: "MEDIUM",
        defaultTaskLocation: [],
        archivedAt: null,
      },
      {
        id: "foreign",
        userId: "other",
        academicTermId: "term",
        code: "PRIVATE",
        name: "Private Course",
        archivedAt: null,
      },
    ],
    courseMeetings: [
      {
        id: "meeting",
        userId: owner,
        courseId: "course",
        meetingType: "LECTURE",
        location: "Room 1",
        attendanceRequired: true,
        recurrenceRule: "FREQ=DAILY",
        startTimeLocal: "09:00",
        endTimeLocal: "10:00",
        spansNextDay: false,
        timezone: "America/Toronto",
        effectiveFrom: "2026-03-01",
        effectiveUntil: "2026-03-08",
        archivedAt: null,
      },
    ],
    assessments: [
      {
        id: "assessment",
        userId: owner,
        courseId: "course",
        title: "Synthetic report",
        assessmentType: "Report",
        dueAt: new Date("2026-03-10T20:00:00Z"),
        gradeWeight: 15,
        submissionStatus: "NOT_SUBMITTED",
        archivedAt: null,
      },
    ],
    tasks: [
      {
        id: "task",
        userId: owner,
        courseId: "course",
        assessmentId: "assessment",
        title: "Draft report",
        status: "READY",
        remainingMinutes: 90,
        dueAt: null,
        archivedAt: null,
      },
    ],
    calendarEvents: [
      {
        id: "event",
        userId: owner,
        courseId: null,
        title: "Synthetic appointment",
        eventType: "APPOINTMENT",
        startAt: new Date("2026-03-03T18:00:00Z"),
        endAt: new Date("2026-03-03T19:00:00Z"),
        constraintLevel: "HARD",
        archivedAt: null,
      },
    ],
    availabilityRules: [
      {
        id: "available",
        userId: owner,
        active: true,
        recurrenceRule: "FREQ=DAILY",
        startTimeLocal: "08:00",
        endTimeLocal: "12:00",
        spansNextDay: false,
        timezone: "America/Toronto",
        effectiveFrom: "2026-03-01",
        effectiveUntil: "2026-03-08",
        energyLevel: "MEDIUM",
        capacityFactor: 1,
        allowedLocationTags: [],
      },
    ],
    protectedTimeRules: [
      {
        id: "sleep",
        userId: owner,
        active: true,
        recurrenceRule: "FREQ=DAILY",
        startTimeLocal: "22:00",
        endTimeLocal: "06:00",
        spansNextDay: true,
        timezone: "America/Toronto",
        effectiveFrom: "2026-03-01",
        effectiveUntil: "2026-03-08",
        protectionLevel: "HARD",
        reason: "Sleep",
        isSleep: true,
      },
      {
        id: "soft",
        userId: owner,
        active: true,
        recurrenceRule: "FREQ=DAILY",
        startTimeLocal: "18:00",
        endTimeLocal: "19:00",
        spansNextDay: false,
        timezone: "America/Toronto",
        effectiveFrom: "2026-03-01",
        effectiveUntil: "2026-03-08",
        protectionLevel: "SOFT",
        reason: "Personal time",
        isSleep: false,
      },
    ],
    planningPreferences: [
      {
        userId: owner,
        preferredDailyStudyLimitMinutes: 240,
        minimumFreeTimeMinutes: 60,
        preferredDeadlineBufferHours: 24,
        avoidLateHighEnergyTasks: true,
        maximumConsecutiveWorkMinutes: 120,
        minimumBreakMinutes: 15,
        scheduleCommuteWork: false,
        weekendWorkBias: -0.5,
        planStabilityWindowMinutes: 120,
        minimumSleepMinutes: null,
      },
    ],
    workSessions: [
      {
        id: "session",
        userId: owner,
        taskId: "task",
        startAt: new Date("2026-03-03T14:00:00Z"),
        endAt: new Date("2026-03-03T15:00:00Z"),
        generatedBy: "PLANNER",
        supersededById: null,
      },
    ],
  };
}
test("Course context is canonical, scoped, and preserves unknown selection privacy", () => {
  const rule = {
    id: "review",
    userId: owner,
    courseId: "course",
    active: true,
    titleTemplate: "Review lecture",
    recurrenceRule: "FREQ=WEEKLY",
    planningMode: "AUTO",
  };
  const model = reads.buildCourses(state(), [rule], "course");
  assert.equal(model.courses.length, 1);
  assert.equal(model.courses[0].code, "SYN101");
  assert.equal(model.selectedCourse.assessments[0].gradeWeight, 15);
  assert.equal(model.selectedCourse.remainingMinutes, 90);
  assert.equal(model.selectedCourse.sessions[0].taskTitle, "Draft report");
  assert.equal(model.selectedCourse.recurringWork[0].title, "Review lecture");
  const withRisk = reads.buildCourses(state(), [rule], "course", {
    summary: { risk: [{ taskId: "task", feasibility: "CRITICAL" }] },
  });
  assert.equal(withRisk.selectedCourse.atRiskTasks, 1);
  for (const id of ["foreign", "missing"]) {
    const unavailable = reads.buildCourses(state(), [], id);
    assert.equal(unavailable.selectedCourse, null);
    assert.equal(unavailable.selectionUnavailable, true);
  }
});
test("Availability expands recurrence in the account timezone across spring DST", () => {
  const model = reads.buildAvailability(state(), "2026-03-02");
  assert.equal(model.days.length, 7);
  assert.deepEqual(model.ruleCounts, {
    availability: 1,
    hardProtected: 0,
    softProtected: 1,
    sleep: 1,
  });
  assert.equal(
    model.days[1].items.some((item) => item.title === "Synthetic appointment"),
    true,
  );
  const before = model.days[5].items.find((item) => item.id.startsWith("meeting:"));
  const after = model.days[6].items.find((item) => item.id.startsWith("meeting:"));
  assert.equal(before.startAt.toISOString(), "2026-03-07T14:00:00.000Z");
  assert.equal(after.startAt.toISOString(), "2026-03-08T13:00:00.000Z");
  assert.equal(
    model.days[6].items.some((item) => item.kind === "SLEEP"),
    true,
  );
  const overnight = model.days[1].items.find(
    (item) => item.kind === "SLEEP" && item.continuesFromPrevious,
  );
  assert.equal(overnight.startAt.toISOString(), "2026-03-03T05:00:00.000Z");
  assert.equal(
    model.days[1].items.some((item) => item.kind === "WORK"),
    true,
  );
});
test("Settings exposes recorded facts and integrations use only metadata state", () => {
  const settings = reads.buildSettings(state());
  assert.equal(settings.user.timezone, "America/Toronto");
  assert.equal(settings.activeTerm.name, "Synthetic Spring");
  assert.equal(settings.preferences.minimumSleepMinutes, null);
  const integrations = reads.buildIntegrations(
    [
      {
        id: "active",
        provider: "GOOGLE_CALENDAR",
        displayName: "Synthetic calendar",
        status: "ACTIVE",
        credentialReference: "private-secret",
        lastSyncAt: now,
        lastSuccessAt: now,
        disconnectedAt: null,
      },
      {
        id: "disconnected",
        provider: "QUERCUS",
        displayName: null,
        status: "DISCONNECTED",
        credentialReference: null,
        lastSyncAt: null,
        lastSuccessAt: null,
        disconnectedAt: now,
      },
    ],
    "America/Toronto",
  );
  assert.equal(integrations.accounts[0].status, "ACTIVE");
  assert.equal(integrations.accounts[1].status, "DISCONNECTED");
  assert.equal("credentialReference" in integrations.accounts[0], false);
});
