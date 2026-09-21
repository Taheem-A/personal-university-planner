# Production web boundary

The master specification freezes `apps/web` as the Next.js + TypeScript production client. The current execution environment cannot reach the npm registry, so Next/React/Motion cannot be installed here.

The runnable implementation in `../../preview` is therefore a dependency-free browser implementation of the approved UI and interaction contract. It is intentionally organized around the same view models and domain vocabulary that `apps/web` will consume.

When package installation is available, port in this order from the frozen handoff:

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

The domain and planner packages in this repository are already framework-independent and should be consumed directly by the production application services.
