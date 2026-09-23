import { z } from "zod";
import { expandRecurringWindows } from "@university-planner/shared";
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
export const localTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/);
export const nullableInstantSchema = instantSchema.nullable();
export const nullableDateSchema = calendarDateSchema.nullable();
export const provenanceSchema = z.object({
  source: z.enum(["MANUAL", "INTEGRATION", "ASSISTANT", "SYSTEM"]).default("MANUAL"),
  sourceAuthority: z.enum(["USER", "EXTERNAL", "SYSTEM", "INFERRED"]).default("USER"),
  sourceConfidence: z
    .enum([
      "DIRECT_API",
      "CALENDAR_FEED",
      "DOCUMENT_EXTRACTION",
      "AI_EXTRACTED",
      "MANUAL",
      "USER_CONFIRMED",
    ])
    .nullable()
    .default(null),
});
/** Ordinary academic edits cannot claim system or external-provider provenance. */
export const manualProvenanceSchema = z.object({
  source: z.literal("MANUAL").default("MANUAL"),
  sourceAuthority: z.literal("USER").default("USER"),
  sourceConfidence: z.literal("MANUAL").nullable().default(null),
});
export const recurrenceSchema = z.string().refine((value) => {
  try {
    expandRecurringWindows(
      {
        recurrenceRule: value,
        startTimeLocal: "12:00:00",
        endTimeLocal: "13:00:00",
        spansNextDay: false,
        timezone: "America/Toronto",
        effectiveFrom: "2026-01-01",
      },
      "2026-01-01",
      "2026-01-01",
    );
    return true;
  } catch {
    return false;
  }
}, "Unsupported recurrence rule");
export const localRecurrenceSchema = z
  .object({
    recurrenceRule: recurrenceSchema,
    startTimeLocal: localTimeSchema,
    endTimeLocal: localTimeSchema,
    spansNextDay: z.boolean().default(false),
    timezone: timezoneSchema,
    effectiveFrom: calendarDateSchema,
    effectiveUntil: nullableDateSchema.default(null),
  })
  .refine(
    (v) => !v.effectiveUntil || v.effectiveFrom <= v.effectiveUntil,
    "Effective end precedes start",
  )
  .refine(
    (v) => v.spansNextDay || v.startTimeLocal < v.endTimeLocal,
    "Local end must follow start",
  );

export function parseInstant(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
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
