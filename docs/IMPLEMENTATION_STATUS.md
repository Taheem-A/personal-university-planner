# Implementation status

## Implemented and runnable

- Approved application shell and navigation.
- Today, Week, Upcoming, Inbox, Courses, Availability, Integrations, Settings, Onboarding.
- Contextual detail panels, Planner command surface, Scenario Preview, Conflict Resolution.
- Responsive mobile Today and mobile Week agenda.
- Core interaction states and keyboard navigation.
- Deterministic planner-core with validation and explicit infeasibility.
- Non-mutating protected-window scenario simulation.
- Conservative estimate-learning function.
- Canonical PostgreSQL/Prisma schema source.
- Provider-neutral integration and assistant boundaries.

## Verified

- Planner sessions do not overlap hard events in tested scenarios.
- Feasible work is fully scheduled in the canonical test fixture.
- Protected-time scenarios do not mutate canonical input.
- Infeasible work is surfaced with unscheduled minutes.
- Learning does not automatically adapt before three useful observations.
- UI smoke flow covers Today, Week, Scenario, Upcoming detail, Inbox capture, Planner palette, and mobile Week.
- Final desktop/mobile QA screenshots reviewed against the approved visual direction.

## Scaffolded but awaiting production dependencies/services

- Next.js application runtime.
- Auth.js.
- Prisma client + first database migration against actual PostgreSQL.
- Zod transport validation.
- Google Calendar and LMS adapter implementations.
- Motion.dev implementation of the frozen motion contract.
- shadcn-owned primitive layer.
- deployment/monitoring/background jobs.

## Production continuation order

1. Install/freeze production dependencies.
2. Validate Prisma schema and create the first migration.
3. Implement authenticated application/service layer around canonical state.
4. Port the approved shell/components from `preview/` into `apps/web` using the frozen token/component contracts.
5. Connect Today and Week view models to real services/planner output.
6. Implement complete/partial/skip/move/lock transactions.
7. Implement Inbox/Assessment/Course CRUD.
8. Add Planner structured tool layer and scenario API.
9. Add Google Calendar read sync before deeper LMS automation.
10. Run the full acceptance/security/accessibility suite before production trust.
