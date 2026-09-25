import { redirect } from "next/navigation";
import Link from "next/link";
import { secondaryViews } from "../../../server/application/secondary-reads";
import { OnboardingView } from "../../../components/onboarding-view";
import { InlineState } from "../../../components/planner-primitives";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const step =
    typeof query.step === "string" && /^[1-6]$/.test(query.step) ? Number(query.step) : 1;
  const result = await secondaryViews.onboarding();
  if (!result.ok) {
    if (result.error.code === "UNAUTHORIZED") redirect("/sign-in");
    return (
      <div className="route-content">
        <h1>Set up your planner</h1>
        <InlineState kind="error" title="Setup could not load">
          <p>{result.error.message}</p>
          <Link href="/today" className="button button-secondary">
            Return to Today
          </Link>
        </InlineState>
      </div>
    );
  }
  return <OnboardingView model={result.value} step={step} />;
}
