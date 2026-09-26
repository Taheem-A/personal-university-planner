"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { instantToLocal } from "@university-planner/shared";
import { submitMutation } from "./mutation-client";
import {
  ArchiveConfirmation,
  CheckField,
  DaySelection,
  FormActions,
  FormField,
  FormStatus,
  InstantField,
  SelectField,
  ValidationSummary,
  deadlineInstant,
} from "./mutation-form";

type Saved = { id: string; version: number; planning: { status: string; planStatus?: string } };
export type TermEdit = {
  id: string;
  version: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};
type CourseEdit = {
  id: string;
  version: number;
  academicTermId: string;
  code: string;
  name: string;
  section: string | null;
  instructorName: string | null;
  creditValue: number | null;
  colorReference: string | null;
  defaultTaskEnergy: string | null;
  defaultTaskLocation: string[];
};
type CourseChoice = { id: string; code: string; name: string; termStatus: string };
export type MeetingEdit = {
  id: string;
  version: number;
  type: string;
  recurrenceRule: string;
  startTimeLocal: string;
  endTimeLocal: string;
  spansNextDay: boolean;
  timezone: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  location: string | null;
  attendanceRequired: boolean;
};
type EventEdit = {
  id: string;
  version: number;
  title: string;
  eventType: string;
  startAt: Date;
  endAt: Date;
  location: string | null;
  constraintLevel: string;
  courseId: string | null;
};
type EventModel = { timezone: string; courseChoices: { id: string; code: string; name: string }[] };
function isSaved(value: unknown): value is Saved {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as Saved).id === "string" &&
    Number.isInteger((value as Saved).version) &&
    typeof (value as Saved).planning?.status === "string",
  );
}
function savedMessage(action: string, planning: Saved["planning"]) {
  if (planning.status === "NOT_REQUESTED") return `${action} saved.`;
  if (planning.status === "SUCCEEDED")
    return `${action} saved. The planner refreshed the current plan; review any unmet work.`;
  return `${action} saved. The planner could not publish a new plan. Review the Planner panel and missing facts.`;
}
function useEditor(initialId?: string, initialVersion = 0) {
  const router = useRouter();
  const [id, setId] = useState(initialId);
  const [version, setVersion] = useState(initialVersion);
  const [busy, setBusy] = useState(false);
  const [archived, setArchived] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  async function commit(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    input: unknown,
    action: string,
  ) {
    if (busy) return false;
    setBusy(true);
    setFeedback(null);
    const result = await submitMutation(path, method, input, isSaved);
    setBusy(false);
    if (!result.ok) {
      setFeedback({ error: true, text: result.message });
      return false;
    }
    setId(result.data.id);
    setVersion(result.data.version);
    if (method === "DELETE") setArchived(true);
    setFeedback({ error: false, text: savedMessage(action, result.data.planning) });
    if (method !== "DELETE") router.refresh();
    return true;
  }
  return {
    id,
    version,
    busy,
    archived,
    feedback,
    commit,
    fail: (text: string) => setFeedback({ error: true, text }),
  };
}
function EditorShell({
  title,
  returnTo,
  children,
  feedback,
}: {
  title: string;
  returnTo: string;
  children: ReactNode;
  feedback: { error: boolean; text: string } | null;
}) {
  return (
    <section className="manual-editor" aria-label={title}>
      <div className="manual-editor-head">
        <h3>{title}</h3>
        <a className="button button-secondary" href={returnTo}>
          Close
        </a>
      </div>
      {children}
      {feedback && <FormStatus message={feedback.text} error={feedback.error} />}
    </section>
  );
}
function ArchiveAction({
  name,
  confirmed,
  setConfirmed,
  onArchive,
  busy,
}: {
  name: string;
  confirmed: boolean;
  setConfirmed: (value: boolean) => void;
  onArchive: () => void;
  busy: boolean;
}) {
  return (
    <div className="manual-archive">
      <ArchiveConfirmation name={name} confirmed={confirmed} onChange={setConfirmed} />
      <button
        className="button button-danger-quiet"
        type="button"
        disabled={!confirmed || busy}
        onClick={onArchive}
      >
        Archive {name}
      </button>
    </div>
  );
}

