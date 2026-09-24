import type { PlannerInput, PlannableTask } from "../../domain/src";

export interface Eligibility {
  eligibleTaskIds: Set<string>;
  blockedTaskIds: Set<string>;
  dependenciesByTask: Map<string, string[]>;
}

function baseEligible(
  task: PlannableTask,
  input: PlannerInput,
  effectiveStart: Date,
  unallocated: Map<string, number>,
): boolean {
  return (
    (task.status === "READY" || task.status === "IN_PROGRESS") &&
    task.planningMode === "AUTO" &&
    (unallocated.get(task.id) ?? task.remainingMinutes) > 0 &&
    task.availableFrom < input.horizonEnd &&
    (!task.dueAt || task.dueAt > effectiveStart)
  );
}

/** Resolve static eligibility and dependency graph, leaving scheduled prerequisites pending. */
export function resolveEligibility(
  input: PlannerInput,
  effectiveStart: Date,
  unallocated: Map<string, number>,
  fullyReservedTaskIds: Set<string>,
): Eligibility {
  const byId = new Map(input.tasks.map((task) => [task.id, task]));
  if (byId.size !== input.tasks.length) throw new Error("Duplicate task IDs in PlannerInput.");
  const dependenciesByTask = new Map<string, string[]>();
  for (const edge of input.dependencies) {
    if (edge.type !== "FINISH_TO_START") throw new Error("Unsupported dependency type.");
    if (!byId.has(edge.dependentTaskId))
      throw new Error(`Dependency has unknown dependent task ${edge.dependentTaskId}.`);
    if (
      !byId.has(edge.prerequisiteTaskId) &&
      !input.completedTaskIds.includes(edge.prerequisiteTaskId)
    )
      throw new Error(`Dependency has unknown prerequisite task ${edge.prerequisiteTaskId}.`);
    const current = dependenciesByTask.get(edge.dependentTaskId) ?? [];
    if (!current.includes(edge.prerequisiteTaskId)) current.push(edge.prerequisiteTaskId);
    dependenciesByTask.set(edge.dependentTaskId, current);
  }
  for (const prerequisites of dependenciesByTask.values()) prerequisites.sort();
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(id: string): void {
    if (visiting.has(id)) throw new Error(`Task dependency cycle includes ${id}.`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisite of dependenciesByTask.get(id) ?? []) visit(prerequisite);
    visiting.delete(id);
    visited.add(id);
  }
  for (const task of input.tasks) visit(task.id);

  const eligibleTaskIds = new Set<string>();
  const blockedTaskIds = new Set<string>();
  for (const task of input.tasks) {
    if (!baseEligible(task, input, effectiveStart, unallocated)) continue;
    const blocked = (dependenciesByTask.get(task.id) ?? []).some((id) => {
      const prerequisite = byId.get(id);
      return (
        !input.completedTaskIds.includes(id) &&
        !fullyReservedTaskIds.has(id) &&
        (!prerequisite ||
          (prerequisite.status !== "COMPLETED" &&
            !baseEligible(prerequisite, input, effectiveStart, unallocated)))
      );
    });
    (blocked ? blockedTaskIds : eligibleTaskIds).add(task.id);
  }
  return { eligibleTaskIds, blockedTaskIds, dependenciesByTask };
}

/** A dependent can run only after every prerequisite is complete or fully allocated. */
export function dependencyReadyAt(
  taskId: string,
  input: PlannerInput,
  eligibility: Eligibility,
  allocatedCompletion: Map<string, Date>,
): Date | undefined {
  let readyAt = input.now;
  for (const id of eligibility.dependenciesByTask.get(taskId) ?? []) {
    const prerequisite = input.tasks.find((task) => task.id === id);
    if (input.completedTaskIds.includes(id) || prerequisite?.status === "COMPLETED") continue;
    const completion = allocatedCompletion.get(id);
    if (!completion) return undefined;
    if (completion > readyAt) readyAt = completion;
  }
  return readyAt;
}
