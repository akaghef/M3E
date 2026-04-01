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
  assert.equal(status1.payload.enabled, true);
  assert.equal(status1.payload.exists, false);

  const push = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: createState("A"), savedAt: "2026-04-02T00:00:00.000Z" }),
  });
  assert.equal(push.response.status, 200);
  assert.equal(push.payload.ok, true);

  const status2 = await requestJson(`${baseUrl}/api/sync/status/${docId}`);
  assert.equal(status2.response.status, 200);
  assert.equal(status2.payload.exists, true);
  assert.equal(status2.payload.cloudSavedAt, "2026-04-02T00:00:00.000Z");

  const pull = await requestJson(`${baseUrl}/api/sync/pull/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({}),
  });
  assert.equal(pull.response.status, 200);
  assert.equal(pull.payload.ok, true);
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
  assert.equal(forcedPush.payload.forced, true);
});
