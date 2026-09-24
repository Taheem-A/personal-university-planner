import type {
  PlannerInput,
  PlannerValidationIssue,
  PlannableTask,
  WorkSession,
} from "../../domain/src";
import {
  intersectIntervals,
  isOnSchedulingQuantum,
  minutesBetween,
  roundUpToQuantum,
  sortByStart,
  subtractIntervals,
  MINUTE_MS,
  SCHEDULING_QUANTUM_MINUTES,
} from "../../shared/src";
import { normalizePlannerInput } from "./input";
import { windowSuitability } from "./windows";

function sameSession(a: WorkSession, b: WorkSession): boolean {
  return (
    a.id === b.id &&
    a.userId === b.userId &&
    a.taskId === b.taskId &&
    a.startAt.getTime() === b.startAt.getTime() &&
    a.endAt.getTime() === b.endAt.getTime() &&
    a.plannedMinutes === b.plannedMinutes &&
    a.state === b.state &&
    a.generatedBy === b.generatedBy &&
    a.locked === b.locked
  );
}

function active(session: WorkSession): boolean {
  return session.state === "PLANNED" || session.state === "ACTIVE";
}

function taskCapacity(
  session: WorkSession,
  task: PlannableTask,
  input: PlannerInput,
  base: ReturnType<typeof normalizePlannerInput>,
): { covered: boolean; capacityMinutes: number } {
  const interval = { startAt: session.startAt, endAt: session.endAt };
  const parts = base.candidates.flatMap((window) => {
    const part = intersectIntervals(window, interval);
    return part ? [{ window, part }] : [];
  });
  const covered =
    subtractIntervals(
      [interval],
      parts.map(({ part }) => part),
    ).length === 0;
  const capacityMinutes = parts.reduce((sum, { window, part }) => {
    const suitable = windowSuitability(
      { ...task, remainingMinutes: 1, minimumSessionMinutes: 0, splittable: true },
      { ...window, startAt: part.startAt, endAt: part.endAt },
      input,
    );
    return sum + (suitable?.capacityMinutes ?? 0);
  }, 0);
  return { covered, capacityMinutes };
}

