# Deterministic database seed

The development/test seed is an entirely synthetic Fall 2026 engineering semester owned by `packages/database`. It is not derived from any student's schedule, deadlines, calendar, grades, submissions, authentication data, or planning history.

## Fixture policy

- IDs, dates, local times, instants, recurrence rules, and content are fixed in source control.
- No random data, current-time calculations, OAuth credentials, or private identifiers are allowed.
- The fixture uses a single explicitly synthetic user in `America/Toronto` and generic course-style codes.
- `PlannerRun` is intentionally empty because no Planner Service exists yet. User-created work-session history exercises completion, locks, and supersession without claiming a planner ran.
- Re-running the seed is idempotent: fixed-ID upserts restore fixture values and do not delete unrelated records.
- The single coherent seed transaction uses explicit bounded startup/runtime limits so a waking disposable Neon compute can be retried deterministically without weakening atomicity.

## Commands

Use a direct, non-pooled connection to an unmistakably disposable development/test database. The seed refuses production-like targets.

```text
APP_ENV=test
SEED_DATABASE_URL=<direct disposable database URL>
CONFIRM_SYNTHETIC_SEED=LOAD_SYNTHETIC_ENGINEERING_FIXTURE

pnpm db:migrate:deploy
pnpm db:seed
pnpm db:seed:assert
```

`pnpm db:bootstrap:seed` runs migration deployment, migration-status verification, seed, integrity assertions, a second seed, and the assertions again. It is non-destructive and is suitable for an empty disposable database or for repeat-seed verification.

## Database client dependency

Prisma 7 requires a driver adapter for Prisma Client connections. The database package therefore adds the matching pinned `@prisma/adapter-pg` 7.10.0 adapter (Apache-2.0) and direct `pg` 8.23.0 driver (MIT). They are database-only runtime dependencies; no UI, planner, or domain package imports them.

## Recreate from zero

The preferred clean workflow is to create a new empty disposable Neon database named `up_m1_seed_<suffix>`, then run `pnpm db:bootstrap:seed` with the variables above.

To reset an existing dedicated seed database, use the separately guarded migration bootstrap first:

```text
APP_ENV=test
MIGRATION_TEST_DATABASE_URL=<same direct disposable database URL>
CONFIRM_DISPOSABLE_DATABASE=RESET_MILESTONE_1_DATABASE

pnpm db:bootstrap:verify
```

That command destroys all data in the target and therefore requires explicit Prisma user consent. It accepts only direct Neon databases named `up_m1_migration_*` or `up_m1_seed_*`. After it succeeds, run the seed commands above. Never reset a shared development, preview, or production database.

## Integrity proof

The assertion command checks expected per-entity counts, direct ownership, parent/subtask and finish-to-start links, session supersession and completion history, null/unknown estimate semantics, date-only and local-time round trips, recurrence fields, disconnected external identity without credentials, and provider/external-ID uniqueness.
