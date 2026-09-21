# Dependency policy

- Prefer platform and framework capabilities before adding a library.
- Keep one library per concern unless a recorded decision explains the overlap.
- Pin direct dependencies exactly; update intentionally with tests and release-note review.
- Review maintenance activity, license, security history, bundle/runtime cost, and transitive dependencies before adoption.
- Do not add a convenience dependency for code that is clearer and safer to own locally.
- Production dependencies require a concrete current milestone use; provider SDKs are not installed merely because a later roadmap milestone names the provider.
- Pull requests run GitHub dependency review and reject high-severity vulnerabilities plus GPL-3.0/AGPL-3.0 additions unless an explicit decision changes the policy.
- `pnpm check:dependencies` is the local registry-backed audit command.
