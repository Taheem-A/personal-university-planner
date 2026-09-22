import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("database public contracts do not expose Prisma implementation types", () => {
  const publicFiles = [
    "packages/database/src/index.ts",
    "packages/database/src/records.ts",
    "packages/database/src/repositories/types.ts",
  ];
  const publicSurface = publicFiles.map((file) => readFileSync(file, "utf8")).join("\n");

  assert.doesNotMatch(publicSurface, /from ["']@prisma/);
  assert.doesNotMatch(publicSurface, /Prisma(?:Client|\.)/);
  assert.doesNotMatch(readFileSync("packages/database/src/index.ts", "utf8"), /internal/);
});

test("framework-independent domain and planner do not depend on the database package", () => {
  for (const file of ["packages/domain/package.json", "packages/planner-core/package.json"]) {
    const manifest = readFileSync(file, "utf8");
    assert.doesNotMatch(manifest, /@university-planner\/database/);
  }
  assert.match(readFileSync("apps/web/package.json", "utf8"), /@university-planner\/database/);
});
