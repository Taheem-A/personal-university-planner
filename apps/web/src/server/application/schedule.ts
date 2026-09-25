import { z } from "zod";
import type {
  AvailabilityRuleRecord,
  CalendarEventRecord,
  PlanningPreferenceRecord,
  ProtectedTimeRuleRecord,
} from "@university-planner/database";
import { requireCourse } from "./authorization";
import { ApplicationError } from "./errors";
import {
  classifyCalendarMutation,
  classifyPlanningFields,
  planAfterMutation,
} from "./planner-triggers";
import { auditNow, newRecordId, requireActive, requireUpdated, service } from "./service";
import {
  expectedVersionSchema,
  idSchema,
  instantSchema,
  localRecurrenceSchema,
  manualProvenanceSchema,
  nonnegativeMinutesSchema,
  parseInstant,
  positiveMinutesSchema,
  textSchema,
  validateOrderedInstants,
} from "./validation";

const id = z.object({ id: idSchema }).strict();
const versioned = z.object({ id: idSchema, expectedVersion: expectedVersionSchema }).strict();
const constraint = z.enum(["HARD", "SOFT", "INFORMATIONAL"]);
const calendarFields = z.object({
  title: textSchema,
  eventType: textSchema,
  startAt: instantSchema,
  endAt: instantSchema,
  location: textSchema.nullable(),
  constraintLevel: constraint,
  courseId: idSchema.nullable(),
});
const calendarCreate = manualProvenanceSchema
  .extend({
    title: textSchema,
    eventType: textSchema,
    startAt: instantSchema,
    endAt: instantSchema,
    location: textSchema.nullable().default(null),
    constraintLevel: constraint,
    courseId: idSchema.nullable().default(null),
  })
  .strict();
const calendarPatch = calendarFields
  .partial()
  .extend({ id: idSchema, expectedVersion: expectedVersionSchema })
  .strict();
function eventDates(value: { startAt: Date; endAt: Date }) {
  validateOrderedInstants(value.startAt, value.endAt);
}

export const calendarEvents = {
  create(input: unknown) {
    return planAfterMutation(
      service(calendarCreate, input, async (data, actor, tx) => {
        if (data.courseId) await requireCourse(tx.repositories, actor, data.courseId);
        const startAt = parseInstant(data.startAt)!,
          endAt = parseInstant(data.endAt)!;
        eventDates({ startAt, endAt });
        return tx.repositories.calendarEvents.create({
          ...data,
          id: newRecordId(),
          userId: actor.userId,
          version: 0,
          startAt,
          endAt,
          integrationAccountId: null,
          externalId: null,
          externalUpdatedAt: null,
          archivedAt: null,
          ...auditNow(),
        });
      }),
      (record) => classifyCalendarMutation(null, record),
    );
  },
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) =>
      requireActive(await tx.repositories.calendarEvents.getForUser(actor.userId, id)),
    );
  },
  list(input: unknown) {
    return service(
      z.object({ startAt: instantSchema, endAt: instantSchema }).strict(),
      input,
      async (range, actor, tx) => {
        const startAt = parseInstant(range.startAt)!,
          endAt = parseInstant(range.endAt)!;
        eventDates({ startAt, endAt });
        return tx.repositories.calendarEvents.listForRange(actor.userId, startAt, endAt);
      },
    );
  },
  update(input: unknown) {
    let before: CalendarEventRecord | null = null;
    return planAfterMutation(
      service(calendarPatch, input, async ({ id, expectedVersion, ...data }, actor, tx) => {
        const current = requireActive(
          await tx.repositories.calendarEvents.getForUser(actor.userId, id),
        );
        before = { ...current };
        if (data.courseId) await requireCourse(tx.repositories, actor, data.courseId);
        const { startAt, endAt, ...fields } = data;
        const patch = {
          ...fields,
          ...(startAt !== undefined ? { startAt: parseInstant(startAt)! } : {}),
          ...(endAt !== undefined ? { endAt: parseInstant(endAt)! } : {}),
        };
        eventDates({ ...current, ...patch });
        return requireUpdated(
          await tx.repositories.calendarEvents.updateIfCurrent(
            actor.userId,
            id,
            expectedVersion,
            patch,
          ),
        );
      }),
      (record) => classifyCalendarMutation(before, record),
    );
  },
  archive(input: unknown) {
    let before: CalendarEventRecord | null = null;
    return planAfterMutation(
      service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
        before = {
          ...requireActive(await tx.repositories.calendarEvents.getForUser(actor.userId, id)),
        };
        return requireUpdated(
          await tx.repositories.calendarEvents.updateIfCurrent(actor.userId, id, expectedVersion, {
            archivedAt: new Date(),
          }),
        );
      }),
      (record) => classifyCalendarMutation(before, record),
    );
  },
};

