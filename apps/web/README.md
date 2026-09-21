# Production web application

This directory is now the real **Next.js + TypeScript** production application boundary.

Milestone 0 intentionally contains only the runtime/bootstrap shell. The approved product UI remains in `../../preview` as a regression reference until the application-service/planner boundaries can supply canonical view models.

## Commands

From the repository root:

```bash
npm run dev
npm run typecheck
npm run build
npm run test:e2e
```

## Frozen production port order

1. Token/theme foundation and IBM Plex configuration.
2. Owned shadcn primitives.
3. AppShell / Sidebar / TopBar / mobile bottom navigation.
4. Domain primitives and schedule blocks.
5. Today.
6. Week + move/lock/detail panel.
7. Upcoming + Assessment detail.
8. Inbox + Quick Capture.
9. Planner command + contextual panel.
10. Scenario + conflict flows.
11. Courses / Availability / Integrations / Settings / Onboarding.
12. Mobile transformations.

Production routes must not import fixture schedule data from `preview/`.
