import { z } from "zod";
import type {
  InboxItemRecord,
  PlanningStateSnapshot,
  PlannerRunRecord,
} from "@university-planner/database";
import { addLocalDays, instantToLocal, localDateTimeToInstant } from "@university-planner/shared";
import { applicationDatabase } from "../database";
import { requireActor } from "./authorization";
import { ApplicationError, resultOf } from "./errors";
import { planHistoryItem, type PlannerReadState } from "./planner-reads";
import { idSchema, validateInput } from "./validation";

export type HorizonGroup = "OVERDUE" | "NEXT_7" | "NEXT_14" | "LATER" | "UNKNOWN";
export interface UpcomingItem {
  id: string;
  kind: "ASSESSMENT" | "TASK";
  title: string;
  type: string;
  courseCode: string | null;
  courseColorReference: string | null;
  dueAt: Date | null;
  remainingMinutes: number | null;
  status: string;
  submissionStatus: string | null;
  risk: "INFEASIBLE" | "CRITICAL" | "CONSTRAINED" | "HORIZON_LIMITED" | null;
  group: HorizonGroup;
}
export interface AssessmentDetailModel {
  id: string;
  title: string;
  type: string;
  courseCode: string;
  courseName: string;
  courseColorReference: string | null;
  releaseAt: Date | null;
  dueAt: Date | null;
  preferredCompletionAt: Date | null;
  gradeWeight: number | null;
  gradeReceived: number | null;
  notes: string | null;
  instructionsUrl: string | null;
  submissionUrl: string | null;
  submissionStatus: string;
  submittedAt: Date | null;
  source: string;
  sourceAuthority: string;
  sourceConfidence: string | null;
  remainingMinutes: number | null;
  risk: UpcomingItem["risk"];
  tasks: {
    id: string;
    title: string;
    status: string;
    remainingMinutes: number | null;
    dueAt: Date | null;
  }[];
  sessions: {
    id: string;
    taskTitle: string;
    startAt: Date;
    endAt: Date;
    generatedBy: "PLANNER" | "USER";
    locked: boolean;
  }[];
}
export interface UpcomingViewModel {
  timezone: string;
  anchorDate: string;
  groups: { id: HorizonGroup; items: UpcomingItem[] }[];
  selectedAssessment: AssessmentDetailModel | null;
  selectionUnavailable: boolean;
  planner: Pick<PlannerReadState, "status" | "authoritativeRun">;
}
export interface InboxViewModel {
  timezone: string;
  tabs: { status: "ACTIVE" | "PROCESSED" | "DISMISSED"; count: number }[];
  items: {
    id: string;
    rawText: string;
    status: "ACTIVE" | "PROCESSED" | "DISMISSED";
    source: string;
    sourceAuthority: string;
    proposedEntityType: string | null;
    proposedTitle: string | null;
    createdAt: Date;
    processedAt: Date | null;
  }[];
}

