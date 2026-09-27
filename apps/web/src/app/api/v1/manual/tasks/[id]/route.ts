import { manualTasks } from "../../../../../../server/application/manual-management";
import { mutateById } from "../../../../../../server/transport";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return mutateById(request, (await context.params).id, manualTasks.update);
}
export async function DELETE(request: Request, context: Context) {
  return mutateById(request, (await context.params).id, manualTasks.archive);
}
