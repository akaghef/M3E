import { test, expect, beforeEach, afterEach } from "vitest";
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

beforeEach(() => {
  tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-backup-test-"));
});

afterEach(() => {
  fs.rmSync(tempDataDir, { recursive: true, force: true });
});

test("createConflictBackup saves a backup and returns entry metadata", () => {
  const state = createState("TestNode");
  const entry = createConflictBackup(tempDataDir, "doc-1", state, "cloud-sync-pull");

  expect(entry.backupId).toBeTruthy();
  expect(entry.documentId).toBe("doc-1");
  expect(entry.reason).toBe("cloud-sync-pull");
  expect(entry.createdAt).toBeTruthy();
  expect(entry.savedAt).toBeTruthy();
});

test("listConflictBackups returns saved backups sorted newest first", () => {
  const state1 = createState("A");
  const state2 = createState("B");

  const entry1 = createConflictBackup(tempDataDir, "doc-1", state1, "reason-1");
  const entry2 = createConflictBackup(tempDataDir, "doc-1", state2, "reason-2");

  const list = listConflictBackups(tempDataDir, "doc-1");
  expect(list.length).toBe(2);
  // Newest first
  expect(list[0].backupId).toBe(entry2.backupId);
  expect(list[1].backupId).toBe(entry1.backupId);
});

test("listConflictBackups returns empty array when no backups exist", () => {
  const list = listConflictBackups(tempDataDir, "nonexistent");
  expect(list).toEqual([]);
});

test("listConflictBackups filters by documentId", () => {
  createConflictBackup(tempDataDir, "doc-a", createState("A"), "r1");
  createConflictBackup(tempDataDir, "doc-b", createState("B"), "r2");

  const listA = listConflictBackups(tempDataDir, "doc-a");
  expect(listA.length).toBe(1);
  expect(listA[0].documentId).toBe("doc-a");

  const listB = listConflictBackups(tempDataDir, "doc-b");
  expect(listB.length).toBe(1);
  expect(listB[0].documentId).toBe("doc-b");
});

test("getConflictBackup returns full backup with state", () => {
  const state = createState("GetTest");
  const entry = createConflictBackup(tempDataDir, "doc-1", state, "test-reason");

  const full = getConflictBackup(tempDataDir, "doc-1", entry.backupId);
  expect(full).toBeTruthy();
  expect(full.version).toBe(1);
  expect(full.backupId).toBe(entry.backupId);
  expect(full.documentId).toBe("doc-1");
  expect(full.state).toBeTruthy();
  expect(full.state.rootId).toBeTruthy();
  expect(full.state.nodes).toBeTruthy();
});

test("getConflictBackup returns null for nonexistent backup", () => {
  const full = getConflictBackup(tempDataDir, "doc-1", "nonexistent-id");
  expect(full).toBe(null);
});

test("deleteConflictBackup removes the backup file", () => {
  const entry = createConflictBackup(tempDataDir, "doc-1", createState("Del"), "r");

  const deleted = deleteConflictBackup(tempDataDir, "doc-1", entry.backupId);
  expect(deleted).toBe(true);

  const list = listConflictBackups(tempDataDir, "doc-1");
  expect(list.length).toBe(0);

  const full = getConflictBackup(tempDataDir, "doc-1", entry.backupId);
  expect(full).toBe(null);
});

test("deleteConflictBackup returns false for nonexistent backup", () => {
  const deleted = deleteConflictBackup(tempDataDir, "doc-1", "nonexistent");
  expect(deleted).toBe(false);
});

test("createConflictBackup prunes backups beyond limit of 10", () => {
  for (let i = 0; i < 12; i++) {
    createConflictBackup(tempDataDir, "doc-prune", createState(`N${i}`), `r${i}`);
  }

  const list = listConflictBackups(tempDataDir, "doc-prune");
  expect(list.length).toBe(10);
});
