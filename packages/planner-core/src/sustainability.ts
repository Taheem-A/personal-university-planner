import type { PlannerInput, PlannerWarning, WorkSession } from "../../domain/src";
import { intersectIntervals, instantToLocal } from "../../shared/src";
import type { CandidateWindow } from "./windows";

/** Divide elapsed minutes by the caller's local calendar dates, including DST days. */
export function minutesByLocalDay(
  startAt: Date,
  endAt: Date,
  timezone: string,
): Map<string, number> {
  const result = new Map<string, number>();
  let cursor = startAt.getTime();
  const end = endAt.getTime();
  while (cursor < end) {
    const day = instantToLocal(new Date(cursor), timezone).date;
    let boundary = end;
    if (instantToLocal(new Date(end - 1), timezone).date !== day) {
      let low = cursor + 1;
      let high = end;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (instantToLocal(new Date(middle), timezone).date === day) low = middle + 1;
        else high = middle;
      }
      boundary = low;
    }
    result.set(day, (result.get(day) ?? 0) + (boundary - cursor) / 60_000);
    cursor = boundary;
  }
  return result;
}

function addInterval(
  totals: Map<string, number>,
  startAt: Date,
  endAt: Date,
  input: PlannerInput,
): void {
  const effectiveStart = input.now > input.horizonStart ? input.now : input.horizonStart;
  if (effectiveStart >= input.horizonEnd) return;
  const bounded = intersectIntervals(
    { startAt, endAt },
    {
      startAt: effectiveStart,
      endAt: input.horizonEnd,
    },
  );
  if (!bounded) return;
  for (const [day, minutes] of minutesByLocalDay(bounded.startAt, bounded.endAt, input.timezone))
    totals.set(day, (totals.get(day) ?? 0) + minutes);
}

function activeSessions(sessions: WorkSession[]): WorkSession[] {
  return sessions.filter((session) => session.state === "PLANNED" || session.state === "ACTIVE");
}

export interface DailyPolicy {
  availableByDay: Map<string, number>;
  retainedByDay: Map<string, number>;
}

/** Initial free capacity plus retained study defines each day's planning envelope. */
export function dailyPolicy(
  input: PlannerInput,
  windows: CandidateWindow[],
  retainedSessions: WorkSession[],
): DailyPolicy {
  const availableByDay = new Map<string, number>();
  const retainedByDay = new Map<string, number>();
  for (const window of windows) addInterval(availableByDay, window.startAt, window.endAt, input);
  for (const session of activeSessions(retainedSessions)) {
    addInterval(availableByDay, session.startAt, session.endAt, input);
    addInterval(retainedByDay, session.startAt, session.endAt, input);
  }
  return { availableByDay, retainedByDay };
}

export function studyMinutesByDay(
  input: PlannerInput,
  sessions: WorkSession[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const session of activeSessions(sessions))
    addInterval(totals, session.startAt, session.endAt, input);
  return totals;
}

export function fitsDailySoftPolicy(
  input: PlannerInput,
  policy: DailyPolicy,
  sessions: WorkSession[],
  startAt: Date,
  endAt: Date,
): boolean {
  const used = studyMinutesByDay(input, sessions);
  for (const [day, minutes] of minutesByLocalDay(startAt, endAt, input.timezone)) {
    const available = policy.availableByDay.get(day) ?? 0;
    const ceiling = Math.min(
      input.preferences.preferredDailyStudyLimitMinutes,
      Math.max(0, available - input.preferences.minimumFreeTimeMinutes),
    );
    if ((used.get(day) ?? 0) + minutes > ceiling + 1e-8) return false;
  }
  return true;
}

/** Soft limits never discard required work; report the exact local-day overage. */
export function sustainablePolicyWarnings(
  input: PlannerInput,
  policy: DailyPolicy,
  sessions: WorkSession[],
): PlannerWarning[] {
  const used = studyMinutesByDay(input, sessions);
  const warnings: PlannerWarning[] = [];
  for (const [day, minutes] of [...used].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const generated = minutes - (policy.retainedByDay.get(day) ?? 0);
    if (generated <= 0) continue;
    const studyOver = Math.max(0, minutes - input.preferences.preferredDailyStudyLimitMinutes);
    if (studyOver > 0)
      warnings.push({
        code: "DAILY_STUDY_LIMIT_EXCEEDED",
        message: `${day}: planned study exceeds the preferred daily limit by ${studyOver} minute(s).`,
        deficitMinutes: studyOver,
        reasonCodes: ["DAILY_STUDY_LIMIT_EXCEEDED"],
      });
    const available = policy.availableByDay.get(day) ?? 0;
    const freeTimeShortfall = Math.max(
      0,
      input.preferences.minimumFreeTimeMinutes - Math.max(0, available - minutes),
    );
    if (freeTimeShortfall > 0)
      warnings.push({
        code: "FREE_TIME_BUFFER_USED",
        message: `${day}: planned work uses ${freeTimeShortfall} minute(s) of preferred free time.`,
        deficitMinutes: freeTimeShortfall,
        reasonCodes: ["FREE_TIME_BUFFER_USED"],
      });
  }
  return warnings;
}