function groupFor(dueAt: Date | null, now: Date, seven: Date, fourteen: Date): HorizonGroup {
  if (!dueAt) return "UNKNOWN";
  if (dueAt < now) return "OVERDUE";
  if (dueAt < seven) return "NEXT_7";
  if (dueAt < fourteen) return "NEXT_14";
  return "LATER";
}
function riskRank(risk: UpcomingItem["risk"]) {
  return risk === "INFEASIBLE"
    ? 0
    : risk === "CRITICAL"
      ? 1
      : risk === "CONSTRAINED"
        ? 2
        : risk === "HORIZON_LIMITED"
          ? 3
          : 4;
}
export function buildUpcoming(
  state: PlanningStateSnapshot,
  latest: PlannerRunRecord | null,
  successful: PlannerRunRecord | null,
  now: Date,
  selectedId: string | null,
  sort: "PRESSURE" | "DUE",
): UpcomingViewModel {
  const timezone = state.user.timezone;
  const anchorDate = instantToLocal(now, timezone).date;
  const midnight = (date: string) => localDateTimeToInstant({ date, time: "00:00", timezone });
  const seven = midnight(addLocalDays(anchorDate, 7));
  const fourteen = midnight(addLocalDays(anchorDate, 14));
  const courses = new Map(
    state.courses
      .filter((item) => item.userId === state.user.id && !item.archivedAt)
      .map((item) => [item.id, item]),
  );
  const assessments = state.assessments.filter(
    (item) => item.userId === state.user.id && !item.archivedAt && courses.has(item.courseId),
  );
  const allTasks = state.tasks.filter((item) => item.userId === state.user.id && !item.archivedAt);
  const activeTasks = allTasks.filter((item) =>
    ["READY", "IN_PROGRESS", "BLOCKED"].includes(item.status),
  );
  const taskById = new Map(activeTasks.map((item) => [item.id, item]));
  const riskByTask = new Map(
    (successful ? (planHistoryItem(successful).summary?.risk ?? []) : []).map((risk) => [
      risk.taskId,
      risk.feasibility,
    ]),
  );
  const riskFor = (taskIds: string[]): UpcomingItem["risk"] =>
    taskIds.map((id) => riskByTask.get(id) ?? null).sort((a, b) => riskRank(a) - riskRank(b))[0] ??
    null;
  const items: UpcomingItem[] = assessments.map((assessment) => {
    const related = activeTasks.filter((task) => task.assessmentId === assessment.id);
    const estimates = related.map((task) => task.remainingMinutes);
    const remainingMinutes =
      estimates.length && estimates.every((value) => value !== null)
        ? estimates.reduce<number>((sum, value) => sum + value!, 0)
        : null;
    const course = courses.get(assessment.courseId)!;
    return {
      id: assessment.id,
      kind: "ASSESSMENT",
      title: assessment.title,
      type: assessment.assessmentType,
      courseCode: course.code,
      courseColorReference: course.colorReference,
      dueAt: assessment.dueAt,
      remainingMinutes,
      status: assessment.submissionStatus,
      submissionStatus: assessment.submissionStatus,
      risk: riskFor(related.map((task) => task.id)),
      group: groupFor(assessment.dueAt, now, seven, fourteen),
    };
  });
  for (const task of activeTasks.filter((item) => !item.assessmentId)) {
    const course = courses.get(task.courseId ?? "");
    if (task.courseId && !course) continue;
    items.push({
      id: task.id,
      kind: "TASK",
      title: task.title,
      type: "Task",
      courseCode: course?.code ?? null,
      courseColorReference: course?.colorReference ?? null,
      dueAt: task.dueAt,
      remainingMinutes: task.remainingMinutes,
      status: task.status,
      submissionStatus: null,
      risk: riskFor([task.id]),
      group: groupFor(task.dueAt, now, seven, fourteen),
    });
  }
  const order: HorizonGroup[] = ["OVERDUE", "NEXT_7", "NEXT_14", "LATER", "UNKNOWN"];
  const selected = selectedId ? assessments.find((item) => item.id === selectedId) : null;
  let selectedAssessment: AssessmentDetailModel | null = null;
  if (selected) {
    const course = courses.get(selected.courseId)!;
    const tasks = allTasks.filter((task) => task.assessmentId === selected.id);
    const active = tasks.filter((task) =>
      ["READY", "IN_PROGRESS", "BLOCKED"].includes(task.status),
    );
    const estimates = active.map((task) => task.remainingMinutes);
    selectedAssessment = {
      id: selected.id,
      title: selected.title,
      type: selected.assessmentType,
      courseCode: course.code,
      courseName: course.name,
      courseColorReference: course.colorReference,
      releaseAt: selected.releaseAt,
      dueAt: selected.dueAt,
      preferredCompletionAt: selected.preferredCompletionAt,
      gradeWeight: selected.gradeWeight,
      gradeReceived: selected.gradeReceived,
      notes: selected.notes,
      instructionsUrl: selected.instructionsUrl,
      submissionUrl: selected.submissionUrl,
      submissionStatus: selected.submissionStatus,
      submittedAt: selected.submittedAt,
      source: selected.source,
      sourceAuthority: selected.sourceAuthority,
      sourceConfidence: selected.sourceConfidence,
      remainingMinutes:
        estimates.length && estimates.every((value) => value !== null)
          ? estimates.reduce<number>((sum, value) => sum + value!, 0)
          : null,
      risk: riskFor(active.map((task) => task.id)),
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        remainingMinutes: task.remainingMinutes,
        dueAt: task.dueAt,
      })),
      sessions: state.workSessions
        .filter(
          (session) =>
            session.userId === state.user.id &&
            taskById.has(session.taskId) &&
            tasks.some((task) => task.id === session.taskId) &&
            !session.supersededById,
        )
        .map((session) => ({
          id: session.id,
          taskTitle: taskById.get(session.taskId)!.title,
          startAt: session.startAt,
          endAt: session.endAt,
          generatedBy: session.generatedBy,
          locked: session.locked,
        })),
    };
  }
  return {
    timezone,
    anchorDate,
    groups: order.map((id) => ({
      id,
      items: items
        .filter((item) => item.group === id)
        .sort(
          (a, b) =>
            (sort === "PRESSURE" ? riskRank(a.risk) - riskRank(b.risk) : 0) ||
            (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) ||
            a.title.localeCompare(b.title),
        ),
    })),
    selectedAssessment,
    selectionUnavailable: Boolean(selectedId && !selected),
    planner: {
      status:
        latest?.status === "RUNNING"
          ? "RUNNING"
          : latest?.status === "FAILED"
            ? "FAILED"
            : successful
              ? "CURRENT"
              : "UNPLANNED",
      authoritativeRun: successful ? planHistoryItem(successful) : null,
    },
  };
}

