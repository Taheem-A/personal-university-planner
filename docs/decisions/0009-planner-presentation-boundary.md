# ADR 0009 — Planner and onboarding presentation boundary

Status: accepted for the Milestone-5 presentation slice. Date: 2026-09-25.

## Decision

The URL keys reserved by ADR 0007 remain the browser-history source for Planner (`panel=planner`), Scenario (`scenario=preview`) and Conflict (`conflict=overview`) surfaces. Opening pushes a URL; closing replaces only the active surface key, preserving the underlying route and query context. The responsive right panel becomes a full-width sheet on phones, traps focus while open, restores focus on close and removes panel motion for reduced-motion preference.

The Planner and Conflict shells fetch a narrow authenticated, read-only presentation projection from the existing `plannerViews.today` service. It carries only the current planner status, last successful plan timestamp, next work, remaining planned work, persisted risk and persisted warning codes. A failed replan never makes its attempted output authoritative. No assistant package or model interpreter runs in the browser or server route. Search in the panel navigates to existing destinations; unmatched prose is explicitly not executed or saved.

No trusted scenario request/result read service exists at this release boundary. Scenario Preview therefore shows the current plan context and a truthful unprepared comparison state. It never invents moved sessions, deadline effects or capacity gains. Apply is disabled. Cancel/close only changes URL state. Conflict shows stored risk, deficit, slack and warning reason codes; resolution actions are disabled until a trusted service can preview and apply tradeoffs.

The `/onboarding` route projects existing account facts from a user-scoped snapshot and the latest successful planner run. `step=1..6` navigates the approved sequence without treating presentation progress as canonical completion. No browser-only academic facts or successful setup state are persisted.

## Release boundary

- Milestone 6 owns term/course/schedule/availability/workload onboarding and manual CRUD.
- Milestone 7 owns execution outcomes.
- Milestone 8 owns trusted scenario simulation, Apply, conflict tradeoffs, contextual explanations and plan history.
- Milestone 10 owns natural-language Planner interpretation and tool execution.