export function TermEditor({ term, returnTo }: { term?: TermEdit; returnTo: string }) {
  const editor = useEditor(term?.id, term?.version);
  const router = useRouter();
  const [name, setName] = useState(term?.name ?? "");
  const [startDate, setStartDate] = useState(term?.startDate ?? "");
  const [endDate, setEndDate] = useState(term?.endDate ?? "");
  const [status, setStatus] = useState(term?.status ?? "UPCOMING");
  const [confirmed, setConfirmed] = useState(false);
  const errors = [
    !name.trim() && "Enter a term name.",
    !startDate && "Enter a start date.",
    !endDate && "Enter an end date.",
  ].filter((item): item is string => Boolean(item));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (errors.length) {
      editor.fail(errors.join(" "));
      return;
    }
    const path = editor.id
      ? `/api/v1/manual/terms/${encodeURIComponent(editor.id)}`
      : "/api/v1/manual/terms";
    await editor.commit(
      path,
      editor.id ? "PATCH" : "POST",
      editor.id
        ? { expectedVersion: editor.version, name, startDate, endDate, status }
        : { name, startDate, endDate },
      "Term",
    );
  }
  return (
    <EditorShell
      title={term ? `Edit ${term.name}` : "Add academic term"}
      returnTo={returnTo}
      feedback={editor.feedback}
    >
      {editor.archived ? (
        <p>This term is archived and cannot be edited.</p>
      ) : (
        <>
          <form onSubmit={submit} noValidate>
            <ValidationSummary errors={editor.feedback?.error ? errors : []} />
            <FormField
              label="Term name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <FormField
              label="Start date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
            <FormField
              label="End date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
            />
            {editor.id && (
              <SelectField
                label="Term status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="UPCOMING">Upcoming</option>
                <option value="ACTIVE">Active</option>
              </SelectField>
            )}
            {!editor.id && (
              <p className="manual-help">
                Save the term, then set it Active when it is the semester you want to plan.
              </p>
            )}
            <FormActions saving={editor.busy} onCancel={() => router.replace(returnTo)} />
          </form>
          {editor.id && (
            <ArchiveAction
              name="term"
              confirmed={confirmed}
              setConfirmed={setConfirmed}
              busy={editor.busy}
              onArchive={() =>
                editor.commit(
                  `/api/v1/manual/terms/${encodeURIComponent(editor.id!)}`,
                  "DELETE",
                  { expectedVersion: editor.version },
                  "Term archive",
                )
              }
            />
          )}
        </>
      )}
    </EditorShell>
  );
}

