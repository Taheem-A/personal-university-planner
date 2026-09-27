"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { instantToLocal } from "@university-planner/shared";
import {
  deadlineInstant,
  editedInstant,
  FormField,
  FormStatus,
  InstantField,
  SelectField,
  ValidationSummary,
} from "./mutation-form";
import { submitMutation } from "./mutation-client";

type Item = {
  id: string;
  version: number;
  rawText: string;
  status: "ACTIVE" | "PROCESSED" | "DISMISSED";
  proposedEntityType: string | null;
  proposedPayload: {
    title: string;
    courseId: string | null;
    durationMinutes?: number | null;
    dueAt?: string | null;
    startAt?: string | null;
    endAt?: string | null;
  } | null;
  resolvedEntityType: string | null;
  resolvedEntityId: string | null;
  planningStatus: "SUCCEEDED" | "FAILED" | "RUNNING" | "INFEASIBLE" | null;
};
type CourseChoice = { id: string; code: string; name: string };
type Kind = "TASK" | "ASSESSMENT" | "CALENDAR_EVENT";
function localInput(value: string | null | undefined, timezone: string) {
  if (!value) return "";
  const local = instantToLocal(new Date(value), timezone);
  return `${local.date}T${local.time.slice(0, 5)}`;
}
function saved(value: unknown): value is {
  id: string;
  version: number;
  status: string;
  entityId?: string;
  entityType?: string;
  planning?: { status: string; planStatus?: string };
} {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { status?: unknown }).status === "string",
  );
}
function kindOf(value: string | null): Kind {
  return value === "ASSESSMENT" || value === "CALENDAR_EVENT" ? value : "TASK";
}
function canonicalHref(type: string | null, id: string | null) {
  if (!id) return null;
  if (type === "TASK") return `/upcoming?edit=task:${encodeURIComponent(id)}`;
  if (type === "ASSESSMENT") return `/upcoming?assessment=${encodeURIComponent(id)}`;
  if (type === "CALENDAR_EVENT") return `/availability?edit=event:${encodeURIComponent(id)}`;
  return null;
}

