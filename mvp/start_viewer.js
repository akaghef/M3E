"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawnSync, exec } = require("child_process");

const ROOT = __dirname;
const PORT = 4173;
const DEFAULT_PAGE = "viewer.html";

const MIME_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

function safeResolve(urlPath) {
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

function runSampleGeneration() {
  const rapidPath = path.join(ROOT, "rapid_mvp.js");
  const run = spawnSync(process.execPath, [rapidPath], {
    cwd: ROOT,
    stdio: "inherit",
  });

  if (run.status !== 0) {
    process.exit(run.status || 1);
  }
}

function sendFile(res, target) {
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

function openBrowser(url) {
  // Open default browser on Windows (Edge if Edge is default browser).
  exec(`start "" "${url}"`);
}

function startServer() {
  const server = http.createServer((req, res) => {
    const target = safeResolve(req.url || "/");
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
