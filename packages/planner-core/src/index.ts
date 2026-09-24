import type { PlannerInput, PlannerOutput, PlannerWarning, WorkSession } from "../../domain/src";
import { sortByStart } from "../../shared/src";
import { placeTask } from "./allocation";
import { dependencyReadyAt } from "./eligibility";
import { normalizePlannerInput } from "./input";
import { calculatePressure, dependencyImportance, rankTaskPressures, rankTasks } from "./pressure";
import { validatePlan } from "./validation";
import { PLANNER_VERSION } from "./version";

export { validatePlan } from "./validation";
export { simulateProtectedWindow } from "./scenario";
export { PLANNER_VERSION } from "./version";
export { normalizePlannerInput } from "./input";
export { calculatePressure, rankTaskPressures, rankTasks } from "./pressure";
export { HEURISTIC_V1_CONFIG } from "./config";

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
  const pressures = rankTasks(normalized);
  const rankedTaskIds = pressures.map((pressure) => pressure.taskId);

  const sessionCounter = { value: 1 };
  const sessions: WorkSession[] = [
    ...new Map(
      [...input.manualSessions, ...input.lockedSessions].map((session) => [session.id, session]),
    ).values(),
  ];
  const warnings: PlannerWarning[] = [];
  const unscheduledMinutesByTask: Record<string, number> = {};

  const pending = [...tasks];
  const allocationOrderTaskIds: string[] = [];
  const allocatedCompletion = new Map<string, Date>(
    [...normalized.reservedEndByTask].filter(([id]) => normalized.fullyReservedTaskIds.has(id)),
  );
  while (pending.length > 0) {
    const readyPressures = rankTaskPressures(
      pending.flatMap((task) => {
        const readyAt = dependencyReadyAt(
          task.id,
          input,
          normalized.eligibility,
          allocatedCompletion,
        );
        return readyAt
          ? [
              calculatePressure(
                task,
                windows,
                input,
                readyAt,
                dependencyImportance(task.id, normalized),
              ),
            ]
          : [];
      }),
    );
    if (readyPressures.length === 0) break;
    const pressure = readyPressures[0];
    const index = pending.findIndex((task) => task.id === pressure.taskId);
    const task = pending.splice(index, 1)[0];
    allocationOrderTaskIds.push(task.id);
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
      warnings.push({
        code: pressure.suitableCapacityMinutes <= 0 ? "NO_SUITABLE_WINDOW" : "INFEASIBLE",
        taskId: task.id,
        message: `Task ${task.title} has ${placed.remaining} minute(s) that do not currently fit.`,
        deficitMinutes: placed.remaining,
        reasonCodes: [
          pressure.suitableCapacityMinutes <= 0 ? "NO_SUITABLE_WINDOW" : "INSUFFICIENT_CAPACITY",
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
      if (pressure.slackMinutes >= 0 && pressure.slackMinutes <= 60) {
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
    rankedTaskIds,
    allocationOrderTaskIds,
    unscheduledMinutesByTask,
    reasonsBySession: {},
  };
}