export function CourseEditor({
  course,
  terms,
  timezone,
  returnTo,
}: {
  course?: CourseEdit;
  terms: TermEdit[];
  timezone: string;
  returnTo: string;
}) {
  const editor = useEditor(course?.id, course?.version);
  const router = useRouter();
  const eligible = terms.filter((term) => term.status !== "ARCHIVED");
  const [termId, setTermId] = useState(
    course?.academicTermId ??
      eligible.find((term) => term.status === "ACTIVE")?.id ??
      eligible[0]?.id ??
      "",
  );
  const [code, setCode] = useState(course?.code ?? "");
  const [name, setName] = useState(course?.name ?? "");
  const [section, setSection] = useState(course?.section ?? "");
  const [instructorName, setInstructorName] = useState(course?.instructorName ?? "");
  const [credit, setCredit] = useState(course?.creditValue?.toString() ?? "");
  const [color, setColor] = useState(course?.colorReference ?? "");
  const [energy, setEnergy] = useState(course?.defaultTaskEnergy ?? "");
  const [locations, setLocations] = useState(course?.defaultTaskLocation.join(", ") ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const errors = [
    !termId && "Choose a term.",
    !code.trim() && "Enter a course code.",
    !name.trim() && "Enter a course name.",
  ].filter((item): item is string => Boolean(item));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (errors.length) {
      editor.fail(errors.join(" "));
      return;
    }
    const fields = {
      code,
      name,
      section: section.trim() || null,
      instructorName: instructorName.trim() || null,
      creditValue: credit.trim() ? Number(credit) : null,
      colorReference: color || null,
      defaultTaskEnergy: energy || null,
      defaultTaskLocation: locations
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };
    await editor.commit(
      editor.id
        ? `/api/v1/manual/courses/${encodeURIComponent(editor.id)}`
        : "/api/v1/manual/courses",
      editor.id ? "PATCH" : "POST",
      editor.id
        ? { expectedVersion: editor.version, ...fields }
        : { academicTermId: termId, ...fields },
      "Course",
    );
  }
  return (
    <EditorShell
      title={course ? `Edit ${course.code}` : "Add course"}
      returnTo={returnTo}
      feedback={editor.feedback}
    >
      {editor.archived ? (
        <p>This course is archived.</p>
      ) : (
        <>
          <form onSubmit={submit} noValidate>
            <ValidationSummary errors={editor.feedback?.error ? errors : []} />
            <SelectField
              label="Academic term"
              value={termId}
              onChange={(event) => setTermId(event.target.value)}
              disabled={Boolean(editor.id)}
            >
              <option value="">Choose a term</option>
              {eligible.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name} · {term.status.toLowerCase()}
                </option>
              ))}
            </SelectField>
            <FormField
              label="Course code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              maxLength={32}
            />
            <FormField
              label="Course name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <FormField
              label="Section"
              value={section}
              onChange={(event) => setSection(event.target.value)}
            />
            <FormField
              label="Instructor"
              value={instructorName}
              onChange={(event) => setInstructorName(event.target.value)}
            />
            <FormField
              label="Credit value"
              type="number"
              min="0"
              step="any"
              value={credit}
              onChange={(event) => setCredit(event.target.value)}
            />
            <SelectField
              label="Course colour"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            >
              <option value="">Default</option>
              {color &&
                !["blue", "teal", "green", "amber", "orange", "rose", "violet", "slate"].includes(
                  color,
                ) && <option value={color}>{color}</option>}
              {["blue", "teal", "green", "amber", "orange", "rose", "violet", "slate"].map(
                (item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ),
              )}
            </SelectField>
            <SelectField
              label="Default task energy"
              value={energy}
              onChange={(event) => setEnergy(event.target.value)}
            >
              <option value="">Not set</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </SelectField>
            <FormField
              label="Default task locations"
              help="Comma-separated location tags, if useful."
              value={locations}
              onChange={(event) => setLocations(event.target.value)}
            />
            <p className="manual-help">
              Times for course meetings use {timezone} unless set otherwise in the timetable editor.
            </p>
            <FormActions saving={editor.busy} onCancel={() => router.replace(returnTo)} />
          </form>
          {editor.id && (
            <ArchiveAction
              name="course"
              confirmed={confirmed}
              setConfirmed={setConfirmed}
              busy={editor.busy}
              onArchive={() =>
                editor.commit(
                  `/api/v1/manual/courses/${encodeURIComponent(editor.id!)}`,
                  "DELETE",
                  { expectedVersion: editor.version },
                  "Course archive",
                )
              }
            />
          )}
        </>
      )}
    </EditorShell>
  );
}

