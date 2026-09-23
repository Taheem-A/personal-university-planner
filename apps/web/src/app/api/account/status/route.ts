import { authenticatedActor } from "../../../../server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const actor = await authenticatedActor();
  if (!actor) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return Response.json({ userId: actor.userId });
}
