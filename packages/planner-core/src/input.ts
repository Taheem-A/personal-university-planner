import type { PlannerInput } from "../../domain/src";

/** Prevent the baseline heuristic from silently ignoring newly explicit constraints. */
export function assertBaselineSupported(input: PlannerInput): void {
  const unsupported = [
    ["dependencies", input.dependencies.length > 0],
    ["protected windows", input.protectedWindows.length > 0],
    ["sleep windows", input.sleepWindows.length > 0 || input.minimumSleepMinutes > 0],
    ["manual sessions", input.manualSessions.length > 0],
    ["commute capacity", input.availability.some((window) => window.kind === "COMMUTE")],
    ["replan mode", input.replanMode !== "INCREMENTAL"],
    ["released-time policy", input.releasedTimePolicy !== "REPLAN_IF_USEFUL"],
  ] as const;
  const first = unsupported.find(([, present]) => present);
  if (first) throw new Error(`Planner baseline does not yet support ${first[0]}.`);
}
