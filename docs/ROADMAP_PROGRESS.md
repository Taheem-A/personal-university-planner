# Roadmap progress

This repository log updates the implementation status required by **University Planner — Implementation Roadmap** without modifying the read-only project-source copy.

## 2026-09-21 — Milestone 0: GATE PASSED

### What changed

- Confirmed `Taheem-A/personal-university-planner` on `master` as the populated authoritative repository; the similarly named `University-Planner` repository is empty.
- Converted the repository to a pinned pnpm modular-monolith workspace and booted a real Next.js + TypeScript application.
- Added strict shared TypeScript, ESLint, Prettier, environment validation, `.env.example`, configuration-boundary documentation, CI, dependency review, package-boundary enforcement, Prisma 7 validation, and unit/integration/E2E commands.
- Preserved the existing framework-independent core rather than replacing it.
- Moved the interactive preview to `prototypes/approved-preview`, moved its QA captures to `docs/regression-reference/approved-preview`, and copied approved project screenshots to `docs/regression-reference/approved-designs`.
- Recorded Node/package-manager/provider/auth/observability/background-job decisions in ADR 0001.
- Removed the deprecated `tsc` package that prevented the inherited test command from reaching the real TypeScript compiler.
- Added explicit patched overrides for two vulnerable Prisma transitive tooling dependencies; the registry audit is clean.

### Tests passed

- `pnpm verify`
  - Prettier check
  - ESLint
  - package-boundary check
  - strict TypeScript checks for core and web
  - 6 unit tests
  - 2 integration tests
  - Prisma schema validation
  - framework-independent core build
  - Next.js production build
  - 2 Chromium E2E tests covering the production shell/health route and preserved preview
- `pnpm check:dependencies` — no known vulnerabilities

### Blockers

None for Milestone 0. Neon/Vercel/Auth.js/Sentry resources and secrets remain unprovisioned by design.

### Exact next work item

Start Milestone 1 with the canonical Prisma schema/time-semantics review, then create and test the first migration and deterministic seed on a disposable Neon development branch.

## 2026-09-21 — Milestone 1: IN PROGRESS

### What changed

- Completed the pre-migration entity/field audit against the roadmap and master product specification; recorded it in ADR 0002.
- Corrected PostgreSQL semantics for date-only values, recurring local wall-clock values, and UTC-safe instants.
- Added direct user scope and ownership-safe composite relations, history-preserving deletion behavior, typed planning preferences, scoped external identities, provenance, and the missing `RecurringWorkRule`.
- Kept Assessment submission distinct from Task work completion and separated original/current/remaining/actual duration meanings.
- Aligned framework-independent domain terminology without importing Prisma types.

### Tests passed

- Prisma format and validation pass for the corrected schema.
- `pnpm verify` passes: formatting, ESLint, package boundaries, strict core/web TypeScript, 6 unit tests, 2 integration tests, Prisma validation, core/Next.js production builds, and 2 Chromium E2E tests.
- The local host reported Node 24.19.0/pnpm 11.19.0 below the repository-pinned Node 24.21.0/pnpm 12.5.1 versions; this produced engine warnings but no check failures.

### Blockers

None. Migration history remains absent by design for this slice.

### Exact next work item

Establish the first source-controlled Prisma migration against disposable Neon.

## 2026-09-21 — Milestone 1 migration slice: COMPLETE

Milestone 1 remains **IN PROGRESS**; its gate has not passed because seed and repository work remain.

### What changed

- Generated and inspected `0001_canonical_foundation` from the audited schema.
- Added named PostgreSQL checks for invariants Prisma cannot model and tightened external-map provider ownership with a composite foreign key.
- Added explicit generation/create/deploy/status/bootstrap commands, a guarded destructive verifier, migration SQL regression tests, and connection/reset documentation.
- Confirmed the migration contains no connection string or credentials.
- Created disposable Neon branch `milestone-1-migration-bootstrap-20260921` and empty database `up_m1_migration_20260921`; the database is retained for the next seed slice.

### Tests passed

