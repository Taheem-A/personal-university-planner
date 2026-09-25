import { inboxItems } from "../../../../../server/application/inbox";
import { bodyOf, respond } from "../../../../../server/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const body = await bodyOf(request);
  if (body instanceof Response) return body;
  const result = await inboxItems.capture(body);
  return respond(
    result.ok ? { ok: true, value: { id: result.value.id, status: result.value.status } } : result,
  );
}