const availabilityFields = z.object({
  ...localRecurrenceSchema.shape,
  capacityFactor: z.number().min(0).max(1),
  energyLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  allowedLocationTags: z.array(textSchema),
  active: z.boolean(),
});
const availabilityCreate = localRecurrenceSchema
  .safeExtend({
    capacityFactor: z.number().min(0).max(1),
    energyLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
    allowedLocationTags: z.array(textSchema).default([]),
    active: z.boolean().default(true),
  })
  .strict();
const availabilityPatch = availabilityFields
  .partial()
  .extend({ id: idSchema, expectedVersion: expectedVersionSchema })
  .strict();

export const availabilityRules = {
  create(input: unknown) {
    return planAfterMutation(
      service(availabilityCreate, input, async (data, actor, tx) =>
        tx.repositories.availabilityRules.create({
          ...data,
          id: newRecordId(),
          userId: actor.userId,
          version: 0,
          ...auditNow(),
        }),
      ),
      (record) =>
        record.active ? classifyPlanningFields(null, record, [], "AVAILABILITY_RULE") : null,
    );
  },
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) => {
      const row = await tx.repositories.availabilityRules.getForUser(actor.userId, id);
      if (!row) throw new ApplicationError("NOT_FOUND", "Record not found.");
      return row;
    });
  },
  list() {
    return service(z.undefined(), undefined, async (_, actor, tx) =>
      tx.repositories.availabilityRules.listActive(actor.userId),
    );
  },
  update(input: unknown) {
    let before: AvailabilityRuleRecord | null = null;
    return planAfterMutation(
      service(availabilityPatch, input, async ({ id, expectedVersion, ...patch }, actor, tx) => {
        const current = await tx.repositories.availabilityRules.getForUser(actor.userId, id);
        if (!current) throw new ApplicationError("NOT_FOUND", "Record not found.");
        before = { ...current };
        if (!localRecurrenceSchema.safeParse({ ...current, ...patch }).success)
          throw new ApplicationError("VALIDATION_ERROR", "Invalid recurrence.");
        return requireUpdated(
          await tx.repositories.availabilityRules.updateIfCurrent(
            actor.userId,
            id,
            expectedVersion,
            patch,
          ),
        );
      }),
      (record) =>
        before?.active || record.active
          ? classifyPlanningFields(
              before,
              record,
              [
                "recurrenceRule",
                "startTimeLocal",
                "endTimeLocal",
                "spansNextDay",
                "timezone",
                "effectiveFrom",
                "effectiveUntil",
                "capacityFactor",
                "energyLevel",
                "allowedLocationTags",
                "active",
              ],
              "AVAILABILITY_RULE",
            )
          : null,
    );
  },
  deactivate(input: unknown) {
    let before: AvailabilityRuleRecord | null = null;
    return planAfterMutation(
      service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
        before = await tx.repositories.availabilityRules.getForUser(actor.userId, id);
        return requireUpdated(
          await tx.repositories.availabilityRules.updateIfCurrent(
            actor.userId,
            id,
            expectedVersion,
            {
              active: false,
            },
          ),
        );
      }),
      (record) =>
        before?.active
          ? classifyPlanningFields(before, record, ["active"], "AVAILABILITY_RULE")
          : null,
    );
  },
};

