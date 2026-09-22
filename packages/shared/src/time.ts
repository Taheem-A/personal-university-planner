export const MINUTE_MS = 60_000;
export const SCHEDULING_QUANTUM_MINUTES = 5;
export const DEFAULT_TIMEZONE: IanaTimezone = "America/Toronto";

/** ISO 8601 calendar date (YYYY-MM-DD), without time or offset semantics. */
export type LocalDate = string;
/** Local wall-clock time (HH:mm or HH:mm:ss), meaningful only with a timezone. */
export type LocalTime = string;
export type IanaTimezone = string;
export type RecurrenceRule = string;

export interface InstantInterval {
  startAt: Date;
  endAt: Date;
}

export interface LocalDateTime {
  date: LocalDate;
  time: LocalTime;
  timezone: IanaTimezone;
}

export interface LocalDateTimeWithOffset extends LocalDateTime {
  offsetMinutes: number;
}

export type AmbiguousTimePolicy = "EARLIER" | "LATER" | "REJECT";
export type NonexistentRecurrencePolicy = "SKIP" | "REJECT";

export interface LocalRecurrenceWindow {
  recurrenceRule: RecurrenceRule;
  startTimeLocal: LocalTime;
  endTimeLocal: LocalTime;
  spansNextDay: boolean;
  timezone: IanaTimezone;
  effectiveFrom: LocalDate;
  effectiveUntil?: LocalDate;
}

export interface RecurrenceExpansionOptions {
  ambiguousTime?: AmbiguousTimePolicy;
  nonexistentTime?: NonexistentRecurrencePolicy;
}

export interface RecurringInstantWindow extends InstantInterval {
  localDate: LocalDate;
  timezone: IanaTimezone;
}

export class InvalidIntervalError extends RangeError {}
export class InvalidLocalDateTimeError extends RangeError {}
export class AmbiguousLocalTimeError extends RangeError {}
export class NonexistentLocalTimeError extends RangeError {}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

interface ZonedParts extends DateParts, TimeParts {}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function assertValidDate(date: Date, label: string): void {
  if (!Number.isFinite(date.getTime())) throw new RangeError(`${label} must be a valid instant`);
}

function sameInstant(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

function parseDateParts(value: LocalDate): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new InvalidLocalDateTimeError(`Invalid local date: ${value}`);
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    probe.getUTCFullYear() !== parts.year ||
    probe.getUTCMonth() + 1 !== parts.month ||
    probe.getUTCDate() !== parts.day
  ) {
    throw new InvalidLocalDateTimeError(`Invalid local date: ${value}`);
  }
  return parts;
}

