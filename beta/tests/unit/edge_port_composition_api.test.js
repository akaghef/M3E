import { test, expect, beforeAll, afterAll } from "vitest";
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-edge-port-composition-"));
process.env.M3E_DATA_DIR = tempDataDir;
process.env.M3E_DB_FILE = "edge-port-composition.sqlite";

const { createAppServer } = require("../../dist/node/start_viewer.js");
const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

let server;
let baseUrl;

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return { response, payload };
}

beforeAll(async () => {
  server = createAppServer();
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
  fs.rmSync(tempDataDir, { recursive: true, force: true });
});

test("createAppServer exposes read-only edge-port snapshot through EdgePort seam", async () => {
  const model = new RapidMvpModel("Edge Port Root");
  model.addNode(model.state.rootId, "Edge Port Child");
  const mapId = "edge-port-composition-map";
  const saved = await requestJson(`${baseUrl}/api/maps/${mapId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: model.toJSON() }),
  });
  expect(saved.response.status).toBe(200);
  expect(saved.payload.ok).toBe(true);

  const snapshot = await requestJson(`${baseUrl}/api/maps/${mapId}/edge-port-snapshot`);
  expect(snapshot.response.status).toBe(200);
  expect(snapshot.payload.ok).toBe(true);
  expect(snapshot.payload.source).toBe("createAppServer");
  expect(Array.isArray(snapshot.payload.snapshots)).toBe(true);
  expect(snapshot.payload.snapshots.length).toBeGreaterThan(0);
  expect(snapshot.payload.snapshots[0].relation.kind).toBe("parent-child");
  expect(snapshot.payload.snapshots[0].ports.source.side).toMatch(/^(left|right|top|bottom)$/);
  expect(snapshot.payload.snapshots[0].path.commands[0].op).toBe("M");
});
