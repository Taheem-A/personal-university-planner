"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArchiveAction, EditorShell, localValue, useEditor } from "./manual-editors";
import {
  CheckField,
  FormActions,
  FormField,
  InstantField,
  SelectField,
  ValidationSummary,
  editedInstant,
} from "./mutation-form";

type CourseChoice = { id: string; code: string; name: string };
type AssessmentChoice = { id: string; courseId: string; title: string };
type TaskChoice = {
  id: string;
  title: string;
  courseId: string | null;
  assessmentId: string | null;
  parentTaskId: string | null;
};
type AssessmentEdit = {
  id: string;
  version: number;
  courseId: string;
  title: string;
  type: string;
  releaseAt: Date | null;
  dueAt: Date | null;
  preferredCompletionAt: Date | null;
  gradeWeight: number | null;
  notes: string | null;
  instructionsUrl: string | null;
  submissionUrl: string | null;
};
type TaskEdit = {
  id: string;
  version: number;
  title: string;
  description: string | null;
  courseId: string | null;
  assessmentId: string | null;
  parentTaskId: string | null;
  status: string;
  dueAt: Date | null;
  preferredCompletionAt: Date | null;
  availableFrom: Date | null;
  originalEstimatedMinutes: number | null;
  currentEstimatedMinutes: number | null;
  remainingMinutes: number | null;
  energyRequirement: string | null;
  locationRequirements: string[];
  minimumSessionMinutes: number | null;
  preferredSessionMinutes: number | null;
  maximumSessionMinutes: number | null;
  splittable: boolean;
  interruptible: boolean;
  planningMode: string;
  priorityOverride: number | null;
};
const inputTime = (date: Date | null, zone: string) => (date ? localValue(date, zone) : "");
function toInstant(value: string, zone: string, original: Date | null = null) {
  if (!value) return null;
  return editedInstant(value, zone, original);
}
function optionalNumber(value: string) {
  return value.trim() ? Number(value) : null;
}
function timeError() {
  return "Choose an unambiguous local time. Daylight-saving gaps and repeated times require clarification.";
}