export function InboxResolution({
  item,
  timezone,
  courses,
}: {
  item: Item;
  timezone: string;
  courses: CourseChoice[];
}) {
  const router = useRouter();
  const proposal = item.proposedPayload;
  const [kind, setKind] = useState<Kind>(kindOf(item.proposedEntityType));
  const [title, setTitle] = useState(proposal?.title ?? "");
  const [courseId, setCourseId] = useState(proposal?.courseId ?? "");
  const [duration, setDuration] = useState(proposal?.durationMinutes?.toString() ?? "");
  const [due, setDue] = useState(localInput(proposal?.dueAt, timezone));
  const [available, setAvailable] = useState("");
  const [session, setSession] = useState("");
  const [assessmentType, setAssessmentType] = useState("Assignment");
  const [start, setStart] = useState(localInput(proposal?.startAt, timezone));
  const [end, setEnd] = useState(localInput(proposal?.endAt, timezone));
  const [eventType, setEventType] = useState("APPOINTMENT");
  const [constraint, setConstraint] = useState("HARD");
  const [busy, setBusy] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [completed, setCompleted] = useState<{
    entityId?: string;
    entityType?: string;
    planning?: { status: string; planStatus?: string };
  } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const errors = [
    !title.trim() && "Enter a title for the canonical object.",
    kind === "ASSESSMENT" && !courseId && "Choose the assessment's course.",
    kind === "CALENDAR_EVENT" &&
      (!start || !end) &&
      "Enter exact start and end times for the event.",
  ].filter((value): value is string => Boolean(value));
  const base = `/api/v1/inbox/${encodeURIComponent(item.id)}`;
  async function suggest() {
    setBusy(true);
    const result = await submitMutation(
      `${base}/suggest`,
      "POST",
      { expectedVersion: item.version },
      saved,
    );
    setBusy(false);
    setFeedback(
      result.ok
        ? {
            error: false,
            text: "A limited proposal was saved. Review every field before resolving.",
          }
        : {
            error: true,
            text:
              result.code === "VALIDATION_ERROR"
                ? "No safe interpretation matched. Review the original text and enter the facts yourself."
                : result.message,
          },
    );
    router.refresh();
  }
  async function dismiss() {
    if (!confirmDismiss) {
      setConfirmDismiss(true);
      return;
    }
    setBusy(true);
    const result = await submitMutation(
      `${base}/dismiss`,
      "POST",
      { expectedVersion: item.version },
      saved,
    );
    setBusy(false);
    if (!result.ok) {
      setFeedback({ error: true, text: result.message });
      router.refresh();
      return;
    }
    router.push(`/inbox?status=DISMISSED&item=${encodeURIComponent(item.id)}`);
    router.refresh();
  }
  async function resolve(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (errors.length) return;
    let dueAt: string | null, availableFrom: string | null, startAt: string, endAt: string;
    try {
      dueAt = due
        ? editedInstant(due, timezone, proposal?.dueAt ? new Date(proposal.dueAt) : null)
        : null;
      availableFrom = available ? deadlineInstant(available, timezone) : null;
      startAt = start
        ? editedInstant(start, timezone, proposal?.startAt ? new Date(proposal.startAt) : null)
        : "";
      endAt = end
        ? editedInstant(end, timezone, proposal?.endAt ? new Date(proposal.endAt) : null)
        : "";
    } catch {
      setFeedback({
        error: true,
        text: "Choose an unambiguous local date and time. Daylight-saving gaps and repeated times need correction.",
      });
      return;
    }
    const minutes = duration ? Number(duration) : null;
    const sessionMinutes = session ? Number(session) : null;
    const payload =
      kind === "TASK"
        ? {
            title,
            courseId: courseId || null,
            status: "READY",
            dueAt,
            availableFrom,
            originalEstimatedMinutes: minutes,
            currentEstimatedMinutes: minutes,
            remainingMinutes: minutes,
            minimumSessionMinutes: sessionMinutes,
            preferredSessionMinutes: sessionMinutes,
            maximumSessionMinutes: sessionMinutes,
          }
        : kind === "ASSESSMENT"
          ? { title, courseId, assessmentType, dueAt }
          : {
              title,
              courseId: courseId || null,
              eventType,
              startAt,
              endAt,
              constraintLevel: constraint,
            };
    setBusy(true);
    const result = await submitMutation(
      `${base}/resolve`,
      "POST",
      { expectedVersion: item.version, entityType: kind, payload },
      saved,
    );
    setBusy(false);
    if (!result.ok) {
      setFeedback({ error: true, text: result.message });
      router.refresh();
      return;
    }
    setCompleted(result.data);
    setFeedback(
      result.data.planning?.status === "FAILED" || result.data.planning?.status === "INFEASIBLE"
        ? {
            error: true,
            text: "The canonical object was saved and Inbox was processed, but planning needs attention. Review the saved object and planner status.",
          }
        : { error: false, text: "The canonical object was saved and Inbox was processed." },
    );
  }
  const resolvedType = completed?.entityType ?? item.resolvedEntityType;
  const href = canonicalHref(resolvedType ?? null, completed?.entityId ?? item.resolvedEntityId);
  return (
    <section className="inbox-resolution" aria-labelledby="inbox-review-title">
      <h2 id="inbox-review-title">Review capture</h2>
      <div className="onboarding-evidence">
        <strong>Captured text · preserved</strong>
        <p>{item.rawText}</p>
      </div>
      <div className="onboarding-evidence">
        <strong>Proposed interpretation · unconfirmed</strong>
        <p>
          {proposal
            ? `${item.proposedEntityType?.replaceAll("_", " ")}: ${proposal.title}`
            : "No proposal stored. You can still enter the facts below."}
        </p>
      </div>
      {item.status !== "ACTIVE" || completed ? (
        <div className="onboarding-evidence">
          <strong>Canonical saved object</strong>
          <p>
            {href ? (
              <Link href={href}>Open saved {resolvedType?.toLowerCase().replaceAll("_", " ")}</Link>
            ) : item.status === "DISMISSED" ? (
              "Dismissed; original capture retained."
            ) : (
              "Processed record retained."
            )}
          </p>
          {item.planningStatus && (
            <p>
              Latest recorded planner run for this object: {item.planningStatus.toLowerCase()}.{" "}
              <Link href="/today">Review plan</Link>
            </p>
          )}
          {completed && (
            <p>
              <Link href={`/inbox?status=PROCESSED&item=${encodeURIComponent(item.id)}`}>
                View processed capture
              </Link>
            </p>
          )}
        </div>
      ) : (
        <>
          {!proposal && (
            <button
              className="button button-secondary"
              type="button"
              onClick={suggest}
              disabled={busy}
            >
              Suggest limited interpretation
            </button>
          )}
          <form onSubmit={resolve} noValidate>
            <h3>Canonical object · review and save</h3>
            <p className="manual-help">
              A proposal is not saved academic truth. Unknown deadlines may stay blank. A task
              without enough planning facts may be saved but cannot yet be scheduled.
            </p>
            <ValidationSummary errors={showErrors ? errors : []} />
            <SelectField
              label="Create as"
              value={kind}
              onChange={(event) => setKind(event.target.value as Kind)}
            >
              <option value="TASK">Task · schedulable work</option>
              <option value="ASSESSMENT">Assessment · academic obligation</option>
              <option value="CALENDAR_EVENT">Fixed event · commitment</option>
            </SelectField>
            <FormField
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <SelectField
              label={kind === "ASSESSMENT" ? "Course · required" : "Course · optional"}
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              <option value="">{kind === "ASSESSMENT" ? "Choose a course" : "No course"}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.name}
                </option>
              ))}
            </SelectField>
            {kind === "TASK" && (
              <>
                <FormField
                  label="Estimate · minutes, if known"
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
                <InstantField
                  label="Available from · local time"
                  timezone={timezone}
                  value={available}
                  onChange={(event) => setAvailable(event.target.value)}
                />
                <InstantField
                  label="True due date · if known"
                  timezone={timezone}
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                />
                <FormField
                  label="Session length · minutes, if known"
                  type="number"
                  min={1}
                  value={session}
                  onChange={(event) => setSession(event.target.value)}
                />
              </>
            )}
            {kind === "ASSESSMENT" && (
              <>
                <FormField
                  label="Assessment type"
                  value={assessmentType}
                  onChange={(event) => setAssessmentType(event.target.value)}
                />
                <InstantField
                  label="True due date · if known"
                  timezone={timezone}
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                />
              </>
            )}
            {kind === "CALENDAR_EVENT" && (
              <>
                <FormField
                  label="Event type"
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value)}
                />
                <InstantField
                  label="Start · local time"
                  timezone={timezone}
                  meaning="event"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
                <InstantField
                  label="End · local time"
                  timezone={timezone}
                  meaning="event"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
                <SelectField
                  label="Constraint"
                  value={constraint}
                  onChange={(event) => setConstraint(event.target.value)}
                >
                  <option value="HARD">Hard commitment</option>
                  <option value="SOFT">Soft commitment</option>
                  <option value="INFORMATIONAL">Informational only</option>
                </SelectField>
              </>
            )}
            <div className="manual-top-actions">
              <button className="button button-primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save canonical object and process"}
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={dismiss}
                disabled={busy}
              >
                {confirmDismiss ? "Confirm dismissal" : "Dismiss capture"}
              </button>
              <Link className="button button-secondary" href="/inbox">
                Close review
              </Link>
            </div>
          </form>
        </>
      )}
      {feedback && <FormStatus message={feedback.text} error={feedback.error} />}
    </section>
  );
}
