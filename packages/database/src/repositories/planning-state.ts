import type { DatabaseExecutor } from "../internal.js";
import { toPlainRecord } from "../mapping.js";
import type { PlanningStateRepository, PlanningStateSnapshot } from "./types.js";

/** Scoped bulk reads; the caller uses Database.readSnapshot for one MVCC snapshot. */
export function createPlanningStateRepository(db: DatabaseExecutor): PlanningStateRepository {
  return {
    async claimRevision(userId, expectedRevision) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
        throw new RangeError("expectedRevision must be a non-negative safe integer");
      const rows = await db.user.updateManyAndReturn({
        where: { id: userId, planningRevision: expectedRevision },
        data: { planningRevision: { increment: 1 } },
      });
      if (rows[0]) return { status: "CLAIMED", revision: rows[0].planningRevision };
      return {
        status: (await db.user.findUnique({ where: { id: userId } })) ? "STALE" : "NOT_FOUND",
      };
    },
    async snapshot(userId, startAt, endAt): Promise<PlanningStateSnapshot | null> {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) return null;
      const [
        academicTerms,
        courses,
        courseMeetings,
        assessments,
        tasks,
        taskDependencies,
        calendarEvents,
        availabilityRules,
        protectedTimeRules,
        planningPreferences,
        workSessions,
      ] = await Promise.all([
        db.academicTerm.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.course.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.courseMeeting.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.assessment.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.task.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.taskDependency.findMany({
          where: { userId },
          orderBy: [{ prerequisiteTaskId: "asc" }, { dependentTaskId: "asc" }],
        }),
        db.calendarEvent.findMany({
          where: { userId, archivedAt: null, startAt: { lt: endAt }, endAt: { gt: startAt } },
          orderBy: [{ startAt: "asc" }, { id: "asc" }],
        }),
        db.availabilityRule.findMany({ where: { userId, active: true }, orderBy: { id: "asc" } }),
        db.protectedTimeRule.findMany({ where: { userId, active: true }, orderBy: { id: "asc" } }),
        db.planningPreference.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.workSession.findMany({
          where: {
            userId,
            startAt: { lt: endAt },
            endAt: { gt: startAt },
            state: { in: ["PLANNED", "ACTIVE"] },
            supersededById: null,
          },
          orderBy: [{ startAt: "asc" }, { id: "asc" }],
        }),
      ]);
      const plain = <T>(rows: unknown[]): T[] => rows.map((row) => toPlainRecord<T>(row));
      return {
        user: toPlainRecord(user),
        academicTerms: plain(academicTerms),
        courses: plain(courses),
        courseMeetings: plain(courseMeetings),
        assessments: plain(assessments),
        tasks: plain(tasks),
        taskDependencies: plain(taskDependencies),
        calendarEvents: plain(calendarEvents),
        availabilityRules: plain(availabilityRules),
        protectedTimeRules: plain(protectedTimeRules),
        planningPreferences: plain(planningPreferences),
        workSessions: plain(workSessions),
      };
    },
  };
}
