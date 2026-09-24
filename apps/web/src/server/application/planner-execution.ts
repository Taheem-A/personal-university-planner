import { randomUUID } from "node:crypto";
import type { PlannerInput, PlannerOutput, WorkSession } from "@university-planner/domain";
import type {
  Database,
  JsonValue,
  PlannerRunCompletionSummary,
  PlannerRunDelta,
  PlannerRunRecord,
  PlannerRunStoredWarning,
  WorkSessionRecord,
} from "@university-planner/database";
import {
  generatePlan,
  PLANNER_VERSION,
  validatePlanDetailed,
} from "@university-planner/planner-core";
import { addMinutes } from "@university-planner/shared";
import { assemblePlannerInput, selectPlannerHorizon } from "./planner-input";
import type { PlannerAssemblyResult, PlannerRequest } from "./planner";

export type AuthoritativePlannerResult =
  | { status: "INPUT_FAILURE"; issues: { code: string; message: string; recordId?: string }[] }
  | { status: "DUPLICATE"; runId: string; runStatus: PlannerRunRecord["status"] }
  | {
      status: "FAILED";
      runId: string;
      code: "CORE_FAILURE" | "INVALID_OUTPUT" | "STALE_SNAPSHOT" | "PERSISTENCE_FAILURE";
    }
  | {
      status: "SUCCEEDED";
      runId: string;
      plannerVersion: typeof PLANNER_VERSION;
      planStatus: PlannerOutput["status"];
      summary: PlannerRunCompletionSummary;
      warnings: PlannerRunStoredWarning[];
      delta: PlannerRunDelta;
    };

export interface PlannerExecutionDependencies {
  generate?: (input: PlannerInput) => PlannerOutput;
  id?: () => string;
  clock?: () => Date;
}