function parseTimeParts(value: LocalTime): TimeParts {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new InvalidLocalDateTimeError(`Invalid local time: ${value}`);
  const parts = { hour: Number(match[1]), minute: Number(match[2]), second: Number(match[3] ?? 0) };
  if (parts.hour > 23 || parts.minute > 59 || parts.second > 59) {
    throw new InvalidLocalDateTimeError(`Invalid local time: ${value}`);
  }
  return parts;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDate(parts: DateParts): LocalDate {
  return `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}`;
}

function formatTime(parts: TimeParts): LocalTime {
  return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function formatterFor(timezone: IanaTimezone): Intl.DateTimeFormat {
  const cached = formatterCache.get(timezone);
  if (cached) return cached;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new InvalidLocalDateTimeError(`Invalid IANA timezone: ${timezone}`);
  }
  formatterCache.set(timezone, formatter);
  return formatter;
}

function zonedParts(instant: Date, timezone: IanaTimezone): ZonedParts {
  assertValidDate(instant, "instant");
  const values = Object.fromEntries(
    formatterFor(timezone)
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function localEpoch(parts: ZonedParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function possibleInstants(local: LocalDateTime): Date[] {
  const date = parseDateParts(local.date);
  const time = parseTimeParts(local.time);
  formatterFor(local.timezone);
  const desired: ZonedParts = { ...date, ...time };
  const naiveEpoch = localEpoch(desired);
  const offsets = new Set<number>();

  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = new Date(naiveEpoch + hours * 60 * MINUTE_MS);
    const sampleParts = zonedParts(sample, local.timezone);
    offsets.add((localEpoch(sampleParts) - sample.getTime()) / MINUTE_MS);
  }

  const candidates = [...offsets]
    .map((offset) => new Date(naiveEpoch - offset * MINUTE_MS))
    .filter((candidate) => {
      const actual = zonedParts(candidate, local.timezone);
      return localEpoch(actual) === naiveEpoch;
    })
    .sort((a, b) => a.getTime() - b.getTime());

  return candidates.filter(
    (candidate, index) => index === 0 || !sameInstant(candidate, candidates[index - 1]),
  );
}

export function createInterval(startAt: Date, endAt: Date): InstantInterval {
  assertValidDate(startAt, "startAt");
  assertValidDate(endAt, "endAt");
  if (startAt >= endAt)
    throw new InvalidIntervalError("Half-open interval requires startAt < endAt");
  return { startAt: new Date(startAt), endAt: new Date(endAt) };
}

export function intervalsOverlap(a: InstantInterval, b: InstantInterval): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

/** Compatibility wrapper for existing planner callers; semantics are still [start, end). */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return intervalsOverlap(createInterval(aStart, aEnd), createInterval(bStart, bEnd));
}

export function intervalContains(outer: InstantInterval, inner: InstantInterval): boolean {
  return outer.startAt <= inner.startAt && inner.endAt <= outer.endAt;
}

export function intersectIntervals(
  a: InstantInterval,
  b: InstantInterval,
): InstantInterval | undefined {
  const startAt = maxDate(a.startAt, b.startAt);
  const endAt = minDate(a.endAt, b.endAt);
  return startAt < endAt ? createInterval(startAt, endAt) : undefined;
}

export function sortIntervals(intervals: readonly InstantInterval[]): InstantInterval[] {
  return intervals
    .map((interval) => createInterval(interval.startAt, interval.endAt))
    .sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime() || a.endAt.getTime() - b.endAt.getTime(),
    );
}

export function mergeIntervals(
  intervals: readonly InstantInterval[],
  options: { mergeAdjacent?: boolean } = {},
): InstantInterval[] {
  const sorted = sortIntervals(intervals);
  const merged: InstantInterval[] = [];
  for (const current of sorted) {
    const previous = merged.at(-1);
    const joins =
      previous &&
      (intervalsOverlap(previous, current) ||
        (options.mergeAdjacent !== false &&
          previous.endAt.getTime() === current.startAt.getTime()));
    if (!previous || !joins) merged.push(current);
    else if (current.endAt > previous.endAt) previous.endAt = new Date(current.endAt);
  }
  return merged;
}

export function normalizeIntervals(intervals: readonly InstantInterval[]): InstantInterval[] {
  return mergeIntervals(intervals, { mergeAdjacent: true });
}

export function subtractIntervals(
  available: readonly InstantInterval[],
  occupied: readonly InstantInterval[],
): InstantInterval[] {
  const blocks = normalizeIntervals(occupied);
  const result: InstantInterval[] = [];
  for (const source of normalizeIntervals(available)) {
    let parts = [source];
    for (const block of blocks) {
      const next: InstantInterval[] = [];
      for (const part of parts) {
        const overlap = intersectIntervals(part, block);
        if (!overlap) next.push(part);
        else {
          if (part.startAt < overlap.startAt)
            next.push(createInterval(part.startAt, overlap.startAt));
          if (overlap.endAt < part.endAt) next.push(createInterval(overlap.endAt, part.endAt));
        }
      }
      parts = next;
    }
    result.push(...parts);
  }
  return sortIntervals(result);
}

export function splitInterval(
  interval: InstantInterval,
  maximumMinutes: number,
): InstantInterval[] {
  if (!Number.isFinite(maximumMinutes) || maximumMinutes <= 0) {
    throw new RangeError("maximumMinutes must be positive");
  }
  const source = createInterval(interval.startAt, interval.endAt);
  const result: InstantInterval[] = [];
  let cursor = source.startAt;
  while (cursor < source.endAt) {
    const candidate = addMinutes(cursor, maximumMinutes);
    const endAt = candidate < source.endAt ? candidate : source.endAt;
    result.push(createInterval(cursor, endAt));
    cursor = endAt;
  }
  return result;
}

export function minutesBetween(start: Date, end: Date): number {
  assertValidDate(start, "start");
  assertValidDate(end, "end");
  if (end < start) throw new RangeError("minutesBetween requires end >= start");
  return (end.getTime() - start.getTime()) / MINUTE_MS;
}

export function addMinutes(date: Date, minutes: number): Date {
  assertValidDate(date, "date");
  if (!Number.isFinite(minutes)) throw new RangeError("minutes must be finite");
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

export function maxDate(...dates: Date[]): Date {
  if (dates.length === 0) throw new Error("maxDate requires at least one date");
  dates.forEach((date) => assertValidDate(date, "date"));
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

export function minDate(...dates: Date[]): Date {
  if (dates.length === 0) throw new Error("minDate requires at least one date");
  dates.forEach((date) => assertValidDate(date, "date"));
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function assertQuantum(quantum: number): void {
  if (!Number.isInteger(quantum) || quantum <= 0)
    throw new RangeError("quantum must be a positive integer");
}

export function roundUpToQuantum(minutes: number, quantum = SCHEDULING_QUANTUM_MINUTES): number {
  assertQuantum(quantum);
  if (!Number.isFinite(minutes) || minutes < 0)
    throw new RangeError("minutes must be non-negative");
  return Math.ceil(minutes / quantum) * quantum;
}

export function roundDownToQuantum(minutes: number, quantum = SCHEDULING_QUANTUM_MINUTES): number {
  assertQuantum(quantum);
  if (!Number.isFinite(minutes) || minutes < 0)
    throw new RangeError("minutes must be non-negative");
  return Math.floor(minutes / quantum) * quantum;
}

export function isOnSchedulingQuantum(
  minutes: number,
  quantum = SCHEDULING_QUANTUM_MINUTES,
): boolean {
  assertQuantum(quantum);
  return Number.isInteger(minutes) && minutes >= 0 && minutes % quantum === 0;
}

export function sortByStart<T extends { startAt: Date; endAt?: Date }>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      a.startAt.getTime() - b.startAt.getTime() ||
      (a.endAt?.getTime() ?? a.startAt.getTime()) - (b.endAt?.getTime() ?? b.startAt.getTime()),
  );
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days)) throw new RangeError("days must be an integer");
  const parts = parseDateParts(date);
  const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return formatDate({
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  });
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  const aParts = parseDateParts(a);
  const bParts = parseDateParts(b);
  return (
    Date.UTC(aParts.year, aParts.month - 1, aParts.day) -
    Date.UTC(bParts.year, bParts.month - 1, bParts.day)
  );
}

