# Personal University Planning System

First runnable implementation of the approved **University Planner** product, grounded only in the master specification and the approved UI mockups.

## What this build contains

### Runnable browser application

`preview/` is a dependency-free implementation of the approved interface and interaction contract. It currently includes:

- Today — desktop + mobile
- Week — desktop seven-column planner + mobile day agenda
- Upcoming + Assessment Detail
- Inbox + Quick Capture
- Planner command palette + contextual panel
- Saturday-off Scenario Preview with explicit Apply/Cancel boundary
- Conflict Resolution
- Course Detail
- Calendar & Availability
- Integrations
- Settings
- Onboarding
- light/dark themes
- keyboard shortcuts
- reduced-motion support
- responsive desktop/tablet/mobile behavior

Implemented interactions include complete, partial/skip paths, lock/unlock, quick capture, planner commands, scenario preview/apply, assessment/session detail, conflict resolution, theme switching, and navigation shortcuts.

The visual fixture data intentionally mirrors the approved mockups; it is demonstration state, not claimed live university data.

### Framework-independent product core

- `packages/domain` — canonical planner types and domain vocabulary.
- `packages/shared` — centralized interval/date utilities used by the planner.
- `packages/planner-core` — deterministic scheduling, pressure/slack calculation, candidate windows, session splitting, validation, explicit infeasibility, and non-mutating protected-time simulation.
- `packages/analytics` — conservative estimate-learning baseline from factual completion observations.
- `packages/integrations` — provider-neutral academic-source adapter contract.
- `packages/assistant` — structured Planner intent/mutation boundary; natural language never writes canonical state directly.
- `packages/database/prisma/schema.prisma` — production PostgreSQL/Prisma canonical schema from the technical specification.

## Run the UI now

The preview itself has no npm dependencies.

### Windows PowerShell

```powershell
.\scripts\serve-preview.ps1
```

### macOS / Linux

```bash
./scripts/serve-preview.sh
```

Then open:

```text
http://localhost:4173
```

You can also use any static HTTP server pointed at `preview/`.

## Keyboard shortcuts

- `Ctrl/Cmd + K` — Search / Ask Planner
- `N` — Quick capture
- `G`, then `T` — Today
- `G`, then `W` — Week
- `G`, then `U` — Upcoming
- `G`, then `I` — Inbox
- `D` — Complete selected work
- `M` — Move selected work
- `L` — Lock/unlock selected session
- `Esc` — Close panel/dialog/command surface

Shortcuts do not fire while typing into editable fields.

## Validate the core

In the build environment, the complete check is:

```bash
npm run check
```

It currently passes:

- TypeScript compilation for framework-independent packages
- planner invariant tests
- estimate-learning tests
- JavaScript syntax validation
- browser UI smoke tests

The browser smoke suite checks the approved core flows and responsive Week transformation.

## Why `preview/` exists instead of a running Next app

The master specification selects Next.js + TypeScript, PostgreSQL, Prisma, Zod, Auth.js, Motion.dev, and owned shadcn primitives for production.

This execution environment could not reach the npm registry, so those packages could not be installed or honestly executed here. Rather than silently substitute another product stack, this repository does two things:

1. keeps the product/domain/planner/database contracts framework-independent and production-oriented;
2. provides a dependency-free browser implementation so the approved experience is runnable and testable immediately.

`apps/web/README.md` records the frozen port order into the production Next client once package installation is available. The static UI is not intended to become a second source of product truth.

## What is *not* falsely claimed as complete

The following production infrastructure is specified and scaffolded, but not connected in this runtime:

- live PostgreSQL persistence/migrations
- Auth.js authentication
- Google Calendar/Quercus/Drive provider implementations
- server-side application service/API layer
- actual Next.js runtime
- Motion.dev runtime animations
- production deployment/monitoring

The current browser application uses in-memory fixture state from the approved visual designs. The production implementation must connect the exact same view/interaction contracts to canonical services rather than hardcoded schedules.

## Source boundary

See [`SOURCE_BOUNDARY.md`](SOURCE_BOUNDARY.md). No outside product/design requirements were introduced into this implementation.
