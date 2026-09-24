import type { PlannerInput, PlannerOutput, PlannerWarning, WorkSession } from "../../domain/src";
import { sortByStart } from "../../shared/src";
import { placeTask } from "./allocation";
import { dependencyReadyAt } from "./eligibility";
import { normalizePlannerInput } from "./input";
import { calculatePressure } from "./pressure";
import { validatePlan } from "./validation";
import { PLANNER_VERSION } from "./version";

export { validatePlan } from "./validation";
export { simulateProtectedWindow } from "./scenario";
export { PLANNER_VERSION } from "./version";
export { normalizePlannerInput } from "./input";

export function generatePlan(rawInput: PlannerInput): PlannerOutput {
  const normalized = normalizePlannerInput(rawInput);
  const input = normalized.input;
  let windows = normalized.candidates;
  const tasks = input.tasks
    .filter((task) => normalized.eligibility.eligibleTaskIds.has(task.id))
    .map((task) => ({
      ...task,
      remainingMinutes: normalized.unallocatedMinutesByTask.get(task.id)!,
    }));
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
  const sessions: WorkSession[] = [
    ...new Map(
      [...input.manualSessions, ...input.lockedSessions].map((session) => [session.id, session]),
    ).values(),
  ];
  const warnings: PlannerWarning[] = [];
  const unscheduledMinutesByTask: Record<string, number> = {};

  const pending = [...ranked];
  const allocatedCompletion = new Map<string, Date>(
    [...normalized.reservedEndByTask].filter(([id]) => normalized.fullyReservedTaskIds.has(id)),
  );
  while (pending.length > 0) {
    const index = pending.findIndex((task) =>
      dependencyReadyAt(task.id, input, normalized.eligibility, allocatedCompletion),
    );
    if (index < 0) break;
    const task = pending.splice(index, 1)[0];
    const readyAt = dependencyReadyAt(task.id, input, normalized.eligibility, allocatedCompletion)!;
    const schedulable = {
      ...task,
      availableFrom: task.availableFrom > readyAt ? task.availableFrom : readyAt,
    };
    const placed = placeTask(schedulable, windows, input, sessionCounter);
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
      const last = placed.sessions.reduce<Date | undefined>(
        (latest, session) => (!latest || session.endAt > latest ? session.endAt : latest),
        undefined,
      );
      const reservedEnd = normalized.reservedEndByTask.get(task.id);
      const completion =
        last && reservedEnd ? (last > reservedEnd ? last : reservedEnd) : (last ?? reservedEnd);
      if (completion) allocatedCompletion.set(task.id, completion);
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

  for (const task of [
    ...pending,
    ...input.tasks.filter((candidate) => normalized.eligibility.blockedTaskIds.has(candidate.id)),
  ]) {
    const unallocated = normalized.unallocatedMinutesByTask.get(task.id) ?? task.remainingMinutes;
    unscheduledMinutesByTask[task.id] = unallocated;
    warnings.push({
      code: "DEPENDENCY_BLOCKED",
      taskId: task.id,
      message: `Task ${task.title} is blocked by a prerequisite.`,
      deficitMinutes: unallocated,
      reasonCodes: ["DEPENDENCY_BLOCKED"],
    });
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
