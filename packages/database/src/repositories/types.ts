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
  PlannerRunStatus,
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
  create(record: UserRecord): Promise<UserRecord>;
  getById(id: string): Promise<UserRecord | null>;
  updateProfile(
    id: string,
    patch: Pick<UserRecord, "name" | "timezone" | "defaultDayStart" | "defaultDayEnd" | "locale">,
  ): Promise<UserRecord>;
}

export interface AcademicTermRepository {
  create(record: AcademicTermRecord): Promise<AcademicTermRecord>;
  getForUser(userId: string, id: string): Promise<AcademicTermRecord | null>;
  listForUser(userId: string): Promise<AcademicTermRecord[]>;
  updateStatus(userId: string, id: string, status: AcademicTermStatus): Promise<AcademicTermRecord>;
}

export interface CourseRepository {
  create(record: CourseRecord): Promise<CourseRecord>;
  getForUser(userId: string, id: string): Promise<CourseRecord | null>;
  listForTerm(userId: string, academicTermId: string): Promise<CourseRecord[]>;
  archive(userId: string, id: string, archivedAt: Date): Promise<CourseRecord>;
}

export interface CourseMeetingRepository {
  create(record: CourseMeetingRecord): Promise<CourseMeetingRecord>;
  getForUser(userId: string, id: string): Promise<CourseMeetingRecord | null>;
  listForCourse(userId: string, courseId: string): Promise<CourseMeetingRecord[]>;
}

export interface AssessmentRepository {
  create(record: AssessmentRecord): Promise<AssessmentRecord>;
  getForUser(userId: string, id: string): Promise<AssessmentRecord | null>;
  listForCourse(userId: string, courseId: string): Promise<AssessmentRecord[]>;
  archive(userId: string, id: string, archivedAt: Date): Promise<AssessmentRecord>;
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
      >
    >,
  ): Promise<TaskRecord>;
  archive(userId: string, id: string, archivedAt: Date): Promise<TaskRecord>;
}

export interface TaskDependencyRepository {
  add(record: TaskDependencyRecord): Promise<TaskDependencyRecord>;
  listForTask(userId: string, taskId: string): Promise<TaskDependencyRecord[]>;
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
}

export interface AvailabilityRuleRepository {
  create(record: AvailabilityRuleRecord): Promise<AvailabilityRuleRecord>;
  getForUser(userId: string, id: string): Promise<AvailabilityRuleRecord | null>;
  listActive(userId: string): Promise<AvailabilityRuleRecord[]>;
  setActive(userId: string, id: string, active: boolean): Promise<AvailabilityRuleRecord>;
}

export interface ProtectedTimeRuleRepository {
  create(record: ProtectedTimeRuleRecord): Promise<ProtectedTimeRuleRecord>;
  getForUser(userId: string, id: string): Promise<ProtectedTimeRuleRecord | null>;
  listActive(userId: string): Promise<ProtectedTimeRuleRecord[]>;
  setActive(userId: string, id: string, active: boolean): Promise<ProtectedTimeRuleRecord>;
}

export interface PlanningPreferenceRepository {
  getForUser(userId: string): Promise<PlanningPreferenceRecord | null>;
  upsert(record: PlanningPreferenceRecord): Promise<PlanningPreferenceRecord>;
}

export interface WorkSessionRepository {
  create(record: WorkSessionRecord): Promise<WorkSessionRecord>;
  getForUser(userId: string, id: string): Promise<WorkSessionRecord | null>;
  listForRange(userId: string, startAt: Date, endAt: Date): Promise<WorkSessionRecord[]>;
  updateState(userId: string, id: string, state: WorkSessionState): Promise<WorkSessionRecord>;
  supersede(userId: string, id: string, supersededById: string): Promise<WorkSessionRecord>;
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
  getForUser(userId: string, id: string): Promise<PlannerRunRecord | null>;
  listRecent(userId: string, limit: number): Promise<PlannerRunRecord[]>;
  updateStatus(
    userId: string,
    id: string,
    status: PlannerRunStatus,
    completedAt: Date | null,
  ): Promise<PlannerRunRecord>;
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
}

export interface CanonicalRepositories {
  users: UserRepository;
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
}
