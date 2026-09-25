import type {
  AcademicTermRecord,
  AcademicTermStatus,
  AssessmentRecord,
  AvailabilityRuleRecord,
  CalendarEventRecord,
  CompletionRecordRecord,
  CourseMeetingRecord,
  CourseRecord,
  EstimateProfileRecord,
  ExternalObjectMapRecord,
  InboxItemRecord,
  InboxStatus,
  IntegrationAccountRecord,
  IntegrationAccountStatus,
  PlannerRunRecord,
  PlannerRunCompletionSummary,
  PlannerRunStoredWarning,
  PlanningPreferenceRecord,
  ProtectedTimeRuleRecord,
  RecurringWorkRuleRecord,
  TaskDependencyRecord,
  TaskRecord,
  TaskStatus,
  UserRecord,
  WorkSessionRecord,
  WorkSessionState,
} from "../records.js";

export interface UserRepository {
  create(
    record: Omit<UserRecord, "planningRevision"> & { planningRevision?: number },
  ): Promise<UserRecord>;
  getById(id: string): Promise<UserRecord | null>;
  updateProfile(
    id: string,
    patch: Pick<UserRecord, "name" | "timezone" | "defaultDayStart" | "defaultDayEnd" | "locale">,
  ): Promise<UserRecord>;
}

/** Authentication infrastructure, never a planner domain entity. */
export interface AuthIdentityRepository {
  findUser(provider: string, providerAccountId: string): Promise<UserRecord | null>;
  /** Atomic identity and user creation; a simultaneous callback resolves the winner. */
  provisionUser(provider: string, providerAccountId: string): Promise<UserRecord>;
}

export type ConditionalMutation<T> =
  { status: "UPDATED"; record: T } | { status: "STALE" } | { status: "NOT_FOUND" };

export interface AcademicTermRepository {
  create(record: AcademicTermRecord): Promise<AcademicTermRecord>;
  getForUser(userId: string, id: string): Promise<AcademicTermRecord | null>;
  listForUser(userId: string): Promise<AcademicTermRecord[]>;
  updateStatus(userId: string, id: string, status: AcademicTermStatus): Promise<AcademicTermRecord>;
  updateIfCurrent(
    userId: string,
    id: string,
    expectedVersion: number,
    patch: Partial<Pick<AcademicTermRecord, "name" | "startDate" | "endDate" | "status">>,
  ): Promise<ConditionalMutation<AcademicTermRecord>>;
}

export interface CourseRepository {
  create(record: CourseRecord): Promise<CourseRecord>;
  getForUser(userId: string, id: string): Promise<CourseRecord | null>;
  listForTerm(userId: string, academicTermId: string): Promise<CourseRecord[]>;
  archive(userId: string, id: string, archivedAt: Date): Promise<CourseRecord>;
  updateIfCurrent(
    userId: string,
    id: string,
    expectedVersion: number,
    patch: Partial<
      Pick<
        CourseRecord,
        | "code"
        | "name"
        | "section"
        | "instructorName"
        | "colorReference"
        | "creditValue"
        | "defaultTaskEnergy"
        | "defaultTaskLocation"
        | "archivedAt"
      >
    >,
  ): Promise<ConditionalMutation<CourseRecord>>;
}

export interface CourseMeetingRepository {
  create(record: CourseMeetingRecord): Promise<CourseMeetingRecord>;
  getForUser(userId: string, id: string): Promise<CourseMeetingRecord | null>;
  listForCourse(userId: string, courseId: string): Promise<CourseMeetingRecord[]>;
  updateIfCurrent(
    userId: string,
    id: string,
    expectedVersion: number,
    patch: Partial<
      Pick<
        CourseMeetingRecord,
        | "meetingType"
        | "recurrenceRule"
        | "startTimeLocal"
        | "endTimeLocal"
        | "spansNextDay"
        | "timezone"
        | "location"
        | "effectiveFrom"
        | "effectiveUntil"
        | "attendanceRequired"
        | "archivedAt"
      >
    >,
  ): Promise<ConditionalMutation<CourseMeetingRecord>>;
}

