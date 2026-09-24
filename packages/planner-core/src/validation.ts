import type { PlannerInput, WorkSession } from "../../domain/src";
import {
  isOnSchedulingQuantum,
  overlaps,
  roundUpToQuantum,
  sortByStart,
  MINUTE_MS,
  SCHEDULING_QUANTUM_MINUTES,
} from "../../shared/src";

export function validatePlan(sessions: WorkSession[], input: PlannerInput): string[] {
  const errors: string[] = [];
  const active = sortByStart(
    sessions.filter((session) => session.state === "PLANNED" || session.state === "ACTIVE"),
  );
  const retainedIds = new Set([...input.manualSessions, ...input.lockedSessions].map((s) => s.id));
  const generated = (session: WorkSession) =>
    session.generatedBy === "PLANNER" && !session.locked && !retainedIds.has(session.id);
  const plannedByTask = new Map<string, number>();
  for (let i = 0; i < active.length; i += 1) {
    const session = active[i];
    if (session.endAt <= session.startAt)
      errors.push(`Session ${session.id} has non-positive duration.`);
    const task = input.tasks.find((candidate) => candidate.id === session.taskId);
    if (!task && generated(session))
      errors.push(`Session ${session.id} references missing task ${session.taskId}.`);
    if (task && generated(session) && session.startAt < task.availableFrom)
      errors.push(`Session ${session.id} starts before task availability.`);
    if (task?.dueAt && generated(session) && session.endAt > task.dueAt)
      errors.push(`Session ${session.id} ends after hard deadline.`);
    for (const event of input.events.filter((candidate) => candidate.constraintLevel === "HARD")) {
      if (
        generated(session) &&
        overlaps(session.startAt, session.endAt, event.startAt, event.endAt)
      ) {
        errors.push(`Session ${session.id} overlaps hard event ${event.id}.`);
      }
    }
    if (generated(session)) {
      const duration = (session.endAt.getTime() - session.startAt.getTime()) / MINUTE_MS;
      if (
        !isOnSchedulingQuantum(session.startAt.getTime() / MINUTE_MS) ||
        !isOnSchedulingQuantum(session.endAt.getTime() / MINUTE_MS)
      )
        errors.push(`Session ${session.id} is off the scheduling quantum.`);
      if (
        !Number.isFinite(session.plannedMinutes) ||
        session.plannedMinutes <= 0 ||
        session.plannedMinutes > duration
      )
        errors.push(`Session ${session.id} has invalid planned work.`);
      if (
        task &&
        (duration > task.maximumSessionMinutes ||
          duration > input.preferences.maximumConsecutiveWorkMinutes)
      )
        errors.push(`Session ${session.id} exceeds a work-session maximum.`);
      for (const window of [
        ...input.sleepWindows,
        ...input.protectedWindows.filter((candidate) => candidate.level === "HARD"),
      ]) {
        if (overlaps(session.startAt, session.endAt, window.startAt, window.endAt))
          errors.push(`Session ${session.id} overlaps hard protected time ${window.id}.`);
      }
    }
    if (
      i > 0 &&
      overlaps(active[i - 1].startAt, active[i - 1].endAt, session.startAt, session.endAt)
    ) {
      if (generated(active[i - 1]) || generated(session))
        errors.push(`Sessions ${active[i - 1].id} and ${session.id} overlap.`);
    }
    if (i > 0 && (generated(session) || generated(active[i - 1]))) {
      const required = roundUpToQuantum(
        Math.max(SCHEDULING_QUANTUM_MINUTES, input.preferences.minimumBreakMinutes),
      );
      if ((session.startAt.getTime() - active[i - 1].endAt.getTime()) / MINUTE_MS < required)
        errors.push(`Sessions ${active[i - 1].id} and ${session.id} lack a minimum break.`);
    }
    if (session.endAt > input.now)
      plannedByTask.set(
        session.taskId,
        (plannedByTask.get(session.taskId) ?? 0) + session.plannedMinutes,
      );
  }
  for (const task of input.tasks) {
    if ((plannedByTask.get(task.id) ?? 0) > task.remainingMinutes)
      errors.push(`Task ${task.id} is allocated more than its remaining work.`);
  }
  for (const locked of [...input.lockedSessions, ...input.manualSessions]) {
    if (
      !sessions.some(
        (session) =>
          session.id === locked.id && session.startAt.getTime() === locked.startAt.getTime(),
      )
    ) {
      errors.push(`Locked session ${locked.id} was not preserved.`);
    }
  }
  return errors;
}
