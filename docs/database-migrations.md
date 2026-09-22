# Database migrations

Prisma migration history under `packages/database/prisma/migrations` is the only source of production schema history. `prisma db push` is not a migration workflow: it does not produce reviewable, replayable SQL and must not be used to establish or advance shared environments.

## Connection boundaries

- `DATABASE_URL` is the application/runtime connection. On Neon-hosted serverless deployments this is normally the pooled endpoint whose hostname contains `-pooler`.
- `MIGRATION_DATABASE_URL` is the preferred Prisma CLI connection. It must be a direct Neon connection with no `-pooler` hostname.
- `DATABASE_URL_UNPOOLED` is the Neon CLI's standard direct-connection name and is the migration fallback when `MIGRATION_DATABASE_URL` is absent.
- `MIGRATION_TEST_DATABASE_URL` is used only by the destructive zero-to-current verifier. It is never a runtime URL.

Connection strings are secrets. Keep them in ignored local environment files or the deployment secret store; never commit or print them.

## Commands

From the repository root:

```text
pnpm db:generate
pnpm db:validate
pnpm db:migrate:create -- --name <migration_name>
pnpm db:migrate:deploy
pnpm db:migrate:status
```

Migration creation and deployment require a direct connection. Production and preview deploy migration history with `db:migrate:deploy`; they do not use `migrate dev`, `migrate reset`, or `db push`.

## Zero-to-current verification

Provision or select an empty disposable Neon development branch and create a dedicated database whose name starts with `up_m1_migration_` or `up_m1_seed_`. Then inject these values into one test process:

```text
APP_ENV=test
MIGRATION_TEST_DATABASE_URL=<direct disposable Neon database URL>
CONFIRM_DISPOSABLE_DATABASE=RESET_MILESTONE_1_DATABASE
```

Run:

```text
pnpm db:bootstrap:verify
```

The verifier refuses pooled endpoints, non-Neon hosts, ordinary database names, non-test environments, a missing confirmation, and a URL equal to the runtime or ordinary migration URL. It then:

1. resets the dedicated database to empty and applies only source-controlled migrations;
2. checks migration status;
3. checks Prisma-representable schema drift;
4. proves the migrated database can be introspected.

The script destroys all data in its target. Development reset is permitted only for a dedicated disposable database matching the guard above. Never run it against a shared development, preview, or production database.

## Initial migration

`0001_canonical_foundation` is generated from the audited canonical Prisma schema. Its SQL is manually extended with named PostgreSQL `CHECK` constraints for temporal ordering, interval validity, nonnegative durations, range limits, dependency self-edges, and other invariants Prisma cannot express in its data model.
