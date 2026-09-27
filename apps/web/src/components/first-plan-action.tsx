"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormStatus } from "./mutation-form";
import { submitMutation } from "./mutation-client";

type PlanResult = {
  runId: string;
  status: "READY" | "INFEASIBLE" | "NO_SESSIONS" | "FAILED" | "ALREADY_REQUESTED";
  planStatus?: "VALID" | "INFEASIBLE";
  sessionCount?: number;
  unscheduledMinutes?: number;
  code?: string;
  runStatus?: string;
  warnings?: { code: string; deficitMinutes?: number; reasonCodes: string[] }[];
};
function isPlanResult(value: unknown): value is PlanResult {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<PlanResult>;
  return (
    typeof data.runId === "string" &&
    ["READY", "INFEASIBLE", "NO_SESSIONS", "FAILED", "ALREADY_REQUESTED"].includes(
      String(data.status),
    )
  );
}

export function FirstPlanAction({ hasUsablePlan }: { hasUsablePlan: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [outcome, setOutcome] = useState<PlanResult | null>(null);
  async function generate(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFeedback(null);
    setOutcome(null);
    const result = await submitMutation("/api/v1/onboarding/plan", "POST", {}, isPlanResult);
    setSaving(false);
    if (!result.ok) {
      setFeedback({
        error: true,
        text:
          result.code === "PLANNER_INFEASIBLE"
            ? "Add the missing facts listed here, then try again."
            : result.message,
      });
      router.refresh();
      return;
    }
    const plan = result.data;
    if (plan.status === "READY" && plan.planStatus === "VALID" && (plan.sessionCount ?? 0) > 0) {
      router.push("/today");
      router.refresh();
      return;
    }
    setOutcome(plan);
    setFeedback({
      error: true,
      text:
        plan.status === "INFEASIBLE"
          ? `The planner recorded an infeasible run with ${plan.unscheduledMinutes ?? 0} minutes unscheduled. Review the limits and workload below.`
          : plan.status === "NO_SESSIONS"
            ? "A plan run was recorded, but it produced no work sessions. Check that current tasks have estimates, availability dates, and session lengths."
            : plan.status === "FAILED"
              ? `The planner recorded a failed run (${plan.code ?? "unknown reason"}). Your setup facts remain saved.`
              : "A plan request is already recorded. Reload to review its latest state.",
    });
    router.refresh();
  }
  if (hasUsablePlan)
    return (
      <Link className="button button-primary" href="/today">
        Open your plan in Today
      </Link>
    );
  return (
    <div className="first-plan-action">
      <form onSubmit={generate}>
        <button className="button button-primary" type="submit" disabled={saving}>
          {saving ? "Generating…" : "Generate first plan"}
        </button>
      </form>
      {feedback && <FormStatus message={feedback.text} error={feedback.error} />}
      {outcome?.warnings?.length ? (
        <ul aria-label="Planner warnings">
          {outcome.warnings.map((warning, index) => (
            <li key={`${warning.code}-${index}`}>
              {warning.code.replaceAll("_", " ").toLowerCase()}
              {warning.deficitMinutes ? ` · ${warning.deficitMinutes} minutes` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {outcome && (
        <div className="manual-top-actions">
          <Link className="button button-secondary" href="/availability">
            Review time constraints
          </Link>
          <Link className="button button-secondary" href="/upcoming">
            Review workload
          </Link>
          <Link className="button button-secondary" href="/settings?section=planning">
            Review preferences
          </Link>
        </div>
      )}
    </div>
  );
}
