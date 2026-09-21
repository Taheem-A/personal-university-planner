import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("workspace exposes every frozen modular-monolith boundary", () => {
  const workspace = readFileSync("pnpm-workspace.yaml", "utf8");
  const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));

  assert.match(workspace, /apps\/\*/);
  assert.match(workspace, /packages\/\*/);
  assert.equal(rootPackage.packageManager, "pnpm@12.5.1");
  assert.equal(rootPackage.engines.node, ">=24.21.0 <25");
});

test("package-boundary policy passes against the real source tree", () => {
  const result = spawnSync(process.execPath, ["scripts/check-package-boundaries.mjs"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Package boundaries passed/);
});
