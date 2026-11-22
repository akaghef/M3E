// Which directory the server runs its record store on: M3E_STORE_DIR, or a migrated store in the data directory.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { recordStoreDir } from "../../src/node/record_store/active";

const saved = { store: process.env.M3E_STORE_DIR, data: process.env.M3E_DATA_DIR };
afterEach(() => {
  for (const [key, value] of [["M3E_STORE_DIR", saved.store], ["M3E_DATA_DIR", saved.data]] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function dataDir(withStore: boolean): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-store-dir-"));
  if (withStore) {
    fs.mkdirSync(path.join(dir, "store"));
    fs.writeFileSync(path.join(dir, "store", "snapshot.jsonl"), "");
  }
  return dir;
}

describe("recordStoreDir", () => {
  test("a migrated store in the data directory is used without M3E_STORE_DIR", () => {
    delete process.env.M3E_STORE_DIR;
    const dir = dataDir(true);
    process.env.M3E_DATA_DIR = dir;
    expect(recordStoreDir()).toBe(path.resolve(dir, "store"));
  });

  test("a data directory without a migrated store stays on SQLite", () => {
    delete process.env.M3E_STORE_DIR;
    const dir = dataDir(false);
    fs.mkdirSync(path.join(dir, "store")); // an empty store directory is not a migrated store
    process.env.M3E_DATA_DIR = dir;
    expect(recordStoreDir()).toBeNull();
  });

  test("M3E_STORE_DIR wins over the data directory", () => {
    const dir = dataDir(true);
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-store-other-"));
    process.env.M3E_DATA_DIR = dir;
    process.env.M3E_STORE_DIR = other;
    expect(recordStoreDir()).toBe(path.resolve(other));
  });

  test("no data directory and no M3E_STORE_DIR is SQLite", () => {
    delete process.env.M3E_STORE_DIR;
    delete process.env.M3E_DATA_DIR;
    expect(recordStoreDir()).toBeNull();
  });
});
