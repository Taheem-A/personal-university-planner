import type { PlannerInput, PlannerOutput, PlannerWarning, WorkSession } from "../../domain/src";
import { sortByStart } from "../../shared/src";
import { placeTask } from "./allocation";
import { assertBaselineSupported } from "./input";
import { calculatePressure } from "./pressure";
import { validatePlan } from "./validation";
import { candidateWindows, eligibleTask } from "./windows";
import { PLANNER_VERSION } from "./version";

export { validatePlan } from "./validation";
export { simulateProtectedWindow } from "./scenario";
export { PLANNER_VERSION } from "./version";

export function generatePlan(input: PlannerInput): PlannerOutput {
  assertBaselineSupported(input);
  let windows = candidateWindows(input);
  const tasks = input.tasks.filter((task) => eligibleTask(task, input));
  const pressures = tasks.map((task) => calculatePressure(task, windows, input));
  const pressureByTask = new Map(pressures.map((pressure) => [pressure.taskId, pressure]));
  const ranked = [...tasks].sort((a, b) => {
    const pressureDelta =
      (pressureByTask.get(b.id)?.score ?? 0) - (pressureByTask.get(a.id)?.score ?? 0);
    if (Math.abs(pressureDelta) > 0.0001) return pressureDelta;
    const aDue = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });

  const sessionCounter = { value: 1 };
  const sessions: WorkSession[] = [...input.lockedSessions];
  const warnings: PlannerWarning[] = [];
  const unscheduledMinutesByTask: Record<string, number> = {};

  for (const task of ranked) {
    const placed = placeTask(task, windows, input, sessionCounter);
    sessions.push(...placed.sessions);
    windows = placed.windows;
    if (placed.remaining > 0) {
      unscheduledMinutesByTask[task.id] = placed.remaining;
      const pressure = pressureByTask.get(task.id);
      warnings.push({
        code:
          pressure && pressure.suitableCapacityMinutes <= 0 ? "NO_SUITABLE_WINDOW" : "INFEASIBLE",
        taskId: task.id,
        message: `Task ${task.title} has ${placed.remaining} minute(s) that do not currently fit.`,
        deficitMinutes: placed.remaining,
        reasonCodes: [
          pressure && pressure.suitableCapacityMinutes <= 0
            ? "NO_SUITABLE_WINDOW"
            : "INSUFFICIENT_CAPACITY",
        ],
      });
    } else {
      const pressure = pressureByTask.get(task.id);
      if (pressure && pressure.slackMinutes >= 0 && pressure.slackMinutes <= 60) {
        warnings.push({
          code: "LOW_SLACK",
          taskId: task.id,
          message: `${task.title} has only ${pressure.slackMinutes} minute(s) of suitable slack.`,
          reasonCodes: ["LOW_SLACK"],
        });
      }
    }
  }

  const errors = validatePlan(sessions, input);
  if (errors.length > 0) {
    throw new Error(`Planner produced invalid output:\n${errors.join("\n")}`);
  }

  return {
    plannerVersion: PLANNER_VERSION,
    sessions: sortByStart(sessions),
    warnings,
    pressures,
    unscheduledMinutesByTask,
    reasonsBySession: {},
  };
}
