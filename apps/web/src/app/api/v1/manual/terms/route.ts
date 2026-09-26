import { manualTerms } from "../../../../../server/application/manual-management";
import { mutate } from "../../../../../server/transport";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return mutate(request, manualTerms.create);
}
