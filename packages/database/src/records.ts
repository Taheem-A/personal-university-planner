import type {
  IanaTimezone,
  LocalDate,
  LocalTime,
  RecurrenceRule,
} from "@university-planner/shared";

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type AcademicTermStatus = "UPCOMING" | "ACTIVE" | "ARCHIVED";
export type MeetingType = "LECTURE" | "TUTORIAL" | "PRACTICAL" | "LAB" | "SEMINAR" | "OTHER";
export type AssessmentSubmissionStatus =
  "NOT_SUBMITTED" | "SUBMITTED" | "GRADED" | "EXEMPT" | "CANCELLED";
export type TaskStatus =
  "INBOX" | "READY" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED" | "DEFERRED";
export type PlanningMode = "AUTO" | "MANUAL" | "UNSCHEDULED";
export type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";
export type ConstraintLevel = "HARD" | "SOFT" | "INFORMATIONAL";
export type RecordSource = "MANUAL" | "INTEGRATION" | "ASSISTANT" | "SYSTEM";
export type SourceAuthority = "USER" | "EXTERNAL" | "SYSTEM" | "INFERRED";
export type SourceConfidence =
  | "DIRECT_API"
  | "CALENDAR_FEED"
  | "DOCUMENT_EXTRACTION"
  | "AI_EXTRACTED"
  | "MANUAL"
  | "USER_CONFIRMED";
export type WorkSessionState =
  "PLANNED" | "ACTIVE" | "COMPLETED" | "PARTIAL" | "SKIPPED" | "CANCELLED" | "SUPERSEDED";
export type CompletionOutcome = "COMPLETED" | "PARTIAL" | "SKIPPED" | "DONE_EARLY" | "CANCELLED";
export type PlannerRunTrigger =
  | "MANUAL"
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "SESSION_COMPLETED"
  | "SESSION_SKIPPED"
  | "CALENDAR_CHANGED"
  | "DEADLINE_CHANGED"
  | "INTEGRATION_SYNC"
  | "DAILY_REFRESH";
export type PlannerRunStatus = "RUNNING" | "SUCCEEDED" | "FAILED";
export type IntegrationAccountStatus = "ACTIVE" | "DISCONNECTED" | "ERROR";
export type ExternalObjectType = "COURSE" | "ASSESSMENT" | "CALENDAR_EVENT" | "TASK";
export type InboxStatus = "ACTIVE" | "PROCESSED" | "DISMISSED";

interface AuditFields {
  createdAt: Date;
  updatedAt: Date;
}

interface ProvenanceFields {
  source: RecordSource;
  sourceAuthority: SourceAuthority;
  sourceConfidence: SourceConfidence | null;
}

interface LocalRecurrenceFields {
  recurrenceRule: RecurrenceRule;
  startTimeLocal: LocalTime;
  endTimeLocal: LocalTime;
  spansNextDay: boolean;
  timezone: IanaTimezone;
  effectiveFrom: LocalDate;
  effectiveUntil: LocalDate | null;
}

export interface UserRecord extends AuditFields {
  id: string;
  name: string | null;
  timezone: IanaTimezone;
  defaultDayStart: LocalTime | null;
  defaultDayEnd: LocalTime | null;
  locale: string | null;
  planningRevision: number;
}

export interface AcademicTermRecord extends AuditFields {
  id: string;
  version: number;
  userId: string;
  name: string;
  startDate: LocalDate;
  endDate: LocalDate;
  status: AcademicTermStatus;
}

export interface CourseRecord extends AuditFields, ProvenanceFields {
  id: string;
  version: number;
  userId: string;
  academicTermId: string;
  code: string;
  name: string;
  section: string | null;
  instructorName: string | null;
  colorReference: string | null;
  creditValue: number | null;
  defaultTaskEnergy: EnergyLevel | null;
  defaultTaskLocation: string[];
  archivedAt: Date | null;
}

export interface CourseMeetingRecord extends AuditFields, LocalRecurrenceFields {
  id: string;
  version: number;
  userId: string;
  courseId: string;
  meetingType: MeetingType;
  location: string | null;
  attendanceRequired: boolean;
  archivedAt: Date | null;
}

export interface AssessmentRecord extends AuditFields, ProvenanceFields {
  id: string;
  version: number;
  userId: string;
  courseId: string;
  title: string;
  assessmentType: string;
  releaseAt: Date | null;
  dueAt: Date | null;
  preferredCompletionAt: Date | null;
  gradeWeight: number | null;
  gradeReceived: number | null;
  notes: string | null;
  instructionsUrl: string | null;
  submissionUrl: string | null;
  submissionStatus: AssessmentSubmissionStatus;
  submittedAt: Date | null;
  archivedAt: Date | null;
}

export interface TaskRecord extends AuditFields, ProvenanceFields {
  id: string;
  version: number;
  userId: string;
  courseId: string | null;
  assessmentId: string | null;
  recurringWorkRuleId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priorityOverride: number | null;
  availableFrom: Date | null;
  dueAt: Date | null;
  preferredCompletionAt: Date | null;
  originalEstimatedMinutes: number | null;
  currentEstimatedMinutes: number | null;
  remainingMinutes: number | null;
  energyRequirement: EnergyLevel | null;
  locationRequirements: string[];
  minimumSessionMinutes: number | null;
  preferredSessionMinutes: number | null;
  maximumSessionMinutes: number | null;
  splittable: boolean;
  interruptible: boolean;
  planningMode: PlanningMode;
  completedAt: Date | null;
  archivedAt: Date | null;
}

