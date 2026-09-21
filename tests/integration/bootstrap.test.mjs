import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("production web is a Next.js workspace and preview remains separate", async () => {
  const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
  const webPackage = JSON.parse(await readFile("apps/web/package.json", "utf8"));

  assert.ok(rootPackage.workspaces.includes("apps/*"));
  assert.equal(webPackage.name, "@university-planner/web");
  assert.equal(webPackage.dependencies.next, "16.3.3");

  const productionPage = await readFile("apps/web/src/app/page.tsx", "utf8");
  assert.doesNotMatch(productionPage, /preview\/app|fixture schedule/i);

  const preview = await readFile("preview/index.html", "utf8");
  assert.match(preview, /University Planner/i);
});

test("environment template contains bootstrap boundaries without real secrets", async () => {
  const example = await readFile(".env.example", "utf8");
  for (const key of [
    "APP_ENV",
    "DATABASE_URL",
    "AUTH_SECRET",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "SENTRY_DSN",
  ]) {
    assert.match(example, new RegExp(`^${key}=`, "m"));
  }
  assert.doesNotMatch(example, /AIza[0-9A-Za-z_-]{20,}/);
});
