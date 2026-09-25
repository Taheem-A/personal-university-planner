import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addLocalDays } from "@university-planner/shared";
import type {
  AvailabilityItem,
  AvailabilityViewModel,
} from "../server/application/secondary-reads";
import { courseColor } from "./course-color";

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
export function AvailabilityView({ model }: { model: AvailabilityViewModel }) {
  const previous = addLocalDays(model.weekStart, -7);
  const next = addLocalDays(model.weekStart, 7);
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
          Creating, changing, and removing availability or protected-time rules is part of the
          manual-management milestone. Calendar provider sync comes later.
        </p>
      </section>
    </div>
  );
}
