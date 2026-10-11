# University Planner

Personal adaptive planner: canonical commitments drive a derived, sustainable schedule. Production is `apps/web`; `prototypes/approved-preview` is a preserved reference.

## Working context

For substantive feature work, reconcile `docs/IMPLEMENTATION_STATUS.md` and `docs/ROADMAP_PROGRESS.md` with the checkout and Git history; status entries and early ADR sections can be historical. Do not treat a schema, interface or UI shell as proof that its workflow is implemented. Read scoped `AGENTS.md` / `AGENTS.override.md` files before editing their subtree.

Respect the active milestone boundary: future-facing stored entities, contracts and disabled controls do not authorize implementing later workflows.

Read only the project material relevant to the task:

- [Master specification](https://docs.google.com/document/d/181-WHJBjtYLUp0902dgDcVE4LhYMOyGDDOaEZespe-8/edit): product, domain, trust and UI contracts.
- [Implementation roadmap](https://docs.google.com/document/d/1kxwNWaoMiWE9cbF2lFPEHQNK2oTYvTtFTqzU9wDl3qI/edit): milestone requirements and exit gates.
- `docs/SOURCE_TRACE.md` and accepted decisions in `docs/decisions/`: implementation mapping and resolved choices.

Written contracts take precedence over decorative mockup details (`SOURCE_BOUNDARY.md`). Surface material code/spec conflicts; do not silently redesign frozen behavior. If Drive is unavailable, use repository evidence and identify any requirement that remains unverified.

## Commands and verification

Run from the repository root. Use Node from `.node-version` and pnpm from `package.json`'s `packageManager`.

| Purpose                                        | Command                                                      |
| ---------------------------------------------- | ------------------------------------------------------------ |
| Install locked dependencies                    | `pnpm install --frozen-lockfile`                             |
| Generate Prisma client / compile core packages | `pnpm db:generate` / `pnpm build:core`                       |
| Run the application                            | `pnpm dev`                                                   |
| Focused unit / integration / browser suites    | `pnpm test:unit` / `pnpm test:integration` / `pnpm test:e2e` |
| Full CI verification                           | `pnpm verify`                                                |
| Dependency changes                             | `pnpm check:dependencies`                                    |

Standalone tests can consume compiled outputs: rebuild affected packages first; `pnpm build` builds the full application. Install Chromium with `pnpm exec playwright install chromium` when needed. Environment setup is in `.env.example` and `docs/environments.md`; preserve existing local secrets.

Use affected tests while iterating; run `pnpm verify` before handing off meaningful code changes. It covers formatting, lint, import boundaries, generation, type checks, unit/integration tests, schema validation, builds and browser tests. Planner scenarios/properties are already included; their focused commands are `pnpm test:planner-scenarios` and `pnpm test:planner-properties`. Docs-only edits need relevant reference/format checks, not an application test run.

`pnpm verify` does not run the guarded live suites in `tests/database/`. For persistence, migration or concurrency changes, select the relevant `db:*:verify` script from `package.json` and read its test guards/runbook first. Use dedicated disposable databases. Report blocked or unrun checks distinctly; default browser fixtures do not prove authenticated database persistence.

## Required architecture and semantics

- Pages, route handlers and actions call `apps/web/src/server/application` services. Reuse `apps/web/src/server/transport.ts` for JSON mutations. Services own authenticated actors, Zod validation, ownership/related-record checks and transactions; never trust client `userId`. Preserve conditional writes and structured safe errors.
- Only `packages/database` imports Prisma/pg. Server services use its public package API; ORM types and direct repository access do not enter transport/client code.
- `packages/planner-core` depends only on domain/shared. Keep it deterministic: explicit facts, time and timezone; no database, network, AI, framework, ambient clock or randomness. `scripts/check-package-boundaries.mjs` enforces dependency directions.
- Assessment is an obligation, Task is effort, WorkSession is allocation. Submission is not task completion. Preserve unknown facts and original estimates; do not invent deadlines or workload to make planning succeed.
- Use `packages/shared/src/time.ts`: UTC instants, separate calendar dates, explicit IANA local recurrence and half-open intervals. Preserve wall-clock recurrence across DST; do not introduce a competing time system.
- Preserve hard constraints, manual/locked intent, workload accounting and explicit infeasibility. Generated sessions go through `apps/web/src/server/application/planner-execution.ts`: validated output, transactional revision claim, idempotency and retained supersession history. Failure leaves the last successful persisted plan authoritative. A committed factual edit and its follow-up replan have separate outcomes.

For changes to these contracts, consult the applicable ADR: `docs/decisions/0002-canonical-domain-and-time-semantics.md`, `0003-auth-identity-boundary.md`, `0004-application-concurrency.md`, `0005-planner-core-v1-contract.md` or `0006-planner-service-input-assembly.md` in the same directory. Planner behavior changes need synthetic regression coverage and an explicit versioning decision.

## Database and generated files

Read `docs/database-migrations.md` before schema operations. Add forward migrations under `packages/database/prisma/migrations`; preserve SQL-owned checks and revision triggers. Do not rewrite applied migrations or replace migration history with `prisma db push`.

Migrations use a direct `MIGRATION_DATABASE_URL` or `DATABASE_URL_UNPOOLED`; pooled `DATABASE_URL` is for runtime. Seeds/live tests have separate URLs and confirmation guards (`docs/database-seeding.md`, `docs/environments.md` and test entry points). `db:bootstrap:verify` destroys its disposable target: obtain explicit reset consent; never reset shared or production data or weaken guards.

Keep secrets out of output, commits and `NEXT_PUBLIC_*`. Use synthetic fixtures. Do not hand-edit `dist/`, `.next/`, generated Prisma client files or `apps/web/next-env.d.ts`. Pin direct dependency additions exactly; follow `docs/dependency-policy.md`.

## UI and completion

Use `apps/web/src/app/styles.css` tokens and `apps/web/src/components/planner-primitives.tsx`. Preserve URL-backed selection/panels, persisted-response-before-success and separate replan feedback; see `docs/decisions/0007-production-ui-shell-and-route-state.md` and `0010-milestone-6-mutation-boundary.md` in that directory. Scenario preview must not mutate canonical state.

Never import preview/test fixture data into production. For UI changes use `docs/milestone-5-visual-qa.md` and `docs/regression-reference/`; check relevant desktop/mobile, light/dark, keyboard/focus, reduced-motion and zoom behavior, including Week's semantic list.

For milestone work, update progress with implementation, verification and merge state kept distinct. Record lasting decisions in `docs/decisions/`. Keep this file's commands and pointers synchronized when their sources change; leave transient task plans and progress in task/status documents.
