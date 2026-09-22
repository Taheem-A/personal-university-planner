import { defineConfig } from "prisma/config";

const schemaValidationUrl =
  "postgresql://schema_validation:schema_validation@127.0.0.1:5432/university_planner";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma validate` does not connect. Database-changing commands must use
    // a direct URL; Neon runtime traffic may use the pooled DATABASE_URL.
    url:
      process.env.MIGRATION_DATABASE_URL ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      schemaValidationUrl,
  },
});
