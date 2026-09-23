import { tasks } from "../../../../../server/application/academic";
import { mutateById, respond } from "../../../../../server/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  return respond(await tasks.get({ id: (await context.params).id }));
}
export async function PATCH(request: Request, context: Context) {
  return mutateById(request, (await context.params).id, tasks.update);
}
export async function DELETE(request: Request, context: Context) {
  return mutateById(request, (await context.params).id, tasks.archive);
}
