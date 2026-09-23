import { academicTerms } from "../../../../../server/application/academic";
import { mutateById, respond } from "../../../../../server/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  return respond(await academicTerms.get({ id: (await context.params).id }));
}
export async function PATCH(request: Request, context: Context) {
  return mutateById(request, (await context.params).id, academicTerms.update);
}
export async function DELETE(request: Request, context: Context) {
  return mutateById(request, (await context.params).id, academicTerms.archive);
}
