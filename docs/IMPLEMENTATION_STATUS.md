# Implementation status

## Current milestone status

**Milestone 2 — IN PROGRESS.** Stable Google identity persistence, Auth.js sign-in/session boundary, and reusable trusted service primitives are implemented on `auth/milestone-2-trust-boundary`. Migration 0002 maps provider accounts to canonical Users; migration 0003 adds Task optimistic versions. Core entity services, a real Google OAuth round trip, live Prisma migration-history verification, and browser E2E remain before the milestone gate. See `docs/ROADMAP_PROGRESS.md` for current verification and the next service slice.

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
- The full `pnpm verify` command passes.
- `pnpm check:dependencies` reports no known vulnerabilities.

## Deliberately not implemented

- Auth.js runtime and user isolation.
- Application services or canonical state writes.
- Production UI migration from the approved preview.
- Google Calendar, Quercus/LMS, assistant execution, advanced optimization, background jobs, or microservices.

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

## Blockers

None. The remaining risks recorded in the exit-gate audit are intentionally assigned to later milestones and do not require a Milestone-1 schema redesign.

## Exact next work item

Begin **Milestone 2 — Authentication, Authorization, Validation, and Application Services** after the Milestone-1 PR is reviewed and merged.
