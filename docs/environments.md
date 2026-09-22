# Environment boundaries

The same codebase is promoted through three isolated deployment boundaries.

| Boundary    | `APP_ENV`     | Data                                                                 | Hosting           | Purpose                  |
| ----------- | ------------- | -------------------------------------------------------------------- | ----------------- | ------------------------ |
| Development | `development` | local developer database or isolated Neon dev branch                 | local Next.js     | implementation and tests |
| Preview     | `preview`     | per-preview or shared non-production Neon branch with synthetic data | Vercel preview    | review and E2E           |
| Production  | `production`  | production Neon branch                                               | Vercel production | real user data           |

`APP_ENV` and `NEXT_PUBLIC_APP_ENV` must match. Vercel's `VERCEL_ENV` is accepted as the server-side fallback. Preview and production fail environment validation unless `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` are present. Secrets are never committed or exposed through `NEXT_PUBLIC_*` variables.

Copy `.env.example` to `.env.local` for development. The example contains names and non-secret placeholders only.

Prisma CLI operations prefer `MIGRATION_DATABASE_URL` so schema changes use a direct Neon connection; `DATABASE_URL_UNPOOLED` is the Neon-standard fallback. Application runtime uses `DATABASE_URL`, normally pooled on serverless hosts. A final fallback to `DATABASE_URL` exists for non-Neon local development, but migration commands must never receive a Neon `-pooler` endpoint.

The destructive bootstrap verifier uses a separate `MIGRATION_TEST_DATABASE_URL` and strong disposable-database guards. See [database migrations](./database-migrations.md) for commands and reset policy.

Synthetic seed loading uses a separate direct `SEED_DATABASE_URL`, requires `APP_ENV=development` or `test`, and requires an exact confirmation value. See [database seeding](./database-seeding.md) for fixture policy, repeat behavior, and clean recreation.

Repository integration tests use `REPOSITORY_TEST_DATABASE_URL`, never the ambient runtime URL. The URL must be a direct, non-pooler Neon connection to a database whose name begins with `up_m1_seed_`; the test process also requires `APP_ENV=test` and `CONFIRM_REPOSITORY_TEST_DATABASE=RUN_REPOSITORY_INTEGRATION_TESTS`. The database client refuses `getDatabase()` while either `APP_ENV` or `NODE_ENV` is `test`, so tests cannot silently fall through to `DATABASE_URL`.

Milestone-1 final acceptance used the expiring, non-production Neon branch `milestone-1-final-gate-20260922` (`br-red-wave-b5l6p77k`). Its acceptance databases contain synthetic data only, and the branch expires on 2026-09-29.
