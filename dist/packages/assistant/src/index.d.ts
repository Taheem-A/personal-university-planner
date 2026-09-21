import type { Id, PlanningPreferences, TaskStatus } from "../../domain/src";
export type PlannerToolName = "get_today_plan" | "get_week_plan" | "list_tasks" | "create_task" | "update_task" | "complete_task" | "record_partial" | "set_protected_time" | "update_preferences" | "replan" | "simulate_plan" | "explain_plan" | "get_risk" | "get_forecast";
export type AssistantMutation = {
    type: "CREATE_TASK";
    title: string;
    dueAt?: Date;
    estimatedMinutes?: number;
    courseId?: Id;
} | {
    type: "UPDATE_TASK_STATUS";
    taskId: Id;
    status: TaskStatus;
} | {
    type: "RECORD_PARTIAL";
    taskId: Id;
    remainingMinutes: number;
} | {
    type: "CREATE_PROTECTED_WINDOW";
    startAt: Date;
    endAt: Date;
    protection: "HARD" | "SOFT";
    reason: string;
} | {
    type: "UPDATE_PLANNING_PREFERENCES";
    patch: Partial<PlanningPreferences>;
} | {
    type: "REPLAN";
    mode: "INCREMENTAL" | "FULL";
};
export interface ScenarioIntent {
    type: "SIMULATE";
    description: string;
    proposedMutations: AssistantMutation[];
}
export interface ApplyIntent {
    type: "APPLY";
    mutations: AssistantMutation[];
}
export type PlannerAssistantIntent = ScenarioIntent | ApplyIntent;
/**
 * Natural language never becomes canonical state directly. The assistant layer
 * produces validated structured intent; application services own persistence and
 * planner invocation.
 */
export interface PlannerAssistantInterpreter {
    interpret(input: string): Promise<PlannerAssistantIntent>;
}
