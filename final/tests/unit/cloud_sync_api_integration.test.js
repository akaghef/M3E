import { test, expect, beforeAll, afterAll } from "vitest";
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
  expect(status1.response.status).toBe(200);
  expect(status1.payload.ok).toBe(true);
  expect(status1.payload.mode).toBe("file-mirror");
  expect(status1.payload.documentId).toBe(docId);
  expect(status1.payload.enabled).toBe(true);
  expect(status1.payload.exists).toBe(false);

  const push = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: createState("A"), savedAt: "2026-04-02T00:00:00.000Z" }),
  });
  expect(push.response.status).toBe(200);
  expect(push.payload.ok).toBe(true);
  expect(push.payload.mode).toBe("file-mirror");
  expect(push.payload.documentId).toBe(docId);

  const status2 = await requestJson(`${baseUrl}/api/sync/status/${docId}`);
  expect(status2.response.status).toBe(200);
  expect(status2.payload.ok).toBe(true);
  expect(status2.payload.mode).toBe("file-mirror");
  expect(status2.payload.documentId).toBe(docId);
  expect(status2.payload.exists).toBe(true);
  expect(status2.payload.cloudSavedAt).toBe("2026-04-02T00:00:00.000Z");

  const pull = await requestJson(`${baseUrl}/api/sync/pull/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({}),
  });
  expect(pull.response.status).toBe(200);
  expect(pull.payload.ok).toBe(true);
  expect(pull.payload.mode).toBe("file-mirror");
  expect(pull.payload.documentId).toBe(docId);
  expect(pull.payload.state.rootId.length > 0).toBe(true);
});

test("sync push returns 409 on savedAt conflict and force push overrides", async () => {
  const docId = "integration-conflict";

  const initialPush = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: createState("First"), savedAt: "2026-04-02T00:00:00.000Z" }),
  });
  expect(initialPush.response.status).toBe(200);
  expect(initialPush.payload.ok).toBe(true);
  expect(initialPush.payload.mode).toBe("file-mirror");
  expect(initialPush.payload.documentId).toBe(docId);

  const updatePush = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: createState("Second"),
      savedAt: "2026-04-02T00:00:10.000Z",
      baseSavedAt: "2026-04-02T00:00:00.000Z",
    }),
  });
  expect(updatePush.response.status).toBe(200);
  expect(updatePush.payload.ok).toBe(true);
  expect(updatePush.payload.mode).toBe("file-mirror");
  expect(updatePush.payload.documentId).toBe(docId);

  const conflictingPush = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: createState("Stale"),
      savedAt: "2026-04-02T00:00:20.000Z",
      baseSavedAt: "2026-04-02T00:00:00.000Z",
    }),
  });
  expect(conflictingPush.response.status).toBe(409);
  expect(conflictingPush.payload.code).toBe("CLOUD_CONFLICT");
  expect(conflictingPush.payload.ok).toBe(false);
  expect(conflictingPush.payload.documentId).toBe(docId);

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
  expect(forcedPush.response.status).toBe(200);
  expect(forcedPush.payload.ok).toBe(true);
  expect(forcedPush.payload.mode).toBe("file-mirror");
  expect(forcedPush.payload.documentId).toBe(docId);
  expect(forcedPush.payload.forced).toBe(true);
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

  expect(pulled.response.status).toBe(500);
  expect(pulled.payload.code).toBe("SYNC_PULL_FAILED");
  expect(pulled.payload.ok).toBe(false);
  expect(pulled.payload.documentId).toBe(docId);
  expect(typeof pulled.payload.error).toBe("string");
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

  expect(pulled.response.status).toBe(400);
  expect(pulled.payload.code).toBe("SYNC_CLOUD_UNSUPPORTED_FORMAT");
  expect(pulled.payload.ok).toBe(false);
  expect(pulled.payload.documentId).toBe(docId);
  expect(pulled.payload.error).toBe("Cloud document has unsupported format.");
});

test("sync push returns 400 for structurally invalid model", async () => {
  const docId = "invalid-model";
  const pushed = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: { rootId: "missing-root", nodes: {} } }),
  });

  expect(pushed.response.status).toBe(400);
  expect(pushed.payload.code).toBe("SYNC_PUSH_INVALID_MODEL");
  expect(pushed.payload.ok).toBe(false);
  expect(pushed.payload.documentId).toBe(docId);
  expect(typeof pushed.payload.error).toBe("string");
});

test("sync endpoints return 405 on unsupported method", async () => {
  const docId = "method-not-allowed";

  const statusPost = await requestJson(`${baseUrl}/api/sync/status/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({}),
  });
  expect(statusPost.response.status).toBe(405);
  expect(statusPost.payload.code).toBe("SYNC_METHOD_NOT_ALLOWED");
  expect(statusPost.payload.ok).toBe(false);
  expect(statusPost.payload.documentId).toBe(docId);

  const pushGet = await requestJson(`${baseUrl}/api/sync/push/${docId}`);
  expect(pushGet.response.status).toBe(405);
  expect(pushGet.payload.code).toBe("SYNC_METHOD_NOT_ALLOWED");
  expect(pushGet.payload.ok).toBe(false);
  expect(pushGet.payload.documentId).toBe(docId);

  const pullGet = await requestJson(`${baseUrl}/api/sync/pull/${docId}`);
  expect(pullGet.response.status).toBe(405);
  expect(pullGet.payload.code).toBe("SYNC_METHOD_NOT_ALLOWED");
  expect(pullGet.payload.ok).toBe(false);
  expect(pullGet.payload.documentId).toBe(docId);
});

test("sync push returns 400 (not 500) when state has no nodes", async () => {
  const docId = "missing-nodes";
  const pushed = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: {}, savedAt: "2026-01-01T00:00:00Z" }),
  });

  expect(pushed.response.status).toBe(400);
  expect(pushed.payload.code).toBe("SYNC_PUSH_INVALID_MODEL");
  expect(pushed.payload.ok).toBe(false);
  expect(pushed.payload.documentId).toBe(docId);
});

test("sync push returns 400 when state is null", async () => {
  const docId = "null-state";
  const pushed = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: null }),
  });

  expect(pushed.response.status).toBe(400);
  expect(pushed.payload.ok).toBe(false);
  // state:null is falsy so body itself becomes candidate.state; it has no nodes field
  expect(pushed.payload.code).toBe("SYNC_PUSH_INVALID_MODEL");
});