export function AssessmentEditor({
  assessment,
  courses,
  selectedCourseId,
  timezone,
  returnTo,
  taskReturnTo,
}: {
  assessment?: AssessmentEdit;
  courses: CourseChoice[];
  selectedCourseId?: string;
  timezone: string;
  returnTo: string;
  taskReturnTo: string;
}) {
  const editor = useEditor(assessment?.id, assessment?.version);
  const router = useRouter();
  const [courseId, setCourseId] = useState(
    assessment?.courseId ?? selectedCourseId ?? courses[0]?.id ?? "",
  );
  const [title, setTitle] = useState(assessment?.title ?? "");
  const [type, setType] = useState(assessment?.type ?? "Assignment");
  const [release, setRelease] = useState(inputTime(assessment?.releaseAt ?? null, timezone));
  const [due, setDue] = useState(inputTime(assessment?.dueAt ?? null, timezone));
  const [preferred, setPreferred] = useState(
    inputTime(assessment?.preferredCompletionAt ?? null, timezone),
  );
  const [weight, setWeight] = useState(assessment?.gradeWeight?.toString() ?? "");
  const [notes, setNotes] = useState(assessment?.notes ?? "");
  const [instructions, setInstructions] = useState(assessment?.instructionsUrl ?? "");
  const [submission, setSubmission] = useState(assessment?.submissionUrl ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const errors = [
    !courseId && "Choose a course.",
    !title.trim() && "Enter an assessment title.",
    !type.trim() && "Enter an assessment type.",
  ].filter((item): item is string => Boolean(item));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (errors.length) {
      editor.fail(errors.join(" "));
      return;
    }
    let releaseAt: string | null, dueAt: string | null, preferredCompletionAt: string | null;
    try {
      releaseAt = toInstant(release, timezone, assessment?.releaseAt);
      dueAt = toInstant(due, timezone, assessment?.dueAt);
      preferredCompletionAt = toInstant(preferred, timezone, assessment?.preferredCompletionAt);
    } catch {
      editor.fail(timeError());
      return;
    }
    const fields = {
      title,
      assessmentType: type,
      releaseAt,
      dueAt,
      preferredCompletionAt,
      gradeWeight: optionalNumber(weight),
      notes: notes.trim() || null,
      instructionsUrl: instructions.trim() || null,
      submissionUrl: submission.trim() || null,
    };
    await editor.commit(
      editor.id
        ? `/api/v1/manual/assessments/${encodeURIComponent(editor.id)}`
        : "/api/v1/manual/assessments",
      editor.id ? "PATCH" : "POST",
      editor.id ? { expectedVersion: editor.version, ...fields } : { courseId, ...fields },
      "Assessment",
    );
  }
  return (
    <EditorShell
      title={assessment ? `Edit ${assessment.title}` : "Add assessment"}
      returnTo={returnTo}
      feedback={editor.feedback}
    >
      {editor.archived ? (
        <p>This assessment is archived.</p>
      ) : (
        <>
          <p className="manual-help">
            An assessment records the obligation. Add a work task after saving to give the planner
            time to schedule.
          </p>
          <form onSubmit={submit} noValidate>
            <ValidationSummary errors={editor.feedback?.error ? errors : []} />
            <SelectField
              label="Course"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              disabled={Boolean(editor.id)}
            >
              <option value="">Choose a course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.name}
                </option>
              ))}
            </SelectField>
            <FormField
              label="Assessment title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <FormField
              label="Assessment type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              required
              help="For example, assignment, exam, lab report, or project."
            />
            <InstantField
              label="True due date and time"
              timezone={timezone}
              value={due}
              onChange={(event) => setDue(event.target.value)}
              help="Leave blank if the deadline is unknown. A preferred target is separate."
            />
            <details className="manual-advanced">
              <summary>More assessment details</summary>
              <InstantField
                label="Release date and time"
                timezone={timezone}
                value={release}
                onChange={(event) => setRelease(event.target.value)}
              />
              <InstantField
                label="Preferred completion target"
                timezone={timezone}
                value={preferred}
                onChange={(event) => setPreferred(event.target.value)}
              />
              <FormField
                label="Grade weight (%)"
                type="number"
                min="0"
                max="100"
                step="any"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
              <div className="mutation-field">
                <label htmlFor="assessment-notes">Notes</label>
                <textarea
                  id="assessment-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <FormField
                label="Instructions link"
                type="text"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
              />
              <FormField
                label="Submission link"
                type="text"
                value={submission}
                onChange={(event) => setSubmission(event.target.value)}
              />
            </details>
            <FormActions saving={editor.busy} onCancel={() => router.replace(returnTo)} />
          </form>
          {editor.id && (
            <p className="manual-next-action">
              <Link
                className="button button-secondary"
                href={`${taskReturnTo}&assessment=${encodeURIComponent(editor.id)}&edit=task-new`}
              >
                Add work task for this assessment
              </Link>
            </p>
          )}
          {editor.id && (
            <ArchiveAction
              name="assessment"
              confirmed={confirmed}
              setConfirmed={setConfirmed}
              busy={editor.busy}
              onArchive={() =>
                editor.commit(
                  `/api/v1/manual/assessments/${encodeURIComponent(editor.id!)}`,
                  "DELETE",
                  { expectedVersion: editor.version },
                  "Assessment archive",
                )
              }
            />
          )}
        </>
      )}
    </EditorShell>
  );
}

