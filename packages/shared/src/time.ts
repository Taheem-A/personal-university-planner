export const MINUTE_MS = 60_000;

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / MINUTE_MS));
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

export function maxDate(...dates: Date[]): Date {
  if (dates.length === 0) throw new Error("maxDate requires at least one date");
  return dates.reduce((max, current) => current.getTime() > max.getTime() ? current : max);
}

export function minDate(...dates: Date[]): Date {
  if (dates.length === 0) throw new Error("minDate requires at least one date");
  return dates.reduce((min, current) => current.getTime() < min.getTime() ? current : min);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function roundUpToQuantum(minutes: number, quantum = 5): number {
  return Math.ceil(minutes / quantum) * quantum;
}

export function sortByStart<T extends { startAt: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
