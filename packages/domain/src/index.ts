import type {
  IanaTimezone,
  LocalRecurrenceWindow,
  LocalDate,
  LocalTime,
  RecurrenceRule,
} from "@university-planner/shared";

export type {
  IanaTimezone,
  LocalDate,
  LocalTime,
  RecurrenceRule,
} from "@university-planner/shared";

export type Id = string;

export type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";
export type ConstraintLevel = "HARD" | "SOFT" | "INFORMATIONAL";
export type PlanningMode = "AUTO" | "MANUAL" | "UNSCHEDULED";
export type AssessmentSubmissionStatus =
  "NOT_SUBMITTED" | "SUBMITTED" | "GRADED" | "EXEMPT" | "CANCELLED";
export type RecordSource = "MANUAL" | "INTEGRATION" | "ASSISTANT" | "SYSTEM";
export type SourceAuthority = "USER" | "EXTERNAL" | "SYSTEM" | "INFERRED";
export type TaskStatus =
  "INBOX" | "READY" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED" | "DEFERRED";

export type WorkSessionState =
  "PLANNED" | "ACTIVE" | "COMPLETED" | "PARTIAL" | "SKIPPED" | "CANCELLED" | "SUPERSEDED";

export type LocationTag =
  | "ANYWHERE"
  | "DESK"
  | "CAMPUS"
  | "HOME"
  | "TRANSIT_OK"
  | "COMPUTER"
  | "HANDWRITING"
  | "INTERNET_REQUIRED";

export interface Course {
  id: Id;
  userId: Id;
  academicTermId: Id;
  code: string;
  name: string;
  colorReference?: string;
}

export interface AcademicTerm {
  id: Id;
  userId: Id;
  name: string;
  startDate: LocalDate;
  endDate: LocalDate;
  status: "UPCOMING" | "ACTIVE" | "ARCHIVED";
}

export interface LocalRecurringWindow {
  recurrenceRule: RecurrenceRule;
  startTimeLocal: LocalTime;
  endTimeLocal: LocalTime;
  spansNextDay: boolean;
  timezone: IanaTimezone;
  effectiveFrom: LocalDate;
  effectiveUntil?: LocalDate;
}

export interface CourseMeeting extends LocalRecurringWindow {
  id: Id;
  userId: Id;
  courseId: Id;
  meetingType: "LECTURE" | "TUTORIAL" | "PRACTICAL" | "LAB" | "SEMINAR" | "OTHER";
  location?: string;
  attendanceRequired: boolean;
}

export interface Assessment {
  id: Id;
  userId: Id;
  courseId: Id;
  title: string;
  assessmentType: string;
  releaseAt?: Date;
  dueAt?: Date;
  preferredCompletionAt?: Date;
  submissionStatus: AssessmentSubmissionStatus;
  submittedAt?: Date;
}

export interface Task {
  id: Id;
  userId: Id;
  courseId?: Id;
  assessmentId?: Id;
  parentTaskId?: Id;
  title: string;
  description?: string;
  status: TaskStatus;
  priorityOverride?: number;
  availableFrom?: Date;
  dueAt?: Date;
  preferredCompletionAt?: Date;
  currentEstimatedMinutes?: number;
  originalEstimatedMinutes?: number;
  remainingMinutes?: number;
  energyRequirement?: EnergyLevel;
  locationRequirements: LocationTag[];
  minimumSessionMinutes?: number;
  preferredSessionMinutes?: number;
  maximumSessionMinutes?: number;
  splittable: boolean;
  interruptible: boolean;
  planningMode: PlanningMode;
}

/** Plain planner snapshot, assembled and validated outside planner-core. */
export interface PlannableTask {
  id: Id;
  userId: Id;
  title: string;
  status: TaskStatus;
  planningMode: PlanningMode;
  availableFrom: Date;
  dueAt?: Date;
  preferredCompletionAt?: Date;
  currentEstimatedMinutes: number;
  originalEstimatedMinutes: number;
  remainingMinutes: number;
  energyRequirement: EnergyLevel;
  locationRequirements: LocationTag[];
  minimumSessionMinutes: number;
  preferredSessionMinutes: number;
  maximumSessionMinutes: number;
  splittable: boolean;
  interruptible: boolean;
  priorityOverride?: number;
  /** Normalized, source-independent importance in [0, 1]. */
  importance?: number;
  /** Whether the due instant is fixed or still tentative. */
  deadlineConfidence: "FIXED" | "TENTATIVE" | "UNKNOWN";
}

export interface TaskDependency {
  userId: Id;
  prerequisiteTaskId: Id;
  dependentTaskId: Id;
  dependencyType: "FINISH_TO_START";
}

