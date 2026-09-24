import type {
  AvailabilityWindow,
  CalendarEvent,
  PlannerInput,
  PlannerProtectedWindow,
  PlannerSleepWindow,
  WorkSession,
} from "../../domain/src";
import {
  addLocalDays,
  createInterval,
  expandRecurringWindows,
  instantToLocal,
  maxDate,
  minDate,
  sortByStart,
} from "../../shared/src";
import { resolveEligibility, type Eligibility } from "./eligibility";
import { occupiedTimeline } from "./timeline";
import { candidateWindows, type CandidateWindow } from "./windows";

export interface NormalizedPlanningState {
  /** Private, cloned snapshot. Dates and arrays never alias the caller's input. */
  input: PlannerInput;
  effectiveStart: Date;
  occupied: { startAt: Date; endAt: Date }[];
  candidates: CandidateWindow[];
  eligibility: Eligibility;
  unallocatedMinutesByTask: Map<string, number>;
  reservedEndByTask: Map<string, Date>;
  fullyReservedTaskIds: Set<string>;
}

function validInstant(date: Date, label: string): Date {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new RangeError(`${label} must be a valid instant`);
  }
  return new Date(date);
}

function copySession(session: WorkSession): WorkSession {
  createInterval(session.startAt, session.endAt);
  return { ...session, startAt: new Date(session.startAt), endAt: new Date(session.endAt) };
}

function dedupeSessions(sessions: WorkSession[]): WorkSession[] {
  const byId = new Map<string, WorkSession>();
  for (const session of sessions) {
    const existing = byId.get(session.id);
    if (
      existing &&
      (existing.taskId !== session.taskId ||
        existing.startAt.getTime() !== session.startAt.getTime() ||
        existing.endAt.getTime() !== session.endAt.getTime())
    ) {
      throw new Error(`Session ${session.id} has conflicting planner snapshots.`);
    }
    byId.set(session.id, session);
  }
  return sortByStart([...byId.values()]);
}

function expandRecurrence(
  input: PlannerInput,
): Pick<PlannerInput, "events" | "protectedWindows" | "sleepWindows" | "availability"> {
  const events: CalendarEvent[] = input.events.map((event) => ({
    ...event,
    startAt: new Date(event.startAt),
    endAt: new Date(event.endAt),
  }));
  const protectedWindows: PlannerProtectedWindow[] = input.protectedWindows.map((window) => ({
    ...window,
    startAt: new Date(window.startAt),
    endAt: new Date(window.endAt),
  }));
  const sleepWindows: PlannerSleepWindow[] = input.sleepWindows.map((window) => ({
    ...window,
    startAt: new Date(window.startAt),
    endAt: new Date(window.endAt),
  }));
  const availability: AvailabilityWindow[] = input.availability.map((window) => ({
    ...window,
    startAt: new Date(window.startAt),
    endAt: new Date(window.endAt),
    allowedLocationTags: [...window.allowedLocationTags],
  }));
  for (const rule of input.recurringWindows) {
    const firstLocalDate = addLocalDays(instantToLocal(input.horizonStart, rule.timezone).date, -1);
    const lastLocalDate = instantToLocal(input.horizonEnd, rule.timezone).date;
    const occurrences = expandRecurringWindows(rule, firstLocalDate, lastLocalDate);
    for (const occurrence of occurrences) {
      const id = `${rule.id}:${occurrence.localDate}`;
      const { startAt, endAt } = occurrence;
      switch (rule.source) {
        case "EVENT":
          events.push({
            id,
            userId: input.userId,
            title: rule.title,
            startAt,
            endAt,
            constraintLevel: rule.constraintLevel,
          });
          break;
        case "PROTECTED":
          protectedWindows.push({ id, startAt, endAt, level: rule.level, reason: rule.reason });
          break;
        case "SLEEP":
          sleepWindows.push({ id, startAt, endAt });
          break;
        case "AVAILABILITY":
          availability.push({
            id,
            userId: input.userId,
            startAt,
            endAt,
            capacityFactor: rule.capacityFactor,
            energyLevel: rule.energyLevel,
            allowedLocationTags: [...rule.allowedLocationTags],
            kind: rule.availabilityKind ?? "ORDINARY",
          });
      }
    }
  }
  return {
    events: sortByStart(events),
    protectedWindows: sortByStart(protectedWindows),
    sleepWindows: sortByStart(sleepWindows),
    availability: sortByStart(availability),
  };
}

