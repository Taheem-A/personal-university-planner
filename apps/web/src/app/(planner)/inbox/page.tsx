import { redirect } from "next/navigation";
import { informationViews } from "../../../server/application/information-reads";
import { InboxView } from "../../../components/inbox-view";
import { InlineState } from "../../../components/planner-primitives";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const result = await informationViews.inbox();
  if (!result.ok) {
    if (result.error.code === "UNAUTHORIZED") redirect("/sign-in");
    return (
      <div className="route-content">
        <h1>Inbox</h1>
        <InlineState kind="error" title="Inbox could not load">
          <p>{result.error.message}</p>
        </InlineState>
      </div>
    );
  }
  const status =
    query.status === "PROCESSED" || query.status === "DISMISSED" ? query.status : "ACTIVE";
  return <InboxView model={result.value} status={status} focusCapture={query.capture === "1"} />;
}
