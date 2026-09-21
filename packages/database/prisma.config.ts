import { defineConfig } from "prisma/config";

const schemaValidationUrl =
  "postgresql://schema_validation:schema_validation@127.0.0.1:5432/university_planner";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma validate` does not connect. Any migration/database command must
    // receive the real environment-specific DATABASE_URL.
    url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? schemaValidationUrl,
  },
});
