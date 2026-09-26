# ADR 0010 — Milestone 6 UI mutation boundary and timezone

- Status: Accepted for the Milestone 6 foundation slice
- Date: 2026-09-26

## Decision

UI forms submit bounded same-origin JSON to `/api/v1` adapters. Adapters call one authenticated application service and map a structured result. Ownership, validation, concurrency and planning triggers remain in the M2/M4 service layers. Client success requires an explicit persisted response shape; a failed post-commit PlannerRun is shown separately from the saved fact. UI error copy uses a fixed code vocabulary and does not display server diagnostics.

Auth.js provisions a new user with `America/Toronto`. Settings and the first onboarding step can change that timezone through an actor-scoped application service. The current timezone is the compare-and-write token because User has no general profile version; a conditional repository update reports `STALE` when it changed. Migration-owned planning revision triggers invalidate concurrent PlannerRuns, and the existing M4 trigger runs after the factual transaction. Stored UTC instants remain unchanged. Recurring rules retain their own explicit timezone and are not silently shifted when the account timezone changes.

Editor projections carry only authorized canonical IDs, versions and exact form values. Ordinary presentation projections are not expanded into repository dumps. Later M6 workflows use the same form, transport and service pattern.
