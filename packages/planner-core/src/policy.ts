import type { PlannerInput, WorkSession } from "../../domain/src";
import {
  addMinutes,
  intersectIntervals,
  isOnSchedulingQuantum,
  overlaps,
  roundUpToQuantum,
  subtractIntervals,
  MINUTE_MS,
  SCHEDULING_QUANTUM_MINUTES,
} from "../../shared/src";
import type { NormalizedPlanningState } from "./input";
import { windowSuitability } from "./windows";

export type RetentionTier = "ALL" | "STABLE" | "NONE";

function active(session: WorkSession, now: Date): boolean {
  return (session.state === "PLANNED" || session.state === "ACTIVE") && session.endAt > now;
}

function workSessionIsValid(session: WorkSession, state: NormalizedPlanningState): boolean {
  const input = state.input;
  const task = input.tasks.find((candidate) => candidate.id === session.taskId);
  if (
    !task ||
    (task.status !== "READY" && task.status !== "IN_PROGRESS") ||
    task.planningMode !== "AUTO" ||
    (state.unallocatedMinutesByTask.get(task.id) ?? 0) <= 0
  )
    return false;
  const duration = (session.endAt.getTime() - session.startAt.getTime()) / MINUTE_MS;
  if (
    session.startAt < task.availableFrom ||
    (task.dueAt && session.endAt > task.dueAt) ||
    !isOnSchedulingQuantum(session.startAt.getTime() / MINUTE_MS) ||
    !isOnSchedulingQuantum(session.endAt.getTime() / MINUTE_MS) ||
    session.plannedMinutes <= 0 ||
    session.plannedMinutes > duration ||
    duration > task.maximumSessionMinutes ||
    duration > input.preferences.maximumConsecutiveWorkMinutes
  )
    return false;
  if (
    input.releasedWindows.some((window) =>
      overlaps(session.startAt, session.endAt, window.startAt, window.endAt),
    )
  )
    return false;
  const interval = { startAt: session.startAt, endAt: session.endAt };
  const covered = state.candidates.flatMap((window) => {
    const part = intersectIntervals(window, interval);
    return part ? [part] : [];
  });
  if (subtractIntervals([interval], covered).length > 0) return false;
  const capacity = state.candidates.reduce((total, window) => {
    const part = intersectIntervals(window, interval);
    if (!part) return total;
    const suitability = windowSuitability(
      { ...task, remainingMinutes: 1, minimumSessionMinutes: 0, splittable: true },
      { ...window, startAt: part.startAt, endAt: part.endAt },
      input,
    );
    return total + (suitability?.capacityMinutes ?? 0);
  }, 0);
  return capacity >= session.plannedMinutes;
}

function separatedFrom(session: WorkSession, others: WorkSession[], input: PlannerInput): boolean {
  const gap = roundUpToQuantum(
    Math.max(SCHEDULING_QUANTUM_MINUTES, input.preferences.minimumBreakMinutes),
  );
  return others.every(
    (other) =>
      addMinutes(session.endAt, gap) <= other.startAt ||
      addMinutes(other.endAt, gap) <= session.startAt,
  );
}

function dependenciesSatisfied(
  session: WorkSession,
  retained: WorkSession[],
  state: NormalizedPlanningState,
): boolean {
  for (const prerequisiteId of state.eligibility.dependenciesByTask.get(session.taskId) ?? []) {
    const prerequisite = state.input.tasks.find((task) => task.id === prerequisiteId);
    if (
      state.input.completedTaskIds.includes(prerequisiteId) ||
      prerequisite?.status === "COMPLETED"
    )
      continue;
    if (!prerequisite) return false;
    const prerequisiteSessions = retained.filter((item) => item.taskId === prerequisiteId);
    const reserved = prerequisiteSessions.reduce((sum, item) => sum + item.plannedMinutes, 0);
    if (reserved < prerequisite.remainingMinutes) return false;
    if (prerequisiteSessions.some((item) => item.endAt > session.startAt)) return false;
  }
  return true;
}

/** Preserve valid previous work as a policy tier, not merely as a scoring hint. */
export function retainedPreviousSessions(
  state: NormalizedPlanningState,
  tier: RetentionTier,
): WorkSession[] {
  const input = state.input;
  const explicit = [...input.manualSessions, ...input.lockedSessions];
  const explicitIds = new Set(explicit.map((session) => session.id));
  const stabilityEnd = addMinutes(input.now, input.preferences.planStabilityWindowMinutes);
  const candidates = input.previousSessions
    .filter((session) => active(session, input.now) && !explicitIds.has(session.id))
    .filter(
      (session) =>
        session.generatedBy === "USER" ||
        session.locked ||
        session.state === "ACTIVE" ||
        (input.replanMode === "INCREMENTAL" &&
          tier !== "NONE" &&
          (tier === "ALL" || session.startAt < stabilityEnd)),
    )
    .sort((a, b) => {
      const aIntent = a.generatedBy === "USER" || a.locked || a.state === "ACTIVE" ? 0 : 1;
      const bIntent = b.generatedBy === "USER" || b.locked || b.state === "ACTIVE" ? 0 : 1;
      const aStable = a.startAt < stabilityEnd ? 0 : 1;
      const bStable = b.startAt < stabilityEnd ? 0 : 1;
      return (
        aIntent - bIntent ||
        aStable - bStable ||
        a.startAt.getTime() - b.startAt.getTime() ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      );
    });
  const selected: WorkSession[] = [];
  const booked = new Map<string, number>();
  for (const session of candidates) {
    if (
      session.generatedBy !== "USER" &&
      !session.locked &&
      session.state !== "ACTIVE" &&
      !workSessionIsValid(session, state)
    )
      continue;
    const task = input.tasks.find((item) => item.id === session.taskId);
    if (task) {
      const prior = booked.get(task.id) ?? 0;
      const available = state.unallocatedMinutesByTask.get(task.id) ?? 0;
      if (prior + session.plannedMinutes > available) continue;
      booked.set(task.id, prior + session.plannedMinutes);
    }
    if (
      session.generatedBy !== "USER" &&
      !session.locked &&
      session.state !== "ACTIVE" &&
      !separatedFrom(session, [...explicit, ...selected], input)
    ) {
      if (task) booked.set(task.id, (booked.get(task.id) ?? 0) - session.plannedMinutes);
      continue;
    }
    selected.push(session);
  }
  // A retained dependent cannot bypass an unfinished prerequisite. Removing a link may
  // invalidate its descendants, so repeat to a fixed point.
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      const session = selected[index];
      if (session.generatedBy === "USER" || session.locked || session.state === "ACTIVE") continue;
      if (dependenciesSatisfied(session, [...explicit, ...selected], state)) continue;
      selected.splice(index, 1);
      changed = true;
    }
  }
  return selected.sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime() || (a.id < b.id ? -1 : 1),
  );
}
