import { z } from "zod";
import type {
  AssessmentRecord,
  CourseMeetingRecord,
  TaskRecord,
} from "@university-planner/database";
import {
  requireAssessment,
  requireCourse,
  requireTask,
  requireTaskRelationships,
} from "./authorization";
import { assertAcyclicDependency } from "./dependencies";
import { ApplicationError } from "./errors";
import {
  classifyPlanningFields,
  classifyTaskMutation,
  planAfterMutation,
} from "./planner-triggers";
import { auditNow, newRecordId, requireActive, requireUpdated, service } from "./service";
import {
  calendarDateSchema,
  expectedVersionSchema,
  idSchema,
  localRecurrenceSchema,
  localTimeSchema,
  manualProvenanceSchema,
  nullableDateSchema,
  nullableInstantSchema,
  nonnegativeMinutesSchema,
  parseInstant,
  positiveMinutesSchema,
  recurrenceSchema,
  textSchema,
  timezoneSchema,
  validateCompletionDeadline,
} from "./validation";

const id = z.object({ id: idSchema }).strict();
const listOf = z.object({ parentId: idSchema }).strict();
const versioned = z.object({ id: idSchema, expectedVersion: expectedVersionSchema }).strict();
const termFields = z.object({
  name: textSchema,
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
});
const termCreate = termFields.strict();
const termUpdate = termFields
  .partial()
  .extend({
    id: idSchema,
    expectedVersion: expectedVersionSchema,
    status: z.enum(["UPCOMING", "ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict();

export const academicTerms = {
  create(input: unknown) {
    return service(termCreate, input, async (data, actor, tx) => {
      if (data.startDate > data.endDate)
        throw new ApplicationError("VALIDATION_ERROR", "Term end precedes start.");
      return tx.repositories.academicTerms.create({
        id: newRecordId(),
        userId: actor.userId,
        version: 0,
        ...data,
        status: "UPCOMING",
        ...auditNow(),
      });
    });
  },
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) => {
      const term = await tx.repositories.academicTerms.getForUser(actor.userId, id);
      if (!term) throw new ApplicationError("NOT_FOUND", "Record not found.");
      return term;
    });
  },
  list() {
    return service(z.undefined(), undefined, async (_, actor, tx) =>
      tx.repositories.academicTerms.listForUser(actor.userId),
    );
  },
  update(input: unknown) {
    let wasArchived = false;
    return planAfterMutation(
      service(termUpdate, input, async ({ id, expectedVersion, ...patch }, actor, tx) => {
        const current = await tx.repositories.academicTerms.getForUser(actor.userId, id);
        if (!current) throw new ApplicationError("NOT_FOUND", "Record not found.");
        wasArchived = current.status === "ARCHIVED";
        if (current.status === "ARCHIVED")
          throw new ApplicationError("CONFLICT", "Archived term cannot be edited.");
        if ((patch.startDate ?? current.startDate) > (patch.endDate ?? current.endDate))
          throw new ApplicationError("VALIDATION_ERROR", "Term end precedes start.");
        return requireUpdated(
          await tx.repositories.academicTerms.updateIfCurrent(
            actor.userId,
            id,
            expectedVersion,
            patch,
          ),
        );
      }),
      (record) =>
        !wasArchived && record.status === "ARCHIVED"
          ? { trigger: { type: "TASK_UPDATED", entityType: "ACADEMIC_TERM", entityId: record.id } }
          : null,
    );
  },
  archive(input: unknown) {
    return planAfterMutation(
      service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
        const current = await tx.repositories.academicTerms.getForUser(actor.userId, id);
        if (!current) throw new ApplicationError("NOT_FOUND", "Record not found.");
        return requireUpdated(
          await tx.repositories.academicTerms.updateIfCurrent(actor.userId, id, expectedVersion, {
            status: "ARCHIVED",
          }),
        );
      }),
      (record) => ({
        trigger: { type: "TASK_UPDATED", entityType: "ACADEMIC_TERM", entityId: record.id },
      }),
    );
  },
};

const courseCreate = manualProvenanceSchema
  .extend({
    academicTermId: idSchema,
    code: textSchema.max(32),
    name: textSchema,
    section: textSchema.nullable().default(null),
    instructorName: textSchema.nullable().default(null),
    colorReference: textSchema.nullable().default(null),
    creditValue: z.number().nonnegative().nullable().default(null),
    defaultTaskEnergy: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable().default(null),
    defaultTaskLocation: z.array(textSchema).default([]),
  })
  .strict();
