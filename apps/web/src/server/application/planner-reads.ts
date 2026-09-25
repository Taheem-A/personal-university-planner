import { z } from "zod";
import type {
  Database,
  PlannerRunCompletionSummary,
  PlannerRunDelta,
  PlannerRunRecord,
  PlannerRunRisk,
  PlannerRunStoredWarning,
  PlanningStateSnapshot,
} from "@university-planner/database";
import {
  addLocalDays,
  expandRecurringWindows,
  intersectIntervals,
  instantToLocal,
  localDateTimeToInstant,
  mergeIntervals,
  sortByStart,
} from "@university-planner/shared";
import { applicationDatabase } from "../database";
import { requireActor } from "./authorization";
import { ApplicationError, resultOf } from "./errors";
import { calendarDateSchema, validateInput } from "./validation";

export interface PlanHistoryItem {
  id: string;
  trigger: {
    type: PlannerRunRecord["triggerType"];
    entityType: string | null;
    entityId: string | null;
  };
  startedAt: Date;
  completedAt: Date | null;
  plannerVersion: string;
  horizon: { startAt: Date; endAt: Date };
  status: PlannerRunRecord["status"];
  warnings: PlannerRunStoredWarning[];
  summary: PlannerRunCompletionSummary | null;
  delta: PlannerRunDelta | null;
  riskChanges: Pick<
    PlannerRunDelta,
    "newlyAtRisk" | "worsenedRisk" | "improvedRisk" | "resolvedRisk" | "unchangedRisk"
  > | null;
}

function summaryOf(run: PlannerRunRecord | null): PlannerRunCompletionSummary | null {
  const value = run?.summary;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !Array.isArray(value.risk) ||
    !value.delta ||
    typeof value.delta !== "object" ||
    Array.isArray(value.delta)
  )
    return null;
  const raw = value as Record<string, unknown>;
  const rawDelta = raw.delta as Record<string, unknown>;
  const strings = (items: unknown): string[] =>
    Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : [];
  const delta: PlannerRunDelta = {
    retained: strings(rawDelta.retained),
    moved: Array.isArray(rawDelta.moved)
      ? rawDelta.moved.flatMap((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const move = item as Record<string, unknown>;
          return ["fromSessionId", "toSessionId", "taskId", "fromStartAt", "toStartAt"].every(
            (key) => typeof move[key] === "string",
          )
            ? [
                {
                  fromSessionId: move.fromSessionId as string,
                  toSessionId: move.toSessionId as string,
                  taskId: move.taskId as string,
                  fromStartAt: move.fromStartAt as string,
                  toStartAt: move.toStartAt as string,
                },
              ]
            : [];
        })
      : [],
    added: strings(rawDelta.added),
    removed: strings(rawDelta.removed),
    newlyAtRisk: strings(rawDelta.newlyAtRisk),
    worsenedRisk: strings(rawDelta.worsenedRisk),
    improvedRisk: strings(rawDelta.improvedRisk),
    resolvedRisk: strings(rawDelta.resolvedRisk),
    unchangedRisk: strings(rawDelta.unchangedRisk),
  };
  const risk: PlannerRunRisk[] = value.risk.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      typeof item.taskId !== "string" ||
      !["CONSTRAINED", "CRITICAL", "INFEASIBLE", "HORIZON_LIMITED"].includes(
        String(item.feasibility),
      ) ||
      typeof item.deficitMinutes !== "number"
    )
      return [];
    return [
      {
        taskId: item.taskId,
        feasibility: item.feasibility as PlannerRunRisk["feasibility"],
        deficitMinutes: item.deficitMinutes,
        slackMinutes: typeof item.slackMinutes === "number" ? item.slackMinutes : null,
      },
    ];
  });
  const sessionReasons: Record<string, string[]> = {};
  if (
    raw.sessionReasons &&
    typeof raw.sessionReasons === "object" &&
    !Array.isArray(raw.sessionReasons)
  )
    for (const [id, codes] of Object.entries(raw.sessionReasons))
      sessionReasons[id] = strings(codes);
  if (raw.planStatus !== "VALID" && raw.planStatus !== "INFEASIBLE") return null;
  return {
    planStatus: raw.planStatus,
    generatedSessionCount: Number(raw.generatedSessionCount) || 0,
    retainedSessionCount: Number(raw.retainedSessionCount) || 0,
    unscheduledMinutes: Number(raw.unscheduledMinutes) || 0,
    risk,
    delta,
    sessionReasons,
  };
}
function warningsOf(run: PlannerRunRecord | null): PlannerRunStoredWarning[] {
  if (!Array.isArray(run?.warnings)) return [];
  return run.warnings.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.code !== "string")
      return [];
    return [
      {
        code: item.code,
        ...(typeof item.taskId === "string" ? { taskId: item.taskId } : {}),
        ...(typeof item.deficitMinutes === "number" ? { deficitMinutes: item.deficitMinutes } : {}),
        reasonCodes: Array.isArray(item.reasonCodes)
          ? item.reasonCodes.filter((code): code is string => typeof code === "string")
          : [],
      },
    ];
  });
}
export function planHistoryItem(run: PlannerRunRecord): PlanHistoryItem {
  const summary = summaryOf(run);
  const delta = summary?.delta ?? null;
  return {
    id: run.id,
    trigger: {
      type: run.triggerType,
      entityType: run.triggerEntityType,
      entityId: run.triggerEntityId,
    },
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    plannerVersion: run.plannerVersion,
    horizon: { startAt: run.planningHorizonStart, endAt: run.planningHorizonEnd },
    status: run.status,
    warnings: warningsOf(run),
    summary,
    delta,
    riskChanges: delta
      ? {
          newlyAtRisk: delta.newlyAtRisk,
          worsenedRisk: delta.worsenedRisk,
          improvedRisk: delta.improvedRisk,
          resolvedRisk: delta.resolvedRisk,
          unchangedRisk: delta.unchangedRisk,
        }
      : null,
  };
}

