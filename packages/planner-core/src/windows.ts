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
import { HEURISTIC_V1_CONFIG } from "./config";

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

export interface WindowSuitability {
  startAt: Date;
  endAt: Date;
  clockMinutes: number;
  capacityMinutes: number;
  effectiveRate: number;
  energyMatch: number;
  commute: boolean;
  fragmentationCost: number;
  undesirableTimeCost: number;
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

export function windowSuitability(
  task: PlannableTask,
  window: CandidateWindow,
  input: PlannerInput,
  endLimit?: Date,
): WindowSuitability | undefined {
  if (task.remainingMinutes <= 0 || !locationFits(task, window, input)) return undefined;
  const earliest = maxDate(window.startAt, task.availableFrom, input.now);
  const start = new Date(roundUpToQuantum(earliest.getTime() / MINUTE_MS) * MINUTE_MS);
  const deadline = task.dueAt ?? input.horizonEnd;
  const latest = minDate(window.endAt, deadline, input.horizonEnd, endLimit ?? input.horizonEnd);
  const end = new Date(roundDownToQuantum(latest.getTime() / MINUTE_MS) * MINUTE_MS);
  if (end <= start) return undefined;
  const clockMinutes = minutesBetween(start, end);
  const suitable = window.alternatives
    .filter((option) => optionFits(task, option, input))
    .map((option) => ({
      option,
      energyMatch: optionEnergyFit(task, option),
      effectiveRate: clamp01(option.capacityFactor) * optionEnergyFit(task, option),
    }))
    .sort((a, b) => b.effectiveRate - a.effectiveRate || a.option.id.localeCompare(b.option.id));
  const best = suitable[0];
  if (!best || best.effectiveRate <= 0) return undefined;
  const capacityMinutes = Math.floor(clockMinutes * best.effectiveRate);
  const minimumUseful = Math.min(task.minimumSessionMinutes, task.remainingMinutes);
  if (
    capacityMinutes < minimumUseful ||
    (!task.splittable && capacityMinutes < task.remainingMinutes)
  )
    return undefined;
  const localHour = Number(instantToLocal(start, input.timezone).time.slice(0, 2));
  return {
    startAt: start,
    endAt: end,
    clockMinutes,
    capacityMinutes,
    effectiveRate: best.effectiveRate,
    energyMatch: best.energyMatch,
    commute: best.option.kind === "COMMUTE",
    fragmentationCost: Math.max(0, 1 - clockMinutes / Math.max(1, task.preferredSessionMinutes)),
    undesirableTimeCost:
      task.energyRequirement === "HIGH" &&
      input.preferences.avoidLateHighEnergyTasks &&
      localHour >= HEURISTIC_V1_CONFIG.lateHighEnergyHour
        ? 1
        : 0,
  };
}

export function windowUsableMinutes(
  task: PlannableTask,
  window: CandidateWindow,
  input: PlannerInput,
): number {
  return windowSuitability(task, window, input)?.capacityMinutes ?? 0;
}
