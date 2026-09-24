# Planner regression fixtures

This directory holds deterministic synthetic planner inputs. The dates, course names and people are invented; no private production data belongs here. Tests should assert behavioral invariants and use exact placements only when time or ordering itself is the contract.

When real usage exposes a bad planner decision:

1. Reduce it to the smallest synthetic reproduction.
2. Add the reproduction and a failing assertion to the permanent scenario or regression suite.
3. Fix the planner behavior.
4. Keep the regression fixture and test permanently.

`semester.js` defines reusable Toronto engineering-semester inputs. `tests/unit/planner-scenarios.test.js` is the Milestone-3 canonical scenario matrix.
