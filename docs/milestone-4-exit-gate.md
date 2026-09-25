# Milestone 4 literal exit gate — planner service and authoritative plans

Date: 2026-09-24. Branch: `plan/milestone-4-planner-service` against `master`.

## Evidence scope and verdict

**Acceptance pending final-head GitHub CI and dependency review.** The local and disposable PostgreSQL proof below passed. The final gate will be marked passed only after both required GitHub checks succeed on the final implementation/documentation head. Milestone 5 has not started.

The source checkout contains the Milestone-4 instructions and roadmap progress, but no separate master specification or implementation-roadmap source file. This audit uses the literal Milestone-4 requirements supplied for this project, ADRs 0005/0006, the current implementation, and the Milestone-3 exit-gate evidence standard. It does not infer requirements from visual fixtures.

## Planner service and canonical input

| Roadmap responsibility                                                                           | Implementation                                                                                                                  | Automated and live evidence                                                                                                    | Status |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| One authenticated user's canonical state becomes complete explicit `PlannerInput`                | `apps/web/src/server/application/planner-input.ts`, `planner.ts`; `packages/database/src/repositories/planning-state.ts`        | `planner-service-input.test.js`; live `planner-live.integration.mjs` creates canonical semester facts and invokes real service | PASS   |
| Coherent snapshot and stale protection                                                           | Database repeatable-read `readSnapshot`; `User.planningRevision` and guarded claim in `planning-state.ts`, migrations 0008–0009 | `planner-substrate-sql.test.mjs`, `planner-authoritative.test.js`; live race and end-to-end tests                              | PASS   |
| Trigger/context horizon, explicit clock/timezone, bounded precision                              | `selectPlannerHorizon` in `planner-input.ts`, shared local time and recurrence                                                  | input/horizon/DST tests; live Toronto semester                                                                                 | PASS   |
| Previous active plan and manual/locked intent supplied                                           | `planner-input.ts`, `planner-execution.ts`, user-scoped WorkSession reads                                                       | service-input, authoritative, planner-scenario tests; live incremental replan                                                  | PASS   |
| Explicit `heuristic-v1` and independent output validation                                        | `planner-execution.ts`, core `version.ts`, `validation.ts`                                                                      | invalid-output unit tests; live run version and safe forced failure                                                            | PASS   |
| Missing facts and unknown deadlines remain explicit                                              | `planner-input.ts`; migration 0007 minimum sleep and sleep marker                                                               | missing-input/unknown-deadline/DST tests; migration replay                                                                     | PASS   |
| PlannerRun records provenance, horizon, version, input, summary, warnings, status and completion | `planner-execution.ts`, `packages/database/src/repositories/history.ts`                                                         | authoritative/persistence/read tests; live run reload, history and failure                                                     | PASS   |
| New generated sessions persist atomically; obsolete ones are superseded and retained             | `planner-execution.ts`, WorkSession repository and 0008                                                                         | authoritative/rollback tests; live generated reload and conflict supersession                                                  | PASS   |
| Manual, locked and terminal sessions follow preservation policy                                  | `planner-input.ts`, `planner-execution.ts`, WorkSession guards                                                                  | unit tests and live manual/locked preservation                                                                                 | PASS   |
| Structured delta and risk are returned and stored under durable IDs                              | `planner-execution.ts`, record contracts, read projections                                                                      | authoritative/risk/read tests; live replan delta/history reload                                                                | PASS   |

## Replan triggers

`apps/web/src/server/application/planner-triggers.ts` centralizes mutation classification and post-commit orchestration. `planner.ts` defines the typed trigger vocabulary and manual, daily, integration-batch and already-committed outcome entry points. `planner-execution.ts` persists the exact trigger and entity provenance. `planner-triggers.test.js` and `planner-authoritative.test.js` exercise the paths.

| Trigger             | Path and scope                                        | Status                  |
| ------------------- | ----------------------------------------------------- | ----------------------- |
| `MANUAL`            | Explicit generation or full replan                    | PASS                    |
| `TASK_CREATED`      | Schedulable task create                               | PASS                    |
| `TASK_UPDATED`      | Planning-relevant task edit                           | PASS                    |
| `SESSION_COMPLETED` | Callable after consistent canonical completion state  | PASS, service path only |
| `SESSION_SKIPPED`   | Callable after consistent canonical skip state        | PASS, service path only |
| `CALENDAR_CHANGED`  | Hard calendar/meeting/availability/protection changes | PASS                    |
| `DEADLINE_CHANGED`  | True deadline change                                  | PASS                    |
| `INTEGRATION_SYNC`  | Keyed batch-completion hook, no provider sync         | PASS                    |
| `DAILY_REFRESH`     | Callable refresh, no deployment scheduler             | PASS                    |

