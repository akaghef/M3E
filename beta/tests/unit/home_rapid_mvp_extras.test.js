import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function makeTempDb() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-home-extras-"));
  return path.join(base, "data.sqlite");
}

test("setPinned(true) flips pinned to true on listDocuments", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "p1", "P");
  RapidMvpModel.setPinned(dbPath, "p1", true);
  const docs = RapidMvpModel.listDocuments(dbPath);
  expect(docs[0].pinned).toBe(true);
});

test("setPinned(false) flips pinned back to false", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "p1", "P");
  RapidMvpModel.setPinned(dbPath, "p1", true);
  RapidMvpModel.setPinned(dbPath, "p1", false);
  const docs = RapidMvpModel.listDocuments(dbPath);
  expect(docs[0].pinned).toBe(false);
});

test("setDocumentSource stores a DocSource and surfaces it on listDocuments", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "s1", "S");
  RapidMvpModel.setDocumentSource(dbPath, "s1", { kind: "obsidian", path: "/tmp/vault" });
  const docs = RapidMvpModel.listDocuments(dbPath);
  expect(docs[0].source).toEqual({ kind: "obsidian", path: "/tmp/vault" });
});

test("setDocumentSource(null) clears the source field", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "s1", "S");
  RapidMvpModel.setDocumentSource(dbPath, "s1", { kind: "obsidian", path: "/tmp/vault" });
  RapidMvpModel.setDocumentSource(dbPath, "s1", null);
  const docs = RapidMvpModel.listDocuments(dbPath);
  expect(docs[0].source).toBeUndefined();
});

test("opening a legacy DB without pinned/source columns adds them idempotently", () => {
  const dbPath = makeTempDb();
  const Database = require("better-sqlite3");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const legacy = new Database(dbPath);
  legacy.exec(`
    CREATE TABLE documents (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      saved_at TEXT NOT NULL,
      state_json TEXT NOT NULL
    )
  `);
  legacy
    .prepare(`INSERT INTO documents (id, version, saved_at, state_json) VALUES (?, 1, ?, ?)`)
    .run(
      "legacy",
      new Date().toISOString(),
      JSON.stringify({
        rootId: "r1",
        nodes: { r1: { id: "r1", parentId: null, children: [], text: "Legacy root" } },
        links: {},
      }),
    );
  legacy.close();

  const first = RapidMvpModel.listDocuments(dbPath);
  expect(first.length).toBe(1);
  expect(first[0].pinned).toBe(false);
  expect(first[0].source).toBeUndefined();

  const second = RapidMvpModel.listDocuments(dbPath);
  expect(second.length).toBe(1);

  const db = new Database(dbPath);
  const cols = db.prepare(`PRAGMA table_info(documents)`).all().map((c) => c.name);
  db.close();
  expect(cols).toContain("pinned");
  expect(cols).toContain("source");
  expect(cols).toContain("tags");
  expect(cols).toContain("archived");
});

test("duplicateDocument does not inherit pinned/source from the source", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createDocument(dbPath, "src", "Src");
  RapidMvpModel.setPinned(dbPath, "src", true);
  RapidMvpModel.setDocumentSource(dbPath, "src", { kind: "obsidian", path: "/tmp/vault" });
  RapidMvpModel.duplicateDocument(dbPath, "src", "dup");

  const docs = RapidMvpModel.listDocuments(dbPath);
  const dup = docs.find((d) => d.id === "dup");
  const src = docs.find((d) => d.id === "src");
  expect(dup.pinned).toBe(false);
  expect(dup.source).toBeUndefined();
  expect(src.pinned).toBe(true);
  expect(src.source).toEqual({ kind: "obsidian", path: "/tmp/vault" });
});
