# Milestone 3 canonical planner scenarios

Status on `plan/milestone-3-planner-core-v1`: **13/13 pass locally**. Milestone 3 remains **IN PROGRESS** until the randomized property/invariant suite, determinism/version proof and literal exit-gate audit pass.

Run `pnpm test:planner-scenarios` to execute [the permanent suite](../tests/unit/planner-scenarios.test.js). Its shared [fixtures and regression rule](../tests/fixtures/planner/README.md) use only synthetic engineering-semester data with explicit Toronto instants. Every scenario checks deterministic repeated output, input purity, planner version, ordered sessions, workload conservation and reason/warning consistency where applicable. Successful results also pass the public hard validator.

| #   | Scenario              | Executable contract                                                                                                                               | Local result |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | Normal week           | CIV100/MAT186/APS work fits; hard class, protected leisure and sleep remain untouched; capacity slack stays positive.                             | PASS         |
| 2   | Overloaded week       | Pressure rises, negative slack and missing work are quantified; generated sessions do not consume sleep or hard time.                             | PASS         |
| 3   | Skipped session       | Post-skip remaining work is replanned; unaffected future session intent remains.                                                                  | PASS         |
| 4   | Partial completion    | Reduced remaining work is conserved; useful future sessions are retained.                                                                         | PASS         |
| 5   | Early finish          | Completed work disappears; released capacity follows `KEEP_FREE`, `REPLAN_IF_USEFUL` and `ALWAYS_REPLAN`.                                         | PASS         |
| 6   | New urgent task       | New MAT188 work receives deadline pressure and is scheduled while prior work is retained where possible.                                          | PASS         |
| 7   | Cancelled class       | Exposed class capacity stays free or is reused according to the explicit released-time policy.                                                    | PASS         |
| 8   | Deadline move         | Earlier due time increases pressure and moves work before the true deadline; a soft free-time limit cannot create false infeasibility.            | PASS         |
| 9   | Hard lock             | The fixed user session remains exact and other work adapts.                                                                                       | PASS         |
| 10  | Saturday off          | Pure preview preserves unaffected sessions, moves the necessary Saturday session, reports capacity/risk deltas and rejects an impossible variant. | PASS         |
| 11  | Insufficient capacity | Required 60 minutes, suitable 30 minutes and missing 30 minutes are reported exactly.                                                             | PASS         |
| 12  | Commute policy        | Transit work requires user opt-in and task compatibility; handwriting work never enters transit capacity.                                         | PASS         |
| 13  | DST boundary          | Weekly 09:00 Toronto availability becomes 13:00Z before and 14:00Z after fall DST; sessions retain local morning intent.                          | PASS         |

The scenario suite exposed one algorithm defect: a soft daily free-time preference could shorten a session and strand otherwise feasible work before an earlier deadline. Allocation now retries without that soft preference only when the preferred attempt leaves work unplaced, and it keeps the retry only when more required work fits. Hard constraints remain unchanged; the resulting soft-policy compromise is warned.
