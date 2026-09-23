import type { DatabaseExecutor } from "../internal.js";
import { toPlainRecord } from "../mapping.js";
import type { AccountLifecycleRepository, AccountSnapshot } from "./types.js";

/** Every query is scoped to the canonical owner. Runs inside the caller's transaction. */
export function createAccountLifecycleRepository(db: DatabaseExecutor): AccountLifecycleRepository {
  return {
    async snapshot(userId): Promise<AccountSnapshot | null> {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) return null;
      const [
        academicTerms,
        courses,
        courseMeetings,
        assessments,
        tasks,
        taskDependencies,
        recurringWorkRules,
        calendarEvents,
        availabilityRules,
        protectedTimeRules,
        planningPreferences,
        inboxItems,
        workSessions,
        completionRecords,
        estimateProfiles,
        plannerRuns,
        integrationAccounts,
        externalObjectMaps,
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
        db.recurringWorkRule.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.calendarEvent.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.availabilityRule.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.protectedTimeRule.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.planningPreference.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.inboxItem.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.workSession.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.completionRecord.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.estimateProfile.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.plannerRun.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        db.integrationAccount.findMany({
          where: { userId },
          orderBy: { id: "asc" },
          omit: { credentialReference: true },
        }),
        db.externalObjectMap.findMany({ where: { userId }, orderBy: { id: "asc" } }),
      ]);
      const plain = <T>(values: unknown[]): T[] => values.map((value) => toPlainRecord<T>(value));
      return {
        user: toPlainRecord(user),
        academicTerms: plain(academicTerms),
        courses: plain(courses),
        courseMeetings: plain(courseMeetings),
        assessments: plain(assessments),
        tasks: plain(tasks),
        taskDependencies: plain(taskDependencies),
        recurringWorkRules: plain(recurringWorkRules),
        calendarEvents: plain(calendarEvents),
        availabilityRules: plain(availabilityRules),
        protectedTimeRules: plain(protectedTimeRules),
        planningPreferences: plain(planningPreferences),
        inboxItems: plain(inboxItems),
        workSessions: plain(workSessions),
        completionRecords: plain(completionRecords),
        estimateProfiles: plain(estimateProfiles),
        plannerRuns: plain(plannerRuns),
        integrationAccounts: plain(integrationAccounts),
        externalObjectMaps: plain(externalObjectMaps),
      };
    },
    async deleteAccount(userId) {
      // Explicit order handles restrictive ownership relations and self links.
      // The application transaction rolls all changes back if any step fails.
      if (!(await db.user.findUnique({ where: { id: userId }, select: { id: true } })))
        return false;
      await db.completionRecord.deleteMany({ where: { userId } });
      await db.workSession.updateMany({ where: { userId }, data: { supersededById: null } });
      await db.workSession.deleteMany({ where: { userId } });
      await db.taskDependency.deleteMany({ where: { userId } });
      await db.task.updateMany({ where: { userId }, data: { parentTaskId: null } });
      await db.task.deleteMany({ where: { userId } });
      await db.plannerRun.deleteMany({ where: { userId } });
      await db.estimateProfile.deleteMany({ where: { userId } });
      await db.recurringWorkRule.deleteMany({ where: { userId } });
      await db.assessment.deleteMany({ where: { userId } });
      await db.courseMeeting.deleteMany({ where: { userId } });
      await db.calendarEvent.deleteMany({ where: { userId } });
      await db.externalObjectMap.deleteMany({ where: { userId } });
      await db.integrationAccount.deleteMany({ where: { userId } });
      await db.availabilityRule.deleteMany({ where: { userId } });
      await db.protectedTimeRule.deleteMany({ where: { userId } });
      await db.planningPreference.deleteMany({ where: { userId } });
      await db.inboxItem.deleteMany({ where: { userId } });
      await db.course.deleteMany({ where: { userId } });
      await db.academicTerm.deleteMany({ where: { userId } });
      await db.authIdentity.deleteMany({ where: { userId } });
      await db.user.delete({ where: { id: userId } });
      return true;
    },
  };
}