- Prisma format, validation, and client generation pass.
- `pnpm db:bootstrap:verify` resets the guarded empty target, applies only source-controlled migration history, reports the database current, detects no Prisma-representable drift, and successfully introspects the result.
- `pnpm verify` passes: formatting, ESLint, package boundaries, strict core/web TypeScript, 19 unit tests, 6 integration tests (including migration SQL and destructive guards), Prisma validation, core/Next.js production builds, and 2 Chromium E2E tests.
- `pnpm check:dependencies` reports no known vulnerabilities.

### Blockers

None for this slice. Milestone 1 is not gate-passed because deterministic seed data, repositories, and remaining database integration tests are not implemented.

### Exact next work item

Create the deterministic synthetic semester seed and verify it against the retained disposable Neon database.

## 2026-09-21 — Milestone 1 deterministic seed slice: COMPLETE

Milestone 1 remains **IN PROGRESS**; its gate has not passed because persistence/repository work remains.

### What changed

- Added an entirely synthetic Fall 2026 engineering semester with fixed IDs, dates, instants, local Toronto wall-clock recurrence, and no randomness or private data.
- Represented every requested canonical entity except `PlannerRun`, intentionally omitted because no Planner Service exists yet; user-generated session history covers locks, completion, and supersession without inventing a planner execution.
- Added idempotent fixed-ID upserts, an ergonomic `pnpm db:seed` command, relational integrity assertions, and a non-destructive `pnpm db:bootstrap:seed` migrate/deploy/seed verifier.
- Guarded seed execution by environment, exact confirmation, direct connection, approved host, and unmistakable disposable database name.
- Documented fixture policy, repeat behavior, and guarded clean recreation.
- Created and retained empty disposable database `up_m1_seed_20260921` on Neon branch `milestone-1-migration-bootstrap-20260921` for the proof and next persistence slice.

### Tests passed

- Empty database → `prisma migrate deploy` → seed → integrity assertions passed.
- A second seed and the full assertions passed with unchanged record counts, proving idempotent repeat behavior.
- Assertions verify ownership, parent/subtask and dependency links, work-session history, completion linkage, null estimates/deadlines, date-only and local-time round trips, recurrence fields, credential-free disconnected integration metadata, and external identity uniqueness.
- `pnpm verify` passes: formatting, ESLint, package boundaries, strict core/web TypeScript, 19 unit tests, 13 integration tests, Prisma validation, core/Next.js production builds, and 2 Chromium E2E tests.
- `pnpm check:dependencies` reports no known vulnerabilities.

### Blockers

None for this slice. Milestone 1 is not gate-passed because the persistence/repository boundary and remaining database integration tests are not implemented.

### Exact next work item

Implement and test the persistence/repository boundary over the canonical Prisma model.

## 2026-09-21 — Milestone 1 time foundation: COMPLETE

Milestone 1 remains **IN PROGRESS**; its gate has not passed.

### What changed

- Centralized canonical half-open interval creation, overlap, containment, intersection, merge, normalization, subtraction, deterministic ordering, and window splitting in `packages/shared`.
- Added strict elapsed-minute calculations, five-minute scheduling-quantum helpers, calendar-date arithmetic, explicit IANA timezone conversion, and local representations with offsets.
- Added bounded daily/weekly recurrence expansion that reconstructs each occurrence from wall-clock time and timezone, preserving Toronto local time across DST.
- Documented deterministic DST policy in ADR 0002: ambiguous times choose earlier by default with later/reject options; direct nonexistent times reject, while recurrence skips nonexistent occurrences unless strict rejection is requested.
- Refactored planner-core to consume shared intersection/subtraction logic without changing scheduling policy.
- Added no external dependency: native `Date` and `Intl.DateTimeFormat` are normalized behind the shared API. Domain now declares its internal workspace dependency on `shared` so the time vocabulary has one owner.

### Tests passed

- 13 focused shared-time unit tests, including Toronto's 2026 spring-forward and fall-back transitions.
- `pnpm verify` passes: formatting, ESLint, package boundaries, strict core/web TypeScript, 19 total unit tests, 2 integration tests, Prisma validation, core/Next.js production builds, and 2 Chromium E2E tests.

### Blockers

None. Migration history remains intentionally absent.

### Exact next work item

Establish the first source-controlled Prisma migration against disposable Neon.

## 2026-09-22 — Milestone 1 persistence boundary slice: COMPLETE

