import { readEnvironment } from "../../../lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const environment = readEnvironment();

  return Response.json({
    status: "ok",
    service: "university-planner-web",
    environment: environment.publicEnvironment,
  });
}
