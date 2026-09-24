# Milestone 3 exit gate

Authority: _University Planner — Implementation Roadmap_, Milestone 3, for sequencing and the literal gate; _Personal University Planning System_, planning engine, pipeline, heuristic, invariants, stability, scenarios and testing strategy, for behavior. This audit concerns pure `heuristic-v1` only. Planner service, `PlannerRun` persistence, replan triggers, production UI and scenario application remain Milestone 4 or later.

## Literal roadmap checklist

| Requirement                                                                                             | Implementation evidence                                                                 | Test evidence                                                                                     | Verdict |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------- |
| 1. Explicit input assembled outside core                                                                | Plain `PlannerInput` in `packages/domain/src/index.ts`; `index.ts` accepts the snapshot | Contract and normalization cases in `planner.test.js`                                             | PASS    |
| 2. Normalize recurrence, timezone, estimates, completion, availability, dependencies and hard intervals | `input.ts`, shared `time.ts`                                                            | Planner normalization and shared time tests; DST canonical case                                   | PASS    |
| 3. Eligibility                                                                                          | `eligibility.ts`                                                                        | Planner task-state/dependency tests; randomized sweep                                             | PASS    |
| 4. Occupied timeline                                                                                    | `timeline.ts` merges hard event, sleep, lock, manual and hard protected intervals       | Timeline unit cases; canonical normal/overloaded/lock cases; randomized sweep                     | PASS    |
| 5. Candidate windows with capability and capacity                                                       | `windows.ts` preserves energy, tags, commute kind, factor and local metadata            | Candidate unit cases; commute canonical case; randomized sweep                                    | PASS    |
| 6. Suitable capacity, slack, pressure, preferred target and risk                                        | `pressure.ts` and `TaskPressure` quantitative fields                                    | Pressure unit cases; overload/deadline canonical cases                                            | PASS    |
| 7. Documented ranking factors                                                                           | `config.ts`, `pressure.ts`, stable tie breakers                                         | Ranking unit cases, repeated-run proof                                                            | PASS    |
| 8. Useful session construction                                                                          | `allocation.ts` enforces min/preferred/max and non-splittable fit                       | Session unit cases and randomized duration/workload checks                                        | PASS    |
| 9. Sustainable buffers and fragmentation                                                                | `sustainability.ts`, allocation window/neighbor scoring                                 | Daily/free-time and fragmentation unit cases; canonical normal/overloaded cases                   | PASS    |
| 10. Near-term stability                                                                                 | `policy.ts` tiered retention and churn policy                                           | Stability tests; skipped/partial/urgent canonical cases                                           | PASS    |
| 11. Validate hard rules and accounting                                                                  | `validation.ts`; `generatePlan` calls detailed validation before output                 | Validator unit cases; canonical and randomized checks                                             | PASS    |
| 12. Deterministic repair                                                                                | `repair.ts` retries generated conflicts and revalidates                                 | Repair unit cases; canonical deadline-move regression                                             | PASS    |
| 13. Explicit infeasibility and warnings                                                                 | `diagnostics.ts`, `PlannerInfeasibility`, `PlannerWarning`                              | Exact insufficient-capacity canonical case; randomized infeasible cases                           | PASS    |
| 14. Machine-readable explanation                                                                        | `placementReasons`, `reasonsBySession`, warning reason codes                            | Reason unit cases; all 1,000 property cases assert generated placements and warnings have reasons | PASS    |

## Required behavior

| Requirement                                                | Implementation / evidence                                                                                                                        | Verdict |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| HARD / SOFT / preference hierarchy; hard protected leisure | `timeline.ts` subtracts only hard intervals; `allocation.ts` consumes soft time only when needed and warns; hard/soft unit tests                 | PASS    |
| Minimum sleep                                              | Explicit sleep intervals plus per-local-day `minimumSleepMinutes` validation in `input.ts`; sleep/DST tests                                      | PASS    |
| Commute opt-in and capability                              | `windows.ts` requires policy, task `TRANSIT_OK` and window tag; commute tests and canonical case                                                 | PASS    |
| Energy and location/capability                             | `windows.ts` enforces location, uses coarse energy productivity/fit; compatibility tests                                                         | PASS    |
| Dependencies and chains                                    | `eligibility.ts` rejects cycles, `index.ts` unlocks after prerequisite allocation, validator checks order; dependency tests                      | PASS    |
| Preferred completion vs factual deadline; deadline buffers | `pressure.ts` separates targets, `allocation.ts` places before targets where feasible, validator protects true due time; pressure/deadline tests | PASS    |
| Minimum break and maximum consecutive work                 | `allocation.ts` reserves gaps and caps sessions, `validation.ts` checks; session tests                                                           | PASS    |
| Weekend bias / Sunday concentration                        | `allocation.ts` local-day scoring; weekend tests                                                                                                 | PASS    |
| Locks, manual sessions, stability                          | `policy.ts` retains user intent and prior sessions by tier; `validation.ts` reports conflicts; policy and canonical cases                        | PASS    |
| Released-time policy                                       | `KEEP_FREE`, `REPLAN_IF_USEFUL`, `ALWAYS_REPLAN` in `index.ts`/`allocation.ts`; early-finish/cancelled-class cases                               | PASS    |
| Unknown deadline and estimate                              | Unknown due instant remains absent; caller must supply justified effective estimate, rejected otherwise; contract tests                          | PASS    |
| Impossible workload                                        | `INFEASIBLE`, task-level required/scheduled/suitable/deficit and limiting factors; exact capacity case and randomized sweep                      | PASS    |

