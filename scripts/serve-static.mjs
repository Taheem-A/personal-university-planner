import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

const requestedRoot = process.argv[2];
const port = Number(process.argv[3] ?? 4173);

if (!requestedRoot || !Number.isInteger(port)) {
  throw new Error("Usage: node scripts/serve-static.mjs <directory> [port]");
}

const root = path.resolve(requestedRoot);
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
]);

createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const candidate = path.resolve(root, `.${requestPath}`);
  const filePath =
    existsSync(candidate) && statSync(candidate).isDirectory()
      ? path.join(candidate, "index.html")
      : candidate;

  if (
    !filePath.startsWith(`${root}${path.sep}`) ||
    !existsSync(filePath) ||
    !statSync(filePath).isFile()
  ) {
    response.writeHead(404).end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes.get(path.extname(filePath)) ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});