export interface AssessmentRepository {
  create(record: AssessmentRecord): Promise<AssessmentRecord>;
  getForUser(userId: string, id: string): Promise<AssessmentRecord | null>;
  listForCourse(userId: string, courseId: string): Promise<AssessmentRecord[]>;
  archive(userId: string, id: string, archivedAt: Date): Promise<AssessmentRecord>;
  updateIfCurrent(
    userId: string,
    id: string,
    expectedVersion: number,
    patch: Partial<
      Pick<
        AssessmentRecord,
        | "title"
        | "assessmentType"
        | "releaseAt"
        | "dueAt"
        | "preferredCompletionAt"
        | "gradeWeight"
        | "gradeReceived"
        | "notes"
        | "instructionsUrl"
        | "submissionUrl"
        | "submissionStatus"
        | "submittedAt"
        | "archivedAt"
      >
    >,
  ): Promise<ConditionalMutation<AssessmentRecord>>;
}

export interface TaskRepository {
  create(record: TaskRecord): Promise<TaskRecord>;
  getForUser(userId: string, id: string): Promise<TaskRecord | null>;
  listForUser(userId: string, statuses?: TaskStatus[]): Promise<TaskRecord[]>;
  listSubtasks(userId: string, parentTaskId: string): Promise<TaskRecord[]>;
  update(
    userId: string,
    id: string,
    patch: Partial<
      Pick<
        TaskRecord,
        | "title"
        | "description"
        | "status"
        | "currentEstimatedMinutes"
        | "remainingMinutes"
        | "completedAt"
        | "parentTaskId"
        | "courseId"
        | "assessmentId"
        | "dueAt"
        | "preferredCompletionAt"
        | "availableFrom"
        | "minimumSessionMinutes"
        | "preferredSessionMinutes"
        | "maximumSessionMinutes"
        | "archivedAt"
      >
    >,
  ): Promise<TaskRecord>;
  updateIfCurrent(
    userId: string,
    id: string,
    expectedVersion: number,
    patch: Partial<
      Pick<
        TaskRecord,
        | "title"
        | "description"
        | "status"
        | "currentEstimatedMinutes"
        | "remainingMinutes"
        | "completedAt"
        | "parentTaskId"
        | "courseId"
        | "assessmentId"
        | "dueAt"
        | "preferredCompletionAt"
        | "availableFrom"
        | "originalEstimatedMinutes"
        | "minimumSessionMinutes"
        | "preferredSessionMinutes"
        | "maximumSessionMinutes"
        | "archivedAt"
      >
    >,
  ): Promise<
    { status: "UPDATED"; record: TaskRecord } | { status: "STALE" } | { status: "NOT_FOUND" }
  >;
  archive(userId: string, id: string, archivedAt: Date): Promise<TaskRecord>;
}

export interface TaskDependencyRepository {
  add(record: TaskDependencyRecord): Promise<TaskDependencyRecord>;
  listForTask(userId: string, taskId: string): Promise<TaskDependencyRecord[]>;
  listForUser(userId: string): Promise<TaskDependencyRecord[]>;
  remove(userId: string, prerequisiteTaskId: string, dependentTaskId: string): Promise<void>;
}

export interface RecurringWorkRuleRepository {
  create(record: RecurringWorkRuleRecord): Promise<RecurringWorkRuleRecord>;
  getForUser(userId: string, id: string): Promise<RecurringWorkRuleRecord | null>;
  listForCourse(userId: string, courseId: string): Promise<RecurringWorkRuleRecord[]>;
  setActive(userId: string, id: string, active: boolean): Promise<RecurringWorkRuleRecord>;
}

