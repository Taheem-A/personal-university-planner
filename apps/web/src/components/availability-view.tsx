import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addLocalDays } from "@university-planner/shared";
import type {
  AvailabilityItem,
  AvailabilityViewModel,
} from "../server/application/secondary-reads";
import { courseColor } from "./course-color";
import { EventEditor } from "./manual-editors";
import { RuleEditor } from "./constraint-editors";

const kinds: Record<AvailabilityItem["kind"], string> = {
  EVENT: "Fixed event",
  COURSE_MEETING: "Course meeting",
  AVAILABILITY: "Available",
  PROTECTED: "Protected time",
  SLEEP: "Sleep",
  WORK: "Work session",
};
const rows: { label: string; kinds: AvailabilityItem["kind"][] }[] = [
  { label: "Classes", kinds: ["COURSE_MEETING"] },
  { label: "Fixed events", kinds: ["EVENT"] },
  { label: "Available time", kinds: ["AVAILABILITY"] },
  { label: "Protected time", kinds: ["PROTECTED"] },
  { label: "Sleep", kinds: ["SLEEP"] },
  { label: "Planned work", kinds: ["WORK"] },
];
function dayName(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
function clock(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}
function AvailabilityEntry({ item, timezone }: { item: AvailabilityItem; timezone: string }) {
  return (
    <li
      className={`availability-entry availability-${item.kind.toLowerCase()} course-${courseColor(item.courseColorReference)}`}
    >
      <span className="availability-time">
        {clock(item.startAt, timezone)}–{clock(item.endAt, timezone)}
        {item.continuesFromPrevious ? " · continues from previous day" : ""}
        {item.continuesIntoNext ? " · continues next day" : ""}
      </span>
      <span className="availability-entry-body">
        <strong>{item.title}</strong>
        <small>
          {kinds[item.kind]}
          {item.courseCode ? ` · ${item.courseCode}` : ""} · {item.detail}
        </small>
      </span>
    </li>
  );
}
export function AvailabilityView({ model, edit }: { model: AvailabilityViewModel; edit?: string }) {
  const previous = addLocalDays(model.weekStart, -7);
  const next = addLocalDays(model.weekStart, 7);
  const parent = `/availability?date=${model.weekStart}`;
  const selectedEvent = edit?.startsWith("event:")
    ? model.manualEvents.find((event) => event.id === edit.slice(6))
    : undefined;
  const selectedAvailability = edit?.startsWith("availability:")
    ? model.availabilityRules.find((rule) => rule.id === edit.slice(13))
    : undefined;
  const selectedProtection = edit?.startsWith("protection:")
    ? model.protectedRules.find((rule) => rule.id === edit.slice(11))
    : undefined;
  return (
    <div className="route-content availability-content">
      <header className="page-header">
        <h1>Calendar &amp; Availability</h1>
        <p>Fixed time, available time, and protected boundaries.</p>
      </header>
      <div className="availability-toolbar">
        <div>
          <strong>
            {dayName(model.weekStart)} – {dayName(addLocalDays(model.weekEnd, -1))}
          </strong>
          <span>All times in {model.timezone}</span>
        </div>
        <nav aria-label="Availability week">
          <Link
            className="icon-button"
            href={`/availability?date=${previous}`}
            aria-label="Previous week"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </Link>
          <Link className="button button-secondary" href="/availability">
            Current week
          </Link>
          <Link className="icon-button" href={`/availability?date=${next}`} aria-label="Next week">
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </nav>
      </div>
      <div className="availability-legend" aria-label="Time types">
        <span>Fixed event or class</span>
        <span>Availability</span>
        <span>Hard protected or sleep</span>
        <span>Soft protected</span>
        <span>Planner/manual work</span>
      </div>
      <p className="availability-rule-summary">
        {model.ruleCounts.availability} availability rules · {model.ruleCounts.hardProtected} hard
        protected · {model.ruleCounts.softProtected} soft protected · {model.ruleCounts.sleep} sleep
        rules. A rule can occur more than once this week.
      </p>
      <section className="manual-structure" aria-labelledby="available-rules-title">
        <div className="manual-section-head">
          <h2 id="available-rules-title">Recurring availability</h2>
          <Link className="button button-primary" href={`${parent}&edit=availability-new`}>
            Add availability
          </Link>
        </div>
        <p className="manual-help">
          Work may be scheduled in these windows. The planner will not fill every minute.
        </p>
        {model.availabilityRules.length ? (
          <ul className="manual-term-list">
            {model.availabilityRules.map((rule) => (
              <li key={rule.id}>
                <span>
                  <strong>{rule.recurrenceRule}</strong> · {rule.startTimeLocal}–{rule.endTimeLocal}
                  {rule.spansNextDay ? " next day" : ""} · {Math.round(rule.capacityFactor * 100)}%
                  capacity
                </span>
                <Link
                  className="button button-secondary"
                  href={`${parent}&edit=availability:${encodeURIComponent(rule.id)}`}
                >
                  Edit availability
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="secondary-empty">No recurring availability recorded.</p>
        )}
      </section>
      <section className="manual-structure" aria-labelledby="protected-rules-title">
        <div className="manual-section-head">
          <h2 id="protected-rules-title">Protected time</h2>
          <Link className="button button-primary" href={`${parent}&edit=protection-new`}>
            Add protected time
          </Link>
        </div>
        {model.protectedRules.length ? (
          <ul className="manual-term-list">
            {model.protectedRules.map((rule) => (
              <li key={rule.id}>
                <span>
                  <strong>{rule.reason}</strong> · {rule.startTimeLocal}–{rule.endTimeLocal}
                  {rule.spansNextDay ? " next day" : ""} ·{" "}
                  {rule.isSleep ? "hard sleep" : rule.protectionLevel.toLowerCase()}
                </span>
                <Link
                  className="button button-secondary"
                  href={`${parent}&edit=protection:${encodeURIComponent(rule.id)}`}
                >
                  Edit protected time
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="secondary-empty">No recurring protected time recorded.</p>
        )}
      </section>
      {(edit === "availability-new" || selectedAvailability) && (
        <RuleEditor
          key={selectedAvailability?.id ?? "new-availability"}
          kind="availability"
          rule={selectedAvailability}
          timezone={model.timezone}
          returnTo={parent}
        />
      )}
      {(edit === "protection-new" || selectedProtection) && (
        <RuleEditor
          key={selectedProtection?.id ?? "new-protection"}
          kind="protection"
          rule={selectedProtection}
          timezone={model.timezone}
          returnTo={parent}
        />
      )}
      {edit?.startsWith("availability:") && !selectedAvailability && (
        <p className="secondary-empty" role="alert">
          Availability rule unavailable.
        </p>
      )}
      {edit?.startsWith("protection:") && !selectedProtection && (
        <p className="secondary-empty" role="alert">
          Protected-time rule unavailable.
        </p>
      )}
      <section className="manual-structure" aria-labelledby="commitments-title">
        <div className="manual-section-head">
          <h2 id="commitments-title">Fixed commitments this week</h2>
          <Link className="button button-primary" href={`${parent}&edit=event-new`}>
            Add fixed commitment
          </Link>
        </div>
        {model.manualEvents.length ? (
          <ul className="manual-term-list">
            {model.manualEvents.map((event) => (
              <li key={event.id}>
                <span>
                  <strong>{event.title}</strong> · {clock(event.startAt, model.timezone)}–
                  {clock(event.endAt, model.timezone)} · {event.constraintLevel.toLowerCase()}
                </span>
                <Link
                  className="button button-secondary"
                  href={`${parent}&edit=event:${encodeURIComponent(event.id)}`}
                >
                  Edit event
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="secondary-empty">No manually created fixed events in this week.</p>
        )}
        <p className="manual-help">
          Recurring classes follow your course timetable.{" "}
          <Link href="/courses">Manage course meetings</Link>.
        </p>
      </section>
      {(edit === "event-new" || selectedEvent) && (
        <EventEditor
          key={selectedEvent?.id ?? "new-event"}
          event={selectedEvent}
          model={model}
          returnTo={parent}
        />
      )}
      <div className="availability-matrix" aria-hidden="true">
        <table>
          <thead>
            <tr>
              <th scope="col">Time type</th>
              {model.days.map((day) => (
                <th scope="col" key={day.date}>
                  {dayName(day.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {model.days.map((day) => {
                  const items = day.items.filter((item) => row.kinds.includes(item.kind));
                  return (
                    <td key={day.date}>
                      {items.length ? (
                        <ul>
                          {items.map((item) => (
                            <AvailabilityEntry
                              key={item.id}
                              item={item}
                              timezone={model.timezone}
                            />
                          ))}
                        </ul>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="availability-agenda" aria-label="Week as an ordered agenda">
        {model.days.map((day) => (
          <section key={day.date} aria-labelledby={`availability-${day.date}`}>
            <h2 id={`availability-${day.date}`}>{dayName(day.date)}</h2>
            {day.items.length ? (
              <ul>
                {day.items.map((item) => (
                  <AvailabilityEntry key={item.id} item={item} timezone={model.timezone} />
                ))}
              </ul>
            ) : (
              <p className="availability-day-empty">No recorded items</p>
            )}
          </section>
        ))}
      </div>
      <section className="availability-readable">
        <p>
          The ordered day agenda gives the same local-time information without relying on the visual
          grid.
        </p>
        <p>
          Recurring rules keep their local wall-clock time through daylight-saving changes. Calendar
          provider sync comes later.
        </p>
      </section>
    </div>
  );
}
