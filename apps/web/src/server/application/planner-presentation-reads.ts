import { plannerViews, type TodayViewModel } from "./planner-reads";
import type { ApplicationResult } from "./errors";
import type { PlannerPresentationModel } from "../../lib/planner-presentation-model";

export function buildPlannerPresentation(today: TodayViewModel): PlannerPresentationModel {
  return {
    date: today.date,
    timezone: today.timezone,
    status: today.planner.status,
    authoritativePlanAt: today.planner.authoritativeRun?.completedAt?.toISOString() ?? null,
    remainingPlannedWorkMinutes: today.remainingPlannedWorkMinutes,
    nextWork: today.nextWorkItem
      ? {
          title: today.nextWorkItem.title,
          courseCode: today.nextWorkItem.courseCode ?? null,
          startAt: today.nextWorkItem.startAt.toISOString(),
        }
      : null,
    risks: today.risks.map((risk) => ({
      taskId: risk.taskId,
      title: risk.title,
      courseCode: risk.courseCode,
      feasibility: risk.feasibility,
      deficitMinutes: risk.deficitMinutes,
      slackMinutes: risk.slackMinutes,
    })),
    warnings: today.warnings.map((warning) => ({ ...warning })),
  };
}

export const plannerPresentation = {
  async current(): Promise<ApplicationResult<PlannerPresentationModel>> {
    const result = await plannerViews.today();
    return result.ok ? { ok: true, value: buildPlannerPresentation(result.value) } : result;
  },
};
