import { test, expect, beforeAll, afterAll } from "vitest";
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-layout-composition-"));
process.env.M3E_DATA_DIR = tempDataDir;
process.env.M3E_DB_FILE = "layout-composition.sqlite";

const { createAppServer } = require("../../dist/node/start_viewer.js");

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

test("createAppServer exposes read-only layout snapshot through LayoutPort", async () => {
  const created = await requestJson(`${baseUrl}/api/maps/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: "layout-composition" }),
  });
  expect(created.response.status).toBe(200);
  expect(created.payload.ok).toBe(true);

  const snapshot = await requestJson(`${baseUrl}/api/maps/${created.payload.id}/layout-snapshot`);
  expect(snapshot.response.status).toBe(200);
  expect(snapshot.payload.ok).toBe(true);
  expect(snapshot.payload.source).toBe("createAppServer");
  expect(snapshot.payload.input.mode).toBe("Tree");
  expect(snapshot.payload.input.graph.nodeIds.length).toBeGreaterThan(0);
  expect(snapshot.payload.result.order).toEqual(snapshot.payload.input.graph.nodeIds);
  expect(snapshot.payload.result.pos[snapshot.payload.input.options.displayRootId]).toMatchObject({
    x: 80,
    depth: 0,
  });
});
