import { readFileSync, readdirSync, statSync } from "node:fs";
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
const importPattern = /(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;

for (const filePath of sourceFiles) {
  const owner = ownerOf(filePath);
  if (!owner || !allowedInternalImports[owner]) continue;
  const source = readFileSync(filePath, "utf8");
  const relativeFile = path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
  const isTransport =
    owner === "web" &&
    (relativeFile.startsWith("apps/web/src/app/") || /^\s*["']use server["']/.test(source));
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
      /^\s*["']use client["']/.test(source) &&
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
      /^(?:next|react|@prisma|@auth|openai|ai)(?:\/|$)/.test(specifier)
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
