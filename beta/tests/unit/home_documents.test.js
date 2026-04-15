import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function makeTempDb() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-home-test-"));
  return path.join(base, "data.sqlite");
}

test("listDocuments returns empty array for fresh database", () => {
  const dbPath = makeTempDb();
  const docs = RapidMvpModel.listDocuments(dbPath);
  expect(docs).toEqual([]);
});

test("createDocument + listDocuments returns MapSummary", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "doc-a", "Alpha");
  const docs = RapidMvpModel.listDocuments(dbPath);
  expect(docs.length).toBe(1);
  const d = docs[0];
  expect(d.id).toBe("doc-a");
  expect(d.label).toBe("Alpha");
  expect(d.archived).toBe(false);
  expect(d.tags).toEqual([]);
  expect(d.nodeCount).toBeGreaterThan(0);
  expect(typeof d.charCount).toBe("number");
  expect(typeof d.savedAt).toBe("string");
});

test("createDocument throws when id already exists", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "dup", "X");
  expect(() => RapidMvpModel.createDocument(dbPath, "dup", "Y")).toThrow(/already exists/);
});

test("renameDocument updates the root node label", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "r", "Old");
  RapidMvpModel.renameDocument(dbPath, "r", "New Label");
  const docs = RapidMvpModel.listDocuments(dbPath);
  expect(docs[0].label).toBe("New Label");
});

test("renameDocument rejects empty label", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "r", "Old");
  expect(() => RapidMvpModel.renameDocument(dbPath, "r", "   ")).toThrow(/Invalid label/);
});

test("setDocumentTags persists and dedupes tags", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "t", "T");
  RapidMvpModel.setDocumentTags(dbPath, "t", ["alpha", "beta", "alpha", "  ", "gamma"]);
  const docs = RapidMvpModel.listDocuments(dbPath);
  expect(docs[0].tags.sort()).toEqual(["alpha", "beta", "gamma"]);
});

test("archive hides docs from default list and restore brings them back", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "x", "Visible");
  RapidMvpModel.setArchived(dbPath, "x", true);
  expect(RapidMvpModel.listDocuments(dbPath).length).toBe(0);
  expect(RapidMvpModel.listDocuments(dbPath, { includeArchived: true }).length).toBe(1);
  expect(RapidMvpModel.listDocuments(dbPath, { includeArchived: true })[0].archived).toBe(true);
  RapidMvpModel.setArchived(dbPath, "x", false);
  expect(RapidMvpModel.listDocuments(dbPath).length).toBe(1);
});

test("deleteDocument requires archived state", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "d", "Doomed");
  expect(() => RapidMvpModel.deleteDocument(dbPath, "d")).toThrow(/not archived/);
  RapidMvpModel.setArchived(dbPath, "d", true);
  RapidMvpModel.deleteDocument(dbPath, "d");
  expect(RapidMvpModel.documentExists(dbPath, "d")).toBe(false);
});

test("duplicateDocument copies state and tags but assigns new id", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "src", "Source");
  RapidMvpModel.setDocumentTags(dbPath, "src", ["work"]);
  RapidMvpModel.duplicateDocument(dbPath, "src", "dup");
  const docs = RapidMvpModel.listDocuments(dbPath);
  const dup = docs.find((d) => d.id === "dup");
  expect(dup).toBeTruthy();
  expect(dup.label).toBe("Source");
  expect(dup.tags).toEqual(["work"]);
  expect(dup.archived).toBe(false);
});

test("listDocuments tolerates pre-existing rows without tags/archived columns (migration)", () => {
  const dbPath = makeTempDb();
  // First call creates the table with new columns via migration code path.
  RapidMvpModel.createDocument(dbPath, "legacy", "Legacy");
  // Manually insert to simulate legacy row with NULL tags/archived.
  const Database = require("better-sqlite3");
  const db = new Database(dbPath);
  db.prepare(
    "INSERT INTO documents (id, version, saved_at, state_json) VALUES (?, 1, ?, ?)",
  ).run("legacy2", new Date().toISOString(), JSON.stringify({ rootId: "r1", nodes: { r1: { id: "r1", parentId: null, children: [], text: "L2" } }, links: {} }));
  db.close();

  const docs = RapidMvpModel.listDocuments(dbPath);
  const l2 = docs.find((d) => d.id === "legacy2");
  expect(l2).toBeTruthy();
  expect(l2.tags).toEqual([]);
  expect(l2.archived).toBe(false);
  expect(l2.label).toBe("L2");
});
