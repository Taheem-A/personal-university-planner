import { z } from "zod";
import { ApplicationError } from "./errors";

export const idSchema = z.string().trim().min(1).max(191);
export const textSchema = z.string().trim().min(1).max(500);
export const calendarDateSchema = z.iso.date();
export const instantSchema = z.iso.datetime({ offset: true });
export const timezoneSchema = z.string().refine((zone) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}, "Invalid IANA timezone");
export const positiveMinutesSchema = z.number().int().positive();
export const nonnegativeMinutesSchema = z.number().int().nonnegative();
export const percentageSchema = z.number().min(0).max(100);
export const weightSchema = z.number().min(0).max(1);
export const expectedVersionSchema = z.number().int().nonnegative();
export const archiveSchema = z.object({ id: idSchema, expectedVersion: expectedVersionSchema });
export const sessionLengthsSchema = z
  .object({
    minimumSessionMinutes: positiveMinutesSchema,
    preferredSessionMinutes: positiveMinutesSchema,
    maximumSessionMinutes: positiveMinutesSchema,
  })
  .refine(
    (v) =>
      v.minimumSessionMinutes <= v.preferredSessionMinutes &&
      v.preferredSessionMinutes <= v.maximumSessionMinutes,
    "Session lengths must satisfy minimum ≤ preferred ≤ maximum",
  );

export function validateInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ApplicationError("VALIDATION_ERROR", "Invalid input.");
  return parsed.data;
}

export function validateOrderedInstants(startAt: Date, endAt: Date): void {
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt >= endAt)
    throw new ApplicationError("VALIDATION_ERROR", "End must follow start.");
}

export function validateCompletionDeadline(preferred: Date | null, hard: Date | null): void {
  if (preferred && hard && preferred > hard)
    throw new ApplicationError(
      "VALIDATION_ERROR",
      "Preferred completion must precede the hard deadline.",
    );
}
