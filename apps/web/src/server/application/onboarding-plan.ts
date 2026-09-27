import { z } from "zod";
import { resultOf, type ApplicationResult } from "./errors";
import { replanManually } from "./planner-triggers";
import { validateInput } from "./validation";

/** A setup action composes the existing authenticated M4 manual generation path. */
export type OnboardingPlanResult =
  | { status: "FAILED"; runId: string; code: string }
  | { status: "ALREADY_REQUESTED"; runId: string; runStatus: string }
  | {
      status: "READY" | "INFEASIBLE" | "NO_SESSIONS";
      runId: string;
      planStatus: "VALID" | "INFEASIBLE";
      sessionCount: number;
      unscheduledMinutes: number;
      warnings: { code: string; deficitMinutes?: number; reasonCodes: string[] }[];
    };
export const onboardingPlan = {
  async generate(input: unknown): Promise<ApplicationResult<OnboardingPlanResult>> {
    const parsed = await resultOf(async () => validateInput(z.object({}).strict(), input));
    if (!parsed.ok) return parsed;
    const result = await replanManually({ full: true });
    if (!result.ok) return result;
    const plan = result.value;
    if (plan.status === "INPUT_FAILURE")
      return {
        ok: false as const,
        error: {
          code: "PLANNER_INFEASIBLE" as const,
          message: "Complete the missing planning facts before generating a plan.",
        },
      };
    if (plan.status === "FAILED")
      return {
        ok: true as const,
        value: { status: "FAILED" as const, runId: plan.runId, code: plan.code },
      };
    if (plan.status === "DUPLICATE")
      return {
        ok: true as const,
        value: {
          status: "ALREADY_REQUESTED" as const,
          runId: plan.runId,
          runStatus: plan.runStatus,
        },
      };
    const sessionCount = plan.summary.generatedSessionCount + plan.summary.retainedSessionCount;
    return {
      ok: true as const,
      value: {
        status:
          plan.planStatus === "VALID" && sessionCount > 0
            ? ("READY" as const)
            : plan.planStatus === "INFEASIBLE"
              ? ("INFEASIBLE" as const)
              : ("NO_SESSIONS" as const),
        runId: plan.runId,
        planStatus: plan.planStatus,
        sessionCount,
        unscheduledMinutes: plan.summary.unscheduledMinutes,
        warnings: plan.warnings.map(({ code, deficitMinutes, reasonCodes }) => ({
          code,
          ...(deficitMinutes !== undefined ? { deficitMinutes } : {}),
          reasonCodes,
        })),
      },
    };
  },
};
