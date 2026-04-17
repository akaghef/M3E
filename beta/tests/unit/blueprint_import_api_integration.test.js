import { test, expect, beforeAll, afterAll } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server;
let baseUrl;
let dataDir;
let blueprintDir;
let createAppServer;
let RapidMvpModel;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "m3e-blueprint-api-"));
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
  blueprintDir = tmpDir();
  writeFile(blueprintDir, "web.tex", `\\documentclass{report}
\\title{API Blueprint}
`);
  writeFile(blueprintDir, "chapter/main.tex", `\\input{chapter/core}
`);
  writeFile(blueprintDir, "chapter/core.tex", `\\chapter{Core}
\\begin{definition}[Seed]\\label{seed-def} Seed body.\\end{definition}
\\begin{lemma}[Growth]\\label{growth}\\uses{seed-def} Growth body.\\end{lemma}
`);

  process.env.M3E_DATA_DIR = dataDir;
  process.env.M3E_DB_FILE = "blueprint-api.sqlite";

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
  if (blueprintDir) fs.rmSync(blueprintDir, { recursive: true, force: true });
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

test("POST /api/blueprint/import streams progress and persists map", async () => {
  const response = await fetch(`${baseUrl}/api/blueprint/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      blueprintPath: blueprintDir,
      mapId: "blueprint-api-map",
    }),
  });

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");

  const events = parseSse(await response.text());
  expect(events.some((entry) => entry.event === "blueprint-import-progress" && entry.data.phase === "discovery")).toBe(true);
  expect(events.some((entry) => entry.event === "blueprint-import-progress" && entry.data.phase === "parse")).toBe(true);

  const complete = events.find((entry) => entry.event === "blueprint-import-complete");
  expect(complete).toBeTruthy();
  expect(complete.data.mapId).toBe("blueprint-api-map");
  expect(complete.data.statementCount).toBe(2);
  expect(complete.data.linkCount).toBe(1);

  const dbPath = path.join(dataDir, "blueprint-api.sqlite");
  const loaded = RapidMvpModel.loadFromSqlite(dbPath, "blueprint-api-map");
  expect(loaded.validate()).toEqual([]);
  expect(loaded.state.nodes[loaded.state.rootId].text).toBe("API Blueprint");
  expect(Object.values(loaded.state.links ?? {})).toHaveLength(1);
});

test("POST /api/blueprint/import rejects missing blueprintPath", async () => {
  const response = await fetch(`${baseUrl}/api/blueprint/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({}),
  });
  const payload = await response.json();
  expect(response.status).toBe(400);
  expect(payload.ok).toBe(false);
  expect(payload.error).toMatch(/blueprintPath/);
});

test("POST /api/blueprint/import accepts dag layout mode", async () => {
  const response = await fetch(`${baseUrl}/api/blueprint/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      blueprintPath: blueprintDir,
      mapId: "blueprint-api-map-dag",
      options: {
        layoutMode: "dag",
      },
    }),
  });

  expect(response.status).toBe(200);
  const events = parseSse(await response.text());
  const complete = events.find((entry) => entry.event === "blueprint-import-complete");
  expect(complete).toBeTruthy();
  expect(complete.data.mapId).toBe("blueprint-api-map-dag");

  const dbPath = path.join(dataDir, "blueprint-api.sqlite");
  const loaded = RapidMvpModel.loadFromSqlite(dbPath, "blueprint-api-map-dag");
  expect(loaded.validate()).toEqual([]);
  expect(loaded.state.nodes[loaded.state.rootId].attributes["blueprint:layout"]).toBe("dag");
  expect(Object.values(loaded.state.nodes).some((node) => node.attributes?.["blueprint:kind"] === "chapter-source-group")).toBe(true);
  expect(Object.values(loaded.state.nodes).some((node) => node.attributes?.["dag:layer"] === "1")).toBe(true);
  expect(Object.values(loaded.state.links ?? {})).toHaveLength(0);
});

test("POST /api/blueprint/import accepts scoped DAG facet layout", async () => {
  const response = await fetch(`${baseUrl}/api/blueprint/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      blueprintPath: blueprintDir,
      mapId: "blueprint-api-map-dag-scoped",
      options: {
        layoutMode: "dag",
        dagFacetLayout: "scoped",
      },
    }),
  });

  expect(response.status).toBe(200);
  const events = parseSse(await response.text());
  const complete = events.find((entry) => entry.event === "blueprint-import-complete");
  expect(complete).toBeTruthy();
  expect(complete.data.mapId).toBe("blueprint-api-map-dag-scoped");

  const dbPath = path.join(dataDir, "blueprint-api.sqlite");
  const loaded = RapidMvpModel.loadFromSqlite(dbPath, "blueprint-api-map-dag-scoped");
  expect(loaded.validate()).toEqual([]);
  expect(loaded.state.nodes[loaded.state.rootId].attributes["blueprint:facet-layout"]).toBe("scoped");
  expect(Object.values(loaded.state.nodes).some((node) => node.attributes?.["blueprint:kind"] === "dependency-scope")).toBe(true);
  expect(Object.values(loaded.state.nodes).some((node) => node.nodeType === "alias")).toBe(true);
});
