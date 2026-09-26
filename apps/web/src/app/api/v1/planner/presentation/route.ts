import { plannerPresentation } from "../../../../../server/application/planner-presentation-reads";
import { respond } from "../../../../../server/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(await plannerPresentation.current());
}
