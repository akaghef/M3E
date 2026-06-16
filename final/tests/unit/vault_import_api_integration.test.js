import { test, expect, beforeAll, afterAll } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server;
let baseUrl;
let dataDir;
let vaultDir;
let createAppServer;
let RapidMvpModel;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "m3e-vault-api-"));
}

function writeFile(rootDir, relativePath, content) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
}

function parseSse(text) {
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? null;
      const dataLine = lines.find((line) => line.startsWith("data: "));
      return {
        event,
        data: dataLine ? JSON.parse(dataLine.slice(6)) : null,
      };
    })
    .filter((entry) => entry.event);
}

beforeAll(async () => {
  dataDir = tmpDir();
  vaultDir = tmpDir();
  writeFile(vaultDir, "index.md", "# Imported Root");
  writeFile(vaultDir, "notes/child.md", "Child body with [[index]].");

  process.env.M3E_DATA_DIR = dataDir;
  process.env.M3E_DB_FILE = "vault-api.sqlite";

  const startViewerPath = require.resolve("../../dist/node/start_viewer.js");
  delete require.cache[startViewerPath];
  ({ createAppServer } = require(startViewerPath));
  ({ RapidMvpModel } = require("../../dist/node/rapid_mvp.js"));

  server = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  delete process.env.M3E_DATA_DIR;
  delete process.env.M3E_DB_FILE;
  if (server) {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
  if (vaultDir) fs.rmSync(vaultDir, { recursive: true, force: true });
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

test("POST /api/vault/import streams progress and persists map", async () => {
  const response = await fetch(`${baseUrl}/api/vault/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      vaultPath: vaultDir,
      mapId: "vault-api-map",
    }),
  });

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");

  const events = parseSse(await response.text());
  expect(events.some((entry) => entry.event === "vault-import-progress" && entry.data.phase === "discovery")).toBe(true);
  expect(events.some((entry) => entry.event === "vault-import-progress" && entry.data.phase === "parse")).toBe(true);

  const complete = events.find((entry) => entry.event === "vault-import-complete");
  expect(complete).toBeTruthy();
  expect(complete.data.mapId).toBe("vault-api-map");
  expect(complete.data.fileCount).toBe(2);

  const dbPath = path.join(dataDir, "vault-api.sqlite");
  const loaded = RapidMvpModel.loadFromSqlite(dbPath, "vault-api-map");
  expect(loaded.validate()).toEqual([]);
  expect(Object.values(loaded.state.nodes).some((node) => node.text === "index")).toBe(true);
  expect(Object.values(loaded.state.nodes).some((node) => node.text === "child")).toBe(true);
});

test("POST /api/vault/import rejects missing vaultPath", async () => {
  const response = await fetch(`${baseUrl}/api/vault/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({}),
  });
  const payload = await response.json();
  expect(response.status).toBe(400);
  expect(payload.ok).toBe(false);
  expect(payload.error).toMatch(/vaultPath/);
});

test("POST /api/vault/import rejects protected system paths", async () => {
  const protectedPath = process.platform === "win32"
    ? path.join(process.env.SystemRoot || "C:\\Windows", "System32")
    : "/etc";
  const response = await fetch(`${baseUrl}/api/vault/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ vaultPath: protectedPath }),
  });
  const payload = await response.json();
  expect(response.status).toBe(400);
  expect(payload.ok).toBe(false);
  expect(payload.error).toMatch(/protected system directory/);
});
