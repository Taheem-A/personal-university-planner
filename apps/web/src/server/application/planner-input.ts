import type {
  PlannerInput,
  PlannerRecurringWindow,
  PlannableTask,
  LocationTag,
  WorkSession,
} from "@university-planner/domain";
import type { PlanningStateSnapshot, TaskRecord } from "@university-planner/database";
import type { PlannerHorizon, PlannerRequest } from "./planner";
import {
  addLocalDays,
  addMinutes,
  instantToLocal,
  localDateTimeToInstant,
} from "@university-planner/shared";

export interface PlannerInputIssue {
  code:
    | "MISSING_USER"
    | "MISSING_PREFERENCES"
    | "MISSING_SLEEP_POLICY"
    | "MISSING_SLEEP_WINDOW"
    | "MISSING_ESTIMATE"
    | "MISSING_AVAILABILITY"
    | "MISSING_SESSION_RULE"
    | "UNSUPPORTED_CAPABILITY"
    | "INVALID_DEPENDENCY"
    | "INVALID_SESSION"
    | "UNSUPPORTED_REQUEST"
    | "CORE_PRECONDITION";
  message: string;
  recordId?: string;
}
export type PlannerInputMapping =
  | { status: "READY"; input: PlannerInput }
  | { status: "INPUT_FAILURE"; issues: PlannerInputIssue[] };

const locationTags = new Set<LocationTag>([
  "ANYWHERE",
  "DESK",
  "CAMPUS",
  "HOME",
  "TRANSIT_OK",
  "COMPUTER",
  "HANDWRITING",
  "INTERNET_REQUIRED",
]);

/**
 * Exact sessions stop at the seventh upcoming local midnight. The first 24h is
 * immediate; the rest is near-term. Medium/semester work is never assigned a
 * precise clock slot here. Local midnight keeps DST transitions honest.
 */
export function selectPlannerHorizon(
  now: Date,
  timezone: string,
  trigger: PlannerHorizon["trigger"],
  state: PlanningStateSnapshot,
): PlannerHorizon {
  const localDate = instantToLocal(now, timezone).date;
  const endAt = localDateTimeToInstant({
    date: addLocalDays(localDate, 7),
    time: "00:00",
    timezone,
  });
  const deadlines = state.tasks
    .filter(
      (task) => !task.archivedAt && task.status !== "COMPLETED" && task.status !== "CANCELLED",
    )
    .map((task) => task.dueAt)
    .filter((date): date is Date => date !== null && date >= now);
  deadlines.sort((a, b) => a.getTime() - b.getTime());
  return {
    startAt: new Date(now),
    endAt,
    immediateEndAt: addMinutes(now, 24 * 60),
    precision: "EXACT_NEAR_TERM",
    trigger,
    ...(deadlines[0] ? { earliestKnownDeadlineAt: deadlines[0] } : {}),
  };
}
function recurrence(
  row:
    | PlanningStateSnapshot["courseMeetings"][number]
    | PlanningStateSnapshot["availabilityRules"][number]
    | PlanningStateSnapshot["protectedTimeRules"][number],
) {
  return {
    recurrenceRule: row.recurrenceRule,
    startTimeLocal: row.startTimeLocal,
    endTimeLocal: row.endTimeLocal,
    spansNextDay: row.spansNextDay,
    timezone: row.timezone,
    effectiveFrom: row.effectiveFrom,
    ...(row.effectiveUntil ? { effectiveUntil: row.effectiveUntil } : {}),
  };
}
function session(row: PlanningStateSnapshot["workSessions"][number]): WorkSession {
  return {
    id: row.id,
    userId: row.userId,
    taskId: row.taskId,
    startAt: row.startAt,
    endAt: row.endAt,
    plannedMinutes: row.plannedMinutes,
    state: row.state,
    generatedBy: row.generatedBy,
    locked: row.locked,
    ...(row.supersededById ? { supersededById: row.supersededById } : {}),
  };
}

