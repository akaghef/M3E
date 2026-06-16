import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function makeTempDb() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-home-test-"));
  return path.join(base, "data.sqlite");
}

test("listMaps returns empty array for fresh database", () => {
  const dbPath = makeTempDb();
  const maps = RapidMvpModel.listMaps(dbPath);
  expect(maps).toEqual([]);
});

test("createMap + listMaps returns MapSummary", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "map-a", "Alpha");
  const maps = RapidMvpModel.listMaps(dbPath);
  expect(maps.length).toBe(1);
  const d = maps[0];
  expect(d.id).toBe("map-a");
  expect(d.label).toBe("Alpha");
  expect(d.archived).toBe(false);
  expect(d.tags).toEqual([]);
  expect(d.nodeCount).toBeGreaterThan(0);
  expect(typeof d.charCount).toBe("number");
  expect(typeof d.savedAt).toBe("string");
});

test("createMap throws when id already exists", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "dup", "X");
  expect(() => RapidMvpModel.createMap(dbPath, "dup", "Y")).toThrow(/already exists/);
});

test("renameMap updates the root node label", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "r", "Old");
  RapidMvpModel.renameMap(dbPath, "r", "New Label");
  const maps = RapidMvpModel.listMaps(dbPath);
  expect(maps[0].label).toBe("New Label");
});

test("renameMap rejects empty label", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "r", "Old");
  expect(() => RapidMvpModel.renameMap(dbPath, "r", "   ")).toThrow(/Invalid label/);
});

test("setMapTags persists and dedupes tags", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "t", "T");
  RapidMvpModel.setMapTags(dbPath, "t", ["alpha", "beta", "alpha", "  ", "gamma"]);
  const maps = RapidMvpModel.listMaps(dbPath);
  expect(maps[0].tags.sort()).toEqual(["alpha", "beta", "gamma"]);
});

test("archive hides maps from default list and restore brings them back", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "x", "Visible");
  RapidMvpModel.setArchived(dbPath, "x", true);
  expect(RapidMvpModel.listMaps(dbPath).length).toBe(0);
  expect(RapidMvpModel.listMaps(dbPath, { includeArchived: true }).length).toBe(1);
  expect(RapidMvpModel.listMaps(dbPath, { includeArchived: true })[0].archived).toBe(true);
  RapidMvpModel.setArchived(dbPath, "x", false);
  expect(RapidMvpModel.listMaps(dbPath).length).toBe(1);
});

test("deleteMap requires archived state", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "d", "Doomed");
  expect(() => RapidMvpModel.deleteMap(dbPath, "d")).toThrow(/not archived/);
  RapidMvpModel.setArchived(dbPath, "d", true);
  RapidMvpModel.deleteMap(dbPath, "d");
  expect(RapidMvpModel.mapExists(dbPath, "d")).toBe(false);
});

test("duplicateMap copies state and tags but assigns new id", () => {
  const dbPath = makeTempDb();
  RapidMvpModel.createMap(dbPath, "src", "Source");
  RapidMvpModel.setMapTags(dbPath, "src", ["work"]);
  RapidMvpModel.duplicateMap(dbPath, "src", "dup");
  const maps = RapidMvpModel.listMaps(dbPath);
  const dup = maps.find((d) => d.id === "dup");
  expect(dup).toBeTruthy();
  expect(dup.label).toBe("Source");
  expect(dup.tags).toEqual(["work"]);
  expect(dup.archived).toBe(false);
});

test("listMaps tolerates pre-existing rows without tags/archived columns (migration)", () => {
  const dbPath = makeTempDb();
  // First call creates the table with new columns via migration code path.
  RapidMvpModel.createMap(dbPath, "legacy", "Legacy");
  // Manually insert to simulate legacy row with NULL tags/archived.
  const Database = require("better-sqlite3");
  const db = new Database(dbPath);
  db.prepare(
    "INSERT INTO maps (id, version, saved_at, state_json) VALUES (?, 1, ?, ?)",
  ).run("legacy2", new Date().toISOString(), JSON.stringify({ rootId: "r1", nodes: { r1: { id: "r1", parentId: null, children: [], text: "L2" } }, links: {} }));
  db.close();

  const maps = RapidMvpModel.listMaps(dbPath);
  const l2 = maps.find((d) => d.id === "legacy2");
  expect(l2).toBeTruthy();
  expect(l2.tags).toEqual([]);
  expect(l2.archived).toBe(false);
  expect(l2.label).toBe("L2");
});
