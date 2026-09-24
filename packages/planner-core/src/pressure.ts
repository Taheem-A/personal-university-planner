import type { PlannerInput, PlannableTask, TaskPressure } from "../../domain/src";
import { addMinutes, maxDate, roundUpToQuantum } from "../../shared/src";
import type { NormalizedPlanningState } from "./input";
import { HEURISTIC_V1_CONFIG, type PlannerHeuristicConfig } from "./config";
import type { CandidateWindow, WindowSuitability } from "./windows";
import { windowSuitability } from "./windows";

function finiteRatio(work: number, capacity: number): number | null {
  if (capacity === 0) return work === 0 ? 0 : null;
  const ratio = work / capacity;
  return Number.isFinite(ratio) ? ratio : null;
}

function preferredTarget(
  task: PlannableTask,
  input: PlannerInput,
): {
  at?: Date;
  source: "EXPLICIT" | "BUFFER" | "NONE";
} {
  if (task.preferredCompletionAt) {
    return {
      at:
        task.dueAt && task.preferredCompletionAt > task.dueAt
          ? new Date(task.dueAt)
          : new Date(task.preferredCompletionAt),
      source: "EXPLICIT",
    };
  }
  if (task.dueAt && input.preferences.preferredDeadlineBufferHours > 0) {
    return {
      at: new Date(
        task.dueAt.getTime() - input.preferences.preferredDeadlineBufferHours * 3_600_000,
      ),
      source: "BUFFER",
    };
  }
  return { source: "NONE" };
}

function suitableWindows(
  task: PlannableTask,
  windows: CandidateWindow[],
  input: PlannerInput,
  endLimit?: Date,
): WindowSuitability[] {
  return windows.flatMap((window) => {
    const suitability = windowSuitability(task, window, input, endLimit);
    return suitability ? [suitability] : [];
  });
}

function totalCapacity(task: PlannableTask, windows: WindowSuitability[]): number {
  if (!task.splittable) return Math.max(0, ...windows.map((window) => window.capacityMinutes));
  return windows.reduce((sum, window) => sum + window.capacityMinutes, 0);
}

function feasibility(
  task: PlannableTask,
  input: PlannerInput,
  capacity: number,
  ratio: number | null,
  config: PlannerHeuristicConfig,
): TaskPressure["feasibility"] {
  if (task.remainingMinutes === 0) return "COMFORTABLE";
  if (capacity === 0 || ratio === null || ratio > 1) {
    return task.dueAt && task.dueAt <= input.horizonEnd ? "INFEASIBLE" : "HORIZON_LIMITED";
  }
  if (ratio >= config.criticalRatio) return "CRITICAL";
  if (ratio > config.comfortableRatio) return "CONSTRAINED";
  return "COMFORTABLE";
}