/** One repeatable-read boundary for every fact entering a planner computation. */
export async function assembleSnapshotForActor(
  database: Database,
  userId: string,
  request: PlannerRequest,
): Promise<PlannerAssemblyResult> {
  return database.readSnapshot(async (tx) => {
    const state = await tx.repositories.planningState.snapshot(
      userId,
      request.now,
      addMinutes(request.now, 9 * 24 * 60),
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
    const mapped = assemblePlannerInput(state, userId, request, horizon);
    if (mapped.status === "INPUT_FAILURE") return mapped;
    return {
      status: "READY" as const,
      input: mapped.input,
      horizon,
      plannerVersion: PLANNER_VERSION,
      snapshotRevision: state.user.planningRevision,
    };
  });
}

/** JSON round trip gives dates an explicit UTC ISO representation and rejects non-JSON values. */
function inputSnapshot(input: PlannerInput, revision: number): JsonValue {
  return JSON.parse(
    JSON.stringify({
      format: "planner-input",
      schemaVersion: 1,
      plannerVersion: PLANNER_VERSION,
      revision,
      input,
    }),
  ) as JsonValue;
}

function sameSession(a: WorkSession, b: WorkSession): boolean {
  return (
    a.id === b.id &&
    a.userId === b.userId &&
    a.taskId === b.taskId &&
    a.startAt.getTime() === b.startAt.getTime() &&
    a.endAt.getTime() === b.endAt.getTime() &&
    a.plannedMinutes === b.plannedMinutes &&
    a.state === b.state &&
    a.generatedBy === b.generatedBy &&
    a.locked === b.locked
  );
}

/** Core output is untrusted at this boundary, including retained identities and ownership. */
export function validateAuthoritativeOutput(input: PlannerInput, output: PlannerOutput): string[] {
  const errors: string[] = [];
  if (output.plannerVersion !== PLANNER_VERSION || !["VALID", "INFEASIBLE"].includes(output.status))
    errors.push("Planner version or status is unsupported.");
  if (
    !Array.isArray(output.sessions) ||
    !Array.isArray(output.validationIssues) ||
    !Array.isArray(output.infeasibilities) ||
    !Array.isArray(output.warnings) ||
    !output.unscheduledMinutesByTask ||
    typeof output.unscheduledMinutesByTask !== "object"
  )
    return [...errors, "Planner output shape is invalid."];
  const taskIds = new Set(input.tasks.map((task) => task.id));
  const known = new Map(
    [...input.manualSessions, ...input.lockedSessions, ...input.previousSessions].map((session) => [
      session.id,
      session,
    ]),
  );
  const ids = new Set<string>();
  for (const session of output.sessions) {
    if (!session || typeof session.id !== "string" || !session.id || ids.has(session.id))
      errors.push("Planner output has a duplicate or missing session identity.");
    ids.add(session.id);
    if (
      session.userId !== input.userId ||
      !taskIds.has(session.taskId) ||
      !(session.startAt instanceof Date) ||
      !(session.endAt instanceof Date) ||
      !Number.isFinite(session.startAt?.getTime()) ||
      !Number.isFinite(session.endAt?.getTime()) ||
      session.endAt <= session.startAt ||
      !Number.isSafeInteger(session.plannedMinutes) ||
      session.plannedMinutes <= 0
    )
      errors.push("Planner output has invalid ownership, task, or time.");
    const prior = known.get(session.id);
    if (prior && !sameSession(prior, session))
      errors.push("A persistent session identity changed.");
    if (
      !prior &&
      (session.generatedBy !== "PLANNER" || session.locked || session.state !== "PLANNED")
    )
      errors.push("New planner output is not an unlocked planned session.");
  }
  if (errors.length) return errors;
  if (output.validationIssues.length || validatePlanDetailed(output.sessions, input).length)
    errors.push("Planner output violates a hard planning invariant.");
  const deficit = Object.values(output.unscheduledMinutesByTask);
  if (
    Object.keys(output.unscheduledMinutesByTask).some((taskId) => !taskIds.has(taskId)) ||
    deficit.some((minutes) => !Number.isSafeInteger(minutes) || minutes < 0) ||
    (output.status === "VALID" &&
      (output.infeasibilities.length > 0 || deficit.some((minutes) => minutes > 0)))
  )
    errors.push("Planner feasibility status is inconsistent.");
  for (const task of input.tasks) {
    if (task.planningMode !== "AUTO" || (task.status !== "READY" && task.status !== "IN_PROGRESS"))
      continue;
    const scheduled = output.sessions
      .filter(
        (session) =>
          session.taskId === task.id &&
          (session.state === "PLANNED" || session.state === "ACTIVE") &&
          session.endAt > input.now,
      )
      .reduce((total, session) => total + session.plannedMinutes, 0);
    if (scheduled + (output.unscheduledMinutesByTask[task.id] ?? 0) !== task.remainingMinutes)
      errors.push("Planner output does not account for all remaining task work.");
  }
  return errors;
}

function riskIds(warnings: PlannerRunStoredWarning[]): Set<string> {
  const riskCodes = new Set([
    "LOW_SLACK",
    "INFEASIBLE",
    "NO_SUITABLE_WINDOW",
    "DEPENDENCY_BLOCKED",
    "DEADLINE_BUFFER_USED",
    "HARD_CONFLICT",
  ]);
  return new Set(
    warnings
      .filter(
        (warning) =>
          warning.taskId && (riskCodes.has(warning.code) || (warning.deficitMinutes ?? 0) > 0),
      )
      .map((warning) => warning.taskId!),
  );
}

function storedWarnings(output: PlannerOutput): PlannerRunStoredWarning[] {
  return output.warnings.map((warning) => ({
    code: warning.code,
    ...(warning.taskId ? { taskId: warning.taskId } : {}),
    ...(warning.deficitMinutes !== undefined ? { deficitMinutes: warning.deficitMinutes } : {}),
    reasonCodes: [...(warning.reasonCodes ?? [])],
  }));
}

function priorWarnings(run: PlannerRunRecord | null): PlannerRunStoredWarning[] {
  if (!Array.isArray(run?.warnings)) return [];
  return run.warnings.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      typeof item.code !== "string" ||
      !Array.isArray(item.reasonCodes)
    )
      return [];
    return [
      {
        code: item.code,
        ...(typeof item.taskId === "string" ? { taskId: item.taskId } : {}),
        ...(typeof item.deficitMinutes === "number" ? { deficitMinutes: item.deficitMinutes } : {}),
        reasonCodes: item.reasonCodes.filter((code): code is string => typeof code === "string"),
      },
    ];
  });
}

