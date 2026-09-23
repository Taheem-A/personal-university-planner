import { availabilityRules } from "../../../../server/application/schedule";
import { mutate, respond } from "../../../../server/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(await availabilityRules.list());
}
export async function POST(request: Request) {
  return mutate(request, availabilityRules.create);
}
