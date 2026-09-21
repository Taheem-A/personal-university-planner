# Personal University Planning System

Production monorepo for the University Planner defined by the **Personal University Planning System** specification and its implementation roadmap.

## Repository map

- `apps/web` — real Next.js App Router application.
- `packages/database` — PostgreSQL/Prisma schema boundary.
- `packages/planner-core` — deterministic, framework-independent planning engine.
- `packages/domain` — canonical domain vocabulary.
- `packages/integrations` — provider-neutral integration contracts.
- `packages/assistant` — structured assistant intent boundary.
- `packages/analytics` — conservative estimate learning.
- `packages/shared` — shared interval and time utilities.
- `prototypes/approved-preview` — non-production interactive regression reference.
- `docs/regression-reference` — approved screenshots and QA captures.
- `tests`, `docs`, `scripts` — verification, decisions, and repository tooling.

## Toolchain

Use Node.js `24.21.0` LTS and pnpm `12.5.1`.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

The production shell runs at `http://localhost:3000`. The approved static preview remains available separately:

```bash
pnpm preview:approved
```

## Verification

```bash
pnpm verify
```

That command checks formatting, lint, package boundaries, strict TypeScript, unit tests, integration tests, Prisma schema validity, production build, and Playwright E2E coverage for both the Next.js shell and preserved preview.

See [the bootstrap decision log](docs/decisions/0001-production-bootstrap.md), [environment boundaries](docs/environments.md), and [roadmap progress](docs/ROADMAP_PROGRESS.md).
