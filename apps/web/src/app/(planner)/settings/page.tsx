import { redirect } from "next/navigation";
import { secondaryViews } from "../../../server/application/secondary-reads";
import { SettingsView } from "../../../components/settings-view";
import { InlineState } from "../../../components/planner-primitives";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const section =
    typeof query.section === "string" &&
    ["general", "planning", "appearance", "data"].includes(query.section)
      ? query.section
      : "general";
  const result = await secondaryViews.settings();
  if (!result.ok) {
    if (result.error.code === "UNAUTHORIZED") redirect("/sign-in");
    return (
      <div className="route-content">
        <h1>Settings</h1>
        <InlineState kind="error" title="Settings could not load">
          <p>{result.error.message}</p>
        </InlineState>
      </div>
    );
  }
  return <SettingsView model={result.value} section={section} />;
}
