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
  planningMode: PlanningMode;
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
  now: Date;
  horizonStart: Date;
  horizonEnd: Date;
  tasks: Task[];
  events: CalendarEvent[];
  availability: AvailabilityWindow[];
  lockedSessions: WorkSession[];
  previousSessions?: WorkSession[];
  preferences: PlanningPreferences;
}

export interface PlannerWarning {
  code: "INFEASIBLE" | "LOW_SLACK" | "NO_SUITABLE_WINDOW";
  taskId?: Id;
  message: string;
  deficitMinutes?: number;
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
  sessions: WorkSession[];
  warnings: PlannerWarning[];
  pressures: TaskPressure[];
  unscheduledMinutesByTask: Record<Id, number>;
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
