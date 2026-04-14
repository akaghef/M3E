import { test, expect, beforeAll, afterAll } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server;
let baseUrl;
let dataDir;
let RapidMvpModel;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "m3e-doc-conflict-"));
}

beforeAll(async () => {
  dataDir = tmpDir();
  process.env.M3E_DATA_DIR = dataDir;
  process.env.M3E_DB_FILE = "doc-conflict.sqlite";

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

test("POST /api/docs/:id returns 409 when baseSavedAt is stale", async () => {
  const model = new RapidMvpModel("Root");
  model.addNode(model.state.rootId, "Alpha");

  const firstSave = await fetch(`${baseUrl}/api/docs/conflict-doc`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: model.toJSON() }),
  });
  const firstPayload = await firstSave.json();
  expect(firstSave.status).toBe(200);
  expect(typeof firstPayload.savedAt).toBe("string");

  model.addNode(model.state.rootId, "Beta");
  const secondSave = await fetch(`${baseUrl}/api/docs/conflict-doc`, {
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
  const staleSave = await fetch(`${baseUrl}/api/docs/conflict-doc`, {
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