/** Quantitative task pressure; all preference contributions remain bounded. */
export function calculatePressure(
  task: PlannableTask,
  windows: CandidateWindow[],
  input: PlannerInput,
  dependencyReadyAt: Date | null = input.now,
  dependencyImportance = 0,
  config: Readonly<PlannerHeuristicConfig> = HEURISTIC_V1_CONFIG,
): TaskPressure {
  const boundedTask = dependencyReadyAt
    ? { ...task, availableFrom: maxDate(task.availableFrom, dependencyReadyAt) }
    : task;
  const suitable = dependencyReadyAt ? suitableWindows(boundedTask, windows, input) : [];
  const suitableCapacityMinutes = totalCapacity(task, suitable);
  const slackMinutes = suitableCapacityMinutes - task.remainingMinutes;
  const pressureRatio = finiteRatio(task.remainingMinutes, suitableCapacityMinutes);
  const target = preferredTarget(task, input);
  const preferredCapacityMinutes = target.at
    ? totalCapacity(
        task,
        dependencyReadyAt ? suitableWindows(boundedTask, windows, input, target.at) : [],
      )
    : undefined;
  const preferredSlackMinutes =
    preferredCapacityMinutes === undefined
      ? undefined
      : preferredCapacityMinutes - task.remainingMinutes;
  const deadlineHoursRemaining = task.dueAt
    ? Math.max(0, (task.dueAt.getTime() - input.now.getTime()) / 3_600_000)
    : undefined;
  const capacityPressure =
    pressureRatio === null
      ? config.capacityPressureCap
      : Math.min(config.capacityPressureCap, pressureRatio);
  const lowSlackPressure =
    slackMinutes <= 0 ? 1 : 1 / (1 + slackMinutes / config.lowSlackReferenceMinutes);
  const deadlinePressure =
    deadlineHoursRemaining === undefined
      ? 0
      : Math.min(
          config.deadlinePressureCap,
          (config.deadlineReferenceHours /
            Math.max(config.deadlineMinimumHours, deadlineHoursRemaining)) **
            config.deadlineExponent,
        );
  const preferredCompletionPressure =
    preferredSlackMinutes === undefined || preferredSlackMinutes >= 0
      ? 0
      : Math.min(1, -preferredSlackMinutes / Math.max(1, task.remainingMinutes));
  const capacityWeight = suitable.reduce((sum, window) => sum + window.capacityMinutes, 0);
  const weighted = (value: (window: WindowSuitability) => number) =>
    capacityWeight === 0
      ? 0
      : suitable.reduce((sum, window) => sum + window.capacityMinutes * value(window), 0) /
        capacityWeight;
  const contextFit = weighted((window) =>
    Math.max(0, window.energyMatch - (window.commute ? config.commuteContextPenalty : 0)),
  );
  const fragmentationCost = weighted((window) => window.fragmentationCost);
  const undesirableTimeCost = weighted((window) => window.undesirableTimeCost);
  const importance = task.importance ?? 0;
  const priorityOverride = Math.max(
    -config.maximumPriorityOverride,
    Math.min(config.maximumPriorityOverride, task.priorityOverride ?? 0),
  );
  const score =
    capacityPressure * config.capacityPressureWeight +
    lowSlackPressure * config.lowSlackWeight +
    deadlinePressure * config.deadlineWeight +
    preferredCompletionPressure * config.preferredCompletionWeight +
    importance * config.importanceWeight +
    dependencyImportance * config.dependencyWeight +
    contextFit * config.contextFitWeight -
    fragmentationCost * config.fragmentationPenaltyWeight -
    undesirableTimeCost * config.undesirableTimePenaltyWeight +
    priorityOverride * config.priorityOverrideWeight;
  return {
    taskId: task.id,
    suitableCapacityMinutes,
    remainingMinutes: task.remainingMinutes,
    slackMinutes,
    pressureRatio,
    capacityDeficitMinutes: Math.max(0, -slackMinutes),
    feasibility: feasibility(task, input, suitableCapacityMinutes, pressureRatio, config),
    actualDeadlineAt: task.dueAt && new Date(task.dueAt),
    deadlineHoursRemaining,
    preferredCompletionTargetAt: target.at,
    preferredTargetSource: target.source,
    preferredCapacityMinutes,
    preferredSlackMinutes,
    dependencyReadyAt: dependencyReadyAt ? new Date(dependencyReadyAt) : undefined,
    scoreComponents: {
      capacityPressure,
      lowSlackPressure,
      deadlinePressure,
      preferredCompletionPressure,
      importance,
      importanceKnown: task.importance !== undefined,
      dependencyImportance,
      contextFit,
      fragmentationCost,
      undesirableTimeCost,
      priorityOverride,
    },
    score,
    rank: 0,
  };
}

