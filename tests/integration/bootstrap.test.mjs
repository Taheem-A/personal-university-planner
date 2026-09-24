import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
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

test("planner boundary rejects external imports and manifest dependencies", () => {
  const root = mkdtempSync(path.join(tmpdir(), "planner-boundary-"));
  const checker = path.resolve("scripts/check-package-boundaries.mjs");
  try {
    mkdirSync(path.join(root, "packages/planner-core/src"), { recursive: true });
    mkdirSync(path.join(root, "apps"));
    const source = path.join(root, "packages/planner-core/src/index.ts");
    const manifest = path.join(root, "packages/planner-core/package.json");
    writeFileSync(manifest, JSON.stringify({ dependencies: {} }));
    writeFileSync(source, 'import "node:net";\n');
    let result = spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /planner-core cannot import node:net/);

    writeFileSync(source, "export const pure = true;\n");
    writeFileSync(manifest, JSON.stringify({ dependencies: { "@prisma/client": "1.0.0" } }));
    result = spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /planner-core cannot depend on @prisma\/client/);

    writeFileSync(manifest, JSON.stringify({ dependencies: {} }));
    for (const forbidden of [
      "const value = await import(`@university-planner/database`);\n",
      "export const current = Date.now();\n",
      "export const remote = fetch('/api/plan');\n",
      "export const settings = process.env.PLANNER_MODE;\n",
    ]) {
      writeFileSync(source, forbidden);
      result = spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8" });
      assert.equal(result.status, 1, forbidden);
      assert.match(
        result.stderr,
        /planner-core (?:imports must use literal specifiers|cannot use ambient IO)/,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
