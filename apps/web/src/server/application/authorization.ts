import type { CanonicalRepositories } from "@university-planner/database";
import { authenticatedActor } from "../auth";
import { ApplicationError } from "./errors";

export interface Actor {
  readonly userId: string;
}

export async function requireActor(): Promise<Actor> {
  const actor = await authenticatedActor();
  if (!actor) throw new ApplicationError("UNAUTHORIZED", "Sign in is required.");
  return actor;
}

export async function requireCourse(repos: CanonicalRepositories, actor: Actor, id: string) {
  const course = await repos.courses.getForUser(actor.userId, id);
  if (!course || course.archivedAt) throw new ApplicationError("NOT_FOUND", "Record not found.");
  return course;
}

export async function requireTask(repos: CanonicalRepositories, actor: Actor, id: string) {
  const task = await repos.tasks.getForUser(actor.userId, id);
  if (!task || task.archivedAt) throw new ApplicationError("NOT_FOUND", "Record not found.");
  return task;
}

export async function requireAssessment(repos: CanonicalRepositories, actor: Actor, id: string) {
  const assessment = await repos.assessments.getForUser(actor.userId, id);
  if (!assessment || assessment.archivedAt)
    throw new ApplicationError("NOT_FOUND", "Record not found.");
  await requireCourse(repos, actor, assessment.courseId);
  return assessment;
}

export async function requireTaskRelationships(
  repos: CanonicalRepositories,
  actor: Actor,
  refs: { courseId?: string | null; assessmentId?: string | null; parentTaskId?: string | null },
) {
  if (refs.courseId) await requireCourse(repos, actor, refs.courseId);
  if (refs.assessmentId) {
    const assessment = await requireAssessment(repos, actor, refs.assessmentId);
    if (refs.courseId && assessment.courseId !== refs.courseId)
      throw new ApplicationError("NOT_FOUND", "Record not found.");
  }
  if (refs.parentTaskId) await requireTask(repos, actor, refs.parentTaskId);
}
