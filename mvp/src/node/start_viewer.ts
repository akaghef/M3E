"use strict";

import fs from "fs";
import path from "path";
import http from "http";
import { spawnSync, exec } from "child_process";

// After compilation, this file lives at dist/node/start_viewer.js.
// ROOT must point two levels up to the mvp/ directory.
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = 4173;
const DEFAULT_PAGE = "viewer.html";

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mm": "application/xml; charset=utf-8",
};

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function safeResolve(urlPath: string): string | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  const clean = decodeURIComponent(pathname).replace(/^\/+/, "");
  const rel = clean === "" ? DEFAULT_PAGE : clean;
  const abs = path.resolve(ROOT, rel);

  const relative = path.relative(ROOT, abs);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return abs;
}

function runSampleGeneration(): void {
  // Spawn the compiled rapid_mvp.js in the dist/node/ sibling directory.
  const rapidPath = path.join(ROOT, "dist", "node", "rapid_mvp.js");
  const run = spawnSync(process.execPath, [rapidPath], {
    cwd: ROOT,
    stdio: "inherit",
  });

  if (run.status !== 0) {
    process.exit(run.status ?? 1);
  }
}

function sendFile(res: http.ServerResponse, target: string): void {
  fs.stat(target, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    res.setHeader("Content-Type", mimeType(target));
    fs.createReadStream(target).pipe(res);
  });
}

function openBrowser(url: string): void {
  // Open default browser on Windows.
  exec(`start "" "${url}"`);
}

function startServer(): void {
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    const target = safeResolve(req.url ?? "/");
    if (!target) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    sendFile(res, target);
  });

  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}/${DEFAULT_PAGE}`;
    console.log(`Viewer ready: ${url}`);
    openBrowser(url);
    console.log("Press Ctrl+C to stop the server.");
  });
}

runSampleGeneration();
startServer();