export interface RecurringWorkRule {
  id: Id;
  userId: Id;
  courseId: Id;
  anchorCourseMeetingId?: Id;
  titleTemplate: string;
  recurrenceRule: RecurrenceRule;
  anchorTimeLocal: LocalTime;
  timezone: IanaTimezone;
  effectiveFrom: LocalDate;
  effectiveUntil?: LocalDate;
  availableOffsetMinutes: number;
  dueOffsetMinutes?: number;
  originalEstimatedMinutes?: number;
  active: boolean;
}

export interface CalendarEvent {
  id: Id;
  userId: Id;
  courseId?: Id;
  title: string;
  startAt: Date;
  endAt: Date;
  constraintLevel: ConstraintLevel;
  location?: string;
  source?: string;
}

export interface AvailabilityWindow {
  id: Id;
  userId: Id;
  startAt: Date;
  endAt: Date;
  capacityFactor: number;
  energyLevel: EnergyLevel;
  allowedLocationTags: LocationTag[];
  /** Commute capacity is usable only when the user's policy permits it. */
  kind?: "ORDINARY" | "COMMUTE";
}

/** Expanded, half-open planner interval. Recurrence expansion happens before core entry. */
export interface PlannerProtectedWindow {
  id: Id;
  startAt: Date;
  endAt: Date;
  level: "HARD" | "SOFT";
  reason: string;
}

export interface PlannerSleepWindow {
  id: Id;
  startAt: Date;
  endAt: Date;
}

/** Capacity explicitly released by an outcome before planner invocation. */
export interface PlannerReleasedWindow {
  id: Id;
  startAt: Date;
  endAt: Date;
}

export interface PlannerDependency {
  prerequisiteTaskId: Id;
  dependentTaskId: Id;
  type: "FINISH_TO_START";
}

/** Local wall-clock rules expand inside normalization, before capacity is calculated. */
export type PlannerRecurringWindow = LocalRecurrenceWindow & { id: Id } & (
    | { source: "EVENT"; title: string; constraintLevel: ConstraintLevel }
    | { source: "PROTECTED"; level: "HARD" | "SOFT"; reason: string }
    | { source: "SLEEP" }
    | {
        source: "AVAILABILITY";
        capacityFactor: number;
        energyLevel: EnergyLevel;
        allowedLocationTags: LocationTag[];
        availabilityKind?: "ORDINARY" | "COMMUTE";
      }
  );

export interface WorkSession {
  id: Id;
  userId: Id;
  taskId: Id;
  startAt: Date;
  endAt: Date;
  plannedMinutes: number;
  state: WorkSessionState;
  generatedBy: "PLANNER" | "USER";
  locked: boolean;
  supersededById?: Id;
}

export interface PlanningPreferences {
  preferredDailyStudyLimitMinutes: number;
  minimumFreeTimeMinutes: number;
  preferredDeadlineBufferHours: number;
  avoidLateHighEnergyTasks: boolean;
  maximumConsecutiveWorkMinutes: number;
  minimumBreakMinutes: number;
  scheduleCommuteWork: boolean;
  weekendWorkBias: number;
  planStabilityWindowMinutes: number;
}

export interface CompletionRecord {
  id: Id;
  userId: Id;
  taskId: Id;
  workSessionId?: Id;
  outcome: "COMPLETED" | "PARTIAL" | "SKIPPED" | "DONE_EARLY" | "CANCELLED";
  actualMinutes?: number;
  remainingAfterMinutes?: number;
  recordedAt: Date;
}

export interface PlannerInput {
  userId: Id;
  timezone: IanaTimezone;
  now: Date;
  horizonStart: Date;
  horizonEnd: Date;
  tasks: PlannableTask[];
  /** Completed prerequisites whose original estimates need not be supplied. */
  completedTaskIds: Id[];
  dependencies: PlannerDependency[];
  events: CalendarEvent[];
  protectedWindows: PlannerProtectedWindow[];
  sleepWindows: PlannerSleepWindow[];
  recurringWindows: PlannerRecurringWindow[];
  availability: AvailabilityWindow[];
  manualSessions: WorkSession[];
  lockedSessions: WorkSession[];
  previousSessions: WorkSession[];
  releasedWindows: PlannerReleasedWindow[];
  /** Explicit replan intent; incremental is the ordinary scheduling mode. */
  replanMode: "INCREMENTAL" | "FULL" | "SCENARIO";
  releasedTimePolicy: "KEEP_FREE" | "LEAVE_FREE" | "REPLAN_IF_USEFUL" | "ALWAYS_REPLAN";
  /** Minimum protected sleep across each local day, supplied by application policy. */
  minimumSleepMinutes: number;
  preferences: PlanningPreferences;
}

