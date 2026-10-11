# Dependency policy

- Prefer platform and framework capabilities before adding a library.
- Keep one library per concern unless a recorded decision explains the overlap.
- Pin direct dependencies exactly; update intentionally with tests and release-note review.
- Review maintenance activity, license, security history, bundle/runtime cost, and transitive dependencies before adoption.
- Do not add a convenience dependency for code that is clearer and safer to own locally.
- Production dependencies require a concrete current milestone use; provider SDKs are not installed merely because a later roadmap milestone names the provider.
- Pull requests run GitHub dependency review and reject high-severity vulnerabilities plus GPL-3.0/AGPL-3.0 additions unless an explicit decision changes the policy.
- `pnpm check:dependencies` is the local registry-backed audit command.

The stabilization security update pins Next.js/its ESLint configuration to 16.3.8 and scopes compatible transitive patches to `next>sharp` 0.35.5 and `postcss>source-map-js` 1.2.2. Retire these pins when the adopted upstream versions resolve patched dependencies without them.

## Temporary development-dependency advisory exception (accepted 2026-10-10)

**This is explicit risk acceptance, not a security fix.** The single GHSA allowlisted in `pnpm-workspace.yaml` is [`GHSA-vfj7-8cjw-p6xm`](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), affecting `braces@3.0.3`. At review time, upstream listed no patched version. Deeply nested, attacker-controlled brace patterns can exhaust the Node.js call stack and terminate a process. Do not pass untrusted patterns to development glob tooling.

At stabilization PR #10 head `efc03d6`, the known dependency path was development-only: `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. No production dependency path or University Planner input-to-glob exploit path was identified in the audit; this is **not** proof that all future uses are safe. The production dependency audit found no known vulnerabilities.

The full registry-backed `pnpm check:dependencies` audit remains required, with **only this named GHSA** excluded; every other high/critical advisory still fails. GitHub CI must run this audit and the separate GitHub dependency-review workflow remains required. pnpm reports explicitly ignored advisories separately; do not describe that result as an unqualified clean audit. Do not use `--ignore-unfixable`, broad ignores, or blanket severity reductions.

**Mandatory review:** by **2026-11-10**, upon a patched upstream release, whenever the development/production dependency graph changes, and **before any public deployment**, whichever occurs first. Recheck the actual dependency chain and upstream advisory; remove this allowlist immediately when a safe upgrade path exists. If this dependency becomes production-reachable or processes untrusted inputs, withdraw the exception and reassess before merging or deploying. A later review must explicitly renew any extension rather than assuming indefinite acceptance.
