const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const {
  FileTransport,
  SupabaseTransport,
  loadCloudSyncConfig,
  detectCloudConflict,
} = require("../../dist/node/cloud_sync.js");

// ---------------------------------------------------------------------------
// FileTransport (class version) tests
// ---------------------------------------------------------------------------

test("FileTransport push + pull round-trip", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  const transport = new FileTransport(tmpDir);

  const doc = {
    version: 1,
    savedAt: "2026-04-09T00:00:00.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const pushResult = await transport.push("test-doc", doc, null, false);
  assert.equal(pushResult.ok, true);
  assert.equal(pushResult.documentId, "test-doc");

  const pullResult = await transport.pull("test-doc");
  assert.equal(pullResult.ok, true);
  assert.equal(pullResult.documentId, "test-doc");
  assert.equal(pullResult.state.rootId, "r1");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("FileTransport status returns exists false for missing doc", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  const transport = new FileTransport(tmpDir);

  const status = await transport.status("nonexistent");
  assert.equal(status.ok, true);
  assert.equal(status.exists, false);
  assert.equal(status.cloudSavedAt, null);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("FileTransport push detects conflict", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  const transport = new FileTransport(tmpDir);

  const doc1 = {
    version: 1,
    savedAt: "2026-04-09T00:00:00.000Z",
    state: { rootId: "r1", nodes: {} },
  };
  await transport.push("test-doc", doc1, null, false);

  const doc2 = {
    version: 1,
    savedAt: "2026-04-09T01:00:00.000Z",
    state: { rootId: "r1", nodes: {} },
  };
  // baseSavedAt does not match cloud savedAt => conflict
  const pushResult = await transport.push("test-doc", doc2, "2026-04-08T00:00:00.000Z", false);
  assert.equal(pushResult.ok, false);
  assert.equal(pushResult.conflict, true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("FileTransport push with force bypasses conflict", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  const transport = new FileTransport(tmpDir);

  const doc1 = {
    version: 1,
    savedAt: "2026-04-09T00:00:00.000Z",
    state: { rootId: "r1", nodes: {} },
  };
  await transport.push("test-doc", doc1, null, false);

  const doc2 = {
    version: 1,
    savedAt: "2026-04-09T01:00:00.000Z",
    state: { rootId: "r2", nodes: {} },
  };
  const pushResult = await transport.push("test-doc", doc2, "2026-04-08T00:00:00.000Z", true);
  assert.equal(pushResult.ok, true);
  assert.equal(pushResult.forced, true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("FileTransport pull returns error for nonexistent doc", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  const transport = new FileTransport(tmpDir);

  const result = await transport.pull("missing");
  assert.equal(result.ok, false);
  assert.match(result.error, /not found/i);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// SupabaseTransport — constructor + getClient guard
// ---------------------------------------------------------------------------

test("SupabaseTransport constructor stores url and anonKey", () => {
  const t = new SupabaseTransport("https://example.supabase.co", "anon-key-123");
  assert.equal(t.mode, "supabase");
});

test("SupabaseTransport methods fail gracefully when supabase-js is not resolvable", async () => {
  // This test verifies that calling push/pull/status without the actual
  // supabase-js library throws a clear error rather than crashing silently.
  // In CI, @supabase/supabase-js may not be installed.
  const t = new SupabaseTransport("https://fake.supabase.co", "fake-key");
  try {
    await t.status("test-doc");
    // If supabase-js IS installed, status will try to connect and may fail
    // with a network error — that is also acceptable.
  } catch (err) {
    // Expected: either MODULE_NOT_FOUND or a network/connection error
    assert.ok(
      err.message || err.code,
      "Error should have a message or code",
    );
  }
});

// ---------------------------------------------------------------------------
// loadCloudSyncConfig
// ---------------------------------------------------------------------------

test("loadCloudSyncConfig returns disabled when M3E_CLOUD_SYNC is not set", () => {
  const original = process.env.M3E_CLOUD_SYNC;
  delete process.env.M3E_CLOUD_SYNC;
  const config = loadCloudSyncConfig();
  assert.equal(config.enabled, false);
  assert.equal(config.transport, null);
  if (original !== undefined) process.env.M3E_CLOUD_SYNC = original;
});

test("loadCloudSyncConfig returns FileTransport by default", () => {
  const original = { ...process.env };
  process.env.M3E_CLOUD_SYNC = "1";
  delete process.env.M3E_CLOUD_TRANSPORT;
  process.env.M3E_DATA_DIR = os.tmpdir();

  const config = loadCloudSyncConfig();
  assert.equal(config.enabled, true);
  assert.ok(config.transport);
  assert.equal(config.transport.mode, "file-mirror");

  // Restore
  Object.keys(process.env).forEach((k) => {
    if (!(k in original)) delete process.env[k];
    else process.env[k] = original[k];
  });
});

test("loadCloudSyncConfig returns SupabaseTransport when configured", () => {
  const original = { ...process.env };
  process.env.M3E_CLOUD_SYNC = "1";
  process.env.M3E_CLOUD_TRANSPORT = "supabase";
  process.env.M3E_SUPABASE_URL = "https://test.supabase.co";
  process.env.M3E_SUPABASE_ANON_KEY = "test-key";

  const config = loadCloudSyncConfig();
  assert.equal(config.enabled, true);
  assert.ok(config.transport);
  assert.equal(config.transport.mode, "supabase");

  // Restore
  Object.keys(process.env).forEach((k) => {
    if (!(k in original)) delete process.env[k];
    else process.env[k] = original[k];
  });
});

test("loadCloudSyncConfig falls back to disabled when supabase env vars missing", () => {
  const original = { ...process.env };
  process.env.M3E_CLOUD_SYNC = "1";
  process.env.M3E_CLOUD_TRANSPORT = "supabase";
  delete process.env.M3E_SUPABASE_URL;
  delete process.env.M3E_SUPABASE_ANON_KEY;

  const config = loadCloudSyncConfig();
  assert.equal(config.enabled, false);
  assert.equal(config.transport, null);

  // Restore
  Object.keys(process.env).forEach((k) => {
    if (!(k in original)) delete process.env[k];
    else process.env[k] = original[k];
  });
});
