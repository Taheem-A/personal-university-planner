import { z } from "zod";
import type {
  IntegrationAccountRecord,
  PlannerRunRecord,
  PlanningStateSnapshot,
  RecurringWorkRuleRecord,
} from "@university-planner/database";
import {
  addLocalDays,
  expandRecurringWindows,
  instantToLocal,
  localDateTimeToInstant,
} from "@university-planner/shared";
import { applicationDatabase } from "../database";
import { requireActor } from "./authorization";
import { ApplicationError, resultOf } from "./errors";
import { planHistoryItem } from "./planner-reads";
import { calendarDateSchema, idSchema, validateInput } from "./validation";

export interface CourseListItem {
  id: string;
  code: string;
  name: string;
  colorReference: string | null;
  termName: string;
  termStatus: string;
  remainingMinutes: number | null;
  openAssessments: number;
  atRiskTasks: number;
}
export interface CourseDetailModel {
  id: string;
  code: string;
  name: string;
  colorReference: string | null;
  termName: string;
  termStart: string;
  termEnd: string;
  section: string | null;
  instructorName: string | null;
  creditValue: number | null;
  defaultTaskEnergy: string | null;
  defaultTaskLocation: string[];
  meetings: {
    id: string;
    type: string;
    location: string | null;
    recurrenceRule: string;
    startTimeLocal: string;
    endTimeLocal: string;
    timezone: string;
    attendanceRequired: boolean;
  }[];
  assessments: {
    id: string;
    title: string;
    type: string;
    dueAt: Date | null;
    gradeWeight: number | null;
    submissionStatus: string;
  }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    remainingMinutes: number | null;
    dueAt: Date | null;
  }[];
  recurringWork: { id: string; title: string; recurrenceRule: string; planningMode: string }[];
  sessions: { id: string; taskTitle: string; startAt: Date; endAt: Date; generatedBy: string }[];
  remainingMinutes: number | null;
  atRiskTasks: number;
}
export interface CoursesViewModel {
  timezone: string;
  activeTermName: string | null;
  courses: CourseListItem[];
  selectedCourse: CourseDetailModel | null;
  selectionUnavailable: boolean;
  explicitSelection: boolean;
}
export interface AvailabilityItem {
  id: string;
  kind: "EVENT" | "COURSE_MEETING" | "AVAILABILITY" | "PROTECTED" | "SLEEP" | "WORK";
  title: string;
  startAt: Date;
  endAt: Date;
  detail: string;
  courseCode: string | null;
  courseColorReference: string | null;
  constraintLevel: string | null;
  continuesFromPrevious?: boolean;
  continuesIntoNext?: boolean;
}
export interface AvailabilityViewModel {
  timezone: string;
  weekStart: string;
  weekEnd: string;
  days: { date: string; items: AvailabilityItem[] }[];
  ruleCounts: { availability: number; hardProtected: number; softProtected: number; sleep: number };
}
export interface SettingsViewModel {
  user: {
    name: string | null;
    timezone: string;
    locale: string | null;
    defaultDayStart: string | null;
    defaultDayEnd: string | null;
  };
  activeTerm: { name: string; startDate: string; endDate: string } | null;
  preferences: {
    preferredDailyStudyLimitMinutes: number;
    minimumFreeTimeMinutes: number;
    preferredDeadlineBufferHours: number;
    avoidLateHighEnergyTasks: boolean;
    maximumConsecutiveWorkMinutes: number;
    minimumBreakMinutes: number;
    scheduleCommuteWork: boolean;
    weekendWorkBias: number;
    planStabilityWindowMinutes: number;
    minimumSleepMinutes: number | null;
  } | null;
}
export interface IntegrationsViewModel {
  timezone: string;
  accounts: {
    id: string;
    provider: string;
    displayName: string | null;
    status: IntegrationAccountRecord["status"];
    lastSyncAt: Date | null;
    lastSuccessAt: Date | null;
    disconnectedAt: Date | null;
  }[];
}
export interface OnboardingViewModel {
  timezone: string;
  term: { name: string; status: string } | null;
  courseCount: number;
  meetingCount: number;
  availabilityCount: number;
  protectedCount: number;
  assessmentCount: number;
  taskCount: number;
  hasSuccessfulPlan: boolean;
  needsSetup: boolean;
}

