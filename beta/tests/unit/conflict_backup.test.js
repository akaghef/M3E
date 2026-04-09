const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const {
  createConflictBackup,
  listConflictBackups,
  getConflictBackup,
  deleteConflictBackup,
} = require("../../dist/node/conflict_backup.js");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

let tempDataDir;

function createState(label) {
  const model = new RapidMvpModel("Root");
  model.addNode(model.state.rootId, label);
  return model.toJSON();
}

test.beforeEach(() => {
  tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-backup-test-"));
});

test.afterEach(() => {
  fs.rmSync(tempDataDir, { recursive: true, force: true });
});

test("createConflictBackup saves a backup and returns entry metadata", () => {
  const state = createState("TestNode");
  const entry = createConflictBackup(tempDataDir, "doc-1", state, "cloud-sync-pull");

  assert.ok(entry.backupId);
  assert.equal(entry.documentId, "doc-1");
  assert.equal(entry.reason, "cloud-sync-pull");
  assert.ok(entry.createdAt);
  assert.ok(entry.savedAt);
});

test("listConflictBackups returns saved backups sorted newest first", () => {
  const state1 = createState("A");
  const state2 = createState("B");

  const entry1 = createConflictBackup(tempDataDir, "doc-1", state1, "reason-1");
  const entry2 = createConflictBackup(tempDataDir, "doc-1", state2, "reason-2");

  const list = listConflictBackups(tempDataDir, "doc-1");
  assert.equal(list.length, 2);
  // Newest first
  assert.equal(list[0].backupId, entry2.backupId);
  assert.equal(list[1].backupId, entry1.backupId);
});

test("listConflictBackups returns empty array when no backups exist", () => {
  const list = listConflictBackups(tempDataDir, "nonexistent");
  assert.deepEqual(list, []);
});

test("listConflictBackups filters by documentId", () => {
  createConflictBackup(tempDataDir, "doc-a", createState("A"), "r1");
  createConflictBackup(tempDataDir, "doc-b", createState("B"), "r2");

  const listA = listConflictBackups(tempDataDir, "doc-a");
  assert.equal(listA.length, 1);
  assert.equal(listA[0].documentId, "doc-a");

  const listB = listConflictBackups(tempDataDir, "doc-b");
  assert.equal(listB.length, 1);
  assert.equal(listB[0].documentId, "doc-b");
});

test("getConflictBackup returns full backup with state", () => {
  const state = createState("GetTest");
  const entry = createConflictBackup(tempDataDir, "doc-1", state, "test-reason");

  const full = getConflictBackup(tempDataDir, "doc-1", entry.backupId);
  assert.ok(full);
  assert.equal(full.version, 1);
  assert.equal(full.backupId, entry.backupId);
  assert.equal(full.documentId, "doc-1");
  assert.ok(full.state);
  assert.ok(full.state.rootId);
  assert.ok(full.state.nodes);
});

test("getConflictBackup returns null for nonexistent backup", () => {
  const full = getConflictBackup(tempDataDir, "doc-1", "nonexistent-id");
  assert.equal(full, null);
});

test("deleteConflictBackup removes the backup file", () => {
  const entry = createConflictBackup(tempDataDir, "doc-1", createState("Del"), "r");

  const deleted = deleteConflictBackup(tempDataDir, "doc-1", entry.backupId);
  assert.equal(deleted, true);

  const list = listConflictBackups(tempDataDir, "doc-1");
  assert.equal(list.length, 0);

  const full = getConflictBackup(tempDataDir, "doc-1", entry.backupId);
  assert.equal(full, null);
});

test("deleteConflictBackup returns false for nonexistent backup", () => {
  const deleted = deleteConflictBackup(tempDataDir, "doc-1", "nonexistent");
  assert.equal(deleted, false);
});

test("createConflictBackup prunes backups beyond limit of 10", () => {
  for (let i = 0; i < 12; i++) {
    createConflictBackup(tempDataDir, "doc-prune", createState(`N${i}`), `r${i}`);
  }

  const list = listConflictBackups(tempDataDir, "doc-prune");
  assert.equal(list.length, 10);
});