/** Full result audit. Retained conflicts are explicit infeasibility, never silent success. */
export function validatePlanDetailed(
  sessions: WorkSession[],
  rawInput: PlannerInput,
): PlannerValidationIssue[] {
  const input = normalizePlannerInput(rawInput).input;
  const base = normalizePlannerInput({ ...input, manualSessions: [], lockedSessions: [] });
  const issues: PlannerValidationIssue[] = [];
  const required = [
    ...new Map(
      [...input.manualSessions, ...input.lockedSessions].map((session) => [session.id, session]),
    ).values(),
  ];
  const retainedIds = new Set(
    [
      ...required,
      ...input.previousSessions.filter((previous) =>
        sessions.some((session) => sameSession(session, previous)),
      ),
    ].map((session) => session.id),
  );
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const activeSessions = sortByStart(sessions.filter(active));
  const add = (
    code: string,
    message: string,
    session?: WorkSession,
    taskId?: string,
    conflictMinutes?: number,
  ) =>
    issues.push({
      code,
      message,
      sessionId: session?.id,
      taskId: taskId ?? session?.taskId,
      conflictMinutes,
      retained: session ? retainedIds.has(session.id) : false,
    });
  for (const fixed of required) {
    if (!sessions.some((session) => sameSession(session, fixed)))
      add("RETAINED_NOT_PRESERVED", `Retained session ${fixed.id} changed or disappeared.`, fixed);
  }
  const ids = new Set<string>();
  const minutesByTask = new Map<string, number>();
  for (const session of activeSessions) {
    if (ids.has(session.id))
      add("DUPLICATE_SESSION", `Session ${session.id} appears twice.`, session);
    ids.add(session.id);
    const task = taskById.get(session.taskId);
    const duration = (session.endAt.getTime() - session.startAt.getTime()) / MINUTE_MS;
    if (session.userId !== input.userId || (task && task.userId !== input.userId))
      add("OWNERSHIP", `Session ${session.id} has inconsistent ownership.`, session);
    if (!task) add("UNKNOWN_TASK", `Session ${session.id} references an unknown task.`, session);
    if (!Number.isFinite(duration) || duration <= 0)
      add("INVALID_DURATION", `Session ${session.id} has non-positive duration.`, session);
    if (
      !Number.isFinite(session.plannedMinutes) ||
      session.plannedMinutes <= 0 ||
      session.plannedMinutes > duration
    )
      add("INVALID_WORK", `Session ${session.id} has invalid planned work.`, session);
    if (!task || !Number.isFinite(duration) || duration <= 0) continue;
    if (task.status !== "READY" && task.status !== "IN_PROGRESS")
      add("INACTIVE_TASK", `Session ${session.id} schedules inactive work.`, session);
    if (task.planningMode !== "AUTO" && !retainedIds.has(session.id))
      add("NON_AUTO_TASK", `Session ${session.id} automatically schedules non-AUTO work.`, session);
    if (session.startAt < task.availableFrom)
      add("TASK_UNAVAILABLE", `Session ${session.id} starts before task availability.`, session);
    if (task.dueAt && session.endAt > task.dueAt)
      add("DEADLINE", `Session ${session.id} ends after the true deadline.`, session);
    if (
      !retainedIds.has(session.id) &&
      (session.startAt < input.now || session.endAt > input.horizonEnd)
    )
      add("HORIZON", `Session ${session.id} lies outside the planning horizon.`, session);
    if (
      !retainedIds.has(session.id) &&
      (!isOnSchedulingQuantum(session.startAt.getTime() / MINUTE_MS) ||
        !isOnSchedulingQuantum(session.endAt.getTime() / MINUTE_MS))
    )
      add("PRECISION", `Session ${session.id} is off the five-minute quantum.`, session);
    if (
      duration > task.maximumSessionMinutes ||
      duration > input.preferences.maximumConsecutiveWorkMinutes
    )
      add("SESSION_MAXIMUM", `Session ${session.id} exceeds a session maximum.`, session);
    if (session.plannedMinutes < Math.min(task.minimumSessionMinutes, task.remainingMinutes))
      add("SESSION_MINIMUM", `Session ${session.id} is below the useful minimum.`, session);
    // The elapsed portion of an already active user session cannot be revalidated
    // against future candidate capacity; no actual-minute split was supplied.
    if (!(
      retainedIds.has(session.id) &&
      session.state === "ACTIVE" &&
      session.startAt < input.now
    )) {
      const { covered, capacityMinutes } = taskCapacity(session, task, input, base);
      if (!covered)
        add("UNAVAILABLE_WINDOW", `Session ${session.id} is outside available capacity.`, session);
      else if (capacityMinutes < session.plannedMinutes)
        add(
          "CAPABILITY_OR_CAPACITY",
          `Session ${session.id} exceeds compatible window capacity.`,
          session,
        );
    }
    for (const event of input.events.filter((item) => item.constraintLevel === "HARD")) {
      const conflict = intersectIntervals(session, event);
      if (conflict)
        add(
          "HARD_EVENT",
          `Session ${session.id} overlaps hard event ${event.id}.`,
          session,
          undefined,
          minutesBetween(conflict.startAt, conflict.endAt),
        );
    }
    for (const window of [
      ...input.protectedWindows.filter((item) => item.level === "HARD"),
      ...input.sleepWindows,
    ]) {
      const conflict = intersectIntervals(session, window);
      if (conflict)
        add(
          "PROTECTED_TIME",
          `Session ${session.id} overlaps protected time ${window.id}.`,
          session,
          undefined,
          minutesBetween(conflict.startAt, conflict.endAt),
        );
    }
    if (session.endAt > input.now)
      minutesByTask.set(task.id, (minutesByTask.get(task.id) ?? 0) + session.plannedMinutes);
  }
  const breakMinutes = roundUpToQuantum(
    Math.max(SCHEDULING_QUANTUM_MINUTES, input.preferences.minimumBreakMinutes),
  );
  for (let index = 0; index < activeSessions.length; index += 1) {
    const current = activeSessions[index];
    for (let earlier = 0; earlier < index; earlier += 1) {
      const previous = activeSessions[earlier];
      if (previous.endAt <= previous.startAt || current.endAt <= current.startAt) continue;
      const conflict = intersectIntervals(previous, current);
      if (conflict)
        add(
          "SESSION_OVERLAP",
          `Sessions ${previous.id} and ${current.id} overlap.`,
          current,
          undefined,
          minutesBetween(conflict.startAt, conflict.endAt),
        );
    }
    if (index > 0) {
      const previous = activeSessions[index - 1];
      if (
        previous.endAt <= current.startAt &&
        minutesBetween(previous.endAt, current.startAt) < breakMinutes
      )
        add(
          "MINIMUM_BREAK",
          `Sessions ${previous.id} and ${current.id} lack a break.`,
          current,
          undefined,
          breakMinutes - minutesBetween(previous.endAt, current.startAt),
        );
    }
  }
  for (const task of input.tasks) {
    const taskSessions = activeSessions.filter((session) => session.taskId === task.id);
    if ((minutesByTask.get(task.id) ?? 0) > task.remainingMinutes)
      add("WORKLOAD_EXCEEDED", `Task ${task.id} exceeds remaining work.`, undefined, task.id);
    if (!task.splittable && taskSessions.length > 1)
      add("NON_SPLITTABLE", `Task ${task.id} was split.`, undefined, task.id);
  }
  for (const session of activeSessions) {
    for (const edge of input.dependencies.filter(
      (item) => item.dependentTaskId === session.taskId,
    )) {
      const prerequisite = taskById.get(edge.prerequisiteTaskId);
      if (
        input.completedTaskIds.includes(edge.prerequisiteTaskId) ||
        prerequisite?.status === "COMPLETED"
      )
        continue;
      const earlier = activeSessions.filter(
        (item) => item.taskId === edge.prerequisiteTaskId && item.endAt <= session.startAt,
      );
      const fulfilled = earlier.reduce((sum, item) => sum + item.plannedMinutes, 0);
      if (!prerequisite || fulfilled < prerequisite.remainingMinutes)
        add("DEPENDENCY", `Session ${session.id} precedes prerequisite completion.`, session);
    }
  }
  return issues;
}

/** Compatibility surface for callers that only need human-readable errors. */
export function validatePlan(sessions: WorkSession[], input: PlannerInput): string[] {
  return validatePlanDetailed(sessions, input).map((issue) => issue.message);
}
