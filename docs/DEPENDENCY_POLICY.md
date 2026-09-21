# Dependency policy

Dependencies must earn their place in the production application.

## Rules

1. Prefer platform/framework capability before adding a library.
2. Use one primary library per concern.
3. Add a dependency only when the milestone actively uses it; do not pre-install speculative packages.
4. Check maintenance activity, license, security posture, and framework compatibility before adoption.
5. Keep planner-core free from database, network, UI, React/Next, and AI dependencies.
6. External UI components must be normalized to the project's frozen tokens, accessibility, and interaction contract.
7. Dependency upgrades that change planner, persistence, authentication, time, or migration semantics require explicit review and a decision record when cross-cutting.
8. Lockfile changes are reviewed as code.