/** Pure front-half pipeline. Input facts must already be resolved by the caller. */
export function normalizePlannerInput(input: PlannerInput): NormalizedPlanningState {
  const now = validInstant(input.now, "now");
  const horizonStart = validInstant(input.horizonStart, "horizonStart");
  const horizonEnd = validInstant(input.horizonEnd, "horizonEnd");
  createInterval(horizonStart, horizonEnd);
  instantToLocal(now, input.timezone);
  if (!Number.isInteger(input.minimumSleepMinutes) || input.minimumSleepMinutes < 0) {
    throw new RangeError("minimumSleepMinutes must be a non-negative integer");
  }
  if (
    !Number.isFinite(input.preferences.preferredDeadlineBufferHours) ||
    input.preferences.preferredDeadlineBufferHours < 0
  ) {
    throw new RangeError("preferredDeadlineBufferHours must be finite and non-negative");
  }
  for (const key of [
    "preferredDailyStudyLimitMinutes",
    "minimumFreeTimeMinutes",
    "minimumBreakMinutes",
  ] as const) {
    if (!Number.isFinite(input.preferences[key]) || input.preferences[key] < 0)
      throw new RangeError(`${key} must be finite and non-negative`);
  }
  if (
    !Number.isFinite(input.preferences.maximumConsecutiveWorkMinutes) ||
    input.preferences.maximumConsecutiveWorkMinutes < 5
  )
    throw new RangeError("maximumConsecutiveWorkMinutes must be at least five minutes");
  if (
    !Number.isFinite(input.preferences.weekendWorkBias) ||
    input.preferences.weekendWorkBias < -1 ||
    input.preferences.weekendWorkBias > 1
  )
    throw new RangeError("weekendWorkBias must be in [-1, 1]");
  if (
    !Number.isFinite(input.preferences.planStabilityWindowMinutes) ||
    input.preferences.planStabilityWindowMinutes < 0
  )
    throw new RangeError("planStabilityWindowMinutes must be finite and non-negative");
  if (
    !["KEEP_FREE", "LEAVE_FREE", "REPLAN_IF_USEFUL", "ALWAYS_REPLAN"].includes(
      input.releasedTimePolicy,
    )
  )
    throw new Error("Unsupported released-time policy");
  const effectiveStart = minDate(maxDate(now, horizonStart), horizonEnd);
  const expanded = expandRecurrence(input);
  for (const interval of [
    ...expanded.events,
    ...expanded.protectedWindows,
    ...expanded.sleepWindows,
    ...expanded.availability,
    ...input.releasedWindows,
  ])
    createInterval(interval.startAt, interval.endAt);
  for (const window of expanded.availability) {
    if (
      !Number.isFinite(window.capacityFactor) ||
      window.capacityFactor < 0 ||
      window.capacityFactor > 1
    )
      throw new RangeError(`Availability ${window.id} has invalid capacity factor.`);
  }
  const tasks = input.tasks.map((task) => {
    if (input.completedTaskIds.includes(task.id) && task.status !== "COMPLETED")
      throw new Error(`Task ${task.id} conflicts with completedTaskIds.`);
    if (
      !Number.isFinite(task.remainingMinutes) ||
      task.remainingMinutes < 0 ||
      !Number.isFinite(task.currentEstimatedMinutes) ||
      task.currentEstimatedMinutes <= 0 ||
      !Number.isFinite(task.originalEstimatedMinutes) ||
      task.originalEstimatedMinutes <= 0
    )
      throw new RangeError(`Task ${task.id} needs explicit valid estimates and remaining work.`);
    if (
      task.importance !== undefined &&
      (!Number.isFinite(task.importance) || task.importance < 0 || task.importance > 1)
    )
      throw new RangeError(`Task ${task.id} has invalid normalized importance.`);
    if (task.priorityOverride !== undefined && !Number.isFinite(task.priorityOverride))
      throw new RangeError(`Task ${task.id} has invalid priority override.`);
    return {
      ...task,
      availableFrom: validInstant(task.availableFrom, `Task ${task.id} availableFrom`),
      dueAt: task.dueAt && validInstant(task.dueAt, `Task ${task.id} dueAt`),
      preferredCompletionAt:
        task.preferredCompletionAt &&
        validInstant(task.preferredCompletionAt, `Task ${task.id} preferredCompletionAt`),
      locationRequirements: [...task.locationRequirements],
    };
  });
  const manualSessions = dedupeSessions(input.manualSessions.map(copySession));
  const lockedSessions = dedupeSessions(input.lockedSessions.map(copySession));
  const retained = dedupeSessions([...manualSessions, ...lockedSessions]);
  const reservedMinutesByTask = new Map<string, number>();
  const reservedEndByTask = new Map<string, Date>();
  for (const session of retained) {
    if ((session.state !== "PLANNED" && session.state !== "ACTIVE") || session.endAt <= now)
      continue;
    if (!Number.isFinite(session.plannedMinutes) || session.plannedMinutes <= 0)
      throw new RangeError(`Session ${session.id} has invalid planned minutes.`);
    reservedMinutesByTask.set(
      session.taskId,
      (reservedMinutesByTask.get(session.taskId) ?? 0) + session.plannedMinutes,
    );
    const oldEnd = reservedEndByTask.get(session.taskId);
    if (!oldEnd || session.endAt > oldEnd) reservedEndByTask.set(session.taskId, session.endAt);
  }
  const unallocatedMinutesByTask = new Map<string, number>();
  const fullyReservedTaskIds = new Set<string>();
  for (const task of tasks) {
    const reserved = reservedMinutesByTask.get(task.id) ?? 0;
    if (reserved > task.remainingMinutes)
      throw new Error(`Retained sessions exceed remaining work for task ${task.id}.`);
    const unallocated = task.remainingMinutes - reserved;
    unallocatedMinutesByTask.set(task.id, unallocated);
    if (reserved > 0 && unallocated === 0) fullyReservedTaskIds.add(task.id);
  }
  const snapshot: PlannerInput = {
    ...input,
    now,
    horizonStart,
    horizonEnd,
    tasks,
    completedTaskIds: [...input.completedTaskIds].sort(),
    dependencies: input.dependencies.map((dependency) => ({ ...dependency })),
    ...expanded,
    recurringWindows: [],
    manualSessions,
    lockedSessions,
    previousSessions: dedupeSessions(input.previousSessions.map(copySession)),
    releasedWindows: input.releasedWindows.map((window) => ({
      ...window,
      startAt: new Date(window.startAt),
      endAt: new Date(window.endAt),
    })),
    preferences: { ...input.preferences },
  };
  const occupied = occupiedTimeline(snapshot, effectiveStart);
  const eligibility = resolveEligibility(
    snapshot,
    effectiveStart,
    unallocatedMinutesByTask,
    fullyReservedTaskIds,
  );
  const candidates = candidateWindows(snapshot, occupied, effectiveStart);
  return {
    input: snapshot,
    effectiveStart,
    occupied,
    candidates,
    eligibility,
    unallocatedMinutesByTask,
    reservedEndByTask,
    fullyReservedTaskIds,
  };
}
