# Implementation status

## Current active milestone

**Milestone 1 — Canonical Domain, Database, Time, and Migrations: NOT STARTED**

Milestone 0 passed its repository/toolchain gate on 2026-09-21. The production application is intentionally still a bootstrap shell; the approved interactive product remains a non-production regression reference.

## Production bootstrap now implemented

- Real Next.js App Router application at `apps/web` with strict TypeScript and a health endpoint.
- pnpm modular-monolith workspace covering web, database, planner-core, domain, integrations, assistant, analytics, and shared packages.
- Node.js 24.21.0 LTS and pnpm 12.5.1 pinned across local version files, package metadata, and CI.
- Typed development/preview/production environment validation and a complete secret-free `.env.example`.
- Formatting, lint, package-boundary, typecheck, unit, integration, Prisma validation, production build, and browser/E2E commands.
- GitHub Actions CI plus dependency/license review.
- Registry audit passes at the configured high-severity gate; patched transitive Prisma tooling versions are pinned explicitly.
- Neon, Vercel, Google-only Auth.js, and Sentry decisions recorded; explicit background jobs deferred to the first asynchronous integration.
- Existing planner/domain/shared/integration/assistant/analytics sources preserved and built as the framework-independent core.
- Static preview isolated under `prototypes/approved-preview`; approved screenshots and QA captures isolated under `docs/regression-reference`.
- Generated `dist` output removed from version control; tests build it locally before execution.

## Verified at this milestone

- Existing six planner and estimate-learning unit tests pass.
- Workspace and real-source package-boundary integration tests pass.
- Prisma 7 validates the existing PostgreSQL schema through `prisma.config.ts`.
- Next.js production build completes and emits `/` plus `/api/health`.
- Playwright boots the real Next.js app and exercises the preserved interactive preview.
- The full `pnpm verify` command passes.
- `pnpm check:dependencies` reports no known vulnerabilities.

## Deliberately not implemented

- Live PostgreSQL provisioning, first migration, seed data, or repository layer.
- Auth.js runtime and user isolation.
- Application services or canonical state writes.
- Production UI migration from the approved preview.
- Google Calendar, Quercus/LMS, assistant execution, advanced optimization, background jobs, or microservices.

## Blockers

None for the Milestone-0 gate. Managed service projects and credentials are intentionally not provisioned by this repository commit.

## Exact next work item

Begin Milestone 1 by reviewing `packages/database/prisma/schema.prisma` against the canonical entity/time semantics, then create the first source-controlled Prisma migration and prove zero-to-current migration plus deterministic seed bootstrap against a disposable Neon development branch.
