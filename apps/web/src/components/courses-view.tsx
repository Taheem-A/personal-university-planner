import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CoursesViewModel } from "../server/application/secondary-reads";
import { CourseIdentity, StatusIndicator } from "./planner-primitives";
import { courseColor } from "./course-color";
import { CourseClose } from "./course-close";

function work(minutes: number | null) {
  if (minutes === null) return "Remaining work unknown";
  if (minutes === 0) return "No work remaining";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m remaining`;
}
function due(date: Date | null, timezone: string) {
  return date
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: timezone,
      }).format(date)
    : "Due date unknown";
}
function time(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}
export function CoursesView({ model }: { model: CoursesViewModel }) {
  const detail = model.selectedCourse;
  return (
    <div
      className={`route-content courses-content${model.explicitSelection ? " course-open" : ""}`}
    >
      <header className="page-header">
        <h1 id="courses-title" tabIndex={-1}>
          Courses
        </h1>
        <p>{model.activeTermName ?? "No active term"}</p>
      </header>
      {model.courses.length ? (
        <div className="courses-layout">
          <nav className="course-list" aria-label="Courses">
            {model.courses.map((item) => (
              <Link
                key={item.id}
                href={`/courses?course=${encodeURIComponent(item.id)}`}
                data-course-id={item.id}
                className={detail?.id === item.id ? "active" : ""}
                aria-current={
                  model.explicitSelection && detail?.id === item.id ? "page" : undefined
                }
              >
                <CourseIdentity code={item.code} color={courseColor(item.colorReference)} />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.termName} · {item.openAssessments} open assessments
                  </small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <section className="course-detail" aria-labelledby="course-detail-title">
            {detail ? (
              <>
                <div className="course-detail-header">
                  <div>
                    <CourseIdentity code={detail.code} color={courseColor(detail.colorReference)} />
                    <h2 id="course-detail-title">{detail.name}</h2>
                    <p>
                      {detail.termName} · {detail.termStart}–{detail.termEnd}
                    </p>
                  </div>
                  {model.explicitSelection && <CourseClose id={detail.id} />}
                </div>
                <div className="course-summary-line">
                  <span>{work(detail.remainingMinutes)}</span>
                  {detail.atRiskTasks > 0 && (
                    <span className="course-risk">
                      {detail.atRiskTasks} {detail.atRiskTasks === 1 ? "task" : "tasks"} at risk in
                      the last successful plan
                    </span>
                  )}
                  {detail.section && <span>Section {detail.section}</span>}
                  {detail.instructorName && <span>{detail.instructorName}</span>}
                  {detail.creditValue !== null && <span>{detail.creditValue} credits</span>}
                </div>
                <section className="course-section">
                  <h3>Assessments</h3>
                  {detail.assessments.length ? (
                    <ul className="course-record-list">
                      {detail.assessments.map((assessment) => (
                        <li key={assessment.id}>
                          <div>
                            <strong>{assessment.title}</strong>
                            <small>
                              {assessment.type} · {due(assessment.dueAt, model.timezone)}
                            </small>
                          </div>
                          <div>
                            {assessment.gradeWeight === null
                              ? "Weight unknown"
                              : `${assessment.gradeWeight}%`}
                          </div>
                          <StatusIndicator
                            tone={
                              assessment.submissionStatus === "SUBMITTED" ||
                              assessment.submissionStatus === "GRADED"
                                ? "success"
                                : "info"
                            }
                          >
                            {assessment.submissionStatus.replaceAll("_", " ").toLowerCase()}
                          </StatusIndicator>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="secondary-empty">No assessments recorded for this course.</p>
                  )}
                </section>
                <section className="course-section">
                  <h3>Current work</h3>
                  {detail.tasks.length ? (
                    <ul className="course-record-list">
                      {detail.tasks.map((task) => (
                        <li key={task.id}>
                          <div>
                            <strong>{task.title}</strong>
                            <small>{due(task.dueAt, model.timezone)}</small>
                          </div>
                          <span>{work(task.remainingMinutes)}</span>
                          <span>{task.status.replaceAll("_", " ").toLowerCase()}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="secondary-empty">No active tasks recorded for this course.</p>
                  )}
                </section>
                <section className="course-section">
                  <h3>Timetable</h3>
                  {detail.meetings.length ? (
                    <ul className="course-record-list">
                      {detail.meetings.map((meeting) => (
                        <li key={meeting.id}>
                          <div>
                            <strong>{meeting.type.replaceAll("_", " ").toLowerCase()}</strong>
                            <small>
                              {meeting.recurrenceRule} · {meeting.startTimeLocal}–
                              {meeting.endTimeLocal} ({meeting.timezone})
                            </small>
                          </div>
                          <span>{meeting.location ?? "Location unknown"}</span>
                          <span>{meeting.attendanceRequired ? "Required" : "Optional"}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="secondary-empty">No recurring meetings recorded.</p>
                  )}
                </section>
                <section className="course-section">
                  <h3>Recurring work</h3>
                  {detail.recurringWork.length ? (
                    <ul className="course-record-list">
                      {detail.recurringWork.map((rule) => (
                        <li key={rule.id}>
                          <div>
                            <strong>{rule.title}</strong>
                            <small>{rule.recurrenceRule}</small>
                          </div>
                          <span>{rule.planningMode.toLowerCase()}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="secondary-empty">No recurring work rules recorded.</p>
                  )}
                </section>
                <section className="course-section">
                  <h3>Planned sessions</h3>
                  {detail.sessions.length ? (
                    <ul className="course-record-list">
                      {detail.sessions.map((session) => (
                        <li key={session.id}>
                          <div>
                            <strong>{session.taskTitle}</strong>
                            <small>
                              {time(session.startAt, model.timezone)} ·{" "}
                              {time(session.endAt, model.timezone)}
                            </small>
                          </div>
                          <span>{session.generatedBy === "PLANNER" ? "Planner" : "Manual"}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="secondary-empty">
                      No active sessions in the current read horizon.
                    </p>
                  )}
                </section>
                <p className="course-deferred">
                  Adding and editing courses, assessments, and rules comes in the manual-management
                  milestone.
                </p>
              </>
            ) : (
              <>
                <h2 id="course-detail-title">Course unavailable</h2>
                <p>The course link is unavailable or you do not have access.</p>
                <CourseClose id="" />
              </>
            )}
          </section>
        </div>
      ) : (
        <p className="secondary-empty">
          No courses recorded yet. Course setup will be available in a later milestone.
        </p>
      )}
    </div>
  );
}
