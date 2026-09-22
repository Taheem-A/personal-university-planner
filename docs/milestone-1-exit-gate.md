# Milestone 1 exit-gate audit

- Status: **Milestone 1 — GATE PASSED**
- Date: 2026-09-22
- Compared range: protected `master` at `bddd116b2d6cf3b97e1745b657aab67e29d134b2` through the Milestone-1 branch
- Migration: `0001_canonical_foundation`

## Roadmap acceptance contract

| Exit criterion                                           | Result | Evidence                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty database migrates from zero to current             | PASS   | Fresh `up_m1_seed_final_20260922` applied the single source-controlled migration with `migrate deploy`; status was current, schema diff reported no difference, and introspection succeeded.                                                                                                                                                                                                              |
| Seed creates a valid sample semester                     | PASS   | The fixed Fall 2026 synthetic fixture loaded with no private data; relational/count assertions passed.                                                                                                                                                                                                                                                                                                    |
| Core repositories round-trip every canonical entity      | PASS   | The live suite reads the deterministic fixture through every repository and transactionally exercises User, AcademicTerm, Course, CourseMeeting, Assessment, Task hierarchy, TaskDependency, RecurringWorkRule, CalendarEvent, AvailabilityRule, ProtectedTimeRule, PlanningPreference, WorkSession, CompletionRecord, EstimateProfile, PlannerRun, IntegrationAccount, ExternalObjectMap, and InboxItem. |
| DST/timezone tests pass                                  | PASS   | Toronto ordinary time, 2026 spring-forward, 2026 fall-back, ambiguous/nonexistent time policies, and wall-clock-stable recurrence pass. Planner late-work policy also has a host-timezone-independence regression.                                                                                                                                                                                        |
| Authorization-ready ownership exists everywhere required | PASS   | Every person-owned table has `userId`; ownership-sensitive relations use composite keys; ordinary repository access requires user scope; cross-user reads and relation integrity are tested.                                                                                                                                                                                                              |
| MVP semantics need no schema redesign                    | PASS   | ADR 0002's entity/field audit covers obligations versus effort, submission versus completion, nullable unknowns, duration history, recurrence, session history, provenance, external identity, and archive/delete behavior. Later services can operate on the model without changing its canonical meanings.                                                                                              |

## Detailed semantic audit

- Assessment submission fields are independent of Task status and CompletionRecord outcomes.
- Task stores original, current/effective, and remaining estimates; CompletionRecord stores observed actual time and the remaining-after snapshot. `EstimateProfile` retains learned aggregate history.
- Nullable canonical Task estimates stay unknown. Planner-core accepts only a deliberately narrowed `PlannableTask` after future application validation.
- WorkSession represents PLANNED, ACTIVE, COMPLETED, PARTIAL, SKIPPED, CANCELLED, and SUPERSEDED; locks and same-owner supersession are explicit.
- Date-only values use PostgreSQL `date`, wall-clock recurrence uses `time(0)` plus IANA timezone, and persisted instants use `timestamptz(3)`.
- External identities are unique per integration account and per user/provider/external ID. Provider/account/user consistency is enforced by a composite foreign key.
- Foreign keys, indexes, uniqueness, nullability, Restrict/Cascade choices, archive fields, and migration-owned checks were reviewed in ADR 0002 and migration SQL tests.
- Task self-parenting and dependency self-edges are database-constrained; cross-user links are prevented relationally. General dependency-cycle policy is intentionally an application-service validation.

## Architecture and repository-wide audit

- `packages/shared` is the sole time-policy implementation: half-open intervals, overlap, containment, intersection, deterministic normalization/merge, subtraction, splitting, minute/quantum helpers, local/UTC conversion, effective bounds, and recurrence expansion.
- planner-core imports domain/shared only and has no database, network, UI, or AI dependency.
- Domain and UI have no Prisma dependency; production routes have no direct database access.
- Prisma and pg imports are confined to `packages/database`; its public contracts expose plain records rather than generated Prisma models.
- No seed/demo fixture is imported by production code. No real connection string, credential, OAuth token, or private student data is committed.
- TODO/FIXME and deferred-work searches found no skipped Milestone-1 criterion. Documented deferrals are Milestone-2 or integration responsibilities.

## Database acceptance runs

Neon branch `milestone-1-final-gate-20260922` (`br-red-wave-b5l6p77k`) is non-production, contains synthetic data only, and expires on 2026-09-29.

Primary blank database `up_m1_seed_final_20260922`:

1. `pnpm db:migrate:deploy` applied `0001_canonical_foundation` from zero.
2. `pnpm db:migrate:status` reported current.
3. `pnpm db:seed` loaded the synthetic semester.
4. `pnpm db:repositories:verify` passed 4/4 tests.
5. `pnpm db:seed:assert` passed all count and relational assertions.
6. Prisma schema diff reported no difference and `db pull --print` introspected successfully.

Reproducibility database `up_m1_seed_final_repro_20260922`:

- `pnpm db:bootstrap:seed` independently deployed from blank, reported current, seeded, asserted integrity, repeated the idempotent seed, and asserted unchanged integrity.
- The destructive reset helper was not bypassed after Prisma requested new explicit consent. Creating untouched blank databases provided the required zero-to-current proof without destructive reset; its refusal/safety guards remain covered by integration tests.

## Final checks

- Prisma format: PASS
- Prisma client generation: PASS
- Clean-checkout verification generates the Prisma client before strict database typechecking, so CI does not rely on developer-machine generated artifacts.
- `pnpm verify`: PASS
  - formatting: PASS
  - ESLint: PASS
  - package boundaries: PASS (32 source files)
  - strict TypeScript: PASS
  - unit: 20/20 PASS
  - integration: 15/15 PASS
  - Prisma validation: PASS
  - core/database/Next.js builds: PASS
  - Chromium E2E: 2/2 PASS
- live database repository suite: 4/4 PASS
- second-database seed bootstrap/repeat: PASS
- `pnpm check:dependencies`: PASS, no known vulnerabilities

## Remaining known risks and next work

Milestone 1 has no blocker. Authentication, authorization, trusted input validation, application services, dependency-cycle validation, and error mapping remain intentionally unimplemented. Provider-specific recurrence translation and conflict resolution remain integration work. These are later-layer responsibilities, not missing schema semantics.

The exact next roadmap milestone is **Milestone 2 — Authentication, Authorization, Validation, and Application Services**. No Milestone-2 implementation is part of this branch.
