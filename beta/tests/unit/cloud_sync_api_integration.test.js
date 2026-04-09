const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const tempCloudDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-cloud-sync-"));
process.env.M3E_CLOUD_SYNC = "1";
process.env.M3E_CLOUD_DIR = tempCloudDir;

const { createAppServer } = require("../../dist/node/start_viewer.js");
const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

let server;
let baseUrl;

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function createState(label) {
  const model = new RapidMvpModel("Root");
  model.addNode(model.state.rootId, label);
  return model.toJSON();
}

test.before(async () => {
  server = createAppServer();
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
  fs.rmSync(tempCloudDir, { recursive: true, force: true });
});

test("sync status and push/pull round-trip works in file-mirror mode", async () => {
  const docId = "integration-roundtrip";
  const status1 = await requestJson(`${baseUrl}/api/sync/status/${docId}`);
  assert.equal(status1.response.status, 200);
  assert.equal(status1.payload.ok, true);
  assert.equal(status1.payload.mode, "file-mirror");
  assert.equal(status1.payload.documentId, docId);
  assert.equal(status1.payload.enabled, true);
  assert.equal(status1.payload.exists, false);

  const push = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: createState("A"), savedAt: "2026-04-02T00:00:00.000Z" }),
  });
  assert.equal(push.response.status, 200);
  assert.equal(push.payload.ok, true);
  assert.equal(push.payload.mode, "file-mirror");
  assert.equal(push.payload.documentId, docId);

  const status2 = await requestJson(`${baseUrl}/api/sync/status/${docId}`);
  assert.equal(status2.response.status, 200);
  assert.equal(status2.payload.ok, true);
  assert.equal(status2.payload.mode, "file-mirror");
  assert.equal(status2.payload.documentId, docId);
  assert.equal(status2.payload.exists, true);
  assert.equal(status2.payload.cloudSavedAt, "2026-04-02T00:00:00.000Z");

  const pull = await requestJson(`${baseUrl}/api/sync/pull/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({}),
  });
  assert.equal(pull.response.status, 200);
  assert.equal(pull.payload.ok, true);
  assert.equal(pull.payload.mode, "file-mirror");
  assert.equal(pull.payload.documentId, docId);
  assert.equal(pull.payload.state.rootId.length > 0, true);
});

test("sync push returns 409 on savedAt conflict and force push overrides", async () => {
  const docId = "integration-conflict";

  const initialPush = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: createState("First"), savedAt: "2026-04-02T00:00:00.000Z" }),
  });
  assert.equal(initialPush.response.status, 200);
  assert.equal(initialPush.payload.ok, true);
  assert.equal(initialPush.payload.mode, "file-mirror");
  assert.equal(initialPush.payload.documentId, docId);

  const updatePush = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: createState("Second"),
      savedAt: "2026-04-02T00:00:10.000Z",
      baseSavedAt: "2026-04-02T00:00:00.000Z",
    }),
  });
  assert.equal(updatePush.response.status, 200);
  assert.equal(updatePush.payload.ok, true);
  assert.equal(updatePush.payload.mode, "file-mirror");
  assert.equal(updatePush.payload.documentId, docId);

  const conflictingPush = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: createState("Stale"),
      savedAt: "2026-04-02T00:00:20.000Z",
      baseSavedAt: "2026-04-02T00:00:00.000Z",
    }),
  });
  assert.equal(conflictingPush.response.status, 409);
  assert.equal(conflictingPush.payload.code, "CLOUD_CONFLICT");
  assert.equal(conflictingPush.payload.ok, false);
  assert.equal(conflictingPush.payload.documentId, docId);

  const forcedPush = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: createState("Forced"),
      savedAt: "2026-04-02T00:00:30.000Z",
      baseSavedAt: "2026-04-02T00:00:00.000Z",
      force: true,
    }),
  });
  assert.equal(forcedPush.response.status, 200);
  assert.equal(forcedPush.payload.ok, true);
  assert.equal(forcedPush.payload.mode, "file-mirror");
  assert.equal(forcedPush.payload.documentId, docId);
  assert.equal(forcedPush.payload.forced, true);
});

test("sync pull returns 500 when cloud file JSON is broken", async () => {
  const docId = "broken-json";
  const filePath = path.join(tempCloudDir, `${docId}.json`);
  fs.writeFileSync(filePath, "{ invalid", "utf8");

  const pulled = await requestJson(`${baseUrl}/api/sync/pull/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({}),
  });

  assert.equal(pulled.response.status, 500);
  assert.equal(pulled.payload.code, "SYNC_PULL_FAILED");
  assert.equal(pulled.payload.ok, false);
  assert.equal(pulled.payload.documentId, docId);
  assert.equal(typeof pulled.payload.error, "string");
});