export function buildOnboarding(
  state: PlanningStateSnapshot,
  successful: PlannerRunRecord | null,
): OnboardingViewModel {
  const userId = state.user.id;
  const term =
    state.academicTerms.find((item) => item.userId === userId && item.status === "ACTIVE") ?? null;
  const courses = state.courses.filter(
    (item) => item.userId === userId && !item.archivedAt && item.academicTermId === term?.id,
  );
  const courseIds = new Set(courses.map((item) => item.id));
  return {
    timezone: state.user.timezone,
    term: term ? { name: term.name, status: term.status } : null,
    courseCount: courses.length,
    meetingCount: state.courseMeetings.filter(
      (item) => item.userId === userId && !item.archivedAt && courseIds.has(item.courseId),
    ).length,
    availabilityCount: state.availabilityRules.filter(
      (item) => item.userId === userId && item.active,
    ).length,
    protectedCount: state.protectedTimeRules.filter((item) => item.userId === userId && item.active)
      .length,
    assessmentCount: state.assessments.filter(
      (item) => item.userId === userId && !item.archivedAt && courseIds.has(item.courseId),
    ).length,
    taskCount: state.tasks.filter(
      (item) =>
        item.userId === userId &&
        !item.archivedAt &&
        (item.courseId === null || courseIds.has(item.courseId)),
    ).length,
    hasSuccessfulPlan: Boolean(successful),
    needsSetup: !term || courses.length === 0 || !successful,
  };
}