export interface CalendarEventRepository {
  create(record: CalendarEventRecord): Promise<CalendarEventRecord>;
  getForUser(userId: string, id: string): Promise<CalendarEventRecord | null>;
  listForRange(userId: string, startAt: Date, endAt: Date): Promise<CalendarEventRecord[]>;
  archive(userId: string, id: string, archivedAt: Date): Promise<CalendarEventRecord>;
  updateIfCurrent(
    userId: string,
    id: string,
    version: number,
    patch: Partial<
      Pick<
        CalendarEventRecord,
        | "title"
        | "eventType"
        | "startAt"
        | "endAt"
        | "location"
        | "constraintLevel"
        | "courseId"
        | "archivedAt"
      >
    >,
  ): Promise<ConditionalMutation<CalendarEventRecord>>;
}

export interface AvailabilityRuleRepository {
  create(record: AvailabilityRuleRecord): Promise<AvailabilityRuleRecord>;
  getForUser(userId: string, id: string): Promise<AvailabilityRuleRecord | null>;
  listActive(userId: string): Promise<AvailabilityRuleRecord[]>;
  setActive(userId: string, id: string, active: boolean): Promise<AvailabilityRuleRecord>;
  updateIfCurrent(
    userId: string,
    id: string,
    version: number,
    patch: Partial<
      Omit<AvailabilityRuleRecord, "id" | "userId" | "version" | "createdAt" | "updatedAt">
    >,
  ): Promise<ConditionalMutation<AvailabilityRuleRecord>>;
}

export interface ProtectedTimeRuleRepository {
  create(record: ProtectedTimeRuleRecord): Promise<ProtectedTimeRuleRecord>;
  getForUser(userId: string, id: string): Promise<ProtectedTimeRuleRecord | null>;
  listActive(userId: string): Promise<ProtectedTimeRuleRecord[]>;
  setActive(userId: string, id: string, active: boolean): Promise<ProtectedTimeRuleRecord>;
  updateIfCurrent(
    userId: string,
    id: string,
    version: number,
    patch: Partial<
      Omit<ProtectedTimeRuleRecord, "id" | "userId" | "version" | "createdAt" | "updatedAt">
    >,
  ): Promise<ConditionalMutation<ProtectedTimeRuleRecord>>;
}

export interface PlanningPreferenceRepository {
  getForUser(userId: string): Promise<PlanningPreferenceRecord | null>;
  create(record: PlanningPreferenceRecord): Promise<PlanningPreferenceRecord>;
  upsert(record: PlanningPreferenceRecord): Promise<PlanningPreferenceRecord>;
  updateIfCurrent(
    userId: string,
    version: number,
    patch: Partial<
      Omit<PlanningPreferenceRecord, "id" | "userId" | "version" | "createdAt" | "updatedAt">
    >,
  ): Promise<ConditionalMutation<PlanningPreferenceRecord>>;
}

export interface WorkSessionRepository {
  create(record: WorkSessionRecord): Promise<WorkSessionRecord>;
  /** Caller supplies one transaction; all rows must be new, unlocked planner output. */
  createGeneratedBatch(userId: string, records: WorkSessionRecord[]): Promise<WorkSessionRecord[]>;
  getForUser(userId: string, id: string): Promise<WorkSessionRecord | null>;
  listForRange(userId: string, startAt: Date, endAt: Date): Promise<WorkSessionRecord[]>;
  listActiveGenerated(userId: string, startAt: Date, endAt: Date): Promise<WorkSessionRecord[]>;
  listRetainedIntent(userId: string, startAt: Date, endAt: Date): Promise<WorkSessionRecord[]>;
  updateState(userId: string, id: string, state: WorkSessionState): Promise<WorkSessionRecord>;
  /** Guarded: planner-owned, unlocked, active rows only. Null means no replacement. */
  supersede(userId: string, id: string, supersededById: string | null): Promise<WorkSessionRecord>;
  supersedeGenerated(
    userId: string,
    changes: { id: string; replacementId: string | null }[],
  ): Promise<WorkSessionRecord[]>;
  updateIfCurrent(
    userId: string,
    id: string,
    version: number,
    patch: Partial<
      Pick<WorkSessionRecord, "state" | "locked" | "startAt" | "endAt" | "plannedMinutes">
    >,
  ): Promise<ConditionalMutation<WorkSessionRecord>>;
}

