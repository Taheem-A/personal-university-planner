import { redirect } from "next/navigation";
import { informationViews } from "../../../server/application/information-reads";
import { UpcomingView } from "../../../components/upcoming-view";
import { InlineState } from "../../../components/planner-primitives";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const range =
    typeof query.range === "string" && ["7", "14", "later", "all"].includes(query.range)
      ? query.range
      : "all";
  const sort = query.sort === "due" ? "DUE" : "PRESSURE";
  const view =
    typeof query.view === "string" &&
    ["overview", "tasks", "sessions", "notes", "resources"].includes(query.view)
      ? query.view
      : "overview";
  const result = await informationViews.upcoming({
    ...(typeof query.assessment === "string" ? { assessmentId: query.assessment } : {}),
    sort,
  });
  if (!result.ok) {
    if (result.error.code === "UNAUTHORIZED") redirect("/sign-in");
    return (
      <div className="route-content">
        <h1>Upcoming</h1>
        <InlineState kind="error" title="Upcoming could not load">
          <p>{result.error.message}</p>
        </InlineState>
      </div>
    );
  }
  return <UpcomingView model={result.value} range={range} sort={sort} view={view} />;
}
