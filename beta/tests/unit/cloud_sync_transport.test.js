const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const { FileTransport, HttpTransport, SupabaseTransport, createTransport, loadCloudSyncConfig, detectCloudConflict } = require("../../dist/node/cloud_sync.js");
const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function createSavedDoc(label, savedAt) {
  const model = new RapidMvpModel("Root");
  model.addNode(model.state.rootId, label || "child");
  return {
    version: 1,
    savedAt: savedAt || new Date().toISOString(),
    state: model.toJSON(),
  };
}

// ---------------------------------------------------------------------------
// FileTransport unit tests
// ---------------------------------------------------------------------------

test("FileTransport: push and pull round-trip", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const doc = createSavedDoc("A", "2026-04-09T00:00:00.000Z");

    const pushResult = await transport.push("doc1", doc);
    assert.equal(pushResult.ok, true);
    assert.equal(pushResult.savedAt, "2026-04-09T00:00:00.000Z");
    assert.equal(pushResult.forced, false);

    const pullResult = await transport.pull("doc1");
    assert.equal(pullResult.ok, true);
    assert.equal(pullResult.version, 1);
    assert.equal(pullResult.savedAt, "2026-04-09T00:00:00.000Z");
    assert.ok(pullResult.state.rootId);
    assert.ok(Object.keys(pullResult.state.nodes).length > 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: status returns exists=false for missing doc", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const result = await transport.status("nonexistent");
    assert.equal(result.ok, true);
    assert.equal(result.enabled, true);
    assert.equal(result.mode, "file");
    assert.equal(result.documentId, "nonexistent");
    assert.equal(result.exists, false);
    assert.equal(result.cloudSavedAt, null);
    assert.equal(result.lastSyncedAt, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: status returns exists=true after push", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const doc = createSavedDoc("B", "2026-04-09T01:00:00.000Z");
    await transport.push("doc2", doc);

    const result = await transport.status("doc2");
    assert.equal(result.ok, true);
    assert.equal(result.exists, true);
    assert.equal(result.cloudSavedAt, "2026-04-09T01:00:00.000Z");
    assert.ok(result.lastSyncedAt);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: push detects conflict", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const doc1 = createSavedDoc("V1", "2026-04-09T00:00:00.000Z");
    await transport.push("doc3", doc1);

    // Update the doc
    const doc2 = createSavedDoc("V2", "2026-04-09T00:00:10.000Z");
    await transport.push("doc3", doc2, { baseSavedAt: "2026-04-09T00:00:00.000Z" });

    // Conflict: stale baseSavedAt
    const doc3 = createSavedDoc("V3", "2026-04-09T00:00:20.000Z");
    const result = await transport.push("doc3", doc3, { baseSavedAt: "2026-04-09T00:00:00.000Z" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "CLOUD_CONFLICT");
    assert.equal(result.cloudSavedAt, "2026-04-09T00:00:10.000Z");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: force push overrides conflict", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const doc1 = createSavedDoc("V1", "2026-04-09T00:00:00.000Z");
    await transport.push("doc4", doc1);

    const doc2 = createSavedDoc("V2", "2026-04-09T00:00:10.000Z");
    await transport.push("doc4", doc2, { baseSavedAt: "2026-04-09T00:00:00.000Z" });

    // Force push with stale baseSavedAt
    const doc3 = createSavedDoc("Forced", "2026-04-09T00:00:30.000Z");
    const result = await transport.push("doc4", doc3, { baseSavedAt: "2026-04-09T00:00:00.000Z", force: true });
    assert.equal(result.ok, true);
    assert.equal(result.forced, true);

    // Verify forced doc is what we get back
    const pulled = await transport.pull("doc4");
    assert.equal(pulled.ok, true);
    assert.equal(pulled.savedAt, "2026-04-09T00:00:30.000Z");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: pull returns error for missing doc", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const result = await transport.pull("missing");
    assert.equal(result.ok, false);
    assert.equal(result.code, "SYNC_CLOUD_NOT_FOUND");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: pull returns error for unsupported format", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const filePath = path.join(dir, "bad-format.json");
    fs.writeFileSync(filePath, JSON.stringify({ version: 99, state: {} }), "utf8");

    const result = await transport.pull("bad-format");
    assert.equal(result.ok, false);
    assert.equal(result.code, "SYNC_CLOUD_UNSUPPORTED_FORMAT");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: creates cloud dir if it does not exist", async () => {
  const dir = path.join(os.tmpdir(), `m3e-ft-nested-${Date.now()}`);
  const nested = path.join(dir, "sub", "deep");
  try {
    assert.equal(fs.existsSync(nested), false);
    const transport = new FileTransport(nested);
    await transport.status("probe");
    assert.equal(fs.existsSync(nested), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Stub transport tests
// ---------------------------------------------------------------------------

test("HttpTransport: methods throw not-implemented", async () => {
  const transport = new HttpTransport("https://example.com/sync");
  await assert.rejects(() => transport.push("x", createSavedDoc()), /not implemented/);
  await assert.rejects(() => transport.pull("x"), /not implemented/);
  await assert.rejects(() => transport.status("x"), /not implemented/);
});

test("SupabaseTransport: methods throw not-implemented", async () => {
  const transport = new SupabaseTransport("https://example.supabase.co");
  await assert.rejects(() => transport.push("x", createSavedDoc()), /not implemented/);
  await assert.rejects(() => transport.pull("x"), /not implemented/);
  await assert.rejects(() => transport.status("x"), /not implemented/);
});

// ---------------------------------------------------------------------------
// createTransport factory tests
// ---------------------------------------------------------------------------

test("createTransport returns FileTransport for file config", () => {
  const transport = createTransport({ enabled: true, transport: "file", cloudDir: "/tmp/test", endpoint: null });
  assert.equal(transport.kind, "file");
  assert.ok(transport instanceof FileTransport);
});

test("createTransport returns HttpTransport for http config", () => {
  const transport = createTransport({ enabled: true, transport: "http", cloudDir: "", endpoint: "https://example.com" });
  assert.equal(transport.kind, "http");
  assert.ok(transport instanceof HttpTransport);
});

test("createTransport returns SupabaseTransport for supabase config", () => {
  const transport = createTransport({ enabled: true, transport: "supabase", cloudDir: "", endpoint: "https://example.supabase.co" });
  assert.equal(transport.kind, "supabase");
  assert.ok(transport instanceof SupabaseTransport);
});

test("createTransport throws when http transport has no endpoint", () => {
  assert.throws(() => createTransport({ enabled: true, transport: "http", cloudDir: "", endpoint: null }), /M3E_CLOUD_ENDPOINT is required/);
});

test("createTransport throws when file transport has no cloudDir", () => {
  assert.throws(() => createTransport({ enabled: true, transport: "file", cloudDir: "", endpoint: null }), /M3E_CLOUD_DIR is required/);
});

// ---------------------------------------------------------------------------
// detectCloudConflict backward compat
// ---------------------------------------------------------------------------

test("detectCloudConflict still works after refactor", () => {
  assert.equal(detectCloudConflict("a", "b", false), true);
  assert.equal(detectCloudConflict("a", "a", false), false);
  assert.equal(detectCloudConflict("a", "b", true), false);
  assert.equal(detectCloudConflict(null, "b", false), false);
  assert.equal(detectCloudConflict("a", null, false), false);
});