const protectionFields = z.object({
  ...localRecurrenceSchema.shape,
  protectionLevel: constraint,
  reason: textSchema,
  isSleep: z.boolean(),
  active: z.boolean(),
});
const protectionCreate = localRecurrenceSchema
  .safeExtend({
    protectionLevel: constraint,
    reason: textSchema,
    isSleep: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .strict();
const protectionPatch = protectionFields
  .partial()
  .extend({ id: idSchema, expectedVersion: expectedVersionSchema })
  .strict();
export const protectedTimeRules = {
  create(input: unknown) {
    return planAfterMutation(
      service(protectionCreate, input, async (data, actor, tx) => {
        if (data.isSleep && data.protectionLevel !== "HARD")
          throw new ApplicationError("VALIDATION_ERROR", "Sleep must be hard protected time.");
        return tx.repositories.protectedTimeRules.create({
          ...data,
          id: newRecordId(),
          userId: actor.userId,
          version: 0,
          ...auditNow(),
        });
      }),
      (record) =>
        record.active && record.protectionLevel !== "INFORMATIONAL"
          ? classifyPlanningFields(null, record, [], "PROTECTED_TIME_RULE")
          : null,
    );
  },
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) => {
      const row = await tx.repositories.protectedTimeRules.getForUser(actor.userId, id);
      if (!row) throw new ApplicationError("NOT_FOUND", "Record not found.");
      return row;
    });
  },
  list() {
    return service(z.undefined(), undefined, async (_, actor, tx) =>
      tx.repositories.protectedTimeRules.listActive(actor.userId),
    );
  },
  update(input: unknown) {
    let before: ProtectedTimeRuleRecord | null = null;
    return planAfterMutation(
      service(protectionPatch, input, async ({ id, expectedVersion, ...patch }, actor, tx) => {
        const current = await tx.repositories.protectedTimeRules.getForUser(actor.userId, id);
        if (!current) throw new ApplicationError("NOT_FOUND", "Record not found.");
        before = { ...current };
        if (!localRecurrenceSchema.safeParse({ ...current, ...patch }).success)
          throw new ApplicationError("VALIDATION_ERROR", "Invalid recurrence.");
        if (
          (patch.isSleep ?? current.isSleep) &&
          (patch.protectionLevel ?? current.protectionLevel) !== "HARD"
        )
          throw new ApplicationError("VALIDATION_ERROR", "Sleep must be hard protected time.");
        return requireUpdated(
          await tx.repositories.protectedTimeRules.updateIfCurrent(
            actor.userId,
            id,
            expectedVersion,
            patch,
          ),
        );
      }),
      (record) =>
        (before?.active && before.protectionLevel !== "INFORMATIONAL") ||
        (record.active && record.protectionLevel !== "INFORMATIONAL")
          ? classifyPlanningFields(
              before,
              record,
              [
                "recurrenceRule",
                "startTimeLocal",
                "endTimeLocal",
                "spansNextDay",
                "timezone",
                "effectiveFrom",
                "effectiveUntil",
                "protectionLevel",
                "isSleep",
                "active",
              ],
              "PROTECTED_TIME_RULE",
            )
          : null,
    );
  },
  deactivate(input: unknown) {
    let before: ProtectedTimeRuleRecord | null = null;
    return planAfterMutation(
      service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
        before = await tx.repositories.protectedTimeRules.getForUser(actor.userId, id);
        return requireUpdated(
          await tx.repositories.protectedTimeRules.updateIfCurrent(
            actor.userId,
            id,
            expectedVersion,
            { active: false },
          ),
        );
      }),
      (record) =>
        before?.active && before.protectionLevel !== "INFORMATIONAL"
          ? classifyPlanningFields(before, record, ["active"], "PROTECTED_TIME_RULE")
          : null,
    );
  },
};

const preferenceFields = z.object({
  preferredDailyStudyLimitMinutes: nonnegativeMinutesSchema,
  minimumFreeTimeMinutes: nonnegativeMinutesSchema,
  preferredDeadlineBufferHours: z.number().int().nonnegative(),
  avoidLateHighEnergyTasks: z.boolean(),
  maximumConsecutiveWorkMinutes: positiveMinutesSchema,
  minimumBreakMinutes: nonnegativeMinutesSchema,
  scheduleCommuteWork: z.boolean(),
  weekendWorkBias: z.number().min(-1).max(1),
  planStabilityWindowMinutes: nonnegativeMinutesSchema,
  minimumSleepMinutes: positiveMinutesSchema.nullable(),
});
const preferencePatch = preferenceFields
  .partial()
  .extend({ expectedVersion: expectedVersionSchema })
  .strict();
export const planningPreferences = {
  get() {
    return service(z.undefined(), undefined, async (_, actor, tx) =>
      tx.repositories.planningPreferences.getForUser(actor.userId),
    );
  },
  create(input: unknown) {
    return planAfterMutation(
      service(
        preferenceFields
          .extend({ minimumSleepMinutes: positiveMinutesSchema.nullable().default(null) })
          .strict(),
        input,
        async (data, actor, tx) => {
          if (await tx.repositories.planningPreferences.getForUser(actor.userId))
            throw new ApplicationError("CONFLICT", "Preferences already exist.");
          return tx.repositories.planningPreferences.create({
            ...data,
            id: newRecordId(),
            userId: actor.userId,
            version: 0,
            ...auditNow(),
          });
        },
      ),
      (record) => classifyPlanningFields(null, record, [], "PLANNING_PREFERENCE"),
    );
  },
  update(input: unknown) {
    let before: PlanningPreferenceRecord | null = null;
    return planAfterMutation(
      service(preferencePatch, input, async ({ expectedVersion, ...patch }, actor, tx) => {
        const current = await tx.repositories.planningPreferences.getForUser(actor.userId);
        if (!current) throw new ApplicationError("NOT_FOUND", "Preferences not provisioned.");
        before = { ...current };
        return requireUpdated(
          await tx.repositories.planningPreferences.updateIfCurrent(
            actor.userId,
            expectedVersion,
            patch,
          ),
        );
      }),
      (record) =>
        classifyPlanningFields(
          before,
          record,
          [
            "preferredDailyStudyLimitMinutes",
            "minimumFreeTimeMinutes",
            "preferredDeadlineBufferHours",
            "avoidLateHighEnergyTasks",
            "maximumConsecutiveWorkMinutes",
            "minimumBreakMinutes",
            "scheduleCommuteWork",
            "weekendWorkBias",
            "planStabilityWindowMinutes",
            "minimumSleepMinutes",
          ],
          "PLANNING_PREFERENCE",
        ),
    );
  },
};