export function MeetingEditor({
  meeting,
  courses,
  selectedCourseId,
  timezone,
  returnTo,
}: {
  meeting?: MeetingEdit;
  courses: CourseChoice[];
  selectedCourseId?: string;
  timezone: string;
  returnTo: string;
}) {
  const editor = useEditor(meeting?.id, meeting?.version);
  const router = useRouter();
  const [courseId, setCourseId] = useState(selectedCourseId ?? courses[0]?.id ?? "");
  const [meetingType, setMeetingType] = useState(meeting?.type ?? "LECTURE");
  const [recurrenceRule, setRecurrenceRule] = useState(
    meeting?.recurrenceRule ?? "FREQ=WEEKLY;BYDAY=MO",
  );
  const [startTimeLocal, setStartTimeLocal] = useState(meeting?.startTimeLocal ?? "09:00");
  const [endTimeLocal, setEndTimeLocal] = useState(meeting?.endTimeLocal ?? "10:00");
  const [spansNextDay, setSpansNextDay] = useState(meeting?.spansNextDay ?? false);
  const [zone, setZone] = useState(meeting?.timezone ?? timezone);
  const [effectiveFrom, setEffectiveFrom] = useState(meeting?.effectiveFrom ?? "");
  const [effectiveUntil, setEffectiveUntil] = useState(meeting?.effectiveUntil ?? "");
  const [location, setLocation] = useState(meeting?.location ?? "");
  const [attendanceRequired, setAttendanceRequired] = useState(meeting?.attendanceRequired ?? true);
  const [confirmed, setConfirmed] = useState(false);
  const weeklyDays =
    /^FREQ=WEEKLY;BYDAY=((?:MO|TU|WE|TH|FR|SA|SU)(?:,(?:MO|TU|WE|TH|FR|SA|SU))*)$/
      .exec(recurrenceRule)?.[1]
      .split(",") ?? [];
  const errors = [
    !courseId && "Choose a course.",
    !recurrenceRule.trim() && "Enter a recurrence rule.",
    !effectiveFrom && "Enter the first effective date.",
  ].filter((item): item is string => Boolean(item));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (errors.length) {
      editor.fail(errors.join(" "));
      return;
    }
    const fields = {
      meetingType,
      recurrenceRule,
      startTimeLocal,
      endTimeLocal,
      spansNextDay,
      timezone: zone,
      effectiveFrom,
      effectiveUntil: effectiveUntil || null,
      location: location.trim() || null,
      attendanceRequired,
    };
    await editor.commit(
      editor.id
        ? `/api/v1/manual/meetings/${encodeURIComponent(editor.id)}`
        : "/api/v1/manual/meetings",
      editor.id ? "PATCH" : "POST",
      editor.id ? { expectedVersion: editor.version, ...fields } : { courseId, ...fields },
      "Meeting",
    );
  }
  return (
    <EditorShell
      title={meeting ? "Edit course meeting" : "Add course meeting"}
      returnTo={returnTo}
      feedback={editor.feedback}
    >
      {editor.archived ? (
        <p>This meeting is archived.</p>
      ) : (
        <>
          <form onSubmit={submit} noValidate>
            <ValidationSummary errors={editor.feedback?.error ? errors : []} />
            <SelectField
              label="Course"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              disabled={Boolean(editor.id)}
            >
              <option value="">Choose a course</option>
              {courses
                .filter((course) => course.termStatus !== "ARCHIVED")
                .map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} · {course.name}
                  </option>
                ))}
            </SelectField>
            <SelectField
              label="Meeting type"
              value={meetingType}
              onChange={(event) => setMeetingType(event.target.value)}
            >
              {["LECTURE", "TUTORIAL", "PRACTICAL", "LAB", "SEMINAR", "OTHER"].map((kind) => (
                <option key={kind} value={kind}>
                  {kind.toLowerCase()}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Repeats"
              value={
                recurrenceRule === "FREQ=DAILY" ? "DAILY" : weeklyDays.length ? "WEEKLY" : "CUSTOM"
              }
              onChange={(event) =>
                setRecurrenceRule(
                  event.target.value === "DAILY"
                    ? "FREQ=DAILY"
                    : event.target.value === "WEEKLY"
                      ? "FREQ=WEEKLY;BYDAY=MO"
                      : recurrenceRule,
                )
              }
            >
              <option value="WEEKLY">Selected days each week</option>
              <option value="DAILY">Every day</option>
              <option value="CUSTOM">Advanced rule</option>
            </SelectField>
            {weeklyDays.length > 0 && (
              <DaySelection
                label="Meeting days"
                value={weeklyDays}
                onChange={(days) => setRecurrenceRule(`FREQ=WEEKLY;BYDAY=${days.join(",")}`)}
              />
            )}
            <FormField
              label="Recurrence rule"
              value={recurrenceRule}
              onChange={(event) => setRecurrenceRule(event.target.value)}
              help="Advanced RFC 5545 rule. The planner time service expands this saved wall-clock recurrence."
            />
            <FormField
              label="Local start time"
              type="text"
              inputMode="numeric"
              placeholder="09:00"
              value={startTimeLocal}
              onChange={(event) => setStartTimeLocal(event.target.value)}
              help="24-hour HH:MM"
            />
            <FormField
              label="Local end time"
              type="text"
              inputMode="numeric"
              placeholder="10:00"
              value={endTimeLocal}
              onChange={(event) => setEndTimeLocal(event.target.value)}
              help="24-hour HH:MM"
            />
            <CheckField
              label="Meeting ends on the next day"
              checked={spansNextDay}
              onChange={(event) => setSpansNextDay(event.target.checked)}
            />
            <FormField
              label="IANA time zone"
              value={zone}
              onChange={(event) => setZone(event.target.value)}
            />
            <FormField
              label="Effective from"
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
            <FormField
              label="Effective until"
              type="date"
              value={effectiveUntil}
              onChange={(event) => setEffectiveUntil(event.target.value)}
              help="Leave blank for no end date."
            />
            <FormField
              label="Location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
            <CheckField
              label="Attendance required"
              checked={attendanceRequired}
              onChange={(event) => setAttendanceRequired(event.target.checked)}
            />
            <FormActions saving={editor.busy} onCancel={() => router.replace(returnTo)} />
          </form>
          {editor.id && (
            <ArchiveAction
              name="meeting"
              confirmed={confirmed}
              setConfirmed={setConfirmed}
              busy={editor.busy}
              onArchive={() =>
                editor.commit(
                  `/api/v1/manual/meetings/${encodeURIComponent(editor.id!)}`,
                  "DELETE",
                  { expectedVersion: editor.version },
                  "Meeting archive",
                )
              }
            />
          )}
        </>
      )}
    </EditorShell>
  );
}

