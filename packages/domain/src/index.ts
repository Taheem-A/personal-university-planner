import type {
  IanaTimezone,
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
  importance: number;
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

export interface PlannerDependency {
  prerequisiteTaskId: Id;
  dependentTaskId: Id;
  type: "FINISH_TO_START";
}

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
  dependencies: PlannerDependency[];
  events: CalendarEvent[];
  protectedWindows: PlannerProtectedWindow[];
  sleepWindows: PlannerSleepWindow[];
  availability: AvailabilityWindow[];
  manualSessions: WorkSession[];
  lockedSessions: WorkSession[];
  previousSessions: WorkSession[];
  /** Explicit replan intent; incremental is the ordinary scheduling mode. */
  replanMode: "INCREMENTAL" | "FULL" | "SCENARIO";
  releasedTimePolicy: "REPLAN_IF_USEFUL" | "LEAVE_FREE";
  /** Minimum protected sleep across each local day, supplied by application policy. */
  minimumSleepMinutes: number;
  preferences: PlanningPreferences;
}

export type PlannerVersion = "heuristic-v1";
export type PlannerReasonCode =
  | "DEADLINE_PRESSURE"
  | "LOW_SLACK"
  | "ENERGY_MATCH"
  | "LOCATION_MATCH"
  | "STABILITY_PRESERVED"
  | "HARD_CONSTRAINT"
  | "DEPENDENCY_BLOCKED"
  | "NO_SUITABLE_WINDOW"
  | "INSUFFICIENT_CAPACITY";

export interface PlannerWarning {
  code: "INFEASIBLE" | "LOW_SLACK" | "NO_SUITABLE_WINDOW";
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
  pressureRatio: number;
  score: number;
}

export interface PlannerOutput {
  plannerVersion: PlannerVersion;
  sessions: WorkSession[];
  warnings: PlannerWarning[];
  pressures: TaskPressure[];
  unscheduledMinutesByTask: Record<Id, number>;
  /** Reserved for placement explanations; later Milestone-3 slices populate it. */
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
  canApply: boolean;
  deadlineSafe: boolean;
}