export interface CompletionRecordRepository {
  create(record: CompletionRecordRecord): Promise<CompletionRecordRecord>;
  getForUser(userId: string, id: string): Promise<CompletionRecordRecord | null>;
  listForTask(userId: string, taskId: string): Promise<CompletionRecordRecord[]>;
}

export interface EstimateProfileRepository {
  getForContext(
    userId: string,
    contextType: string,
    contextKey: string,
  ): Promise<EstimateProfileRecord | null>;
  upsert(record: EstimateProfileRecord): Promise<EstimateProfileRecord>;
}

export interface PlannerRunRepository {
  create(record: PlannerRunRecord): Promise<PlannerRunRecord>;
  /** Idempotent start, scoped by user, trigger, scope and key when supplied. */
  start(
    record: PlannerRunRecord,
  ): Promise<{ status: "CREATED" | "EXISTING"; record: PlannerRunRecord }>;
  getForUser(userId: string, id: string): Promise<PlannerRunRecord | null>;
  getByIdempotency(
    userId: string,
    trigger: PlannerRunRecord["triggerType"],
    scope: string,
    key: string,
  ): Promise<PlannerRunRecord | null>;
  listRecent(userId: string, limit: number): Promise<PlannerRunRecord[]>;
  latestSuccessful(userId: string): Promise<PlannerRunRecord | null>;
  /** Reap abandoned computations for this user; terminal runs retain their history and event key. */
  failExpiredRunning(userId: string, startedBefore: Date, completedAt: Date): Promise<number>;
  /** Only RUNNING can transition to a terminal status. */
  complete(
    userId: string,
    id: string,
    result: {
      status: "SUCCEEDED" | "FAILED";
      completedAt: Date;
      summary: PlannerRunCompletionSummary | null;
      warnings: PlannerRunStoredWarning[] | null;
    },
  ): Promise<ConditionalMutation<PlannerRunRecord>>;
}

export interface IntegrationAccountRepository {
  create(record: IntegrationAccountRecord): Promise<IntegrationAccountRecord>;
  getForUser(userId: string, id: string): Promise<IntegrationAccountRecord | null>;
  listForUser(userId: string): Promise<IntegrationAccountRecord[]>;
  updateStatus(
    userId: string,
    id: string,
    status: IntegrationAccountStatus,
    disconnectedAt: Date | null,
  ): Promise<IntegrationAccountRecord>;
  disconnect(
    userId: string,
    id: string,
    version: number,
  ): Promise<ConditionalMutation<IntegrationAccountRecord>>;
  updateIfCurrent(
    userId: string,
    id: string,
    version: number,
    patch: Pick<IntegrationAccountRecord, "displayName">,
  ): Promise<ConditionalMutation<IntegrationAccountRecord>>;
}

export interface ExternalObjectMapRepository {
  create(record: ExternalObjectMapRecord): Promise<ExternalObjectMapRecord>;
  getForExternalIdentity(
    userId: string,
    provider: string,
    externalId: string,
  ): Promise<ExternalObjectMapRecord | null>;
  listForInternalObject(
    userId: string,
    internalType: ExternalObjectMapRecord["internalType"],
    internalId: string,
  ): Promise<ExternalObjectMapRecord[]>;
  listForUser(userId: string): Promise<ExternalObjectMapRecord[]>;
}

