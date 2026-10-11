# Production web application

This package is the production Next.js App Router boundary for Milestones 0–6: protected pages, service-backed read models, onboarding, manual management and reviewed Inbox resolution. Route handlers and server actions adapt requests to `src/server/application`; services derive the actor, validate ownership and commit conditional transactions before reporting success. Post-commit planning has a separate outcome.

Local Next.js environment files belong in this directory. Use the root commands and [environment guide](../../docs/environments.md). The approved preview remains isolated under `prototypes/approved-preview`; production does not import its data. Execution outcomes and dynamic replanning are Milestone 7 and have not started.