const coursePatch = courseCreate
  .omit({ academicTermId: true, source: true, sourceAuthority: true, sourceConfidence: true })
  .partial()
  .extend({ id: idSchema, expectedVersion: expectedVersionSchema })
  .strict();

export const courses = {
  create(input: unknown) {
    return service(courseCreate, input, async (data, actor, tx) => {
      const term = await tx.repositories.academicTerms.getForUser(
        actor.userId,
        data.academicTermId,
      );
      if (!term || term.status === "ARCHIVED")
        throw new ApplicationError("NOT_FOUND", "Record not found.");
      return tx.repositories.courses.create({
        id: newRecordId(),
        userId: actor.userId,
        version: 0,
        ...data,
        archivedAt: null,
        ...auditNow(),
      });
    });
  },
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) =>
      requireCourse(tx.repositories, actor, id),
    );
  },
  list(input: unknown) {
    return service(listOf, input, async ({ parentId }, actor, tx) => {
      const term = await tx.repositories.academicTerms.getForUser(actor.userId, parentId);
      if (!term) throw new ApplicationError("NOT_FOUND", "Record not found.");
      return tx.repositories.courses.listForTerm(actor.userId, parentId);
    });
  },
  update(input: unknown) {
    let previousEnergy: string | null = null;
    return planAfterMutation(
      service(coursePatch, input, async ({ id, expectedVersion, ...patch }, actor, tx) => {
        previousEnergy = (await requireCourse(tx.repositories, actor, id)).defaultTaskEnergy;
        return requireUpdated(
          await tx.repositories.courses.updateIfCurrent(actor.userId, id, expectedVersion, patch),
        );
      }),
      (record) =>
        previousEnergy !== record.defaultTaskEnergy
          ? { trigger: { type: "TASK_UPDATED", entityType: "COURSE", entityId: record.id } }
          : null,
    );
  },
  archive(input: unknown) {
    return planAfterMutation(
      service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
        await requireCourse(tx.repositories, actor, id);
        return requireUpdated(
          await tx.repositories.courses.updateIfCurrent(actor.userId, id, expectedVersion, {
            archivedAt: new Date(),
          }),
        );
      }),
      (record) => ({
        trigger: { type: "TASK_UPDATED", entityType: "COURSE", entityId: record.id },
      }),
    );
  },
};

const meetingCreate = localRecurrenceSchema
  .safeExtend({
    courseId: idSchema,
    meetingType: z.enum(["LECTURE", "TUTORIAL", "PRACTICAL", "LAB", "SEMINAR", "OTHER"]),
    location: textSchema.nullable().default(null),
    attendanceRequired: z.boolean().default(true),
  })
  .strict();
const meetingPatch = z
  .object({
    recurrenceRule: recurrenceSchema,
    startTimeLocal: localTimeSchema,
    endTimeLocal: localTimeSchema,
    spansNextDay: z.boolean(),
    timezone: timezoneSchema,
    effectiveFrom: calendarDateSchema,
    effectiveUntil: nullableDateSchema,
    meetingType: z.enum(["LECTURE", "TUTORIAL", "PRACTICAL", "LAB", "SEMINAR", "OTHER"]),
    location: textSchema.nullable(),
    attendanceRequired: z.boolean(),
  })
  .partial()
  .extend({ id: idSchema, expectedVersion: expectedVersionSchema })
  .strict();