export function TaskEditor({
  task,
  courses,
  assessments,
  tasks,
  selectedAssessmentId,
  selectedParentId,
  selectedCourseId,
  timezone,
  returnTo,
}: {
  task?: TaskEdit;
  courses: CourseChoice[];
  assessments: AssessmentChoice[];
  tasks: TaskChoice[];
  selectedAssessmentId?: string;
  selectedParentId?: string;
  selectedCourseId?: string;
  timezone: string;
  returnTo: string;
}) {
  const editor = useEditor(task?.id, task?.version);
  const router = useRouter();
  const parent = tasks.find((item) => item.id === selectedParentId);
  const initialAssessment = task
    ? (task.assessmentId ?? "")
    : (parent?.assessmentId ?? selectedAssessmentId ?? "");
  const initialCourse = task
    ? (task.courseId ?? "")
    : (parent?.courseId ??
      assessments.find((item) => item.id === initialAssessment)?.courseId ??
      selectedCourseId ??
      "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [courseId, setCourseId] = useState(initialCourse);
  const [assessmentId, setAssessmentId] = useState(initialAssessment);
  const [parentId, setParentId] = useState(
    task ? (task.parentTaskId ?? "") : (selectedParentId ?? ""),
  );
  const [estimate, setEstimate] = useState(task?.currentEstimatedMinutes?.toString() ?? "");
  const [remaining, setRemaining] = useState(task?.remainingMinutes?.toString() ?? "");
  const [due, setDue] = useState(inputTime(task?.dueAt ?? null, timezone));
  const [preferred, setPreferred] = useState(
    inputTime(task?.preferredCompletionAt ?? null, timezone),
  );
  const [available, setAvailable] = useState(inputTime(task?.availableFrom ?? null, timezone));
  const [status, setStatus] = useState(task?.status ?? "READY");
  const [energy, setEnergy] = useState(task?.energyRequirement ?? "");
  const [locations, setLocations] = useState(task?.locationRequirements.join(", ") ?? "");
  const [minimum, setMinimum] = useState(task?.minimumSessionMinutes?.toString() ?? "");
  const [preferredLength, setPreferredLength] = useState(
    task?.preferredSessionMinutes?.toString() ?? "",
  );
  const [maximum, setMaximum] = useState(task?.maximumSessionMinutes?.toString() ?? "");
  const [splittable, setSplittable] = useState(task?.splittable ?? true);
  const [interruptible, setInterruptible] = useState(task?.interruptible ?? true);
  const [planningMode, setPlanningMode] = useState(task?.planningMode ?? "AUTO");
  const [confirmed, setConfirmed] = useState(false);
  const errors = [!title.trim() && "Enter a task title."].filter((item): item is string =>
    Boolean(item),
  );
  function chooseAssessment(id: string) {
    setAssessmentId(id);
    if (id) setCourseId(assessments.find((item) => item.id === id)?.courseId ?? "");
  }
  function chooseParent(id: string) {
    setParentId(id);
    const choice = tasks.find((item) => item.id === id);
    if (choice) {
      setAssessmentId(choice.assessmentId ?? "");
      setCourseId(choice.courseId ?? "");
    }
  }
  function changeEstimate(value: string) {
    if (remaining === estimate) setRemaining(value);
    setEstimate(value);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (errors.length) {
      editor.fail(errors.join(" "));
      return;
    }
    let dueAt: string | null, preferredCompletionAt: string | null, availableFrom: string | null;
    try {
      dueAt = toInstant(due, timezone, task?.dueAt);
      preferredCompletionAt = toInstant(preferred, timezone, task?.preferredCompletionAt);
      availableFrom = toInstant(available, timezone, task?.availableFrom);
    } catch {
      editor.fail(timeError());
      return;
    }
    const fields = {
      title,
      description: description.trim() || null,
      courseId: courseId || null,
      assessmentId: assessmentId || null,
      parentTaskId: parentId || null,
      status,
      dueAt,
      preferredCompletionAt,
      availableFrom,
      energyRequirement: energy || null,
      locationRequirements: locations
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      minimumSessionMinutes: optionalNumber(minimum) ?? optionalNumber(preferredLength),
      preferredSessionMinutes: optionalNumber(preferredLength),
      maximumSessionMinutes: optionalNumber(maximum) ?? optionalNumber(preferredLength),
      splittable,
      interruptible,
      planningMode,
    };
    const currentEstimatedMinutes = optionalNumber(estimate),
      remainingMinutes = optionalNumber(remaining);
    await editor.commit(
      editor.id ? `/api/v1/manual/tasks/${encodeURIComponent(editor.id)}` : "/api/v1/manual/tasks",
      editor.id ? "PATCH" : "POST",
      editor.id
        ? {
            expectedVersion: editor.version,
            ...fields,
            ...(task?.originalEstimatedMinutes === null && currentEstimatedMinutes !== null
              ? { originalEstimatedMinutes: currentEstimatedMinutes }
              : {}),
            currentEstimatedMinutes,
            remainingMinutes,
          }
        : {
            ...fields,
            originalEstimatedMinutes: currentEstimatedMinutes,
            currentEstimatedMinutes,
            remainingMinutes: remainingMinutes ?? currentEstimatedMinutes,
          },
      "Task",
    );
  }
  return (
    <EditorShell
      title={task ? `Edit ${task.title}` : parentId ? "Add subtask" : "Add work task"}
      returnTo={returnTo}
      feedback={editor.feedback}
    >
      {task?.status === "COMPLETED" ? (
        <p>Completed work is historical. Completion corrections arrive in Milestone 7.</p>
      ) : editor.archived ? (
        <p>This task is archived.</p>
      ) : (
        <>
          <p className="manual-help">
            Tasks are work for the planner to schedule. Completion and partial work updates arrive
            in Milestone 7.
          </p>
          <form onSubmit={submit} noValidate>
            <ValidationSummary errors={editor.feedback?.error ? errors : []} />
            <FormField
              label="Task title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <FormField
              label="Estimated work (minutes)"
              type="number"
              min="1"
              step="1"
              value={estimate}
              onChange={(event) => changeEstimate(event.target.value)}
              help="Leave blank if unknown. A new task starts with this amount of remaining work."
            />
            <InstantField
              label="True task deadline"
              timezone={timezone}
              value={due}
              onChange={(event) => setDue(event.target.value)}
              help="Leave blank if unknown. Assessment deadlines are recorded separately."
            />
            <InstantField
              label="Available from"
              timezone={timezone}
              value={available}
              onChange={(event) => setAvailable(event.target.value)}
              help="Leave blank only when the associated assessment has a known release time, or when availability is unknown. The planner needs one of those times."
            />
            <FormField
              label="Typical session length (minutes)"
              type="number"
              min="1"
              step="1"
              value={preferredLength}
              onChange={(event) => setPreferredLength(event.target.value)}
              help="Needed to schedule. Minimum and maximum use this length unless you change them below."
            />
            <SelectField
              label="Assessment"
              value={assessmentId}
              onChange={(event) => chooseAssessment(event.target.value)}
            >
              <option value="">None</option>
              {assessments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Course"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              <option value="">Personal / no course</option>
              {courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
            </SelectField>
            <details className="manual-advanced">
              <summary>Planning and subtask details</summary>
              <div className="mutation-field">
                <label htmlFor="task-description">Description</label>
                <textarea
                  id="task-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <SelectField
                label="Parent task"
                value={parentId}
                onChange={(event) => chooseParent(event.target.value)}
              >
                <option value="">None · top-level task</option>
                {tasks
                  .filter((item) => item.id !== editor.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </SelectField>
              <InstantField
                label="Preferred completion target"
                timezone={timezone}
                value={preferred}
                onChange={(event) => setPreferred(event.target.value)}
              />
              {editor.id && (
                <FormField
                  label="Remaining work (minutes)"
                  type="number"
                  min="0"
                  step="1"
                  value={remaining}
                  onChange={(event) => setRemaining(event.target.value)}
                  help="Correct the estimate here. Completion and partial-work actions arrive in Milestone 7."
                />
              )}
              {task?.originalEstimatedMinutes !== null &&
                task?.originalEstimatedMinutes !== undefined && (
                  <p className="manual-help">
                    Original estimate: {task.originalEstimatedMinutes} minutes. The original is
                    preserved for history.
                  </p>
                )}
              <SelectField
                label="Task state"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="READY">Ready to plan</option>
                <option value="INBOX">Needs review</option>
                <option value="BLOCKED">Blocked</option>
                <option value="DEFERRED">Deferred</option>
                {status === "IN_PROGRESS" && <option value="IN_PROGRESS">In progress</option>}
                {status === "CANCELLED" && <option value="CANCELLED">Cancelled</option>}
              </SelectField>
              <SelectField
                label="Planning mode"
                value={planningMode}
                onChange={(event) => setPlanningMode(event.target.value)}
              >
                <option value="AUTO">Planner schedules this</option>
                <option value="MANUAL">Manually scheduled</option>
                <option value="UNSCHEDULED">Do not schedule</option>
              </SelectField>
              <SelectField
                label="Energy needed"
                value={energy}
                onChange={(event) => setEnergy(event.target.value)}
              >
                <option value="">Not specified</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </SelectField>
              <FormField
                label="Location or capability tags"
                value={locations}
                onChange={(event) => setLocations(event.target.value)}
                help="Comma-separated tags, such as DESK or LAB."
              />
              <div className="manual-session-grid">
                <FormField
                  label="Minimum session (minutes)"
                  type="number"
                  min="1"
                  step="1"
                  value={minimum}
                  onChange={(event) => setMinimum(event.target.value)}
                />
                <FormField
                  label="Maximum session (minutes)"
                  type="number"
                  min="1"
                  step="1"
                  value={maximum}
                  onChange={(event) => setMaximum(event.target.value)}
                />
              </div>
              <CheckField
                label="Can split across sessions"
                checked={splittable}
                onChange={(event) => setSplittable(event.target.checked)}
              />
              <CheckField
                label="Can interrupt between sessions"
                checked={interruptible}
                onChange={(event) => setInterruptible(event.target.checked)}
              />
            </details>
            <FormActions saving={editor.busy} onCancel={() => router.replace(returnTo)} />
          </form>
          {editor.id && (
            <p className="manual-next-action">
              <Link
                className="button button-secondary"
                href={`${returnTo}${returnTo.includes("?") ? "&" : "?"}edit=task-new&parent=${encodeURIComponent(editor.id)}`}
              >
                Add a subtask
              </Link>
            </p>
          )}
          {editor.id && (
            <ArchiveAction
              name="task"
              confirmed={confirmed}
              setConfirmed={setConfirmed}
              busy={editor.busy}
              onArchive={() =>
                editor.commit(
                  `/api/v1/manual/tasks/${encodeURIComponent(editor.id!)}`,
                  "DELETE",
                  { expectedVersion: editor.version },
                  "Task archive",
                )
              }
            />
          )}
        </>
      )}
    </EditorShell>
  );
}