export interface PlannerReadState {
  status: "UNPLANNED" | "CURRENT" | "RUNNING" | "FAILED";
  latestRun: PlanHistoryItem | null;
  authoritativeRun: PlanHistoryItem | null;
  planningRevision: number;
}
export interface ScheduleItem {
  id: string;
  kind: "WORK" | "EVENT" | "COURSE_MEETING" | "PROTECTED" | "SLEEP" | "COMMUTE_WINDOW";
  startAt: Date;
  endAt: Date;
  title: string;
  taskId?: string;
  courseId?: string;
  courseCode?: string;
  courseColorReference?: string | null;
  assessmentId?: string | null;
  remainingMinutes?: number | null;
  dueAt?: Date | null;
  sourceId: string;
  generatedBy?: "PLANNER" | "USER";
  locked?: boolean;
  state?: "PLANNED" | "ACTIVE";
  constraintLevel?: "HARD" | "SOFT" | "INFORMATIONAL";
  reasonCodes: string[];
}
export interface RemainingTaskItem {
  id: string;
  title: string;
  remainingMinutes: number | null;
  dueAt: Date | null;
  assessmentId: string | null;
  courseCode: string | null;
  courseColorReference: string | null;
}
export interface TodayRiskItem extends PlannerRunRisk {
  title: string;
  courseCode: string | null;
}
export interface TodayViewModel {
  date: string;
  timezone: string;
  plannedWorkMinutes: number;
  remainingPlannedWorkMinutes: number;
  currentItem: ScheduleItem | null;
  nextItem: ScheduleItem | null;
  nextWorkItem: ScheduleItem | null;
  timeline: ScheduleItem[];
  remainingTasks: RemainingTaskItem[];
  risks: TodayRiskItem[];
  warnings: PlannerRunStoredWarning[];
  planner: PlannerReadState;
}
export interface WeekViewModel {
  weekStart: string;
  weekEnd: string;
  timezone: string;
  days: {
    date: string;
    plannedWorkMinutes: number;
    availabilityWindowMinutes: number;
    riskTaskIds: string[];
  }[];
  schedule: ScheduleItem[];
  deadlines: { id: string; kind: "TASK" | "ASSESSMENT"; title: string; dueAt: Date }[];
  risks: PlannerRunRisk[];
  warnings: PlannerRunStoredWarning[];
  planner: PlannerReadState;
  latestChange: PlannerRunDelta | null;
}

