import type { PlannerInput, WorkSession } from "../../domain/src";
import { overlaps, sortByStart } from "../../shared/src";

export function validatePlan(sessions: WorkSession[], input: PlannerInput): string[] {
  const errors: string[] = [];
  const active = sortByStart(
    sessions.filter((session) => session.state === "PLANNED" || session.state === "ACTIVE"),
  );
  for (let i = 0; i < active.length; i += 1) {
    const session = active[i];
    if (session.endAt <= session.startAt)
      errors.push(`Session ${session.id} has non-positive duration.`);
    const task = input.tasks.find((candidate) => candidate.id === session.taskId);
    if (!task) errors.push(`Session ${session.id} references missing task ${session.taskId}.`);
    if (task && session.startAt < task.availableFrom)
      errors.push(`Session ${session.id} starts before task availability.`);
    if (task?.dueAt && session.endAt > task.dueAt)
      errors.push(`Session ${session.id} ends after hard deadline.`);
    for (const event of input.events.filter((candidate) => candidate.constraintLevel === "HARD")) {
      if (overlaps(session.startAt, session.endAt, event.startAt, event.endAt)) {
        errors.push(`Session ${session.id} overlaps hard event ${event.id}.`);
      }
    }
    if (
      i > 0 &&
      overlaps(active[i - 1].startAt, active[i - 1].endAt, session.startAt, session.endAt)
    ) {
      errors.push(`Sessions ${active[i - 1].id} and ${session.id} overlap.`);
    }
  }
  for (const locked of input.lockedSessions) {
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
