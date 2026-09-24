import type { PlannerInput } from "../../domain/src";
import {
  addLocalDays,
  compareLocalDates,
  createInterval,
  instantToLocal,
  intersectIntervals,
  localDateTimeToInstant,
  mergeIntervals,
  minutesBetween,
} from "../../shared/src";

function validateMinimumSleep(input: PlannerInput): void {
  const minimum = input.minimumSleepMinutes;
  if (minimum === 0) return;
  // Complete local days in the horizon require an explicit qualifying sleep block.
  // The caller supplies the user's policy and sleep rules; core never invents bedtime.
  const first = instantToLocal(input.horizonStart, input.timezone).date;
  const last = instantToLocal(input.horizonEnd, input.timezone).date;
  for (let date = first; compareLocalDates(date, last) <= 0; date = addLocalDays(date, 1)) {
    const dayStart = localDateTimeToInstant({ date, time: "00:00", timezone: input.timezone });
    const dayEnd = localDateTimeToInstant({
      date: addLocalDays(date, 1),
      time: "00:00",
      timezone: input.timezone,
    });
    if (dayStart < input.horizonStart || dayEnd > input.horizonEnd) continue;
    const protectedSleep = input.sleepWindows.some(
      (window) =>
        instantToLocal(window.startAt, input.timezone).date === date &&
        minutesBetween(window.startAt, window.endAt) >= minimum,
    );
    if (!protectedSleep) throw new Error(`No qualifying minimum-sleep window starts on ${date}.`);
  }
}

/** Merged half-open hard occupancy. Soft items are kept outside this timeline. */
export function occupiedTimeline(input: PlannerInput, effectiveStart: Date) {
  validateMinimumSleep(input);
  if (effectiveStart >= input.horizonEnd) return [];
  const bounds = createInterval(effectiveStart, input.horizonEnd);
  const active = (session: { state: string }) =>
    session.state === "PLANNED" || session.state === "ACTIVE";
  const sources = [
    ...input.events.filter((event) => event.constraintLevel === "HARD"),
    ...input.protectedWindows.filter((window) => window.level === "HARD"),
    ...input.sleepWindows,
    ...input.lockedSessions.filter(active),
    ...input.manualSessions.filter(active),
  ];
  return mergeIntervals(
    sources.flatMap((source) => {
      const clipped = intersectIntervals(source, bounds);
      return clipped ? [clipped] : [];
    }),
  );
}
