import { test, expect, beforeAll, afterAll } from "vitest";
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-layout-snapshot-direction-"));
process.env.M3E_DATA_DIR = tempDataDir;
process.env.M3E_DB_FILE = "layout-snapshot-direction.sqlite";

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

test("layout snapshot preserves centered-root layout for explicit left/right direction", async () => {
  const created = await requestJson(`${baseUrl}/api/maps/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: "layout-snapshot-direction" }),
  });
  expect(created.response.status).toBe(200);

  const snapshot = await requestJson(`${baseUrl}/api/maps/${created.payload.id}/layout-snapshot?direction=left%2Fright`);
  expect(snapshot.response.status).toBe(200);
  expect(snapshot.payload.input.options.direction).toBe("left/right");
  expect(snapshot.payload.result.pos[snapshot.payload.input.options.displayRootId]).toMatchObject({
    x: 152,
    depth: 0,
  });
});
