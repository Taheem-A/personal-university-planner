/** Explicit JSON-safe shape returned by the authenticated Planner presentation read. */
export interface PlannerPresentationModel {
  date: string;
  timezone: string;
  status: "UNPLANNED" | "CURRENT" | "RUNNING" | "FAILED";
  authoritativePlanAt: string | null;
  remainingPlannedWorkMinutes: number;
  nextWork: { title: string; courseCode: string | null; startAt: string } | null;
  risks: {
    taskId: string;
    title: string;
    courseCode: string | null;
    feasibility: string;
    deficitMinutes: number;
    slackMinutes: number | null;
  }[];
  warnings: { code: string; taskId?: string; deficitMinutes?: number; reasonCodes: string[] }[];
}
