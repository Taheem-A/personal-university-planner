import { accountData } from "../../../../../server/application/lifecycle";
import { respond } from "../../../../../server/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(await accountData.export());
}
