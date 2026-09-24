# ADR 0005: Milestone-3 planner-core contract and architecture

- Status: Accepted for the Milestone-3 contract slice
- Date: 2026-09-23
- Scope: Deterministic planner-core v1; no persistence or production UI wiring

## Authority and sequencing

The master _Personal University Planning System_ specification governs planner behavior and invariants. The _University Planner — Implementation Roadmap_ governs the Milestone-3 pipeline, test families and exit gate. This slice establishes the contract and module boundaries; it does not claim the complete heuristic or the milestone gate.

## Planner-facing snapshot

`PlannerInput` is a fully supplied, plain typed snapshot. The application layer must resolve canonical records, recurrence, timezone-local rules and unknown estimates before calling core. `PlannableTask` is now a narrow planner representation instead of inheriting the richer canonical `Task`; unknown canonical estimates must remain unknown until the caller has a justified value. Explicit inputs cover dependency edges, fixed events, expanded protected/sleep intervals, availability including commute classification, manual and locked sessions, previous sessions, policy preferences, replan intent and released-time policy. The task snapshot includes normalized importance and deadline confidence. `minimumSleepMinutes` is a planner policy value supplied by the caller. It is not silently derived from a database row.

The canonical schema has protected-time rules and user day bounds, but no dedicated minimum-sleep preference. This is a policy-source gap for the later normalization slice, not grounds for a migration in this contract slice. That slice must document its source/default and expand hard sleep windows before enforcing minimum sleep. No planner input is fetched from PostgreSQL by core.

`PlannerOutput.plannerVersion` identifies the centrally defined `heuristic-v1` contract. Warnings can carry machine-readable reason codes and quantified deficits. The placement-reason map is present but empty until explanation generation is implemented. No PlannerRun is written here.

## Pure module boundaries

- `index.ts`: public orchestration, baseline ranking, workload accounting, output assembly.
- `input.ts`: baseline capability gate so explicit but deferred constraints cannot be silently ignored.
- `windows.ts`: occupied intervals, candidate subtraction, eligibility and suitability helpers.
- `pressure.ts`: suitable capacity, slack and pressure calculation.
- `allocation.ts`: window selection, session sizing and placement, including the existing stability bonus.
- `validation.ts`: current hard-event, task, overlap and lock checks.
- `scenario.ts`: side-effect-free protected-window simulation.
- `version.ts`: one named planner version.

The current heuristic was moved with its established behavior. The next slices may split these modules further as normalization, dependency eligibility, sustainability, repair and explanation become real stages. The planner package depends only on domain and shared; the boundary checker rejects any other package dependency or external import, including database, UI, network and AI libraries.

## Deliberate deferrals

The baseline rejects nonempty dependencies, protected/sleep windows, manual sessions and commute windows, positive minimum sleep, non-incremental modes and a nondefault released-time policy. This is intentional fail-fast behavior while those semantics are being implemented. The existing daily limit, free-time buffer, deadline buffer, weekend bias, maximum consecutive work and complete stability policy remain unimplemented; callers must not treat this slice as production scheduling. Full placement reasons, hard/soft hierarchy, workload-conserving repair and randomized invariant tests remain Milestone-3 work.

**Exact next slice:** normalization, eligibility, occupied timeline and candidate capacity, including dependency and sleep/protected-time handling. Subsequent slices complete risk/ranking, sustainable allocation, stability/repair, explanations and the canonical scenario/property suite before the Milestone-3 exit gate.

## Normalization and candidate-capacity slice

The next slice is now implemented. `normalizePlannerInput` clones the explicit snapshot, validates horizon/now/timezone and supplied effective estimates, expands local recurrence with shared time utilities, and produces an occupied timeline, eligibility graph, and disjoint candidate windows. Recurrence rules use their own explicit IANA timezone; local wall time survives DST. The normalized snapshot clears recurring rules after expansion so a second normalization does not duplicate occurrences. A completed prerequisite may be supplied through `completedTaskIds` without an invented estimate-bearing task snapshot. Unknown deadlines stay absent.

`timeline.ts` merges half-open hard events, hard protected windows, sleep, active locks and manual sessions. Soft windows remain advisory. For every complete local day inside the horizon, a positive `minimumSleepMinutes` requires a supplied sleep block beginning on that day of at least that elapsed duration. The caller supplies bedtime/sleep recurrence; core does not invent it. Partial edge days are exempt because their sleep may lie outside the requested horizon.

`windows.ts` subtracts merged hard occupancy, rounds candidate boundaries inward to the shared five-minute quantum, and represents overlapping availability as simultaneous alternatives over one clock interval. It preserves energy, tags, capacity factor, commute kind and local start metadata without double-counting overlap. Commute suitability requires the preference, a transit-capable task, and a transit-capable window. `eligibility.ts` excludes non-ready/non-AUTO/zero-work/out-of-horizon tasks, detects dependency cycles, and holds dependents until prerequisites are completed or fully allocated. Unsupported replan and released-time policy semantics still await later Milestone-3 slices; no persistence or UI wiring was added.

Active future manual and locked sessions reserve both clock time and planned task minutes. Normalization exposes unallocated minutes separately from the canonical remaining-work fact, rejects retained allocations that exceed it, and lets a dependent start only after a fully reserved prerequisite ends. This avoids allocating the same work twice without mutating the caller's task snapshot.

**Exact next slice:** suitable capacity, slack, deadline/preferred-completion risk, documented scoring and deterministic ranking. Allocation sustainability, stability, repair and full explanations follow after that.

## Capacity, risk and ranking slice

`windowSuitability` is the shared capability and rate calculation for both pressure and placement. It bounds each candidate by task availability, now, true deadline, horizon and an optional preferred target, then applies location, energy, commute policy, capacity factor, five-minute precision and minimum useful session size. Simultaneous availability alternatives supply one best effective rate, never additive time. Unsplittable work needs one suitable window. An optimistic dependency finish bound excludes time before prerequisite work could complete; actual allocation still enforces completed prerequisite sessions. This bound is a prioritization estimate, not a promise that the later allocation can meet every deadline.

`TaskPressure` exposes suitable minutes, slack (suitable minutes minus remaining work), pressure ratio, capacity deficit, feasibility class, true deadline, preferred target and scored components. Positive work with zero capacity has a null ratio and an explicit infeasible or horizon-limited classification. Unknown deadline stays absent. An optional normalized importance value contributes only when supplied; no grade weight is invented. Preferred completion comes from an explicit target or a policy buffer, and never changes the true deadline. A bounded downstream-work factor raises prerequisite priority. Named `HEURISTIC_V1_CONFIG` coefficients give capacity pressure more influence than urgency, importance or preferences; deadline pressure follows an inverse-power curve. Context penalties include late high-energy time and fragmentation.

`rankTaskPressures` sorts by score, actual deadline, preferred target and codepoint task ID. Initial diagnostic ranking accounts for optimistic dependency readiness. Orchestration recomputes pressure for ready tasks after each placement and exposes both initial ranking and allocation order. Placement still has the baseline session construction policy; sustainable daily limits, breaks, consecutive-work limits, plan stability, repair and complete explanations are the next Milestone-3 slices.

**Exact next slice:** sustainable session construction and allocation.
