# ADR 0007 — Production UI shell and route state

Status: accepted for the Milestone-5 foundation slice. Date: 2026-09-24.

## Decision

The protected App Router route group owns the University Planner shell. Its server layout calls the existing Auth.js identity boundary before rendering any planner UI. Signed-out visitors are redirected to `/sign-in`, which offers the existing Google provider. The root redirects to `/today`. No client-provided user ID or development auth bypass is accepted.

The eight approved destinations are real URLs: `/today`, `/week`, `/upcoming`, `/inbox`, `/courses`, `/availability`, `/integrations`, and `/settings`. Route bodies can be replaced independently with server read-model calls in later slices. The client shell receives only serializable children and owns navigation, theme and ephemeral responsive controls.

Contextual state uses query parameters on the current route: `assessment=<id>`, `course=<id>`, `panel=planner`, `scenario=<id>`, and `conflict=<id>`. Today also uses `session=<id>` and `task=<id>` for its selected object, after matching the ID against the authenticated Today read model. Opening a context pushes a URL so Back returns to the preceding planning view; closing replaces the current URL without adding an empty-panel history entry. Later screen slices must validate IDs and derive content from authorized services. On desktop, the context is displayed in the right-panel host. On tablet/mobile it becomes a sheet or full-width detail view with the same URL, so browser history and deep links survive the transformation. Only transient menu visibility stays local.

The visual system is one semantic CSS token source in `apps/web/src/app/styles.css`; no second theme or component-library default palette is introduced. Light/dark preference is persisted locally and applied before hydration, falling back to the system preference. Course color is supplementary to visible course code. Motion is limited to panel structure and disabled under reduced-motion preference.

## Consequences

The shell can be verified without fixture schedules. Route bodies remain truthful placeholders until their service-backed slices. Query keys reserve navigation semantics but do not claim that Planner execution, scenario application, assessment detail or capture are implemented. Every later screen must preserve the established URLs and authorization boundary while replacing placeholder content.