function localValue(instant: Date, timezone: string) {
  const local = instantToLocal(instant, timezone);
  return `${local.date}T${local.time.slice(0, 5)}`;
}
export function EventEditor({
  event,
  model,
  returnTo,
}: {
  event?: EventEdit;
  model: EventModel;
  returnTo: string;
}) {
  const editor = useEditor(event?.id, event?.version);
  const router = useRouter();
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventType, setEventType] = useState(event?.eventType ?? "APPOINTMENT");
  const [start, setStart] = useState(event ? localValue(event.startAt, model.timezone) : "");
  const [end, setEnd] = useState(event ? localValue(event.endAt, model.timezone) : "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [constraintLevel, setConstraintLevel] = useState(event?.constraintLevel ?? "HARD");
  const [courseId, setCourseId] = useState(event?.courseId ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const errors = [
    !title.trim() && "Enter a title.",
    !start && "Enter a start time.",
    !end && "Enter an end time.",
  ].filter((item): item is string => Boolean(item));
  async function submit(eventObject: FormEvent) {
    eventObject.preventDefault();
    if (errors.length) {
      editor.fail(errors.join(" "));
      return;
    }
    let startAt: string, endAt: string;
    try {
      startAt = deadlineInstant(start, model.timezone);
      endAt = deadlineInstant(end, model.timezone);
    } catch {
      editor.fail(
        "Choose an unambiguous local time. Daylight-saving gaps and repeated times cannot be saved without clarification.",
      );
      return;
    }
    const fields = {
      title,
      eventType,
      startAt,
      endAt,
      location: location.trim() || null,
      constraintLevel,
      courseId: courseId || null,
    };
    await editor.commit(
      editor.id
        ? `/api/v1/manual/events/${encodeURIComponent(editor.id)}`
        : "/api/v1/manual/events",
      editor.id ? "PATCH" : "POST",
      editor.id ? { expectedVersion: editor.version, ...fields } : fields,
      "Fixed event",
    );
  }
  return (
    <EditorShell
      title={event ? "Edit fixed commitment" : "Add fixed commitment"}
      returnTo={returnTo}
      feedback={editor.feedback}
    >
      {editor.archived ? (
        <p>This event is archived.</p>
      ) : (
        <>
          <form onSubmit={submit} noValidate>
            <ValidationSummary errors={editor.feedback?.error ? errors : []} />
            <FormField
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <FormField
              label="Event type"
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
              help="For example, appointment or personal commitment."
            />
            <InstantField
              label="Start"
              timezone={model.timezone}
              meaning="event"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
            <InstantField
              label="End"
              timezone={model.timezone}
              meaning="event"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
            <FormField
              label="Location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
            <SelectField
              label="Constraint level"
              value={constraintLevel}
              onChange={(event) => setConstraintLevel(event.target.value)}
            >
              <option value="HARD">Hard commitment</option>
              <option value="SOFT">Soft commitment</option>
              <option value="INFORMATIONAL">Informational only</option>
            </SelectField>
            <SelectField
              label="Course association"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              <option value="">None</option>
              {model.courseChoices.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.name}
                </option>
              ))}
            </SelectField>
            <FormActions saving={editor.busy} onCancel={() => router.replace(returnTo)} />
          </form>
          {editor.id && (
            <ArchiveAction
              name="event"
              confirmed={confirmed}
              setConfirmed={setConfirmed}
              busy={editor.busy}
              onArchive={() =>
                editor.commit(
                  `/api/v1/manual/events/${encodeURIComponent(editor.id!)}`,
                  "DELETE",
                  { expectedVersion: editor.version },
                  "Fixed event archive",
                )
              }
            />
          )}
        </>
      )}
    </EditorShell>
  );
}