test("sync pull returns 400 for unsupported cloud document format", async () => {
  const docId = "unsupported-format";
  const filePath = path.join(tempCloudDir, `${docId}.json`);
  fs.writeFileSync(filePath, JSON.stringify({ version: 99, state: {} }), "utf8");

  const pulled = await requestJson(`${baseUrl}/api/sync/pull/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({}),
  });

  assert.equal(pulled.response.status, 400);
  assert.equal(pulled.payload.code, "SYNC_CLOUD_UNSUPPORTED_FORMAT");
  assert.equal(pulled.payload.ok, false);
  assert.equal(pulled.payload.documentId, docId);
  assert.equal(pulled.payload.error, "Cloud document has unsupported format.");
});

test("sync push returns 400 for structurally invalid model", async () => {
  const docId = "invalid-model";
  const pushed = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: { rootId: "missing-root", nodes: {} } }),
  });

  assert.equal(pushed.response.status, 400);
  assert.equal(pushed.payload.code, "SYNC_PUSH_INVALID_MODEL");
  assert.equal(pushed.payload.ok, false);
  assert.equal(pushed.payload.documentId, docId);
  assert.equal(typeof pushed.payload.error, "string");
});

test("sync endpoints return 405 on unsupported method", async () => {
  const docId = "method-not-allowed";

  const statusPost = await requestJson(`${baseUrl}/api/sync/status/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({}),
  });
  assert.equal(statusPost.response.status, 405);
  assert.equal(statusPost.payload.code, "SYNC_METHOD_NOT_ALLOWED");
  assert.equal(statusPost.payload.ok, false);
  assert.equal(statusPost.payload.documentId, docId);

  const pushGet = await requestJson(`${baseUrl}/api/sync/push/${docId}`);
  assert.equal(pushGet.response.status, 405);
  assert.equal(pushGet.payload.code, "SYNC_METHOD_NOT_ALLOWED");
  assert.equal(pushGet.payload.ok, false);
  assert.equal(pushGet.payload.documentId, docId);

  const pullGet = await requestJson(`${baseUrl}/api/sync/pull/${docId}`);
  assert.equal(pullGet.response.status, 405);
  assert.equal(pullGet.payload.code, "SYNC_METHOD_NOT_ALLOWED");
  assert.equal(pullGet.payload.ok, false);
  assert.equal(pullGet.payload.documentId, docId);
});

test("sync push returns 400 (not 500) when state has no nodes", async () => {
  const docId = "missing-nodes";
  const pushed = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: {}, savedAt: "2026-01-01T00:00:00Z" }),
  });

  assert.equal(pushed.response.status, 400);
  assert.equal(pushed.payload.code, "SYNC_PUSH_INVALID_MODEL");
  assert.equal(pushed.payload.ok, false);
  assert.equal(pushed.payload.documentId, docId);
});

test("sync push returns 400 when state is null", async () => {
  const docId = "null-state";
  const pushed = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: null }),
  });

  assert.equal(pushed.response.status, 400);
  assert.equal(pushed.payload.ok, false);
  // state:null is falsy so body itself becomes candidate.state; it has no nodes field
  assert.equal(pushed.payload.code, "SYNC_PUSH_INVALID_MODEL");
});