function bounds(date: string, timezone: string, days: number) {
  const startAt = localDateTimeToInstant({ date, time: "00:00", timezone });
  const endAt = localDateTimeToInstant({ date: addLocalDays(date, days), time: "00:00", timezone });
  return { startAt, endAt };
}
function overlap(start: Date, end: Date, rangeStart: Date, rangeEnd: Date) {
  return (
    Math.max(
      0,
      Math.min(end.getTime(), rangeEnd.getTime()) - Math.max(start.getTime(), rangeStart.getTime()),
    ) / 60_000
  );
}
function recurring(
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
function planState(
  state: PlanningStateSnapshot,
  latest: PlannerRunRecord | null,
  successful: PlannerRunRecord | null,
): PlannerReadState {
  return {
    status:
      latest?.status === "RUNNING"
        ? "RUNNING"
        : latest?.status === "FAILED"
          ? "FAILED"
          : successful
            ? "CURRENT"
            : "UNPLANNED",
    latestRun: latest ? planHistoryItem(latest) : null,
    authoritativeRun: successful ? planHistoryItem(successful) : null,
    planningRevision: state.user.planningRevision,
  };
}
function schedule(
  state: PlanningStateSnapshot,
  date: string,
  days: number,
  successful: PlannerRunRecord | null,
): ScheduleItem[] {
  const { startAt, endAt } = bounds(date, state.user.timezone, days);
  const tasks = new Map(state.tasks.map((task) => [task.id, task]));
  const assessments = new Map(state.assessments.map((assessment) => [assessment.id, assessment]));
  const courses = new Map(
    state.courses
      .filter((course) => course.userId === state.user.id && !course.archivedAt)
      .map((course) => [course.id, course]),
  );
  const activeTerms = new Set(
    state.academicTerms
      .filter((term) => term.userId === state.user.id && term.status === "ACTIVE")
      .map((term) => term.id),
  );
  const reasons = summaryOf(successful)?.sessionReasons ?? {};
  const result: ScheduleItem[] = state.workSessions
    .filter(
      (session) =>
        session.userId === state.user.id &&
        ["PLANNED", "ACTIVE"].includes(session.state) &&
        !session.supersededById &&
        overlap(session.startAt, session.endAt, startAt, endAt) > 0,
    )
    .map((session) => ({
      id: session.id,
      kind: "WORK",
      startAt: session.startAt,
      endAt: session.endAt,
      title: tasks.get(session.taskId)?.title ?? "Work session",
      taskId: session.taskId,
      courseId:
        tasks.get(session.taskId)?.courseId ??
        assessments.get(tasks.get(session.taskId)?.assessmentId ?? "")?.courseId,
      courseCode: courses.get(
        tasks.get(session.taskId)?.courseId ??
          assessments.get(tasks.get(session.taskId)?.assessmentId ?? "")?.courseId ??
          "",
      )?.code,
      courseColorReference: courses.get(
        tasks.get(session.taskId)?.courseId ??
          assessments.get(tasks.get(session.taskId)?.assessmentId ?? "")?.courseId ??
          "",
      )?.colorReference,
      assessmentId: tasks.get(session.taskId)?.assessmentId,
      remainingMinutes: tasks.get(session.taskId)?.remainingMinutes,
      dueAt:
        tasks.get(session.taskId)?.dueAt ??
        assessments.get(tasks.get(session.taskId)?.assessmentId ?? "")?.dueAt,
      sourceId: session.id,
      generatedBy: session.generatedBy,
      locked: session.locked,
      state: session.state as "PLANNED" | "ACTIVE",
      reasonCodes: reasons[session.id] ?? [],
    }));
  for (const event of state.calendarEvents) {
    if (
      event.userId !== state.user.id ||
      event.archivedAt ||
      overlap(event.startAt, event.endAt, startAt, endAt) <= 0
    )
      continue;
    result.push({
      id: `event:${event.id}`,
      kind: "EVENT",
      startAt: event.startAt,
      endAt: event.endAt,
      title: event.title,
      sourceId: event.id,
      constraintLevel: event.constraintLevel,
      reasonCodes: [],
    });
  }
  const first = addLocalDays(date, -1);
  const last = addLocalDays(date, days - 1);
  for (const meeting of state.courseMeetings) {
    const course = courses.get(meeting.courseId);
    if (
      meeting.userId !== state.user.id ||
      meeting.archivedAt ||
      !course ||
      !activeTerms.has(course.academicTermId)
    )
      continue;
    for (const window of recurring(meeting, first, last)) {
      if (overlap(window.startAt, window.endAt, startAt, endAt) <= 0) continue;
      result.push({
        id: `meeting:${meeting.id}:${window.startAt.toISOString()}`,
        kind: "COURSE_MEETING",
        startAt: window.startAt,
        endAt: window.endAt,
        title: `${course.code} ${meeting.meetingType}`,
        sourceId: meeting.id,
        courseId: course.id,
        courseCode: course.code,
        courseColorReference: course.colorReference,
        constraintLevel: meeting.attendanceRequired ? "HARD" : "SOFT",
        reasonCodes: [],
      });
    }
  }
  for (const rule of state.protectedTimeRules) {
    if (rule.userId !== state.user.id || !rule.active) continue;
    for (const window of recurring(rule, first, last)) {
      if (overlap(window.startAt, window.endAt, startAt, endAt) <= 0) continue;
      result.push({
        id: `protected:${rule.id}:${window.startAt.toISOString()}`,
        kind: rule.isSleep ? "SLEEP" : "PROTECTED",
        startAt: window.startAt,
        endAt: window.endAt,
        title: rule.reason,
        sourceId: rule.id,
        constraintLevel: rule.protectionLevel,
        reasonCodes: [],
      });
    }
  }
  for (const rule of state.availabilityRules) {
    if (
      rule.userId !== state.user.id ||
      !rule.active ||
      !rule.allowedLocationTags.includes("TRANSIT_OK")
    )
      continue;
    for (const window of recurring(rule, first, last)) {
      if (overlap(window.startAt, window.endAt, startAt, endAt) <= 0) continue;
      result.push({
        id: `commute:${rule.id}:${window.startAt.toISOString()}`,
        kind: "COMMUTE_WINDOW",
        startAt: window.startAt,
        endAt: window.endAt,
        title: "Commute availability",
        sourceId: rule.id,
        reasonCodes: [],
      });
    }
  }
  return sortByStart(result).sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime() || a.id.localeCompare(b.id),
  );
}
function remaining(state: PlanningStateSnapshot): RemainingTaskItem[] {
  const courses = new Map(
    state.courses
      .filter((course) => course.userId === state.user.id && !course.archivedAt)
      .map((course) => [course.id, course]),
  );
  const assessments = new Map(state.assessments.map((assessment) => [assessment.id, assessment]));
  return state.tasks
    .filter(
      (task) =>
        task.userId === state.user.id &&
        !task.archivedAt &&
        ["READY", "IN_PROGRESS"].includes(task.status) &&
        task.remainingMinutes !== 0,
    )
    .sort(
      (a, b) =>
        (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) ||
        a.id.localeCompare(b.id),
    )
    .map((task) => ({
      id: task.id,
      title: task.title,
      remainingMinutes: task.remainingMinutes,
      dueAt: task.dueAt ?? assessments.get(task.assessmentId ?? "")?.dueAt ?? null,
      assessmentId: task.assessmentId,
      courseCode:
        courses.get(task.courseId ?? assessments.get(task.assessmentId ?? "")?.courseId ?? "")
          ?.code ?? null,
      courseColorReference:
        courses.get(task.courseId ?? assessments.get(task.assessmentId ?? "")?.courseId ?? "")
          ?.colorReference ?? null,
    }));
}
export function buildToday(
  state: PlanningStateSnapshot,
  latest: PlannerRunRecord | null,
  successful: PlannerRunRecord | null,
  date: string,
  now: Date,
): TodayViewModel {
  const timeline = schedule(state, date, 1, successful);
  const { startAt, endAt } = bounds(date, state.user.timezone, 1);
  const work = timeline.filter((item) => item.kind === "WORK");
  const taskById = new Map(state.tasks.map((task) => [task.id, task]));
  const courseById = new Map(state.courses.map((course) => [course.id, course]));
  const assessmentById = new Map(
    state.assessments.map((assessment) => [assessment.id, assessment]),
  );
  return {
    date,
    timezone: state.user.timezone,
    plannedWorkMinutes: work.reduce(
      (sum, item) => sum + overlap(item.startAt, item.endAt, startAt, endAt),
      0,
    ),
    remainingPlannedWorkMinutes: Math.ceil(
      work.reduce((sum, item) => sum + overlap(item.startAt, item.endAt, now, endAt), 0),
    ),
    currentItem:
      timeline.find(
        (item) => item.startAt <= now && item.endAt > now && item.kind !== "COMMUTE_WINDOW",
      ) ?? null,
    nextItem: timeline.find((item) => item.startAt > now && item.kind !== "COMMUTE_WINDOW") ?? null,
    nextWorkItem: work.find((item) => item.startAt > now) ?? null,
    timeline,
    remainingTasks: remaining(state).slice(0, 8),
    risks: (summaryOf(successful)?.risk ?? []).map((risk) => {
      const task = taskById.get(risk.taskId);
      const courseId =
        task?.courseId ?? assessmentById.get(task?.assessmentId ?? "")?.courseId ?? "";
      return {
        ...risk,
        title: task?.title ?? "Work item",
        courseCode: courseById.get(courseId)?.code ?? null,
      };
    }),
    warnings: warningsOf(latest?.status === "FAILED" ? latest : successful),
    planner: planState(state, latest, successful),
  };
}
export function buildWeek(
  state: PlanningStateSnapshot,
  latest: PlannerRunRecord | null,
  successful: PlannerRunRecord | null,
  weekStart: string,
): WeekViewModel {
  const { startAt, endAt } = bounds(weekStart, state.user.timezone, 7);
  const scheduleItems = schedule(state, weekStart, 7, successful);
  const risks = summaryOf(successful)?.risk ?? [];
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addLocalDays(weekStart, index);
    const day = bounds(date, state.user.timezone, 1);
    const availabilityWindowMinutes = mergeIntervals(
      state.availabilityRules
        .filter((rule) => rule.userId === state.user.id && rule.active)
        .flatMap((rule) => recurring(rule, addLocalDays(date, -1), date))
        .flatMap((window) => {
          const clipped = intersectIntervals(window, day);
          return clipped ? [clipped] : [];
        }),
    ).reduce(
      (sum, window) => sum + (window.endAt.getTime() - window.startAt.getTime()) / 60_000,
      0,
    );
    const relevantTaskIds = new Set([
      ...scheduleItems
        .filter(
          (item) =>
            item.kind === "WORK" &&
            item.taskId &&
            overlap(item.startAt, item.endAt, day.startAt, day.endAt) > 0,
        )
        .map((item) => item.taskId!),
      ...state.tasks
        .filter(
          (task) =>
            task.userId === state.user.id &&
            !task.archivedAt &&
            task.dueAt &&
            task.dueAt >= day.startAt &&
            task.dueAt < day.endAt,
        )
        .map((task) => task.id),
    ]);
    return {
      date,
      plannedWorkMinutes: scheduleItems
        .filter((item) => item.kind === "WORK")
        .reduce((sum, item) => sum + overlap(item.startAt, item.endAt, day.startAt, day.endAt), 0),
      availabilityWindowMinutes,
      riskTaskIds: risks
        .filter((risk) => relevantTaskIds.has(risk.taskId))
        .map((risk) => risk.taskId),
    };
  });
  const deadlines = [
    ...state.tasks
      .filter(
        (task) =>
          task.userId === state.user.id &&
          !task.archivedAt &&
          task.dueAt &&
          task.dueAt >= startAt &&
          task.dueAt < endAt,
      )
      .map((task) => ({
        id: task.id,
        kind: "TASK" as const,
        title: task.title,
        dueAt: task.dueAt!,
      })),
    ...state.assessments
      .filter(
        (assessment) =>
          assessment.userId === state.user.id &&
          !assessment.archivedAt &&
          assessment.dueAt &&
          assessment.dueAt >= startAt &&
          assessment.dueAt < endAt,
      )
      .map((assessment) => ({
        id: assessment.id,
        kind: "ASSESSMENT" as const,
        title: assessment.title,
        dueAt: assessment.dueAt!,
      })),
  ].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || a.id.localeCompare(b.id));
  return {
    weekStart,
    weekEnd: addLocalDays(weekStart, 7),
    timezone: state.user.timezone,
    days,
    schedule: scheduleItems,
    deadlines,
    risks,
    warnings: warningsOf(latest?.status === "FAILED" ? latest : successful),
    planner: planState(state, latest, successful),
    latestChange: summaryOf(successful)?.delta ?? null,
  };
}

