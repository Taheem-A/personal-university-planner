/** Named, versioned weights for the transparent heuristic-v1 ranking policy. */
export interface PlannerHeuristicConfig {
  capacityPressureWeight: number;
  lowSlackWeight: number;
  deadlineWeight: number;
  preferredCompletionWeight: number;
  importanceWeight: number;
  dependencyWeight: number;
  contextFitWeight: number;
  fragmentationPenaltyWeight: number;
  undesirableTimePenaltyWeight: number;
  priorityOverrideWeight: number;
  maximumPriorityOverride: number;
  capacityPressureCap: number;
  deadlineReferenceHours: number;
  deadlineMinimumHours: number;
  deadlinePressureCap: number;
  deadlineExponent: number;
  lowSlackReferenceMinutes: number;
  comfortableRatio: number;
  criticalRatio: number;
  lateHighEnergyHour: number;
  commuteContextPenalty: number;
  windowEnergyWeight: number;
  windowCapacityWeight: number;
  windowUrgencyWeight: number;
  stabilityWindowBonus: number;
  lateWindowPenalty: number;
}

export const HEURISTIC_V1_CONFIG: Readonly<PlannerHeuristicConfig> = Object.freeze({
  // Capacity must outweigh any single preference, especially when time is nearly exhausted.
  capacityPressureWeight: 8,
  lowSlackWeight: 2.5,
  deadlineWeight: 1.5,
  preferredCompletionWeight: 1,
  importanceWeight: 0.9,
  dependencyWeight: 1.2,
  contextFitWeight: 0.5,
  fragmentationPenaltyWeight: 0.5,
  undesirableTimePenaltyWeight: 0.5,
  priorityOverrideWeight: 0.5,
  maximumPriorityOverride: 1,
  capacityPressureCap: 2,
  // Inverse power makes three hours materially more urgent than six, while capping near-zero time.
  deadlineReferenceHours: 3,
  deadlineMinimumHours: 0.5,
  deadlinePressureCap: 3,
  deadlineExponent: 1.5,
  lowSlackReferenceMinutes: 60,
  comfortableRatio: 0.5,
  criticalRatio: 0.85,
  lateHighEnergyHour: 21,
  commuteContextPenalty: 0.25,
  windowEnergyWeight: 2,
  windowCapacityWeight: 1,
  windowUrgencyWeight: 1,
  stabilityWindowBonus: 0.6,
  lateWindowPenalty: 1.5,
});
