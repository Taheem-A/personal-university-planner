import Link from "next/link";
import type { OnboardingViewModel } from "../server/application/secondary-reads";
import { TimezoneForm } from "./timezone-form";
import { FirstPlanAction } from "./first-plan-action";

const steps = [
  {
    name: "Academic term",
    description: "Welcome. Set your time zone and the semester that anchors your plan.",
  },
  { name: "Courses", description: "The courses and recurring work you are planning around." },
  { name: "Weekly schedule", description: "Classes and other fixed commitments." },
  {
    name: "Availability",
    description: "Time you can use, time you protect, and your planning preferences.",
  },
  { name: "Current workload", description: "Assessments and tasks that need a place in the plan." },
  {
    name: "First plan",
    description: "Generate an authoritative plan from your saved academic and personal facts.",
  },
] as const;

type PlanningIssue = { code: string; message: string };
function issueLink(code: string) {
  if (code === "MISSING_PREFERENCES" || code === "MISSING_SLEEP_POLICY")
    return { href: "/settings?section=planning&edit=preferences", label: "Edit preferences" };
  if (code === "MISSING_SLEEP_WINDOW")
    return { href: "/availability?edit=protection-new", label: "Add hard sleep" };
  if (
    [
      "MISSING_ESTIMATE",
      "MISSING_AVAILABILITY",
      "MISSING_SESSION_RULE",
      "INVALID_DEPENDENCY",
    ].includes(code)
  )
    return { href: "/upcoming", label: "Review tasks" };
  return { href: "/availability", label: "Review availability" };
}
export function OnboardingView({
  model,
  step,
  planningIssues = [],
  readinessError = null,
}: {
  model: OnboardingViewModel;
  step: number;
  planningIssues?: PlanningIssue[];
  readinessError?: string | null;
}) {
  const progress = [
    Boolean(model.term),
    model.courseCount > 0,
    model.availabilityCount > 0,
    model.sleepCount > 0,
    model.preferencesConfigured,
    model.schedulableTaskCount > 0,
    model.hasUsablePlan,
  ].filter(Boolean).length;
  const evidence = [
    model.term ? `${model.term.name} · active term` : "No active academic term recorded",
    `${model.courseCount} courses recorded`,
    `${model.meetingCount} recurring course meetings · ${model.fixedEventCount} nearby fixed commitments`,
    `${model.availabilityCount} availability rules · ${model.protectedCount} protected-time rules (${model.sleepCount} hard sleep) · preferences ${model.preferencesConfigured ? "saved" : "missing"}`,
    `${model.assessmentCount} assessments · ${model.taskCount} tasks (${model.schedulableTaskCount} ready for automatic planning)`,
    model.hasUsablePlan
      ? "A usable plan with work sessions is recorded"
      : model.hasSuccessfulPlan
        ? "A plan run is recorded, but no usable work sessions are confirmed"
        : "No successful plan recorded",
  ];
  const index = step - 1;
  return (
    <div className="route-content onboarding-content">
      <header className="page-header">
        <h1>Set up your planner</h1>
        <p>
          {model.needsSetup
            ? "Build your semester from facts you enter. External integrations are optional."
            : "Your saved semester and usable plan are ready. You can revisit any step."}
        </p>
        <div className="onboarding-progress">
          <label htmlFor="setup-progress">{progress} of 7 core planning facts recorded</label>
          <progress id="setup-progress" value={progress} max={7} />
        </div>
      </header>
      <div className="onboarding-layout">
        <nav className="onboarding-steps" aria-label="Setup steps">
          {steps.map((item, position) => (
            <Link
              key={item.name}
              href={`/onboarding?step=${position + 1}`}
              aria-current={index === position ? "step" : undefined}
              className={index === position ? "active" : ""}
            >
              <span className="onboarding-number">{position + 1}</span>
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
        <section className="onboarding-main" aria-labelledby="onboarding-step-title">
          <p className="panel-kicker">
            Step {step} of {steps.length}
          </p>
          <h2 id="onboarding-step-title">{steps[index].name}</h2>
          <p>{steps[index].description}</p>
          <div className="onboarding-evidence">
            <strong>Recorded in your account</strong>
            <p>{evidence[index]}</p>
          </div>
          {step === 1 && (
            <div className="onboarding-note">
              <p>
                Start with your own semester, commitments, and current work. You can leave and
                return; these steps read your saved account facts.
              </p>
              <p>
                Your current time zone is {model.timezone}. Confirm it before entering dated facts.
              </p>
              <TimezoneForm initialTimezone={model.timezone} />
            </div>
          )}
          {step === 1 && (
            <Link
              className="button button-secondary"
              href={
                model.term
                  ? `/courses?edit=term:${encodeURIComponent(model.term.id)}`
                  : "/courses?edit=term-new"
              }
            >
              {model.term ? "Edit academic term" : "Add academic term"}
            </Link>
          )}
          {step === 2 && (
            <div className="manual-top-actions">
              <Link className="button button-secondary" href="/courses?edit=course-new">
                Add course
              </Link>
              <Link className="button button-secondary" href="/courses">
                Review existing courses
              </Link>
            </div>
          )}
          {step === 3 && (
            <div className="manual-top-actions">
              <Link className="button button-secondary" href="/courses?edit=meeting-new">
                Add a recurring class
              </Link>
              <Link className="button button-secondary" href="/availability?edit=event-new">
                Add a fixed commitment
              </Link>
              <Link className="button button-secondary" href="/availability">
                Review weekly calendar
              </Link>
            </div>
          )}
          {step === 4 && (
            <div className="manual-top-actions">
              <Link className="button button-secondary" href="/availability?edit=availability-new">
                Add available time
              </Link>
              <Link className="button button-secondary" href="/availability?edit=protection-new">
                Add protected time
              </Link>
              <Link
                className="button button-secondary"
                href="/settings?section=planning&edit=preferences"
              >
                {model.preferencesConfigured
                  ? "Edit planning preferences"
                  : "Set planning preferences"}
              </Link>
              <Link className="button button-secondary" href="/availability">
                Review saved time rules
              </Link>
            </div>
          )}
          {step === 5 && (
            <div className="manual-top-actions">
              <Link className="button button-secondary" href="/upcoming?edit=assessment-new">
                Add an assessment
              </Link>
              <Link className="button button-secondary" href="/upcoming?edit=task-new">
                Add work for the planner
              </Link>
              <Link className="button button-secondary" href="/upcoming">
                Review current workload
              </Link>
            </div>
          )}
          {step === 6 && (
            <div className="onboarding-plan-readiness">
              {readinessError && (
                <p className="onboarding-note" role="alert">
                  Planning readiness could not be checked: {readinessError}
                </p>
              )}
              <p className="manual-help">
                This action uses your saved facts and the authoritative Planner Service. It does not
                read Google Calendar, a learning system, email, or AI.
              </p>
              {(!model.term ||
                model.courseCount === 0 ||
                model.availabilityCount === 0 ||
                model.sleepCount === 0 ||
                !model.preferencesConfigured ||
                model.schedulableTaskCount === 0) && (
                <div className="onboarding-note" role="status">
                  <strong>Review these setup facts</strong>
                  <ul>
                    {!model.term && (
                      <li>
                        <Link href="/courses?edit=term-new">Add and activate an academic term</Link>
                        .
                      </li>
                    )}
                    {model.courseCount === 0 && (
                      <li>
                        <Link href="/courses?edit=course-new">Add a course</Link>.
                      </li>
                    )}
                    {model.availabilityCount === 0 && (
                      <li>
                        <Link href="/availability?edit=availability-new">
                          Add time when work may be scheduled
                        </Link>
                        .
                      </li>
                    )}
                    {model.sleepCount === 0 && (
                      <li>
                        <Link href="/availability?edit=protection-new">Add a hard sleep rule</Link>.
                      </li>
                    )}
                    {!model.preferencesConfigured && (
                      <li>
                        <Link href="/settings?section=planning&edit=preferences">
                          Set planning preferences
                        </Link>
                        .
                      </li>
                    )}
                    {model.schedulableTaskCount === 0 && (
                      <li>
                        <Link href="/upcoming?edit=task-new">Add a ready task for the planner</Link>
                        .
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {planningIssues.length > 0 && (
                <div className="onboarding-note" role="status">
                  <strong>The planner still needs these facts</strong>
                  <ul>
                    {planningIssues.map((issue, index) => {
                      const action = issueLink(issue.code);
                      return (
                        <li key={`${issue.code}-${index}`}>
                          {issue.message} <Link href={action.href}>{action.label}</Link>.
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <FirstPlanAction hasUsablePlan={model.hasUsablePlan} />
            </div>
          )}
          <div className="onboarding-actions">
            {step > 1 ? (
              <Link className="button button-secondary" href={`/onboarding?step=${step - 1}`}>
                Previous
              </Link>
            ) : (
              <span />
            )}
            {step < steps.length ? (
              <Link className="button button-primary" href={`/onboarding?step=${step + 1}`}>
                Next step
              </Link>
            ) : (
              <Link className="button button-secondary" href="/today">
                View Today
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
