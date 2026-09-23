import { academicTerms } from "../../../../server/application/academic";
import { mutate, respond } from "../../../../server/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return respond(await academicTerms.list());
}
export async function POST(request: Request) {
  return mutate(request, academicTerms.create);
}
