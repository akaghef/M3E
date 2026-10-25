import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

// New installs copy this seed into the workspace; every map in it must open.
const seed = path.resolve(__dirname, "../../../install/assets/seeds/core-seed.sqlite");

test("every map in the shipped core seed loads", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "m3e-core-seed-")), "data.sqlite");
  fs.copyFileSync(seed, dbPath);
  const db = new Database(dbPath, { readonly: true });
  const ids = db.prepare("SELECT id FROM maps").all().map((row) => row.id);
  db.close();
  expect(ids.length).toBeGreaterThan(0);
  const failures = [];
  for (const id of ids) {
    try {
      RapidMvpModel.loadFromSqlite(dbPath, id);
    } catch (error) {
      failures.push(`${id}: ${error.message}`);
    }
  }
  expect(failures).toEqual([]);
});