function activeTasks(state: PlanningStateSnapshot) {
  return state.tasks.filter(
    (task) =>
      task.userId === state.user.id &&
      !task.archivedAt &&
      ["READY", "IN_PROGRESS", "BLOCKED"].includes(task.status),
  );
}
function sumKnown(values: (number | null)[]): number | null {
  return values.length && values.every((value) => value !== null)
    ? values.reduce<number>((total, value) => total + value!, 0)
    : null;
}
export function buildCourses(
  state: PlanningStateSnapshot,
  recurringWorkRules: RecurringWorkRuleRecord[],
  selectedId: string | null,
  successful: PlannerRunRecord | null = null,
): CoursesViewModel {
  const riskTasks = new Set(
    (successful ? (planHistoryItem(successful).summary?.risk ?? []) : [])
      .filter((risk) => ["CRITICAL", "INFEASIBLE"].includes(risk.feasibility))
      .map((risk) => risk.taskId),
  );
  const terms = new Map(
    state.academicTerms
      .filter((term) => term.userId === state.user.id)
      .map((term) => [term.id, term]),
  );
  const courses = state.courses.filter(
    (course) =>
      course.userId === state.user.id && !course.archivedAt && terms.has(course.academicTermId),
  );
  const tasks = activeTasks(state);
  const assessments = state.assessments.filter(
    (assessment) => assessment.userId === state.user.id && !assessment.archivedAt,
  );
  const selected = selectedId ? courses.find((course) => course.id === selectedId) : courses[0];
  const courseItems = courses
    .map((course) => {
      const term = terms.get(course.academicTermId)!;
      const related = tasks.filter(
        (task) =>
          task.courseId === course.id ||
          assessments.some(
            (assessment) =>
              assessment.id === task.assessmentId && assessment.courseId === course.id,
          ),
      );
      return {
        id: course.id,
        code: course.code,
        name: course.name,
        colorReference: course.colorReference,
        termName: term.name,
        termStatus: term.status,
        remainingMinutes: sumKnown(related.map((task) => task.remainingMinutes)),
        atRiskTasks: related.filter((task) => riskTasks.has(task.id)).length,
        openAssessments: assessments.filter(
          (assessment) =>
            assessment.courseId === course.id &&
            !["SUBMITTED", "GRADED", "EXEMPT", "CANCELLED"].includes(assessment.submissionStatus),
        ).length,
      };
    })
    .sort(
      (a, b) =>
        (a.termStatus === "ACTIVE" ? 0 : 1) - (b.termStatus === "ACTIVE" ? 0 : 1) ||
        a.code.localeCompare(b.code),
    );
  let selectedCourse: CourseDetailModel | null = null;
  if (selected) {
    const term = terms.get(selected.academicTermId)!;
    const ownAssessments = assessments.filter((assessment) => assessment.courseId === selected.id);
    const ownTasks = tasks.filter(
      (task) =>
        task.courseId === selected.id ||
        ownAssessments.some((assessment) => assessment.id === task.assessmentId),
    );
    const taskIds = new Set(ownTasks.map((task) => task.id));
    selectedCourse = {
      id: selected.id,
      code: selected.code,
      name: selected.name,
      colorReference: selected.colorReference,
      termName: term.name,
      termStart: term.startDate,
      termEnd: term.endDate,
      section: selected.section,
      instructorName: selected.instructorName,
      creditValue: selected.creditValue,
      defaultTaskEnergy: selected.defaultTaskEnergy,
      defaultTaskLocation: selected.defaultTaskLocation,
      meetings: state.courseMeetings
        .filter(
          (meeting) =>
            meeting.userId === state.user.id &&
            meeting.courseId === selected.id &&
            !meeting.archivedAt,
        )
        .map((meeting) => ({
          id: meeting.id,
          type: meeting.meetingType,
          location: meeting.location,
          recurrenceRule: meeting.recurrenceRule,
          startTimeLocal: meeting.startTimeLocal,
          endTimeLocal: meeting.endTimeLocal,
          timezone: meeting.timezone,
          attendanceRequired: meeting.attendanceRequired,
        })),
      assessments: ownAssessments
        .map((assessment) => ({
          id: assessment.id,
          title: assessment.title,
          type: assessment.assessmentType,
          dueAt: assessment.dueAt,
          gradeWeight: assessment.gradeWeight,
          submissionStatus: assessment.submissionStatus,
        }))
        .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity)),
      tasks: ownTasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        remainingMinutes: task.remainingMinutes,
        dueAt: task.dueAt,
      })),
      recurringWork: recurringWorkRules
        .filter(
          (rule) => rule.userId === state.user.id && rule.courseId === selected.id && rule.active,
        )
        .map((rule) => ({
          id: rule.id,
          title: rule.titleTemplate,
          recurrenceRule: rule.recurrenceRule,
          planningMode: rule.planningMode,
        })),
      sessions: state.workSessions
        .filter(
          (session) =>
            session.userId === state.user.id &&
            taskIds.has(session.taskId) &&
            !session.supersededById,
        )
        .map((session) => ({
          id: session.id,
          taskTitle: ownTasks.find((task) => task.id === session.taskId)!.title,
          startAt: session.startAt,
          endAt: session.endAt,
          generatedBy: session.generatedBy,
        })),
      remainingMinutes: sumKnown(ownTasks.map((task) => task.remainingMinutes)),
      atRiskTasks: ownTasks.filter((task) => riskTasks.has(task.id)).length,
    };
  }
  return {
    timezone: state.user.timezone,
    activeTermName:
      state.academicTerms.find((term) => term.userId === state.user.id && term.status === "ACTIVE")
        ?.name ?? null,
    courses: courseItems,
    selectedCourse,
    selectionUnavailable: Boolean(selectedId && !selected),
    explicitSelection: Boolean(selectedId),
  };
}

