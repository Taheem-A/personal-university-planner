# Database package

This package owns the PostgreSQL/Prisma persistence boundary and the existing production-oriented schema scaffold.

Milestone 0 installs and validates Prisma but deliberately does not create migration history or connect live data. Milestone 1 will review the schema against canonical semantics, establish the first migration, add deterministic seed data, and test clean-database bootstrap against Neon PostgreSQL.
