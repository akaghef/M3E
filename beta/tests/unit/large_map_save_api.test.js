import { afterAll, beforeAll, expect, test } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

let server;
let baseUrl;
let dataDir;
let RapidMvpModel;
const previousEnv = Object.fromEntries(["M3E_DATA_DIR", "M3E_DB_FILE", "M3E_COLLAB", "M3E_COLLAB_JOIN_TOKEN"].map(key => [key, process.env[key]]));

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-large-map-save-"));
  process.env.M3E_DATA_DIR = dataDir;
  process.env.M3E_DB_FILE = "large-map.sqlite";
  process.env.M3E_COLLAB = "1";
  process.env.M3E_COLLAB_JOIN_TOKEN = "";
  const entry = require.resolve("../../dist/node/start_viewer.js");
  delete require.cache[entry];
  const { createAppServer } = require(entry);
  ({ RapidMvpModel } = require("../../dist/node/rapid_mvp.js"));
  server = createAppServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

function post(route, body, headers = {}) {
  return fetch(`${baseUrl}${route}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body,
  });
}

for (const scoped of [false, true]) {
  test(`saves and reads back >10 MB with state + baseState${scoped ? " through ?scope=" : ""}`, async () => {
    const model = new RapidMvpModel("Large map");
    const rootId = model.state.rootId;
    const route = `/api/maps/large-${scoped}`;
    const initial = await post(route, JSON.stringify({ state: model.toJSON() }));
    expect(initial.status).toBe(200);
    const { savedAt } = await initial.json();
    model.state.nodes[rootId].note = "x".repeat(8_000_000);
    const state = model.toJSON();
    const body = JSON.stringify({ version: 1, savedAt, state, baseSavedAt: savedAt, baseState: state, force: false });
    expect(Buffer.byteLength(body)).toBeGreaterThan(10_000_000);
    expect(Buffer.byteLength(body)).toBeLessThan(67_108_864);
    const saved = await post(`${route}${scoped ? `?scope=${rootId}` : ""}`, body);
    expect(saved.status).toBe(200);
    expect((await saved.json()).ok).toBe(true);
    const readback = await fetch(`${baseUrl}${route}`);
    expect(readback.status).toBe(200);
    expect((await readback.json()).state.nodes[rootId].note).toBe(state.nodes[rootId].note);
  });
}

test("over 64 MiB returns HTTP 413 JSON, then the map can still be saved", async () => {
  const body = JSON.stringify({ state: { note: "x".repeat(67_108_864) } });
  const response = await post("/api/maps/oversize", body);
  expect(response.status).toBe(413);
  expect(response.headers.get("connection")).toBe("close");
  expect(await response.json()).toEqual({ error: "Request body too large.", limitBytes: 67_108_864 });
  expect((await fetch(`${baseUrl}/api/maps/oversize`)).status).toBe(404);
  const retry = await post("/api/maps/oversize", JSON.stringify({ state: new RapidMvpModel("Retry").toJSON() }));
  expect(retry.status).toBe(200);
});

test("chunked upload receives 413 JSON without waiting for request end", async () => {
  const result = await new Promise((resolve, reject) => {
    const req = http.request(`${baseUrl}/api/maps/chunked-oversize`, { method: "POST" }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.write(Buffer.alloc(67_108_865, " "));
    // Deliberately leave the request open: rejection must not wait for end.
  });
  expect(result).toEqual({ status: 413, body: { error: "Request body too large.", limitBytes: 67_108_864 } });
});

test("unrelated routes keep the 10,000,000 byte limit and receive 413 JSON", async () => {
  const response = await post("/api/maps/new", JSON.stringify({ label: "x".repeat(10_000_000) }));
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({ error: "Request body too large.", limitBytes: 10_000_000 });
});

test("collab push reads >10 MB of nodes before normal validation", async () => {
  const registration = await post("/api/collab/register", JSON.stringify({ displayName: "Test", role: "human" }));
  expect(registration.status).toBe(200);
  const { token } = await registration.json();
  const response = await post("/api/collab/push/large-collab", JSON.stringify({ changes: { nodes: { root: { note: "x".repeat(10_000_001) } } } }), { Authorization: `Bearer ${token}` });
  expect(response.status).toBe(400);
  expect((await response.json()).error).toBe("scopeId, lockId, baseVersion, and changes.nodes are required.");
});
