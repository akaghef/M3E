import { afterAll, beforeAll, expect, test } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server;
let baseUrl;
let dataDir;
let RapidMvpModel;
const oldDataDir = process.env.M3E_DATA_DIR;
const oldDbFile = process.env.M3E_DB_FILE;

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-link-attributes-"));
  process.env.M3E_DATA_DIR = dataDir;
  process.env.M3E_DB_FILE = "attributes.sqlite";
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
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (oldDataDir === undefined) delete process.env.M3E_DATA_DIR;
  else process.env.M3E_DATA_DIR = oldDataDir;
  if (oldDbFile === undefined) delete process.env.M3E_DB_FILE;
  else process.env.M3E_DB_FILE = oldDbFile;
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

async function seedMap() {
  const model = new RapidMvpModel("Attributes diagram");
  const source = model.addNode(model.state.rootId, "Source");
  const target = model.addNode(model.state.rootId, "Target");
  const mapId = `attributes-${crypto.randomUUID()}`;
  const response = await fetch(`${baseUrl}/api/maps/${mapId}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: model.toJSON() }),
  });
  expect(response.status).toBe(200);
  return { mapId, source, target };
}

async function getMap(mapId) {
  const response = await fetch(`${baseUrl}/api/maps/${mapId}`);
  expect(response.status).toBe(200);
  return response.json();
}

test("existing link POST and whole-map save retain attributes on authoritative readback", async () => {
  const { mapId, source, target } = await seedMap();
  const response = await fetch(`${baseUrl}/api/maps/${mapId}/links`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceNodeId: source, targetNodeId: target, attributes: { confidence: "declared" } }),
  });
  expect(response.status).toBe(200);
  const { link } = await response.json();
  expect(link.attributes).toEqual({ confidence: "declared" });
  const saved = await getMap(mapId);
  expect(saved.state.links[link.id].attributes).toEqual({ confidence: "declared" });
  saved.state.nodes[saved.state.rootId].text = "Unrelated edit";
  const save = await fetch(`${baseUrl}/api/maps/${mapId}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(saved),
  });
  expect(save.status).toBe(200);
  expect((await getMap(mapId)).state.links[link.id].attributes).toEqual({ confidence: "declared" });
});

test.each([null, [], "value", 2, false, { confidence: 2 }, { valid: "keep", invalid: null }].map((attributes) => ({ attributes })))(
  "link POST rejects invalid attributes %j without a partial save", async ({ attributes }) => {
    const { mapId, source, target } = await seedMap();
    const before = await getMap(mapId);
    const response = await fetch(`${baseUrl}/api/maps/${mapId}/links`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceNodeId: source, targetNodeId: target, attributes }),
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect((await response.json()).error).toMatch(/attributes/i);
    expect(await getMap(mapId)).toEqual(before);
  },
);

test.each([null, [], "value", 2, { confidence: 2 }, { valid: "keep", invalid: false }].map((attributes) => ({ attributes })))(
  "whole-map POST rejects invalid attributes %j and leaves SQLite unchanged", async ({ attributes }) => {
    const { mapId, source, target } = await seedMap();
    const before = await getMap(mapId);
    const incoming = structuredClone(before);
    incoming.state.links.invalid = { id: "invalid", sourceNodeId: source, targetNodeId: target, attributes };
    const response = await fetch(`${baseUrl}/api/maps/${mapId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(incoming),
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect((await response.json()).error).toMatch(/attributes/i);
    expect(await getMap(mapId)).toEqual(before);
  },
);

test("existing link clients can omit attributes or supply an empty object", async () => {
  const { mapId, source, target } = await seedMap();
  for (const extra of [{}, { attributes: {} }]) {
    const response = await fetch(`${baseUrl}/api/maps/${mapId}/links`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceNodeId: source, targetNodeId: target, ...extra }),
    });
    expect(response.status).toBe(200);
    const { link } = await response.json();
    expect(link.attributes).toEqual(extra.attributes);
  }
});
