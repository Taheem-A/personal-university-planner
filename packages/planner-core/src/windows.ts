import type { PlannerInput, PlannableTask, AvailabilityWindow } from "../../domain/src";
import {
  intersectIntervals,
  maxDate,
  minDate,
  minutesBetween,
  sortByStart,
  subtractIntervals,
  instantToLocal,
  roundDownToQuantum,
  roundUpToQuantum,
  MINUTE_MS,
} from "../../shared/src";

export interface CandidateWindow extends AvailabilityWindow {
  startAt: Date;
  endAt: Date;
  clockMinutes: number;
  remainingUsableMinutes: number;
  localDate: string;
  localStartTime: string;
  /** Simultaneous alternatives share one clock interval, never additive capacity. */
  alternatives: AvailabilityWindow[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function optionEnergyFit(task: PlannableTask, window: AvailabilityWindow): number {
  const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
  const delta = rank[window.energyLevel] - rank[task.energyRequirement];
  if (delta >= 0) return 1;
  return delta === -1 ? 0.72 : 0.42;
}

function optionFits(task: PlannableTask, option: AvailabilityWindow, input: PlannerInput): boolean {
  if (option.kind === "COMMUTE") {
    if (
      !input.preferences.scheduleCommuteWork ||
      !task.locationRequirements.includes("TRANSIT_OK") ||
      !option.allowedLocationTags.includes("TRANSIT_OK")
    )
      return false;
  }
  if (task.locationRequirements.length === 0 || task.locationRequirements.includes("ANYWHERE"))
    return true;
  return task.locationRequirements.every((requirement) =>
    option.allowedLocationTags.includes(requirement),
  );
}

export function locationFits(
  task: PlannableTask,
  window: CandidateWindow,
  input: PlannerInput,
): boolean {
  return window.alternatives.some((option) => optionFits(task, option, input));
}

export function energyFit(
  task: PlannableTask,
  window: CandidateWindow,
  input: PlannerInput,
): number {
  return Math.max(
    0,
    ...window.alternatives
      .filter((option) => optionFits(task, option, input))
      .map((option) => optionEnergyFit(task, option)),
  );
}

function optionSignature(option: AvailabilityWindow): string {
  return JSON.stringify([
    option.kind ?? "ORDINARY",
    option.capacityFactor,
    option.energyLevel,
    [...option.allowedLocationTags].sort(),
  ]);
}

/** Disjoint quantum-aligned capacity segments, preserving simultaneous capability alternatives. */
export function candidateWindows(
  input: PlannerInput,
  occupied: { startAt: Date; endAt: Date }[],
  effectiveStart: Date,
): CandidateWindow[] {
  if (effectiveStart >= input.horizonEnd) return [];
  const freeSources: AvailabilityWindow[] = [];
  for (const availability of input.availability) {
    const bounded = intersectIntervals(availability, {
      startAt: effectiveStart,
      endAt: input.horizonEnd,
    });
    if (!bounded) continue;
    const free = subtractIntervals([bounded], occupied);
    for (const part of free) {
      freeSources.push({ ...availability, startAt: part.startAt, endAt: part.endAt });
    }
  }
  const boundaries = [
    ...new Set(freeSources.flatMap((window) => [window.startAt.getTime(), window.endAt.getTime()])),
  ].sort((a, b) => a - b);
  const result: CandidateWindow[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const rawStart = boundaries[index];
    const rawEnd = boundaries[index + 1];
    const startAt = new Date(roundUpToQuantum(rawStart / MINUTE_MS) * MINUTE_MS);
    const endAt = new Date(roundDownToQuantum(rawEnd / MINUTE_MS) * MINUTE_MS);
    if (endAt <= startAt) continue;
    const matching = freeSources.filter(
      (window) => window.startAt.getTime() <= rawStart && window.endAt.getTime() >= rawEnd,
    );
    const unique = new Map<string, AvailabilityWindow>();
    for (const option of matching.sort((a, b) => a.id.localeCompare(b.id))) {
      const key = optionSignature(option);
      if (!unique.has(key)) unique.set(key, option);
    }
    const alternatives = [...unique.values()].sort(
      (a, b) => b.capacityFactor - a.capacityFactor || a.id.localeCompare(b.id),
    );
    if (alternatives.length === 0) continue;
    const primary = alternatives[0];
    const clockMinutes = minutesBetween(startAt, endAt);
    const local = instantToLocal(startAt, input.timezone);
    result.push({
      ...primary,
      id: `candidate:${startAt.toISOString()}:${endAt.toISOString()}`,
      startAt,
      endAt,
      clockMinutes,
      remainingUsableMinutes: Math.floor(
        clockMinutes *
          Math.max(
            0,
            ...alternatives
              .filter(
                (option) => option.kind !== "COMMUTE" || input.preferences.scheduleCommuteWork,
              )
              .map((option) => option.capacityFactor),
          ),
      ),
      localDate: local.date,
      localStartTime: local.time,
      allowedLocationTags: [...primary.allowedLocationTags],
      alternatives: alternatives.map((option) => ({
        ...option,
        allowedLocationTags: [...option.allowedLocationTags],
      })),
    });
  }
  return sortByStart(result);
}

export function windowUsableMinutes(
  task: PlannableTask,
  window: CandidateWindow,
  input: PlannerInput,
): number {
  if (!locationFits(task, window, input)) return 0;
  const earliest = maxDate(window.startAt, task.availableFrom, input.now);
  const start = new Date(roundUpToQuantum(earliest.getTime() / MINUTE_MS) * MINUTE_MS);
  const deadline = task.dueAt ?? input.horizonEnd;
  const latest = minDate(window.endAt, deadline, input.horizonEnd);
  const end = new Date(roundDownToQuantum(latest.getTime() / MINUTE_MS) * MINUTE_MS);
  if (end <= start) return 0;
  const clock = minutesBetween(start, end);
  return Math.floor(
    clock *
      Math.max(
        0,
        ...window.alternatives
          .filter((option) => optionFits(task, option, input))
          .map((option) => clamp01(option.capacityFactor) * optionEnergyFit(task, option)),
      ),
  );
}
