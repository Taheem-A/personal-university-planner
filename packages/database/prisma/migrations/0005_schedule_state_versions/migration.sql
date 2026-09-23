ALTER TABLE "CalendarEvent" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AvailabilityRule" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProtectedTimeRule" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlanningPreference" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InboxItem" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_version_nonnegative_check" CHECK ("version" >= 0);
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_version_nonnegative_check" CHECK ("version" >= 0);
ALTER TABLE "ProtectedTimeRule" ADD CONSTRAINT "ProtectedTimeRule_version_nonnegative_check" CHECK ("version" >= 0);
ALTER TABLE "PlanningPreference" ADD CONSTRAINT "PlanningPreference_version_nonnegative_check" CHECK ("version" >= 0);
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_version_nonnegative_check" CHECK ("version" >= 0);