function recurrence(
  rule: Omit<Parameters<typeof expandRecurringWindows>[0], "effectiveUntil"> & {
    effectiveUntil: string | null;
  },
  first: string,
  last: string,
) {
  return expandRecurringWindows(
    { ...rule, effectiveUntil: rule.effectiveUntil ?? undefined },
    first,
    last,
  );
}
export function buildAvailability(
  state: PlanningStateSnapshot,
  weekStart: string,
): AvailabilityViewModel {
  const timezone = state.user.timezone;
  const end = addLocalDays(weekStart, 7);
  const startAt = localDateTimeToInstant({ date: weekStart, time: "00:00", timezone });
  const endAt = localDateTimeToInstant({ date: end, time: "00:00", timezone });
  const first = addLocalDays(weekStart, -1);
  const last = addLocalDays(weekStart, 6);
  const activeTerms = new Set(
    state.academicTerms
      .filter((term) => term.userId === state.user.id && term.status === "ACTIVE")
      .map((term) => term.id),
  );
  const courses = new Map(
    state.courses
      .filter(
        (course) =>
          course.userId === state.user.id &&
          !course.archivedAt &&
          activeTerms.has(course.academicTermId),
      )
      .map((course) => [course.id, course]),
  );
  const tasks = new Map(
    state.tasks.filter((task) => task.userId === state.user.id).map((task) => [task.id, task]),
  );
  const items: AvailabilityItem[] = [];
  const add = (item: AvailabilityItem) => {
    if (item.startAt < endAt && item.endAt > startAt) items.push(item);
  };
  for (const event of state.calendarEvents) {
    if (event.userId !== state.user.id || event.archivedAt) continue;
    const course = courses.get(event.courseId ?? "");
    add({
      id: `event:${event.id}`,
      kind: "EVENT",
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      detail: event.eventType,
      courseCode: course?.code ?? null,
      courseColorReference: course?.colorReference ?? null,
      constraintLevel: event.constraintLevel,
    });
  }
  for (const meeting of state.courseMeetings) {
    const course = courses.get(meeting.courseId);
    if (meeting.userId !== state.user.id || meeting.archivedAt || !course) continue;
    for (const window of recurrence(meeting, first, last))
      add({
        id: `meeting:${meeting.id}:${window.startAt.toISOString()}`,
        kind: "COURSE_MEETING",
        title: `${course.code} ${meeting.meetingType}`,
        startAt: window.startAt,
        endAt: window.endAt,
        detail: meeting.location ?? "Course meeting",
        courseCode: course.code,
        courseColorReference: course.colorReference,
        constraintLevel: meeting.attendanceRequired ? "HARD" : "SOFT",
      });
  }
  for (const rule of state.availabilityRules) {
    if (rule.userId !== state.user.id || !rule.active) continue;
    for (const window of recurrence(rule, first, last))
      add({
        id: `availability:${rule.id}:${window.startAt.toISOString()}`,
        kind: "AVAILABILITY",
        title: "Available for planning",
        startAt: window.startAt,
        endAt: window.endAt,
        detail: `${rule.energyLevel.toLowerCase()} energy · capacity ${Math.round(rule.capacityFactor * 100)}%`,
        courseCode: null,
        courseColorReference: null,
        constraintLevel: null,
      });
  }
  for (const rule of state.protectedTimeRules) {
    if (rule.userId !== state.user.id || !rule.active) continue;
    for (const window of recurrence(rule, first, last))
      add({
        id: `protected:${rule.id}:${window.startAt.toISOString()}`,
        kind: rule.isSleep ? "SLEEP" : "PROTECTED",
        title: rule.reason,
        startAt: window.startAt,
        endAt: window.endAt,
        detail: rule.isSleep ? "Sleep" : `${rule.protectionLevel.toLowerCase()} protection`,
        courseCode: null,
        courseColorReference: null,
        constraintLevel: rule.protectionLevel,
      });
  }
  for (const session of state.workSessions) {
    if (session.userId !== state.user.id || session.supersededById) continue;
    const task = tasks.get(session.taskId);
    const course = courses.get(task?.courseId ?? "");
    add({
      id: `work:${session.id}`,
      kind: "WORK",
      title: task?.title ?? "Work session",
      startAt: session.startAt,
      endAt: session.endAt,
      detail: session.generatedBy === "PLANNER" ? "Planner session" : "Manual session",
      courseCode: course?.code ?? null,
      courseColorReference: course?.colorReference ?? null,
      constraintLevel: null,
    });
  }
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addLocalDays(weekStart, index);
    const dayStart = localDateTimeToInstant({ date, time: "00:00", timezone });
    const dayEnd = localDateTimeToInstant({ date: addLocalDays(date, 1), time: "00:00", timezone });
    return {
      date,
      items: items
        .filter((item) => item.startAt < dayEnd && item.endAt > dayStart)
        .map((item) => ({
          ...item,
          startAt: item.startAt < dayStart ? dayStart : item.startAt,
          endAt: item.endAt > dayEnd ? dayEnd : item.endAt,
          continuesFromPrevious: item.startAt < dayStart,
          continuesIntoNext: item.endAt > dayEnd,
        }))
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.id.localeCompare(b.id)),
    };
  });
  return {
    timezone,
    weekStart,
    weekEnd: end,
    days,
    ruleCounts: {
      availability: state.availabilityRules.filter(
        (rule) => rule.userId === state.user.id && rule.active,
      ).length,
      hardProtected: state.protectedTimeRules.filter(
        (rule) =>
          rule.userId === state.user.id &&
          rule.active &&
          !rule.isSleep &&
          rule.protectionLevel === "HARD",
      ).length,
      softProtected: state.protectedTimeRules.filter(
        (rule) =>
          rule.userId === state.user.id &&
          rule.active &&
          !rule.isSleep &&
          rule.protectionLevel === "SOFT",
      ).length,
      sleep: state.protectedTimeRules.filter(
        (rule) => rule.userId === state.user.id && rule.active && rule.isSleep,
      ).length,
    },
  };
}