export type PlannerVersion = "heuristic-v1";
export type PlannerReasonCode =
  | "DEADLINE_PRESSURE"
  | "PREFERRED_COMPLETION_PRESSURE"
  | "LOW_SLACK"
  | "ENERGY_MATCH"
  | "LOCATION_MATCH"
  | "PREREQUISITE"
  | "ONLY_SUITABLE_CAPACITY"
  | "AVOIDED_OVERLOAD"
  | "AVOIDED_FRAGMENTATION"
  | "STABILITY_PRESERVED"
  | "HARD_CONSTRAINT"
  | "DEPENDENCY_BLOCKED"
  | "NO_SUITABLE_WINDOW"
  | "INSUFFICIENT_CAPACITY"
  | "DAILY_STUDY_LIMIT_EXCEEDED"
  | "FREE_TIME_BUFFER_USED"
  | "DEADLINE_BUFFER_USED"
  | "SOFT_TIME_USED"
  | "RELEASED_TIME_USED"
  | "STABILITY_RELAXED"
  | "HARD_CONFLICT"
  | "MANUAL_INTENT_PRESERVED"
  | "LOCK_PRESERVED";

export type PlannerLimitingFactor =
  | "NO_SUITABLE_WINDOW"
  | "INSUFFICIENT_CAPACITY"
  | "HARD_COMMITMENT"
  | "PROTECTED_TIME"
  | "LOCK_PRESSURE"
  | "DEADLINE_COLLISION"
  | "CAPABILITY_MISMATCH"
  | "COMMUTE_DISABLED"
  | "DEPENDENCY_BLOCKED"
  | "HORIZON_LIMIT";

export interface PlannerValidationIssue {
  code: string;
  message: string;
  sessionId?: Id;
  taskId?: Id;
  /** Minutes of a measured overlap or missing break, when applicable. */
  conflictMinutes?: number;
  /** A retained user/locked session is reported but never silently moved. */
  retained: boolean;
}

export interface PlannerInfeasibility {
  taskId: Id;
  requiredMinutes: number;
  scheduledMinutes: number;
  unscheduledMinutes: number;
  suitableCapacityMinutes: number;
  deficitMinutes: number;
  limitingFactors: PlannerLimitingFactor[];
  actualDeadlineAt?: Date;
}

export interface PlannerWarning {
  code:
    | "INFEASIBLE"
    | "LOW_SLACK"
    | "NO_SUITABLE_WINDOW"
    | "DEPENDENCY_BLOCKED"
    | "DAILY_STUDY_LIMIT_EXCEEDED"
    | "FREE_TIME_BUFFER_USED"
    | "DEADLINE_BUFFER_USED"
    | "SOFT_TIME_USED"
    | "STABILITY_RELAXED"
    | "HARD_CONFLICT";
  taskId?: Id;
  message: string;
  deficitMinutes?: number;
  reasonCodes?: PlannerReasonCode[];
}

export interface TaskPressure {
  taskId: Id;
  suitableCapacityMinutes: number;
  remainingMinutes: number;
  slackMinutes: number;
  /** Null means positive work with zero suitable capacity. */
  pressureRatio: number | null;
  capacityDeficitMinutes: number;
  feasibility: "COMFORTABLE" | "CONSTRAINED" | "CRITICAL" | "INFEASIBLE" | "HORIZON_LIMITED";
  actualDeadlineAt?: Date;
  deadlineHoursRemaining?: number;
  preferredCompletionTargetAt?: Date;
  preferredTargetSource: "EXPLICIT" | "BUFFER" | "NONE";
  preferredCapacityMinutes?: number;
  preferredSlackMinutes?: number;
  dependencyReadyAt?: Date;
  scoreComponents: {
    capacityPressure: number;
    lowSlackPressure: number;
    deadlinePressure: number;
    preferredCompletionPressure: number;
    importance: number;
    importanceKnown: boolean;
    dependencyImportance: number;
    contextFit: number;
    fragmentationCost: number;
    undesirableTimeCost: number;
    priorityOverride: number;
  };
  score: number;
  rank: number;
}

export interface PlannerOutput {
  plannerVersion: PlannerVersion;
  status: "VALID" | "INFEASIBLE";
  sessions: WorkSession[];
  validationIssues: PlannerValidationIssue[];
  infeasibilities: PlannerInfeasibility[];
  warnings: PlannerWarning[];
  pressures: TaskPressure[];
  rankedTaskIds: Id[];
  allocationOrderTaskIds: Id[];
  unscheduledMinutesByTask: Record<Id, number>;
  reasonsBySession: Record<Id, PlannerReasonCode[]>;
}

export interface ScenarioRequest {
  title: string;
  startAt: Date;
  endAt: Date;
  protectionLevel: "HARD" | "SOFT";
}

export interface ScenarioResult {
  request: ScenarioRequest;
  before: PlannerOutput;
  after: PlannerOutput;
  movedTaskIds: Id[];
  addedSessionIds: Id[];
  removedSessionIds: Id[];
  movedSessionIds: Id[];
  capacityDeltaMinutes: number;
  deficitDeltaMinutes: number;
  canApply: boolean;
  deadlineSafe: boolean;
}
