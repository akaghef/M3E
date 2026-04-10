const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const { FileTransport, SupabaseTransport, loadCloudSyncConfig, detectCloudConflict, withRetry } = require("../../dist/node/cloud_sync.js");
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

    const pushResult = await transport.push("doc1", doc, null, false);
    assert.equal(pushResult.ok, true);
    assert.equal(pushResult.savedAt, "2026-04-09T00:00:00.000Z");
    assert.equal(pushResult.forced, false);
    assert.equal(typeof pushResult.cloudDocVersion, "number");
    assert.equal(pushResult.cloudDocVersion, 1);

    const pullResult = await transport.pull("doc1");
    assert.equal(pullResult.ok, true);
    assert.equal(pullResult.version, 1);
    assert.equal(pullResult.savedAt, "2026-04-09T00:00:00.000Z");
    assert.ok(pullResult.state.rootId);
    assert.ok(Object.keys(pullResult.state.nodes).length > 0);
    assert.equal(pullResult.docVersion, 1);
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
    assert.equal(result.mode, "file-mirror");
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
    await transport.push("doc2", doc, null, false);

    const result = await transport.status("doc2");
    assert.equal(result.ok, true);
    assert.equal(result.exists, true);
    assert.equal(result.cloudSavedAt, "2026-04-09T01:00:00.000Z");
    assert.ok(result.lastSyncedAt);
    assert.equal(result.cloudDocVersion, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: push detects conflict via docVersion", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const doc1 = createSavedDoc("V1", "2026-04-09T00:00:00.000Z");
    const push1 = await transport.push("doc3", doc1, null, false);
    assert.equal(push1.cloudDocVersion, 1);

    // Update the doc with correct base version
    const doc2 = createSavedDoc("V2", "2026-04-09T00:00:10.000Z");
    const push2 = await transport.push("doc3", doc2, push1.savedAt, false, push1.cloudDocVersion);
    assert.equal(push2.ok, true);
    assert.equal(push2.cloudDocVersion, 2);

    // Conflict: stale baseDocVersion
    const doc3 = createSavedDoc("V3", "2026-04-09T00:00:20.000Z");
    const result = await transport.push("doc3", doc3, push1.savedAt, false, push1.cloudDocVersion);
    assert.equal(result.ok, false);
    assert.equal(result.conflict, true);
    assert.equal(result.cloudDocVersion, 2);
    assert.ok(result.remoteState);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: push detects conflict via savedAt fallback", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const doc1 = createSavedDoc("V1", "2026-04-09T00:00:00.000Z");
    await transport.push("doc3b", doc1, null, false);

    const doc2 = createSavedDoc("V2", "2026-04-09T00:00:10.000Z");
    await transport.push("doc3b", doc2, "2026-04-09T00:00:00.000Z", false);

    // Conflict: stale baseSavedAt (no docVersion provided)
    const doc3 = createSavedDoc("V3", "2026-04-09T00:00:20.000Z");
    const result = await transport.push("doc3b", doc3, "2026-04-09T00:00:00.000Z", false);
    assert.equal(result.ok, false);
    assert.equal(result.conflict, true);
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
    await transport.push("doc4", doc1, null, false);

    const doc2 = createSavedDoc("V2", "2026-04-09T00:00:10.000Z");
    await transport.push("doc4", doc2, "2026-04-09T00:00:00.000Z", false);

    // Force push with stale baseSavedAt
    const doc3 = createSavedDoc("Forced", "2026-04-09T00:00:30.000Z");
    const result = await transport.push("doc4", doc3, "2026-04-09T00:00:00.000Z", true);
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
    assert.ok(result.error.includes("not found"));
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
    assert.ok(result.error.includes("unsupported"));
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

test("FileTransport: docVersion increments on each push", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const doc1 = createSavedDoc("A", "2026-04-09T00:00:00.000Z");
    const push1 = await transport.push("ver-test", doc1, null, false);
    assert.equal(push1.cloudDocVersion, 1);

    const doc2 = createSavedDoc("B", "2026-04-09T00:00:10.000Z");
    const push2 = await transport.push("ver-test", doc2, push1.savedAt, false, push1.cloudDocVersion);
    assert.equal(push2.cloudDocVersion, 2);

    const doc3 = createSavedDoc("C", "2026-04-09T00:00:20.000Z");
    const push3 = await transport.push("ver-test", doc3, push2.savedAt, false, push2.cloudDocVersion);
    assert.equal(push3.cloudDocVersion, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// detectCloudConflict tests
// ---------------------------------------------------------------------------

test("detectCloudConflict: docVersion takes priority over savedAt", () => {
  // docVersions match even though savedAt differ => no conflict
  assert.equal(detectCloudConflict("2026-04-01", "2026-04-02", false, 5, 5), false);
  // docVersions differ even though savedAt match => conflict
  assert.equal(detectCloudConflict("2026-04-01", "2026-04-01", false, 6, 5), true);
});

test("detectCloudConflict: falls back to savedAt when docVersion not provided", () => {
  assert.equal(detectCloudConflict("a", "b", false), true);
  assert.equal(detectCloudConflict("a", "a", false), false);
});

test("detectCloudConflict still works after refactor", () => {
  assert.equal(detectCloudConflict("a", "b", false), true);
  assert.equal(detectCloudConflict("a", "a", false), false);
  assert.equal(detectCloudConflict("a", "b", true), false);
  assert.equal(detectCloudConflict(null, "b", false), false);
  assert.equal(detectCloudConflict("a", null, false), false);
});

// ---------------------------------------------------------------------------
// withRetry tests
// ---------------------------------------------------------------------------

test("withRetry: succeeds on first attempt", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => { calls++; return "ok"; },
    () => true,
    { maxRetries: 3, initialDelayMs: 1, maxDelayMs: 10 },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 1);
});

test("withRetry: retries on transient error and succeeds", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "recovered";
    },
    () => true,
    { maxRetries: 3, initialDelayMs: 1, maxDelayMs: 10 },
  );
  assert.equal(result, "recovered");
  assert.equal(calls, 3);
});

test("withRetry: does not retry non-retryable errors", async () => {
  let calls = 0;
  await assert.rejects(
    () => withRetry(
      async () => { calls++; throw new Error("conflict"); },
      (err) => !err.message.includes("conflict"),
      { maxRetries: 3, initialDelayMs: 1, maxDelayMs: 10 },
    ),
    /conflict/,
  );
  assert.equal(calls, 1);
});

test("withRetry: throws after max retries", async () => {
  let calls = 0;
  await assert.rejects(
    () => withRetry(
      async () => { calls++; throw new Error("fail"); },
      () => true,
      { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 10 },
    ),
    /fail/,
  );
  assert.equal(calls, 3); // 1 initial + 2 retries
});
