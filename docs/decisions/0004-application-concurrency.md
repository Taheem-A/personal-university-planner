# ADR 0004: Trusted application services and conditional Task mutation

- Status: Accepted
- Date: 2026-09-22
- Scope: Milestone 2 service foundation

## Decision

The server-only application area in `apps/web/src/server/application` resolves the authenticated canonical actor, validates untrusted input with Zod, checks user-scoped ownership and nested relations, performs domain checks, and coordinates repository transactions. It maps expected database errors to a small typed result vocabulary. Unknown failures return a generic `INTERNAL_ERROR`, without leaking query details.

Task optimistic concurrency uses a monotonic integer `version` (migration 0003). PostgreSQL stores `updatedAt` with millisecond precision; two separate writes within one millisecond may have indistinguishable timestamps, so an expected timestamp is not a robust compare-and-write token. `updateIfCurrent` conditions on `(id, userId, version)` and atomically increments the version. A miss resolves to `STALE` only when an owned record still exists, otherwise `NOT_FOUND`. Unconditional legacy repository updates also increment the version so they invalidate older clients; public services must use conditional mutation.

The first narrow service, `renameTask`, demonstrates actor → Zod → ownership → transaction → conditional repository update → structured result. Later entity services must apply the same sequence and add versions or another proved concurrency mechanism to their planning-relevant mutations. Task dependency graph validation is a tested primitive; the Task service must run it inside the mutation transaction when dependency creation is implemented.

## Limitations

These primitives do not constitute the complete Milestone-2 service surface or gate. A direct live Prisma repository integration test was unavailable in this environment because the local process cannot reach the Neon endpoint; SQL migrations and constraints were checked through an isolated Neon branch. A real Google OAuth redirect/callback requires deployment credentials, and Playwright E2E awaits a functional Chromium installation.
