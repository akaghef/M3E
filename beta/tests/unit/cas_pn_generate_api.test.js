import { test, expect, beforeAll, afterAll } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server;
let baseUrl;
let dataDir;
let RapidMvpModel;
let parseCodexChildren;
let fakeCodexPath;
let capturePath;

function writeFakeCodex() {
  fakeCodexPath = path.join(dataDir, "fake-codex.js");
  fs.writeFileSync(fakeCodexPath, `#!${process.execPath}
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline = buffer.indexOf("\\n");
  while (newline >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line) {
      const request = JSON.parse(line);
      if (request.method === "initialize") process.stdout.write(JSON.stringify({ id: request.id, result: { ok: true } }) + "\\n");
      if (request.method === "thread/start") process.stdout.write(JSON.stringify({ id: request.id, result: { thread: { id: "thread-cas-test" } } }) + "\\n");
      if (request.method === "turn/start") {
        if (process.env.M3E_CAS_CAPTURE_FILE) {
          require("node:fs").writeFileSync(process.env.M3E_CAS_CAPTURE_FILE, JSON.stringify(request.params));
        }
        process.stdout.write(JSON.stringify({ id: request.id, result: { turn: { id: "turn-cas-test" } } }) + "\\n");
        const proposal = "{\\\"children\\\":[{\\\"text\\\":\\\"身体的特徴\\\",\\\"relation\\\":\\\"detail_of\\\"},{\\\"text\\\":\\\"知能と社会性\\\",\\\"relation\\\":\\\"detail_of\\\"},{\\\"text\\\":\\\"文化と技術\\\",\\\"relation\\\":\\\"detail_of\\\"},{\\\"text\\\":\\\"発達と生活\\\",\\\"relation\\\":\\\"detail_of\\\"}]}";
        process.stdout.write(JSON.stringify({ method: "item/completed", params: { threadId: "thread-cas-test", turnId: "turn-cas-test", item: { type: "agentMessage", id: "item-cas-test", text: proposal } } }) + "\\n");
        process.stdout.write(JSON.stringify({ method: "turn/completed", params: { threadId: "thread-cas-test", turn: { id: "turn-cas-test", status: "completed", items: [{ type: "agentMessage", id: "item-cas-test", text: proposal }] } } }) + "\\n");
      }
    }
    newline = buffer.indexOf("\\n");
  }
});
`);
  fs.chmodSync(fakeCodexPath, 0o755);
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-cas-pn-generate-"));
  writeFakeCodex();
  process.env.M3E_DATA_DIR = dataDir;
  process.env.M3E_DB_FILE = "cas-pn-generate.sqlite";
  process.env.M3E_CODEX_BIN = fakeCodexPath;
  capturePath = path.join(dataDir, "codex-turn.json");
  process.env.M3E_CAS_CAPTURE_FILE = capturePath;

  const startViewerPath = require.resolve("../../dist/node/start_viewer.js");
  delete require.cache[startViewerPath];
  const { createAppServer } = require(startViewerPath);
  ({ RapidMvpModel } = require("../../dist/node/rapid_mvp.js"));
  ({ parseCodexChildren } = require("../../dist/node/codex_app_server.js"));

  server = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test("CAS PN rejects a proposal whose relation does not match the action", () => {
  expect(() => parseCodexChildren(
    JSON.stringify({ children: [{ text: "言語を使う動物", relation: "detail_of" }] }),
    "examples",
  )).toThrow(/no usable children/);
});

afterAll(async () => {
  delete process.env.M3E_DATA_DIR;
  delete process.env.M3E_DB_FILE;
  delete process.env.M3E_CODEX_BIN;
  delete process.env.M3E_CAS_CAPTURE_FILE;
  if (server) {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

async function seedBiologyMap(mapId) {
  const model = new RapidMvpModel("Root");
  model.state.nodes[model.state.rootId].details = "生物分類の検証 scope。";
  model.state.nodes[model.state.rootId].attributes = { "m3e:display-role": "experiment-scope" };
  const fungusId = model.addNode(model.state.rootId, "菌類");
  const animalId = model.addNode(model.state.rootId, "動物");
  model.state.nodes[fungusId].details = "胞子で増える生物群。";
  const first = await requestJson(`${baseUrl}/api/maps/${mapId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: model.toJSON() }),
  });
  expect(first.response.status).toBe(200);
  expect(first.payload.savedAt).toEqual(expect.any(String));
  return { rootId: model.state.rootId, fungusId, animalId, savedAt: first.payload.savedAt };
}

test("CAS PN generation calls Codex App Server and persists its returned proposal", async () => {
  const mapId = "cas-pn-generate-detail";
  const seeded = await seedBiologyMap(mapId);

  const cas = await requestJson(`${baseUrl}/api/maps/${mapId}/cas/pn-generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      workspaceId: "ws-test",
      selectedNodeId: seeded.fungusId,
      scopeId: seeded.rootId,
      action: "detail",
      baseSavedAt: seeded.savedAt,
    }),
  });

  expect(cas.response.status).toBe(200);
  expect(cas.payload.ok).toBe(true);
  expect(cas.payload.kind).toBe("cas-pn-generate");
  expect(cas.payload.cas).toMatchObject({
    service: "codex-app-server",
    operation: "pn-generate",
    committed: true,
  });
  expect(cas.payload.cas.threadId).toBe("thread-cas-test");
  expect(cas.payload.cas.turnId).toBe("turn-cas-test");
  expect(cas.payload.added.map((node) => node.label)).toEqual([
    "身体的特徴",
    "知能と社会性",
    "文化と技術",
    "発達と生活",
  ]);
  expect(cas.payload.merged).toEqual([]);

  const capturedTurn = JSON.parse(fs.readFileSync(capturePath, "utf8"));
  const prompt = capturedTurn.input[0].text;
  expect(prompt).toContain("MF-H scope:");
  expect(prompt).toContain("# Root");
  expect(prompt).toContain("## 菌類");
  expect(prompt).toContain("## 動物");
  expect(prompt).not.toContain('"attributes"');
  expect(prompt).toContain("M:(cas-pn-generate-detail)> Root");
  expect(prompt).toContain("MF-H completion template:\n# 菌類\n## ???");
  expect(prompt).toContain("胞子で増える生物群。");
  expect(prompt).toContain('"relation":"detail_of"');

  const after = await requestJson(`${baseUrl}/api/maps/${mapId}`);
  expect(after.response.status).toBe(200);
  const fungus = after.payload.state.nodes[seeded.fungusId];
  const childLabels = fungus.children.map((childId) => after.payload.state.nodes[childId].text);
  expect(childLabels).toEqual(cas.payload.added.map((node) => node.label));

  for (const added of cas.payload.added) {
    const node = after.payload.state.nodes[added.id];
    expect(node.attributes).toMatchObject({
      "m3e:generated_by": "codex-app-server",
      "m3e:cas.operation": "pn-generate",
      "m3e:cas.thread_id": "thread-cas-test",
      "m3e:cas.turn_id": "turn-cas-test",
      "m3e:pn.action": "detail",
      "m3e:pn.op_id": "RF1.expandSelectedNode",
      "m3e:pn.source": "codex_app_server",
    });
    expect(node.attributes["m3e:generated_at"]).toEqual(expect.any(String));
  }
});