export function buildSettings(state: PlanningStateSnapshot): SettingsViewModel {
  const user = state.user;
  const preference = state.planningPreferences.find((item) => item.userId === user.id) ?? null;
  const activeTerm =
    state.academicTerms.find((term) => term.userId === user.id && term.status === "ACTIVE") ?? null;
  return {
    user: {
      name: user.name,
      timezone: user.timezone,
      locale: user.locale,
      defaultDayStart: user.defaultDayStart,
      defaultDayEnd: user.defaultDayEnd,
    },
    activeTerm: activeTerm
      ? { name: activeTerm.name, startDate: activeTerm.startDate, endDate: activeTerm.endDate }
      : null,
    preferences: preference
      ? {
          preferredDailyStudyLimitMinutes: preference.preferredDailyStudyLimitMinutes,
          minimumFreeTimeMinutes: preference.minimumFreeTimeMinutes,
          preferredDeadlineBufferHours: preference.preferredDeadlineBufferHours,
          avoidLateHighEnergyTasks: preference.avoidLateHighEnergyTasks,
          maximumConsecutiveWorkMinutes: preference.maximumConsecutiveWorkMinutes,
          minimumBreakMinutes: preference.minimumBreakMinutes,
          scheduleCommuteWork: preference.scheduleCommuteWork,
          weekendWorkBias: preference.weekendWorkBias,
          planStabilityWindowMinutes: preference.planStabilityWindowMinutes,
          minimumSleepMinutes: preference.minimumSleepMinutes,
        }
      : null,
  };
}
export function buildIntegrations(
  rows: IntegrationAccountRecord[],
  timezone: string,
): IntegrationsViewModel {
  return {
    timezone,
    accounts: rows
      .map((row) => ({
        id: row.id,
        provider: row.provider,
        displayName: row.displayName,
        status: row.status,
        lastSyncAt: row.lastSyncAt,
        lastSuccessAt: row.lastSuccessAt,
        disconnectedAt: row.disconnectedAt,
      }))
      .sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id)),
  };
}