export function buildInbox(rows: InboxItemRecord[], timezone: string): InboxViewModel {
  const statuses = ["ACTIVE", "PROCESSED", "DISMISSED"] as const;
  return {
    timezone,
    tabs: statuses.map((status) => ({
      status,
      count: rows.filter((item) => item.status === status).length,
    })),
    items: [...rows]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        rawText: item.rawText,
        status: item.status,
        source: item.source,
        sourceAuthority: item.sourceAuthority,
        proposedEntityType: item.proposedEntityType,
        proposedTitle:
          item.proposedPayload &&
          typeof item.proposedPayload === "object" &&
          !Array.isArray(item.proposedPayload) &&
          typeof item.proposedPayload.title === "string"
            ? item.proposedPayload.title
            : null,
        createdAt: item.createdAt,
        processedAt: item.processedAt,
      })),
  };
}

const upcomingRequest = z
  .object({
    assessmentId: idSchema.optional(),
    sort: z.enum(["PRESSURE", "DUE"]).default("PRESSURE"),
  })
  .strict();
export const informationViews = {
  upcoming(input: unknown = {}) {
    return resultOf(async () => {
      const actor = await requireActor();
      const data = validateInput(upcomingRequest, input);
      const now = new Date();
      return applicationDatabase().readSnapshot(async (tx) => {
        const user = await tx.repositories.users.getById(actor.userId);
        if (!user) throw new ApplicationError("NOT_FOUND", "Record not found.");
        const date = instantToLocal(now, user.timezone).date;
        const start = localDateTimeToInstant({
          date: addLocalDays(date, -7),
          time: "00:00",
          timezone: user.timezone,
        });
        const end = localDateTimeToInstant({
          date: addLocalDays(date, 21),
          time: "00:00",
          timezone: user.timezone,
        });
        const [state, latest, successful] = await Promise.all([
          tx.repositories.planningState.snapshot(actor.userId, start, end),
          tx.repositories.plannerRuns.listRecent(actor.userId, 1),
          tx.repositories.plannerRuns.latestSuccessful(actor.userId),
        ]);
        if (!state) throw new ApplicationError("NOT_FOUND", "Record not found.");
        return buildUpcoming(
          state,
          latest[0] ?? null,
          successful,
          now,
          data.assessmentId ?? null,
          data.sort,
        );
      });
    });
  },
  inbox() {
    return resultOf(async () => {
      const actor = await requireActor();
      return applicationDatabase().readSnapshot(async (tx) => {
        const user = await tx.repositories.users.getById(actor.userId);
        if (!user) throw new ApplicationError("NOT_FOUND", "Record not found.");
        const rows = await Promise.all(
          (["ACTIVE", "PROCESSED", "DISMISSED"] as const).map((status) =>
            tx.repositories.inboxItems.listByStatus(actor.userId, status),
          ),
        );
        return buildInbox(rows.flat(), user.timezone);
      });
    });
  },
};
