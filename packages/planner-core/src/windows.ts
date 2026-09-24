import type { PlannerInput, PlannableTask, AvailabilityWindow } from "../../domain/src";
import {
  intersectIntervals,
  maxDate,
  minDate,
  minutesBetween,
  sortByStart,
  subtractIntervals,
} from "../../shared/src";

export interface CandidateWindow extends AvailabilityWindow {
  startAt: Date;
  endAt: Date;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function energyFit(task: PlannableTask, window: CandidateWindow): number {
  const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
  const delta = rank[window.energyLevel] - rank[task.energyRequirement];
  if (delta >= 0) return 1;
  return delta === -1 ? 0.72 : 0.42;
}

export function locationFits(task: PlannableTask, window: CandidateWindow): boolean {
  if (task.locationRequirements.length === 0 || task.locationRequirements.includes("ANYWHERE"))
    return true;
  return task.locationRequirements.every((requirement) =>
    window.allowedLocationTags.includes(requirement),
  );
}

function occupiedIntervals(input: PlannerInput): { startAt: Date; endAt: Date }[] {
  const hardEvents = input.events
    .filter((event) => event.constraintLevel === "HARD")
    .map((event) => ({ startAt: event.startAt, endAt: event.endAt }));
  const locked = input.lockedSessions
    .filter((session) => session.state === "PLANNED" || session.state === "ACTIVE")
    .map((session) => ({ startAt: session.startAt, endAt: session.endAt }));
  return sortByStart([...hardEvents, ...locked]);
}

export function candidateWindows(input: PlannerInput): CandidateWindow[] {
  const occupied = occupiedIntervals(input);
  const result: CandidateWindow[] = [];
  for (const availability of input.availability) {
    const bounded = intersectIntervals(availability, {
      startAt: input.horizonStart,
      endAt: input.horizonEnd,
    });
    if (!bounded) continue;
    const free = subtractIntervals([bounded], occupied);
    for (const part of free) {
      result.push({ ...availability, startAt: part.startAt, endAt: part.endAt });
    }
  }
  return sortByStart(result);
}

export function eligibleTask(task: PlannableTask, input: PlannerInput): boolean {
  return (
    (task.status === "READY" || task.status === "IN_PROGRESS") &&
    task.planningMode === "AUTO" &&
    task.remainingMinutes > 0 &&
    task.availableFrom <= input.horizonEnd
  );
}

export function windowUsableMinutes(
  task: PlannableTask,
  window: CandidateWindow,
  input: PlannerInput,
): number {
  if (!locationFits(task, window)) return 0;
  const start = maxDate(window.startAt, task.availableFrom, input.now);
  const deadline = task.dueAt ?? input.horizonEnd;
  const end = minDate(window.endAt, deadline, input.horizonEnd);
  if (end <= start) return 0;
  const clock = minutesBetween(start, end);
  const energy = energyFit(task, window);
  return Math.floor(clock * clamp01(window.capacityFactor) * energy);
}
