# ADR 0006 — Planner Service contract and canonical input assembly

Status: Accepted for the first Milestone 4 slice, 2026-09-24.

## Decision

The Planner Service lives in the existing web application-service boundary. It authenticates the actor, validates a typed request, reads canonical planning facts in one PostgreSQL repeatable-read transaction, maps plain database records into the explicit `PlannerInput` contract, and invokes the named `heuristic-v1` core. This slice returns an in-memory output only. PlannerRun and WorkSession persistence, concurrency control for writes, and outcome triggers are the next slice.

The request distinguishes authoritative generation, incremental replan and explicit full replan. It carries an explicit `now`, planner version, trigger provenance, optional released windows and released-time policy. The trigger vocabulary matches the roadmap. Missing and unsupported facts return structured `INPUT_FAILURE` issues. The core remains pure and never reads canonical repositories, environment or clock.

## Snapshot and mapping

`Database.readSnapshot` uses PostgreSQL repeatable-read isolation. The user-scoped planning-state repository bulk-loads only planning-relevant records, with fixed events and active sessions bounded to the near-term read range. This avoids combining facts from different committed states. All records exposed to the application are plain typed records, never Prisma types.

Only active, unarchived academic hierarchy is mapped. Ready and in-progress AUTO tasks enter the planning pool; tasks with retained sessions also enter so user intent is not dropped. Completed IDs satisfy prerequisites without invented estimates. A dependency whose prerequisite is neither completed nor selected fails explicitly. Task due/target dates may use an associated canonical assessment; absent deadlines stay absent. The original estimate must be persisted. A missing current estimate may use that original as an explicitly identified planning fallback, but remaining work and session rules must be explicit. No missing estimate is guessed from a fixture or generic duration. Nullable task energy uses course default or neutral MEDIUM; empty location requirements mean unrestricted ANYWHERE. Unsupported capability tags fail.

Active manual sessions, locked planner sessions and ordinary previous planner sessions are distinct. Superseded and terminal sessions are excluded. Mandatory course meetings become hard recurring events, optional meetings soft events. Informational calendar events and protection rules do not block capacity. Availability and protection remain wall-clock recurrences consumed through shared time utilities by core. A TRANSIT_OK availability tag denotes commute capacity. All persisted instants remain UTC; intervals are half-open, and core rounds candidates to five-minute precision.

## Horizon

Exact planning begins at supplied `now` and ends at the seventh upcoming local midnight in the user's IANA timezone. The first 24 elapsed hours are marked immediate; the remainder is near term. Known task deadlines are surfaced in horizon context. The service does not make exact semester-scale placements. Trigger is retained in the horizon and request contract for later trigger-specific persistence and policy; all supported triggers currently share this bounded exact horizon.

## Minimum sleep and migration

Minimum sleep is a user-owned hard boundary. Migration `0007_planner_sleep_policy` adds nullable `PlanningPreference.minimumSleepMinutes` and `ProtectedTimeRule.isSleep` (default false). Existing preference rows remain unconfigured, and existing protected rules are not guessed to be sleep by their reason text. A user must explicitly set a positive minimum and mark at least one hard protected recurrence as sleep. The service refuses assembly otherwise; planner-core verifies actual expanded sleep duration on complete local days. The migration constrains positive configured values and hard sleep rules. This is the smallest durable mapping that preserves existing data without silently assuming the user's bedtime or sleep need.

## Next slice

**Planner persistence/concurrency substrate.** Add PlannerRun and generated-session persistence, stale-write protection, supersession history, and reloadable plan deltas. Do not infer that this ADR completes Milestone 4 or starts Milestone 5.