export const courseMeetings = {
  create(input: unknown) {
    return planAfterMutation(
      service(meetingCreate, input, async (data, actor, tx) => {
        await requireCourse(tx.repositories, actor, data.courseId);
        return tx.repositories.courseMeetings.create({
          id: newRecordId(),
          userId: actor.userId,
          version: 0,
          ...data,
          archivedAt: null,
          ...auditNow(),
        });
      }),
      (record) => classifyPlanningFields(null, record, [], "COURSE_MEETING"),
    );
  },
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) => {
      const meeting = requireActive(
        await tx.repositories.courseMeetings.getForUser(actor.userId, id),
      );
      await requireCourse(tx.repositories, actor, meeting.courseId);
      return meeting;
    });
  },
  list(input: unknown) {
    return service(listOf, input, async ({ parentId }, actor, tx) => {
      await requireCourse(tx.repositories, actor, parentId);
      return tx.repositories.courseMeetings.listForCourse(actor.userId, parentId);
    });
  },
  update(input: unknown) {
    let before: CourseMeetingRecord | null = null;
    return planAfterMutation(
      service(meetingPatch, input, async ({ id, expectedVersion, ...patch }, actor, tx) => {
        const current = requireActive(
          await tx.repositories.courseMeetings.getForUser(actor.userId, id),
        );
        before = { ...current };
        await requireCourse(tx.repositories, actor, current.courseId);
        if (!localRecurrenceSchema.safeParse({ ...current, ...patch }).success)
          throw new ApplicationError("VALIDATION_ERROR", "Invalid recurrence.");
        return requireUpdated(
          await tx.repositories.courseMeetings.updateIfCurrent(
            actor.userId,
            id,
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
            "recurrenceRule",
            "startTimeLocal",
            "endTimeLocal",
            "spansNextDay",
            "timezone",
            "effectiveFrom",
            "effectiveUntil",
            "attendanceRequired",
          ],
          "COURSE_MEETING",
        ),
    );
  },
  archive(input: unknown) {
    let before: CourseMeetingRecord | null = null;
    return planAfterMutation(
      service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
        before = {
          ...requireActive(await tx.repositories.courseMeetings.getForUser(actor.userId, id)),
        };
        return requireUpdated(
          await tx.repositories.courseMeetings.updateIfCurrent(actor.userId, id, expectedVersion, {
            archivedAt: new Date(),
          }),
        );
      }),
      (record) => classifyPlanningFields(before, record, ["archivedAt"], "COURSE_MEETING"),
    );
  },
};

const assessmentCreate = manualProvenanceSchema
  .extend({
    courseId: idSchema,
    title: textSchema,
    assessmentType: textSchema,
    releaseAt: nullableInstantSchema.default(null),
    dueAt: nullableInstantSchema.default(null),
    preferredCompletionAt: nullableInstantSchema.default(null),
    gradeWeight: z.number().min(0).max(100).nullable().default(null),
    gradeReceived: z.number().min(0).max(100).nullable().default(null),
    notes: z.string().nullable().default(null),
    instructionsUrl: z.url().nullable().default(null),
    submissionUrl: z.url().nullable().default(null),
  })
  .strict();
const assessmentPatch = assessmentCreate
  .omit({ courseId: true, source: true, sourceAuthority: true, sourceConfidence: true })
  .partial()
  .extend({
    id: idSchema,
    expectedVersion: expectedVersionSchema,
    submissionStatus: z
      .enum(["NOT_SUBMITTED", "SUBMITTED", "GRADED", "EXEMPT", "CANCELLED"])
      .optional(),
    submittedAt: nullableInstantSchema.optional(),
  })
  .strict();

function checkAssessment(data: {
  releaseAt: Date | null;
  dueAt: Date | null;
  preferredCompletionAt: Date | null;
  submissionStatus: AssessmentRecord["submissionStatus"];
  submittedAt: Date | null;
}) {
  if (data.releaseAt && data.dueAt && data.releaseAt > data.dueAt)
    throw new ApplicationError("VALIDATION_ERROR", "Release follows deadline.");
  validateCompletionDeadline(data.preferredCompletionAt, data.dueAt);
  if (
    (data.submissionStatus === "SUBMITTED" || data.submissionStatus === "GRADED") !==
    Boolean(data.submittedAt)
  )
    throw new ApplicationError("VALIDATION_ERROR", "Submission state and time disagree.");
}

