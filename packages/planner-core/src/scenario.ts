import type {
  CalendarEvent,
  PlannerInput,
  ScenarioRequest,
  ScenarioResult,
  WorkSession,
} from "../../domain/src";
import { generatePlan } from "./index";
import { normalizePlannerInput } from "./input";

function sessionKey(session: WorkSession): string {
  return [
    session.taskId,
    session.startAt.toISOString(),
    session.endAt.toISOString(),
    session.plannedMinutes,
  ].join("|");
}

function sessionDelta(before: WorkSession[], after: WorkSession[]) {
  const unchanged = new Map<string, number>();
  for (const session of after)
    unchanged.set(sessionKey(session), (unchanged.get(sessionKey(session)) ?? 0) + 1);
  const oldRemaining = before.filter((session) => {
    const count = unchanged.get(sessionKey(session)) ?? 0;
    if (!count) return true;
    unchanged.set(sessionKey(session), count - 1);
    return false;
  });
  const oldKeys = new Map<string, number>();
  for (const session of before)
    oldKeys.set(sessionKey(session), (oldKeys.get(sessionKey(session)) ?? 0) + 1);
  const newRemaining = after.filter((session) => {
    const count = oldKeys.get(sessionKey(session)) ?? 0;
    if (!count) return true;
    oldKeys.set(sessionKey(session), count - 1);
    return false;
  });
  const movedSessionIds: string[] = [];
  const addedSessionIds: string[] = [];
  const removedSessionIds: string[] = [];
  const movedTaskIds = new Set<string>();
  for (const taskId of [
    ...new Set([
      ...oldRemaining.map((session) => session.taskId),
      ...newRemaining.map((session) => session.taskId),
    ]),
  ].sort()) {
    const old = oldRemaining.filter((session) => session.taskId === taskId);
    const next = newRemaining.filter((session) => session.taskId === taskId);
    const paired = Math.min(old.length, next.length);
    for (let index = 0; index < paired; index += 1) movedSessionIds.push(old[index].id);
    for (const session of old.slice(paired)) removedSessionIds.push(session.id);
    for (const session of next.slice(paired)) addedSessionIds.push(session.id);
    movedTaskIds.add(taskId);
  }
  return { movedTaskIds: [...movedTaskIds], movedSessionIds, addedSessionIds, removedSessionIds };
}

export function simulateProtectedWindow(
  input: PlannerInput,
  request: ScenarioRequest,
): ScenarioResult {
  const before = generatePlan(input);
  const synthetic: CalendarEvent = {
    id: `scenario:${request.title}`,
    userId: input.userId,
    title: request.title,
    startAt: request.startAt,
    endAt: request.endAt,
    constraintLevel: request.protectionLevel,
    source: "SCENARIO",
  };
  const afterInput: PlannerInput = {
    ...input,
    events: [...input.events, synthetic],
    previousSessions: before.sessions,
  };
  const after = generatePlan(afterInput);
  const delta = sessionDelta(before.sessions, after.sessions);
  const capacity = (snapshot: PlannerInput) =>
    normalizePlannerInput(snapshot).candidates.reduce(
      (sum, window) => sum + window.remainingUsableMinutes,
      0,
    );
  const deficit = (result: typeof after) =>
    result.infeasibilities.reduce((sum, item) => sum + item.deficitMinutes, 0);
  const deadlineSafe = after.status === "VALID";
  return {
    request,
    before,
    after,
    ...delta,
    capacityDeltaMinutes: capacity(afterInput) - capacity(input),
    deficitDeltaMinutes: deficit(after) - deficit(before),
    canApply: deadlineSafe,
    deadlineSafe,
  };
}
