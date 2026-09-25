import { redirect } from "next/navigation";
import { plannerViews } from "../../../server/application/planner-reads";
import { TodayView } from "../../../components/today-view";
import { InlineState } from "../../../components/planner-primitives";
import Link from "next/link";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const result = await plannerViews.today({ date: query.date });
  if (!result.ok) {
    if (result.error.code === "UNAUTHORIZED") redirect("/sign-in");
    return (
      <div className="route-content today-content">
        <h1>Today</h1>
        <InlineState
          kind="error"
          title={result.error.code === "VALIDATION_ERROR" ? "Invalid date" : "Today could not load"}
        >
          <p>{result.error.message}</p>
          <Link href="/today" className="button button-secondary">
            Open today
          </Link>
        </InlineState>
      </div>
    );
  }
  return (
    <TodayView
      model={result.value}
      selectedSession={typeof query.session === "string" ? query.session : null}
      selectedTask={typeof query.task === "string" ? query.task : null}
    />
  );
}
