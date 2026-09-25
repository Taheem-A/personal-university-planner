import type {
  CalendarEventRecord,
  TaskRecord,
  TransactionContext,
} from "@university-planner/database";
import { applicationDatabase } from "../database";
import { requireActor } from "./authorization";
import { resultOf, type ApplicationResult } from "./errors";
import {
  generateAuthoritativePlan,
  type PlannerRequest,
  type PlannerServiceResult,
  type PlannerTriggerContext,
} from "./planner";

export interface ReplanIntent {
  trigger: PlannerTriggerContext;
  mode?: "INCREMENTAL" | "FULL";
  releasedTimePolicy?: PlannerRequest["releasedTimePolicy"];
}

/** Explicit service clock; every trigger in a batch uses the same supplied instant. */
export function requestForReplan(intent: ReplanIntent, now: Date): PlannerRequest {
  return intent.mode === "FULL"
    ? {
        operation: "FULL_REPLAN",
        mode: "FULL",
        trigger: intent.trigger,
        now,
        plannerVersion: "heuristic-v1",
        releasedTimePolicy: intent.releasedTimePolicy ?? "REPLAN_IF_USEFUL",
      }
    : {
        operation: "INCREMENTAL_REPLAN",
        mode: "INCREMENTAL",
        trigger: intent.trigger,
        now,
        plannerVersion: "heuristic-v1",
        releasedTimePolicy: intent.releasedTimePolicy ?? "REPLAN_IF_USEFUL",
      };
}

function changed(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() !== b.getTime();
  return JSON.stringify(a) !== JSON.stringify(b);
}

const taskSchedulingFields: (keyof TaskRecord)[] = [
  "status",
  "planningMode",
  "archivedAt",
  "courseId",
  "assessmentId",
  "availableFrom",
  "preferredCompletionAt",
  "currentEstimatedMinutes",
  "remainingMinutes",
  "energyRequirement",
  "locationRequirements",
  "minimumSessionMinutes",
  "preferredSessionMinutes",
  "maximumSessionMinutes",
  "splittable",
  "interruptible",
  "priorityOverride",
];

export function classifyTaskMutation(
  before: TaskRecord | null,
  after: TaskRecord,
): ReplanIntent | null {
  const plannable = (task: TaskRecord) =>
    !task.archivedAt &&
    task.planningMode === "AUTO" &&
    (task.status === "READY" || task.status === "IN_PROGRESS");
  if (!before)
    return plannable(after)
      ? { trigger: { type: "TASK_CREATED", entityType: "TASK", entityId: after.id } }
      : null;
  if (!plannable(before) && !plannable(after)) return null;
  if (changed(before.dueAt, after.dueAt))
    return { trigger: { type: "DEADLINE_CHANGED", entityType: "TASK", entityId: after.id } };
  return taskSchedulingFields.some((key) => changed(before[key], after[key]))
    ? { trigger: { type: "TASK_UPDATED", entityType: "TASK", entityId: after.id } }
    : null;
}

const calendarSchedulingFields: (keyof CalendarEventRecord)[] = [
  "startAt",
  "endAt",
  "constraintLevel",
  "archivedAt",
  "courseId",
];
export function classifyCalendarMutation(
  before: CalendarEventRecord | null,
  after: CalendarEventRecord,
): ReplanIntent | null {
  const occupied = (event: CalendarEventRecord) =>
    !event.archivedAt && event.constraintLevel !== "INFORMATIONAL";
  if (!before)
    return occupied(after)
      ? { trigger: { type: "CALENDAR_CHANGED", entityType: "CALENDAR_EVENT", entityId: after.id } }
      : null;
  return (occupied(before) || occupied(after)) &&
    calendarSchedulingFields.some((key) => changed(before[key], after[key]))
    ? { trigger: { type: "CALENDAR_CHANGED", entityType: "CALENDAR_EVENT", entityId: after.id } }
    : null;
}

export function classifyPlanningFields<T extends { id: string }>(
  before: T | null,
  after: T,
  fields: (keyof T)[],
  entityType: string,
  triggerType: PlannerTriggerContext["type"] = "CALENDAR_CHANGED",
): ReplanIntent | null {
  return !before || fields.some((key) => changed(before[key], after[key]))
    ? { trigger: { type: triggerType, entityType, entityId: after.id } }
    : null;
}

export type PlannedMutation<T> = T & { planning?: ApplicationResult<PlannerServiceResult> };

/** Runs only after the canonical transaction commits; planning failure never undoes a factual edit. */
export async function planAfterMutation<T extends object>(
  mutation: Promise<ApplicationResult<T>>,
  intent: (record: T) => ReplanIntent | null,
  now: () => Date = () => new Date(),
): Promise<ApplicationResult<PlannedMutation<T>>> {
  const result = await mutation;
  if (!result.ok) return result;
  const selected = intent(result.value);
  if (!selected) return result;
  const planning = await generateAuthoritativePlan(requestForReplan(selected, now()));
  return { ok: true, value: { ...result.value, planning } };
}

