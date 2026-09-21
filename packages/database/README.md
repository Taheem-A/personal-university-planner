# Database package

The production persistence target in the master specification is PostgreSQL through Prisma.

`prisma/schema.prisma` encodes the canonical entities and relationships specified in the technical/domain documents. It is intentionally not migrated in this runtime because the Prisma package and a PostgreSQL database are not available here.

When the production dependency environment is available:

1. Install Prisma + the generated client in this package.
2. Set `DATABASE_URL` to the selected managed PostgreSQL environment.
3. Validate/format the schema.
4. Create the initial source-controlled migration.
5. Load deterministic seed fixtures separate from real private university data.
6. Run authorization/service integration tests before connecting the UI to canonical writes.

Generated `WorkSession` rows are derived plan state; canonical academic facts, overrides, completion records, and external mappings are not disposable.