export function localDateTimeToInstant(
  local: LocalDateTime,
  ambiguousTime: AmbiguousTimePolicy = "EARLIER",
): Date {
  const candidates = possibleInstants(local);
  if (candidates.length === 0) {
    throw new NonexistentLocalTimeError(
      `${local.date} ${local.time} does not exist in ${local.timezone}`,
    );
  }
  if (candidates.length > 1) {
    if (ambiguousTime === "REJECT") {
      throw new AmbiguousLocalTimeError(
        `${local.date} ${local.time} is ambiguous in ${local.timezone}`,
      );
    }
    return new Date(ambiguousTime === "LATER" ? candidates.at(-1)! : candidates[0]);
  }
  return new Date(candidates[0]);
}

export function instantToLocal(instant: Date, timezone: IanaTimezone): LocalDateTimeWithOffset {
  const parts = zonedParts(instant, timezone);
  const wholeSecondEpoch = Math.floor(instant.getTime() / 1_000) * 1_000;
  return {
    date: formatDate(parts),
    time: formatTime(parts),
    timezone,
    offsetMinutes: (localEpoch(parts) - wholeSecondEpoch) / MINUTE_MS,
  };
}

interface ParsedRecurrence {
  frequency: "DAILY" | "WEEKLY";
  interval: number;
  weekdays: number[];
}

