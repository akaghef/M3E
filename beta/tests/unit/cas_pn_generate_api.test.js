import { test, expect, beforeAll, afterAll } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server;
let baseUrl;
let dataDir;
let RapidMvpModel;

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-cas-pn-generate-"));
  process.env.M3E_DATA_DIR = dataDir;
  process.env.M3E_DB_FILE = "cas-pn-generate.sqlite";

  const startViewerPath = require.resolve("../../dist/node/start_viewer.js");
  delete require.cache[startViewerPath];
  const { createAppServer } = require(startViewerPath);
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
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

async function seedBiologyMap(mapId) {
  const model = new RapidMvpModel("Root");
  const fungusId = model.addNode(model.state.rootId, "菌類");
  const animalId = model.addNode(model.state.rootId, "動物");
  const first = await requestJson(`${baseUrl}/api/maps/${mapId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: model.toJSON() }),
  });
  expect(first.response.status).toBe(200);
  expect(first.payload.savedAt).toEqual(expect.any(String));
  return { rootId: model.state.rootId, fungusId, animalId, savedAt: first.payload.savedAt };
}

test("CAS PN generation appends selected-node children through CAS and persists CAS metadata", async () => {
  const mapId = "cas-pn-generate-detail";
  const seeded = await seedBiologyMap(mapId);

  const cas = await requestJson(`${baseUrl}/api/maps/${mapId}/cas/pn-generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      workspaceId: "ws-test",
      selectedNodeId: seeded.fungusId,
      action: "detail",
      baseSavedAt: seeded.savedAt,
    }),
  });

  expect(cas.response.status).toBe(200);
  expect(cas.payload.ok).toBe(true);
  expect(cas.payload.kind).toBe("cas-pn-generate");
  expect(cas.payload.cas).toMatchObject({
    service: "m3e-cas",
    operation: "pn-generate",
    committed: true,
  });
  expect(cas.payload.cas.runId).toEqual(expect.stringMatching(/^cas_pn_/));
  expect(cas.payload.added.map((node) => node.label)).toEqual([
    "光合成をしない",
    "胞子で増える",
    "菌糸を伸ばす",
  ]);
  expect(cas.payload.merged).toEqual([]);

  const after = await requestJson(`${baseUrl}/api/maps/${mapId}`);
  expect(after.response.status).toBe(200);
  const fungus = after.payload.state.nodes[seeded.fungusId];
  const childLabels = fungus.children.map((childId) => after.payload.state.nodes[childId].text);
  expect(childLabels).toEqual(cas.payload.added.map((node) => node.label));

  for (const added of cas.payload.added) {
    const node = after.payload.state.nodes[added.id];
    expect(node.attributes).toMatchObject({
      "m3e:generated_by": "cas",
      "m3e:cas.operation": "pn-generate",
      "m3e:cas.run_id": cas.payload.cas.runId,
      "m3e:pn.action": "detail",
      "m3e:pn.op_id": "RF1.expandSelectedNode",
      "m3e:pn.source": "m3e_local_mf_h_fallback",
    });
    expect(node.attributes["m3e:generated_at"]).toEqual(expect.any(String));
  }
});
