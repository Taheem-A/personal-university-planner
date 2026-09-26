"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, ClipboardList, Inbox, Settings2 } from "lucide-react";
import type { PlannerPresentationModel } from "../lib/planner-presentation-model";

const destinations = [
  { label: "Today", href: "/today", icon: CalendarDays },
  { label: "Week", href: "/week", icon: CalendarDays },
  { label: "Upcoming", href: "/upcoming", icon: ClipboardList },
  { label: "Inbox and Quick Add", href: "/inbox?capture=1", icon: Inbox },
  { label: "Settings", href: "/settings", icon: Settings2 },
] as const;

function duration(minutes: number) {
  const absolute = Math.abs(minutes);
  return `${minutes < 0 ? "−" : ""}${Math.floor(absolute / 60)}h ${String(absolute % 60).padStart(2, "0")}m`;
}
function contextHref(
  pathname: string,
  search: string,
  key: "scenario" | "conflict",
  value: string,
) {
  const params = new URLSearchParams(search);
  params.delete("scenario");
  params.delete("conflict");
  params.set(key, value);
  return `${pathname}?${params}`;
}

export function PlannerSurface({
  kind,
  pathname,
  search,
  onClose,
}: {
  kind: "planner" | "scenario" | "conflict";
  pathname: string;
  search: string;
  onClose: () => void;
}) {
  const [model, setModel] = useState<PlannerPresentationModel | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/planner/presentation", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Planner context unavailable");
        const data = await response.json();
        if (!data.data) throw new Error("Planner context unavailable");
        setModel(data.data as PlannerPresentationModel);
        setLoadState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState("error");
      });
    return () => controller.abort();
  }, []);

  if (kind === "planner") {
    const matching = destinations.filter((item) =>
      item.label.toLowerCase().includes(query.trim().toLowerCase()),
    );
    return (
      <div className="planner-surface">
        <label className="planner-search-label" htmlFor="planner-query">
          Search destinations or ask Planner
        </label>
        <input
          id="planner-query"
          className="planner-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search or ask planner…"
          autoComplete="off"
        />
        {query.trim() && matching.length === 0 ? (
          <p className="planner-unavailable" role="status">
            Planner command execution is not enabled yet. Your request was not sent or saved.
          </p>
        ) : null}
        <section className="panel-section">
          <h3>Go to</h3>
          <nav aria-label="Planner destinations" className="planner-destinations">
            {matching.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <Icon size={17} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </section>
        <section className="panel-section">
          <h3>Current plan</h3>
          <PlannerReadStatus model={model} state={loadState} />
          {model?.nextWork ? (
            <p>
              Next work: {model.nextWork.courseCode ? `${model.nextWork.courseCode} · ` : ""}
              {model.nextWork.title}
            </p>
          ) : null}
        </section>
        <section className="panel-section">
          <h3>Explore</h3>
          <p>
            Scenario simulation and resolution actions are not enabled yet. These previews do not
            change your plan.
          </p>
          <div className="planner-links">
            <Link
              className="button button-secondary"
              href={contextHref(pathname, search, "scenario", "preview")}
            >
              Scenario preview
            </Link>
            <Link
              className="button button-secondary"
              href={contextHref(pathname, search, "conflict", "overview")}
            >
              Review plan risks
            </Link>
          </div>
        </section>
      </div>
    );
  }
  if (kind === "scenario")
    return (
      <div className="planner-surface">
        <div className="scenario-summary">
          <strong>Preview only</strong>
          <p>
            No structured scenario has been prepared for this account. The current plan remains
            authoritative.
          </p>
        </div>
        <section className="panel-section">
          <h3>Current plan</h3>
          <PlannerReadStatus model={model} state={loadState} />
        </section>
        <section className="panel-section">
          <h3>What would change</h3>
          <p>
            No proposed session moves, workload changes, or deadline effects are available. A
            comparison will appear only after a trusted scenario service produces it.
          </p>
        </section>
        <button className="button button-primary" type="button" disabled aria-disabled="true">
          Apply changes unavailable
        </button>
        <button className="button button-secondary" type="button" onClick={onClose}>
          Cancel
        </button>
        <p className="panel-footnote">Closing this preview does not change canonical state.</p>
      </div>
    );
  return (
    <div className="planner-surface">
      <div className="conflict-summary">
        <AlertTriangle size={19} aria-hidden="true" />
        <div>
          <strong>Plan risk and constraints</strong>
          <p>Only recorded planner findings are shown. No tradeoff has been applied.</p>
        </div>
      </div>
      <PlannerReadStatus model={model} state={loadState} />
      {model && (
        <section className="panel-section">
          <h3>Recorded risks</h3>
          {model.risks.length ? (
            <ul className="conflict-list">
              {model.risks.map((risk) => (
                <li key={risk.taskId}>
                  <strong>
                    {risk.courseCode ? `${risk.courseCode} · ` : ""}
                    {risk.title}
                  </strong>
                  <span>
                    {risk.feasibility.replaceAll("_", " ")} · {duration(risk.deficitMinutes)}{" "}
                    deficit
                    {risk.slackMinutes !== null ? ` · ${duration(risk.slackMinutes)} slack` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No risk was recorded in the latest successful plan.</p>
          )}
        </section>
      )}
      {model?.warnings.length ? (
        <section className="panel-section">
          <h3>Planner warnings</h3>
          <ul className="conflict-list">
            {model.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>
                <strong>{warning.code.replaceAll("_", " ")}</strong>
                <span>
                  {warning.deficitMinutes !== undefined
                    ? `${duration(warning.deficitMinutes)} deficit · `
                    : ""}
                  {warning.reasonCodes.length
                    ? warning.reasonCodes.join(", ").replaceAll("_", " ")
                    : "No further reason recorded"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="panel-section">
        <h3>Resolution</h3>
        <p>
          Tradeoff previews and applying a resolution require the trusted scenario workflow. Your
          schedule has not changed.
        </p>
        <button className="button button-primary" type="button" disabled aria-disabled="true">
          Apply resolution unavailable
        </button>
      </section>
    </div>
  );
}

function PlannerReadStatus({
  model,
  state,
}: {
  model: PlannerPresentationModel | null;
  state: "loading" | "ready" | "error";
}) {
  if (state === "loading") return <p role="status">Loading recorded plan context…</p>;
  if (state === "error" || !model)
    return (
      <p role="alert">Recorded plan context could not load. No current-plan claim is available.</p>
    );
  return (
    <div className="planner-read-status">
      <strong>
        {model.status === "FAILED"
          ? "Latest replan failed"
          : model.status === "RUNNING"
            ? "Planner running"
            : model.status === "UNPLANNED"
              ? "No plan generated"
              : "Current plan"}
      </strong>
      <p>
        {model.status === "FAILED"
          ? "The last successful plan remains the visible authority."
          : model.status === "RUNNING"
            ? "The last successful plan remains visible while planning runs."
            : model.status === "UNPLANNED"
              ? "No successful plan is recorded."
              : `${duration(model.remainingPlannedWorkMinutes)} of planned work remains today.`}
      </p>
      {model.authoritativePlanAt && (
        <small>
          Last successful plan:{" "}
          {new Intl.DateTimeFormat("en", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: model.timezone,
          }).format(new Date(model.authoritativePlanAt))}
        </small>
      )}
    </div>
  );
}
