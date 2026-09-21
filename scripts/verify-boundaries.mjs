import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const plannerRoot = path.join(root, "packages", "planner-core", "src");
const forbidden = [
  /(?:from|require\()\s*["'][^"']*database/i,
  /(?:from|require\()\s*["'][^"']*assistant/i,
  /(?:from|require\()\s*["'][^"']*integrations/i,
  /(?:from|require\()\s*["'][^"']*apps/i,
  /(?:from|require\()\s*["']next(?:\/|["'])/,
  /(?:from|require\()\s*["']react(?:\/|["'])/,
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

const violations = [];
for (const file of await walk(plannerRoot)) {
  const source = await readFile(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(source)) {
      violations.push(`${path.relative(root, file)} matched ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  console.error("planner-core boundary violations:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("planner-core boundary check passed");
