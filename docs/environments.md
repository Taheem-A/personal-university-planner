# Environment boundaries

The same codebase is promoted through three isolated deployment boundaries.

| Boundary    | `APP_ENV`     | Data                                                                 | Hosting           | Purpose                  |
| ----------- | ------------- | -------------------------------------------------------------------- | ----------------- | ------------------------ |
| Development | `development` | local developer database or isolated Neon dev branch                 | local Next.js     | implementation and tests |
| Preview     | `preview`     | per-preview or shared non-production Neon branch with synthetic data | Vercel preview    | review and E2E           |
| Production  | `production`  | production Neon branch                                               | Vercel production | real user data           |

`APP_ENV` and `NEXT_PUBLIC_APP_ENV` must match. Vercel's `VERCEL_ENV` is accepted as the server-side fallback. Preview and production fail environment validation unless `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` are present. Secrets are never committed or exposed through `NEXT_PUBLIC_*` variables.

Copy `.env.example` to `.env.local` for development. The example contains names and non-secret placeholders only.

Auth.js uses `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and the deployment's `NEXTAUTH_URL` for Google OAuth callbacks (`/api/auth/callback/google`). Google sign-in requests only the OIDC `openid` scope. Configure a distinct OAuth client and callback URL for each deployment. Login does not request Calendar permissions or store Google access/refresh tokens.

`SENTRY_DSN` is optional and server-only. Without it, trusted internal-error capture is disabled (including tests); with it, only a fixed internal-error message is sent, without request bodies, academic content, user identifiers, credentials, or tracing. Never put the DSN in a `NEXT_PUBLIC_*` variable. This is a narrow trusted-error boundary, not a replacement for later observability work.

Prisma CLI operations prefer `MIGRATION_DATABASE_URL` so schema changes use a direct Neon connection; `DATABASE_URL_UNPOOLED` is the Neon-standard fallback. Application runtime uses `DATABASE_URL`, normally pooled on serverless hosts. A final fallback to `DATABASE_URL` exists for non-Neon local development, but migration commands must never receive a Neon `-pooler` endpoint.

The destructive bootstrap verifier uses a separate `MIGRATION_TEST_DATABASE_URL` and strong disposable-database guards. See [database migrations](./database-migrations.md) for commands and reset policy.

Synthetic seed loading uses a separate direct `SEED_DATABASE_URL`, requires `APP_ENV=development` or `test`, and requires an exact confirmation value. See [database seeding](./database-seeding.md) for fixture policy, repeat behavior, and clean recreation.

Repository integration tests use `REPOSITORY_TEST_DATABASE_URL`, never the ambient runtime URL. The URL must be a direct, non-pooler Neon connection to a database whose name begins with `up_m1_seed_`; the test process also requires `APP_ENV=test` and `CONFIRM_REPOSITORY_TEST_DATABASE=RUN_REPOSITORY_INTEGRATION_TESTS`. The database client refuses `getDatabase()` while either `APP_ENV` or `NODE_ENV` is `test`, so tests cannot silently fall through to `DATABASE_URL`.

The guarded Milestone-2 live service test command is `pnpm db:services:verify`. It requires `APP_ENV=test`, `SERVICE_TEST_DATABASE_URL` pointing to a **direct**, non-pooler Neon database named `up_m2_service_*`, and `CONFIRM_SERVICE_TEST_DATABASE=RUN_M2_SERVICE_TESTS`. Deploy migrations to that disposable database first, then run this command. Synthetic users are created and cleaned up by the test. These variables are distinct from application runtime and Milestone-1 repository test URLs.

Milestone-1 final acceptance used the expiring, non-production Neon branch `milestone-1-final-gate-20260922` (`br-red-wave-b5l6p77k`). Its acceptance databases contain synthetic data only, and the branch expires on 2026-09-29.
