import { afterAll, beforeAll, expect, test } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let tmpDir;
let ensureMap;
let RapidMvpModel;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ensure-map-"));
  ({ ensureMap } = require("../../dist/node/start_viewer.js"));
  ({ RapidMvpModel } = require("../../dist/node/rapid_mvp.js"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function readRow(dbPath, mapId) {
  const db = RapidMvpModel.openSqlite(dbPath);
  try {
    return db.prepare("SELECT saved_at AS savedAt, state_json AS stateJson FROM maps WHERE id = ?").get(mapId);
  } finally {
    db.close();
  }
}

function rootText(row) {
  const state = JSON.parse(row.stateJson);
  return state.nodes[state.rootId].text;
}

test("ensureMap leaves an existing map untouched at startup", () => {
  const dbPath = path.join(tmpDir, "existing.sqlite");
  RapidMvpModel.createMap(dbPath, "map_research", "研究");
  RapidMvpModel.renameMap(dbPath, "map_research", "研究ノート");
  const before = readRow(dbPath, "map_research");

  ensureMap(dbPath, "map_research", "研究");

  const after = readRow(dbPath, "map_research");
  expect(after.savedAt).toBe(before.savedAt);
  expect(after.stateJson).toBe(before.stateJson);
  expect(rootText(after)).toBe("研究ノート");
});

test("ensureMap creates a missing map with the configured label", () => {
  const dbPath = path.join(tmpDir, "missing.sqlite");
  ensureMap(dbPath, "map_dev", "開発");
  expect(RapidMvpModel.mapExists(dbPath, "map_dev")).toBe(true);
  expect(rootText(readRow(dbPath, "map_dev"))).toBe("開発");
});

test("ensureMap still migrates a legacy map id to the configured id and label", () => {
  const dbPath = path.join(tmpDir, "legacy.sqlite");
  RapidMvpModel.createMap(dbPath, "rapid-main", "old main");
  ensureMap(dbPath, "map_dev", "開発", ["rapid-main"]);
  expect(RapidMvpModel.mapExists(dbPath, "rapid-main")).toBe(false);
  expect(rootText(readRow(dbPath, "map_dev"))).toBe("開発");
});
