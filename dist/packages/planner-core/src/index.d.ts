import { PlannerInput, PlannerOutput, ScenarioRequest, ScenarioResult, WorkSession } from "../../domain/src";
export declare function validatePlan(sessions: WorkSession[], input: PlannerInput): string[];
export declare function generatePlan(input: PlannerInput): PlannerOutput;
export declare function simulateProtectedWindow(input: PlannerInput, request: ScenarioRequest): ScenarioResult;