function planChanges(
  userId: string,
  runId: string,
  output: PlannerOutput,
  old: WorkSessionRecord[],
  previousRun: PlannerRunRecord | null,
  id: () => string,
  now: Date,
): {
  created: WorkSessionRecord[];
  superseded: { id: string; replacementId: string | null }[];
  delta: PlannerRunDelta;
} {
  const oldById = new Map(old.map((session) => [session.id, session]));
  const retained = output.sessions
    .filter((session) => oldById.has(session.id))
    .map((session) => session.id);
  const retainedSet = new Set(retained);
  const candidates = output.sessions.filter(
    (session) => !retainedSet.has(session.id) && session.generatedBy === "PLANNER",
  );
  // A regenerated identical slot is still the same persisted plan intent.
  const generated = candidates.filter((session) => {
    const identical = old.find(
      (prior) =>
        !prior.locked &&
        !retainedSet.has(prior.id) &&
        prior.taskId === session.taskId &&
        prior.state === session.state &&
        prior.startAt.getTime() === session.startAt.getTime() &&
        prior.endAt.getTime() === session.endAt.getTime() &&
        prior.plannedMinutes === session.plannedMinutes,
    );
    if (!identical) return true;
    retained.push(identical.id);
    retainedSet.add(identical.id);
    return false;
  });
  const newIds = new Set<string>();
  const created = generated.map((session) => {
    const durableId = id();
    if (newIds.has(durableId) || oldById.has(durableId))
      throw new Error("Durable session identity collision");
    newIds.add(durableId);
    return {
      id: durableId,
      version: 0,
      userId,
      taskId: session.taskId,
      plannerRunId: runId,
      startAt: session.startAt,
      endAt: session.endAt,
      plannedMinutes: session.plannedMinutes,
      state: "PLANNED" as const,
      generatedBy: "PLANNER" as const,
      locked: false,
      supersededById: null,
      createdAt: now,
      updatedAt: now,
    };
  });
  const obsolete = old.filter((session) => !session.locked && !retainedSet.has(session.id));
  const available = new Set(created.map((session) => session.id));
  const moved: PlannerRunDelta["moved"] = [];
  const superseded = obsolete.map((session) => {
    const match = created
      .filter(
        (candidate) =>
          available.has(candidate.id) &&
          candidate.taskId === session.taskId &&
          candidate.plannedMinutes === session.plannedMinutes &&
          (candidate.startAt.getTime() !== session.startAt.getTime() ||
            candidate.endAt.getTime() !== session.endAt.getTime()),
      )
      .sort(
        (a, b) =>
          Math.abs(a.startAt.getTime() - session.startAt.getTime()) -
          Math.abs(b.startAt.getTime() - session.startAt.getTime()),
      )[0];
    if (match) {
      available.delete(match.id);
      moved.push({
        fromSessionId: session.id,
        toSessionId: match.id,
        taskId: session.taskId,
        fromStartAt: session.startAt.toISOString(),
        toStartAt: match.startAt.toISOString(),
      });
    }
    return { id: session.id, replacementId: match?.id ?? null };
  });
  const before = riskIds(priorWarnings(previousRun));
  const after = riskIds(storedWarnings(output));
  return {
    created,
    superseded,
    delta: {
      retained,
      moved,
      added: created.filter((session) => available.has(session.id)).map((session) => session.id),
      removed: superseded.filter((change) => !change.replacementId).map((change) => change.id),
      newlyAtRisk: [...after].filter((taskId) => !before.has(taskId)),
      resolvedRisk: [...before].filter((taskId) => !after.has(taskId)),
    },
  };
}

