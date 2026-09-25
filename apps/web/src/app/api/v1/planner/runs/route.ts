import { plannerRuns } from "../../../../../server/application/lifecycle";
import { respond } from "../../../../../server/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("limit");
  return respond(await plannerRuns.list(raw === null ? {} : { limit: Number(raw) }));
}
