# ADR 0006 — Planner Service contract and canonical input assembly

Status: Accepted for the first Milestone 4 slice, 2026-09-24.

## Decision

The Planner Service lives in the existing web application-service boundary. It authenticates the actor, validates a typed request, reads canonical planning facts in one PostgreSQL repeatable-read transaction, maps plain database records into the explicit `PlannerInput` contract, and invokes the named `heuristic-v1` core. Later sections record the subsequent persistence and execution decisions.

The request distinguishes authoritative generation, incremental replan and explicit full replan. It carries an explicit `now`, planner version, trigger provenance, optional released windows and released-time policy. The trigger vocabulary matches the roadmap. Missing and unsupported facts return structured `INPUT_FAILURE` issues. The core remains pure and never reads canonical repositories, environment or clock.

## Snapshot and mapping

`Database.readSnapshot` uses PostgreSQL repeatable-read isolation. The user-scoped planning-state repository bulk-loads only planning-relevant records, with fixed events and active sessions bounded to the near-term read range. This avoids combining facts from different committed states. All records exposed to the application are plain typed records, never Prisma types.

Only active, unarchived academic hierarchy is mapped. Ready and in-progress AUTO tasks enter the planning pool; tasks with retained sessions also enter so user intent is not dropped. Completed IDs satisfy prerequisites without invented estimates. A dependency whose prerequisite is neither completed nor selected fails explicitly. Task due/target dates may use an associated canonical assessment; absent deadlines stay absent. The original estimate must be persisted. A missing current estimate may use that original as an explicitly identified planning fallback, but remaining work and session rules must be explicit. No missing estimate is guessed from a fixture or generic duration. Nullable task energy uses course default or neutral MEDIUM; empty location requirements mean unrestricted ANYWHERE. Unsupported capability tags fail.

Active manual sessions, locked planner sessions and ordinary previous planner sessions are distinct. Superseded and terminal sessions are excluded. Mandatory course meetings become hard recurring events, optional meetings soft events. Informational calendar events and protection rules do not block capacity. Availability and protection remain wall-clock recurrences consumed through shared time utilities by core. A TRANSIT_OK availability tag denotes commute capacity. All persisted instants remain UTC; intervals are half-open, and core rounds candidates to five-minute precision.

## Horizon

Exact planning begins at supplied `now` and ends at the seventh upcoming local midnight in the user's IANA timezone. The first 24 elapsed hours are marked immediate; the remainder is near term. Known task deadlines are surfaced in horizon context. The service does not make exact semester-scale placements. Trigger is retained in the horizon and request contract for later trigger-specific persistence and policy; all supported triggers currently share this bounded exact horizon.

## Minimum sleep and migration

Minimum sleep is a user-owned hard boundary. Migration `0007_planner_sleep_policy` adds nullable `PlanningPreference.minimumSleepMinutes` and `ProtectedTimeRule.isSleep` (default false). Existing preference rows remain unconfigured, and existing protected rules are not guessed to be sleep by their reason text. A user must explicitly set a positive minimum and mark at least one hard protected recurrence as sleep. The service refuses assembly otherwise; planner-core verifies actual expanded sleep duration on complete local days. The migration constrains positive configured values and hard sleep rules. This is the smallest durable mapping that preserves existing data without silently assuming the user's bedtime or sleep need.

## Milestone 4 persistence and concurrency substrate

Migration `0008_planner_authority_substrate` adds a per-user `User.planningRevision` integer. The snapshot loader returns this value alongside `PlannerInput`. PostgreSQL triggers increment it for inserts, deletes and planning-field updates to academic terms, courses, meetings, assessments, tasks, dependencies, fixed calendar events, availability, protected/sleep rules, preferences, active session history and completion records. User timezone/day-bound changes increment it too. Profile name/locale, task title/description, course display text, inbox, integration connection metadata, estimate profiles and PlannerRun metadata do not invalidate it. An integration that changes canonical events or tasks invalidates through those records. Recurring-work rule edits do not enter `PlannerInput` until they materialize task instances.

