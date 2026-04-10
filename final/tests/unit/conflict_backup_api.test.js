import { test, expect, beforeAll, afterAll } from "vitest";
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const tempCloudDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-backup-api-cloud-"));
const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-backup-api-data-"));
process.env.M3E_CLOUD_SYNC = "1";
process.env.M3E_CLOUD_DIR = tempCloudDir;
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
        if (err) reject(err);
        else resolve();
      });
    });
  }
  fs.rmSync(tempCloudDir, { recursive: true, force: true });
  fs.rmSync(tempDataDir, { recursive: true, force: true });
});

test("backup list returns empty array when no backups exist", async () => {
  const res = await requestJson(`${baseUrl}/api/sync/backups/no-backups`);
  expect(res.response.status).toBe(200);
  expect(res.payload.ok).toBe(true);
  expect(res.payload.documentId).toBe("no-backups");
  expect(res.payload.backups).toEqual([]);
});

test("pull with localState creates a conflict backup", async () => {
  const docId = "backup-pull-test";
  const localState = createState("LocalVersion");

  // First push something to cloud
  const push = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: createState("CloudVersion"), savedAt: "2026-04-02T00:00:00.000Z" }),
  });
  expect(push.response.status).toBe(200);

  // Pull with localState to trigger backup
  const pull = await requestJson(`${baseUrl}/api/sync/pull/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ localState }),
  });
  expect(pull.response.status).toBe(200);
  expect(pull.payload.ok).toBe(true);
  expect(pull.payload.backup).toBeTruthy();
  expect(pull.payload.backup.backupId).toBeTruthy();
  expect(pull.payload.backup.reason).toBe("cloud-sync-pull");

  // Verify backup appears in list
  const list = await requestJson(`${baseUrl}/api/sync/backups/${docId}`);
  expect(list.response.status).toBe(200);
  expect(list.payload.backups.length).toBe(1);
  expect(list.payload.backups[0].backupId).toBe(pull.payload.backup.backupId);
});

test("pull without localState does not create a backup", async () => {
  const docId = "backup-pull-no-local";

  // Push to cloud
  await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: createState("Cloud"), savedAt: "2026-04-02T00:00:00.000Z" }),
  });

  // Pull without localState
  const pull = await requestJson(`${baseUrl}/api/sync/pull/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({}),
  });
  expect(pull.response.status).toBe(200);
  expect(pull.payload.backup).toBeUndefined();

  // No backup in list
  const list = await requestJson(`${baseUrl}/api/sync/backups/${docId}`);
  expect(list.payload.backups.length).toBe(0);
});

test("push conflict creates a backup of the pushed state", async () => {
  const docId = "backup-conflict-push";

  // Initial push
  await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: createState("V1"), savedAt: "2026-04-02T00:00:00.000Z" }),
  });

  // Second push (advances cloud)
  await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: createState("V2"),
      savedAt: "2026-04-02T00:00:10.000Z",
      baseSavedAt: "2026-04-02T00:00:00.000Z",
    }),
  });

  // Conflicting push with stale baseSavedAt
  const conflict = await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      state: createState("Stale"),
      savedAt: "2026-04-02T00:00:20.000Z",
      baseSavedAt: "2026-04-02T00:00:00.000Z",
    }),
  });
  expect(conflict.response.status).toBe(409);
  expect(conflict.payload.code).toBe("CLOUD_CONFLICT");
  expect(conflict.payload.backup).toBeTruthy();
  expect(conflict.payload.backup.backupId).toBeTruthy();
  expect(conflict.payload.backup.reason).toBe("cloud-conflict-push");

  // Backup should be in list
  const list = await requestJson(`${baseUrl}/api/sync/backups/${docId}`);
  expect(list.payload.backups.length).toBe(1);
});

test("get backup returns full state", async () => {
  const docId = "backup-get-test";
  const localState = createState("LocalGet");

  // Push to cloud
  await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: createState("Cloud"), savedAt: "2026-04-02T00:00:00.000Z" }),
  });

  // Pull with localState
  const pull = await requestJson(`${baseUrl}/api/sync/pull/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ localState }),
  });
  const backupId = pull.payload.backup.backupId;

  // Get the backup
  const get = await requestJson(`${baseUrl}/api/sync/backups/${docId}/${backupId}`);
  expect(get.response.status).toBe(200);
  expect(get.payload.ok).toBe(true);
  expect(get.payload.backup).toBeTruthy();
  expect(get.payload.backup.backupId).toBe(backupId);
  expect(get.payload.backup.state).toBeTruthy();
  expect(get.payload.backup.state.rootId).toBeTruthy();
});

test("get nonexistent backup returns 404", async () => {
  const get = await requestJson(`${baseUrl}/api/sync/backups/doc/nonexistent-id`);
  expect(get.response.status).toBe(404);
  expect(get.payload.ok).toBe(false);
});

test("restore backup saves state to SQLite", async () => {
  const docId = "backup-restore-test";
  const localState = createState("RestoreMe");

  // Push to cloud
  await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: createState("Cloud"), savedAt: "2026-04-02T00:00:00.000Z" }),
  });

  // Pull with localState to create backup
  const pull = await requestJson(`${baseUrl}/api/sync/pull/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ localState }),
  });
  const backupId = pull.payload.backup.backupId;

  // Restore the backup
  const restore = await requestJson(`${baseUrl}/api/sync/backups/${docId}/restore/${backupId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
  expect(restore.response.status).toBe(200);
  expect(restore.payload.ok).toBe(true);
  expect(restore.payload.restored).toBe(true);
  expect(restore.payload.backupId).toBe(backupId);
  expect(restore.payload.documentId).toBe(docId);
  expect(restore.payload.savedAt).toBeTruthy();
});

test("delete backup via DELETE method on get endpoint", async () => {
  const docId = "backup-delete-test";
  const localState = createState("DeleteMe");

  // Push + pull to create backup
  await requestJson(`${baseUrl}/api/sync/push/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: createState("Cloud"), savedAt: "2026-04-02T00:00:00.000Z" }),
  });
  const pull = await requestJson(`${baseUrl}/api/sync/pull/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ localState }),
  });
  const backupId = pull.payload.backup.backupId;

  // Delete
  const del = await requestJson(`${baseUrl}/api/sync/backups/${docId}/${backupId}`, {
    method: "DELETE",
  });
  expect(del.response.status).toBe(200);
  expect(del.payload.ok).toBe(true);
  expect(del.payload.deleted).toBe(true);

  // Verify gone
  const list = await requestJson(`${baseUrl}/api/sync/backups/${docId}`);
  expect(list.payload.backups.length).toBe(0);
});
