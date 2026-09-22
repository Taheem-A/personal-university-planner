-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD CONSTRAINT "Task_version_nonnegative_check" CHECK ("version" >= 0);