export const assessments = {
  create(input: unknown) {
    return service(assessmentCreate, input, async (data, actor, tx) => {
      await requireCourse(tx.repositories, actor, data.courseId);
      const record: AssessmentRecord = {
        ...data,
        releaseAt: parseInstant(data.releaseAt),
        dueAt: parseInstant(data.dueAt),
        preferredCompletionAt: parseInstant(data.preferredCompletionAt),
        id: newRecordId(),
        version: 0,
        userId: actor.userId,
        submissionStatus: "NOT_SUBMITTED",
        submittedAt: null,
        archivedAt: null,
        ...auditNow(),
      };
      checkAssessment(record);
      return tx.repositories.assessments.create(record);
    });
  },
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) =>
      requireAssessment(tx.repositories, actor, id),
    );
  },
  list(input: unknown) {
    return service(listOf, input, async ({ parentId }, actor, tx) => {
      await requireCourse(tx.repositories, actor, parentId);
      return tx.repositories.assessments.listForCourse(actor.userId, parentId);
    });
  },
  update(input: unknown) {
    let before: AssessmentRecord | null = null;
    return planAfterMutation(
      service(assessmentPatch, input, async ({ id, expectedVersion, ...data }, actor, tx) => {
        const current = await requireAssessment(tx.repositories, actor, id);
        before = { ...current };
        const patch = {
          ...data,
          ...(data.releaseAt !== undefined ? { releaseAt: parseInstant(data.releaseAt) } : {}),
          ...(data.dueAt !== undefined ? { dueAt: parseInstant(data.dueAt) } : {}),
          ...(data.preferredCompletionAt !== undefined
            ? { preferredCompletionAt: parseInstant(data.preferredCompletionAt) }
            : {}),
          ...(data.submittedAt !== undefined
            ? { submittedAt: parseInstant(data.submittedAt) }
            : {}),
        } as Parameters<typeof tx.repositories.assessments.updateIfCurrent>[3];
        checkAssessment({ ...current, ...patch });
        return requireUpdated(
          await tx.repositories.assessments.updateIfCurrent(
            actor.userId,
            id,
            expectedVersion,
            patch,
          ),
        );
      }),
      (record) =>
        before?.dueAt?.getTime() !== record.dueAt?.getTime()
          ? { trigger: { type: "DEADLINE_CHANGED", entityType: "ASSESSMENT", entityId: record.id } }
          : classifyPlanningFields(
              before,
              record,
              ["releaseAt", "preferredCompletionAt", "archivedAt"],
              "ASSESSMENT",
              "TASK_UPDATED",
            ),
    );
  },
  archive(input: unknown) {
    let before: AssessmentRecord | null = null;
    return planAfterMutation(
      service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
        before = { ...(await requireAssessment(tx.repositories, actor, id)) };
        return requireUpdated(
          await tx.repositories.assessments.updateIfCurrent(actor.userId, id, expectedVersion, {
            archivedAt: new Date(),
          }),
        );
      }),
      (record) =>
        classifyPlanningFields(before, record, ["archivedAt"], "ASSESSMENT", "TASK_UPDATED"),
    );
  },
};

const taskCreate = manualProvenanceSchema
  .extend({
    title: textSchema,
    description: z.string().nullable().default(null),
    courseId: idSchema.nullable().default(null),
    assessmentId: idSchema.nullable().default(null),
    parentTaskId: idSchema.nullable().default(null),
    status: z
      .enum(["INBOX", "READY", "IN_PROGRESS", "BLOCKED", "CANCELLED", "DEFERRED"])
      .default("INBOX"),
    dueAt: nullableInstantSchema.default(null),
    preferredCompletionAt: nullableInstantSchema.default(null),
    availableFrom: nullableInstantSchema.default(null),
    originalEstimatedMinutes: positiveMinutesSchema.nullable().default(null),
    currentEstimatedMinutes: positiveMinutesSchema.nullable().default(null),
    remainingMinutes: nonnegativeMinutesSchema.nullable().default(null),
    minimumSessionMinutes: positiveMinutesSchema.nullable().default(null),
    preferredSessionMinutes: positiveMinutesSchema.nullable().default(null),
    maximumSessionMinutes: positiveMinutesSchema.nullable().default(null),
    energyRequirement: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable().default(null),
    locationRequirements: z.array(textSchema).default([]),
    priorityOverride: z.number().min(0).max(1).nullable().default(null),
    splittable: z.boolean().default(true),
    interruptible: z.boolean().default(true),
    planningMode: z.enum(["AUTO", "MANUAL", "UNSCHEDULED"]).default("AUTO"),
  })
  .strict();
const taskPatch = taskCreate
  .omit({
    source: true,
    sourceAuthority: true,
    sourceConfidence: true,
    originalEstimatedMinutes: true,
  })
  .partial()
  .extend({ id: idSchema, expectedVersion: expectedVersionSchema })
  .strict();

