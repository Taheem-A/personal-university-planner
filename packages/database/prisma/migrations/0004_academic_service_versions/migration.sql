-- AlterTable
ALTER TABLE "AcademicTerm" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CourseMeeting" ADD COLUMN     "archivedAt" TIMESTAMPTZ(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_version_nonnegative_check" CHECK ("version" >= 0);
ALTER TABLE "Course" ADD CONSTRAINT "Course_version_nonnegative_check" CHECK ("version" >= 0);
ALTER TABLE "CourseMeeting" ADD CONSTRAINT "CourseMeeting_version_nonnegative_check" CHECK ("version" >= 0);
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_version_nonnegative_check" CHECK ("version" >= 0);
