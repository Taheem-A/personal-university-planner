import type {
  PlannerInput,
  PlannerOutput,
  PlannerReasonCode,
  PlannerWarning,
  WorkSession,
} from "../../domain/src";
import { intersectIntervals, overlaps, sortByStart, subtractIntervals } from "../../shared/src";
import { placeTask, reserveSessionBreaks } from "./allocation";
import { dependencyReadyAt } from "./eligibility";
import { normalizePlannerInput } from "./input";
import { calculatePressure, dependencyImportance, rankTaskPressures, rankTasks } from "./pressure";
import { validatePlan } from "./validation";
import { PLANNER_VERSION } from "./version";
import { dailyPolicy, sustainablePolicyWarnings } from "./sustainability";
import { retainedPreviousSessions, type RetentionTier } from "./policy";

export { validatePlan } from "./validation";
export { simulateProtectedWindow } from "./scenario";
export { PLANNER_VERSION } from "./version";
export { normalizePlannerInput } from "./input";
export { calculatePressure, rankTaskPressures, rankTasks } from "./pressure";
export { HEURISTIC_V1_CONFIG } from "./config";

function planAttempt(rawInput: PlannerInput, retainedPrevious: WorkSession[]): PlannerOutput {
  const normalized = normalizePlannerInput(rawInput);
  const input = normalized.input;
  const softIntervals = [
    ...input.events.filter((event) => event.constraintLevel === "SOFT"),
    ...input.protectedWindows.filter((window) => window.level === "SOFT"),
  ];
  let windows = normalized.candidates;
  if (input.releasedTimePolicy === "KEEP_FREE" || input.releasedTimePolicy === "LEAVE_FREE")
    windows = windows.flatMap((window) =>
      subtractIntervals([window], input.releasedWindows).map((part) => ({
        ...window,
        startAt: part.startAt,
        endAt: part.endAt,
      })),
    );
  const tasks = input.tasks
    .filter((task) => normalized.eligibility.eligibleTaskIds.has(task.id))
    .map((task) => ({
      ...task,
      remainingMinutes: normalized.unallocatedMinutesByTask.get(task.id)!,
    }));
  const priorIds = [...input.manualSessions, ...input.lockedSessions].flatMap((session) => {
    const match = /^generated-(\d+)$/.exec(session.id);
    return match ? [Number(match[1])] : [];
  });
  const sessionCounter = { value: Math.max(0, ...priorIds) + 1 };
  const sessions: WorkSession[] = [
    ...new Map(
      [...input.manualSessions, ...input.lockedSessions].map((session) => [session.id, session]),
    ).values(),
  ];
  const policy = dailyPolicy(input, normalized.candidates, sessions);
  for (const retained of sessions) windows = reserveSessionBreaks(windows, retained, input);
  const pressures = rankTasks(normalized, windows);
  const rankedTaskIds = pressures.map((pressure) => pressure.taskId);
  const warnings: PlannerWarning[] = [];
  const reasonsBySession: Record<string, PlannerReasonCode[]> = {};
  for (const session of retainedPrevious) reasonsBySession[session.id] = ["STABILITY_PRESERVED"];
  for (const session of sessions) {
    if (session.generatedBy === "USER") reasonsBySession[session.id] = ["MANUAL_INTENT_PRESERVED"];
    if (session.locked) reasonsBySession[session.id] = ["LOCK_PRESERVED"];
  }
  const hard = [
    ...input.events.filter((event) => event.constraintLevel === "HARD"),
    ...input.protectedWindows.filter((window) => window.level === "HARD"),
    ...input.sleepWindows,
  ];
  for (const session of sessions) {
    const task = input.tasks.find((candidate) => candidate.id === session.taskId);
    if (
      !task ||
      session.startAt < task.availableFrom ||
      (task.dueAt && session.endAt > task.dueAt)
    ) {
      warnings.push({
        code: "HARD_CONFLICT",
        taskId: session.taskId,
        message: `Retained session ${session.id} conflicts with task availability or its true deadline.`,
        reasonCodes: ["HARD_CONFLICT"],
      });
    }
    const conflicts = hard.filter((window) =>
      overlaps(session.startAt, session.endAt, window.startAt, window.endAt),
    );
    if (conflicts.length > 0) {
      warnings.push({
        code: "HARD_CONFLICT",
        taskId: session.taskId,
        message: `Retained session ${session.id} conflicts with a hard commitment.`,
        deficitMinutes: conflicts.reduce((total, window) => {
          const overlap = intersectIntervals(session, window);
          return (
            total + (overlap ? (overlap.endAt.getTime() - overlap.startAt.getTime()) / 60_000 : 0)
          );
        }, 0),
        reasonCodes: ["HARD_CONFLICT"],
      });
    }
  }
  for (let index = 0; index < sessions.length; index += 1) {
    for (let other = index + 1; other < sessions.length; other += 1) {
      if (
        !overlaps(
          sessions[index].startAt,
          sessions[index].endAt,
          sessions[other].startAt,
          sessions[other].endAt,
        )
      )
        continue;
      warnings.push({
        code: "HARD_CONFLICT",
        taskId: sessions[other].taskId,
        message: `Retained sessions ${sessions[index].id} and ${sessions[other].id} overlap.`,
        reasonCodes: ["HARD_CONFLICT"],
      });
    }
  }
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
    const placed = placeTask(
      schedulable,
      windows,
      input,
      sessionCounter,
      policy,
      sessions,
      softIntervals,
    );
    sessions.push(...placed.sessions);
    for (const session of placed.sessions) {
      const reasons: PlannerReasonCode[] = [];
      if (
        softIntervals.some((window) =>
          overlaps(session.startAt, session.endAt, window.startAt, window.endAt),
        )
      ) {
        reasons.push("SOFT_TIME_USED");
        warnings.push({
          code: "SOFT_TIME_USED",
          taskId: session.taskId,
          message: `${task.title} uses soft-protected time.`,
          reasonCodes: ["SOFT_TIME_USED"],
        });
      }
      if (
        input.releasedWindows.some((window) =>
          overlaps(session.startAt, session.endAt, window.startAt, window.endAt),
        )
      )
        reasons.push("RELEASED_TIME_USED");
      if (reasons.length > 0) reasonsBySession[session.id] = reasons;
    }
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
      if (
        completion &&
        pressure.preferredCompletionTargetAt &&
        completion > pressure.preferredCompletionTargetAt
      ) {
        warnings.push({
          code: "DEADLINE_BUFFER_USED",
          taskId: task.id,
          message: `${task.title} uses part of its preferred completion buffer.`,
          deficitMinutes: Math.ceil(
            (completion.getTime() - pressure.preferredCompletionTargetAt.getTime()) / 60_000,
          ),
          reasonCodes: ["DEADLINE_BUFFER_USED"],
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

  for (const retained of [...input.manualSessions, ...input.lockedSessions]) {
    for (const prerequisiteId of normalized.eligibility.dependenciesByTask.get(retained.taskId) ??
      []) {
      const prerequisite = input.tasks.find((task) => task.id === prerequisiteId);
      if (input.completedTaskIds.includes(prerequisiteId) || prerequisite?.status === "COMPLETED")
        continue;
      const completed = sessions.filter(
        (session) =>
          session.taskId === prerequisiteId &&
          (session.state === "PLANNED" || session.state === "ACTIVE"),
      );
      const planned = completed.reduce((total, session) => total + session.plannedMinutes, 0);
      if (
        prerequisite &&
        planned >= prerequisite.remainingMinutes &&
        completed.every((session) => session.endAt <= retained.startAt)
      )
        continue;
      warnings.push({
        code: "HARD_CONFLICT",
        taskId: retained.taskId,
        message: `Retained session ${retained.id} starts before prerequisite ${prerequisiteId} is satisfied.`,
        reasonCodes: ["DEPENDENCY_BLOCKED", "HARD_CONFLICT"],
      });
    }
  }

  warnings.push(...sustainablePolicyWarnings(input, policy, sessions));
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
    reasonsBySession,
  };
}

function unscheduledTotal(output: PlannerOutput): number {
  return Object.values(output.unscheduledMinutesByTask).reduce(
    (total, minutes) => total + minutes,
    0,
  );
}

export function generatePlan(rawInput: PlannerInput): PlannerOutput {
  const base = normalizePlannerInput(rawInput);
  const tiers: RetentionTier[] =
    base.input.replanMode === "INCREMENTAL" ? ["ALL", "STABLE", "NONE"] : ["NONE"];
  let best: { output: PlannerOutput; tier: RetentionTier } | undefined;
  for (const tier of tiers) {
    const retained = retainedPreviousSessions(base, tier);
    const attemptInput: PlannerInput = {
      ...base.input,
      manualSessions: [...base.input.manualSessions, ...retained],
    };
    const output = planAttempt(attemptInput, retained);
    if (!best || unscheduledTotal(output) < unscheduledTotal(best.output)) best = { output, tier };
    if (unscheduledTotal(best.output) === 0) break;
  }
  const result = best!.output;
  if (base.input.replanMode === "INCREMENTAL") {
    const retainedIds = new Set(result.sessions.map((session) => session.id));
    for (const previous of base.input.previousSessions) {
      if (
        previous.generatedBy !== "PLANNER" ||
        previous.locked ||
        previous.state !== "PLANNED" ||
        previous.endAt <= base.input.now ||
        retainedIds.has(previous.id)
      )
        continue;
      const withinStability =
        previous.startAt.getTime() <
        base.input.now.getTime() + base.input.preferences.planStabilityWindowMinutes * 60_000;
      if (withinStability || best!.tier !== "ALL")
        result.warnings.push({
          code: "STABILITY_RELAXED",
          taskId: previous.taskId,
          message: `Previous session ${previous.id} could not remain fixed.`,
          reasonCodes: ["STABILITY_RELAXED"],
        });
    }
  }
  return result;
}