const weekdayNumbers: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function weekday(date: LocalDate): number {
  const parts = parseDateParts(date);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function daysBetweenDates(start: LocalDate, end: LocalDate): number {
  return compareLocalDates(end, start) / (24 * 60 * MINUTE_MS);
}

function parseRecurrence(rule: RecurrenceRule, effectiveFrom: LocalDate): ParsedRecurrence {
  const entries = new Map<string, string>();
  for (const part of rule.replace(/^RRULE:/i, "").split(";")) {
    const [rawKey, rawValue] = part.split("=", 2);
    if (!rawKey || !rawValue) throw new RangeError(`Invalid recurrence part: ${part}`);
    entries.set(rawKey.toUpperCase(), rawValue.toUpperCase());
  }
  const allowed = new Set(["FREQ", "INTERVAL", "BYDAY"]);
  for (const key of entries.keys())
    if (!allowed.has(key)) throw new RangeError(`Unsupported recurrence part: ${key}`);
  const frequency = entries.get("FREQ");
  if (frequency !== "DAILY" && frequency !== "WEEKLY") {
    throw new RangeError("Only DAILY and WEEKLY recurrence are supported in Milestone 1");
  }
  const interval = Number(entries.get("INTERVAL") ?? "1");
  if (!Number.isInteger(interval) || interval <= 0)
    throw new RangeError("Recurrence INTERVAL must be positive");
  const byday = entries.get("BYDAY");
  const weekdays = byday
    ? byday.split(",").map((token) => {
        const value = weekdayNumbers[token];
        if (value === undefined) throw new RangeError(`Unsupported BYDAY value: ${token}`);
        return value;
      })
    : [weekday(effectiveFrom)];
  return { frequency, interval, weekdays: [...new Set(weekdays)].sort() };
}

function occursOn(date: LocalDate, anchor: LocalDate, recurrence: ParsedRecurrence): boolean {
  const elapsedDays = daysBetweenDates(anchor, date);
  if (elapsedDays < 0) return false;
  if (recurrence.frequency === "DAILY") return elapsedDays % recurrence.interval === 0;
  const anchorWeekStart = addLocalDays(anchor, -((weekday(anchor) + 6) % 7));
  const weeks = Math.floor(daysBetweenDates(anchorWeekStart, date) / 7);
  return weeks % recurrence.interval === 0 && recurrence.weekdays.includes(weekday(date));
}

export function expandRecurringWindows(
  rule: LocalRecurrenceWindow,
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
  options: RecurrenceExpansionOptions = {},
): RecurringInstantWindow[] {
  if (compareLocalDates(rangeStart, rangeEnd) > 0)
    throw new RangeError("rangeStart must not follow rangeEnd");
  const parsed = parseRecurrence(rule.recurrenceRule, rule.effectiveFrom);
  const lower =
    compareLocalDates(rangeStart, rule.effectiveFrom) < 0 ? rule.effectiveFrom : rangeStart;
  const effectiveEnd = rule.effectiveUntil ?? rangeEnd;
  const upper = compareLocalDates(rangeEnd, effectiveEnd) > 0 ? effectiveEnd : rangeEnd;
  if (compareLocalDates(lower, upper) > 0) return [];
  const results: RecurringInstantWindow[] = [];
  for (let date = lower; compareLocalDates(date, upper) <= 0; date = addLocalDays(date, 1)) {
    if (!occursOn(date, rule.effectiveFrom, parsed)) continue;
    const endDate = rule.spansNextDay ? addLocalDays(date, 1) : date;
    try {
      const startAt = localDateTimeToInstant(
        { date, time: rule.startTimeLocal, timezone: rule.timezone },
        options.ambiguousTime,
      );
      const endAt = localDateTimeToInstant(
        { date: endDate, time: rule.endTimeLocal, timezone: rule.timezone },
        options.ambiguousTime,
      );
      results.push({ ...createInterval(startAt, endAt), localDate: date, timezone: rule.timezone });
    } catch (error) {
      if (error instanceof NonexistentLocalTimeError && options.nonexistentTime !== "REJECT")
        continue;
      throw error;
    }
  }
  return results;
}
