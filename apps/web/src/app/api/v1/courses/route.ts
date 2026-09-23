import { courses } from "../../../../server/application/academic";
import { mutate } from "../../../../server/transport";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return mutate(request, courses.create);
}
