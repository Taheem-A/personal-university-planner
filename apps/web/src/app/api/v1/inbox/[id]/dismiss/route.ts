import { inboxItems } from "../../../../../../server/application/inbox";
import { mutateById } from "../../../../../../server/transport";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return mutateById(request, id, async (input) => {
    const result = await inboxItems.dismiss(input);
    return result.ok
      ? {
          ok: true as const,
          value: {
            id: result.value.id,
            version: result.value.version,
            status: result.value.status,
          },
        }
      : result;
  });
}
