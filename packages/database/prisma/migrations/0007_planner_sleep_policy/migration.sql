ALTER TABLE "PlanningPreference" ADD COLUMN "minimumSleepMinutes" INTEGER;
ALTER TABLE "PlanningPreference" ADD CONSTRAINT "PlanningPreference_minimum_sleep_check"
  CHECK ("minimumSleepMinutes" IS NULL OR "minimumSleepMinutes" > 0);

ALTER TABLE "ProtectedTimeRule" ADD COLUMN "isSleep" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProtectedTimeRule" ADD CONSTRAINT "ProtectedTimeRule_sleep_hard_check"
  CHECK (NOT "isSleep" OR "protectionLevel" = 'HARD');
