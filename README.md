# Personal University Planning System

Production monorepo for the University Planner defined by the **Personal University Planning System** specification and its implementation roadmap.

**Milestones 0–6 are complete and merged. Milestone 7 — Execution Outcomes and Dynamic Replanning — is next and has not started.** See [current implementation status](docs/IMPLEMENTATION_STATUS.md), [roadmap history](docs/ROADMAP_PROGRESS.md), and [the stabilization checkpoint](docs/repository-stabilization.md).

## Repository map

- `apps/web` — production Next.js App Router UI, authenticated transport and application services.
- `packages/database` — PostgreSQL/Prisma schema boundary.
- `packages/planner-core` — deterministic, framework-independent planning engine.
- `packages/domain` — canonical domain vocabulary.
- `packages/integrations` — provider-neutral integration contracts.
- `packages/assistant` — preparatory structured intent contracts; no natural-language execution.
- `packages/analytics` — isolated estimate helper; no production learning workflow.
- `packages/shared` — shared interval and time utilities.
- `prototypes/approved-preview` — non-production interactive regression reference.
- `docs/regression-reference` — approved screenshots and QA captures.
- `tests`, `docs`, `scripts` — verification, decisions, and repository tooling.

## Toolchain

Use Node.js `24.21.0` LTS and pnpm `12.5.1`.

```bash
pnpm install --frozen-lockfile
cp .env.example apps/web/.env.local
pnpm db:generate
pnpm dev
```

Configure the app-local environment with non-production credentials before running. Prisma CLI commands receive direct database URLs through the invoking process; they do not load the web app's environment file. The application runs at `http://localhost:3000`. The approved static preview remains available separately:

```bash
pnpm preview:approved
```

## Verification

```bash
pnpm verify
pnpm test:planner-scenarios
pnpm test:planner-properties
pnpm check:dependencies
```

That command checks formatting, lint, package boundaries, strict TypeScript, unit tests, integration tests, Prisma schema validity, production build, and Playwright E2E coverage for both the Next.js shell and preserved preview.

`pnpm verify` includes synthetic repository doubles and embedded PostgreSQL checks, but does not run the guarded live suites. [Environment boundaries](docs/environments.md) list the dedicated disposable database URLs and confirmations for repository, service, planner and authenticated browser proof. Execution outcomes, Scenario Apply, provider synchronization and assistant execution remain later milestones.

See [the bootstrap decision log](docs/decisions/0001-production-bootstrap.md), [environment boundaries](docs/environments.md), and [roadmap progress](docs/ROADMAP_PROGRESS.md).
