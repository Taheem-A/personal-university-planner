import { redirect } from "next/navigation";
import { secondaryViews } from "../../../server/application/secondary-reads";
import { AvailabilityView } from "../../../components/availability-view";
import { InlineState } from "../../../components/planner-primitives";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const result = await secondaryViews.availability(
    typeof query.date === "string" ? { date: query.date } : {},
  );
  if (!result.ok) {
    if (result.error.code === "UNAUTHORIZED") redirect("/sign-in");
    return (
      <div className="route-content">
        <h1>Calendar &amp; Availability</h1>
        <InlineState kind="error" title="Availability could not load">
          <p>{result.error.message}</p>
        </InlineState>
      </div>
    );
  }
  return <AvailabilityView model={result.value} />;
}
