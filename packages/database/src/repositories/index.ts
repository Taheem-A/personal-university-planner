import type { DatabaseExecutor } from "../internal.js";
import { createAuthIdentityRepository } from "./auth.js";
import { createAcademicRepositories } from "./academic.js";
import { createCalendarRepositories } from "./calendar.js";
import { createHistoryRepositories } from "./history.js";
import { createAccountLifecycleRepository } from "./lifecycle.js";
import { createIntegrationRepositories } from "./integrations.js";
import { createPlanningRepositories } from "./planning.js";
import type { CanonicalRepositories } from "./types.js";

export type * from "./types.js";

export function createRepositories(db: DatabaseExecutor): CanonicalRepositories {
  return {
    accountLifecycle: createAccountLifecycleRepository(db),
    authIdentities: createAuthIdentityRepository(db),
    ...createAcademicRepositories(db),
    ...createPlanningRepositories(db),
    ...createCalendarRepositories(db),
    ...createHistoryRepositories(db),
    ...createIntegrationRepositories(db),
  };
}
