# ADR 0001 — Production bootstrap choices

**Status:** Accepted  
**Date:** 2026-09-21  
**Milestone:** 0 — Production Bootstrap and Baseline Preservation

## Context

The roadmap freezes the product architecture as a TypeScript-first modular monolith with Next.js, PostgreSQL, Prisma, Zod, Auth.js, and an isolated deterministic planner core. Milestone 0 must select concrete production/tooling providers without changing product semantics.

## Decisions

- **Authoritative repository:** `Taheem-A/personal-university-planner`. It contains the approved preview, QA references, framework-independent core, tests, and Prisma scaffold. The separate `Taheem-A/University-Planner` repository is empty and is not the implementation source of truth.
- **Runtime:** Node.js **24.21.0 LTS**.
- **Package manager:** npm **11.19.0**, using npm workspaces. This preserves the repository's existing npm history and avoids adding another package-manager concern.
- **Framework:** Next.js **16.3.3 Active LTS**.
- **React:** **19.3.0**.
- **TypeScript:** **5.9.3** for bootstrap compatibility with the selected stable Prisma generation.
- **Runtime validation:** Zod **4.6.x**.
- **ORM generation:** Prisma ORM **7.x** for Milestone 1. Prisma 8 is still a release candidate at this decision date and changes the schema/migration contract materially, so adopting it before the first real migration history would add avoidable risk.
- **Managed PostgreSQL:** **Neon**.
- **Hosting:** **Vercel** for development previews and production.
- **Authentication:** **Auth.js with Google-only sign-in initially**. Google Calendar authorization remains a separate integration concern so authentication credentials do not become calendar-sync authority implicitly.
- **Observability:** **Sentry** is the selected application error-monitoring provider. Full production instrumentation remains deferred to the hardening milestone; no DSN is required to boot locally.
- **Background jobs:** **Deferred** until the first asynchronous integration requires them. Core planning remains synchronous for now.
- **Browser/E2E testing:** Playwright.
- **Formatting/linting:** Prettier + ESLint.

## Consequences

- The approved `preview/` remains a non-production regression reference and must not become a production data source.
- Production screens will be ported only against typed application/service view models.
- Prisma 7 configuration/migrations begin in Milestone 1; no migration is created in this bootstrap change.
- Auth.js wiring begins in Milestone 2; no authentication shortcut is added to Milestone 0.
- Motion/shadcn dependencies are added when the production UI port actually begins rather than preloading unused UI dependencies.
- Quercus/LMS, deep AI automation, and a job queue remain outside the current milestone.
