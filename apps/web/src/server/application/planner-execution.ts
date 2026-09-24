import { randomUUID } from "node:crypto";
import type { PlannerInput, PlannerOutput, WorkSession } from "@university-planner/domain";
import type {
  Database,
  JsonValue,
  PlannerRunCompletionSummary,
  PlannerRunDelta,
  PlannerRunRecord,
  PlannerRunRisk,
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
  generate?: (input: PlannerInput) => PlannerOutput | Promise<PlannerOutput>;
  id?: () => string;
  clock?: () => Date;
}

/** Computations have no heartbeat. Recovery is demand driven and a late result cannot commit. */
export const PLANNER_RUN_EXPIRY_MINUTES = 30;

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
    !output.reasonsBySession ||
    typeof output.reasonsBySession !== "object" ||
    Array.isArray(output.reasonsBySession) ||
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
  if (
    Object.entries(output.reasonsBySession).some(
      ([sessionId, codes]) =>
        !ids.has(sessionId) ||
        !Array.isArray(codes) ||
        codes.some((code) => typeof code !== "string" || !code),
    )
  )
    errors.push("Planner session reasons are invalid.");
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

/** A projection of core diagnostics, with no independent scheduling or risk inference. */
export function riskFromOutput(output: PlannerOutput): PlannerRunRisk[] {
  const risks = new Map<string, PlannerRunRisk>();
  for (const pressure of output.pressures) {
    if (pressure.feasibility === "COMFORTABLE") continue;
    risks.set(pressure.taskId, {
      taskId: pressure.taskId,
      feasibility: pressure.feasibility,
      deficitMinutes: pressure.capacityDeficitMinutes,
      slackMinutes: pressure.slackMinutes,
    });
  }
  for (const infeasible of output.infeasibilities) {
    const prior = risks.get(infeasible.taskId);
    risks.set(infeasible.taskId, {
      taskId: infeasible.taskId,
      feasibility: "INFEASIBLE",
      deficitMinutes: infeasible.deficitMinutes,
      slackMinutes: prior?.slackMinutes ?? null,
    });
  }
  return [...risks.values()].sort((a, b) => a.taskId.localeCompare(b.taskId));
}

function priorRisk(run: PlannerRunRecord | null): PlannerRunRisk[] {
  const summary = run?.summary;
  if (
    summary &&
    typeof summary === "object" &&
    !Array.isArray(summary) &&
    Array.isArray(summary.risk)
  )
    return summary.risk.flatMap((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        typeof item.taskId !== "string" ||
        typeof item.feasibility !== "string" ||
        typeof item.deficitMinutes !== "number"
      )
        return [];
      if (!["CONSTRAINED", "CRITICAL", "INFEASIBLE", "HORIZON_LIMITED"].includes(item.feasibility))
        return [];
      return [
        {
          taskId: item.taskId,
          feasibility: item.feasibility as PlannerRunRisk["feasibility"],
          deficitMinutes: item.deficitMinutes,
          slackMinutes: typeof item.slackMinutes === "number" ? item.slackMinutes : null,
        },
      ];
    });
  // Runs created before this projection retained bounded warning diagnostics.
  return priorWarnings(run)
    .filter((warning) => warning.taskId && (warning.deficitMinutes ?? 0) > 0)
    .map((warning) => ({
      taskId: warning.taskId!,
      feasibility: "INFEASIBLE" as const,
      deficitMinutes: warning.deficitMinutes!,
      slackMinutes: null,
    }));
}

