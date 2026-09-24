import { plannerViews } from "../../../../../server/application/planner-reads";
import { respond } from "../../../../../server/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return respond(
    await plannerViews.week({ date: new URL(request.url).searchParams.get("date") ?? undefined }),
  );
}
