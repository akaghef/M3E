"use strict";

/**
 * E2E test server for Playwright.
 *
 * Uses the full application server (createAppServer) with a temporary SQLite
 * database so tests are isolated and do not interfere with real data.
 *
 * Environment variables:
 *   M3E_PORT       – port to listen on (default 14173)
 *   M3E_DATA_DIR   – override data directory (set automatically by this script)
 *   M3E_DB_FILE    – override database filename (set automatically)
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

// Create a temporary data directory for E2E tests.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-e2e-"));
const testDbFile = "e2e_test.sqlite";

// Set environment BEFORE requiring the app server so it picks up the temp paths.
process.env.M3E_PORT = process.env.M3E_PORT || "14173";
process.env.M3E_DATA_DIR = tmpDir;
process.env.M3E_DB_FILE = testDbFile;

// Ensure sample data is generated into the temp directory.
const ROOT = __dirname;
const rapidPath = path.join(ROOT, "dist", "node", "rapid_mvp.js");
const run = spawnSync(process.execPath, [rapidPath], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, M3E_DATA_DIR: tmpDir, M3E_DB_FILE: testDbFile },
});

if (run.status !== 0) {
  console.error("Failed to generate sample data for E2E tests.");
  process.exit(run.status || 1);
}

// Now load the compiled app server.
const { createAppServer } = require("./dist/node/start_viewer");

const PORT = Number(process.env.M3E_PORT);
const server = createAppServer();

server.listen(PORT, "127.0.0.1", () => {
  console.log(`E2E test server ready: http://127.0.0.1:${PORT}/viewer.html`);
  console.log(`  Data dir: ${tmpDir}`);
  console.log(`  DB file:  ${testDbFile}`);
});

// Clean up temp directory on exit.
function cleanup() {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(`Cleaned up temp dir: ${tmpDir}`);
  } catch {
    // best-effort cleanup
  }
}

process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
