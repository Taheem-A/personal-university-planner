# Personal University Planning System

Production implementation of the approved **University Planner** product.

The repository now has two intentionally separate surfaces:

- `apps/web` — the real Next.js production application boundary.
- `preview/` — the approved dependency-light interactive preview kept only as a visual/interaction regression reference.

The preview is not canonical application state and production routes must never depend on its fixture schedule.

## Architecture

- Next.js + TypeScript modular monolith
- PostgreSQL canonical persistence
- Prisma ORM
- Zod runtime validation
- Auth.js authentication
- isolated deterministic `packages/planner-core`
- provider adapters in `packages/integrations`
- structured assistant boundary in `packages/assistant`

The database is canonical state. Generated work sessions are derived/reconstructable. AI may interpret and explain, but deterministic application/planner logic owns constraints, deadlines, scheduling, and persistence.

## Bootstrap toolchain

- Node.js 24.21.0 LTS
- npm 11.19.0 workspaces
- Next.js 16.3.3 Active LTS
- React 19.3.0
- TypeScript 5.9.3
- Zod 4.6.x
- Playwright for browser/E2E verification

See `docs/decisions/0001-production-bootstrap.md` for provider and architecture decisions.

## Commands

```bash
npm install
npm run dev
npm run verify
```

`npm run dev` boots the production Next.js application.

`npm run verify` runs formatting, linting, strict type checks, package-boundary enforcement, framework-independent unit tests, bootstrap integration tests, production build, and Playwright tests for both the production runtime and approved preview.

The static preview can still be run separately:

```bash
npm run preview
```

## Current milestone

**Milestone 0 — Production Bootstrap and Baseline Preservation: IN PROGRESS.**

The next gate is a clean networked install + green CI. After that, work moves directly to Milestone 1: canonical PostgreSQL/Prisma migrations, repositories, and timezone/DST foundations.