The completed/skip paths do not claim Milestone-7 outcome accounting, Undo or UI behavior. Google Calendar and background jobs are outside this gate.

## Replanning, concurrency and reads

| Requirement                                                                                  | Implementation and evidence                                                                                                                                          | Status |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Ordinary factual edits use incremental repair; explicit full is separate                     | `planner-triggers.ts`, `planner-execution.ts`; trigger, authoritative and 13 canonical scenario tests                                                                | PASS   |
| Stability window and released-time policy                                                    | Previous sessions and configured window in `planner-input.ts`; core policy; authoritative tests plus canonical near-term, early-finish and cancelled-class scenarios | PASS   |
| Risk recomputed from core diagnostics; new, worse, resolved and unchanged risk distinguished | `planner-execution.ts` summary comparison; authoritative and read tests; live quantified infeasibility                                                               | PASS   |
| Invalid/failed output cannot replace current schedule                                        | Independent service validation and transactional write; unit invalid-output/rollback tests; live forced core failure preserves active rows                           | PASS   |
| Same-user concurrent plans cannot both claim one snapshot                                    | Per-user conditional revision claim inside plan transaction; unit overlap, guarded live PostgreSQL row-lock and end-to-end overlap                                   | PASS   |
| Canonical mutation in flight rejects stale result                                            | PostgreSQL revision triggers and guarded claim; unit and both live tests                                                                                             | PASS   |
| Different users proceed independently                                                        | Per-user user-row claim; unit and live overlap                                                                                                                       | PASS   |
| Duplicate keyed event yields one result; unkeyed manual remains available                    | Unique `(user, trigger, scope, key)` identity, early scoped lookup and transactional start; unit and live duplicate tests                                            | PASS   |
| Today and Week use real state, including active schedule, risk and run metadata              | `planner-reads.ts`, authenticated routes; `planner-reads.test.js`; live Today/Week service and snapshot projections                                                  | PASS   |
| Run history and reasons are inspectable without raw input by default                         | `planner-reads.ts`, safe summary in `history.ts`; read tests and live history/reasons                                                                                | PASS   |
| Superseded/terminal/foreign/failed output absent from current plan                           | User-scoped active read filters; read, authoritative and live tests                                                                                                  | PASS   |

## Disposable PostgreSQL proof

Correct Neon project: `purple-tooth-70442528`. Expiring schema-only branch: `br-fancy-dew-b4fihzpg` (`milestone-4-final-gate-20260924`, expires 2026-09-27). Dedicated direct database: `up_m4_planner_races_final_20260924`. Only synthetic records were created; the live test removes them. No credentials or private academic data are committed. An earlier exploratory branch in another project was not used for gate evidence and expires automatically.

The dedicated database started empty. Source-controlled migrations `0001` through `0009` deployed from zero. `prisma migrate status` reported current with no failed migrations. Prisma schema-to-database diff reported **No difference detected**. The 0009 forward migration fixes a real index-name drift caused by PostgreSQL truncating the 0008 idempotency index name. `planner-substrate-sql.test.mjs` also proves the Milestone-3 0006 state upgrades through the Milestone-4 migration chain without losing canonical rows.

`pnpm db:planner:races:verify` passed 1/1 against this database: same-user row locking, user independence, stale canonical edit, keyed uniqueness and abandoned-run terminal guard. `pnpm db:planner:live:verify` passed 1/1 against the same database: real service generation, PlannerRun/version/input and generated-session reload, Today/Week projection, hard-calendar incremental conflict and superseded history, manual/locked preservation, valid quantified infeasibility, safe forced planner failure, event redelivery, two overlapping same-user planners, different-user planning during the overlap, and a canonical task mutation while a computation was paused. These are actual PostgreSQL transactions and service calls, not an in-memory repository fake. Both commands require an explicit test environment, confirmation token and direct disposable database name.

## Ordinary verification and final-head checks

Local `pnpm verify` passed: format, lint, 82-source-file package boundaries, Prisma generation/validation, strict typecheck, **140/140 unit tests**, **39/39 integration tests**, core/database/Next.js production build and **2/2 Chromium E2E tests**. Dedicated planner scenarios passed **13/13**. Planner properties passed **2/2**, covering the fixed-seed randomized invariant sweep and deterministic repeated output. `pnpm check:dependencies` found no known high-severity vulnerabilities.

GitHub Actions final-head CI: **pending**. GitHub dependency review: **pending**. These workflows are pull-request triggered, so an explicitly draft acceptance PR is used solely to obtain their final-head evidence before declaring this gate passed. The branch must remain unmerged.

## Final verdict

**PENDING** final-head GitHub CI and dependency review. After both succeed, record exact run IDs, mark Milestone 4 **GATE PASSED**, and name the next roadmap item **Milestone 5 — Production Next.js UI and Real-State Migration**. Do not implement that milestone in this branch.
