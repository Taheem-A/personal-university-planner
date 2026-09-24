# Implementation status

## Current milestone status

**Milestone 3 — GATE PASSED and merged.** [PR #3](https://github.com/Taheem-A/personal-university-planner/pull/3) merged into `master` at `e8b5e846e72a4269d304213adbf81ba22416a915`. The [literal exit-gate audit](./milestone-3-exit-gate.md) maps every roadmap requirement to implementation and passing test evidence. The planner contract, architecture, normalization/candidate-capacity, prioritization, sustainable-allocation, policy, validation/repair/scenario, canonical regression and randomized-invariant slices are implemented. The core has focused pure modules for normalization, eligibility, occupied timeline, candidate windows, pressure/ranking, allocation, sustainability, retention policy, validation, repair, diagnostics, simulation and versioning. Its explicit snapshot carries all facts needed by `heuristic-v1`. See [ADR 0005](./decisions/0005-planner-core-v1-contract.md). GitHub [CI run 36025989398](https://github.com/Taheem-A/personal-university-planner/actions/runs/36025989398) and [dependency review run 36025989365](https://github.com/Taheem-A/personal-university-planner/actions/runs/36025989365) both passed for planner implementation head `47f2bd87421b1d85453beb7d9df68990f40641b6`; [CI run 36046159256](https://github.com/Taheem-A/personal-university-planner/actions/runs/36046159256) and [dependency review run 36046159376](https://github.com/Taheem-A/personal-university-planner/actions/runs/36046159376) passed for final PR head `da2345813a325ae7f5e8bf19743776fb3328d13a`.

The normalization/eligibility/timeline/candidate-capacity slice is also implemented on this branch. Core now expands explicit wall-clock recurrence through shared time utilities, validates resolved task facts, excludes non-AUTO or inactive work, resolves dependency readiness, merges hard occupancy, preserves manual/locked sessions, and builds disjoint five-minute candidate windows with capability and commute metadata. Hard protected time and sleep remove capacity; soft time remains soft. Unknown deadlines remain unknown. The exact rules and remaining limits are recorded in ADR 0005.

The prioritization slice calculates task-specific suitable capacity before the true deadline, including availability, energy, capability, commute policy, capacity factor and an optimistic prerequisite completion bound. Diagnostics expose slack, pressure ratio, deficit, feasibility, deadline/preferred-target pressure and named score components. Importance is optional and bounded; prerequisite work receives an explicit downstream boost. Ranking uses stable score, true deadline, preferred target and task ID tie-breakers, and recomputes ready-task pressure after each placement. The heuristic coefficients and thresholds live in one typed `heuristic-v1` configuration.

The sustainable-allocation slice balances remaining work into useful sessions, respects non-splittable tasks, maximum session and consecutive-work lengths, and reserves unscheduled break gaps across tasks and retained sessions. Placement uses actual window productivity, preferred deadline buffers, energy, session fit and context-switch costs. A pure local-day policy checks preferred study limits and free-time buffers using the planner timezone, then allows required work to consume those soft limits with quantified warnings. Work accounting and five-minute boundaries are validated.

The policy slice enforces dependency ordering during placement and rejects unknown/cyclic edges. Capability and commute compatibility are hard suitability checks; the coarse energy model remains a productivity preference. Soft events/protected time are avoided until needed, with explicit warnings when used. Local-time weekend costs discourage avoidable Sunday concentration. Manual and locked work are retained as user intent; ordinary previous planner sessions are kept when valid, especially within the stability window, and an infeasible retained arrangement can relax in tiers with a warning. Explicit released windows follow `KEEP_FREE`, `REPLAN_IF_USEFUL` or `ALWAYS_REPLAN` policy.

The validation/repair/scenario slice adds a structured hard-invariant audit, one bounded deterministic retry that excludes invalid generated placements, and an explicit `VALID`/`INFEASIBLE` output state. Task infeasibility reports required, scheduled, suitable and deficient minutes with deterministically supported limiting factors. Placement reasons remain separate from numerical pressure diagnostics. Protected-window simulations leave input untouched, return a complete alternative, report session movement/addition/removal and capacity/deficit deltas, and never apply or persist the scenario.

The [canonical scenario matrix](./milestone-3-scenario-matrix.md) covers all 13 roadmap scenarios with permanent synthetic Toronto fixtures. The targeted suite passed 13/13 locally. It exposed and fixed a soft-policy allocation defect: a preferred free-time reserve could strand otherwise feasible work before an earlier deadline. The planner now retries that task without the soft daily preference when needed, preserving hard constraints and warning about the compromise. The final acceptance slice adds 1,000 reproducible randomized snapshots and a 64-scenario repeated-output proof. It exposed and fixed a tiny-fragment allocation defect, adds a truthful available-capacity placement reason and a retained-conflict limiting factor, and strengthens automated core isolation against computed imports and ambient IO/time/randomness.

This final acceptance slice passed full local `pnpm verify`: format, lint, 73-file package boundaries, Prisma generation/validation, typecheck, **98/98** unit tests, **36/36** integration tests, core/database/Next.js builds and **2/2** Chromium E2E tests. Dedicated canonical and property commands passed **13/13** and **2/2** respectively. The property command covered 1,000 fixed seeds; 64 additional seeds each produced six deeply equal full outputs. `pnpm check:dependencies` reported no known vulnerabilities. GitHub CI and dependency review independently passed on the implementation head cited above.

This canonical-scenario slice passed full local `pnpm verify`: format, lint, 73-file package boundaries, Prisma generation/validation, typecheck, 96/96 unit tests, 36/36 integration tests, production build and 2/2 Chromium E2E tests. The dedicated scenario command passed 13/13.

The validation/repair/scenario slice passed full local `pnpm verify`: format, lint, 73-file package boundaries, Prisma generation/validation, typecheck, 83/83 unit tests, 36/36 integration tests, production build and 2/2 Chromium E2E tests.

The policy slice passed full local `pnpm verify`: format, lint, 71-file package boundaries, Prisma generation/validation, typecheck, 74/74 unit tests, 36/36 integration tests, production build and 2/2 Chromium E2E tests.

The sustainable-allocation slice passed full local `pnpm verify`: format, lint, package boundaries (70 source files), Prisma generation/validation, typecheck, 61/61 unit tests, 36/36 integration tests, production build and 2/2 Chromium E2E tests. No plan or WorkSession persistence was added.

The prioritization slice passed full local `pnpm verify`: formatting, lint, package boundaries (69 source files), Prisma generation/validation, typecheck, unit and integration tests, production build and Chromium E2E. The exact final test counts are recorded in the newest roadmap-progress entry.

Full `pnpm verify` passed for this slice: format, lint, package boundaries (68 source files), Prisma generation/validation, typecheck, 36/36 unit tests, 36/36 integration tests, production build and 2/2 Chromium E2E tests. The planner-specific tests cover recurrence/DST, hard-time subtraction, eligibility, dependencies, retained work, overlapping availability, commute and input purity.

The preceding contract/architecture slice also passed full local `pnpm verify` at its commit: 25/25 unit tests, 36/36 integration tests and 2/2 Chromium E2E tests. No live PostgreSQL planner execution is part of these pure-core slices.

**Milestone 2 — GATE PASSED and merged.** PR #2 was merged into default branch `master` at `d98dfd6`. Google-only Auth.js, persistent canonical identity provisioning, authenticated and validated service families, explicit optimistic versions, account lifecycle, and representative protected Next.js routes are implemented. Migrations 0001–0006 deployed from zero on a fresh disposable Neon database; guarded live route/service/PostgreSQL, concurrent identity provisioning, rollback and schema-drift checks passed. PR #2 supplied clean GitHub Actions `pnpm verify` with Chromium and a green dependency review. The final literal exit-gate audit is recorded in [Milestone 2 exit gate](./milestone-2-exit-gate.md).

**Milestone 1 — GATE PASSED**

The canonical schema/domain audit, centralized time foundation, first source-controlled migration, deterministic synthetic semester seed, and persistence/repository boundary are complete. Final acceptance proved zero-to-current deployment and reproducibility on fresh disposable Neon databases, every canonical repository family, transaction rollback, Toronto DST behavior, architecture boundaries, full builds, and browser regressions. See [Milestone 1 exit gate](./milestone-1-exit-gate.md).

## Production bootstrap now implemented

- Real Next.js App Router application at `apps/web` with strict TypeScript and a health endpoint.
- pnpm modular-monolith workspace covering web, database, planner-core, domain, integrations, assistant, analytics, and shared packages.
- Node.js 24.21.0 LTS and pnpm 12.5.1 pinned across local version files, package metadata, and CI.
- Typed development/preview/production environment validation and a complete secret-free `.env.example`.
- Formatting, lint, package-boundary, typecheck, unit, integration, Prisma validation, production build, and browser/E2E commands.
- GitHub Actions CI plus dependency/license review.
- Registry audit passes at the configured high-severity gate; patched transitive Prisma tooling versions are pinned explicitly.
- Neon, Vercel, Google-only Auth.js, and Sentry decisions recorded; explicit background jobs deferred to the first asynchronous integration.
- Existing planner/domain/shared/integration/assistant/analytics sources preserved and built as the framework-independent core.
- Static preview isolated under `prototypes/approved-preview`; approved screenshots and QA captures isolated under `docs/regression-reference`.
- Generated `dist` output removed from version control; tests build it locally before execution.

## Verified at this milestone

- Existing six planner and estimate-learning unit tests pass.
- Workspace and real-source package-boundary integration tests pass.
- Prisma 7 validates the existing PostgreSQL schema through `prisma.config.ts`.
- Next.js production build completes and emits `/` plus `/api/health`.
- Playwright boots the real Next.js app and exercises the preserved interactive preview.
- The Milestone-1 full `pnpm verify` run passed. Milestone-2 clean GitHub Actions `pnpm verify` passed on Node 24.21.0/pnpm 12.5.1: formatting, lint, boundaries, Prisma generation/validation, typecheck, 23 unit tests, 35 integration tests, builds and Chromium E2E (2/2). Guarded live PostgreSQL service and additional identity/deletion-rollback checks passed; dependency review and audit passed.
- `pnpm check:dependencies` reports no known vulnerabilities.

## Milestone-2 implementation

- Auth.js Google-only OIDC login uses a unique provider-account mapping and atomic first-login canonical User provisioning. Application services derive user scope from the authenticated server session; login does not request Calendar access or retain Google OAuth tokens.
- Academic, scheduling, inbox, history, integration metadata and account lifecycle services validate input, authorize ownership, transact through the database package and return structured results. Planning-relevant updates compare explicit versions.
- Representative Next.js account export, term, course, task and availability routes call services through a shared safe transport adapter. Package checks prevent transport imports of Prisma, repositories and internal service infrastructure.
- Server-only Sentry capture is optional and emits a fixed internal-failure signal without request or user content.
- Production UI migration, Google Calendar, Quercus/LMS, assistant execution, scheduling engine completion, background jobs and microservices remain deferred.

## Milestone 1 work completed so far

- Audited every roadmap entity and recorded the decisions in ADR 0002.
- Corrected date-only, local wall-clock, and UTC-instant storage paths.
- Added direct/composite user ownership, explicit history-preserving relations, typed preferences, account-scoped external identity, and the missing `RecurringWorkRule`.
- Separated assessment submission from task completion and original/current/remaining/actual duration meanings.
- Centralized half-open interval algebra, date-only arithmetic, five-minute quantum helpers, IANA timezone conversion, DST disambiguation, and bounded daily/weekly wall-clock recurrence in `packages/shared`.
- Refactored planner-core to use shared intersection/subtraction rather than private interval logic.
- Established `0001_canonical_foundation`, reviewed its PostgreSQL SQL, and added migration-owned check constraints plus guarded migration commands/tests.
- Rebuilt the empty `up_m1_migration_20260921` database on the disposable Neon branch `milestone-1-migration-bootstrap-20260921` solely from migration history; status, drift, and introspection checks pass.
- Added a fixed-ID, fixed-date, idempotent synthetic Fall 2026 engineering fixture covering the canonical relational model without private data or credentials.
- Deployed migration history into empty `up_m1_seed_20260921`, seeded it twice, and verified counts, ownership, hierarchy, dependencies, temporal round trips, null semantics, history links, and external uniqueness after each run.
- Added the server-only database client, plain record mappings, transaction-bound repository context, and explicit repositories for all 19 canonical entities.
- Made user scope mandatory on ownership-sensitive reads and mutations, kept Prisma implementation types inside `packages/database`, and extended package-boundary enforcement to block Prisma/pg imports elsewhere.
- Proved create/read/update/archive behavior, canonical relationships, user isolation, hierarchy, dependencies, work-session supersession, JSON and temporal round trips, structured external-identity uniqueness errors, and all-or-nothing rollback against disposable Neon.

## Gate outcome and later risks

No Milestone-2 exit blocker remains after the literal re-audit and PR #2 merge. External Google OAuth redirect/callback availability has not been exercised with deployment credentials; the Auth.js callback boundary is tested locally and canonical identity concurrency was verified against PostgreSQL. Provider integration, snapshot-consistent export and credential revocation remain later-roadmap work.

## Exact next work item

**Milestone 4 — Planner Service, PlannerRuns, Persistence, and Incremental Replanning.** Milestone 4 has **not started**.
