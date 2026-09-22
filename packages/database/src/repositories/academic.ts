import type { Prisma } from "@prisma/client";
import type { DatabaseExecutor } from "../internal.js";
import { toPersistenceData, toPlainRecord } from "../mapping.js";
import type {
  AcademicTermRecord,
  AssessmentRecord,
  CourseMeetingRecord,
  CourseRecord,
  UserRecord,
} from "../records.js";
import type {
  AcademicTermRepository,
  AssessmentRepository,
  CourseMeetingRepository,
  CourseRepository,
  UserRepository,
} from "./types.js";

export function createAcademicRepositories(db: DatabaseExecutor): {
  users: UserRepository;
  academicTerms: AcademicTermRepository;
  courses: CourseRepository;
  courseMeetings: CourseMeetingRepository;
  assessments: AssessmentRepository;
} {
  return {
    users: {
      async create(record) {
        const row = await db.user.create({
          data: toPersistenceData(record) as unknown as Prisma.UserUncheckedCreateInput,
        });
        return toPlainRecord<UserRecord>(row);
      },
      async getById(id) {
        const row = await db.user.findUnique({ where: { id } });
        return row ? toPlainRecord<UserRecord>(row) : null;
      },
      async updateProfile(id, patch) {
        const row = await db.user.update({
          where: { id },
          data: toPersistenceData(patch) as Prisma.UserUpdateInput,
        });
        return toPlainRecord<UserRecord>(row);
      },
    },
    academicTerms: {
      async create(record) {
        const row = await db.academicTerm.create({
          data: toPersistenceData(record) as unknown as Prisma.AcademicTermUncheckedCreateInput,
        });
        return toPlainRecord<AcademicTermRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.academicTerm.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<AcademicTermRecord>(row) : null;
      },
      async listForUser(userId) {
        const rows = await db.academicTerm.findMany({
          where: { userId },
          orderBy: [{ startDate: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<AcademicTermRecord>(row));
      },
      async updateStatus(userId, id, status) {
        const row = await db.academicTerm.update({
          where: { id_userId: { id, userId } },
          data: { status },
        });
        return toPlainRecord<AcademicTermRecord>(row);
      },
    },
    courses: {
      async create(record) {
        const row = await db.course.create({
          data: toPersistenceData(record) as unknown as Prisma.CourseUncheckedCreateInput,
        });
        return toPlainRecord<CourseRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.course.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<CourseRecord>(row) : null;
      },
      async listForTerm(userId, academicTermId) {
        const rows = await db.course.findMany({
          where: { userId, academicTermId },
          orderBy: [{ code: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<CourseRecord>(row));
      },
      async archive(userId, id, archivedAt) {
        const row = await db.course.update({
          where: { id_userId: { id, userId } },
          data: { archivedAt },
        });
        return toPlainRecord<CourseRecord>(row);
      },
    },
    courseMeetings: {
      async create(record) {
        const row = await db.courseMeeting.create({
          data: toPersistenceData(record) as unknown as Prisma.CourseMeetingUncheckedCreateInput,
        });
        return toPlainRecord<CourseMeetingRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.courseMeeting.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<CourseMeetingRecord>(row) : null;
      },
      async listForCourse(userId, courseId) {
        const rows = await db.courseMeeting.findMany({
          where: { userId, courseId },
          orderBy: [{ startTimeLocal: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<CourseMeetingRecord>(row));
      },
    },
    assessments: {
      async create(record) {
        const row = await db.assessment.create({
          data: toPersistenceData(record) as unknown as Prisma.AssessmentUncheckedCreateInput,
        });
        return toPlainRecord<AssessmentRecord>(row);
      },
      async getForUser(userId, id) {
        const row = await db.assessment.findFirst({ where: { id, userId } });
        return row ? toPlainRecord<AssessmentRecord>(row) : null;
      },
      async listForCourse(userId, courseId) {
        const rows = await db.assessment.findMany({
          where: { userId, courseId },
          orderBy: [{ dueAt: "asc" }, { id: "asc" }],
        });
        return rows.map((row) => toPlainRecord<AssessmentRecord>(row));
      },
      async archive(userId, id, archivedAt) {
        const row = await db.assessment.update({
          where: { id_userId: { id, userId } },
          data: { archivedAt },
        });
        return toPlainRecord<AssessmentRecord>(row);
      },
    },
  };
}
