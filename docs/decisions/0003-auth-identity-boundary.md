# ADR 0003: Auth identity and application boundary

- Status: Accepted
- Date: 2026-09-22
- Scope: Milestone 2 identity foundation

## Decision

`AuthIdentity` maps `(provider, providerAccountId)` uniquely to one canonical `User`. The initial provider is Google. The provider's stable subject, rather than email or display name, is the ownership key. A user may have multiple identities later; explicit account linking requires its own authenticated, verified flow. No automatic merging by email is allowed.

First-login provisioning inserts the identity and canonical user together with a nested relational write. The database uniqueness constraint serializes concurrent sign-ins; a losing callback reads the winner. Initial timezone is `America/Toronto`, until onboarding changes it. Deleting a user cascades to identity rows only through a future explicit account-deletion operation. Deleting an identity does not delete academic history.

Only the provider name, stable account ID, user link, and creation time are stored. Google access and refresh tokens, email, profile information, and Calendar consent are unnecessary for ordinary login and are not persisted in this mapping. Future Calendar credentials require separate consent, minimum scopes, secure storage, and explicit disconnect semantics in the integration layer.

The application composition root and service boundary live under `apps/web/src/server`. It may import the public `@university-planner/database` package, but route components, client components, handlers, and actions must not import that package or Prisma directly. Handlers and actions will call services. Only `packages/database` imports Prisma/pg. Domain contracts and `planner-core` stay independent of database, Auth.js, and web.

## Consequences

Auth.js can resolve a stable canonical user without coupling planner entities to OAuth implementation. Runtime session plumbing, authorization, validation, and application services are subsequent slices. The identity table contains no calendar permissions or usable Google credential. The database constraint, rather than an application-level read alone, enforces concurrency.
