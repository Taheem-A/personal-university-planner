import type { PlannerInput, PlannableTask, TaskPressure } from "../../domain/src";
import type { CandidateWindow } from "./windows";
import { windowUsableMinutes } from "./windows";

export function calculatePressure(
  task: PlannableTask,
  windows: CandidateWindow[],
  input: PlannerInput,
): TaskPressure {
  const suitableCapacityMinutes = windows.reduce(
    (sum, window) => sum + windowUsableMinutes(task, window, input),
    0,
  );
  const slackMinutes = suitableCapacityMinutes - task.remainingMinutes;
  const pressureRatio = task.remainingMinutes / Math.max(1, suitableCapacityMinutes);
  const dueHours = task.dueAt
    ? Math.max(0.25, (task.dueAt.getTime() - input.now.getTime()) / 3_600_000)
    : 24 * 30;
  const deadlinePressure = 1 / Math.sqrt(dueHours);
  const lowSlackPressure = slackMinutes <= 0 ? 4 : 1 / Math.max(1, slackMinutes / 60);
  const preferredPressure =
    task.preferredCompletionAt && task.preferredCompletionAt <= input.horizonEnd ? 0.5 : 0;
  const override = task.priorityOverride ?? 0;
  const score =
    pressureRatio * 3 + deadlinePressure * 4 + lowSlackPressure + preferredPressure + override;
  return {
    taskId: task.id,
    suitableCapacityMinutes,
    remainingMinutes: task.remainingMinutes,
    slackMinutes,
    pressureRatio,
    score,
  };
}
