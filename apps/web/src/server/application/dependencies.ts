import { ApplicationError } from "./errors";

export interface TaskEdge {
  prerequisiteTaskId: string;
  dependentTaskId: string;
}

/** An edge A→B cycles exactly when B can already reach A. */
export function assertAcyclicDependency(edges: readonly TaskEdge[], proposed: TaskEdge): void {
  if (proposed.prerequisiteTaskId === proposed.dependentTaskId)
    throw new ApplicationError("VALIDATION_ERROR", "A task cannot depend on itself.");
  const forward = new Map<string, string[]>();
  for (const { prerequisiteTaskId, dependentTaskId } of edges) {
    const neighbours = forward.get(prerequisiteTaskId) ?? [];
    neighbours.push(dependentTaskId);
    forward.set(prerequisiteTaskId, neighbours);
  }
  const seen = new Set<string>();
  const pending = [proposed.dependentTaskId];
  while (pending.length) {
    const id = pending.pop()!;
    if (id === proposed.prerequisiteTaskId)
      throw new ApplicationError("CONFLICT", "This dependency would create a cycle.");
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...(forward.get(id) ?? []));
  }
}
