import { test, expect, beforeAll, afterAll } from "vitest";
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-linear-api-data-"));
process.env.M3E_DATA_DIR = tempDataDir;

const { createAppServer } = require("../../dist/node/start_viewer.js");
const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

let server;
let baseUrl;

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function seedDoc(mapId) {
  // Build a minimal valid state and POST it via the whole-map API so the
  // map row exists in SQLite.
  const model = new RapidMvpModel("Root");
  const childId = model.addNode(model.state.rootId, "Child A");
  return { state: model.toJSON(), rootId: model.state.rootId, childId };
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
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  fs.rmSync(tempDataDir, { recursive: true, force: true });
});

async function ensureDoc(mapId) {
  const seeded = seedDoc(mapId);
  const post = await requestJson(`${baseUrl}/api/maps/${mapId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: seeded.state }),
  });
  expect(post.response.status).toBe(200);
  return seeded;
}

test("GET returns empty text when linearNotesByScope is unset", async () => {
  const mapId = "linear-get-empty";
  const seeded = await ensureDoc(mapId);
  const res = await requestJson(
    `${baseUrl}/api/maps/${mapId}/linear/${encodeURIComponent(seeded.rootId)}`,
  );
  expect(res.response.status).toBe(200);
  expect(res.payload.ok).toBe(true);
  expect(res.payload.scopeId).toBe(seeded.rootId);
  expect(res.payload.text).toBe("");
});

test("PUT then GET round-trips the text", async () => {
  const mapId = "linear-put-get";
  const seeded = await ensureDoc(mapId);
  const body = { text: "problem: X\nthought: try Y" };
  const put = await requestJson(
    `${baseUrl}/api/maps/${mapId}/linear/${encodeURIComponent(seeded.childId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    },
  );
  expect(put.response.status).toBe(200);
  expect(put.payload.ok).toBe(true);
  expect(put.payload.scopeId).toBe(seeded.childId);
  expect(typeof put.payload.savedAt).toBe("string");

  const get = await requestJson(
    `${baseUrl}/api/maps/${mapId}/linear/${encodeURIComponent(seeded.childId)}`,
  );
  expect(get.response.status).toBe(200);
  expect(get.payload.text).toBe(body.text);

  // Full-replace semantics — PUT with shorter text replaces, not appends.
  const put2 = await requestJson(
    `${baseUrl}/api/maps/${mapId}/linear/${encodeURIComponent(seeded.childId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ text: "replaced" }),
    },
  );
  expect(put2.response.status).toBe(200);
  const get2 = await requestJson(
    `${baseUrl}/api/maps/${mapId}/linear/${encodeURIComponent(seeded.childId)}`,
  );
  expect(get2.payload.text).toBe("replaced");
});

test("DELETE clears the entry", async () => {
  const mapId = "linear-delete";
  const seeded = await ensureDoc(mapId);
  await requestJson(
    `${baseUrl}/api/maps/${mapId}/linear/${encodeURIComponent(seeded.childId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ text: "to be deleted" }),
    },
  );
  const del = await requestJson(
    `${baseUrl}/api/maps/${mapId}/linear/${encodeURIComponent(seeded.childId)}`,
    { method: "DELETE" },
  );
  expect(del.response.status).toBe(200);
  expect(del.payload.ok).toBe(true);
  expect(del.payload.removed).toBe(true);

  const get = await requestJson(
    `${baseUrl}/api/maps/${mapId}/linear/${encodeURIComponent(seeded.childId)}`,
  );
  expect(get.payload.text).toBe("");

  // Verify the key was removed (not just set to "") by inspecting the map state.
  const mapGet = await requestJson(`${baseUrl}/api/maps/${mapId}`);
  const map = mapGet.payload.state.linearNotesByScope ?? {};
  expect(Object.prototype.hasOwnProperty.call(map, seeded.childId)).toBe(false);
});

test("returns 404 when scopeId is not an existing nodeId", async () => {
  const mapId = "linear-bad-scope";
  await ensureDoc(mapId);
  const res = await requestJson(
    `${baseUrl}/api/maps/${mapId}/linear/nonexistent-node-id`,
  );
  expect(res.response.status).toBe(404);
  expect(res.payload.ok).toBe(false);

  const put = await requestJson(
    `${baseUrl}/api/maps/${mapId}/linear/nonexistent-node-id`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ text: "x" }),
    },
  );
  expect(put.response.status).toBe(404);
});

test("PUT rejects body without text field", async () => {
  const mapId = "linear-bad-body";
  const seeded = await ensureDoc(mapId);
  const res = await requestJson(
    `${baseUrl}/api/maps/${mapId}/linear/${encodeURIComponent(seeded.rootId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ notText: 123 }),
    },
  );
  expect(res.response.status).toBe(400);
});
