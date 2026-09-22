-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AcademicTermStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('LECTURE', 'TUTORIAL', 'PRACTICAL', 'LAB', 'SEMINAR', 'OTHER');

-- CreateEnum
CREATE TYPE "AssessmentSubmissionStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'GRADED', 'EXEMPT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('INBOX', 'READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "TaskDependencyType" AS ENUM ('FINISH_TO_START');

-- CreateEnum
CREATE TYPE "PlanningMode" AS ENUM ('AUTO', 'MANUAL', 'UNSCHEDULED');

-- CreateEnum
CREATE TYPE "EnergyLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ConstraintLevel" AS ENUM ('HARD', 'SOFT', 'INFORMATIONAL');

-- CreateEnum
CREATE TYPE "WorkSessionState" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'PARTIAL', 'SKIPPED', 'CANCELLED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "WorkSessionGeneratedBy" AS ENUM ('PLANNER', 'USER');

-- CreateEnum
CREATE TYPE "CompletionOutcome" AS ENUM ('COMPLETED', 'PARTIAL', 'SKIPPED', 'DONE_EARLY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlannerRunTrigger" AS ENUM ('MANUAL', 'TASK_CREATED', 'TASK_UPDATED', 'SESSION_COMPLETED', 'SESSION_SKIPPED', 'CALENDAR_CHANGED', 'DEADLINE_CHANGED', 'INTEGRATION_SYNC', 'DAILY_REFRESH');

-- CreateEnum
CREATE TYPE "PlannerRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('ACTIVE', 'PROCESSED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RecordSource" AS ENUM ('MANUAL', 'INTEGRATION', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SourceAuthority" AS ENUM ('USER', 'EXTERNAL', 'SYSTEM', 'INFERRED');

-- CreateEnum
CREATE TYPE "SourceConfidence" AS ENUM ('DIRECT_API', 'CALENDAR_FEED', 'DOCUMENT_EXTRACTION', 'AI_EXTRACTED', 'MANUAL', 'USER_CONFIRMED');

-- CreateEnum
CREATE TYPE "IntegrationAccountStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ExternalObjectType" AS ENUM ('COURSE', 'ASSESSMENT', 'CALENDAR_EVENT', 'TASK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "timezone" TEXT NOT NULL,
    "defaultDayStart" TIME(0),
    "defaultDayEnd" TIME(0),
    "locale" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "AcademicTermStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "section" TEXT,
    "instructorName" TEXT,
    "colorReference" TEXT,
    "creditValue" DECIMAL(5,2),
    "defaultTaskEnergy" "EnergyLevel",
    "defaultTaskLocation" TEXT[],
    "source" "RecordSource" NOT NULL DEFAULT 'MANUAL',
    "sourceAuthority" "SourceAuthority" NOT NULL DEFAULT 'USER',
    "sourceConfidence" "SourceConfidence",
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseMeeting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "meetingType" "MeetingType" NOT NULL,
    "recurrenceRule" TEXT NOT NULL,
    "startTimeLocal" TIME(0) NOT NULL,
    "endTimeLocal" TIME(0) NOT NULL,
    "spansNextDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL,
    "location" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "effectiveUntil" DATE,
    "attendanceRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CourseMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assessmentType" TEXT NOT NULL,
    "releaseAt" TIMESTAMPTZ(3),
    "dueAt" TIMESTAMPTZ(3),
    "preferredCompletionAt" TIMESTAMPTZ(3),
    "gradeWeight" DECIMAL(5,2),
    "gradeReceived" DECIMAL(6,2),
    "notes" TEXT,
    "instructionsUrl" TEXT,
    "submissionUrl" TEXT,
    "submissionStatus" "AssessmentSubmissionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "submittedAt" TIMESTAMPTZ(3),
    "source" "RecordSource" NOT NULL DEFAULT 'MANUAL',
    "sourceAuthority" "SourceAuthority" NOT NULL DEFAULT 'USER',
    "sourceConfidence" "SourceConfidence",
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "assessmentId" TEXT,
    "recurringWorkRuleId" TEXT,
    "parentTaskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL,
    "priorityOverride" DOUBLE PRECISION,
    "availableFrom" TIMESTAMPTZ(3),
    "dueAt" TIMESTAMPTZ(3),
    "preferredCompletionAt" TIMESTAMPTZ(3),
    "originalEstimatedMinutes" INTEGER,
    "currentEstimatedMinutes" INTEGER,
    "remainingMinutes" INTEGER,
    "energyRequirement" "EnergyLevel",
    "locationRequirements" TEXT[],
    "minimumSessionMinutes" INTEGER,
    "preferredSessionMinutes" INTEGER,
    "maximumSessionMinutes" INTEGER,
    "splittable" BOOLEAN NOT NULL DEFAULT true,
    "interruptible" BOOLEAN NOT NULL DEFAULT true,
    "planningMode" "PlanningMode" NOT NULL DEFAULT 'AUTO',
    "source" "RecordSource" NOT NULL DEFAULT 'MANUAL',
    "sourceAuthority" "SourceAuthority" NOT NULL DEFAULT 'USER',
    "sourceConfidence" "SourceConfidence",
    "completedAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "userId" TEXT NOT NULL,
    "prerequisiteTaskId" TEXT NOT NULL,
    "dependentTaskId" TEXT NOT NULL,
    "dependencyType" "TaskDependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("userId","prerequisiteTaskId","dependentTaskId")
);

-- CreateTable
CREATE TABLE "RecurringWorkRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "anchorCourseMeetingId" TEXT,
    "titleTemplate" TEXT NOT NULL,
    "descriptionTemplate" TEXT,
    "recurrenceRule" TEXT NOT NULL,
    "anchorTimeLocal" TIME(0) NOT NULL,
    "timezone" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveUntil" DATE,
    "availableOffsetMinutes" INTEGER NOT NULL DEFAULT 0,
    "dueOffsetMinutes" INTEGER,
    "originalEstimatedMinutes" INTEGER,
    "energyRequirement" "EnergyLevel",
    "locationRequirements" TEXT[],
    "minimumSessionMinutes" INTEGER,
    "preferredSessionMinutes" INTEGER,
    "maximumSessionMinutes" INTEGER,
    "splittable" BOOLEAN NOT NULL DEFAULT true,
    "interruptible" BOOLEAN NOT NULL DEFAULT true,
    "planningMode" "PlanningMode" NOT NULL DEFAULT 'AUTO',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecurringWorkRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "integrationAccountId" TEXT,
    "title" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "location" TEXT,
    "constraintLevel" "ConstraintLevel" NOT NULL,
    "source" "RecordSource" NOT NULL DEFAULT 'MANUAL',
    "sourceAuthority" "SourceAuthority" NOT NULL DEFAULT 'USER',
    "sourceConfidence" "SourceConfidence",
    "externalId" TEXT,
    "externalUpdatedAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recurrenceRule" TEXT NOT NULL,
    "startTimeLocal" TIME(0) NOT NULL,
    "endTimeLocal" TIME(0) NOT NULL,
    "spansNextDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL,
    "capacityFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "energyLevel" "EnergyLevel" NOT NULL,
    "allowedLocationTags" TEXT[],
    "effectiveFrom" DATE NOT NULL,
    "effectiveUntil" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtectedTimeRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recurrenceRule" TEXT NOT NULL,
    "startTimeLocal" TIME(0) NOT NULL,
    "endTimeLocal" TIME(0) NOT NULL,
    "spansNextDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL,
    "protectionLevel" "ConstraintLevel" NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveUntil" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProtectedTimeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredDailyStudyLimitMinutes" INTEGER NOT NULL,
    "minimumFreeTimeMinutes" INTEGER NOT NULL,
    "preferredDeadlineBufferHours" INTEGER NOT NULL,
    "avoidLateHighEnergyTasks" BOOLEAN NOT NULL,
    "maximumConsecutiveWorkMinutes" INTEGER NOT NULL,
    "minimumBreakMinutes" INTEGER NOT NULL,
    "scheduleCommuteWork" BOOLEAN NOT NULL,
    "weekendWorkBias" DOUBLE PRECISION NOT NULL,
    "planStabilityWindowMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PlanningPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "plannerRunId" TEXT,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "plannedMinutes" INTEGER NOT NULL,
    "state" "WorkSessionState" NOT NULL,
    "generatedBy" "WorkSessionGeneratedBy" NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "supersededById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "workSessionId" TEXT,
    "outcome" "CompletionOutcome" NOT NULL,
    "actualMinutes" INTEGER,
    "remainingAfterMinutes" INTEGER,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "CompletionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "contextKey" TEXT NOT NULL,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "meanRatio" DOUBLE PRECISION,
    "medianRatio" DOUBLE PRECISION,
    "recentRatio" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modelVersion" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "triggerType" "PlannerRunTrigger" NOT NULL,
    "triggerEntityType" TEXT,
    "triggerEntityId" TEXT,
    "planningHorizonStart" TIMESTAMPTZ(3) NOT NULL,
    "planningHorizonEnd" TIMESTAMPTZ(3) NOT NULL,
    "plannerVersion" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "summary" JSONB,
    "warnings" JSONB,
    "status" "PlannerRunStatus" NOT NULL,

    CONSTRAINT "PlannerRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "IntegrationAccountStatus" NOT NULL,
    "credentialReference" TEXT,
    "lastSyncAt" TIMESTAMPTZ(3),
    "lastSuccessAt" TIMESTAMPTZ(3),
    "disconnectedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IntegrationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalObjectMap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "integrationAccountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "internalType" "ExternalObjectType" NOT NULL,
    "internalId" TEXT NOT NULL,
    "externalUpdatedAt" TIMESTAMPTZ(3),
    "lastSyncedAt" TIMESTAMPTZ(3),
    "sourceHash" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ExternalObjectMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "source" "RecordSource" NOT NULL DEFAULT 'MANUAL',
    "sourceAuthority" "SourceAuthority" NOT NULL DEFAULT 'USER',
    "sourceConfidence" "SourceConfidence",
    "status" "InboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "proposedEntityType" TEXT,
    "proposedPayload" JSONB,
    "processedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicTerm_userId_status_startDate_endDate_idx" ON "AcademicTerm"("userId", "status", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_id_userId_key" ON "AcademicTerm"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_userId_name_key" ON "AcademicTerm"("userId", "name");

-- CreateIndex
CREATE INDEX "Course_userId_academicTermId_archivedAt_idx" ON "Course"("userId", "academicTermId", "archivedAt");

-- CreateIndex
CREATE INDEX "Course_userId_code_idx" ON "Course"("userId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Course_id_userId_key" ON "Course"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_userId_academicTermId_code_key" ON "Course"("userId", "academicTermId", "code");

-- CreateIndex
CREATE INDEX "CourseMeeting_userId_courseId_effectiveFrom_effectiveUntil_idx" ON "CourseMeeting"("userId", "courseId", "effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "CourseMeeting_id_userId_key" ON "CourseMeeting"("id", "userId");

-- CreateIndex
CREATE INDEX "Assessment_userId_courseId_dueAt_idx" ON "Assessment"("userId", "courseId", "dueAt");

-- CreateIndex
CREATE INDEX "Assessment_userId_submissionStatus_dueAt_idx" ON "Assessment"("userId", "submissionStatus", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_id_userId_key" ON "Assessment"("id", "userId");

-- CreateIndex
CREATE INDEX "Task_userId_status_dueAt_idx" ON "Task"("userId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Task_userId_assessmentId_idx" ON "Task"("userId", "assessmentId");

-- CreateIndex
CREATE INDEX "Task_userId_parentTaskId_idx" ON "Task"("userId", "parentTaskId");

-- CreateIndex
CREATE INDEX "Task_userId_recurringWorkRuleId_idx" ON "Task"("userId", "recurringWorkRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_id_userId_key" ON "Task"("id", "userId");

-- CreateIndex
CREATE INDEX "TaskDependency_userId_dependentTaskId_idx" ON "TaskDependency"("userId", "dependentTaskId");

-- CreateIndex
CREATE INDEX "RecurringWorkRule_userId_courseId_active_effectiveFrom_effe_idx" ON "RecurringWorkRule"("userId", "courseId", "active", "effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringWorkRule_id_userId_key" ON "RecurringWorkRule"("id", "userId");

-- CreateIndex
CREATE INDEX "CalendarEvent_userId_startAt_endAt_idx" ON "CalendarEvent"("userId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_userId_courseId_startAt_idx" ON "CalendarEvent"("userId", "courseId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_integrationAccountId_externalId_key" ON "CalendarEvent"("integrationAccountId", "externalId");

-- CreateIndex
CREATE INDEX "AvailabilityRule_userId_active_effectiveFrom_effectiveUntil_idx" ON "AvailabilityRule"("userId", "active", "effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE INDEX "ProtectedTimeRule_userId_active_effectiveFrom_effectiveUnti_idx" ON "ProtectedTimeRule"("userId", "active", "effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningPreference_userId_key" ON "PlanningPreference"("userId");

-- CreateIndex
CREATE INDEX "WorkSession_userId_startAt_endAt_idx" ON "WorkSession"("userId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "WorkSession_userId_taskId_state_idx" ON "WorkSession"("userId", "taskId", "state");

-- CreateIndex
CREATE INDEX "WorkSession_userId_plannerRunId_idx" ON "WorkSession"("userId", "plannerRunId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSession_id_userId_key" ON "WorkSession"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSession_supersededById_userId_key" ON "WorkSession"("supersededById", "userId");

-- CreateIndex
CREATE INDEX "CompletionRecord_userId_taskId_recordedAt_idx" ON "CompletionRecord"("userId", "taskId", "recordedAt");

-- CreateIndex
CREATE INDEX "CompletionRecord_userId_workSessionId_idx" ON "CompletionRecord"("userId", "workSessionId");

-- CreateIndex
CREATE INDEX "EstimateProfile_userId_updatedAt_idx" ON "EstimateProfile"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EstimateProfile_userId_contextType_contextKey_key" ON "EstimateProfile"("userId", "contextType", "contextKey");

-- CreateIndex
CREATE INDEX "PlannerRun_userId_startedAt_idx" ON "PlannerRun"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "PlannerRun_userId_triggerType_startedAt_idx" ON "PlannerRun"("userId", "triggerType", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerRun_id_userId_key" ON "PlannerRun"("id", "userId");

-- CreateIndex
CREATE INDEX "IntegrationAccount_userId_provider_status_idx" ON "IntegrationAccount"("userId", "provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccount_id_userId_key" ON "IntegrationAccount"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccount_id_userId_provider_key" ON "IntegrationAccount"("id", "userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccount_userId_provider_externalAccountId_key" ON "IntegrationAccount"("userId", "provider", "externalAccountId");

-- CreateIndex
CREATE INDEX "ExternalObjectMap_userId_internalType_internalId_idx" ON "ExternalObjectMap"("userId", "internalType", "internalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalObjectMap_integrationAccountId_externalId_key" ON "ExternalObjectMap"("integrationAccountId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalObjectMap_userId_provider_externalId_key" ON "ExternalObjectMap"("userId", "provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalObjectMap_userId_internalType_internalId_integratio_key" ON "ExternalObjectMap"("userId", "internalType", "internalId", "integrationAccountId");

-- CreateIndex
CREATE INDEX "InboxItem_userId_status_createdAt_idx" ON "InboxItem"("userId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_academicTermId_userId_fkey" FOREIGN KEY ("academicTermId", "userId") REFERENCES "AcademicTerm"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMeeting" ADD CONSTRAINT "CourseMeeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMeeting" ADD CONSTRAINT "CourseMeeting_courseId_userId_fkey" FOREIGN KEY ("courseId", "userId") REFERENCES "Course"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_courseId_userId_fkey" FOREIGN KEY ("courseId", "userId") REFERENCES "Course"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_courseId_userId_fkey" FOREIGN KEY ("courseId", "userId") REFERENCES "Course"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assessmentId_userId_fkey" FOREIGN KEY ("assessmentId", "userId") REFERENCES "Assessment"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_recurringWorkRuleId_userId_fkey" FOREIGN KEY ("recurringWorkRuleId", "userId") REFERENCES "RecurringWorkRule"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_userId_fkey" FOREIGN KEY ("parentTaskId", "userId") REFERENCES "Task"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_prerequisiteTaskId_userId_fkey" FOREIGN KEY ("prerequisiteTaskId", "userId") REFERENCES "Task"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependentTaskId_userId_fkey" FOREIGN KEY ("dependentTaskId", "userId") REFERENCES "Task"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringWorkRule" ADD CONSTRAINT "RecurringWorkRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringWorkRule" ADD CONSTRAINT "RecurringWorkRule_courseId_userId_fkey" FOREIGN KEY ("courseId", "userId") REFERENCES "Course"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringWorkRule" ADD CONSTRAINT "RecurringWorkRule_anchorCourseMeetingId_userId_fkey" FOREIGN KEY ("anchorCourseMeetingId", "userId") REFERENCES "CourseMeeting"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_courseId_userId_fkey" FOREIGN KEY ("courseId", "userId") REFERENCES "Course"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_integrationAccountId_userId_fkey" FOREIGN KEY ("integrationAccountId", "userId") REFERENCES "IntegrationAccount"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectedTimeRule" ADD CONSTRAINT "ProtectedTimeRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningPreference" ADD CONSTRAINT "PlanningPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_taskId_userId_fkey" FOREIGN KEY ("taskId", "userId") REFERENCES "Task"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_plannerRunId_userId_fkey" FOREIGN KEY ("plannerRunId", "userId") REFERENCES "PlannerRun"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_supersededById_userId_fkey" FOREIGN KEY ("supersededById", "userId") REFERENCES "WorkSession"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionRecord" ADD CONSTRAINT "CompletionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionRecord" ADD CONSTRAINT "CompletionRecord_taskId_userId_fkey" FOREIGN KEY ("taskId", "userId") REFERENCES "Task"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionRecord" ADD CONSTRAINT "CompletionRecord_workSessionId_userId_fkey" FOREIGN KEY ("workSessionId", "userId") REFERENCES "WorkSession"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateProfile" ADD CONSTRAINT "EstimateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerRun" ADD CONSTRAINT "PlannerRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalObjectMap" ADD CONSTRAINT "ExternalObjectMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalObjectMap" ADD CONSTRAINT "ExternalObjectMap_integrationAccountId_userId_provider_fkey" FOREIGN KEY ("integrationAccountId", "userId", "provider") REFERENCES "IntegrationAccount"("id", "userId", "provider") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Canonical scalar and temporal invariants that Prisma's data model cannot
-- currently represent. Keep these in migration history; do not replace them
-- with `prisma db push`.
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_date_order_check" CHECK ("startDate" <= "endDate");
ALTER TABLE "Course" ADD CONSTRAINT "Course_creditValue_check" CHECK ("creditValue" IS NULL OR "creditValue" > 0);
ALTER TABLE "CourseMeeting" ADD CONSTRAINT "CourseMeeting_effective_dates_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" <= "effectiveUntil");
ALTER TABLE "CourseMeeting" ADD CONSTRAINT "CourseMeeting_local_time_check" CHECK ("spansNextDay" OR "startTimeLocal" < "endTimeLocal");
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_gradeWeight_check" CHECK ("gradeWeight" IS NULL OR ("gradeWeight" >= 0 AND "gradeWeight" <= 100));
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_gradeReceived_check" CHECK ("gradeReceived" IS NULL OR "gradeReceived" >= 0);
ALTER TABLE "Task" ADD CONSTRAINT "Task_not_own_parent_check" CHECK ("parentTaskId" IS NULL OR "parentTaskId" <> "id");
ALTER TABLE "Task" ADD CONSTRAINT "Task_duration_values_check" CHECK (
  ("originalEstimatedMinutes" IS NULL OR "originalEstimatedMinutes" > 0) AND
  ("currentEstimatedMinutes" IS NULL OR "currentEstimatedMinutes" > 0) AND
  ("remainingMinutes" IS NULL OR "remainingMinutes" >= 0) AND
  ("minimumSessionMinutes" IS NULL OR "minimumSessionMinutes" > 0) AND
  ("preferredSessionMinutes" IS NULL OR "preferredSessionMinutes" > 0) AND
  ("maximumSessionMinutes" IS NULL OR "maximumSessionMinutes" > 0) AND
  ("minimumSessionMinutes" IS NULL OR "preferredSessionMinutes" IS NULL OR "minimumSessionMinutes" <= "preferredSessionMinutes") AND
  ("preferredSessionMinutes" IS NULL OR "maximumSessionMinutes" IS NULL OR "preferredSessionMinutes" <= "maximumSessionMinutes") AND
  ("minimumSessionMinutes" IS NULL OR "maximumSessionMinutes" IS NULL OR "minimumSessionMinutes" <= "maximumSessionMinutes")
);
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_no_self_edge_check" CHECK ("prerequisiteTaskId" <> "dependentTaskId");
ALTER TABLE "RecurringWorkRule" ADD CONSTRAINT "RecurringWorkRule_effective_dates_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" <= "effectiveUntil");
ALTER TABLE "RecurringWorkRule" ADD CONSTRAINT "RecurringWorkRule_duration_values_check" CHECK (
  ("originalEstimatedMinutes" IS NULL OR "originalEstimatedMinutes" > 0) AND
  ("minimumSessionMinutes" IS NULL OR "minimumSessionMinutes" > 0) AND
  ("preferredSessionMinutes" IS NULL OR "preferredSessionMinutes" > 0) AND
  ("maximumSessionMinutes" IS NULL OR "maximumSessionMinutes" > 0) AND
  ("minimumSessionMinutes" IS NULL OR "preferredSessionMinutes" IS NULL OR "minimumSessionMinutes" <= "preferredSessionMinutes") AND
  ("preferredSessionMinutes" IS NULL OR "maximumSessionMinutes" IS NULL OR "preferredSessionMinutes" <= "maximumSessionMinutes") AND
  ("minimumSessionMinutes" IS NULL OR "maximumSessionMinutes" IS NULL OR "minimumSessionMinutes" <= "maximumSessionMinutes")
);
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_interval_check" CHECK ("startAt" < "endAt");
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_external_identity_check" CHECK (
  ("integrationAccountId" IS NULL AND "externalId" IS NULL) OR
  ("integrationAccountId" IS NOT NULL AND "externalId" IS NOT NULL)
);
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_effective_dates_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" <= "effectiveUntil");
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_local_time_check" CHECK ("spansNextDay" OR "startTimeLocal" < "endTimeLocal");
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_capacityFactor_check" CHECK ("capacityFactor" >= 0 AND "capacityFactor" <= 1);
ALTER TABLE "ProtectedTimeRule" ADD CONSTRAINT "ProtectedTimeRule_effective_dates_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" <= "effectiveUntil");
ALTER TABLE "ProtectedTimeRule" ADD CONSTRAINT "ProtectedTimeRule_local_time_check" CHECK ("spansNextDay" OR "startTimeLocal" < "endTimeLocal");
ALTER TABLE "PlanningPreference" ADD CONSTRAINT "PlanningPreference_values_check" CHECK (
  "preferredDailyStudyLimitMinutes" >= 0 AND
  "minimumFreeTimeMinutes" >= 0 AND
  "preferredDeadlineBufferHours" >= 0 AND
  "maximumConsecutiveWorkMinutes" > 0 AND
  "minimumBreakMinutes" >= 0 AND
  "weekendWorkBias" >= -1 AND "weekendWorkBias" <= 1 AND
  "planStabilityWindowMinutes" >= 0
);
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_interval_check" CHECK ("startAt" < "endAt");
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_plannedMinutes_check" CHECK ("plannedMinutes" > 0);
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_not_self_superseded_check" CHECK ("supersededById" IS NULL OR "supersededById" <> "id");
ALTER TABLE "CompletionRecord" ADD CONSTRAINT "CompletionRecord_duration_values_check" CHECK (
  ("actualMinutes" IS NULL OR "actualMinutes" >= 0) AND
  ("remainingAfterMinutes" IS NULL OR "remainingAfterMinutes" >= 0)
);
ALTER TABLE "EstimateProfile" ADD CONSTRAINT "EstimateProfile_values_check" CHECK (
  "sampleCount" >= 0 AND
  "confidence" >= 0 AND "confidence" <= 1 AND
  ("meanRatio" IS NULL OR "meanRatio" > 0) AND
  ("medianRatio" IS NULL OR "medianRatio" > 0) AND
  ("recentRatio" IS NULL OR "recentRatio" > 0)
);
ALTER TABLE "PlannerRun" ADD CONSTRAINT "PlannerRun_horizon_check" CHECK ("planningHorizonStart" < "planningHorizonEnd");
ALTER TABLE "PlannerRun" ADD CONSTRAINT "PlannerRun_completion_check" CHECK ("completedAt" IS NULL OR "startedAt" <= "completedAt");
