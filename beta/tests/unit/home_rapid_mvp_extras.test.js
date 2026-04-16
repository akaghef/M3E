import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function makeTempDb() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-home-extras-"));
  return path.join(base, "data.sqlite");
}

test("setPinned(true) flips pinned to true on listMaps", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "p1", "P");
  RapidMvpModel.setPinned(dbPath, "p1", true);
  const maps = RapidMvpModel.listMaps(dbPath);
  expect(maps[0].pinned).toBe(true);
});

test("setPinned(false) flips pinned back to false", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "p1", "P");
  RapidMvpModel.setPinned(dbPath, "p1", true);
  RapidMvpModel.setPinned(dbPath, "p1", false);
  const maps = RapidMvpModel.listMaps(dbPath);
  expect(maps[0].pinned).toBe(false);
});

test("setMapSource stores a MapSource and surfaces it on listMaps", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "s1", "S");
  RapidMvpModel.setMapSource(dbPath, "s1", { kind: "obsidian", path: "/tmp/vault" });
  const maps = RapidMvpModel.listMaps(dbPath);
  expect(maps[0].source).toEqual({ kind: "obsidian", path: "/tmp/vault" });
});

test("setMapSource(null) clears the source field", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "s1", "S");
  RapidMvpModel.setMapSource(dbPath, "s1", { kind: "obsidian", path: "/tmp/vault" });
  RapidMvpModel.setMapSource(dbPath, "s1", null);
  const maps = RapidMvpModel.listMaps(dbPath);
  expect(maps[0].source).toBeUndefined();
});

test("opening a legacy DB without pinned/source columns adds them idempotently", () => {
  const dbPath = makeTempDb();
  const Database = require("better-sqlite3");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const legacy = new Database(dbPath);
  legacy.exec(`
    CREATE TABLE maps (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      saved_at TEXT NOT NULL,
      state_json TEXT NOT NULL
    )
  `);
  legacy
    .prepare(`INSERT INTO maps (id, version, saved_at, state_json) VALUES (?, 1, ?, ?)`)
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

  const first = RapidMvpModel.listMaps(dbPath);
  expect(first.length).toBe(1);
  expect(first[0].pinned).toBe(false);
  expect(first[0].source).toBeUndefined();

  const second = RapidMvpModel.listMaps(dbPath);
  expect(second.length).toBe(1);

  const db = new Database(dbPath);
  const cols = db.prepare(`PRAGMA table_info(maps)`).all().map((c) => c.name);
  db.close();
  expect(cols).toContain("pinned");
  expect(cols).toContain("source");
  expect(cols).toContain("tags");
  expect(cols).toContain("archived");
});

test("duplicateMap does not inherit pinned/source from the source", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "src", "Src");
  RapidMvpModel.setPinned(dbPath, "src", true);
  RapidMvpModel.setMapSource(dbPath, "src", { kind: "obsidian", path: "/tmp/vault" });
  RapidMvpModel.duplicateMap(dbPath, "src", "dup");

  const maps = RapidMvpModel.listMaps(dbPath);
  const dup = maps.find((d) => d.id === "dup");
  const src = maps.find((d) => d.id === "src");
  expect(dup.pinned).toBe(false);
  expect(dup.source).toBeUndefined();
  expect(src.pinned).toBe(true);
  expect(src.source).toEqual({ kind: "obsidian", path: "/tmp/vault" });
});