const severity = { HORIZON_LIMITED: 1, CONSTRAINED: 2, CRITICAL: 3, INFEASIBLE: 4 };
function riskWorsened(before: PlannerRunRisk, after: PlannerRunRisk): boolean {
  return (
    severity[after.feasibility] > severity[before.feasibility] ||
    (after.feasibility === before.feasibility &&
      (after.deficitMinutes > before.deficitMinutes ||
        (after.deficitMinutes === before.deficitMinutes &&
          before.slackMinutes !== null &&
          after.slackMinutes !== null &&
          after.slackMinutes < before.slackMinutes)))
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
  sessionReasons: Record<string, string[]>;
  delta: PlannerRunDelta;
} {
  const oldById = new Map(old.map((session) => [session.id, session]));
  const retained = output.sessions
    .filter((session) => oldById.has(session.id))
    .map((session) => session.id);
  const retainedSet = new Set(retained);
  const durableByEphemeral = new Map(
    output.sessions
      .filter(
        (session) =>
          retainedSet.has(session.id) || session.generatedBy === "USER" || session.locked,
      )
      .map((session) => [session.id, session.id]),
  );
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
    durableByEphemeral.set(session.id, identical.id);
    return false;
  });
  const newIds = new Set<string>();
  const created = generated.map((session) => {
    const durableId = id();
    if (newIds.has(durableId) || oldById.has(durableId))
      throw new Error("Durable session identity collision");
    newIds.add(durableId);
    durableByEphemeral.set(session.id, durableId);
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
  const before = new Map(priorRisk(previousRun).map((risk) => [risk.taskId, risk]));
  const after = new Map(riskFromOutput(output).map((risk) => [risk.taskId, risk]));
  return {
    created,
    superseded,
    sessionReasons: Object.fromEntries(
      Object.entries(output.reasonsBySession).flatMap(([sessionId, codes]) => {
        const durableId = durableByEphemeral.get(sessionId);
        return durableId ? [[durableId, [...codes]]] : [];
      }),
    ),
    delta: {
      retained,
      moved,
      added: created.filter((session) => available.has(session.id)).map((session) => session.id),
      removed: superseded.filter((change) => !change.replacementId).map((change) => change.id),
      newlyAtRisk: [...after.keys()].filter((taskId) => !before.has(taskId)),
      worsenedRisk: [...after]
        .filter(([taskId, risk]) => before.has(taskId) && riskWorsened(before.get(taskId)!, risk))
        .map(([taskId]) => taskId),
      improvedRisk: [...after]
        .filter(([taskId, risk]) => before.has(taskId) && riskWorsened(risk, before.get(taskId)!))
        .map(([taskId]) => taskId),
      resolvedRisk: [...before.keys()].filter((taskId) => !after.has(taskId)),
      unchangedRisk: [...after]
        .filter(
          ([taskId, risk]) =>
            before.has(taskId) &&
            !riskWorsened(before.get(taskId)!, risk) &&
            !riskWorsened(risk, before.get(taskId)!),
        )
        .map(([taskId]) => taskId),
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
  const started = await database.transaction(async (tx) => {
    const startedAt = clock();
    await tx.repositories.plannerRuns.failExpiredRunning(
      userId,
      addMinutes(startedAt, -PLANNER_RUN_EXPIRY_MINUTES),
      startedAt,
    );
    return tx.repositories.plannerRuns.start({
      id: runId,
      userId,
      startedAt,
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
    });
  });
  if (started.status === "EXISTING")
    return { status: "DUPLICATE", runId: started.record.id, runStatus: started.record.status };
  const fail = async (
    code: Extract<AuthoritativePlannerResult, { status: "FAILED" }>["code"],
  ): Promise<AuthoritativePlannerResult> => {
    const result = await database.transaction(async (tx) => {
      const completed = await tx.repositories.plannerRuns.complete(userId, runId, {
        status: "FAILED",
        completedAt: clock(),
        summary: null,
        warnings: [{ code, reasonCodes: [] }],
      });
      return completed;
    });
    // A recovery or competing terminal transition already owns the run. Its
    // guarded completion also prevents this computation from publishing sessions.
    if (result.status !== "UPDATED" && result.status !== "STALE")
      throw new Error("PlannerRun failure could not be recorded");
    return { status: "FAILED", runId, code };
  };
  let output: PlannerOutput;
  try {
    output = await (dependencies.generate ?? generatePlan)(input);
  } catch {
    return fail("CORE_FAILURE");
  }
  try {
    if (validateAuthoritativeOutput(input, output).length) return fail("INVALID_OUTPUT");
  } catch {
    return fail("INVALID_OUTPUT");
  }
  try {
    const result = await database.transaction(async (tx) => {
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
        risk: riskFromOutput(output),
        delta: changes.delta,
        sessionReasons: changes.sessionReasons,
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
    });
    if (result.status === "FAILED") return fail("STALE_SNAPSHOT");
    return result;
  } catch {
    return fail("PERSISTENCE_FAILURE");
  }
}
