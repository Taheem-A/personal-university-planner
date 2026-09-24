import type {
  CalendarEvent,
  PlannerInput,
  ScenarioRequest,
  ScenarioResult,
  WorkSession,
} from "../../domain/src";
import { generatePlan } from "./index";

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
  const beforeByTask = new Map<string, WorkSession[]>();
  const afterByTask = new Map<string, WorkSession[]>();
  for (const session of before.sessions)
    beforeByTask.set(session.taskId, [...(beforeByTask.get(session.taskId) ?? []), session]);
  for (const session of after.sessions)
    afterByTask.set(session.taskId, [...(afterByTask.get(session.taskId) ?? []), session]);
  const movedTaskIds = [...new Set([...beforeByTask.keys(), ...afterByTask.keys()])].filter(
    (taskId) => {
      const a = beforeByTask.get(taskId) ?? [];
      const b = afterByTask.get(taskId) ?? [];
      if (a.length !== b.length) return true;
      return a.some((session, index) => session.startAt.getTime() !== b[index]?.startAt.getTime());
    },
  );
  const deadlineSafe = after.warnings.every(
    (warning) => warning.code !== "INFEASIBLE" && warning.code !== "NO_SUITABLE_WINDOW",
  );
  return {
    request,
    before,
    after,
    movedTaskIds,
    canApply: deadlineSafe,
    deadlineSafe,
  };
}
