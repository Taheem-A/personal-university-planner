import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import type {
  AssessmentDetailModel,
  HorizonGroup,
  UpcomingItem,
  UpcomingViewModel,
} from "../server/application/information-reads";
import { CourseIdentity, StatusIndicator } from "./planner-primitives";
import { courseColor } from "./course-color";
import { AssessmentClose } from "./assessment-close";

const groupNames: Record<HorizonGroup, string> = {
  OVERDUE: "Overdue",
  NEXT_7: "Next 7 days",
  NEXT_14: "Next 2 weeks",
  LATER: "Later",
  UNKNOWN: "Date unknown",
};
function minutes(value: number | null) {
  if (value === null) return "Estimate unknown";
  if (value === 0) return "No work remaining";
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${h ? `${h}h` : ""}${h && m ? " " : ""}${m ? `${m}m` : ""} remaining`;
}
function when(date: Date | null, timezone: string) {
  return date
    ? new Intl.DateTimeFormat("en", {
        timeZone: timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : "Due date unknown";
}
function statusLabel(item: UpcomingItem) {
  if (item.submissionStatus === "SUBMITTED") return "Submitted";
  if (item.group === "OVERDUE") return "Past due";
  if (item.risk === "INFEASIBLE") return "Does not fit";
  if (item.risk === "CRITICAL") return "At risk";
  if (item.risk === "CONSTRAINED") return "Low flexibility";
  if (item.risk === "HORIZON_LIMITED") return "Beyond plan horizon";
  return item.status.replaceAll("_", " ").toLowerCase();
}
function tone(item: UpcomingItem) {
  return (item.group === "OVERDUE" && item.submissionStatus !== "SUBMITTED") ||
    item.risk === "INFEASIBLE" ||
    item.risk === "CRITICAL"
    ? "danger"
    : item.risk === "CONSTRAINED"
      ? "warning"
      : "info";
}
function external(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}
function assessmentHref(id: string, range: string, sort: "PRESSURE" | "DUE") {
  return `/upcoming?range=${range}&sort=${sort === "DUE" ? "due" : "pressure"}&assessment=${encodeURIComponent(id)}`;
}
function AssessmentDetail({
  detail,
  model,
  range,
  sort,
  view,
}: {
  detail: AssessmentDetailModel | null;
  model: UpcomingViewModel;
  range: string;
  sort: "PRESSURE" | "DUE";
  view: string;
}) {
  if (!detail && !model.selectionUnavailable) return null;
  const base = detail ? assessmentHref(detail.id, range, sort) : "";
  const tabs = [
    ["overview", "Overview"],
    ["tasks", "Tasks"],
    ["sessions", "Planned sessions"],
    ["notes", "Notes"],
    ["resources", "Resources"],
  ] as const;
  return (
    <aside
      className="assessment-detail"
      role="dialog"
      aria-modal="false"
      aria-labelledby="assessment-detail-title"
    >
      <header className="assessment-detail-head">
        <div>
          {detail?.courseCode && (
            <CourseIdentity
              code={detail.courseCode}
              color={courseColor(detail.courseColorReference)}
            />
          )}
          <h2 id="assessment-detail-title">{detail?.title ?? "Assessment unavailable"}</h2>
          {detail?.courseName && <p>{detail.courseName}</p>}
        </div>
        <AssessmentClose id={detail?.id ?? ""} />
      </header>
      {detail ? (
        <>
          <div className="assessment-facts">
            <div>
              <small>Due</small>
              <strong>{when(detail.dueAt, model.timezone)}</strong>
            </div>
            <div>
              <small>Work</small>
              <strong>{minutes(detail.remainingMinutes)}</strong>
            </div>
            <div>
              <small>Type</small>
              <strong>{detail.type}</strong>
            </div>
          </div>
          <nav className="assessment-tabs" aria-label="Assessment detail sections">
            {tabs.map(([key, label]) => (
              <Link
                key={key}
                href={`${base}&view=${key}`}
                className={view === key ? "active" : ""}
                aria-current={view === key ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          {view === "overview" && (
            <div className="assessment-detail-body">
              <p>
                <strong>Submission:</strong>{" "}
                {detail.submissionStatus.replaceAll("_", " ").toLowerCase()}
              </p>
              <p>
                <strong>Planner risk:</strong>{" "}
                {detail.risk
                  ? detail.risk.replaceAll("_", " ").toLowerCase()
                  : model.planner.authoritativeRun
                    ? "No risk reported in the last successful plan"
                    : "No successful plan available"}
              </p>
              <dl>
                <div>
                  <dt>Released</dt>
                  <dd>{when(detail.releaseAt, model.timezone)}</dd>
                </div>
                <div>
                  <dt>Preferred completion</dt>
                  <dd>{when(detail.preferredCompletionAt, model.timezone)}</dd>
                </div>
                <div>
                  <dt>Grade weight</dt>
                  <dd>{detail.gradeWeight === null ? "Unknown" : `${detail.gradeWeight}%`}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>
                    {detail.source.replaceAll("_", " ").toLowerCase()} ·{" "}
                    {detail.sourceAuthority.replaceAll("_", " ").toLowerCase()}
                  </dd>
                </div>
              </dl>
              {detail.notes && (
                <p>
                  <strong>Notes:</strong> {detail.notes}
                </p>
              )}
            </div>
          )}
          {view === "tasks" && (
            <section className="assessment-detail-body">
              <h3>Related tasks</h3>
              {detail.tasks.length ? (
                <ul>
                  {detail.tasks.map((task) => (
                    <li key={task.id}>
                      <strong>{task.title}</strong>
                      <span>
                        {task.status.replaceAll("_", " ").toLowerCase()} ·{" "}
                        {minutes(task.remainingMinutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No related tasks recorded.</p>
              )}
            </section>
          )}
          {view === "sessions" && (
            <section className="assessment-detail-body">
              <h3>Planned sessions</h3>
              {detail.sessions.length ? (
                <ul>
                  {detail.sessions.map((session) => (
                    <li key={session.id}>
                      <strong>{session.taskTitle}</strong>
                      <span>
                        {when(session.startAt, model.timezone)} ·{" "}
                        {session.generatedBy === "PLANNER" ? "Planner" : "Manual"}
                        {session.locked ? " · Locked" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No active sessions are shown in the current read horizon.</p>
              )}
            </section>
          )}
          {view === "notes" && (
            <section className="assessment-detail-body">
              <h3>Notes</h3>
              <p>{detail.notes ?? "No notes recorded."}</p>
            </section>
          )}
          {view === "resources" && (
            <section className="assessment-detail-body">
              <h3>Resources</h3>
              {external(detail.instructionsUrl) && (
                <a
                  href={external(detail.instructionsUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open instructions <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
              {external(detail.submissionUrl) && (
                <a href={external(detail.submissionUrl)!} target="_blank" rel="noopener noreferrer">
                  Open submission page <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
              {!external(detail.instructionsUrl) && !external(detail.submissionUrl) && (
                <p>No resource links recorded.</p>
              )}
            </section>
          )}
          <p className="assessment-deferred">
            Editing, submission updates, and task resolution belong to later workflows.
          </p>
        </>
      ) : (
        <p className="assessment-detail-body">
          This assessment is unavailable. The link may be invalid or you may not have access.
        </p>
      )}
    </aside>
  );
}

export function UpcomingView({
  model,
  range,
  sort,
  view,
}: {
  model: UpcomingViewModel;
  range: string;
  sort: "PRESSURE" | "DUE";
  view: string;
}) {
  const visible = model.groups.filter(
    (group) =>
      range === "all" ||
      (range === "7" && ["OVERDUE", "NEXT_7"].includes(group.id)) ||
      (range === "14" && ["OVERDUE", "NEXT_7", "NEXT_14"].includes(group.id)) ||
      (range === "later" && ["LATER", "UNKNOWN"].includes(group.id)),
  );
  const tabs = [
    ["7", "Next 7 days"],
    ["14", "Next 2 weeks"],
    ["later", "Later"],
    ["all", "All"],
  ];
  return (
    <div
      className={`route-content upcoming-content${model.selectedAssessment || model.selectionUnavailable ? " has-detail" : ""}`}
    >
      <header className="page-header">
        <h1 id="upcoming-title" tabIndex={-1}>
          Upcoming
        </h1>
        <p>Your assessments, deadlines, and important commitments.</p>
      </header>
      <div className="upcoming-toolbar">
        <nav className="upcoming-tabs" aria-label="Upcoming range">
          {tabs.map(([key, label]) => (
            <Link
              key={key}
              href={`/upcoming?range=${key}&sort=${sort === "DUE" ? "due" : "pressure"}`}
              className={range === key ? "active" : ""}
              aria-current={range === key ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link
          className="button button-secondary"
          href={`/upcoming?range=${range}&sort=${sort === "DUE" ? "pressure" : "due"}`}
        >
          Sort by · {sort === "DUE" ? "Due date" : "Planner pressure"}
        </Link>
      </div>
      {model.planner.status === "FAILED" && (
        <p className="upcoming-plan-note">
          Plan update failed. Risk labels come from the last successful plan, which remains
          authoritative.
        </p>
      )}
      {model.planner.status === "RUNNING" && (
        <p className="upcoming-plan-note">
          Plan update running. Risk labels come from the last successful plan, if available.
        </p>
      )}
      {model.planner.status === "UNPLANNED" && (
        <p className="upcoming-plan-note">
          No successful plan yet. Commitments and known remaining work are still shown.
        </p>
      )}
      {visible.map(
        (group) =>
          group.items.length > 0 && (
            <section
              key={group.id}
              className="upcoming-group"
              aria-labelledby={`upcoming-${group.id}`}
            >
              <h2 id={`upcoming-${group.id}`}>{groupNames[group.id]}</h2>
              <ul>
                {group.items.map((item) => (
                  <li key={`${item.kind}:${item.id}`}>
                    <div
                      className={`upcoming-row course-${courseColor(item.courseColorReference)}`}
                    >
                      <span className="upcoming-course">
                        {item.courseCode ? (
                          <CourseIdentity
                            code={item.courseCode}
                            color={courseColor(item.courseColorReference)}
                          />
                        ) : (
                          "Personal"
                        )}
                      </span>
                      <span className="upcoming-title">
                        <strong>{item.title}</strong>
                        <small>
                          {item.type} · {item.kind === "ASSESSMENT" ? "Assessment" : "Task"}
                        </small>
                      </span>
                      <span className="upcoming-due">{when(item.dueAt, model.timezone)}</span>
                      <span className="upcoming-work">{minutes(item.remainingMinutes)}</span>
                      <StatusIndicator tone={tone(item)}>{statusLabel(item)}</StatusIndicator>
                      {item.kind === "ASSESSMENT" ? (
                        <Link
                          href={assessmentHref(item.id, range, sort)}
                          data-assessment-id={item.id}
                          aria-label={`Open assessment: ${item.title}`}
                          className="upcoming-open"
                        >
                          <ChevronRight size={18} aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="upcoming-open" aria-hidden="true" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
      {!visible.some((group) => group.items.length > 0) && (
        <p className="upcoming-empty">No commitments in this range.</p>
      )}
      <AssessmentDetail
        detail={model.selectedAssessment}
        model={model}
        range={range}
        sort={sort}
        view={view}
      />
    </div>
  );
}
