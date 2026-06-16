import { test, expect, beforeAll, afterAll } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server;
let baseUrl;
let dataDir;
let RapidMvpModel;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "m3e-map-conflict-"));
}

beforeAll(async () => {
  dataDir = tmpDir();
  process.env.M3E_DATA_DIR = dataDir;
  process.env.M3E_DB_FILE = "map-conflict.sqlite";

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

test("POST /api/maps/:id returns 409 when baseSavedAt is stale", async () => {
  const model = new RapidMvpModel("Root");
  model.addNode(model.state.rootId, "Alpha");

  const firstSave = await fetch(`${baseUrl}/api/maps/conflict-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: model.toJSON() }),
  });
  const firstPayload = await firstSave.json();
  expect(firstSave.status).toBe(200);
  expect(typeof firstPayload.savedAt).toBe("string");

  model.addNode(model.state.rootId, "Beta");
  const secondSave = await fetch(`${baseUrl}/api/maps/conflict-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: model.toJSON(),
      baseSavedAt: firstPayload.savedAt,
    }),
  });
  const secondPayload = await secondSave.json();
  expect(secondSave.status).toBe(200);
  expect(typeof secondPayload.savedAt).toBe("string");

  model.addNode(model.state.rootId, "Gamma");
  const staleSave = await fetch(`${baseUrl}/api/maps/conflict-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: model.toJSON(),
      baseSavedAt: firstPayload.savedAt,
    }),
  });
  const stalePayload = await staleSave.json();
  expect(staleSave.status).toBe(409);
  expect(stalePayload.code).toBe("DOC_CONFLICT");
  expect(stalePayload.savedAt).toBe(secondPayload.savedAt);
  expect(stalePayload.state).toBeTruthy();
});

test("POST /api/maps/:id merges stale non-overlapping node edits when baseState is provided", async () => {
  const model = new RapidMvpModel("Root");
  const alphaId = model.addNode(model.state.rootId, "Alpha");
  const betaId = model.addNode(model.state.rootId, "Beta");

  const initialSave = await fetch(`${baseUrl}/api/maps/non-overlap-merge-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: model.toJSON() }),
  });
  const initialPayload = await initialSave.json();
  const baseState = JSON.parse(JSON.stringify(model.toJSON()));

  const firstWriterState = JSON.parse(JSON.stringify(baseState));
  firstWriterState.nodes[alphaId].text = "Alpha A";
  const firstWriterSave = await fetch(`${baseUrl}/api/maps/non-overlap-merge-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: firstWriterState,
      baseSavedAt: initialPayload.savedAt,
      baseState,
    }),
  });
  const firstWriterPayload = await firstWriterSave.json();
  expect(firstWriterSave.status).toBe(200);

  const secondWriterState = JSON.parse(JSON.stringify(baseState));
  secondWriterState.nodes[betaId].text = "Beta B";
  const secondWriterSave = await fetch(`${baseUrl}/api/maps/non-overlap-merge-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: secondWriterState,
      baseSavedAt: initialPayload.savedAt,
      baseState,
    }),
  });
  const secondWriterPayload = await secondWriterSave.json();
  expect(secondWriterSave.status).toBe(200);
  expect(secondWriterPayload.merged).toBe(true);
  expect(secondWriterPayload.savedAt).not.toBe(firstWriterPayload.savedAt);

  const finalResponse = await fetch(`${baseUrl}/api/maps/non-overlap-merge-map`);
  const finalPayload = await finalResponse.json();
  expect(finalPayload.state.nodes[alphaId].text).toBe("Alpha A");
  expect(finalPayload.state.nodes[betaId].text).toBe("Beta B");
});

test("POST /api/maps/:id returns Q conflict for stale same-node divergent edits", async () => {
  const model = new RapidMvpModel("Root");
  const alphaId = model.addNode(model.state.rootId, "Alpha");

  const initialSave = await fetch(`${baseUrl}/api/maps/same-node-q-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: model.toJSON() }),
  });
  const initialPayload = await initialSave.json();
  const baseState = JSON.parse(JSON.stringify(model.toJSON()));

  const firstWriterState = JSON.parse(JSON.stringify(baseState));
  firstWriterState.nodes[alphaId].text = "Alpha A";
  const firstWriterSave = await fetch(`${baseUrl}/api/maps/same-node-q-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: firstWriterState,
      baseSavedAt: initialPayload.savedAt,
      baseState,
    }),
  });
  expect(firstWriterSave.status).toBe(200);

  const secondWriterState = JSON.parse(JSON.stringify(baseState));
  secondWriterState.nodes[alphaId].text = "Alpha B";
  const secondWriterSave = await fetch(`${baseUrl}/api/maps/same-node-q-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: secondWriterState,
      baseSavedAt: initialPayload.savedAt,
      baseState,
    }),
  });
  const secondWriterPayload = await secondWriterSave.json();
  expect(secondWriterSave.status).toBe(409);
  expect(secondWriterPayload.code).toBe("DOC_NODE_CONFLICT_Q");
  expect(secondWriterPayload.conflictKind).toBe("Q");
  expect(secondWriterPayload.conflicts).toEqual([
    {
      nodeId: alphaId,
      baseText: "Alpha",
      localText: "Alpha B",
      currentText: "Alpha A",
    },
  ]);

  const finalResponse = await fetch(`${baseUrl}/api/maps/same-node-q-map`);
  const finalPayload = await finalResponse.json();
  expect(finalPayload.state.nodes[alphaId].text).toBe("Alpha A");
});
