import { test, expect } from "vitest";
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const { FileTransport, SupabaseTransport, loadCloudSyncConfig, detectCloudConflict, withRetry } = require("../../dist/node/cloud_sync.js");
const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function createSavedMap(label, savedAt) {
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
    const map = createSavedMap("A", "2026-04-09T00:00:00.000Z");

    const pushResult = await transport.push("map1", map, null, false);
    expect(pushResult.ok).toBe(true);
    expect(pushResult.savedAt).toBe("2026-04-09T00:00:00.000Z");
    expect(pushResult.forced).toBe(false);
    expect(typeof pushResult.cloudMapVersion).toBe("number");
    expect(pushResult.cloudMapVersion).toBe(1);

    const pullResult = await transport.pull("map1");
    expect(pullResult.ok).toBe(true);
    expect(pullResult.version).toBe(1);
    expect(pullResult.savedAt).toBe("2026-04-09T00:00:00.000Z");
    expect(pullResult.state.rootId).toBeTruthy();
    expect(Object.keys(pullResult.state.nodes).length > 0).toBe(true);
    expect(pullResult.mapVersion).toBe(1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: status returns exists=false for missing map", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const result = await transport.status("nonexistent");
    expect(result.ok).toBe(true);
    expect(result.enabled).toBe(true);
    expect(result.mode).toBe("file-mirror");
    expect(result.mapId).toBe("nonexistent");
    expect(result.exists).toBe(false);
    expect(result.cloudSavedAt).toBe(null);
    expect(result.lastSyncedAt).toBe(null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: status returns exists=true after push", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const map = createSavedMap("B", "2026-04-09T01:00:00.000Z");
    await transport.push("map2", map, null, false);

    const result = await transport.status("map2");
    expect(result.ok).toBe(true);
    expect(result.exists).toBe(true);
    expect(result.cloudSavedAt).toBe("2026-04-09T01:00:00.000Z");
    expect(result.lastSyncedAt).toBeTruthy();
    expect(result.cloudMapVersion).toBe(1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: push detects conflict via mapVersion", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const map1 = createSavedMap("V1", "2026-04-09T00:00:00.000Z");
    const push1 = await transport.push("map3", map1, null, false);
    expect(push1.cloudMapVersion).toBe(1);

    // Update the map with correct base version
    const map2 = createSavedMap("V2", "2026-04-09T00:00:10.000Z");
    const push2 = await transport.push("map3", map2, push1.savedAt, false, push1.cloudMapVersion);
    expect(push2.ok).toBe(true);
    expect(push2.cloudMapVersion).toBe(2);

    // Conflict: stale baseMapVersion
    const map3 = createSavedMap("V3", "2026-04-09T00:00:20.000Z");
    const result = await transport.push("map3", map3, push1.savedAt, false, push1.cloudMapVersion);
    expect(result.ok).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.cloudMapVersion).toBe(2);
    expect(result.remoteState).toBeTruthy();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: push detects conflict via savedAt fallback", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const map1 = createSavedMap("V1", "2026-04-09T00:00:00.000Z");
    await transport.push("map3b", map1, null, false);

    const map2 = createSavedMap("V2", "2026-04-09T00:00:10.000Z");
    await transport.push("map3b", map2, "2026-04-09T00:00:00.000Z", false);

    // Conflict: stale baseSavedAt (no mapVersion provided)
    const map3 = createSavedMap("V3", "2026-04-09T00:00:20.000Z");
    const result = await transport.push("map3b", map3, "2026-04-09T00:00:00.000Z", false);
    expect(result.ok).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.cloudSavedAt).toBe("2026-04-09T00:00:10.000Z");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: force push overrides conflict", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const map1 = createSavedMap("V1", "2026-04-09T00:00:00.000Z");
    await transport.push("map4", map1, null, false);

    const map2 = createSavedMap("V2", "2026-04-09T00:00:10.000Z");
    await transport.push("map4", map2, "2026-04-09T00:00:00.000Z", false);

    // Force push with stale baseSavedAt
    const map3 = createSavedMap("Forced", "2026-04-09T00:00:30.000Z");
    const result = await transport.push("map4", map3, "2026-04-09T00:00:00.000Z", true);
    expect(result.ok).toBe(true);
    expect(result.forced).toBe(true);

    // Verify forced map is what we get back
    const pulled = await transport.pull("map4");
    expect(pulled.ok).toBe(true);
    expect(pulled.savedAt).toBe("2026-04-09T00:00:30.000Z");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: pull returns error for missing map", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const result = await transport.pull("missing");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
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
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unsupported/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: creates cloud dir if it does not exist", async () => {
  const dir = path.join(os.tmpdir(), `m3e-ft-nested-${Date.now()}`);
  const nested = path.join(dir, "sub", "deep");
  try {
    expect(fs.existsSync(nested)).toBe(false);
    const transport = new FileTransport(nested);
    await transport.status("probe");
    expect(fs.existsSync(nested)).toBe(true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTransport: mapVersion increments on each push", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-ft-"));
  try {
    const transport = new FileTransport(dir);
    const map1 = createSavedMap("A", "2026-04-09T00:00:00.000Z");
    const push1 = await transport.push("ver-test", map1, null, false);
    expect(push1.cloudMapVersion).toBe(1);

    const map2 = createSavedMap("B", "2026-04-09T00:00:10.000Z");
    const push2 = await transport.push("ver-test", map2, push1.savedAt, false, push1.cloudMapVersion);
    expect(push2.cloudMapVersion).toBe(2);

    const map3 = createSavedMap("C", "2026-04-09T00:00:20.000Z");
    const push3 = await transport.push("ver-test", map3, push2.savedAt, false, push2.cloudMapVersion);
    expect(push3.cloudMapVersion).toBe(3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// detectCloudConflict tests
// ---------------------------------------------------------------------------

test("detectCloudConflict: mapVersion takes priority over savedAt", () => {
  // mapVersions match even though savedAt differ => no conflict
  expect(detectCloudConflict("2026-04-01", "2026-04-02", false, 5, 5)).toBe(false);
  // mapVersions differ even though savedAt match => conflict
  expect(detectCloudConflict("2026-04-01", "2026-04-01", false, 6, 5)).toBe(true);
});

test("detectCloudConflict: falls back to savedAt when mapVersion not provided", () => {
  expect(detectCloudConflict("a", "b", false)).toBe(true);
  expect(detectCloudConflict("a", "a", false)).toBe(false);
});

test("detectCloudConflict still works after refactor", () => {
  expect(detectCloudConflict("a", "b", false)).toBe(true);
  expect(detectCloudConflict("a", "a", false)).toBe(false);
  expect(detectCloudConflict("a", "b", true)).toBe(false);
  expect(detectCloudConflict(null, "b", false)).toBe(false);
  expect(detectCloudConflict("a", null, false)).toBe(false);
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
  expect(result).toBe("ok");
  expect(calls).toBe(1);
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
  expect(result).toBe("recovered");
  expect(calls).toBe(3);
});

test("withRetry: does not retry non-retryable errors", async () => {
  let calls = 0;
  await expect(
    withRetry(
      async () => { calls++; throw new Error("conflict"); },
      (err) => !err.message.includes("conflict"),
      { maxRetries: 3, initialDelayMs: 1, maxDelayMs: 10 },
    ),
  ).rejects.toThrow(/conflict/);
  expect(calls).toBe(1);
});

test("withRetry: throws after max retries", async () => {
  let calls = 0;
  await expect(
    withRetry(
      async () => { calls++; throw new Error("fail"); },
      () => true,
      { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 10 },
    ),
  ).rejects.toThrow(/fail/);
  expect(calls).toBe(3); // 1 initial + 2 retries
});
