# Dependency policy

- Prefer platform and framework capabilities before adding a library.
- Keep one library per concern unless a recorded decision explains the overlap.
- Pin direct dependencies exactly; update intentionally with tests and release-note review.
- Review maintenance activity, license, security history, bundle/runtime cost, and transitive dependencies before adoption.
- Do not add a convenience dependency for code that is clearer and safer to own locally.
- Production dependencies require a concrete current milestone use; provider SDKs are not installed merely because a later roadmap milestone names the provider.
- Pull requests run GitHub dependency review and reject high-severity vulnerabilities plus GPL-3.0/AGPL-3.0 additions unless an explicit decision changes the policy.
- `pnpm check:dependencies` is the local registry-backed audit command.

The stabilization security update pins Next.js/its ESLint configuration to 16.3.8 and scopes compatible transitive patches to `next>sharp` 0.35.5 and `postcss>source-map-js` 1.2.2. Retire these pins when the adopted upstream versions resolve patched dependencies without them. The development-only `braces` advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no published patch; it remains visible and blocks the full audit rather than being ignored.
