# Roadmap progress

## 2026-09-24 — Milestone 4 merged and closed

- [PR #5](https://github.com/Taheem-A/personal-university-planner/pull/5) merged into `master` at `6c4b70dab04ab1d55179be8963f8c7492e2a81a5`. Final PR head `1a86fe34603c97f2c2354360a18eb53877f72836` is now part of the default branch.
- Acceptance implementation head `b4ba27248e5ef68d254b8eead30e9b3adc2b9c20` passed [CI run 36081951021](https://github.com/Taheem-A/personal-university-planner/actions/runs/36081951021) and [dependency review 36081950998](https://github.com/Taheem-A/personal-university-planner/actions/runs/36081950998). Final PR head passed [CI run 36082238373](https://github.com/Taheem-A/personal-university-planner/actions/runs/36082238373) and [dependency review 36082238238](https://github.com/Taheem-A/personal-university-planner/actions/runs/36082238238).
- The [Milestone-4 exit gate](./milestone-4-exit-gate.md) is **PASSED**. Planner Service, authoritative persistence, incremental replanning, concurrency/idempotency guarantees and real Today/Week read contracts are now merged.
- **Exact next roadmap item:** Milestone 5 — Production Next.js UI and Real-State Migration. It has **not started**.

## 2026-09-24 — Milestone 4 final acceptance: GATE PASSED

- Audited the Planner Service, all nine trigger paths, incremental policy, revision/idempotency/supersession semantics, Today/Week reads, history and package boundaries against the literal Milestone-4 requirements. The evidence matrix is [Milestone-4 exit gate](./milestone-4-exit-gate.md).
- Replayed migrations 0001–0009 from zero on an expiring disposable Neon branch in project `purple-tooth-70442528`. Migration status is current and Prisma schema drift is zero. Forward-only migration 0009 corrects PostgreSQL's truncated 0008 idempotency index name.
- Guarded live PostgreSQL race and full Planner Service acceptance commands passed with synthetic users: generation/reload, incremental supersession, preserved manual/locked work, quantified infeasibility, safe failure, overlapping same-user plans, independent users, canonical edit race and duplicate event delivery.
- Fixed keyed redelivery to retrieve the existing run before attempting to assemble newly changed canonical input; added a regression test. Full local `pnpm verify` passed with 140 unit, 39 integration and 2 browser tests. Planner scenarios passed 13/13, properties 2/2, and dependency audit found no known high-severity vulnerabilities.
- GitHub [CI run 36081951021](https://github.com/Taheem-A/personal-university-planner/actions/runs/36081951021) and [dependency review run 36081950998](https://github.com/Taheem-A/personal-university-planner/actions/runs/36081950998) both passed on acceptance implementation head `b4ba27248e5ef68d254b8eead30e9b3adc2b9c20`. Draft [PR #5](https://github.com/Taheem-A/personal-university-planner/pull/5) supplies the pull-request check context and remains unmerged. Documentation-head checks are verified before it is marked ready.
- **Milestone 4 — GATE PASSED.** Exact next roadmap item: **Milestone 5 — Production Next.js UI and Real-State Migration**. It has not started.

## 2026-09-24 — Milestone 4 production planner read contracts: IN PROGRESS

- Added typed Today and Week application read models backed by one authenticated, repeatable-read canonical snapshot. They include active manual/locked/generated work, fixed and recurring commitments, sleep/protected/commute windows, known deadlines, remaining work, risk and current PlannerRun state. Local day and week bounds use shared timezone and recurrence utilities.
- Persisted planner-core placement reason codes under durable session IDs in safe PlannerRun summaries. Run-history reads expose provenance, version, horizon, warnings, delta and risk changes while omitting raw input snapshots and provider event identities.
- Added thin authenticated Today, Week and run-history GET routes. The visual UI and demo fixtures remain untouched.
- Full local `pnpm verify` passed, including unit/integration tests, schema validation, production build with the three new routes and 2 Chromium E2E checks. Planner scenarios (13/13), properties (2/2) and dependency audit passed.
- **Exact next step: Milestone-4 final acceptance, live PostgreSQL proof, CI and exit-gate audit.** Milestone 4 remains **IN PROGRESS**.

## 2026-09-24 — Milestone 4 concurrency and idempotency hardening: IN PROGRESS

- Overlapping same-user Planner Service computations now have deterministic CI race coverage: one succeeds and the other receives `STALE_SNAPSHOT`; a canonical edit during computation also rejects the old plan. Different-user progress is checked while one computation is paused.
- Keyed duplicate deliveries reuse one run and schedule; distinct keys and unkeyed manual requests remain independent. A demand-driven 30-minute abandoned-run recovery marks stale `RUNNING` rows failed, and guarded terminal completion prevents a late computation from publishing sessions.
- Added `pnpm db:planner:races:verify` for the Milestone-4 acceptance gate. It requires an explicitly confirmed direct disposable Neon database and exercises actual PostgreSQL per-user claims, a canonical-state race, event uniqueness and late-run rejection. No live database was available for this slice's local run.
- Full local `pnpm verify` passed: 131 unit tests, 39 integration tests, production build and 2 Chromium E2E tests. Dedicated planner scenarios (13/13), planner properties (2/2) and dependency audit passed.
- **Exact next slice: production Today/Week planner view models and plan-history read services.** Milestone 4 remains **IN PROGRESS**.

## 2026-09-24 — Milestone 4 replan triggers and incremental repair: IN PROGRESS

- Centralized post-commit classification of planning-relevant task, deadline, calendar, academic, availability, protected-time, preference and manual-session mutations. Cosmetic edits do not request a plan. Ordinary factual changes use `INCREMENTAL` and retain exact trigger/entity provenance.
- Added explicit manual and callable daily refresh operations; a keyed integration-batch boundary commits many future canonical writes before one replan. Completed/skip trigger paths require matching already-committed session, completion and remaining-work facts. The Milestone-7 outcome loop and provider sync remain deferred.
- Previous generated sessions and the stability preference flow into core; structured deltas retain unchanged IDs and record moved/added/superseded sessions. Explicit released windows respect core policy. Risk comparisons now use persisted core pressure/infeasibility projections and report newly at-risk, worse, improved, resolved and unchanged risk.
- Full local `pnpm verify` passed, including package boundaries, unit/integration tests, schema validation, production build and Chromium E2E. Dedicated planner scenarios (13/13), properties (2/2) and dependency audit passed.
- **Exact next slice: concurrency, stale-result and idempotency hardening.** Milestone 4 remains **IN PROGRESS**.

## 2026-09-24 — Milestone 4 authoritative planner execution: IN PROGRESS

- The authenticated Planner Service now loads one revisioned canonical snapshot, invokes explicit `heuristic-v1`, independently validates its output, and records a versioned serializable PlannerRun input snapshot. Ordinary run reads omit the raw input.
- The guarded authoritative transaction claims the expected revision, creates genuinely new durable generated sessions, retains unchanged IDs, supersedes obsolete generated history, and finalizes a successful run with safe warnings and an inspectable structured delta. Core failure, invalid output, stale state and persistence rollback preserve the preceding schedule and complete a failed run where the database permits.
- Synthetic service tests cover real core invocation from canonical records, repeat stability, idempotency, moved/removed deltas, manual/locked preservation, quantified infeasibility, ownership, stale claims and transactional rollback. The live PostgreSQL end-to-end planner acceptance remains for the Milestone-4 gate.
- Full local `pnpm verify` passed, including unit and integration tests, package boundaries, schema validation, production build and Chromium E2E. Dedicated planner scenarios (13/13), planner properties (2/2) and dependency audit passed.
- **Exact next slice: replan triggers and incremental/minimal-change orchestration.** Milestone 4 remains **IN PROGRESS**.

## 2026-09-24 — Milestone 4 persistence/concurrency substrate: IN PROGRESS

- Added `User.planningRevision` with database triggers for planning-relevant canonical writes. The Planner Service now carries the snapshot revision, and the repository exposes an atomic expected-revision claim for the next authoritative transaction.
- Added scoped durable PlannerRun idempotency, guarded RUNNING-to-terminal completion, safe structured summary/warning projection, and latest-successful lookup. Unkeyed manual runs remain possible.
- Added generated-session batch creation, active generated/retained-intent reads, and guarded supersession with or without a replacement. Manual and locked sessions are protected, and history is never deleted.
- Migration `0008_planner_authority_substrate` was replayed from zero and after the Milestone-3 migration set in embedded PostgreSQL tests. Focused tests cover revision guards, isolation, idempotency, lifecycle, rollback and session history.
- Full local `pnpm verify` passed, including 39 integration tests, schema validation, production build and Chromium E2E. Dedicated planner scenarios (13/13), planner properties (2/2) and dependency audit passed.
- **Exact next slice: authoritative planner execution and transactional plan persistence.** Milestone 4 remains **IN PROGRESS**.

## 2026-09-24 — Milestone 4 Planner Service/input assembly: IN PROGRESS

- Added typed authoritative-generation, incremental-replan and full-replan request/result vocabulary, the complete roadmap trigger vocabulary, explicit planner version and released-time policy, and structured input/precondition failures.
- Added user-scoped planning-state reads under a repeatable-read snapshot. The application layer maps canonical facts into pure `PlannerInput` and can invoke `heuristic-v1` without persisting output.
- Added a nullable, explicitly configured minimum-sleep preference and a durable sleep marker on protected-time recurrence, with migration `0007_planner_sleep_policy`. Missing policy or sleep windows fail assembly.
- Exact planning ends at the seventh upcoming local midnight; the first 24 hours are identified as immediate. Shared timezone/recurrence utilities preserve wall-clock DST behavior.
- Focused synthetic tests cover state mapping, isolation, inactivity, dependencies, session classes, recurrence/DST, horizon determinism, unknown deadlines, precondition failures and planner-core entry. See [ADR 0006](./decisions/0006-planner-service-input-assembly.md).
- Full local `pnpm verify` passed, including package boundaries, Prisma generation/validation, typecheck, unit/integration tests, production build and Chromium E2E. Dedicated scenario (13/13), property (2/2), and dependency audit commands passed.
- **Exact next slice: Planner persistence/concurrency substrate.** Milestone 4 remains **IN PROGRESS**.

## 2026-09-24 — Milestone 3 merged and closed

- [PR #3](https://github.com/Taheem-A/personal-university-planner/pull/3) is merged into `master` at `e8b5e846e72a4269d304213adbf81ba22416a915`. The final PR head `da2345813a325ae7f5e8bf19743776fb3328d13a` is an ancestor of `master`.
- The implementation-head [CI run 36025989398](https://github.com/Taheem-A/personal-university-planner/actions/runs/36025989398) and [dependency review 36025989365](https://github.com/Taheem-A/personal-university-planner/actions/runs/36025989365) passed. Final-head [CI run 36046159256](https://github.com/Taheem-A/personal-university-planner/actions/runs/36046159256) and [dependency review 36046159376](https://github.com/Taheem-A/personal-university-planner/actions/runs/36046159376) also passed. The [Milestone-3 exit gate](./milestone-3-exit-gate.md) is **PASSED**.
- **Exact next roadmap item:** Milestone 4 — Planner Service, PlannerRuns, Persistence, and Incremental Replanning. It has **not started**.

## 2026-09-24 — Milestone 3: GATE PASSED

- The [literal exit-gate audit](./milestone-3-exit-gate.md) maps all 14 pipeline steps, required behavior, 13 canonical scenarios, major invariants and five exit criteria to source and test evidence. The roadmap gate passes on local and GitHub CI evidence. [CI run 36025989398](https://github.com/Taheem-A/personal-university-planner/actions/runs/36025989398) and [dependency review run 36025989365](https://github.com/Taheem-A/personal-university-planner/actions/runs/36025989365) both succeeded for implementation head `47f2bd87421b1d85453beb7d9df68990f40641b6`. Final-head checks follow this documentation update. Milestone 4 has **not started**.
- A dependency-free seeded property generator exercises 1,000 valid explicit planner snapshots, including feasible and infeasible outcomes, variable workload/deadlines, hard/soft/protected/sleep time, capability and commute, dependency chains, locks/manual/previous sessions and preferences. It checks output validation, hard placement invariants, accounting, user intent, input purity and structured reasons. Failures carry a replay seed. A further 64 generated normalized snapshots each produced six deeply equal complete `heuristic-v1` outputs.
- The sweep found a generated tiny-remainder validation defect and an empty reason on ordinary placements. Session construction now declines splits that would strand an unusable remainder; valid available capacity receives a structured reason. Retained hard conflicts now have a `RETAINED_CONFLICT` limiting factor even when all task minutes are nominally allocated.
- Core isolation automation now rejects computed imports, ambient network/browser access, environment reads, implicit clock reads and randomness. Negative integration cases verify those rejection paths. The package manifest and source allowlist still permit only framework-independent domain/shared primitives.
- Full local `pnpm verify` passed: format, lint, 73-file package boundaries, Prisma generation/validation, typecheck, **98/98** unit tests, **36/36** integration tests, core/database/Next.js builds and **2/2** Chromium E2E tests. Dedicated canonical and property suites passed **13/13** and **2/2**; `pnpm check:dependencies` reported no known vulnerabilities.
- **Exact next roadmap item:** Milestone 4 — Planner Service, PlannerRuns, Persistence, and Incremental Replanning, after PR #3 review and merge.

## 2026-09-24 — Milestone 3 canonical scenario and regression suite: IN PROGRESS

- Added permanent synthetic Toronto engineering-semester fixtures and a dedicated `pnpm test:planner-scenarios` command. The [scenario matrix](./milestone-3-scenario-matrix.md) records all 13 required roadmap cases and their exact local pass state; the targeted suite passed **13/13**.
- Shared assertions check version attribution, repeated-run determinism, input purity, ordered sessions, workload conservation, reasons/warnings and the hard validator for successful plans. The Saturday-off preview checks minimal movement plus a separately infeasible variant; commute, released-time, hard-lock and DST cases use explicit policies and instants.
- The deadline-move fixture found a real soft-policy defect: a preferred free-time reserve could shorten a feasible full session and strand required work. Allocation now retries without that daily soft preference only if the first attempt leaves work unplaced, and selects the retry only when it fits more work. The normal unit suite passed **96/96** locally after this fix. Milestone 3 remains **IN PROGRESS**.
- Full local `pnpm verify` passed: format, lint, 73-file package boundaries, Prisma generation/validation, typecheck, **96/96** unit tests, **36/36** integration tests, core/database/Next.js builds and **2/2** Chromium E2E tests. The dedicated canonical suite passed **13/13**.
- **Exact next work item:** randomized property/invariant testing, determinism/version proof and literal Milestone-3 exit-gate audit.

## 2026-09-24 — Milestone 3 validation, repair and scenarios: IN PROGRESS

- The complete output audit reports structured issues for session validity, hard occupancy, availability/capability/commute, task state, dependency order, break and length rules, workload, ownership, deadlines and exact manual/lock preservation. `generatePlan` marks any remaining work or hard issue `INFEASIBLE`; a retained hard conflict is visible without moving user intent.
- A bounded deterministic repair retries invalid generated placements with their conflicting intervals excluded, then validates the result again. Task-level evidence includes required/scheduled/unscheduled/suitable minutes, deficit, deadline and supported limiting factors. Concise placement reason codes are distinct from numeric ranking diagnostics.
- Protected-window scenarios derive an in-memory alternative without changing input or persisting anything. Results include feasibility, moved/added/removed sessions, affected task IDs, capacity change and deficit change. Focused tests cover hard-validator families, repairable and non-repairable conflicts, deficits and causes, truthful reasons, and feasible/infeasible scenario deltas. Milestone 3 remains **IN PROGRESS**.
- Full local `pnpm verify` passed: format, lint, 73-file package boundaries, Prisma generation/validation, typecheck, **83/83** unit tests, **36/36** integration tests, core/database/Next.js builds and **2/2** Chromium E2E tests.
- **Exact next work item:** canonical scenario/regression suite, including semester fixtures, randomized invariants, DST/horizon edges and stability/replanning regressions.

## 2026-09-24 — Milestone 3 planner policy: IN PROGRESS

- Dependency readiness now governs placement across chains; unknown references and cycles fail explicitly. Retained dependent sessions require completed or fully reserved prerequisites, so a previous schedule cannot bypass ordering.
- Capability/location and commute policy are enforced when selecting windows. Coarse energy affects productivity and choice. The planner avoids SOFT events and protected time first, then uses them only when needed for required work and reports the compromise. Local-time weekend costs discourage avoidable Sunday concentration.
- Manual and locked sessions remain user intent. Valid prior planner sessions are retained preferentially, with a firm near-term stability tier and a weaker general churn preference. New hard conflicts or infeasible work may relax ordinary prior sessions; retained user/locked conflicts are reported rather than silently moved. Explicit released windows support `KEEP_FREE`, `REPLAN_IF_USEFUL` and `ALWAYS_REPLAN` without persistence or triggers.
- Focused tests cover dependencies, hard/soft hierarchy, capability and commute, weekend bias, manual/lock preservation, stability and churn, conflict relaxation, released-time policies and deterministic retention. Milestone 3 remains **IN PROGRESS**.
- Full local `pnpm verify` passed: format, lint, 71-file package boundaries, Prisma generation/validation, typecheck, **74/74** unit tests, **36/36** integration tests, core/database/Next.js builds and **2/2** Chromium E2E tests.
- **Exact next work item:** validation, repair, explicit infeasibility, reason codes and non-mutating scenarios.

## 2026-09-24 — Milestone 3 sustainable session construction and allocation: IN PROGRESS

- Rebuilt pure session sizing around remaining productive work, preferred/minimum/maximum session lengths, splittability, capacity factor and five-minute clock precision. Tiny complete tasks can form one short session; non-splittable work either fits once or remains explicitly unscheduled. The output conserves required minutes.
- Reserved unscheduled minimum-break gaps across generated and retained sessions. Maximum consecutive planned work applies to session clock length, with a quantum gap even when the configured break is zero. Window choice now weighs energy, productive rate, preferred completion, useful session size and nearby task switches.
- Added a local-day sustainability policy. The planner first fits work beneath preferred daily-study and minimum-free-time budgets, then may exceed these soft limits when required work has no compliant placement. Quantified warnings report daily overages, free-time buffer use and preferred deadline-buffer consumption; true deadlines stay unchanged.
- Focused tests cover splitting, non-splittable work, tiny remainders, breaks, consecutive work, daily and free-time soft limits, context grouping, exact workload conservation, five-minute precision and better-fit windows. Milestone 3 remains **IN PROGRESS**.
- Full local `pnpm verify` passed: formatting, lint, 70-file package-boundary check, Prisma generation/validation, typecheck, **61/61** unit tests, **36/36** integration tests, core/database/Next.js production builds and **2/2** Chromium E2E tests.
- **Exact next work item:** planner policy for dependencies, context, commute, weekend bias, manual intent, locks and stability.

## 2026-09-23 — Milestone 3 capacity, risk and deterministic ranking: IN PROGRESS

- Added task-specific suitable capacity, quantitative slack/pressure/deficit and explicit feasibility categories. The calculation respects true deadlines, availability, occupied time, energy, location, commute policy, capacity factors and optimistic prerequisite completion. Zero suitable capacity is represented by a null ratio rather than a fabricated denominator.
- Added nonlinear deadline pressure, separate soft preferred-completion pressure, optional normalized importance, explicit prerequisite value, context fit, fragmentation and undesirable-time costs. Named typed `heuristic-v1` configuration holds weights and thresholds; stable score/deadline/preferred-target/task-ID tie-breakers determine ranking. Ready tasks are rescored after each placement.
- Added focused ranking and numerical tests. Milestone 3 remains **IN PROGRESS**; placement sustainability, stability, repair, explanations and broader scenario/property verification remain.
- Full local `pnpm verify` passed: format, lint, 69-file package-boundary check, Prisma generation/validation, typecheck, **45/45** unit tests, **36/36** integration tests, core/database/Next.js production builds and **2/2** Chromium E2E tests.
- **Exact next work item:** sustainable session construction and allocation.

## 2026-09-23 — Milestone 3 normalization and candidate capacity: IN PROGRESS

- Added a pure normalization stage that clones and validates the planner snapshot, expands local recurrence with shared timezone utilities, retains unknown deadlines, and requires resolved estimates. Completed prerequisites can be supplied without fabricated estimates.
- Eligibility excludes inactive, non-AUTO, zero-work and out-of-horizon tasks; dependency cycles are rejected, and dependents wait for fully allocated or completed prerequisites. The occupied timeline merges hard events, hard protected time, sleep and retained sessions. Disjoint candidate windows preserve energy, capability, location, commute and local-time metadata without counting overlapping availability twice.
- Focused tests cover hard/soft subtraction, sleep, five-minute bounds, eligibility, dependencies, manual/locked sessions, overlapping availability, commute policy, timezone and DST recurrence, determinism and input purity. Milestone 3 remains **IN PROGRESS**.
- Full local `pnpm verify` passed: formatting, lint, package boundaries, Prisma generation/validation, typecheck, **36/36** unit tests, **36/36** integration tests, core/database/Next.js production builds and **2/2** Chromium E2E tests.
- **Exact next work item:** capacity/slack/risk/scoring/deterministic-ranking slice.

## 2026-09-23 — Milestone 3 planner contract and architecture: IN PROGRESS

- PR #2 is merged into default branch `master` at `d98dfd6`; Milestone 2 remains gate passed. The unmerged wording in the prior audit entry below is historical evidence from before the merge.
- Established the explicit planner snapshot, typed `heuristic-v1` output version and pure module responsibilities recorded in [ADR 0005](./decisions/0005-planner-core-v1-contract.md). Existing baseline behavior was preserved. New constraint fields reject unsupported nonempty inputs until implemented; no planner persistence, production UI wiring or migration was added.
- Local full `pnpm verify` passed: formatting, lint, boundaries, Prisma generation/validation, typecheck, **25/25** unit tests, **36/36** integration tests, core/database/Next.js builds and **2/2** Chromium E2E tests.
- Milestone 3 remains **IN PROGRESS**. Exact next work item: normalization/eligibility/timeline/candidate-capacity slice.

## 2026-09-23 — Milestone 2: GATE PASSED

- The final literal audit verified Google-only Auth.js, atomic/idempotent canonical identity mapping, session-derived actor scope, service-side Zod/domain checks, transaction-bound repositories, structured safe errors, explicit optimistic versions, account export/deletion and all intended Milestone-2 service families. No production route imports Prisma or repositories directly; no client-supplied owner ID is authoritative.
- On disposable Neon branch `milestone-2-service-proof-20260922`, the empty `up_m2_service_final_20260922` database received source-controlled migrations 0001–0006 from zero. Migration status is current with no incomplete or rolled-back record. A read-only Prisma database-to-schema diff found no representable drift.
- Guarded `pnpm db:services:verify` passed **1/1** against live PostgreSQL, including cross-user isolation, invalid-input non-persistence, stale-write rejection, rollback, reconnect persistence, scoped/redacted export and isolated account deletion. Independent live checks also passed concurrent/repeat identity provisioning and forced account-deletion rollback.
- Clean GitHub Actions [CI run 35814576841](https://github.com/Taheem-A/personal-university-planner/actions/runs/35814576841) passed full `pnpm verify` on Node 24.21.0/pnpm 12.5.1: **23/23** unit, **35/35** integration and **2/2** Chromium E2E tests, plus formatting, lint, boundaries, Prisma checks, typecheck and builds. [Dependency review](https://github.com/Taheem-A/personal-university-planner/actions/runs/35814576829) passed; `pnpm check:dependencies` reported no known vulnerabilities.
- [Milestone 2 exit gate](./milestone-2-exit-gate.md) records the requirement matrix, evidence limits, non-blocking risks and later-roadmap deferrals. Draft PR #2 remains unmerged. Earlier Milestone-2 entries below are historical progress notes.
- **Exact next work item:** **Milestone 3 — Planner-Core v1: Complete Deterministic Scheduling Engine**. No Milestone-3 work was started in this audit.

## 2026-09-23 — Milestone 2 transport proof and exit-gate audit: IN PROGRESS

- Added representative authenticated Next.js handlers for terms, courses, tasks, availability and canonical account export. A shared transport adapter bounds JSON requests, checks same-origin mutations and maps typed application errors to safe, uncached HTTP responses. Static package checks now reject transport access to Prisma, database internals and repository operations.
- Added optional server-only Sentry reporting of a fixed internal-failure signal. The monitoring boundary sends no user academic content, request data, OAuth tokens or database credentials; without `SENTRY_DSN` it remains disabled.
- `pnpm verify` passed formatting, lint, boundaries (59 source files), Prisma generation/validation, TypeScript, 23/23 unit tests, 35/35 local integration tests and core/database/Next.js builds, then failed its two Playwright browser tests because Chromium is unavailable. The integration tests include actual handler/service module simulation with two users, guessed IDs, malformed/domain-invalid writes, stale and fresh updates, forced simulated rollback, credential-free export, service recreation and negative package-checker cases. `pnpm check:dependencies` reported no known vulnerabilities.
- Added guarded `pnpm db:services:verify` for a synthetic, direct, disposable `up_m2_service_*` Neon database. It has **not run** because this workspace has no direct disposable database connection. Migration history 0001–0006 has likewise not been deployed from zero with Prisma in this audit. Chromium installation returned truncated archives; browser E2E and the complete `pnpm verify` gate cannot pass here. The detailed [Milestone 2 exit-gate audit](./milestone-2-exit-gate.md) records these blockers and the literal criteria.
- **Verdict: Milestone 2 is IN PROGRESS; gate NOT PASSED.** Exact next work item: deploy all migrations from zero into a fresh disposable Neon database, run the guarded live service/auth/authorization/deletion-rollback suite, run full `pnpm verify` and dependency/CI checks with Chromium, fix any failures and re-audit before marking the gate passed or opening the PR. Milestone 3 has not started.

## 2026-09-22 — Milestone 2 trust-boundary slices: IN PROGRESS

### Academic application service slice (Prompt 4): IN PROGRESS

- Added authenticated term, course, recurring course meeting, assessment, task, and task-dependency services with scoped reads, create/update/archive operations, guarded parent relations and dependency cycles, and structured results. Academic term archive uses its canonical `ARCHIVED` status; other academic archives preserve their records and history.
- Migration 0004 adds explicit optimistic versions to term, course, meeting, and assessment, and adds a meeting archive timestamp. Existing Task version is reused. A per-user transaction advisory lock serializes task-parent and dependency graph changes; dependent Task version changes with dependency mutations.
- Academic input preserves unknown deadlines and estimates as null, calendar dates as dates, recurring wall-clock fields as local values with timezone, and submission state separate from Task completion. Manual edits cannot claim provider or system provenance.
- Local service tests exercise two-user scoping, stale versions, invalid dates, null facts, task hierarchy, and dependency cycles. The service tests use a repository simulation; live service/database integration and transaction rollback still need a disposable database reachable from the test process. Milestone 2 remains **IN PROGRESS**.
- Exact next work item: run live database integration and browser E2E when their runtimes are accessible, then add CalendarEvent, AvailabilityRule, ProtectedTimeRule, PlanningPreference, and InboxItem services with conditional versions and wall-clock validation (Prompt 5).

### Schedule state and inbox slice (Prompt 5): IN PROGRESS

- Added authenticated CalendarEvent CRUD/archive, AvailabilityRule and ProtectedTimeRule creation/update/deactivation, PlanningPreference create/get/update, and InboxItem capture/proposal/resolve/dismiss service boundaries. Canonical events are local/manual only; no provider call or calendar scope is involved.
- Migration 0005 adds explicit optimistic versions for these five state families; conditional repository updates prevent stale editor writes. Recurrence retains date-only effective dates, Toronto-compatible local wall-clock strings, timezone, overnight flags, and the documented daily/weekly subset. Inbox raw text and manual provenance remain intact.
- Local repository-simulation tests exercise guessed IDs, interval ordering, recurrence ordering, stale versions, preferences, protected overnight time, inbox text, and forward-only migration SQL. Direct disposable-database service tests and browser E2E remain to be run in a runtime with Neon and Chromium connectivity.
- Exact next work item: complete WorkSession/CompletionRecord/PlannerRun/IntegrationAccount access and account export/deletion lifecycle (Prompt 6), then execute live database integration and browser E2E. Milestone 2 remains **IN PROGRESS**.

### History and account lifecycle slice (Prompt 6): IN PROGRESS

- Added scoped WorkSession manual creation/read/lock/cancel, append-only factual CompletionRecord access, existing PlannerRun history reads, disconnected integration metadata lifecycle, scoped external mapping reads, a versioned canonical account export, and an explicit atomic account-deletion repository. No planner run, provider sync or automatic replanning is fabricated.
- Migration 0006 adds conditional versions to WorkSession and IntegrationAccount. Disconnect clears credential references and retains canonical rows and provenance. Export excludes identity secrets, credential references and nested token/secret keys. [Account data lifecycle](./account-data-lifecycle.md) records archival, disconnect, export and deletion policy.
- Local service simulation tests exercise two-user history isolation, factual records, versioned export/redaction, disconnect preservation and a forced rollback. The disposal database is not reachable by local Prisma here, and the available hosted SQL tool disallows autonomous destructive SQL. Direct database-backed account deletion and rollback verification remain mandatory before exposing deletion to users. Browser E2E also remains blocked by the missing Playwright Chromium binary.
- Exact next work item: run migrations 0004–0006, service integration including deletion rollback and browser E2E in a disposable environment with direct database connectivity and Chromium; repair any issues, then review the Milestone 2 gate. Milestone 2 remains **IN PROGRESS**.

- Added a stable, unique authentication identity to canonical User mapping with atomic first-login provisioning and Toronto initial timezone.
- Added migration 0002, server-only web composition root, and package import enforcement. ADR 0003 records credential minimization and future integration separation.
- Added stable NextAuth.js 4 Google-only OAuth route, JWT session, sign-out through Auth.js, server-side canonical actor resolution, and an authenticated account status endpoint. Only the `openid` login scope is requested; callbacks expose only canonical user ID and do not persist Google tokens.
- Added reusable Zod schemas, ownership checks, dependency-cycle detection, transaction orchestration, structured result/error mapping, and a conditional Task rename proof service. Migration 0003 adds a Task version because millisecond `updatedAt` cannot guarantee distinct consecutive versions. Conditional update atomically increments this value; a stale request receives `STALE_WRITE`.
- Static migration 0001→0003 SQL was applied to a fresh isolated Neon branch `milestone-2-auth-bootstrap-20260922` (`br-blue-mud-b5uug6pk`); its unique identity key, two-user separation, FK cascade metadata, and conditional version update were checked with synthetic rows. This proves the SQL shape, although the local Prisma CLI could not reach Neon from this environment to validate Prisma migration-history bookkeeping.
- Local formatting, lint, package boundaries, typecheck, unit/integration tests, Prisma validation/client generation, build, and dependency audit pass. HTTP smoke checks returned 401 for unauthenticated account status and 200 for the Google provider endpoint. Browser E2E remains unverified here: no Chromium binary is installed, and the Playwright download endpoint returned invalid/truncated archives.
- Milestone 2 remains IN PROGRESS. Exact next work item: implement authenticated, validated create/read/update/archive services for terms, courses, assessments, tasks, availability, and the other core objects; extend optimistic versioning to their planning-relevant mutations; then run live disposable-database integration and browser E2E in an environment with direct Neon and Chromium access.

This repository log updates the implementation status required by **University Planner — Implementation Roadmap** without modifying the read-only project-source copy.

## 2026-09-21 — Milestone 0: GATE PASSED

### What changed

- Confirmed `Taheem-A/personal-university-planner` on `master` as the populated authoritative repository; the similarly named `University-Planner` repository is empty.
- Converted the repository to a pinned pnpm modular-monolith workspace and booted a real Next.js + TypeScript application.
- Added strict shared TypeScript, ESLint, Prettier, environment validation, `.env.example`, configuration-boundary documentation, CI, dependency review, package-boundary enforcement, Prisma 7 validation, and unit/integration/E2E commands.
- Preserved the existing framework-independent core rather than replacing it.
- Moved the interactive preview to `prototypes/approved-preview`, moved its QA captures to `docs/regression-reference/approved-preview`, and copied approved project screenshots to `docs/regression-reference/approved-designs`.
- Recorded Node/package-manager/provider/auth/observability/background-job decisions in ADR 0001.
- Removed the deprecated `tsc` package that prevented the inherited test command from reaching the real TypeScript compiler.
- Added explicit patched overrides for two vulnerable Prisma transitive tooling dependencies; the registry audit is clean.

### Tests passed

- `pnpm verify`
  - Prettier check
  - ESLint
  - package-boundary check
  - strict TypeScript checks for core and web
  - 6 unit tests
  - 2 integration tests
  - Prisma schema validation
  - framework-independent core build
  - Next.js production build
  - 2 Chromium E2E tests covering the production shell/health route and preserved preview
- `pnpm check:dependencies` — no known vulnerabilities

### Blockers

None for Milestone 0. Neon/Vercel/Auth.js/Sentry resources and secrets remain unprovisioned by design.

### Exact next work item

Start Milestone 1 with the canonical Prisma schema/time-semantics review, then create and test the first migration and deterministic seed on a disposable Neon development branch.

## 2026-09-21 — Milestone 1: IN PROGRESS

### What changed

- Completed the pre-migration entity/field audit against the roadmap and master product specification; recorded it in ADR 0002.
- Corrected PostgreSQL semantics for date-only values, recurring local wall-clock values, and UTC-safe instants.
- Added direct user scope and ownership-safe composite relations, history-preserving deletion behavior, typed planning preferences, scoped external identities, provenance, and the missing `RecurringWorkRule`.
- Kept Assessment submission distinct from Task work completion and separated original/current/remaining/actual duration meanings.
- Aligned framework-independent domain terminology without importing Prisma types.

### Tests passed

- Prisma format and validation pass for the corrected schema.
- `pnpm verify` passes: formatting, ESLint, package boundaries, strict core/web TypeScript, 6 unit tests, 2 integration tests, Prisma validation, core/Next.js production builds, and 2 Chromium E2E tests.
- The local host reported Node 24.19.0/pnpm 11.19.0 below the repository-pinned Node 24.21.0/pnpm 12.5.1 versions; this produced engine warnings but no check failures.

### Blockers

None. Migration history remains absent by design for this slice.

### Exact next work item

Establish the first source-controlled Prisma migration against disposable Neon.

## 2026-09-21 — Milestone 1 migration slice: COMPLETE

Milestone 1 remains **IN PROGRESS**; its gate has not passed because seed and repository work remain.

### What changed

- Generated and inspected `0001_canonical_foundation` from the audited schema.
- Added named PostgreSQL checks for invariants Prisma cannot model and tightened external-map provider ownership with a composite foreign key.
- Added explicit generation/create/deploy/status/bootstrap commands, a guarded destructive verifier, migration SQL regression tests, and connection/reset documentation.
- Confirmed the migration contains no connection string or credentials.
- Created disposable Neon branch `milestone-1-migration-bootstrap-20260921` and empty database `up_m1_migration_20260921`; the database is retained for the next seed slice.

### Tests passed

- Prisma format, validation, and client generation pass.
- `pnpm db:bootstrap:verify` resets the guarded empty target, applies only source-controlled migration history, reports the database current, detects no Prisma-representable drift, and successfully introspects the result.
- `pnpm verify` passes: formatting, ESLint, package boundaries, strict core/web TypeScript, 19 unit tests, 6 integration tests (including migration SQL and destructive guards), Prisma validation, core/Next.js production builds, and 2 Chromium E2E tests.
- `pnpm check:dependencies` reports no known vulnerabilities.

### Blockers

None for this slice. Milestone 1 is not gate-passed because deterministic seed data, repositories, and remaining database integration tests are not implemented.

### Exact next work item

Create the deterministic synthetic semester seed and verify it against the retained disposable Neon database.

## 2026-09-21 — Milestone 1 deterministic seed slice: COMPLETE

Milestone 1 remains **IN PROGRESS**; its gate has not passed because persistence/repository work remains.

### What changed

- Added an entirely synthetic Fall 2026 engineering semester with fixed IDs, dates, instants, local Toronto wall-clock recurrence, and no randomness or private data.
- Represented every requested canonical entity except `PlannerRun`, intentionally omitted because no Planner Service exists yet; user-generated session history covers locks, completion, and supersession without inventing a planner execution.
- Added idempotent fixed-ID upserts, an ergonomic `pnpm db:seed` command, relational integrity assertions, and a non-destructive `pnpm db:bootstrap:seed` migrate/deploy/seed verifier.
- Guarded seed execution by environment, exact confirmation, direct connection, approved host, and unmistakable disposable database name.
- Documented fixture policy, repeat behavior, and guarded clean recreation.
- Created and retained empty disposable database `up_m1_seed_20260921` on Neon branch `milestone-1-migration-bootstrap-20260921` for the proof and next persistence slice.

### Tests passed

- Empty database → `prisma migrate deploy` → seed → integrity assertions passed.
- A second seed and the full assertions passed with unchanged record counts, proving idempotent repeat behavior.
- Assertions verify ownership, parent/subtask and dependency links, work-session history, completion linkage, null estimates/deadlines, date-only and local-time round trips, recurrence fields, credential-free disconnected integration metadata, and external identity uniqueness.
- `pnpm verify` passes: formatting, ESLint, package boundaries, strict core/web TypeScript, 19 unit tests, 13 integration tests, Prisma validation, core/Next.js production builds, and 2 Chromium E2E tests.
- `pnpm check:dependencies` reports no known vulnerabilities.

### Blockers

None for this slice. Milestone 1 is not gate-passed because the persistence/repository boundary and remaining database integration tests are not implemented.

### Exact next work item

Implement and test the persistence/repository boundary over the canonical Prisma model.

## 2026-09-21 — Milestone 1 time foundation: COMPLETE

Milestone 1 remains **IN PROGRESS**; its gate has not passed.

### What changed

- Centralized canonical half-open interval creation, overlap, containment, intersection, merge, normalization, subtraction, deterministic ordering, and window splitting in `packages/shared`.
- Added strict elapsed-minute calculations, five-minute scheduling-quantum helpers, calendar-date arithmetic, explicit IANA timezone conversion, and local representations with offsets.
- Added bounded daily/weekly recurrence expansion that reconstructs each occurrence from wall-clock time and timezone, preserving Toronto local time across DST.
- Documented deterministic DST policy in ADR 0002: ambiguous times choose earlier by default with later/reject options; direct nonexistent times reject, while recurrence skips nonexistent occurrences unless strict rejection is requested.
- Refactored planner-core to consume shared intersection/subtraction logic without changing scheduling policy.
- Added no external dependency: native `Date` and `Intl.DateTimeFormat` are normalized behind the shared API. Domain now declares its internal workspace dependency on `shared` so the time vocabulary has one owner.

### Tests passed

- 13 focused shared-time unit tests, including Toronto's 2026 spring-forward and fall-back transitions.
- `pnpm verify` passes: formatting, ESLint, package boundaries, strict core/web TypeScript, 19 total unit tests, 2 integration tests, Prisma validation, core/Next.js production builds, and 2 Chromium E2E tests.

### Blockers

None. Migration history remains intentionally absent.

### Exact next work item

Establish the first source-controlled Prisma migration against disposable Neon.

## 2026-09-22 — Milestone 1 persistence boundary slice: COMPLETE

Milestone 1 remains **IN PROGRESS**; the final exit gate and PR are still outstanding.

### What changed

- Added the server-only production database client with development hot-reload reuse, production process reuse, explicit test construction, and an ambient production-connection guard during tests.
- Added explicit user-scoped repositories for all 19 canonical entities, grouped by domain vocabulary rather than a generic base abstraction.
- Added a transaction context that binds all repositories to one Prisma transaction and allows failures to propagate for full rollback.
- Added plain record contracts and deliberate temporal/decimal/JSON mapping so Prisma-generated types remain database-package implementation details.
- Added structured constraint-error inspection and strengthened package boundaries so domain, planner-core, web, and other packages cannot import Prisma or pg.
- Documented the persistence boundary, connection lifecycle, ownership strategy, transaction behavior, and guarded live-test procedure.

### Tests passed

- Repository integration tests against disposable Neon cover the deterministic seed, all canonical repository families, create/read/update/archive behavior, cross-user scoping, task hierarchy/dependencies, work-session supersession, JSON, date-only and instant round trips, external-identity uniqueness, and forced transaction rollback.
- Static integration checks confirm the public contracts do not expose Prisma types and downstream packages do not depend on the database package.
- `pnpm verify` passes: formatting, ESLint, package boundaries, strict core/database/web TypeScript, 19 unit tests, 15 integration tests, Prisma validation, core/database/Next.js production builds, and 2 Chromium E2E tests.
- The guarded live Neon repository suite passes 4 tests, and `pnpm check:dependencies` reports no known vulnerabilities.

### Blockers

None for this slice. Authentication, authorization, application services, API routes, planner persistence, integrations, and production UI data loading remain deliberately outside Milestone 1.

### Exact next work item

Run the full Milestone-1 exit-gate verification and open the Milestone-1 PR.

## 2026-09-22 — Milestone 1: GATE PASSED

Every literal Milestone-1 exit criterion is satisfied. The detailed evidence and residual-risk review are recorded in [Milestone 1 exit gate](./milestone-1-exit-gate.md).

### Final fixes

- Removed the final host-local time dependency from planner-core: late-work policy now converts instants using the user's explicit IANA timezone through `packages/shared`.
- Split nullable canonical `Task` facts from the validated `PlannableTask` input so unknown estimates remain unknown until a later application service deliberately resolves them.
- Added explicit bounded transaction startup/runtime limits to the atomic seed after a fresh-Neon reproducibility run exposed a transient transaction-start timeout.

### Exit-gate proof

- Migration `0001_canonical_foundation` deployed from zero and reported current on fresh database `up_m1_seed_final_20260922`; drift comparison reported no difference and introspection succeeded.
- The deterministic synthetic semester seeded successfully, all four live repository integration tests passed, and fixture integrity assertions passed.
- A second untouched blank database, `up_m1_seed_final_repro_20260922`, independently deployed migration history, reported current, seeded, passed integrity assertions, and repeated the idempotent seed plus assertions successfully.
- Toronto spring-forward, fall-back, ambiguous/nonexistent local-time, recurrence, interval algebra, and explicit planner-timezone tests passed.
- Repository-wide searches and package checks found no Prisma access outside `packages/database`, production fixture imports, committed credentials, Milestone-2 implementation, or competing wall-clock implementation.
- `pnpm verify` passed formatting, ESLint, package boundaries, strict core/database/web TypeScript, 20 unit tests, 15 integration tests, Prisma validation, core/database/Next.js production builds, and 2 Chromium E2E tests.
- Prisma formatting and client generation passed; the guarded live Neon repository suite passed 4 tests; `pnpm check:dependencies` reported no known vulnerabilities.

### Remaining known risks

- Authorization enforcement, trusted request validation, dependency-cycle validation, and application error mapping belong to Milestone 2; the schema and repositories are authorization-ready but do not impersonate those services.
- The canonical recurrence implementation intentionally supports the documented MVP daily/weekly subset. Provider-specific recurrence translation remains integration work.
- The disposable acceptance branch contains synthetic data only and expires automatically on 2026-09-29.

### Exact next work item

Begin **Milestone 2 — Authentication, Authorization, Validation, and Application Services** after this milestone's pull request is reviewed and merged.