function checkTask(
  task: Pick<
    TaskRecord,
    | "availableFrom"
    | "dueAt"
    | "preferredCompletionAt"
    | "currentEstimatedMinutes"
    | "remainingMinutes"
    | "minimumSessionMinutes"
    | "preferredSessionMinutes"
    | "maximumSessionMinutes"
  >,
) {
  if (task.availableFrom && task.dueAt && task.availableFrom > task.dueAt)
    throw new ApplicationError("VALIDATION_ERROR", "Task availability follows its deadline.");
  validateCompletionDeadline(task.preferredCompletionAt, task.dueAt);
  if (
    task.currentEstimatedMinutes !== null &&
    task.remainingMinutes !== null &&
    task.remainingMinutes > task.currentEstimatedMinutes
  )
    throw new ApplicationError("VALIDATION_ERROR", "Remaining work exceeds the current estimate.");
  const {
    minimumSessionMinutes: min,
    preferredSessionMinutes: pref,
    maximumSessionMinutes: max,
  } = task;
  if (
    (min !== null && pref !== null && min > pref) ||
    (pref !== null && max !== null && pref > max) ||
    (min !== null && max !== null && min > max)
  )
    throw new ApplicationError("VALIDATION_ERROR", "Task session lengths are inconsistent.");
}

function taskInstantPatch(data: Record<string, unknown>) {
  return {
    ...data,
    ...(data.dueAt !== undefined ? { dueAt: parseInstant(data.dueAt as string | null) } : {}),
    ...(data.availableFrom !== undefined
      ? { availableFrom: parseInstant(data.availableFrom as string | null) }
      : {}),
    ...(data.preferredCompletionAt !== undefined
      ? { preferredCompletionAt: parseInstant(data.preferredCompletionAt as string | null) }
      : {}),
  };
}

export const tasks = {
  create(input: unknown) {
    return planAfterMutation(
      service(taskCreate, input, async (data, actor, tx) => {
        await requireTaskRelationships(tx.repositories, actor, data);
        if (data.parentTaskId) await tx.locks.userGraph(actor.userId);
        const record: TaskRecord = {
          ...data,
          id: newRecordId(),
          version: 0,
          userId: actor.userId,
          recurringWorkRuleId: null,
          availableFrom: parseInstant(data.availableFrom),
          dueAt: parseInstant(data.dueAt),
          preferredCompletionAt: parseInstant(data.preferredCompletionAt),
          originalEstimatedMinutes: data.originalEstimatedMinutes,
          currentEstimatedMinutes: data.currentEstimatedMinutes ?? data.originalEstimatedMinutes,
          remainingMinutes:
            data.remainingMinutes ?? data.currentEstimatedMinutes ?? data.originalEstimatedMinutes,
          completedAt: null,
          archivedAt: null,
          ...auditNow(),
        };
        checkTask(record);
        return tx.repositories.tasks.create(record);
      }),
      (record) => classifyTaskMutation(null, record),
    );
  },
  get(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) => requireTask(tx.repositories, actor, id));
  },
  list(input: unknown = {}) {
    return service(
      z
        .object({
          statuses: z
            .array(
              z.enum([
                "INBOX",
                "READY",
                "IN_PROGRESS",
                "BLOCKED",
                "COMPLETED",
                "CANCELLED",
                "DEFERRED",
              ]),
            )
            .optional(),
        })
        .strict(),
      input,
      async ({ statuses }, actor, tx) => tx.repositories.tasks.listForUser(actor.userId, statuses),
    );
  },
  subtasks(input: unknown) {
    return service(listOf, input, async ({ parentId }, actor, tx) => {
      await requireTask(tx.repositories, actor, parentId);
      return tx.repositories.tasks.listSubtasks(actor.userId, parentId);
    });
  },
  update(input: unknown) {
    let before: TaskRecord | null = null;
    return planAfterMutation(
      service(taskPatch, input, async ({ id, expectedVersion, ...data }, actor, tx) => {
        if (data.parentTaskId !== undefined) await tx.locks.userGraph(actor.userId);
        const current = await requireTask(tx.repositories, actor, id);
        before = { ...current };
        await requireTaskRelationships(tx.repositories, actor, {
          courseId: data.courseId === undefined ? current.courseId : data.courseId,
          assessmentId: data.assessmentId === undefined ? current.assessmentId : data.assessmentId,
          parentTaskId: data.parentTaskId === undefined ? current.parentTaskId : data.parentTaskId,
        });
        if (data.parentTaskId) {
          let ancestor: string | null = data.parentTaskId;
          const visited = new Set<string>();
          while (ancestor) {
            if (ancestor === id || visited.has(ancestor))
              throw new ApplicationError("CONFLICT", "Task parent would create a cycle.");
            visited.add(ancestor);
            ancestor = (await requireTask(tx.repositories, actor, ancestor)).parentTaskId;
          }
        }
        const patch = taskInstantPatch(data);
        checkTask({ ...current, ...patch } as TaskRecord);
        return requireUpdated(
          await tx.repositories.tasks.updateIfCurrent(
            actor.userId,
            id,
            expectedVersion,
            patch as Parameters<typeof tx.repositories.tasks.updateIfCurrent>[3],
          ),
        );
      }),
      (record) => classifyTaskMutation(before, record),
    );
  },
  archive(input: unknown) {
    let before: TaskRecord | null = null;
    return planAfterMutation(
      service(versioned, input, async ({ id, expectedVersion }, actor, tx) => {
        before = { ...(await requireTask(tx.repositories, actor, id)) };
        return requireUpdated(
          await tx.repositories.tasks.updateIfCurrent(actor.userId, id, expectedVersion, {
            archivedAt: new Date(),
          }),
        );
      }),
      (record) => classifyTaskMutation(before, record),
    );
  },
};

