import { tasks } from "../../../../server/application/academic";
import { mutate, respond } from "../../../../server/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(await tasks.list());
}
export async function POST(request: Request) {
  return mutate(request, tasks.create);
}
