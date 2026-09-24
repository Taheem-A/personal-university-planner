import type { PlannerInput, PlannableTask, WorkSession } from "../../domain/src";
import {
  addMinutes,
  instantToLocal,
  maxDate,
  minDate,
  minutesBetween,
  overlaps,
  roundUpToQuantum,
  MINUTE_MS,
} from "../../shared/src";
import type { CandidateWindow } from "./windows";
import { energyFit, locationFits, windowUsableMinutes } from "./windows";

const FIVE_MINUTES = 5;

function sessionTarget(
  task: PlannableTask,
  availableClockMinutes: number,
  remaining: number,
): number {
  const preferred = Math.min(task.preferredSessionMinutes, remaining, availableClockMinutes);
  const max = Math.min(task.maximumSessionMinutes, remaining, availableClockMinutes);
  let target = preferred >= task.minimumSessionMinutes ? preferred : max;
  if (remaining < task.minimumSessionMinutes) target = Math.min(remaining, availableClockMinutes);
  if (!task.splittable && remaining > availableClockMinutes) return 0;
  if (target <= 0) return 0;
  return Math.min(availableClockMinutes, roundUpToQuantum(target, FIVE_MINUTES));
}

function stableSessionBonus(taskId: string, window: CandidateWindow, input: PlannerInput): number {
  const old = input.previousSessions.find(
    (session) =>
      session.taskId === taskId &&
      overlaps(session.startAt, session.endAt, window.startAt, window.endAt),
  );
  return old ? 0.6 : 0;
}

function chooseWindow(
  task: PlannableTask,
  windows: CandidateWindow[],
  input: PlannerInput,
): number {
  let bestIndex = -1;
  let bestScore = -Infinity;
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index];
    const usable = windowUsableMinutes(task, window, input);
    if (usable < Math.min(task.minimumSessionMinutes, task.remainingMinutes)) continue;
    if (!locationFits(task, window, input)) continue;
    const energy = energyFit(task, window, input);
    const deadline = task.dueAt ?? input.horizonEnd;
    const hoursBeforeDeadline = Math.max(
      0.25,
      (deadline.getTime() - window.startAt.getTime()) / 3_600_000,
    );
    const earlyUsefulness = 1 / Math.sqrt(hoursBeforeDeadline);
    const lateHour = Number(instantToLocal(window.startAt, input.timezone).time.slice(0, 2));
    const latePenalty =
      task.energyRequirement === "HIGH" &&
      input.preferences.avoidLateHighEnergyTasks &&
      lateHour >= 21
        ? 1.5
        : 0;
    const score =
      energy * 2 +
      window.capacityFactor +
      earlyUsefulness +
      stableSessionBonus(task.id, window, input) -
      latePenalty;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

export function placeTask(
  task: PlannableTask,
  windows: CandidateWindow[],
  input: PlannerInput,
  sessionCounter: { value: number },
): { sessions: WorkSession[]; remaining: number; windows: CandidateWindow[] } {
  const sessions: WorkSession[] = [];
  let remaining = task.remainingMinutes;
  const mutable = [...windows];

  while (remaining > 0) {
    const windowIndex = chooseWindow({ ...task, remainingMinutes: remaining }, mutable, input);
    if (windowIndex < 0) break;
    const window = mutable[windowIndex];
    const earliest = maxDate(window.startAt, task.availableFrom, input.now);
    const startAt = new Date(roundUpToQuantum(earliest.getTime() / MINUTE_MS) * MINUTE_MS);
    const deadline = task.dueAt ?? input.horizonEnd;
    const latest = minDate(window.endAt, deadline, input.horizonEnd);
    const endBound = new Date(
      Math.floor(latest.getTime() / (FIVE_MINUTES * MINUTE_MS)) * FIVE_MINUTES * MINUTE_MS,
    );
    const availableClock = minutesBetween(startAt, endBound);
    const target = sessionTarget(task, availableClock, remaining);
    if (target <= 0) break;
    const endAt = addMinutes(startAt, target);
    sessions.push({
      id: `generated-${sessionCounter.value++}`,
      userId: input.userId,
      taskId: task.id,
      startAt,
      endAt,
      plannedMinutes: target,
      state: "PLANNED",
      generatedBy: "PLANNER",
      locked: false,
    });
    remaining = Math.max(0, remaining - target);
    if (endAt >= window.endAt) {
      mutable.splice(windowIndex, 1);
    } else {
      mutable[windowIndex] = {
        ...window,
        startAt: addMinutes(endAt, input.preferences.minimumBreakMinutes),
        clockMinutes: Math.max(
          0,
          minutesBetween(addMinutes(endAt, input.preferences.minimumBreakMinutes), window.endAt),
        ),
        remainingUsableMinutes: Math.max(
          0,
          Math.floor(
            minutesBetween(addMinutes(endAt, input.preferences.minimumBreakMinutes), window.endAt) *
              window.capacityFactor,
          ),
        ),
      };
    }
    if (!task.splittable) break;
  }

  return { sessions, remaining, windows: mutable };
}
