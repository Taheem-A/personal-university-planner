ALTER TABLE "WorkSession" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IntegrationAccount" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_version_nonnegative_check" CHECK ("version" >= 0);
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_version_nonnegative_check" CHECK ("version" >= 0);