/** Maps only persisted facts and documented neutral defaults into pure core data. */
export function assemblePlannerInput(
  state: PlanningStateSnapshot,
  userId: string,
  request: PlannerRequest,
  horizon: PlannerHorizon,
): PlannerInputMapping {
  const issues: PlannerInputIssue[] = [];
  if (state.user.id !== userId)
    return {
      status: "INPUT_FAILURE",
      issues: [{ code: "MISSING_USER", message: "Canonical user state is unavailable." }],
    };
  const preference = state.planningPreferences.find((row) => row.userId === userId);
  if (!preference)
    issues.push({ code: "MISSING_PREFERENCES", message: "Planning preferences are required." });
  if (!preference?.minimumSleepMinutes || preference.minimumSleepMinutes <= 0)
    issues.push({
      code: "MISSING_SLEEP_POLICY",
      message: "Set an explicit minimum sleep duration before planning.",
    });
  const terms = new Map(
    state.academicTerms
      .filter((row) => row.userId === userId && row.status !== "ARCHIVED")
      .map((row) => [row.id, row]),
  );
  const courses = new Map(
    state.courses
      .filter((row) => row.userId === userId && !row.archivedAt && terms.has(row.academicTermId))
      .map((row) => [row.id, row]),
  );
  const assessments = new Map(
    state.assessments
      .filter((row) => row.userId === userId && !row.archivedAt && courses.has(row.courseId))
      .map((row) => [row.id, row]),
  );
  const activeSessions = state.workSessions.filter(
    (row) =>
      row.userId === userId &&
      !row.supersededById &&
      (row.state === "PLANNED" || row.state === "ACTIVE") &&
      row.startAt < horizon.endAt &&
      row.endAt > horizon.startAt,
  );
  const eligible = (task: TaskRecord) =>
    !task.archivedAt &&
    (!task.courseId || courses.has(task.courseId)) &&
    (!task.assessmentId || assessments.has(task.assessmentId));
  const taskById = new Map(
    state.tasks.filter((row) => row.userId === userId).map((row) => [row.id, row]),
  );
  // Obsolete unlocked generated sessions are historical candidates for supersession,
  // not retained intent or valid core input after their task becomes non-plannable.
  const planningSessions = activeSessions.filter((row) => {
    if (row.generatedBy === "USER" || row.locked) return true;
    const task = taskById.get(row.taskId);
    return (
      !!task &&
      eligible(task) &&
      task.planningMode === "AUTO" &&
      (task.status === "READY" || task.status === "IN_PROGRESS")
    );
  });
  const sessionTaskIds = new Set(planningSessions.map((row) => row.taskId));
  const selected = state.tasks.filter(
    (task) =>
      task.userId === userId &&
      eligible(task) &&
      (task.status === "READY" || task.status === "IN_PROGRESS") &&
      (task.planningMode === "AUTO" || sessionTaskIds.has(task.id)),
  );
  const selectedIds = new Set(selected.map((row) => row.id));
  const completedTaskIds = state.tasks
    .filter((row) => row.userId === userId && row.status === "COMPLETED")
    .map((row) => row.id);
  const completed = new Set(completedTaskIds);
  const tasks: PlannableTask[] = [];
  for (const task of selected) {
    const assessment = task.assessmentId ? assessments.get(task.assessmentId) : undefined;
    const course = task.courseId ? courses.get(task.courseId) : undefined;
    const original = task.originalEstimatedMinutes;
    const effective = task.currentEstimatedMinutes ?? original;
    if (!effective || !original || task.remainingMinutes === null || task.remainingMinutes < 0) {
      issues.push({
        code: "MISSING_ESTIMATE",
        recordId: task.id,
        message: "Task needs a justified current, original, and remaining estimate.",
      });
      continue;
    }
    const availableFrom = task.availableFrom ?? assessment?.releaseAt;
    if (!availableFrom) {
      issues.push({
        code: "MISSING_AVAILABILITY",
        recordId: task.id,
        message: "Task availability is unknown.",
      });
      continue;
    }
    const minimum = task.minimumSessionMinutes,
      preferred = task.preferredSessionMinutes,
      maximum = task.maximumSessionMinutes;
    if (!minimum || !preferred || !maximum || minimum > preferred || preferred > maximum) {
      issues.push({
        code: "MISSING_SESSION_RULE",
        recordId: task.id,
        message: "Task session-length rules are incomplete.",
      });
      continue;
    }
    const tags = task.locationRequirements.length ? task.locationRequirements : ["ANYWHERE"];
    if (tags.some((tag) => !locationTags.has(tag as LocationTag))) {
      issues.push({
        code: "UNSUPPORTED_CAPABILITY",
        recordId: task.id,
        message: "Task has an unsupported location requirement.",
      });
      continue;
    }
    const dueAt = task.dueAt ?? assessment?.dueAt ?? undefined;
    const preferredCompletionAt =
      task.preferredCompletionAt ?? assessment?.preferredCompletionAt ?? undefined;
    tasks.push({
      id: task.id,
      userId,
      title: task.title,
      status: task.status,
      planningMode: task.planningMode,
      availableFrom,
      ...(dueAt ? { dueAt } : {}),
      ...(preferredCompletionAt ? { preferredCompletionAt } : {}),
      currentEstimatedMinutes: effective,
      originalEstimatedMinutes: original,
      remainingMinutes: task.remainingMinutes,
      energyRequirement: task.energyRequirement ?? course?.defaultTaskEnergy ?? "MEDIUM",
      locationRequirements: tags as LocationTag[],
      minimumSessionMinutes: minimum,
      preferredSessionMinutes: preferred,
      maximumSessionMinutes: maximum,
      splittable: task.splittable,
      interruptible: task.interruptible,
      ...(task.priorityOverride !== null ? { priorityOverride: task.priorityOverride } : {}),
      deadlineConfidence: dueAt
        ? task.sourceConfidence === "AI_EXTRACTED"
          ? "TENTATIVE"
          : "FIXED"
        : "UNKNOWN",
    });
  }
  const dependencies: PlannerInput["dependencies"] = [];
  for (const edge of state.taskDependencies.filter(
    (row) => row.userId === userId && selectedIds.has(row.dependentTaskId),
  )) {
    if (!selectedIds.has(edge.prerequisiteTaskId) && !completed.has(edge.prerequisiteTaskId)) {
      issues.push({
        code: "INVALID_DEPENDENCY",
        recordId: edge.dependentTaskId,
        message: "Prerequisite is neither plannable nor completed.",
      });
      continue;
    }
    dependencies.push({
      prerequisiteTaskId: edge.prerequisiteTaskId,
      dependentTaskId: edge.dependentTaskId,
      type: "FINISH_TO_START",
    });
  }
  const recurringWindows: PlannerRecurringWindow[] = [];
  for (const row of state.courseMeetings.filter(
    (row) => row.userId === userId && !row.archivedAt && courses.has(row.courseId),
  )) {
    recurringWindows.push({
      id: row.id,
      ...recurrence(row),
      source: "EVENT",
      title: row.meetingType,
      constraintLevel: row.attendanceRequired ? "HARD" : "SOFT",
    });
  }
  for (const row of state.availabilityRules.filter((row) => row.userId === userId && row.active)) {
    if (row.allowedLocationTags.some((tag) => !locationTags.has(tag as LocationTag))) {
      issues.push({
        code: "UNSUPPORTED_CAPABILITY",
        recordId: row.id,
        message: "Availability has an unsupported location tag.",
      });
      continue;
    }
    recurringWindows.push({
      id: row.id,
      ...recurrence(row),
      source: "AVAILABILITY",
      capacityFactor: row.capacityFactor,
      energyLevel: row.energyLevel,
      allowedLocationTags: row.allowedLocationTags as LocationTag[],
      availabilityKind: row.allowedLocationTags.includes("TRANSIT_OK") ? "COMMUTE" : "ORDINARY",
    });
  }
  let sleepCount = 0;
  for (const row of state.protectedTimeRules.filter((row) => row.userId === userId && row.active)) {
    if (row.isSleep) {
      if (row.protectionLevel !== "HARD") {
        issues.push({
          code: "MISSING_SLEEP_WINDOW",
          recordId: row.id,
          message: "Sleep must be hard protected time.",
        });
      } else {
        recurringWindows.push({ id: row.id, ...recurrence(row), source: "SLEEP" });
        sleepCount++;
      }
    } else if (row.protectionLevel !== "INFORMATIONAL") {
      recurringWindows.push({
        id: row.id,
        ...recurrence(row),
        source: "PROTECTED",
        level: row.protectionLevel,
        reason: row.reason,
      });
    }
  }
  if (sleepCount === 0)
    issues.push({
      code: "MISSING_SLEEP_WINDOW",
      message: "At least one explicit sleep recurrence is required.",
    });
  for (const row of planningSessions) {
    if (!selectedIds.has(row.taskId) || row.plannedMinutes <= 0 || row.endAt <= row.startAt)
      issues.push({
        code: "INVALID_SESSION",
        recordId: row.id,
        message: "Active session has no valid plannable task or interval.",
      });
  }
  for (const row of request.trigger.releasedWindows ?? [])
    if (row.endAt <= row.startAt)
      issues.push({
        code: "UNSUPPORTED_REQUEST",
        recordId: row.id,
        message: "Released window must be a positive interval.",
      });
  if (issues.length) return { status: "INPUT_FAILURE", issues };
  const p = preference!;
  const input: PlannerInput = {
    userId,
    timezone: state.user.timezone,
    now: request.now,
    horizonStart: horizon.startAt,
    horizonEnd: horizon.endAt,
    tasks,
    completedTaskIds,
    dependencies,
    events: state.calendarEvents
      .filter(
        (row) =>
          row.userId === userId &&
          !row.archivedAt &&
          row.constraintLevel !== "INFORMATIONAL" &&
          (!row.courseId || courses.has(row.courseId)),
      )
      .map((row) => ({
        id: row.id,
        userId,
        title: row.title,
        startAt: row.startAt,
        endAt: row.endAt,
        constraintLevel: row.constraintLevel === "HARD" ? "HARD" : "SOFT",
        ...(row.courseId ? { courseId: row.courseId } : {}),
        ...(row.location ? { location: row.location } : {}),
      })),
    protectedWindows: [],
    sleepWindows: [],
    recurringWindows,
    availability: [],
    manualSessions: planningSessions.filter((row) => row.generatedBy === "USER").map(session),
    lockedSessions: planningSessions
      .filter((row) => row.generatedBy === "PLANNER" && row.locked)
      .map(session),
    previousSessions: planningSessions
      .filter((row) => row.generatedBy === "PLANNER" && !row.locked)
      .map(session),
    releasedWindows: request.trigger.releasedWindows ?? [],
    replanMode: request.mode,
    releasedTimePolicy: request.releasedTimePolicy,
    minimumSleepMinutes: p.minimumSleepMinutes!,
    preferences: {
      preferredDailyStudyLimitMinutes: p.preferredDailyStudyLimitMinutes,
      minimumFreeTimeMinutes: p.minimumFreeTimeMinutes,
      preferredDeadlineBufferHours: p.preferredDeadlineBufferHours,
      avoidLateHighEnergyTasks: p.avoidLateHighEnergyTasks,
      maximumConsecutiveWorkMinutes: p.maximumConsecutiveWorkMinutes,
      minimumBreakMinutes: p.minimumBreakMinutes,
      scheduleCommuteWork: p.scheduleCommuteWork,
      weekendWorkBias: p.weekendWorkBias,
      planStabilityWindowMinutes: p.planStabilityWindowMinutes,
    },
  };
  return { status: "READY", input };
}
