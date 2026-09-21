# ADR 0001: Milestone 0 production bootstrap

- Status: Accepted
- Date: 2026-09-21
- Scope: Milestone 0 only

## Context

The frozen architecture requires a TypeScript modular monolith with a Next.js application, PostgreSQL through Prisma, Zod validation, Auth.js, and an isolated deterministic planner core. The inherited repository contained a valuable interactive preview and framework-independent core, but no running production framework or reproducible production toolchain.

## Decisions

1. **Runtime:** Node.js `24.21.0` (Krypton LTS). Node 26 is current, not LTS, on the decision date. The repository pins the LTS patch in `.node-version`, `.nvmrc`, CI, and the root engine range.
2. **Package manager:** pnpm `12.5.1` with workspaces. The exact version is recorded in `packageManager`; the lockfile is authoritative.
3. **Application framework:** Next.js `16.3.5` App Router with React `19.3.0` and TypeScript `6.0.3` in strict mode. TypeScript 7 is available but intentionally deferred until the lint/tooling ecosystem declares compatible peer ranges.
4. **Managed PostgreSQL:** Neon. Use separate branches/databases for development, preview, and production; use a direct connection for migrations and an application connection appropriate to the deployment runtime.
5. **Hosting:** Vercel for preview and production. Preview deployments receive isolated environment values and a non-production Neon branch.
6. **Authentication configuration:** Auth.js with Google OAuth only for the initial release. Passwordless email is deferred because it adds a delivery provider and an additional account-recovery surface without improving the first personal-user flow. Auth implementation remains Milestone 2.
7. **Observability:** Sentry is the selected error-monitoring provider. The Milestone-0 health endpoint and platform logs are active foundations; Sentry SDK wiring is added with the first trusted application-service/error boundary so empty instrumentation is not mistaken for production monitoring.
8. **Background jobs:** no explicit job system in Milestone 0. Synchronous core planning remains in-process. Revisit a durable queue/workflow when the first asynchronous Google Calendar synchronization is designed; do not add infrastructure before a retryable asynchronous workload exists.
9. **Preview preservation:** the static experience lives only at `prototypes/approved-preview`; screenshots live at `docs/regression-reference`. Neither path is a production route or canonical data source.
10. **Boundaries:** `planner-core` may depend only on `domain` and `shared`. It may not import Next.js, React, Prisma, Auth.js, AI SDKs, integrations, or the web app. The checked-in boundary script and CI enforce this rule.
11. **Transitive security pins:** pnpm overrides keep Prisma's transitive `deepmerge-ts` and unused MySQL driver path on patched versions while Prisma 8 remains a release candidate. Remove the overrides once the selected stable Prisma line includes equivalent or newer versions.

## Consequences

- A clean clone has one package-manager workflow and one full verification command.
- Preview and production code can be compared without becoming competing architectures.
- Auth, migrations, persistence services, and Sentry instrumentation are explicit follow-on work, not falsely claimed as complete.
- Choosing managed providers does not authorize provisioning accounts, credentials, databases, or deployments in this milestone.