/** Explicit user regeneration is the only ordinary FULL path. */
export function replanManually(
  input: {
    full?: boolean;
    now?: Date;
    releasedTimePolicy?: PlannerRequest["releasedTimePolicy"];
  } = {},
) {
  return generateAuthoritativePlan(
    requestForReplan(
      {
        trigger: { type: "MANUAL" },
        mode: input.full ? "FULL" : "INCREMENTAL",
        releasedTimePolicy: input.releasedTimePolicy,
      },
      input.now ?? new Date(),
    ),
  );
}

/** Callable by a daily invoker; deployment scheduling is deliberately separate. */
export function refreshDailyPlan(now: Date = new Date()) {
  return generateAuthoritativePlan(requestForReplan({ trigger: { type: "DAILY_REFRESH" } }, now));
}

export interface IntegrationBatchIdentity {
  scope: string;
  key: string;
  entityId: string;
}
function integrationIntent(identity: IntegrationBatchIdentity): ReplanIntent {
  return {
    trigger: {
      type: "INTEGRATION_SYNC",
      entityType: "INTEGRATION_BATCH",
      entityId: identity.entityId,
      idempotencyScope: identity.scope,
      idempotencyKey: identity.key,
    },
  };
}

/** Future sync code may commit many canonical writes once, then request one keyed replan. */
export async function commitIntegrationBatchAndReplan<T>(
  identity: IntegrationBatchIdentity,
  writeBatch: (tx: TransactionContext, userId: string) => Promise<T>,
  now: Date = new Date(),
): Promise<ApplicationResult<{ batch: T; planning: ApplicationResult<PlannerServiceResult> }>> {
  const batch = await resultOf(async () => {
    const actor = await requireActor();
    if (!identity.scope.trim() || !identity.key.trim() || !identity.entityId.trim())
      throw new Error("Integration batch identity is incomplete");
    return applicationDatabase().transaction((tx) => writeBatch(tx, actor.userId));
  });
  if (!batch.ok) return batch;
  return {
    ok: true,
    value: {
      batch: batch.value,
      planning: await generateAuthoritativePlan(requestForReplan(integrationIntent(identity), now)),
    },
  };
}

/** For a provider that already committed its own canonical transaction. */
export function replanAfterIntegrationSync(
  identity: IntegrationBatchIdentity,
  now: Date = new Date(),
) {
  return generateAuthoritativePlan(requestForReplan(integrationIntent(identity), now));
}

/** Milestone 4 accepts completed facts; it does not derive task remaining work or outcome state. */
export async function replanAfterCommittedOutcome(input: {
  completionRecordId: string;
  kind: "COMPLETED" | "SKIPPED";
  now?: Date;
  releasedWindows?: PlannerTriggerContext["releasedWindows"];
  releasedTimePolicy?: PlannerRequest["releasedTimePolicy"];
}): Promise<ApplicationResult<PlannerServiceResult>> {
  const checked = await resultOf(async () => {
    const actor = await requireActor();
    return applicationDatabase().readSnapshot(async (tx) => {
      const completion = await tx.repositories.completionRecords.getForUser(
        actor.userId,
        input.completionRecordId,
      );
      if (!completion || !completion.workSessionId || completion.outcome !== input.kind)
        return null;
      const session = await tx.repositories.workSessions.getForUser(
        actor.userId,
        completion.workSessionId,
      );
      const task = await tx.repositories.tasks.getForUser(actor.userId, completion.taskId);
      return session &&
        session.taskId === completion.taskId &&
        session.state === input.kind &&
        task &&
        task.remainingMinutes !== null &&
        task.remainingMinutes >= 0 &&
        completion.remainingAfterMinutes !== null &&
        completion.remainingAfterMinutes === task.remainingMinutes
        ? session.id
        : null;
    });
  });
  if (!checked.ok) return checked;
  if (!checked.value)
    return {
      ok: true,
      value: {
        status: "INPUT_FAILURE",
        issues: [
          {
            code: "INCOMPLETE_OUTCOME",
            message: "Completion, session and remaining-work facts must already agree.",
          },
        ],
      },
    };
  return generateAuthoritativePlan(
    requestForReplan(
      {
        trigger: {
          type: input.kind === "COMPLETED" ? "SESSION_COMPLETED" : "SESSION_SKIPPED",
          entityType: "WORK_SESSION",
          entityId: checked.value,
          idempotencyScope: "completion-record",
          idempotencyKey: input.completionRecordId,
          releasedWindows: input.releasedWindows,
        },
        releasedTimePolicy: input.releasedTimePolicy,
      },
      input.now ?? new Date(),
    ),
  );
}
