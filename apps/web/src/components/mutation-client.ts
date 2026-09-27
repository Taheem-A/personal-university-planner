"use client";

export type MutationCode =
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "STALE_WRITE"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "PLANNER_INFEASIBLE"
  | "INTERNAL_ERROR";

export type MutationOutcome<T> =
  { ok: true; data: T } | { ok: false; code: MutationCode; message: string };

const codes = new Set<MutationCode>([
  "VALIDATION_ERROR",
  "CONFLICT",
  "STALE_WRITE",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "PLANNER_INFEASIBLE",
  "INTERNAL_ERROR",
]);
const fallback: Record<MutationCode, string> = {
  VALIDATION_ERROR: "Check the information and try again.",
  CONFLICT: "This change conflicts with another record.",
  STALE_WRITE:
    "This record changed. Your changes were not saved. Reload the latest record, review it, then try again.",
  NOT_FOUND: "This record is no longer available.",
  UNAUTHORIZED: "Your session ended. Sign in again.",
  PLANNER_INFEASIBLE: "The planner could not make a feasible plan.",
  INTERNAL_ERROR: "The change could not be saved. Try again.",
};

/** Success requires an explicit persisted-data marker supplied by the caller. */
export async function submitMutation<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  input: unknown,
  persisted: (value: unknown) => value is T,
): Promise<MutationOutcome<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") throw new Error("Invalid response");
    const envelope = body as { data?: unknown; error?: { code?: unknown } };
    if (response.ok && persisted(envelope.data)) return { ok: true, data: envelope.data };
    const rawCode = envelope.error?.code;
    const code = codes.has(rawCode as MutationCode)
      ? (rawCode as MutationCode)
      : response.status === 401
        ? "UNAUTHORIZED"
        : "INTERNAL_ERROR";
    return { ok: false, code, message: fallback[code] };
  } catch {
    return { ok: false, code: "INTERNAL_ERROR", message: fallback.INTERNAL_ERROR };
  }
}