## Canonical scenario matrix

The permanent synthetic fixtures are in `tests/fixtures/planner`, with executable contracts in `tests/unit/planner-scenarios.test.js`. The detailed behavioral assertions are in [the scenario matrix](./milestone-3-scenario-matrix.md).

| Scenario                 | Result |
| ------------------------ | ------ |
| Normal week              | PASS   |
| Overloaded week          | PASS   |
| Skipped session          | PASS   |
| Partial completion       | PASS   |
| Early finish             | PASS   |
| New urgent task          | PASS   |
| Cancelled class          | PASS   |
| Deadline move            | PASS   |
| Hard lock                | PASS   |
| Saturday off             | PASS   |
| Insufficient capacity    | PASS   |
| Commute disabled/enabled | PASS   |
| DST boundary             | PASS   |

## Invariant and proof matrix

`tests/unit/planner-properties.test.js` uses 1,000 fixed-seed generated snapshots by default. Each failing assertion prints its seed; `PLANNER_PROPERTY_SEED=<seed> pnpm test:planner-properties` replays one case. `PLANNER_PROPERTY_CASES` extends the sweep. It uses no property-testing dependency. The generator varies task state/count/work, deadlines and unknown deadlines, availability rates and capability, hard/soft events, protected time, sleep, session sizes, energy, dependencies, locks, manual/previous sessions and preferences. It asserts that valid and infeasible families both occur.

| Invariant / proof                                                       | Evidence                                                                                              | Verdict |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| No incorrect generated overlap with active generated/manual/locked work | Independent half-open overlap oracle; validator                                                       | PASS    |
| No generated hard event, hard protected or sleep overlap                | Independent interval checks; validator                                                                | PASS    |
| Task availability, true deadline, horizon and five-minute precision     | Independent per-session checks; validator                                                             | PASS    |
| Dependency order, capability/location and commute policy                | Independent dependency/work-window checks; validator                                                  | PASS    |
| Positive valid durations and task maximum                               | Independent duration checks; validator                                                                | PASS    |
| Workload conservation and no overscheduling                             | Independent per-task sums; validator                                                                  | PASS    |
| Locked/manual exact preservation; inactive tasks receive no new work    | Deep equality and generated-session checks                                                            | PASS    |
| Every output status follows validation and quantified infeasibility     | Recomputed detailed validation, status and deficit assertions                                         | PASS    |
| Input purity                                                            | Deep cloned snapshot compared after every run                                                         | PASS    |
| Major reasons/warnings structured and ordered                           | Generated placement and warning reason assertions                                                     | PASS    |
| Identical normalized input + `heuristic-v1` is deterministic            | 64 additional seeded snapshots, six deeply equal complete outputs each; canonical repeated-run checks | PASS    |
| Planner version explicit without persistence                            | Literal `PLANNER_VERSION` and `output.plannerVersion` assertions; `version.ts`                        | PASS    |
| Scenario simulation does not mutate canonical input                     | Saturday-off canonical case and scenario unit tests                                                   | PASS    |
| Regression fixture permanence                                           | `tests/fixtures/planner/README.md` rule; deadline-move and property-discovered fragments retained     | PASS    |

## Architectural isolation

`packages/planner-core/package.json` declares only domain and shared workspace dependencies. `scripts/check-package-boundaries.mjs` scans every package/app source and rejects other planner imports and manifest dependencies. It also rejects computed imports, ambient network/browser APIs, environment access, implicit wall-clock reads and randomness in planner-core; `tests/integration/bootstrap.test.mjs` proves representative negative cases. Direct source review found no database, Prisma, repository, Auth.js, Next.js, React, integration, assistant, analytics, network or mutable external-state access in planner-core. The core builds and runs from plain typed input without a service or database.

## Local verification and gate verdict

Local `pnpm verify` passed: formatting, lint, 73-source-file boundaries, Prisma generation/validation, typecheck, 98 unit tests (including 13 canonical and 2 property/determinism tests), 36 integration tests, core/database/Next.js builds and 2 Chromium E2E tests. Dedicated `pnpm test:planner-scenarios` passed 13/13 and `pnpm test:planner-properties` passed 2/2, covering 1,000 generated seeds plus 64 repeated-output cases. `pnpm check:dependencies` reported no known vulnerabilities. A local run is not a claim that GitHub CI passed. The pull request remains draft and unmerged.

**Verdict: GATE PASSED locally.** Every literal Milestone-3 exit criterion above has passing evidence. GitHub CI is tracked separately and must be inspected before final reporting. Milestone 4 has not started.
