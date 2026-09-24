-- Per-user optimistic token. Canonical writes below advance it under the User row lock.
ALTER TABLE "User" ADD COLUMN "planningRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD CONSTRAINT "User_planningRevision_nonnegative_check"
  CHECK ("planningRevision" >= 0);

-- Null identities allow ordinary manual runs. A complete identity is unique per
-- user, trigger and provider/application scope.
ALTER TABLE "PlannerRun" ADD COLUMN "idempotencyScope" TEXT;
ALTER TABLE "PlannerRun" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "PlannerRun" ADD CONSTRAINT "PlannerRun_idempotency_pair_check"
  CHECK (("idempotencyScope" IS NULL AND "idempotencyKey" IS NULL)
    OR ("idempotencyScope" IS NOT NULL AND "idempotencyKey" IS NOT NULL
      AND "idempotencyScope" <> '' AND "idempotencyKey" <> ''));
CREATE UNIQUE INDEX "PlannerRun_userId_triggerType_idempotencyScope_idempotencyKey_key"
  ON "PlannerRun"("userId", "triggerType", "idempotencyScope", "idempotencyKey");
CREATE INDEX "PlannerRun_userId_status_completedAt_idx"
  ON "PlannerRun"("userId", "status", "completedAt");

-- A replacement can legitimately absorb more than one former session.
DROP INDEX "WorkSession_supersededById_userId_key";
CREATE INDEX "WorkSession_userId_supersededById_idx"
  ON "WorkSession"("userId", "supersededById");
CREATE INDEX "WorkSession_userId_generatedBy_state_startAt_endAt_idx"
  ON "WorkSession"("userId", "generatedBy", "state", "startAt", "endAt");

CREATE FUNCTION planner_bump_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN owner_id := OLD."userId";
  ELSE owner_id := NEW."userId";
  END IF;
  UPDATE "User" SET "planningRevision" = "planningRevision" + 1
    WHERE "id" = owner_id;
  RETURN NULL;
END $$;

CREATE FUNCTION planner_bump_user_timezone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD."timezone", OLD."defaultDayStart", OLD."defaultDayEnd")
      IS DISTINCT FROM ROW(NEW."timezone", NEW."defaultDayStart", NEW."defaultDayEnd") THEN
    NEW."planningRevision" := OLD."planningRevision" + 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "User_planning_timezone_revision"
  BEFORE UPDATE OF "timezone", "defaultDayStart", "defaultDayEnd" ON "User"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_user_timezone();

-- Triggers use column lists so text/profile edits do not invalidate a planner
-- snapshot. INSERT/DELETE always change canonical planning membership.
CREATE TRIGGER "AcademicTerm_planning_revision"
  AFTER INSERT OR DELETE OR UPDATE OF "status", "startDate", "endDate" ON "AcademicTerm"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_revision();
CREATE TRIGGER "Course_planning_revision"
  AFTER INSERT OR DELETE OR UPDATE OF "academicTermId", "archivedAt", "defaultTaskEnergy", "defaultTaskLocation" ON "Course"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_revision();
CREATE TRIGGER "CourseMeeting_planning_revision"
  AFTER INSERT OR DELETE OR UPDATE OF "courseId", "recurrenceRule", "startTimeLocal", "endTimeLocal", "spansNextDay", "timezone", "effectiveFrom", "effectiveUntil", "attendanceRequired", "archivedAt" ON "CourseMeeting"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_revision();
CREATE TRIGGER "Assessment_planning_revision"
  AFTER INSERT OR DELETE OR UPDATE OF "courseId", "releaseAt", "dueAt", "preferredCompletionAt", "submissionStatus", "submittedAt", "archivedAt" ON "Assessment"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_revision();
CREATE TRIGGER "Task_planning_revision"
  AFTER INSERT OR DELETE OR UPDATE OF "courseId", "assessmentId", "status", "priorityOverride", "availableFrom", "dueAt", "preferredCompletionAt", "originalEstimatedMinutes", "currentEstimatedMinutes", "remainingMinutes", "energyRequirement", "locationRequirements", "minimumSessionMinutes", "preferredSessionMinutes", "maximumSessionMinutes", "splittable", "interruptible", "planningMode", "completedAt", "archivedAt", "sourceConfidence" ON "Task"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_revision();
CREATE TRIGGER "TaskDependency_planning_revision"
  AFTER INSERT OR UPDATE OR DELETE ON "TaskDependency"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_revision();
CREATE TRIGGER "CalendarEvent_planning_revision"
  AFTER INSERT OR DELETE OR UPDATE OF "courseId", "startAt", "endAt", "constraintLevel", "archivedAt" ON "CalendarEvent"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_revision();
CREATE TRIGGER "AvailabilityRule_planning_revision"
  AFTER INSERT OR DELETE OR UPDATE OF "recurrenceRule", "startTimeLocal", "endTimeLocal", "spansNextDay", "timezone", "effectiveFrom", "effectiveUntil", "capacityFactor", "energyLevel", "allowedLocationTags", "active" ON "AvailabilityRule"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_revision();
CREATE TRIGGER "ProtectedTimeRule_planning_revision"
  AFTER INSERT OR DELETE OR UPDATE OF "recurrenceRule", "startTimeLocal", "endTimeLocal", "spansNextDay", "timezone", "effectiveFrom", "effectiveUntil", "protectionLevel", "isSleep", "active" ON "ProtectedTimeRule"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_revision();
CREATE TRIGGER "PlanningPreference_planning_revision"
  AFTER INSERT OR UPDATE OR DELETE ON "PlanningPreference"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_revision();
CREATE TRIGGER "WorkSession_planning_revision"
  AFTER INSERT OR DELETE OR UPDATE OF "taskId", "startAt", "endAt", "plannedMinutes", "state", "generatedBy", "locked", "supersededById" ON "WorkSession"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_revision();
CREATE TRIGGER "CompletionRecord_planning_revision"
  AFTER INSERT OR DELETE OR UPDATE OF "taskId", "workSessionId", "outcome", "actualMinutes", "remainingAfterMinutes", "recordedAt" ON "CompletionRecord"
  FOR EACH ROW EXECUTE FUNCTION planner_bump_revision();
