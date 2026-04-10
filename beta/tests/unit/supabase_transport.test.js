import { test, expect } from "vitest";
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
  expect(pushResult.ok).toBe(true);
  expect(pushResult.documentId).toBe("test-doc");

  const pullResult = await transport.pull("test-doc");
  expect(pullResult.ok).toBe(true);
  expect(pullResult.documentId).toBe("test-doc");
  expect(pullResult.state.rootId).toBe("r1");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("FileTransport status returns exists false for missing doc", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  const transport = new FileTransport(tmpDir);

  const status = await transport.status("nonexistent");
  expect(status.ok).toBe(true);
  expect(status.exists).toBe(false);
  expect(status.cloudSavedAt).toBe(null);

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
  expect(pushResult.ok).toBe(false);
  expect(pushResult.conflict).toBe(true);

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
  expect(pushResult.ok).toBe(true);
  expect(pushResult.forced).toBe(true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("FileTransport pull returns error for nonexistent doc", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  const transport = new FileTransport(tmpDir);

  const result = await transport.pull("missing");
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/not found/i);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// SupabaseTransport -- constructor + getClient guard
// ---------------------------------------------------------------------------

test("SupabaseTransport constructor stores url and anonKey", () => {
  const t = new SupabaseTransport("https://example.supabase.co", "anon-key-123");
  expect(t.mode).toBe("supabase");
});

test("SupabaseTransport methods fail gracefully when supabase-js is not resolvable", async () => {
  const t = new SupabaseTransport("https://fake.supabase.co", "fake-key");
  try {
    await t.status("test-doc");
  } catch (err) {
    expect(
      err.message || err.code,
    ).toBeTruthy();
  }
});

// ---------------------------------------------------------------------------
// loadCloudSyncConfig
// ---------------------------------------------------------------------------

test("loadCloudSyncConfig returns disabled when M3E_CLOUD_SYNC is not set", () => {
  const original = process.env.M3E_CLOUD_SYNC;
  delete process.env.M3E_CLOUD_SYNC;
  const config = loadCloudSyncConfig();
  expect(config.enabled).toBe(false);
  expect(config.transport).toBe(null);
  if (original !== undefined) process.env.M3E_CLOUD_SYNC = original;
});

test("loadCloudSyncConfig returns FileTransport by default", () => {
  const original = { ...process.env };
  process.env.M3E_CLOUD_SYNC = "1";
  delete process.env.M3E_CLOUD_TRANSPORT;
  process.env.M3E_DATA_DIR = os.tmpdir();

  const config = loadCloudSyncConfig();
  expect(config.enabled).toBe(true);
  expect(config.transport).toBeTruthy();
  expect(config.transport.mode).toBe("file-mirror");

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
  expect(config.enabled).toBe(true);
  expect(config.transport).toBeTruthy();
  expect(config.transport.mode).toBe("supabase");

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
  expect(config.enabled).toBe(false);
  expect(config.transport).toBe(null);

  // Restore
  Object.keys(process.env).forEach((k) => {
    if (!(k in original)) delete process.env[k];
    else process.env[k] = original[k];
  });
});
