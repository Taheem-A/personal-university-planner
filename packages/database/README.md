# Database package

This package owns the PostgreSQL/Prisma persistence boundary and the existing production-oriented schema scaffold.

Milestone 1 established the canonical schema, migration `0001_canonical_foundation`, a deterministic synthetic semester seed, and the production persistence boundary. Database commands, safety boundaries, and clean recreation are documented in `docs/database-migrations.md`, `docs/database-seeding.md`, and `docs/database-persistence-boundary.md`.

Applications import only the package root. It exposes a server-only database handle, explicit repositories, plain record contracts, transactions, and structured constraint-error inspection. Prisma clients, generated model/input types, and mapping details remain package-private.
