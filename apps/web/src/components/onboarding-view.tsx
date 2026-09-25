import Link from "next/link";
import type { OnboardingViewModel } from "../server/application/secondary-reads";

const steps = [
  { name: "Academic term", description: "The semester that anchors your plan." },
  { name: "Courses", description: "The courses and recurring work you are planning around." },
  { name: "Weekly schedule", description: "Classes and other fixed commitments." },
  { name: "Availability", description: "Time you can use and time you protect." },
  { name: "Current workload", description: "Assessments and tasks that need a place in the plan." },
  { name: "First plan", description: "Review the plan once your academic facts are recorded." },
] as const;

export function OnboardingView({ model, step }: { model: OnboardingViewModel; step: number }) {
  const evidence = [
    model.term ? `${model.term.name} · active` : "No active academic term recorded",
    `${model.courseCount} courses recorded`,
    `${model.meetingCount} recurring course meetings recorded`,
    `${model.availabilityCount} availability rules · ${model.protectedCount} protected-time rules`,
    `${model.assessmentCount} assessments · ${model.taskCount} tasks recorded`,
    model.hasSuccessfulPlan ? "A successful plan is recorded" : "No successful plan recorded",
  ];
  const index = step - 1;
  return (
    <div className="route-content onboarding-content">
      <header className="page-header">
        <h1>Set up your planner</h1>
        <p>
          {model.needsSetup
            ? "Review what is recorded so far."
            : "Your account has a term, courses, and a recorded plan."}
        </p>
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
            <p className="onboarding-note">
              Your timezone is {model.timezone}. The next release will let you enter and update
              these facts here.
            </p>
          )}
          {step === 6 && (
            <p className="onboarding-note">
              This presentation does not create a term or generate a plan. First-plan setup and
              persistence arrive with manual onboarding.
            </p>
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
                Return to Today
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