/** Authoritative execution; the only write path for generated planner sessions. */
export async function executePlannerForActor(
  database: Database,
  userId: string,
  request: PlannerRequest,
  dependencies: PlannerExecutionDependencies = {},
): Promise<AuthoritativePlannerResult> {
  const id = dependencies.id ?? randomUUID;
  const clock = dependencies.clock ?? (() => new Date());
  const assembled = await assembleSnapshotForActor(database, userId, request);
  if (assembled.status === "INPUT_FAILURE") return assembled;
  const { input, horizon, snapshotRevision } = assembled;
  const runId = id();
  const started = await database.transaction(async (tx) =>
    tx.repositories.plannerRuns.start({
      id: runId,
      userId,
      startedAt: clock(),
      completedAt: null,
      triggerType: request.trigger.type,
      triggerEntityType: request.trigger.entityType ?? null,
      triggerEntityId: request.trigger.entityId ?? null,
      idempotencyScope: request.trigger.idempotencyScope ?? null,
      idempotencyKey: request.trigger.idempotencyKey ?? null,
      planningHorizonStart: horizon.startAt,
      planningHorizonEnd: horizon.endAt,
      plannerVersion: PLANNER_VERSION,
      inputSnapshot: inputSnapshot(input, snapshotRevision),
      summary: null,
      warnings: null,
      status: "RUNNING",
    }),
  );
  if (started.status === "EXISTING")
    return { status: "DUPLICATE", runId: started.record.id, runStatus: started.record.status };
  const fail = async (
    code: Extract<AuthoritativePlannerResult, { status: "FAILED" }>["code"],
  ): Promise<AuthoritativePlannerResult> => {
    await database.transaction(async (tx) => {
      const completed = await tx.repositories.plannerRuns.complete(userId, runId, {
        status: "FAILED",
        completedAt: clock(),
        summary: null,
        warnings: [{ code, reasonCodes: [] }],
      });
      if (completed.status !== "UPDATED")
        throw new Error("PlannerRun failure could not be recorded");
    });
    return { status: "FAILED", runId, code };
  };
  let output: PlannerOutput;
  try {
    output = (dependencies.generate ?? generatePlan)(input);
  } catch {
    return fail("CORE_FAILURE");
  }
  try {
    if (validateAuthoritativeOutput(input, output).length) return fail("INVALID_OUTPUT");
  } catch {
    return fail("INVALID_OUTPUT");
  }
  try {
    return await database
      .transaction(async (tx) => {
        const claim = await tx.repositories.planningState.claimRevision(userId, snapshotRevision);
        if (claim.status !== "CLAIMED")
          return { status: "FAILED" as const, runId, code: "STALE_SNAPSHOT" as const };
        const old = await tx.repositories.workSessions.listActiveGenerated(
          userId,
          horizon.startAt,
          horizon.endAt,
        );
        const previousRun = await tx.repositories.plannerRuns.latestSuccessful(userId);
        const changes = planChanges(userId, runId, output, old, previousRun, id, clock());
        await tx.repositories.workSessions.createGeneratedBatch(userId, changes.created);
        await tx.repositories.workSessions.supersedeGenerated(userId, changes.superseded);
        const warnings = storedWarnings(output);
        const summary: PlannerRunCompletionSummary = {
          planStatus: output.status,
          generatedSessionCount: changes.created.length,
          retainedSessionCount: changes.delta.retained.length,
          unscheduledMinutes: Object.values(output.unscheduledMinutesByTask).reduce(
            (sum, value) => sum + value,
            0,
          ),
          delta: changes.delta,
        };
        const completed = await tx.repositories.plannerRuns.complete(userId, runId, {
          status: "SUCCEEDED",
          completedAt: clock(),
          summary,
          warnings,
        });
        if (completed.status !== "UPDATED") throw new Error("PlannerRun changed before completion");
        return {
          status: "SUCCEEDED" as const,
          runId,
          plannerVersion: PLANNER_VERSION,
          planStatus: output.status,
          summary,
          warnings,
          delta: changes.delta,
        };
      })
      .then(async (result) => (result.status === "FAILED" ? fail("STALE_SNAPSHOT") : result));
  } catch {
    return fail("PERSISTENCE_FAILURE");
  }
}
