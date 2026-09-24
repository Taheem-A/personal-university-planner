import { z } from "zod";
import type { PlannerInput, PlannerVersion } from "@university-planner/domain";
import type { PlannerRunTrigger } from "@university-planner/database";
import { PLANNER_VERSION } from "@university-planner/planner-core";
import { applicationDatabase } from "../database";
import { requireActor } from "./authorization";
import { resultOf, type ApplicationResult } from "./errors";
import {
  assembleSnapshotForActor,
  executePlannerForActor,
  type AuthoritativePlannerResult,
} from "./planner-execution";
import type { PlannerInputIssue } from "./planner-input";

export type PlannerTrigger = PlannerRunTrigger;
export interface PlannerTriggerContext {
  type: PlannerTrigger;
  entityType?: string;
  entityId?: string;
  /** Stable event identity; both fields are supplied together. */
  idempotencyScope?: string;
  idempotencyKey?: string;
  /** A prior outcome may explicitly release capacity; no inference from history. */
  releasedWindows?: PlannerInput["releasedWindows"];
}
export type PlannerRequest =
  | {
      operation: "AUTHORITATIVE_GENERATION";
      mode: "INCREMENTAL";
      trigger: PlannerTriggerContext;
      now: Date;
      plannerVersion: PlannerVersion;
      releasedTimePolicy: PlannerInput["releasedTimePolicy"];
    }
  | {
      operation: "INCREMENTAL_REPLAN";
      mode: "INCREMENTAL";
      trigger: PlannerTriggerContext;
      now: Date;
      plannerVersion: PlannerVersion;
      releasedTimePolicy: PlannerInput["releasedTimePolicy"];
    }
  | {
      operation: "FULL_REPLAN";
      mode: "FULL";
      trigger: PlannerTriggerContext;
      now: Date;
      plannerVersion: PlannerVersion;
      releasedTimePolicy: PlannerInput["releasedTimePolicy"];
    };

export interface PlannerHorizon {
  startAt: Date;
  endAt: Date;
  immediateEndAt: Date;
  precision: "EXACT_NEAR_TERM";
  trigger: PlannerTrigger;
  earliestKnownDeadlineAt?: Date;
}

export type PlannerAssemblyResult =
  | {
      status: "READY";
      input: PlannerInput;
      horizon: PlannerHorizon;
      plannerVersion: PlannerVersion;
      snapshotRevision: number;
    }
  | { status: "INPUT_FAILURE"; issues: PlannerInputIssue[] };
export type PlannerServiceResult = AuthoritativePlannerResult;

const triggerTypes = [
  "MANUAL",
  "TASK_CREATED",
  "TASK_UPDATED",
  "SESSION_COMPLETED",
  "SESSION_SKIPPED",
  "CALENDAR_CHANGED",
  "DEADLINE_CHANGED",
  "INTEGRATION_SYNC",
  "DAILY_REFRESH",
] as const;
const requestSchema = z
  .object({
    operation: z.enum(["AUTHORITATIVE_GENERATION", "INCREMENTAL_REPLAN", "FULL_REPLAN"]),
    mode: z.enum(["INCREMENTAL", "FULL"]),
    trigger: z.object({
      type: z.enum(triggerTypes),
      entityType: z.string().min(1).optional(),
      entityId: z.string().min(1).optional(),
      idempotencyScope: z.string().min(1).optional(),
      idempotencyKey: z.string().min(1).optional(),
      releasedWindows: z
        .array(z.object({ id: z.string().min(1), startAt: z.date(), endAt: z.date() }))
        .optional(),
    }),
    now: z.date(),
    plannerVersion: z.literal("heuristic-v1"),
    releasedTimePolicy: z.enum(["KEEP_FREE", "REPLAN_IF_USEFUL", "ALWAYS_REPLAN"]),
  })
  .refine((value) => (value.operation === "FULL_REPLAN") === (value.mode === "FULL"))
  .refine(
    (value) => Boolean(value.trigger.idempotencyScope) === Boolean(value.trigger.idempotencyKey),
  )
  .refine((value) => Boolean(value.trigger.entityType) === Boolean(value.trigger.entityId));

function invalidRequest(request: PlannerRequest): PlannerInputIssue[] {
  const parsed = requestSchema.safeParse(request);
  if (
    !parsed.success ||
    !Number.isFinite(request.now.getTime()) ||
    request.plannerVersion !== PLANNER_VERSION
  )
    return [{ code: "UNSUPPORTED_REQUEST", message: "Planner request is invalid or unsupported." }];
  return [];
}

/** Authenticated read-only assembly; every canonical read uses one MVCC snapshot. */
export async function assembleCanonicalPlannerSnapshot(
  request: PlannerRequest,
): Promise<ApplicationResult<PlannerAssemblyResult>> {
  return resultOf(async () => {
    const actor = await requireActor();
    const requestIssues = invalidRequest(request);
    if (requestIssues.length) return { status: "INPUT_FAILURE" as const, issues: requestIssues };
    return assembleSnapshotForActor(applicationDatabase(), actor.userId, request);
  });
}

/** Authenticated authoritative planner operation; transport delegates to this boundary. */
export async function generateAuthoritativePlan(
  request: PlannerRequest,
): Promise<ApplicationResult<PlannerServiceResult>> {
  return resultOf(async () => {
    const actor = await requireActor();
    const issues = invalidRequest(request);
    if (issues.length) return { status: "INPUT_FAILURE" as const, issues };
    return executePlannerForActor(applicationDatabase(), actor.userId, request);
  });
}
