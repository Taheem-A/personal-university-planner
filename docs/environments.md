# Environment boundaries

The same codebase is promoted through three isolated deployment boundaries.

| Boundary    | `APP_ENV`     | Data                                                                 | Hosting           | Purpose                  |
| ----------- | ------------- | -------------------------------------------------------------------- | ----------------- | ------------------------ |
| Development | `development` | local developer database or isolated Neon dev branch                 | local Next.js     | implementation and tests |
| Preview     | `preview`     | per-preview or shared non-production Neon branch with synthetic data | Vercel preview    | review and E2E           |
| Production  | `production`  | production Neon branch                                               | Vercel production | real user data           |

`APP_ENV` and `NEXT_PUBLIC_APP_ENV` must match. Vercel's `VERCEL_ENV` is accepted as the server-side fallback. Preview and production fail environment validation unless `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` are present. Secrets are never committed or exposed through `NEXT_PUBLIC_*` variables.

Copy `.env.example` to `.env.local` for development. The example contains names and non-secret placeholders only.

Prisma CLI operations prefer `MIGRATION_DATABASE_URL` so schema changes can use a direct Neon connection; application runtime uses `DATABASE_URL`. If the migration variable is absent, the CLI falls back to `DATABASE_URL`.
