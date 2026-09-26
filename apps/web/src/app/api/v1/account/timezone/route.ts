import { accountSettings } from "../../../../../server/application/account";
import { mutate } from "../../../../../server/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  return mutate(request, accountSettings.changeTimezone);
}
