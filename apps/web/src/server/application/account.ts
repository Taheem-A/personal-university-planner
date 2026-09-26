import { z } from "zod";
import { planAfterMutation } from "./planner-triggers";
import { requireUpdated, service } from "./service";
import { timezoneSchema } from "./validation";

const timezoneChange = z
  .object({ timezone: timezoneSchema, expectedTimezone: timezoneSchema })
  .strict();

/** The expected timezone is the account's compare-and-write token until a profile version exists. */
export const accountSettings = {
  async changeTimezone(input: unknown) {
    const changed = await planAfterMutation(
      service(timezoneChange, input, async ({ timezone, expectedTimezone }, actor, tx) => {
        const user = requireUpdated(
          await tx.repositories.users.updateTimezoneIfCurrent(
            actor.userId,
            expectedTimezone,
            timezone,
          ),
        );
        return { timezone: user.timezone };
      }),
      () => ({ trigger: { type: "CALENDAR_CHANGED", entityType: "USER_TIMEZONE" } }),
    );
    if (!changed.ok) return changed;
    const planning = changed.value.planning;
    return {
      ok: true as const,
      value: {
        timezone: changed.value.timezone,
        planning: !planning
          ? { status: "NOT_REQUESTED" as const }
          : !planning.ok
            ? { status: "FAILED" as const, code: planning.error.code }
            : planning.value.status === "SUCCEEDED"
              ? { status: "SUCCEEDED" as const, planStatus: planning.value.planStatus }
              : planning.value.status === "INPUT_FAILURE"
                ? { status: "INFEASIBLE" as const }
                : { status: "FAILED" as const },
      },
    };
  },
};
