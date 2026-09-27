import { academicTerms, assessments, courses, courseMeetings, tasks } from "./academic";
import {
  availabilityRules,
  calendarEvents,
  planningPreferences,
  protectedTimeRules,
} from "./schedule";
import type { ApplicationResult } from "./errors";
import type { PlannedMutation } from "./planner-triggers";

type Saved = { id: string; version: number };

/** The browser sees proof of a committed fact and a bounded post-commit planner outcome. */
function project<T extends Saved>(result: ApplicationResult<PlannedMutation<T>>) {
  if (!result.ok) return result;
  const { id, version, planning } = result.value;
  return {
    ok: true as const,
    value: {
      id,
      version,
      planning: !planning
        ? { status: "NOT_REQUESTED" as const }
        : !planning.ok
          ? { status: "FAILED" as const, code: planning.error.code }
          : planning.value.status === "SUCCEEDED"
            ? { status: "SUCCEEDED" as const, planStatus: planning.value.planStatus }
            : planning.value.status === "INPUT_FAILURE"
              ? { status: "INFEASIBLE" as const }
              : { status: "FAILED" as const },
    },
  };
}

async function manualEvent(input: unknown): Promise<ApplicationResult<unknown>> {
  const id = input && typeof input === "object" && "id" in input ? input.id : null;
  const found = await calendarEvents.get({ id });
  if (!found.ok) return found;
  return found.value.source === "MANUAL"
    ? { ok: true, value: found.value }
    : { ok: false, error: { code: "NOT_FOUND", message: "Record not found." } };
}

export const manualTerms = {
  async create(input: unknown) {
    return project(await academicTerms.create(input));
  },
  async update(input: unknown) {
    return project(await academicTerms.update(input));
  },
  async archive(input: unknown) {
    return project(await academicTerms.archive(input));
  },
};
export const manualCourses = {
  async create(input: unknown) {
    return project(await courses.create(input));
  },
  async update(input: unknown) {
    return project(await courses.update(input));
  },
  async archive(input: unknown) {
    return project(await courses.archive(input));
  },
};
export const manualMeetings = {
  async create(input: unknown) {
    return project(await courseMeetings.create(input));
  },
  async update(input: unknown) {
    return project(await courseMeetings.update(input));
  },
  async archive(input: unknown) {
    return project(await courseMeetings.archive(input));
  },
};
export const manualEvents = {
  async create(input: unknown) {
    return project(await calendarEvents.create(input));
  },
  async update(input: unknown) {
    const found = await manualEvent(input);
    return found.ok ? project(await calendarEvents.update(input)) : found;
  },
  async archive(input: unknown) {
    const found = await manualEvent(input);
    return found.ok ? project(await calendarEvents.archive(input)) : found;
  },
};
export const manualAssessments = {
  async create(input: unknown) {
    return project(await assessments.create(input));
  },
  async update(input: unknown) {
    return project(await assessments.update(input));
  },
  async archive(input: unknown) {
    return project(await assessments.archive(input));
  },
};
export const manualTasks = {
  async create(input: unknown) {
    return project(await tasks.create(input));
  },
  async update(input: unknown) {
    return project(await tasks.update(input));
  },
  async archive(input: unknown) {
    return project(await tasks.archive(input));
  },
};
export const manualAvailability = {
  async create(input: unknown) {
    return project(await availabilityRules.create(input));
  },
  async update(input: unknown) {
    return project(await availabilityRules.update(input));
  },
  async deactivate(input: unknown) {
    return project(await availabilityRules.deactivate(input));
  },
};
export const manualProtection = {
  async create(input: unknown) {
    return project(await protectedTimeRules.create(input));
  },
  async update(input: unknown) {
    return project(await protectedTimeRules.update(input));
  },
  async deactivate(input: unknown) {
    return project(await protectedTimeRules.deactivate(input));
  },
};
export const manualPreferences = {
  async create(input: unknown) {
    return project(await planningPreferences.create(input));
  },
  async update(input: unknown) {
    return project(await planningPreferences.update(input));
  },
};
