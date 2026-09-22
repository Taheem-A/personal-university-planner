# Database package

This package owns the PostgreSQL/Prisma persistence boundary and the existing production-oriented schema scaffold.

Milestone 1 established the canonical schema, migration `0001_canonical_foundation`, and a deterministic synthetic semester seed. Database commands, safety boundaries, and clean recreation are documented in `docs/database-migrations.md` and `docs/database-seeding.md`.
