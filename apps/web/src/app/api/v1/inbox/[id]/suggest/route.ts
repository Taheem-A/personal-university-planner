import { inboxItems } from "../../../../../../server/application/inbox";
import { mutateById } from "../../../../../../server/transport";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return mutateById(request, id, inboxItems.suggest);
}
