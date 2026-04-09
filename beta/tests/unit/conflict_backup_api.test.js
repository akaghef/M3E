const test = require("node:test");
const assert = require("node:assert/strict");
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
  assert.equal(res.response.status, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.documentId, "no-backups");
  assert.deepEqual(res.payload.backups, []);
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
  assert.equal(push.response.status, 200);

  // Pull with localState to trigger backup
  const pull = await requestJson(`${baseUrl}/api/sync/pull/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ localState }),
  });
  assert.equal(pull.response.status, 200);
  assert.equal(pull.payload.ok, true);
  assert.ok(pull.payload.backup);
  assert.ok(pull.payload.backup.backupId);
  assert.equal(pull.payload.backup.reason, "cloud-sync-pull");

  // Verify backup appears in list
  const list = await requestJson(`${baseUrl}/api/sync/backups/${docId}`);
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.backups.length, 1);
  assert.equal(list.payload.backups[0].backupId, pull.payload.backup.backupId);
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
  assert.equal(pull.response.status, 200);
  assert.equal(pull.payload.backup, undefined);

  // No backup in list
  const list = await requestJson(`${baseUrl}/api/sync/backups/${docId}`);
  assert.equal(list.payload.backups.length, 0);
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
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.payload.code, "CLOUD_CONFLICT");
  assert.ok(conflict.payload.backup);
  assert.ok(conflict.payload.backup.backupId);
  assert.equal(conflict.payload.backup.reason, "cloud-conflict-push");

  // Backup should be in list
  const list = await requestJson(`${baseUrl}/api/sync/backups/${docId}`);
  assert.equal(list.payload.backups.length, 1);
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
  assert.equal(get.response.status, 200);
  assert.equal(get.payload.ok, true);
  assert.ok(get.payload.backup);
  assert.equal(get.payload.backup.backupId, backupId);
  assert.ok(get.payload.backup.state);
  assert.ok(get.payload.backup.state.rootId);
});

test("get nonexistent backup returns 404", async () => {
  const get = await requestJson(`${baseUrl}/api/sync/backups/doc/nonexistent-id`);
  assert.equal(get.response.status, 404);
  assert.equal(get.payload.ok, false);
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
  assert.equal(restore.response.status, 200);
  assert.equal(restore.payload.ok, true);
  assert.equal(restore.payload.restored, true);
  assert.equal(restore.payload.backupId, backupId);
  assert.equal(restore.payload.documentId, docId);
  assert.ok(restore.payload.savedAt);
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
  assert.equal(del.response.status, 200);
  assert.equal(del.payload.ok, true);
  assert.equal(del.payload.deleted, true);

  // Verify gone
  const list = await requestJson(`${baseUrl}/api/sync/backups/${docId}`);
  assert.equal(list.payload.backups.length, 0);
});
