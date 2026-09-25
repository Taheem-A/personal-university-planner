import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import typescript from "typescript";

const webRequire = createRequire(path.resolve("apps/web/package.json"));
const React = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const root = path.resolve("apps/web/src/components");
const Link = React.forwardRef(({ href, children, ...props }, ref) =>
  React.createElement("a", { ...props, href, ref }, children),
);
Link.displayName = "TestLink";
const icon = ({ size, ...props }) =>
  React.createElement("svg", { ...props, width: size ?? 16, height: size ?? 16 });
function load(file, dependencies = {}) {
  const javascript = typescript.transpileModule(readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      jsx: typescript.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  const require = (name) => {
    if (name === "next/link") return { __esModule: true, default: Link };
    if (name === "lucide-react") return new Proxy({}, { get: () => icon });
    if (name === "./planner-primitives") return dependencies.primitives;
    if (name === "./course-color") return dependencies.courseColor;
    if (name === "./course-close")
      return {
        CourseClose: () =>
          React.createElement(
            "button",
            { className: "icon-button course-close", "aria-label": "Close course detail" },
            "Close",
          ),
      };
    if (name === "./appearance-control")
      return {
        AppearanceControl: () =>
          React.createElement("button", { "aria-label": "Use dark appearance" }, "Appearance"),
      };
    if (name === "@university-planner/shared")
      return {
        addLocalDays: (date, days) =>
          new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10),
      };
    return webRequire(name);
  };
  vm.runInNewContext(
    javascript,
    { exports, require, Date, Intl, Math, Map, Set, URL },
    { filename: file },
  );
  return exports;
}
const primitives = load("planner-primitives.tsx");
const courseColor = load("course-color.ts");
const { CoursesView } = load("courses-view.tsx", { primitives, courseColor });
const { AvailabilityView } = load("availability-view.tsx", { courseColor });
const { SettingsView } = load("settings-view.tsx");
const { IntegrationsView } = load("integrations-view.tsx", { primitives });

export function courseModel(explicitSelection = true) {
  const detail = {
    id: "synthetic-course",
    code: "SYN101",
    name: "Synthetic Mechanics",
    colorReference: "indigo",
    termName: "Synthetic term",
    termStart: "2026-01-01",
    termEnd: "2026-04-30",
    section: "A",
    instructorName: "Synthetic Instructor",
    creditValue: 3,
    defaultTaskEnergy: "MEDIUM",
    defaultTaskLocation: [],
    meetings: [
      {
        id: "meeting",
        type: "LECTURE",
        location: "Room 1",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
        startTimeLocal: "09:00",
        endTimeLocal: "10:00",
        timezone: "America/Toronto",
        attendanceRequired: true,
      },
    ],
    assessments: [
      {
        id: "assessment",
        title: "Synthetic report",
        type: "Report",
        dueAt: new Date("2026-03-10T20:00:00Z"),
        gradeWeight: 15,
        submissionStatus: "NOT_SUBMITTED",
      },
    ],
    tasks: [
      { id: "task", title: "Draft report", status: "READY", remainingMinutes: 90, dueAt: null },
    ],
    recurringWork: [
      { id: "rule", title: "Review lecture", recurrenceRule: "FREQ=WEEKLY", planningMode: "AUTO" },
    ],
    sessions: [],
    remainingMinutes: 90,
    atRiskTasks: 1,
  };
  return {
    timezone: "America/Toronto",
    activeTermName: "Synthetic term",
    courses: [
      {
        id: detail.id,
        code: detail.code,
        name: detail.name,
        colorReference: detail.colorReference,
        termName: detail.termName,
        termStatus: "ACTIVE",
        remainingMinutes: 90,
        atRiskTasks: 1,
        openAssessments: 1,
      },
    ],
    selectedCourse: detail,
    selectionUnavailable: false,
    explicitSelection,
  };
}
export function availabilityModel() {
  const date = "2026-03-02";
  return {
    timezone: "America/Toronto",
    weekStart: date,
    weekEnd: "2026-03-09",
    ruleCounts: { availability: 1, hardProtected: 1, softProtected: 1, sleep: 1 },
    days: Array.from({ length: 7 }, (_, index) => ({
      date: new Date(Date.parse(`${date}T00:00:00Z`) + index * 86_400_000)
        .toISOString()
        .slice(0, 10),
      items:
        index === 0
          ? [
              {
                id: "meeting",
                kind: "COURSE_MEETING",
                title: "SYN101 LECTURE",
                startAt: new Date("2026-03-02T14:00:00Z"),
                endAt: new Date("2026-03-02T15:00:00Z"),
                detail: "Room 1",
                courseCode: "SYN101",
                courseColorReference: "indigo",
                constraintLevel: "HARD",
              },
              {
                id: "availability",
                kind: "AVAILABILITY",
                title: "Available for planning",
                startAt: new Date("2026-03-02T15:00:00Z"),
                endAt: new Date("2026-03-02T18:00:00Z"),
                detail: "medium energy",
                courseCode: null,
                courseColorReference: null,
                constraintLevel: null,
              },
              {
                id: "sleep",
                kind: "SLEEP",
                title: "Sleep",
                startAt: new Date("2026-03-03T03:00:00Z"),
                endAt: new Date("2026-03-03T11:00:00Z"),
                detail: "Sleep",
                courseCode: null,
                courseColorReference: null,
                constraintLevel: "HARD",
              },
            ]
          : [],
    })),
  };
}
export function settingsModel() {
  return {
    user: {
      name: "Synthetic Student",
      timezone: "America/Toronto",
      locale: "en-CA",
      defaultDayStart: "08:00",
      defaultDayEnd: "22:00",
    },
    activeTerm: { name: "Synthetic term", startDate: "2026-01-01", endDate: "2026-04-30" },
    preferences: {
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
  };
}
export function integrationsModel() {
  return {
    timezone: "America/Toronto",
    accounts: [
      {
        id: "google",
        provider: "GOOGLE_CALENDAR",
        displayName: "Synthetic calendar",
        status: "ACTIVE",
        lastSyncAt: null,
        lastSuccessAt: null,
        disconnectedAt: null,
      },
      {
        id: "lms",
        provider: "QUERCUS",
        displayName: null,
        status: "DISCONNECTED",
        lastSyncAt: null,
        lastSuccessAt: null,
        disconnectedAt: null,
      },
    ],
  };
}
export const renderCourses = (model = courseModel()) =>
  renderToStaticMarkup(React.createElement(CoursesView, { model }));
export const renderAvailability = (model = availabilityModel()) =>
  renderToStaticMarkup(React.createElement(AvailabilityView, { model }));
export const renderSettings = (model = settingsModel(), section = "general") =>
  renderToStaticMarkup(React.createElement(SettingsView, { model, section }));
export const renderIntegrations = (model = integrationsModel()) =>
  renderToStaticMarkup(React.createElement(IntegrationsView, { model }));
