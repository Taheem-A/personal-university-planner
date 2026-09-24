import { z } from "zod";
import type { PlannerInput, PlannerOutput, PlannerVersion } from "@university-planner/domain";
import type { PlannerRunTrigger } from "@university-planner/database";
import { generatePlan, PLANNER_VERSION } from "@university-planner/planner-core";
import { addMinutes } from "@university-planner/shared";
import { applicationDatabase } from "../database";
import { requireActor } from "./authorization";
import { resultOf, type ApplicationResult } from "./errors";
import {
  assemblePlannerInput,
  selectPlannerHorizon,
  type PlannerInputIssue,
} from "./planner-input";

export type PlannerTrigger = PlannerRunTrigger;
export interface PlannerTriggerContext {
  type: PlannerTrigger;
  entityId?: string;
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
    }
  | { status: "INPUT_FAILURE"; issues: PlannerInputIssue[] };
export type PlannerServiceResult =
  | {
      status: "GENERATED";
      input: PlannerInput;
      output: PlannerOutput;
      horizon: PlannerHorizon;
      plannerVersion: PlannerVersion;
    }
  | { status: "INPUT_FAILURE"; issues: PlannerInputIssue[] };

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
      entityId: z.string().min(1).optional(),
      releasedWindows: z
        .array(z.object({ id: z.string().min(1), startAt: z.date(), endAt: z.date() }))
        .optional(),
    }),
    now: z.date(),
    plannerVersion: z.literal("heuristic-v1"),
    releasedTimePolicy: z.enum(["KEEP_FREE", "REPLAN_IF_USEFUL", "ALWAYS_REPLAN"]),
  })
  .refine((value) => (value.operation === "FULL_REPLAN") === (value.mode === "FULL"));

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
    return applicationDatabase().readSnapshot(async (tx) => {
      // Read a bounded superset before selecting the local-time horizon.
      const broadEnd = addMinutes(request.now, 9 * 24 * 60);
      const state = await tx.repositories.planningState.snapshot(
        actor.userId,
        request.now,
        broadEnd,
      );
      if (!state)
        return {
          status: "INPUT_FAILURE" as const,
          issues: [
            { code: "MISSING_USER" as const, message: "Canonical user state is unavailable." },
          ],
        };
      const horizon = selectPlannerHorizon(
        request.now,
        state.user.timezone,
        request.trigger.type,
        state,
      );
      const mapped = assemblePlannerInput(state, actor.userId, request, horizon);
      if (mapped.status === "INPUT_FAILURE") return mapped;
      return {
        status: "READY" as const,
        input: mapped.input,
        horizon,
        plannerVersion: PLANNER_VERSION,
      };
    });
  });
}

/** Generates an in-memory authoritative candidate. Persistence belongs to the next slice. */
export async function generateAuthoritativePlan(
  request: PlannerRequest,
): Promise<ApplicationResult<PlannerServiceResult>> {
  const assembled = await assembleCanonicalPlannerSnapshot(request);
  if (!assembled.ok) return { ok: false, error: assembled.error };
  if (assembled.value.status === "INPUT_FAILURE") return { ok: true, value: assembled.value };
  const { input, horizon } = assembled.value;
  return resultOf(async () => {
    try {
      const output = generatePlan(input);
      return {
        status: "GENERATED" as const,
        input,
        output,
        horizon,
        plannerVersion: PLANNER_VERSION,
      };
    } catch {
      return {
        status: "INPUT_FAILURE" as const,
        issues: [
          {
            code: "CORE_PRECONDITION" as const,
            message: "Canonical planner input violates a planner precondition.",
          },
        ],
      };
    }
  });
}