/** Optimistic finish bound, respecting prerequisite order and task-specific capacity. */
export function optimisticDependencyReadyAt(
  taskId: string,
  state: NormalizedPlanningState,
  windows: CandidateWindow[] = state.candidates,
): Date | null {
  const memo = new Map<string, Date | null>();
  const tasks = new Map(state.input.tasks.map((task) => [task.id, task]));
  function finish(id: string): Date | null {
    if (memo.has(id)) return memo.get(id)!;
    if (state.input.completedTaskIds.includes(id) || tasks.get(id)?.status === "COMPLETED")
      return state.input.now;
    if (state.fullyReservedTaskIds.has(id)) return state.reservedEndByTask.get(id) ?? null;
    const task = tasks.get(id);
    if (!task || !state.eligibility.eligibleTaskIds.has(id)) return null;
    const ready = readyFor(id);
    if (!ready) return null;
    const unallocated = state.unallocatedMinutesByTask.get(id) ?? task.remainingMinutes;
    const bounded = {
      ...task,
      availableFrom: maxDate(task.availableFrom, ready),
      remainingMinutes: unallocated,
    };
    let remaining = unallocated;
    for (const window of windows) {
      const suitable = windowSuitability(
        { ...bounded, remainingMinutes: remaining },
        window,
        state.input,
      );
      if (!suitable) continue;
      if (!task.splittable && suitable.capacityMinutes < remaining) continue;
      if (suitable.capacityMinutes >= remaining) {
        const clock = roundUpToQuantum(remaining / suitable.effectiveRate);
        const estimated = addMinutes(suitable.startAt, clock);
        const reservedEnd = state.reservedEndByTask.get(id);
        const result = reservedEnd && reservedEnd > estimated ? reservedEnd : estimated;
        memo.set(id, result);
        return result;
      }
      remaining -= suitable.capacityMinutes;
    }
    memo.set(id, null);
    return null;
  }
  function readyFor(id: string): Date | null {
    let ready = state.input.now;
    for (const prerequisite of state.eligibility.dependenciesByTask.get(id) ?? []) {
      const done = finish(prerequisite);
      if (!done) return null;
      if (done > ready) ready = done;
    }
    return ready;
  }
  return readyFor(taskId);
}

/** Downstream required work gives a bounded boost to prerequisite tasks. */
export function dependencyImportance(taskId: string, state: NormalizedPlanningState): number {
  const seen = new Set<string>();
  function collect(id: string): void {
    for (const [dependent, prerequisites] of state.eligibility.dependenciesByTask) {
      if (!prerequisites.includes(id) || seen.has(dependent)) continue;
      seen.add(dependent);
      collect(dependent);
    }
  }
  collect(taskId);
  const downstream = [...seen].reduce(
    (sum, id) => sum + (state.unallocatedMinutesByTask.get(id) ?? 0),
    0,
  );
  const own = state.unallocatedMinutesByTask.get(taskId) ?? 0;
  return Math.min(1, downstream / Math.max(1, own));
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareOptionalDates(a?: Date, b?: Date): number {
  if (!a) return b ? 1 : 0;
  if (!b) return -1;
  return a.getTime() - b.getTime();
}

/** Stable score, true deadline, preferred target, then task ID tie-breakers. */
export function rankTaskPressures(pressures: TaskPressure[]): TaskPressure[] {
  return [...pressures]
    .sort(
      (a, b) =>
        b.score - a.score ||
        compareOptionalDates(a.actualDeadlineAt, b.actualDeadlineAt) ||
        compareOptionalDates(a.preferredCompletionTargetAt, b.preferredCompletionTargetAt) ||
        compareIds(a.taskId, b.taskId),
    )
    .map((pressure, index) => ({ ...pressure, rank: index + 1 }));
}

export function rankTasks(
  state: NormalizedPlanningState,
  windows: CandidateWindow[] = state.candidates,
): TaskPressure[] {
  const pressures = state.input.tasks
    .filter((task) => state.eligibility.eligibleTaskIds.has(task.id))
    .map((task) =>
      calculatePressure(
        { ...task, remainingMinutes: state.unallocatedMinutesByTask.get(task.id)! },
        windows,
        state.input,
        optimisticDependencyReadyAt(task.id, state, windows),
        dependencyImportance(task.id, state),
      ),
    );
  return rankTaskPressures(pressures);
}
