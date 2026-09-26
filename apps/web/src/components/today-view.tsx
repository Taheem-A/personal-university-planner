import Link from "next/link";
import { ArrowRight, Clock3, LockKeyhole } from "lucide-react";
import type {
  TodayViewModel,
  ScheduleItem,
  RemainingTaskItem,
} from "../server/application/planner-reads";
import {
  CourseIdentity,
  FixedEventBlock,
  StatusIndicator,
  WorkSessionBlock,
} from "./planner-primitives";
import { TodaySelectionClose } from "./today-selection-close";
import { courseColor } from "./course-color";

function clock(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
function longDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
function duration(minutes: number | null) {
  if (minutes === null) return "Estimate unknown";
  if (minutes === 0) return "No work remaining";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}h` : "", rest ? `${rest}m` : ""].filter(Boolean).join(" ");
}
function amount(minutes: number) {
  return minutes === 0 ? "0m" : duration(minutes);
}
function remainingLabel(minutes: number | null) {
  return minutes === null
    ? "Remaining estimate unknown"
    : minutes === 0
      ? "No work remaining"
      : `${duration(minutes)} remaining`;
}
function dueLabel(dueAt: Date | null | undefined, timezone: string) {
  if (!dueAt) return "Due date unknown";
  return `Due ${new Intl.DateTimeFormat("en", { timeZone: timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(dueAt)}`;
}
function itemLabel(item: ScheduleItem) {
  switch (item.kind) {
    case "WORK":
      return item.generatedBy === "PLANNER" ? "Planned work" : "Manual work";
    case "COURSE_MEETING":
      return "Class";
    case "EVENT":
      return "Fixed event";
    case "SLEEP":
      return "Sleep";
    case "PROTECTED":
      return "Protected time";
    case "COMMUTE_WINDOW":
      return "Commute";
  }
}
function warningLabel(code: string) {
  const labels: Record<string, string> = {
    HARD_CONFLICT: "A fixed commitment conflicts with planned work.",
    LOW_SLACK: "A task has little flexibility before its deadline.",
    NO_SUITABLE_WINDOW: "Some work has no suitable time window.",
    DEPENDENCY_BLOCKED: "A task depends on unfinished work.",
    SOFT_TIME_USED: "The plan uses time you preferred to protect.",
    DEADLINE_BUFFER_USED: "The plan uses part of your preferred deadline buffer.",
    DAILY_STUDY_LIMIT_EXCEEDED: "Planned study exceeds your preferred daily limit.",
    FREE_TIME_BUFFER_USED: "The plan uses part of your preferred free-time buffer.",
    STABILITY_RELAXED: "Some planned sessions had to move.",
    INVALID_OUTPUT: "The last plan update could not be accepted.",
    CORE_FAILURE: "The last plan update could not finish.",
    STALE_SNAPSHOT: "The plan changed while the update was running.",
    PERSISTENCE_FAILURE: "The last plan update could not be saved.",
    ABANDONED: "A plan update stopped before it finished.",
  };
  return labels[code] ?? "The planner reported a constraint.";
}
function plannerMessage(model: TodayViewModel) {
  switch (model.planner.status) {
    case "RUNNING":
      return {
        tone: "info" as const,
        title: "Updating plan",
        detail: model.planner.authoritativeRun
          ? "Showing the last successful plan while this update runs."
          : "No plan is available yet. Existing commitments remain visible.",
      };
    case "FAILED":
      return {
        tone: "danger" as const,
        title: "Plan update failed",
        detail: model.planner.authoritativeRun
          ? "The last successful plan remains visible. The failed update did not replace it."
          : "No successful plan is available. Your existing commitments remain visible.",
      };
    case "UNPLANNED":
      return {
        tone: "info" as const,
        title: "No plan yet",
        detail:
          "Your existing commitments and tasks are shown, but no planner-generated schedule is available.",
      };
    case "CURRENT":
      return {
        tone: "success" as const,
        title: "Plan current",
        detail: "Showing the latest successful plan.",
      };
  }
}
function selectionHref(date: string, kind: "session" | "task", id: string) {
  return `/today?date=${encodeURIComponent(date)}&${kind}=${encodeURIComponent(id)}`;
}

function TodayTimelineItem({
  item,
  model,
  selected,
}: {
  item: ScheduleItem;
  model: TodayViewModel;
  selected: boolean;
}) {
  const displayStart = item.visibleStartAt ?? item.startAt;
  const displayEnd = item.visibleEndAt ?? item.endAt;
  const span = `${clock(displayStart, model.timezone)}–${clock(displayEnd, model.timezone)}`;
  const color = courseColor(item.courseColorReference);
  let content;
  if (item.kind === "WORK") {
    content = (
      <WorkSessionBlock
        title={item.title}
        courseCode={item.courseCode ?? "Personal"}
        color={color}
        time={span}
        locked={item.locked}
        manual={item.generatedBy === "USER"}
      />
    );
  } else if (item.kind === "COURSE_MEETING" || item.kind === "EVENT") {
    content = (
      <FixedEventBlock title={item.title} courseCode={item.courseCode} color={color} time={span} />
    );
  } else {
    content = (
      <div className={`time-object today-neutral today-${item.kind.toLowerCase()}`}>
        <span className="time-object-title">{item.title}</span>
        <span className="time-object-meta">{itemLabel(item)}</span>
        <time>{span}</time>
      </div>
    );
  }
  return (
    <li className="today-timeline-row">
      <time className="today-time" dateTime={displayStart.toISOString()}>
        {clock(displayStart, model.timezone)}
      </time>
      {item.kind === "WORK" ? (
        <Link
          href={selectionHref(model.date, "session", item.id)}
          data-session-id={item.id}
          className={`today-timeline-link${selected ? " selected" : ""}`}
          aria-label={`Open session: ${item.courseCode ? item.courseCode + ", " : ""}${item.title}, ${span}`}
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}
function TaskRow({
  task,
  model,
  selected,
}: {
  task: RemainingTaskItem;
  model: TodayViewModel;
  selected: boolean;
}) {
  return (
    <li>
      <Link
        href={selectionHref(model.date, "task", task.id)}
        data-task-id={task.id}
        className={`today-task-row${selected ? " selected" : ""}`}
        aria-label={`Open task: ${task.title}, ${duration(task.remainingMinutes)}, ${dueLabel(task.dueAt, model.timezone)}`}
      >
        <span className="today-row-open" aria-hidden="true">
          <ArrowRight size={16} />
        </span>
        {task.courseCode && (
          <CourseIdentity code={task.courseCode} color={courseColor(task.courseColorReference)} />
        )}
        <span className="today-task-title">{task.title}</span>
        <span className="today-task-meta">{duration(task.remainingMinutes)}</span>
        <span className="today-task-due">{dueLabel(task.dueAt, model.timezone)}</span>
      </Link>
    </li>
  );
}
function TodayDetail({
  model,
  session,
  task,
}: {
  model: TodayViewModel;
  session: ScheduleItem | null;
  task: RemainingTaskItem | null;
}) {
  if (!session && !task) return null;
  const code = session?.courseCode ?? task?.courseCode;
  const reference = session?.courseColorReference ?? task?.courseColorReference;
  return (
    <aside
      className="today-detail"
      role="dialog"
      aria-modal="false"
      aria-labelledby="today-detail-title"
    >
      <div className="today-detail-head">
        <div>
          <p className="panel-kicker">{session ? "Work session" : "Task"}</p>
          <h2 id="today-detail-title">{session?.title ?? task?.title}</h2>
        </div>
        <TodaySelectionClose />
      </div>
      {code && <CourseIdentity code={code} color={courseColor(reference)} />}
      {session && (
        <p>
          <Clock3 size={16} aria-hidden="true" /> {clock(session.startAt, model.timezone)}–
          {clock(session.endAt, model.timezone)}
        </p>
      )}
      {session?.locked && (
        <p>
          <LockKeyhole size={16} aria-hidden="true" /> Locked time
        </p>
      )}
      <p>{remainingLabel(session?.remainingMinutes ?? task?.remainingMinutes ?? null)}</p>
      <p>{dueLabel(session?.dueAt ?? task?.dueAt, model.timezone)}</p>
      {(session?.assessmentId ?? task?.assessmentId) && (
        <Link
          href={`/today?date=${encodeURIComponent(model.date)}&assessment=${encodeURIComponent((session?.assessmentId ?? task?.assessmentId)!)}`}
          className="button button-secondary"
        >
          Open assessment context
        </Link>
      )}
      <p className="today-deferred">
        Session and task editing arrive in a later Milestone 5 slice. Completion remains deferred to
        Milestone 7.
      </p>
    </aside>
  );
}

export function TodayView({
  model,
  selectedSession,
  selectedTask,
}: {
  model: TodayViewModel;
  selectedSession: string | null;
  selectedTask: string | null;
}) {
  const featured = model.currentItem ?? model.nextItem;
  const selectedWork =
    model.timeline.find((item) => item.kind === "WORK" && item.id === selectedSession) ?? null;
  const selectedRemaining = model.remainingTasks.find((task) => task.id === selectedTask) ?? null;
  const plan = plannerMessage(model);
  const totalRisk = model.risks.length;
  return (
    <div className="route-content today-content">
      <header className="today-header">
        <h1>Today</h1>
        <p className="today-date">{longDate(model.date)}</p>
        <p className="today-summary">
          {amount(model.remainingPlannedWorkMinutes)} planned work remaining
          <span aria-hidden="true"> · </span>
          {amount(model.plannedWorkMinutes)} scheduled today
        </p>
      </header>
      <section className={`today-plan-state state-${plan.tone}`} aria-label="Planner status">
        <StatusIndicator tone={plan.tone}>{plan.title}</StatusIndicator>
        <p>{plan.detail}</p>
      </section>
      <div className="today-main">
        {(totalRisk > 0 || model.warnings.length > 0) && (
          <section className="today-exception" aria-labelledby="today-exception-title">
            <h2 id="today-exception-title">Needs attention</h2>
            {model.risks.length > 0 && (
              <ul>
                {model.risks.map((risk) => (
                  <li key={risk.taskId}>
                    <strong>
                      {risk.courseCode ? risk.courseCode + " · " : ""}
                      {risk.title}
                    </strong>
                    <span>
                      {risk.feasibility === "INFEASIBLE"
                        ? "Doesn’t currently fit"
                        : risk.feasibility === "CRITICAL"
                          ? "At risk"
                          : risk.feasibility === "CONSTRAINED"
                            ? "Low flexibility"
                            : "Beyond the current plan horizon"}
                      {risk.deficitMinutes > 0 ? ` · ${duration(risk.deficitMinutes)} short` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {model.warnings.length > 0 && (
              <ul>
                {model.warnings.slice(0, 4).map((warning, index) => (
                  <li key={`${warning.code}-${index}`}>{warningLabel(warning.code)}</li>
                ))}
                {model.warnings.length > 4 && (
                  <li>{model.warnings.length - 4} more planner warnings</li>
                )}
              </ul>
            )}
          </section>
        )}
        <section className="today-feature" aria-labelledby="today-feature-title">
          <p className="today-eyebrow">
            {model.currentItem ? "Now" : featured ? "Next" : "Schedule"}
          </p>
          {featured ? (
            <>
              <div className="today-feature-body">
                {featured.courseCode && (
                  <CourseIdentity
                    code={featured.courseCode}
                    color={courseColor(featured.courseColorReference)}
                  />
                )}
                <div>
                  <h2 id="today-feature-title">{featured.title}</h2>
                  <p className="today-feature-type">
                    {itemLabel(featured)}
                    {featured.locked ? " · Locked" : ""}
                  </p>
                  <p className="today-feature-meta">
                    <Clock3 size={15} aria-hidden="true" />{" "}
                    {clock(featured.startAt, model.timezone)}–
                    {clock(featured.endAt, model.timezone)}
                    {featured.kind === "WORK"
                      ? ` · ${remainingLabel(featured.remainingMinutes ?? null)}`
                      : ""}
                  </p>
                  {featured.kind === "WORK" && (
                    <p className="today-feature-meta">{dueLabel(featured.dueAt, model.timezone)}</p>
                  )}
                </div>
              </div>
              {featured.kind === "WORK" && (
                <div className="today-feature-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    disabled
                    title="Completion is not available yet"
                  >
                    Mark complete
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled
                    title="Adjustment is not available yet"
                  >
                    Adjust
                  </button>
                  <Link
                    className="button button-ghost"
                    href={selectionHref(model.date, "session", featured.id)}
                  >
                    View session
                  </Link>
                  <span className="today-deferred">
                    Completion and adjustment are coming later.
                  </span>
                </div>
              )}
              {featured.kind !== "WORK" && model.nextWorkItem && (
                <p className="today-next-work">
                  Next planned work:{" "}
                  <Link href={selectionHref(model.date, "session", model.nextWorkItem.id)}>
                    {model.nextWorkItem.courseCode ? model.nextWorkItem.courseCode + " · " : ""}
                    {model.nextWorkItem.title} at{" "}
                    {clock(model.nextWorkItem.startAt, model.timezone)}
                  </Link>
                </p>
              )}
            </>
          ) : (
            <>
              <h2 id="today-feature-title">Nothing else is scheduled today</h2>
              <p className="today-feature-type">
                There is no current or next commitment in this day’s plan.
              </p>
            </>
          )}
        </section>
        <section className="today-section" aria-labelledby="today-schedule-title">
          <div className="today-section-head">
            <h2 id="today-schedule-title">Today’s schedule</h2>
            <Link href="/week" className="button button-secondary">
              Open Week
            </Link>
          </div>
          {model.timeline.length ? (
            <ol className="today-timeline" aria-label="Today's schedule">
              {model.timeline.map((item) => (
                <TodayTimelineItem
                  key={item.id}
                  item={item}
                  model={model}
                  selected={selectedSession === item.id}
                />
              ))}
            </ol>
          ) : (
            <p className="today-empty-copy">No commitments are scheduled for this day.</p>
          )}
        </section>
        <section className="today-section" aria-labelledby="today-tasks-title">
          <div className="today-section-head">
            <h2 id="today-tasks-title">
              Still to do
              {model.remainingTasks.length > 0 ? ` · ${model.remainingTasks.length}` : ""}
            </h2>
            <Link href="/upcoming" className="button button-ghost">
              View all
            </Link>
          </div>
          {model.remainingTasks.length ? (
            <ul className="today-task-list">
              {model.remainingTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  model={model}
                  selected={selectedTask === task.id}
                />
              ))}
            </ul>
          ) : (
            <p className="today-empty-copy">Nothing else needs your attention today.</p>
          )}
        </section>
      </div>
      <aside className="today-rail" aria-label="Today context and actions">
        <section className="today-rail-section" aria-labelledby="today-upcoming-title">
          <div className="today-rail-head">
            <h2 id="today-upcoming-title">Upcoming work</h2>
            <Link href="/upcoming">View all</Link>
          </div>
          {model.remainingTasks.length ? (
            <ul className="today-rail-list">
              {model.remainingTasks.slice(0, 3).map((task) => (
                <li key={task.id}>
                  <Link href={selectionHref(model.date, "task", task.id)}>
                    <strong>
                      {task.courseCode ? `${task.courseCode} · ` : ""}
                      {task.title}
                    </strong>
                    <span>{dueLabel(task.dueAt, model.timezone)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>No remaining work in this view.</p>
          )}
        </section>
        <section className="today-rail-section" aria-labelledby="today-actions-title">
          <h2 id="today-actions-title">Quick actions</h2>
          <nav aria-label="Today quick actions">
            <Link href="/inbox?capture=1">
              Add something <span>Capture raw text</span>
            </Link>
            <Link href="/today?panel=planner">
              Open Planner <span>Review plan context</span>
            </Link>
            <Link href="/availability">
              Review availability <span>See your time rules</span>
            </Link>
          </nav>
        </section>
      </aside>
      <TodayDetail model={model} session={selectedWork} task={selectedRemaining} />
    </div>
  );
}