The next authoritative write transaction must call `planningState.claimRevision(userId, snapshotRevision)` before changing plan state. It performs a conditional update of that user's row and returns `CLAIMED`, `STALE` or `NOT_FOUND`. PostgreSQL row locking serializes competing claims for one user; another user's row is independent. A canonical mutation racing with the claim also updates the same row through a trigger, so one side wins and the other sees a changed revision or commits afterward. The claim, PlannerRun completion, session creation and supersession must share one database transaction. A failed transaction rolls back the claim and all writes. This mechanism is durable across horizontally deployed app instances and does not depend on an in-memory mutex. Read-only scenario simulation does not claim a revision.

`PlannerRun` gains nullable `idempotencyScope` and `idempotencyKey` with a paired-value check and a unique identity over user, trigger, scope and key. A stable provider/event key can therefore deduplicate delivery. Unkeyed manual runs remain unrestricted. Repository `start` returns `CREATED` or the existing run, including a completed one; the authoritative executor must proceed only for `CREATED`. `complete` guards `RUNNING` and stores a completed timestamp plus a bounded summary and warning projection without free-form provider or task text. Recent and latest successful reads remain user scoped. The existing PlannerRun status enum and history table are reused.

Generated WorkSession batches must be planner-owned, unlocked, planned, and linked to a PlannerRun. Active generated and retained-intent queries are user scoped and horizon bounded. Guarded supersession changes only active unlocked planner sessions; manual and locked sessions are preserved. `supersededById` is optional when work disappears, and its former one-to-one uniqueness is removed so multiple old sessions may point to one meaningful replacement. All old rows remain as history. Batch writes and supersession run inside the caller's authoritative transaction.

The migration chain is exercised from empty to current and from the Milestone-3 schema through migrations 0007–0008 using an embedded PostgreSQL runtime. Repository fakes test guarded claims, idempotent starts, lifecycle, queries, batches, supersession and rollback. The full live PostgreSQL acceptance run remains part of the later authoritative execution slice.

## Authoritative execution and plan history

The authenticated service validates the request and assembles one canonical snapshot with its planning revision. It starts a `RUNNING` PlannerRun in a short transaction before invoking the explicitly named `heuristic-v1` version. Its versioned `planner-input` JSON snapshot serializes all instants as UTC ISO strings and contains canonical planning facts but no credentials. Ordinary PlannerRun read services omit this raw snapshot; account export and internal diagnostics can retain it.

The application boundary independently audits output ownership, task/session identity, retained manual and locked intent, session shape, reported hard validation issues, core hard-invariant validation, exact remaining-work accounting, and feasibility consistency. A valid partial schedule with quantified unscheduled work may succeed as `INFEASIBLE`. Invalid output or a core exception completes the run as `FAILED` without changing the authoritative schedule.

The successful write is one transaction: claim the expected user revision, load current active generated sessions and the latest successful run, allocate durable IDs to genuinely new planner sessions, batch insert them, supersede obsolete unlocked generated rows, and complete the PlannerRun. A stale claim completes the run as failed outside this write transaction. A write exception rolls back the claim, new sessions, supersessions and success completion together, then records failure separately. The idempotent `start` result prevents a second keyed delivery from executing or writing a duplicate plan. Distinct unkeyed manual runs remain valid.

Unchanged persistent session IDs are retained. A newly computed slot with the same task, timing and duration also reuses its old durable identity even if core assigned a fresh temporary ID. Other core-generated temporary IDs are replaced with durable IDs for new rows, which reference the creating PlannerRun. An old session is linked to a replacement only when a newly generated session for the same task has the same planned duration and a changed time; otherwise it is superseded with no replacement. Manual and locked sessions are never superseded. The persisted summary carries counts, unscheduled minutes and a structured delta of retained, moved, added, removed, newly at-risk and resolved-risk IDs. Moved pairs include old/new UTC starts, so movement is based on stable identity and timing rather than array order. Summary and warnings omit task titles and free-form core messages.

Focused service tests use synthetic canonical repository state and a transaction-aware database double, while existing embedded PostgreSQL tests cover the revision and repository substrate. A live PostgreSQL end-to-end planner run remains for the later Milestone-4 acceptance gate.

## Next slice

**replan triggers and incremental/minimal-change orchestration.** Milestone 4 remains in progress.
