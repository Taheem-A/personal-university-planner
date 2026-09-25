import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const allowedInternalImports = {
  analytics: new Set([]),
  assistant: new Set(["domain"]),
  database: new Set(["domain", "shared"]),
  domain: new Set(["shared"]),
  integrations: new Set(["domain", "shared"]),
  "planner-core": new Set(["domain", "shared"]),
  shared: new Set([]),
  web: new Set([
    "analytics",
    "assistant",
    "domain",
    "integrations",
    "planner-core",
    "shared",
    "database",
  ]),
};

const roots = [path.join(repositoryRoot, "packages"), path.join(repositoryRoot, "apps")];
const sourceFiles = [];
const plannerManifestPath = path.join(repositoryRoot, "packages/planner-core/package.json");
const plannerManifest = existsSync(plannerManifestPath)
  ? JSON.parse(readFileSync(plannerManifestPath, "utf8"))
  : {};
const allowedPlannerDependencies = new Set([
  "@university-planner/domain",
  "@university-planner/shared",
]);

function collect(directory) {
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) collect(fullPath);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry)) sourceFiles.push(fullPath);
  }
}

for (const root of roots) {
  if (statSync(root).isDirectory()) collect(root);
}

function ownerOf(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  const match = normalized.match(/\/(?:packages|apps)\/([^/]+)\//);
  return match?.[1];
}

function targetOf(importerPath, specifier) {
  if (specifier.startsWith("@university-planner/")) return specifier.split("/")[1];
  if (!specifier.startsWith(".")) return undefined;
  return ownerOf(path.resolve(path.dirname(importerPath), specifier));
}

const violations = [];
for (const field of [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
]) {
  for (const name of Object.keys(plannerManifest[field] ?? {})) {
    if (!allowedPlannerDependencies.has(name)) {
      violations.push(`packages/planner-core/package.json: planner-core cannot depend on ${name}`);
    }
  }
}
const importPattern = /(?:from\s+|import\s*\(|import\s+|require\s*\()\s*["']([^"']+)["']/g;

for (const filePath of sourceFiles) {
  const owner = ownerOf(filePath);
  if (!owner || !allowedInternalImports[owner]) continue;
  const source = readFileSync(filePath, "utf8");
  const relativeFile = path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
  if (owner === "planner-core") {
    // Bare imports and the manifest allowlist are insufficient if runtime code can
    // reach ambient state or hide a dependency behind a computed import.
    const forbiddenAmbient =
      /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|globalThis|document|localStorage|sessionStorage|navigator)\b|\bprocess\s*\.\s*env\b|\b(?:Date\.now|Math\.random)\s*\(|\bnew\s+Date\s*\(\s*\)/;
    if (forbiddenAmbient.test(source))
      violations.push(
        `${relativeFile}: planner-core cannot use ambient IO, mutable state or implicit time`,
      );
    if (/\b(?:import|require)\s*\(\s*(?!["'])/.test(source))
      violations.push(`${relativeFile}: planner-core imports must use literal specifiers`);
  }
  const isTransport =
    owner === "web" &&
    (relativeFile.startsWith("apps/web/src/app/") || /^\s*["']use server["']/.test(source));
  const isClient = owner === "web" && /^\s*["']use client["']/.test(source);
  const isProductionWebSource = owner === "web" && relativeFile.startsWith("apps/web/src/");
  const previewFixtureSignature =
    /\b(?:CIV100|MAT186|MAT188|APS100|APS110|APS111)\b|Robarts Library|BA 1170|SF 1101|GB 248|September 16, 2025/;
  if (isProductionWebSource && previewFixtureSignature.test(source)) {
    violations.push(
      `${relativeFile}: production UI contains an approved-preview fixture signature`,
    );
  }
  if (isClient && /\b(?:import|require)\s*\(\s*(?!["'])/.test(source)) {
    violations.push(`${relativeFile}: client imports must use literal specifiers`);
  }
  if (
    isTransport &&
    /\b(?:applicationDatabase|createDatabase|getDatabase)\s*\(|\.(?:repositories|\$queryRaw|\$executeRaw)\b/.test(
      source,
    )
  ) {
    violations.push(`${relativeFile}: transport cannot query the database or repositories`);
  }
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    const target = targetOf(filePath, specifier);
    const resolvedSpecifier = path.resolve(path.dirname(filePath), specifier).replaceAll("\\", "/");
    const fixtureSource =
      /(?:^|\/)(?:prototypes\/approved-preview|docs\/regression-reference|tests)(?:\/|$)/;
    if (
      isProductionWebSource &&
      (fixtureSource.test(specifier.replaceAll("\\", "/")) || fixtureSource.test(resolvedSpecifier))
    )
      violations.push(
        `${relativeFile}: production web source cannot import preview or test fixtures`,
      );
    if (
      isTransport &&
      (target === "database" ||
        (specifier.startsWith(".") &&
          /\/apps\/web\/src\/server\/(?:database|application\/(?:authorization|transaction|service))(?:\.|\/|$)/.test(
            path.resolve(path.dirname(filePath), specifier).replaceAll("\\", "/"),
          )))
    ) {
      violations.push(
        `${relativeFile}: transport may import services, auth or transport adapters only`,
      );
    }
    if (
      owner === "web" &&
      isClient &&
      specifier.startsWith(".") &&
      path
        .resolve(path.dirname(filePath), specifier)
        .replaceAll("\\", "/")
        .includes("/apps/web/src/server/")
    ) {
      violations.push(`${relativeFile}: client components cannot import server application code`);
    }
    if (
      owner === "web" &&
      target === "database" &&
      !relativeFile.startsWith("apps/web/src/server/")
    ) {
      violations.push(`${relativeFile}: only the web server application area may import database`);
    }
    if (
      owner === "web" &&
      /^(?:next-auth|@auth)(?:\/|$)/.test(specifier) &&
      !(isClient && specifier === "next-auth/react") &&
      !relativeFile.startsWith("apps/web/src/server/") &&
      !relativeFile.startsWith("apps/web/src/app/api/auth/")
    ) {
      violations.push(`${relativeFile}: Auth.js belongs in the web server application area`);
    }
    if (target && target !== owner && !allowedInternalImports[owner].has(target)) {
      violations.push(
        `${path.relative(repositoryRoot, filePath)}: ${owner} cannot import ${target}`,
      );
    }
    if (
      owner === "planner-core" &&
      !specifier.startsWith(".") &&
      !allowedPlannerDependencies.has(specifier)
    ) {
      violations.push(
        `${path.relative(repositoryRoot, filePath)}: planner-core cannot import ${specifier}`,
      );
    }
    if (owner !== "database" && /^(?:@prisma|pg|@prisma\/adapter-pg)(?:\/|$)/.test(specifier)) {
      violations.push(
        `${path.relative(repositoryRoot, filePath)}: only database may import ${specifier}`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log(`Package boundaries passed (${sourceFiles.length} source files checked).`);