async function readModel<T>(
  database: Database,
  userId: string,
  anchor: string | undefined,
  now: Date,
  days: 1 | 7,
  build: (
    state: PlanningStateSnapshot,
    latest: PlannerRunRecord | null,
    successful: PlannerRunRecord | null,
    date: string,
  ) => T,
): Promise<T> {
  return database.readSnapshot(async (tx) => {
    const user = await tx.repositories.users.getById(userId);
    if (!user) throw new ApplicationError("NOT_FOUND", "Record not found.");
    const local = anchor ?? instantToLocal(now, user.timezone).date;
    const date =
      days === 1
        ? local
        : addLocalDays(local, -((new Date(`${local}T00:00:00Z`).getUTCDay() + 6) % 7));
    const range = bounds(date, user.timezone, days);
    const [state, recent, successful] = await Promise.all([
      tx.repositories.planningState.snapshot(userId, range.startAt, range.endAt),
      tx.repositories.plannerRuns.listRecent(userId, 1),
      tx.repositories.plannerRuns.latestSuccessful(userId),
    ]);
    if (!state) throw new ApplicationError("NOT_FOUND", "Record not found.");
    return build(state, recent[0] ?? null, successful, date);
  });
}
const viewRequest = z.object({ date: calendarDateSchema.optional() }).strict();
export const plannerViews = {
  today(input: unknown = {}) {
    return resultOf(async () => {
      const actor = await requireActor();
      const data = validateInput(viewRequest, input);
      const now = new Date();
      return readModel(
        applicationDatabase(),
        actor.userId,
        data.date,
        now,
        1,
        (state, latest, successful, date) => buildToday(state, latest, successful, date, now),
      );
    });
  },
  week(input: unknown = {}) {
    return resultOf(async () => {
      const actor = await requireActor();
      const data = validateInput(viewRequest, input);
      return readModel(
        applicationDatabase(),
        actor.userId,
        data.date,
        new Date(),
        7,
        (state, latest, successful, date) => buildWeek(state, latest, successful, date),
      );
    });
  },
};
