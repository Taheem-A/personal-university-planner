const dateOnlyFields = new Set(["startDate", "endDate", "effectiveFrom", "effectiveUntil"]);
const localTimeFields = new Set([
  "defaultDayStart",
  "defaultDayEnd",
  "startTimeLocal",
  "endTimeLocal",
  "anchorTimeLocal",
]);

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function mapValue(value: unknown): unknown {
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(mapValue);
  if (value && typeof value === "object") {
    const decimal = value as { toNumber?: () => number };
    if (typeof decimal.toNumber === "function") return decimal.toNumber();
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        mapValue(nested),
      ]),
    );
  }
  return value;
}

export function toPlainRecord<T>(row: unknown): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (value instanceof Date && dateOnlyFields.has(key)) {
      result[key] = value.toISOString().slice(0, 10);
    } else if (value instanceof Date && localTimeFields.has(key)) {
      result[key] = `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(
        value.getUTCSeconds(),
      )}`;
    } else {
      result[key] = mapValue(value);
    }
  }
  return result as T;
}

export function toPersistenceData(record: object): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && dateOnlyFields.has(key)) {
      result[key] = new Date(`${value}T00:00:00.000Z`);
    } else if (typeof value === "string" && localTimeFields.has(key)) {
      result[key] = new Date(`1970-01-01T${value.length === 5 ? `${value}:00` : value}.000Z`);
    } else {
      result[key] = mapValue(value);
    }
  }
  return result;
}
