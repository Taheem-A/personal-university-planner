import Link from "next/link";
import { redirect } from "next/navigation";
import { instantToLocal } from "@university-planner/shared";
import { plannerViews } from "../../../server/application/planner-reads";
import { WeekView } from "../../../components/week-view";
import { InlineState } from "../../../components/planner-primitives";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const result = await plannerViews.week({ date: query.date });
  if (!result.ok) {
    if (result.error.code === "UNAUTHORIZED") redirect("/sign-in");
    return (
      <div className="route-content week-content">
        <h1>Week</h1>
        <InlineState
          kind="error"
          title={result.error.code === "VALIDATION_ERROR" ? "Invalid date" : "Week could not load"}
        >
          <p>{result.error.message}</p>
          <Link href="/week" className="button button-secondary">
            Open this week
          </Link>
        </InlineState>
      </div>
    );
  }
  const model = result.value;
  const currentDate = instantToLocal(new Date(), model.timezone).date;
  const selectedDay =
    typeof query.day === "string" && model.days.some((day) => day.date === query.day)
      ? query.day
      : model.days.some((day) => day.date === currentDate)
        ? currentDate
        : model.weekStart;
  return (
    <WeekView
      model={model}
      currentDate={currentDate}
      selectedDay={selectedDay}
      selectedSession={typeof query.session === "string" ? query.session : null}
      selectedEvent={typeof query.event === "string" ? query.event : null}
      selectedDeadline={typeof query.deadline === "string" ? query.deadline : null}
    />
  );
}
