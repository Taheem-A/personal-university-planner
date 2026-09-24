import type { PlannerOutput } from "../../domain/src";
import type { InstantInterval } from "../../shared/src";

/** One bounded retry excludes invalid generated placements, then validates anew. */
export function repairPlan(
  candidate: PlannerOutput,
  regenerate: (excluded: InstantInterval[]) => PlannerOutput,
): PlannerOutput {
  const invalidIds = new Set(
    candidate.validationIssues
      .filter((issue) => !issue.retained && issue.sessionId)
      .map((issue) => issue.sessionId),
  );
  if (invalidIds.size === 0) return candidate;
  const excluded = candidate.sessions
    .filter((session) => invalidIds.has(session.id))
    .map((session) => ({ startAt: session.startAt, endAt: session.endAt }));
  const repaired = regenerate(excluded);
  const remaining = (output: PlannerOutput) =>
    Object.values(output.unscheduledMinutesByTask).reduce((sum, value) => sum + value, 0);
  if (
    repaired.validationIssues.length < candidate.validationIssues.length ||
    (repaired.validationIssues.length === candidate.validationIssues.length &&
      remaining(repaired) < remaining(candidate))
  )
    return repaired;
  return candidate;
}