const courseRequest = z.object({ courseId: idSchema.optional() }).strict();
const weekRequest = z.object({ date: calendarDateSchema.optional() }).strict();
function windowFor(now: Date, timezone: string) {
  const date = instantToLocal(now, timezone).date;
  return {
    start: localDateTimeToInstant({ date: addLocalDays(date, -7), time: "00:00", timezone }),
    end: localDateTimeToInstant({ date: addLocalDays(date, 21), time: "00:00", timezone }),
  };
}
export const secondaryViews = {
  courses(input: unknown = {}) {
    return resultOf(async () => {
      const actor = await requireActor();
      const data = validateInput(courseRequest, input);
      return applicationDatabase().readSnapshot(async (tx) => {
        const user = await tx.repositories.users.getById(actor.userId);
        if (!user) throw new ApplicationError("NOT_FOUND", "Record not found.");
        const range = windowFor(new Date(), user.timezone);
        const state = await tx.repositories.planningState.snapshot(
          actor.userId,
          range.start,
          range.end,
        );
        if (!state) throw new ApplicationError("NOT_FOUND", "Record not found.");
        const selectedId = data.courseId ?? null;
        const visibleTerms = new Set(
          state.academicTerms.filter((term) => term.userId === actor.userId).map((term) => term.id),
        );
        const selected =
          selectedId ??
          state.courses.find(
            (course) =>
              course.userId === actor.userId &&
              !course.archivedAt &&
              visibleTerms.has(course.academicTermId),
          )?.id;
        const [rules, successful] = await Promise.all([
          selected ? tx.repositories.recurringWorkRules.listForCourse(actor.userId, selected) : [],
          tx.repositories.plannerRuns.latestSuccessful(actor.userId),
        ]);
        return buildCourses(state, rules, selectedId, successful);
      });
    });
  },
  availability(input: unknown = {}) {
    return resultOf(async () => {
      const actor = await requireActor();
      const data = validateInput(weekRequest, input);
      return applicationDatabase().readSnapshot(async (tx) => {
        const user = await tx.repositories.users.getById(actor.userId);
        if (!user) throw new ApplicationError("NOT_FOUND", "Record not found.");
        const date = data.date ?? instantToLocal(new Date(), user.timezone).date;
        const monday = addLocalDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
        const start = localDateTimeToInstant({
          date: monday,
          time: "00:00",
          timezone: user.timezone,
        });
        const end = localDateTimeToInstant({
          date: addLocalDays(monday, 7),
          time: "00:00",
          timezone: user.timezone,
        });
        const state = await tx.repositories.planningState.snapshot(actor.userId, start, end);
        if (!state) throw new ApplicationError("NOT_FOUND", "Record not found.");
        return buildAvailability(state, monday);
      });
    });
  },
  settings() {
    return resultOf(async () => {
      const actor = await requireActor();
      return applicationDatabase().readSnapshot(async (tx) => {
        const user = await tx.repositories.users.getById(actor.userId);
        if (!user) throw new ApplicationError("NOT_FOUND", "Record not found.");
        const range = windowFor(new Date(), user.timezone);
        const state = await tx.repositories.planningState.snapshot(
          actor.userId,
          range.start,
          range.end,
        );
        if (!state) throw new ApplicationError("NOT_FOUND", "Record not found.");
        return buildSettings(state);
      });
    });
  },
  integrations() {
    return resultOf(async () => {
      const actor = await requireActor();
      return applicationDatabase().readSnapshot(async (tx) => {
        const user = await tx.repositories.users.getById(actor.userId);
        if (!user) throw new ApplicationError("NOT_FOUND", "Record not found.");
        return buildIntegrations(
          await tx.repositories.integrationAccounts.listForUser(actor.userId),
          user.timezone,
        );
      });
    });
  },
  onboarding() {
    return resultOf(async () => {
      const actor = await requireActor();
      return applicationDatabase().readSnapshot(async (tx) => {
        const user = await tx.repositories.users.getById(actor.userId);
        if (!user) throw new ApplicationError("NOT_FOUND", "Record not found.");
        const range = windowFor(new Date(), user.timezone);
        const [state, successful] = await Promise.all([
          tx.repositories.planningState.snapshot(actor.userId, range.start, range.end),
          tx.repositories.plannerRuns.latestSuccessful(actor.userId),
        ]);
        if (!state) throw new ApplicationError("NOT_FOUND", "Record not found.");
        return buildOnboarding(state, successful);
      });
    });
  },
};
