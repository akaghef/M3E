const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createBackup, pruneOldBackups, startAutoBackup, stopAutoBackup } = require("../../dist/node/backup.js");
const Database = require("better-sqlite3");

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "m3e-backup-test-"));
}

function createTestDb(dir) {
  const dbPath = path.join(dir, "test.sqlite");
  const db = new Database(dbPath);
  db.exec("CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, version INTEGER, saved_at TEXT, state_json TEXT)");
  db.prepare("INSERT INTO documents (id, version, saved_at, state_json) VALUES (?, ?, ?, ?)").run(
    "default", 1, new Date().toISOString(), '{"rootId":"r1","nodes":{},"links":{}}'
  );
  db.close();
  return dbPath;
}

test("createBackup produces a file in backupDir", async () => {
  const tmpDir = makeTmpDir();
  const dbPath = createTestDb(tmpDir);
  const backupDir = path.join(tmpDir, "backups");

  const result = await createBackup(dbPath, backupDir);

  assert.ok(fs.existsSync(result), "backup file should exist");
  assert.ok(result.startsWith(backupDir), "backup should be inside backupDir");
  assert.match(path.basename(result), /^M3E_dataV1_\d{8}_\d{6}\.sqlite$/);

  // Verify backup is a valid SQLite file
  const backupDb = new Database(result, { readonly: true });
  const row = backupDb.prepare("SELECT id FROM documents WHERE id = ?").get("default");
  backupDb.close();
  assert.ok(row, "backup DB should contain the document");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("createBackup creates backupDir if it does not exist", async () => {
  const tmpDir = makeTmpDir();
  const dbPath = createTestDb(tmpDir);
  const backupDir = path.join(tmpDir, "nested", "deep", "backups");

  assert.ok(!fs.existsSync(backupDir));
  await createBackup(dbPath, backupDir);
  assert.ok(fs.existsSync(backupDir));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("pruneOldBackups keeps maxGenerations and deletes oldest", () => {
  const tmpDir = makeTmpDir();
  const backupDir = path.join(tmpDir, "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  // Create 5 fake backup files with different timestamps
  const names = [
    "M3E_dataV1_20260401_100000.sqlite",
    "M3E_dataV1_20260401_110000.sqlite",
    "M3E_dataV1_20260401_120000.sqlite",
    "M3E_dataV1_20260401_130000.sqlite",
    "M3E_dataV1_20260401_140000.sqlite",
  ];
  for (const name of names) {
    fs.writeFileSync(path.join(backupDir, name), "fake");
  }

  // Keep max 3
  pruneOldBackups(backupDir, 3);

  const remaining = fs.readdirSync(backupDir).sort();
  assert.equal(remaining.length, 3);
  // Oldest two should be gone
  assert.ok(!remaining.includes("M3E_dataV1_20260401_100000.sqlite"));
  assert.ok(!remaining.includes("M3E_dataV1_20260401_110000.sqlite"));
  // Newest three should remain
  assert.ok(remaining.includes("M3E_dataV1_20260401_120000.sqlite"));
  assert.ok(remaining.includes("M3E_dataV1_20260401_130000.sqlite"));
  assert.ok(remaining.includes("M3E_dataV1_20260401_140000.sqlite"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("pruneOldBackups does nothing when under limit", () => {
  const tmpDir = makeTmpDir();
  const backupDir = path.join(tmpDir, "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  fs.writeFileSync(path.join(backupDir, "M3E_dataV1_20260401_100000.sqlite"), "fake");
  fs.writeFileSync(path.join(backupDir, "M3E_dataV1_20260401_110000.sqlite"), "fake");

  pruneOldBackups(backupDir, 10);

  const remaining = fs.readdirSync(backupDir);
  assert.equal(remaining.length, 2);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("pruneOldBackups ignores non-matching files", () => {
  const tmpDir = makeTmpDir();
  const backupDir = path.join(tmpDir, "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  fs.writeFileSync(path.join(backupDir, "M3E_dataV1_20260401_100000.sqlite"), "fake");
  fs.writeFileSync(path.join(backupDir, "random-file.txt"), "other");
  fs.writeFileSync(path.join(backupDir, "M3E_dataV1_20260401_110000.sqlite"), "fake");

  pruneOldBackups(backupDir, 1);

  const remaining = fs.readdirSync(backupDir).sort();
  assert.equal(remaining.length, 2); // 1 backup + 1 random file
  assert.ok(remaining.includes("random-file.txt"));
  assert.ok(remaining.includes("M3E_dataV1_20260401_110000.sqlite"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("pruneOldBackups handles missing directory gracefully", () => {
  // Should not throw
  pruneOldBackups("/nonexistent/path/that/should/not/exist", 5);
});

test("stopAutoBackup can be called safely without prior start", () => {
  // Should not throw
  stopAutoBackup();
});

test("startAutoBackup and stopAutoBackup lifecycle", () => {
  const tmpDir = makeTmpDir();
  const dbPath = createTestDb(tmpDir);
  const backupDir = path.join(tmpDir, "backups");

  // Start with a very long interval so it won't fire during the test
  startAutoBackup(dbPath, backupDir, 999999999, 10);
  // Calling start again should replace the timer (not leak)
  startAutoBackup(dbPath, backupDir, 999999999, 10);
  stopAutoBackup();

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
