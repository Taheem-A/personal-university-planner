import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock3, LockKeyhole } from "lucide-react";
import { addLocalDays } from "@university-planner/shared";
import type { ScheduleItem, WeekViewModel } from "../server/application/planner-reads";
import { CourseIdentity, StatusIndicator } from "./planner-primitives";
import { courseColor } from "./course-color";
import { layoutWeek, type WeekSegment } from "./week-layout";
import { WeekSelectionClose, WeekSwipe } from "./week-interactions";

function dateLabel(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", { timeZone: "UTC", ...options }).format(
    new Date(`${date}T12:00:00Z`),
  );
}
function time(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
function duration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours ? `${hours}h` : ""}${hours && rest ? " " : ""}${rest ? `${rest}m` : ""}` || "0m";
}
function typeLabel(item: ScheduleItem) {
  if (item.kind === "WORK") return item.generatedBy === "PLANNER" ? "Planned work" : "Manual work";
  if (item.kind === "COURSE_MEETING") return "Class";
  if (item.kind === "EVENT") return "Fixed event";
  if (item.kind === "SLEEP") return "Sleep";
  if (item.kind === "PROTECTED") return "Protected time";
  return "Commute availability";
}
function itemHref(model: WeekViewModel, item: ScheduleItem, day: string) {
  const key = item.kind === "WORK" ? "session" : "event";
  return `/week?date=${model.weekStart}&day=${day}&${key}=${encodeURIComponent(item.id)}`;
}
function itemName(item: ScheduleItem, timezone: string) {
  return `${item.courseCode ? item.courseCode + ", " : ""}${item.title}, ${typeLabel(item)}, ${time(item.startAt, timezone)} to ${time(item.endAt, timezone)}${item.locked ? ", locked" : ""}`;
}
function WeekBlock({
  model,
  segment,
  gridStart,
}: {
  model: WeekViewModel;
  segment: WeekSegment;
  gridStart?: number;
}) {
  const { item } = segment;
  const style =
    gridStart !== undefined
      ? {
          top: `${Math.max(0, (segment.startMinute - gridStart) * 0.8)}px`,
          height: `${Math.max(28, (segment.endMinute - segment.startMinute) * 0.8)}px`,
          left: `calc(4px + ${segment.lane} * (100% - 8px) / ${segment.laneCount})`,
          width: `calc((100% - 8px) / ${segment.laneCount} - 3px)`,
        }
      : undefined;
  return (
    <Link
      href={itemHref(model, item, segment.day)}
      className={`week-event week-kind-${item.kind.toLowerCase()} course-${courseColor(item.courseColorReference)}${gridStart !== undefined ? " week-positioned" : ""}`}
      style={style}
      aria-label={`Open ${itemName(item, model.timezone)}`}
      data-week-object={item.id}
    >
      <strong>
        {item.courseCode ? `${item.courseCode} · ` : ""}
        {item.title}
      </strong>
      <span>
        {typeLabel(item)}
        {segment.continuesBefore || segment.continuesAfter ? " · Continues across midnight" : ""}
      </span>
      <span>
        {time(item.startAt, model.timezone)}–{time(item.endAt, model.timezone)}
      </span>
    </Link>
  );
}
function planState(model: WeekViewModel) {
  switch (model.planner.status) {
    case "CURRENT":
      return {
        tone: "success" as const,
        title: "Plan current",
        detail: "Showing the latest successful plan.",
      };
    case "RUNNING":
      return {
        tone: "info" as const,
        title: "Updating plan",
        detail: model.planner.authoritativeRun
          ? "The last successful plan remains visible while the update runs."
          : "No plan is available yet; existing commitments remain visible.",
      };
    case "FAILED":
      return {
        tone: "danger" as const,
        title: "Plan update failed",
        detail: model.planner.authoritativeRun
          ? "The failed update did not replace the last successful plan."
          : "No successful plan is available; existing commitments remain visible.",
      };
    case "UNPLANNED":
      return {
        tone: "info" as const,
        title: "No plan yet",
        detail: "Existing commitments are visible, but no planner-generated schedule is available.",
      };
  }
}
function WeekDetail({
  model,
  item,
  deadline,
}: {
  model: WeekViewModel;
  item: ScheduleItem | null;
  deadline: WeekViewModel["deadlines"][number] | null;
}) {
  if (!item && !deadline) return null;
  const title = item?.title ?? deadline?.title;
  const courseCode = item?.courseCode ?? deadline?.courseCode;
  const reference = item?.courseColorReference ?? deadline?.courseColorReference;
  return (
    <aside
      className="week-detail"
      role="dialog"
      aria-modal="false"
      aria-labelledby="week-detail-title"
    >
      <div className="week-detail-head">
        <div>
          <p className="panel-kicker">{item ? typeLabel(item) : "Deadline"}</p>
          <h2 id="week-detail-title">{title}</h2>
        </div>
        <WeekSelectionClose />
      </div>
      {courseCode && <CourseIdentity code={courseCode} color={courseColor(reference)} />}
      {item && (
        <p>
          <Clock3 size={16} aria-hidden="true" /> {time(item.startAt, model.timezone)}–
          {time(item.endAt, model.timezone)}
        </p>
      )}
      {item?.locked && (
        <p>
          <LockKeyhole size={16} aria-hidden="true" /> Locked time
        </p>
      )}
      {deadline && (
        <p>
          Due{" "}
          {new Intl.DateTimeFormat("en", {
            timeZone: model.timezone,
            dateStyle: "medium",
            timeStyle: "short",
          }).format(deadline.dueAt)}
        </p>
      )}
      {item?.assessmentId && (
        <Link
          className="button button-secondary"
          href={`/week?date=${model.weekStart}&assessment=${encodeURIComponent(item.assessmentId)}`}
        >
          Open assessment context
        </Link>
      )}
      <p className="week-detail-note">
        Schedule changes and completion arrive in later slices. This view has not changed the plan.
      </p>
    </aside>
  );
}

export function WeekView({
  model,
  selectedDay,
  selectedSession,
  selectedEvent,
  selectedDeadline,
  currentDate,
}: {
  model: WeekViewModel;
  selectedDay: string;
  selectedSession: string | null;
  selectedEvent: string | null;
  selectedDeadline: string | null;
  currentDate: string;
}) {
  const days = model.days;
  const segments = layoutWeek(model.schedule, model.weekStart, model.timezone);
  const all = segments.flat();
  const visibleItems = all.filter((segment) => segment.item.kind !== "SLEEP");
  const startHour = Math.max(
    0,
    Math.min(8, Math.floor(Math.min(...visibleItems.map((item) => item.startMinute), 480) / 60)),
  );
  const endHour = Math.min(
    24,
    Math.max(22, Math.ceil(Math.max(...visibleItems.map((item) => item.endMinute), 1320) / 60)),
  );
  const weekCurrent = currentDate >= model.weekStart && currentDate < model.weekEnd;
  const plan = planState(model);
  const selected =
    model.schedule.find((item) => item.id === selectedSession || item.id === selectedEvent) ?? null;
  const deadline =
    model.deadlines.find((item) => `${item.kind}:${item.id}` === selectedDeadline) ?? null;
  const outsideTerm =
    model.activeTermRange &&
    (model.weekEnd <= model.activeTermRange.startDate ||
      model.weekStart > model.activeTermRange.endDate);
  const totalWork = days.reduce((sum, day) => sum + day.plannedWorkMinutes, 0);
  return (
    <div className="route-content week-content">
      <header className="week-heading">
        <h1>Week</h1>
        <p>
          {dateLabel(model.weekStart, { month: "long", day: "numeric" })} –{" "}
          {dateLabel(addLocalDays(model.weekEnd, -1), {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </header>
      <nav className="week-toolbar" aria-label="Week navigation">
        <Link
          className="icon-button"
          aria-label="Previous week"
          href={`/week?date=${addLocalDays(model.weekStart, -7)}`}
        >
          <ChevronLeft size={18} />
        </Link>
        <Link className="button button-secondary" href="/week">
          This week
        </Link>
        <Link className="icon-button" aria-label="Next week" href={`/week?date=${model.weekEnd}`}>
          <ChevronRight size={18} />
        </Link>
        {!weekCurrent && <span className="week-period-hint">Viewing another week</span>}
      </nav>
      <section className={`week-plan-state state-${plan.tone}`} aria-label="Planner status">
        <StatusIndicator tone={plan.tone}>{plan.title}</StatusIndicator>
        <p>{plan.detail}</p>
      </section>
      {outsideTerm && (
        <p className="week-note">
          This week falls outside the active academic term. Existing commitments may still appear.
        </p>
      )}
      {(model.risks.length > 0 || model.warnings.length > 0) && (
        <section className="week-alert" aria-labelledby="week-alert-title">
          <h2 id="week-alert-title">Needs attention</h2>
          <ul>
            {model.risks.map((risk) => (
              <li key={risk.taskId}>
                {risk.courseCode ? `${risk.courseCode} · ` : ""}
                {risk.title}:{" "}
                {risk.feasibility === "INFEASIBLE"
                  ? `${duration(risk.deficitMinutes)} does not fit`
                  : risk.feasibility === "CRITICAL"
                    ? "at risk"
                    : risk.feasibility === "CONSTRAINED"
                      ? "low flexibility"
                      : "beyond this plan’s horizon"}
              </li>
            ))}
            {model.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>
                Planner warning: {warning.code.replaceAll("_", " ").toLowerCase()}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="week-calendar" role="region" aria-label="Seven-day planning calendar">
        <div className="week-grid-head">
          <div aria-hidden="true" />
          {days.map((day) => (
            <div
              key={day.date}
              className={`week-day-head${day.date === currentDate ? " is-today" : ""}`}
            >
              <span>{dateLabel(day.date, { weekday: "short" })}</span>
              <strong>{dateLabel(day.date, { day: "numeric" })}</strong>
              <small>{duration(day.plannedWorkMinutes)} work</small>
              <span
                className="week-capacity"
                role="img"
                aria-label={`${duration(day.availabilityWindowMinutes)} available`}
              >
                <span
                  style={{
                    width: `${day.availabilityWindowMinutes ? Math.min(100, Math.round((day.plannedWorkMinutes / day.availabilityWindowMinutes) * 100)) : 0}%`,
                  }}
                />
              </span>
              {day.riskTaskIds.length > 0 && <small className="week-risk-text">At risk</small>}
            </div>
          ))}
        </div>
        <div className="week-grid-body">
          <div className="week-time-gutter">
            {Array.from({ length: endHour - startHour + 1 }, (_, i) => (
              <span key={i} style={{ top: `${i * 48}px` }}>
                {((startHour + i + 11) % 12) + 1} {startHour + i < 12 ? "AM" : "PM"}
              </span>
            ))}
          </div>
          {days.map((day, index) => (
            <div
              className="week-day-column"
              key={day.date}
              data-week-column={day.date}
              style={{ height: `${(endHour - startHour) * 48}px` }}
            >
              {segments[index]
                .filter(
                  (segment) =>
                    segment.item.kind !== "SLEEP" &&
                    segment.endMinute > startHour * 60 &&
                    segment.startMinute < endHour * 60,
                )
                .map((segment) => (
                  <WeekBlock
                    key={`${segment.item.id}:${day.date}`}
                    model={model}
                    segment={segment}
                    gridStart={startHour * 60}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
      <div className="week-mobile">
        <nav className="week-day-strip" aria-label="Select day">
          {days.map((day) => (
            <Link
              key={day.date}
              href={`/week?date=${model.weekStart}&day=${day.date}`}
              className={day.date === selectedDay ? "is-selected" : ""}
              aria-current={day.date === selectedDay ? "date" : undefined}
            >
              <span>{dateLabel(day.date, { weekday: "short" })}</span>
              <strong>{dateLabel(day.date, { day: "numeric" })}</strong>
              {day.riskTaskIds.length > 0 && (
                <span className="week-day-risk" aria-label="At risk">
                  !
                </span>
              )}
            </Link>
          ))}
        </nav>
        <WeekSwipe
          previous={
            selectedDay === model.weekStart
              ? `/week?date=${addLocalDays(model.weekStart, -7)}&day=${addLocalDays(selectedDay, -1)}`
              : `/week?date=${model.weekStart}&day=${addLocalDays(selectedDay, -1)}`
          }
          next={
            addLocalDays(selectedDay, 1) === model.weekEnd
              ? `/week?date=${model.weekEnd}&day=${model.weekEnd}`
              : `/week?date=${model.weekStart}&day=${addLocalDays(selectedDay, 1)}`
          }
        >
          <section className="week-mobile-agenda" aria-labelledby="week-mobile-title">
            <h2 id="week-mobile-title">
              {dateLabel(selectedDay, { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            {segments[days.findIndex((day) => day.date === selectedDay)]?.length ? (
              <ol>
                {segments[days.findIndex((day) => day.date === selectedDay)].map((segment) => (
                  <li key={segment.item.id}>
                    <time dateTime={segment.item.startAt.toISOString()}>
                      {time(segment.item.startAt, model.timezone)}
                    </time>
                    <WeekBlock model={model} segment={segment} />
                  </li>
                ))}
              </ol>
            ) : (
              <p>No commitments scheduled for this day.</p>
            )}
          </section>
        </WeekSwipe>
      </div>
      <div className="week-footer">
        <section className="week-summary" aria-labelledby="week-work-title">
          <h2 id="week-work-title">Workload overview</h2>
          <p>{duration(totalWork)} planned work this week</p>
          <div className="week-work-bars">
            {days.map((day) => (
              <div key={day.date}>
                <span>{dateLabel(day.date, { weekday: "short" })}</span>
                <strong>{duration(day.plannedWorkMinutes)}</strong>
                <span
                  className={`week-work-bar${day.plannedWorkMinutes === 0 ? " is-empty" : day.riskTaskIds.length ? " has-risk" : ""}`}
                  style={{ height: `${Math.max(4, Math.min(50, day.plannedWorkMinutes / 6))}px` }}
                  aria-hidden="true"
                />
                <small>
                  {day.availabilityWindowMinutes
                    ? `${duration(day.availabilityWindowMinutes)} available`
                    : "No availability"}
                </small>
              </div>
            ))}
          </div>
        </section>
        <section className="week-summary" aria-labelledby="week-deadline-title">
          <h2 id="week-deadline-title">Deadlines this week</h2>
          {model.deadlines.length ? (
            <ul className="week-deadlines">
              {model.deadlines.map((due) => (
                <li key={`${due.kind}:${due.id}`}>
                  <Link
                    href={`/week?date=${model.weekStart}&deadline=${due.kind}:${encodeURIComponent(due.id)}`}
                    data-week-deadline={`${due.kind}:${due.id}`}
                  >
                    <span>
                      {due.courseCode ? `${due.courseCode} · ` : ""}
                      {due.title}
                    </span>
                    <time dateTime={due.dueAt.toISOString()}>
                      {new Intl.DateTimeFormat("en", {
                        timeZone: model.timezone,
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(due.dueAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>No deadlines this week.</p>
          )}
        </section>
      </div>
      {model.latestChange &&
        (model.latestChange.moved.length > 0 ||
          model.latestChange.added.length > 0 ||
          model.latestChange.removed.length > 0) && (
          <section className="week-changes" aria-labelledby="week-changes-title">
            <h2 id="week-changes-title">Latest plan changes</h2>
            <p>
              {model.latestChange.moved.length} moved · {model.latestChange.added.length} added ·{" "}
              {model.latestChange.removed.length} removed.{" "}
              <Link href="/week?panel=planner">Open Planner context</Link>
            </p>
          </section>
        )}
      <details className="week-accessible">
        <summary>Read week as a day-by-day list</summary>
        {days.map((day, index) => (
          <section key={day.date}>
            <h3>{dateLabel(day.date, { weekday: "long", month: "long", day: "numeric" })}</h3>
            {segments[index].length ? (
              <ol>
                {segments[index].map((segment) => (
                  <li key={segment.item.id}>
                    <Link href={itemHref(model, segment.item, day.date)}>
                      {itemName(segment.item, model.timezone)}
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No commitments.</p>
            )}
          </section>
        ))}
      </details>
      <WeekDetail model={model} item={selected} deadline={deadline} />
    </div>
  );
}