Milestone 1 remains **IN PROGRESS**; the final exit gate and PR are still outstanding.

### What changed

- Added the server-only production database client with development hot-reload reuse, production process reuse, explicit test construction, and an ambient production-connection guard during tests.
- Added explicit user-scoped repositories for all 19 canonical entities, grouped by domain vocabulary rather than a generic base abstraction.
- Added a transaction context that binds all repositories to one Prisma transaction and allows failures to propagate for full rollback.
- Added plain record contracts and deliberate temporal/decimal/JSON mapping so Prisma-generated types remain database-package implementation details.
- Added structured constraint-error inspection and strengthened package boundaries so domain, planner-core, web, and other packages cannot import Prisma or pg.
- Documented the persistence boundary, connection lifecycle, ownership strategy, transaction behavior, and guarded live-test procedure.

### Tests passed

- Repository integration tests against disposable Neon cover the deterministic seed, all canonical repository families, create/read/update/archive behavior, cross-user scoping, task hierarchy/dependencies, work-session supersession, JSON, date-only and instant round trips, external-identity uniqueness, and forced transaction rollback.
- Static integration checks confirm the public contracts do not expose Prisma types and downstream packages do not depend on the database package.
- `pnpm verify` passes: formatting, ESLint, package boundaries, strict core/database/web TypeScript, 19 unit tests, 15 integration tests, Prisma validation, core/database/Next.js production builds, and 2 Chromium E2E tests.
- The guarded live Neon repository suite passes 4 tests, and `pnpm check:dependencies` reports no known vulnerabilities.

### Blockers

None for this slice. Authentication, authorization, application services, API routes, planner persistence, integrations, and production UI data loading remain deliberately outside Milestone 1.

### Exact next work item

Run the full Milestone-1 exit-gate verification and open the Milestone-1 PR.

## 2026-09-22 — Milestone 1: GATE PASSED

Every literal Milestone-1 exit criterion is satisfied. The detailed evidence and residual-risk review are recorded in [Milestone 1 exit gate](./milestone-1-exit-gate.md).

### Final fixes

- Removed the final host-local time dependency from planner-core: late-work policy now converts instants using the user's explicit IANA timezone through `packages/shared`.
- Split nullable canonical `Task` facts from the validated `PlannableTask` input so unknown estimates remain unknown until a later application service deliberately resolves them.
- Added explicit bounded transaction startup/runtime limits to the atomic seed after a fresh-Neon reproducibility run exposed a transient transaction-start timeout.

### Exit-gate proof

- Migration `0001_canonical_foundation` deployed from zero and reported current on fresh database `up_m1_seed_final_20260922`; drift comparison reported no difference and introspection succeeded.
- The deterministic synthetic semester seeded successfully, all four live repository integration tests passed, and fixture integrity assertions passed.
- A second untouched blank database, `up_m1_seed_final_repro_20260922`, independently deployed migration history, reported current, seeded, passed integrity assertions, and repeated the idempotent seed plus assertions successfully.
- Toronto spring-forward, fall-back, ambiguous/nonexistent local-time, recurrence, interval algebra, and explicit planner-timezone tests passed.
- Repository-wide searches and package checks found no Prisma access outside `packages/database`, production fixture imports, committed credentials, Milestone-2 implementation, or competing wall-clock implementation.
- `pnpm verify` passed formatting, ESLint, package boundaries, strict core/database/web TypeScript, 20 unit tests, 15 integration tests, Prisma validation, core/database/Next.js production builds, and 2 Chromium E2E tests.
- Prisma formatting and client generation passed; the guarded live Neon repository suite passed 4 tests; `pnpm check:dependencies` reported no known vulnerabilities.

### Remaining known risks

- Authorization enforcement, trusted request validation, dependency-cycle validation, and application error mapping belong to Milestone 2; the schema and repositories are authorization-ready but do not impersonate those services.
- The canonical recurrence implementation intentionally supports the documented MVP daily/weekly subset. Provider-specific recurrence translation remains integration work.
- The disposable acceptance branch contains synthetic data only and expires automatically on 2026-09-29.

### Exact next work item

Begin **Milestone 2 — Authentication, Authorization, Validation, and Application Services** after this milestone's pull request is reviewed and merged.