export interface TaskDependencyRecord {
  userId: string;
  prerequisiteTaskId: string;
  dependentTaskId: string;
  dependencyType: "FINISH_TO_START";
  createdAt: Date;
}

export interface RecurringWorkRuleRecord extends AuditFields {
  id: string;
  userId: string;
  courseId: string;
  anchorCourseMeetingId: string | null;
  titleTemplate: string;
  descriptionTemplate: string | null;
  recurrenceRule: RecurrenceRule;
  anchorTimeLocal: LocalTime;
  timezone: IanaTimezone;
  effectiveFrom: LocalDate;
  effectiveUntil: LocalDate | null;
  availableOffsetMinutes: number;
  dueOffsetMinutes: number | null;
  originalEstimatedMinutes: number | null;
  energyRequirement: EnergyLevel | null;
  locationRequirements: string[];
  minimumSessionMinutes: number | null;
  preferredSessionMinutes: number | null;
  maximumSessionMinutes: number | null;
  splittable: boolean;
  interruptible: boolean;
  planningMode: PlanningMode;
  active: boolean;
}

export interface CalendarEventRecord extends AuditFields, ProvenanceFields {
  id: string;
  version: number;
  userId: string;
  courseId: string | null;
  integrationAccountId: string | null;
  title: string;
  eventType: string;
  startAt: Date;
  endAt: Date;
  location: string | null;
  constraintLevel: ConstraintLevel;
  externalId: string | null;
  externalUpdatedAt: Date | null;
  archivedAt: Date | null;
}

export interface AvailabilityRuleRecord extends AuditFields, LocalRecurrenceFields {
  id: string;
  version: number;
  userId: string;
  capacityFactor: number;
  energyLevel: EnergyLevel;
  allowedLocationTags: string[];
  active: boolean;
}

export interface ProtectedTimeRuleRecord extends AuditFields, LocalRecurrenceFields {
  id: string;
  version: number;
  userId: string;
  protectionLevel: ConstraintLevel;
  reason: string;
  isSleep: boolean;
  active: boolean;
}

export interface PlanningPreferenceRecord extends AuditFields {
  id: string;
  version: number;
  userId: string;
  preferredDailyStudyLimitMinutes: number;
  minimumFreeTimeMinutes: number;
  preferredDeadlineBufferHours: number;
  avoidLateHighEnergyTasks: boolean;
  maximumConsecutiveWorkMinutes: number;
  minimumBreakMinutes: number;
  scheduleCommuteWork: boolean;
  weekendWorkBias: number;
  planStabilityWindowMinutes: number;
  /** Null until the user explicitly supplies this non-negotiable boundary. */
  minimumSleepMinutes: number | null;
}

export interface WorkSessionRecord extends AuditFields {
  id: string;
  version: number;
  userId: string;
  taskId: string;
  plannerRunId: string | null;
  startAt: Date;
  endAt: Date;
  plannedMinutes: number;
  state: WorkSessionState;
  generatedBy: "PLANNER" | "USER";
  locked: boolean;
  supersededById: string | null;
}

export interface CompletionRecordRecord {
  id: string;
  userId: string;
  taskId: string;
  workSessionId: string | null;
  outcome: CompletionOutcome;
  actualMinutes: number | null;
  remainingAfterMinutes: number | null;
  recordedAt: Date;
  note: string | null;
}

export interface EstimateProfileRecord extends AuditFields {
  id: string;
  userId: string;
  contextType: string;
  contextKey: string;
  sampleCount: number;
  meanRatio: number | null;
  medianRatio: number | null;
  recentRatio: number | null;
  confidence: number;
  modelVersion: string | null;
}

export interface PlannerRunRecord {
  id: string;
  userId: string;
  startedAt: Date;
  completedAt: Date | null;
  triggerType: PlannerRunTrigger;
  triggerEntityType: string | null;
  triggerEntityId: string | null;
  idempotencyScope: string | null;
  idempotencyKey: string | null;
  planningHorizonStart: Date;
  planningHorizonEnd: Date;
  plannerVersion: string;
  inputSnapshot: JsonValue;
  summary: JsonValue | null;
  warnings: JsonValue | null;
  status: PlannerRunStatus;
}

/** Bounded diagnostic payloads; raw task titles or provider data stay out of summaries. */
export interface PlannerRunCompletionSummary {
  planStatus: "VALID" | "INFEASIBLE";
  generatedSessionCount: number;
  retainedSessionCount: number;
  unscheduledMinutes: number;
}

export interface PlannerRunStoredWarning {
  code: string;
  taskId?: string;
  deficitMinutes?: number;
  reasonCodes: string[];
}

export interface IntegrationAccountRecord extends AuditFields {
  id: string;
  version: number;
  userId: string;
  provider: string;
  externalAccountId: string;
  displayName: string | null;
  status: IntegrationAccountStatus;
  credentialReference: string | null;
  lastSyncAt: Date | null;
  lastSuccessAt: Date | null;
  disconnectedAt: Date | null;
}

export interface ExternalObjectMapRecord extends AuditFields {
  id: string;
  userId: string;
  integrationAccountId: string;
  provider: string;
  externalId: string;
  internalType: ExternalObjectType;
  internalId: string;
  externalUpdatedAt: Date | null;
  lastSyncedAt: Date | null;
  sourceHash: string | null;
}

export interface InboxItemRecord extends AuditFields, ProvenanceFields {
  id: string;
  version: number;
  userId: string;
  rawText: string;
  status: InboxStatus;
  proposedEntityType: string | null;
  proposedPayload: JsonValue | null;
  processedAt: Date | null;
}