const edge = z
  .object({
    prerequisiteTaskId: idSchema,
    dependentTaskId: idSchema,
    expectedDependentVersion: expectedVersionSchema,
  })
  .strict();
export const taskDependencies = {
  list(input: unknown) {
    return service(id, input, async ({ id }, actor, tx) => {
      await requireTask(tx.repositories, actor, id);
      return tx.repositories.taskDependencies.listForTask(actor.userId, id);
    });
  },
  add(input: unknown) {
    return planAfterMutation(
      service(edge, input, async (data, actor, tx) => {
        await tx.locks.userGraph(actor.userId);
        await requireTask(tx.repositories, actor, data.prerequisiteTaskId);
        await requireTask(tx.repositories, actor, data.dependentTaskId);
        const existing = await tx.repositories.taskDependencies.listForUser(actor.userId);
        assertAcyclicDependency(existing, data);
        const dependent = requireUpdated(
          await tx.repositories.tasks.updateIfCurrent(
            actor.userId,
            data.dependentTaskId,
            data.expectedDependentVersion,
            {},
          ),
        );
        const created = await tx.repositories.taskDependencies.add({
          userId: actor.userId,
          prerequisiteTaskId: data.prerequisiteTaskId,
          dependentTaskId: data.dependentTaskId,
          dependencyType: "FINISH_TO_START",
          createdAt: new Date(),
        });
        return { dependency: created, dependentVersion: dependent.version };
      }),
      (result) => ({
        trigger: {
          type: "TASK_UPDATED",
          entityType: "TASK",
          entityId: result.dependency.dependentTaskId,
        },
      }),
    );
  },
  remove(input: unknown) {
    return planAfterMutation(
      service(edge, input, async (data, actor, tx) => {
        await tx.locks.userGraph(actor.userId);
        await requireTask(tx.repositories, actor, data.prerequisiteTaskId);
        await requireTask(tx.repositories, actor, data.dependentTaskId);
        const edges = await tx.repositories.taskDependencies.listForTask(
          actor.userId,
          data.dependentTaskId,
        );
        if (
          !edges.some(
            (item) =>
              item.prerequisiteTaskId === data.prerequisiteTaskId &&
              item.dependentTaskId === data.dependentTaskId,
          )
        )
          throw new ApplicationError("NOT_FOUND", "Record not found.");
        await tx.repositories.taskDependencies.remove(
          actor.userId,
          data.prerequisiteTaskId,
          data.dependentTaskId,
        );
        return requireUpdated(
          await tx.repositories.tasks.updateIfCurrent(
            actor.userId,
            data.dependentTaskId,
            data.expectedDependentVersion,
            {},
          ),
        );
      }),
      (record) => ({ trigger: { type: "TASK_UPDATED", entityType: "TASK", entityId: record.id } }),
    );
  },
};