export interface AccountSnapshot {
  user: UserRecord;
  academicTerms: AcademicTermRecord[];
  courses: CourseRecord[];
  courseMeetings: CourseMeetingRecord[];
  assessments: AssessmentRecord[];
  tasks: TaskRecord[];
  taskDependencies: TaskDependencyRecord[];
  recurringWorkRules: RecurringWorkRuleRecord[];
  calendarEvents: CalendarEventRecord[];
  availabilityRules: AvailabilityRuleRecord[];
  protectedTimeRules: ProtectedTimeRuleRecord[];
  planningPreferences: PlanningPreferenceRecord[];
  inboxItems: InboxItemRecord[];
  workSessions: WorkSessionRecord[];
  completionRecords: CompletionRecordRecord[];
  estimateProfiles: EstimateProfileRecord[];
  plannerRuns: PlannerRunRecord[];
  integrationAccounts: Omit<IntegrationAccountRecord, "credentialReference">[];
  externalObjectMaps: ExternalObjectMapRecord[];
}

/** Only canonical facts used for planner-input assembly. */
export type PlanningStateSnapshot = Pick<
  AccountSnapshot,
  | "user"
  | "academicTerms"
  | "courses"
  | "courseMeetings"
  | "assessments"
  | "tasks"
  | "taskDependencies"
  | "calendarEvents"
  | "availabilityRules"
  | "protectedTimeRules"
  | "planningPreferences"
  | "workSessions"
>;

export interface PlanningStateRepository {
  snapshot(userId: string, startAt: Date, endAt: Date): Promise<PlanningStateSnapshot | null>;
  /** Atomic row-level claim. Use inside the same write transaction as plan persistence. */
  claimRevision(
    userId: string,
    expectedRevision: number,
  ): Promise<
    { status: "CLAIMED"; revision: number } | { status: "STALE" } | { status: "NOT_FOUND" }
  >;
}

export interface AccountLifecycleRepository {
  snapshot(userId: string): Promise<AccountSnapshot | null>;
  deleteAccount(userId: string): Promise<boolean>;
}

export interface InboxItemRepository {
  create(record: InboxItemRecord): Promise<InboxItemRecord>;
  getForUser(userId: string, id: string): Promise<InboxItemRecord | null>;
  listByStatus(userId: string, status: InboxStatus): Promise<InboxItemRecord[]>;
  updateStatus(
    userId: string,
    id: string,
    status: InboxStatus,
    processedAt: Date | null,
  ): Promise<InboxItemRecord>;
  updateIfCurrent(
    userId: string,
    id: string,
    version: number,
    patch: Partial<
      Pick<InboxItemRecord, "status" | "proposedEntityType" | "proposedPayload" | "processedAt">
    >,
  ): Promise<ConditionalMutation<InboxItemRecord>>;
}

export interface CanonicalRepositories {
  planningState: PlanningStateRepository;
  accountLifecycle: AccountLifecycleRepository;
  users: UserRepository;
  authIdentities: AuthIdentityRepository;
  academicTerms: AcademicTermRepository;
  courses: CourseRepository;
  courseMeetings: CourseMeetingRepository;
  assessments: AssessmentRepository;
  tasks: TaskRepository;
  taskDependencies: TaskDependencyRepository;
  recurringWorkRules: RecurringWorkRuleRepository;
  calendarEvents: CalendarEventRepository;
  availabilityRules: AvailabilityRuleRepository;
  protectedTimeRules: ProtectedTimeRuleRepository;
  planningPreferences: PlanningPreferenceRepository;
  workSessions: WorkSessionRepository;
  completionRecords: CompletionRecordRepository;
  estimateProfiles: EstimateProfileRepository;
  plannerRuns: PlannerRunRepository;
  integrationAccounts: IntegrationAccountRepository;
  externalObjectMaps: ExternalObjectMapRepository;
  inboxItems: InboxItemRepository;
}

export interface TransactionContext {
  repositories: CanonicalRepositories;
  locks: { userGraph(userId: string): Promise<void> };
}
