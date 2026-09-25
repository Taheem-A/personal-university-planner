import { redirect } from "next/navigation";
import { secondaryViews } from "../../../server/application/secondary-reads";
import { IntegrationsView } from "../../../components/integrations-view";
import { InlineState } from "../../../components/planner-primitives";

export default async function Page() {
  const result = await secondaryViews.integrations();
  if (!result.ok) {
    if (result.error.code === "UNAUTHORIZED") redirect("/sign-in");
    return (
      <div className="route-content">
        <h1>Integrations</h1>
        <InlineState kind="error" title="Integrations could not load">
          <p>{result.error.message}</p>
        </InlineState>
      </div>
    );
  }
  return <IntegrationsView model={result.value} />;
}
