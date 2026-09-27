import { onboardingPlan } from "../../../../../server/application/onboarding-plan";
import { mutate } from "../../../../../server/transport";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return mutate(request, onboardingPlan.generate);
}
