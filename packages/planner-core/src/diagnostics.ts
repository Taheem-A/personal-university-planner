import type {
  PlannerInfeasibility,
  PlannerInput,
  PlannerLimitingFactor,
  PlannerReasonCode,
  PlannerValidationIssue,
  PlannableTask,
  TaskPressure,
  WorkSession,
} from "../../domain/src";
import { overlaps } from "../../shared/src";
import { normalizePlannerInput } from "./input";
import { calculatePressure } from "./pressure";
import { windowSuitability } from "./windows";
import type { CandidateWindow } from "./windows";

function conflicts(
  task: PlannableTask,
  input: PlannerInput,
  windows: {
    startAt: Date;
    endAt: Date;
  }[],
): boolean {
  return windows.some(
    (window) =>
      window.endAt > task.availableFrom &&
      (!task.dueAt || window.startAt < task.dueAt) &&
      input.availability.some((available) =>
        overlaps(window.startAt, window.endAt, available.startAt, available.endAt),
      ),
  );
}

/** Quantify what remains, with causes only when the explicit snapshot supports them. */
export function quantifyInfeasibility(
  input: PlannerInput,
  sessions: WorkSession[],
  pressures: TaskPressure[],
  issues: PlannerValidationIssue[],
): PlannerInfeasibility[] {
  const state = normalizePlannerInput(input);
  const byPressure = new Map(pressures.map((pressure) => [pressure.taskId, pressure]));
  const result: PlannerInfeasibility[] = [];
  for (const task of input.tasks) {
    if (
      (task.status !== "READY" && task.status !== "IN_PROGRESS") ||
      task.planningMode !== "AUTO" ||
      task.remainingMinutes <= 0
    )
      continue;
    const scheduledMinutes = sessions
      .filter(
        (session) =>
          session.taskId === task.id &&
          (session.state === "PLANNED" || session.state === "ACTIVE") &&
          session.endAt > input.now,
      )
      .reduce((sum, session) => sum + session.plannedMinutes, 0);
    const unscheduledMinutes = Math.max(0, task.remainingMinutes - scheduledMinutes);
    const taskIssues = issues.filter((issue) => issue.taskId === task.id);
    if (unscheduledMinutes === 0 && taskIssues.length === 0) continue;
    const pressure =
      byPressure.get(task.id) ??
      calculatePressure(
        task,
        state.candidates,
        state.input,
        state.eligibility.blockedTaskIds.has(task.id) ? null : input.now,
      );
    const reservedMinutes = [
      ...new Map(
        [...input.manualSessions, ...input.lockedSessions].map((session) => [session.id, session]),
      ).values(),
    ]
      .filter((session) => session.taskId === task.id && session.endAt > input.now)
      .reduce((sum, session) => sum + session.plannedMinutes, 0);
    const suitableCapacityMinutes = pressure.suitableCapacityMinutes + reservedMinutes;
    const factors = new Set<PlannerLimitingFactor>();
    if (
      state.eligibility.blockedTaskIds.has(task.id) ||
      taskIssues.some((issue) => issue.code === "DEPENDENCY")
    )
      factors.add("DEPENDENCY_BLOCKED");
    if (suitableCapacityMinutes <= 0) factors.add("NO_SUITABLE_WINDOW");
    if (suitableCapacityMinutes < task.remainingMinutes || unscheduledMinutes > 0)
      factors.add("INSUFFICIENT_CAPACITY");
    if (!task.dueAt || task.dueAt > input.horizonEnd || task.availableFrom >= input.horizonEnd)
      factors.add("HORIZON_LIMIT");
    if (task.dueAt && task.dueAt <= input.horizonEnd && unscheduledMinutes > 0)
      factors.add("DEADLINE_COLLISION");
    if (
      conflicts(
        task,
        input,
        input.events.filter((event) => event.constraintLevel === "HARD"),
      )
    )
      factors.add("HARD_COMMITMENT");
    if (
      conflicts(task, input, [
        ...input.protectedWindows.filter((window) => window.level === "HARD"),
        ...input.sleepWindows,
      ])
    )
      factors.add("PROTECTED_TIME");
    if (conflicts(task, input, input.lockedSessions)) factors.add("LOCK_PRESSURE");
    if (!input.preferences.scheduleCommuteWork) {
      const enabled = {
        ...state.input,
        preferences: {
          ...state.input.preferences,
          scheduleCommuteWork: true,
        },
      };
      if (state.candidates.some((window) => windowSuitability(task, window, enabled)?.commute))
        factors.add("COMMUTE_DISABLED");
    }
    if (
      state.candidates.some((window) => {
        const relaxed = {
          ...task,
          locationRequirements: ["ANYWHERE"] as PlannableTask["locationRequirements"],
        };
        return (
          !windowSuitability(task, window, state.input) &&
          !!windowSuitability(relaxed, window, state.input)
        );
      })
    )
      factors.add("CAPABILITY_MISMATCH");
    result.push({
      taskId: task.id,
      requiredMinutes: task.remainingMinutes,
      scheduledMinutes,
      unscheduledMinutes,
      suitableCapacityMinutes,
      deficitMinutes: unscheduledMinutes,
      limitingFactors: [...factors].sort(),
      actualDeadlineAt: task.dueAt && new Date(task.dueAt),
    });
  }
  return result.sort((a, b) => (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0));
}

/** Concise explanations use observed conditions, while numeric scores stay in diagnostics. */
export function placementReasons(
  session: WorkSession,
  task: PlannableTask,
  pressure: TaskPressure | undefined,
  input: PlannerInput,
  windows: CandidateWindow[],
  existing: PlannerReasonCode[],
): PlannerReasonCode[] {
  const reasons = new Set<PlannerReasonCode>(existing);
  if (pressure?.slackMinutes !== undefined && pressure.slackMinutes <= 60) reasons.add("LOW_SLACK");
  if (pressure?.deadlineHoursRemaining !== undefined && pressure.deadlineHoursRemaining <= 24)
    reasons.add("DEADLINE_PRESSURE");
  if (pressure?.preferredSlackMinutes !== undefined && pressure.preferredSlackMinutes < 0)
    reasons.add("PREFERRED_COMPLETION_PRESSURE");
  if (input.dependencies.some((edge) => edge.prerequisiteTaskId === task.id))
    reasons.add("PREREQUISITE");
  const actual = windows.flatMap((window) => {
    if (window.startAt > session.startAt || window.endAt < session.endAt) return [];
    const suitability = windowSuitability(
      { ...task, remainingMinutes: 1, minimumSessionMinutes: 0, splittable: true },
      { ...window, startAt: session.startAt, endAt: session.endAt },
      input,
    );
    return suitability ? [suitability] : [];
  })[0];
  if (
    actual &&
    task.locationRequirements.length > 0 &&
    !task.locationRequirements.includes("ANYWHERE")
  )
    reasons.add("LOCATION_MATCH");
  if (actual?.energyMatch === 1 && task.energyRequirement === "HIGH") reasons.add("ENERGY_MATCH");
  if (pressure && pressure.suitableCapacityMinutes <= session.plannedMinutes)
    reasons.add("ONLY_SUITABLE_CAPACITY");
  return [...reasons].sort();
}
