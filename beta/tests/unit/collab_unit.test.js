"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  registerEntity,
  unregisterEntity,
  authenticateRequest,
  heartbeat,
  getActiveEntities,
  acquireScopeLock,
  releaseScopeLock,
  getScopeLocks,
  findScopeRoot,
  isInScope,
  getDocVersion,
  incrementDocVersion,
  setDocVersion,
  resetCollab,
} = require("../../dist/node/collab.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(token) {
  return { headers: { authorization: token ? `Bearer ${token}` : "" } };
}

// ---------------------------------------------------------------------------
// Entity management
// ---------------------------------------------------------------------------

test.beforeEach(() => {
  resetCollab();
});

test("registerEntity returns entity with expected fields", () => {
  const e = registerEntity("Alice", "human", ["read", "write"]);
  assert.ok(e.entityId.startsWith("e_"));
  assert.ok(e.token.startsWith("tok_"));
  assert.equal(e.displayName, "Alice");
  assert.equal(e.role, "human");
  assert.equal(e.priority, 100);
  assert.deepEqual(e.capabilities, ["read", "write"]);
  assert.ok(e.lastHeartbeat > 0);
});

test("registerEntity assigns correct priority for each role", () => {
  const owner = registerEntity("O", "owner", ["read", "write"]);
  const human = registerEntity("H", "human", ["read", "write"]);
  const aiSup = registerEntity("AS", "ai-supervised", ["read", "write"]);
  const ai = registerEntity("A", "ai", ["read", "write"]);
  const aiRo = registerEntity("AR", "ai-readonly", ["read"]);

  assert.equal(owner.priority, 1000);
  assert.equal(human.priority, 100);
  assert.equal(aiSup.priority, 50);
  assert.equal(ai.priority, 10);
  assert.equal(aiRo.priority, 1);
});

test("unregisterEntity removes entity and returns true", () => {
  const e = registerEntity("Bob", "ai", ["read"]);
  assert.equal(unregisterEntity(e.entityId), true);
  assert.equal(getActiveEntities().length, 0);
});

test("unregisterEntity returns false for unknown entityId", () => {
  assert.equal(unregisterEntity("nonexistent"), false);
});

test("unregisterEntity releases locks held by entity", () => {
  const e = registerEntity("Locker", "human", ["read", "write"]);
  acquireScopeLock("scope_1", e);
  assert.equal(getScopeLocks().length, 1);

  unregisterEntity(e.entityId);
  assert.equal(getScopeLocks().length, 0);
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

test("authenticateRequest returns entity for valid token", () => {
  const e = registerEntity("Auth", "human", ["read", "write"]);
  const result = authenticateRequest(makeRequest(e.token));
  assert.ok(result);
  assert.equal(result.entityId, e.entityId);
});

test("authenticateRequest returns null for missing Authorization header", () => {
  const result = authenticateRequest({ headers: {} });
  assert.equal(result, null);
});

test("authenticateRequest returns null for non-Bearer auth", () => {
  const result = authenticateRequest({ headers: { authorization: "Basic abc" } });
  assert.equal(result, null);
});

test("authenticateRequest returns null for unknown token", () => {
  const result = authenticateRequest(makeRequest("tok_unknown_value"));
  assert.equal(result, null);
});

test("authenticateRequest returns null for timed-out entity", () => {
  const e = registerEntity("Timeout", "ai", ["read"]);
  // Simulate timeout by backdating lastHeartbeat
  e.lastHeartbeat = Date.now() - 60_000;
  const result = authenticateRequest(makeRequest(e.token));
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

test("heartbeat updates lastHeartbeat timestamp", () => {
  const e = registerEntity("HB", "ai", ["read"]);
  const before = e.lastHeartbeat;
  // Small delay to ensure time advances
  const updated = heartbeat(e.entityId, []);
  assert.equal(updated, true);
  assert.ok(e.lastHeartbeat >= before);
});

test("heartbeat returns false for unknown entity", () => {
  assert.equal(heartbeat("unknown_id", []), false);
});

test("heartbeat extends lock expiry", () => {
  const e = registerEntity("LockHB", "human", ["read", "write"]);
  const lockResult = acquireScopeLock("scope_hb", e);
  assert.equal(lockResult.ok, true);
  const originalExpiry = lockResult.lock.expiresAt;

  // Simulate time passing
  lockResult.lock.expiresAt = Date.now() + 5000; // 5 seconds left
  heartbeat(e.entityId, [lockResult.lock.lockId]);

  // Lock should be extended
  assert.ok(lockResult.lock.expiresAt > Date.now() + 5000);
});

// ---------------------------------------------------------------------------
// getActiveEntities
// ---------------------------------------------------------------------------

test("getActiveEntities returns only non-timed-out entities", () => {
  const e1 = registerEntity("Active1", "human", ["read"]);
  const e2 = registerEntity("Active2", "ai", ["read"]);
  const e3 = registerEntity("TimedOut", "ai", ["read"]);
  e3.lastHeartbeat = Date.now() - 60_000;

  const active = getActiveEntities();
  assert.equal(active.length, 2);
  const ids = active.map((a) => a.entityId);
  assert.ok(ids.includes(e1.entityId));
  assert.ok(ids.includes(e2.entityId));
  assert.ok(!ids.includes(e3.entityId));
});

// ---------------------------------------------------------------------------
// Scope locking
// ---------------------------------------------------------------------------

test("acquireScopeLock succeeds for unlocked scope", () => {
  const e = registerEntity("Locker", "human", ["read", "write"]);
  const result = acquireScopeLock("scope_a", e);
  assert.equal(result.ok, true);
  assert.ok(result.lock.lockId.startsWith("lock_"));
  assert.equal(result.lock.scopeId, "scope_a");
  assert.equal(result.lock.entityId, e.entityId);
  assert.ok(result.lock.expiresAt > Date.now());
});

test("acquireScopeLock refreshes own lock", () => {
  const e = registerEntity("SelfRefresh", "human", ["read", "write"]);
  const first = acquireScopeLock("scope_self", e);
  assert.equal(first.ok, true);

  const second = acquireScopeLock("scope_self", e);
  assert.equal(second.ok, true);
  assert.equal(second.lock.lockId, first.lock.lockId);
  assert.ok(second.lock.expiresAt >= first.lock.expiresAt);
});

test("acquireScopeLock fails for lower priority", () => {
  const human = registerEntity("Human", "human", ["read", "write"]);
  const ai = registerEntity("AI", "ai", ["read", "write"]);

  acquireScopeLock("scope_pri", human);
  const result = acquireScopeLock("scope_pri", ai);
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
});

test("acquireScopeLock preempts for higher priority", () => {
  const ai = registerEntity("AI", "ai", ["read", "write"]);
  const human = registerEntity("Human", "human", ["read", "write"]);

  acquireScopeLock("scope_preempt", ai);
  const result = acquireScopeLock("scope_preempt", human);
  assert.equal(result.ok, true);
  assert.equal(result.lock.entityId, human.entityId);
});

test("releaseScopeLock removes lock", () => {
  const e = registerEntity("Releaser", "human", ["read", "write"]);
  acquireScopeLock("scope_rel", e);
  assert.equal(getScopeLocks().length, 1);

  const released = releaseScopeLock("scope_rel", e);
  assert.equal(released, true);
  assert.equal(getScopeLocks().length, 0);
});

test("releaseScopeLock returns false if entity does not hold the lock", () => {
  const e1 = registerEntity("Holder", "human", ["read", "write"]);
  const e2 = registerEntity("Other", "human", ["read", "write"]);
  acquireScopeLock("scope_other", e1);

  assert.equal(releaseScopeLock("scope_other", e2), false);
});

test("expired locks are cleaned up on getScopeLocks", () => {
  const e = registerEntity("Expiry", "human", ["read", "write"]);
  const result = acquireScopeLock("scope_exp", e);
  assert.equal(result.ok, true);

  // Expire the lock manually
  result.lock.expiresAt = Date.now() - 1000;

  const locks = getScopeLocks();
  assert.equal(locks.length, 0);
});

// ---------------------------------------------------------------------------
// findScopeRoot / isInScope
// ---------------------------------------------------------------------------

test("findScopeRoot returns folder ancestor", () => {
  const nodes = {
    root: { id: "root", parentId: null, children: ["folder1"], nodeType: "text" },
    folder1: { id: "folder1", parentId: "root", children: ["child1"], nodeType: "folder" },
    child1: { id: "child1", parentId: "folder1", children: [], nodeType: "text" },
  };

  assert.equal(findScopeRoot(nodes, "child1", "root"), "folder1");
  assert.equal(findScopeRoot(nodes, "folder1", "root"), "folder1");
  assert.equal(findScopeRoot(nodes, "root", "root"), "root");
});

test("findScopeRoot returns rootId when no folder ancestor", () => {
  const nodes = {
    root: { id: "root", parentId: null, children: ["child1"], nodeType: "text" },
    child1: { id: "child1", parentId: "root", children: [], nodeType: "text" },
  };

  assert.equal(findScopeRoot(nodes, "child1", "root"), "root");
});

test("isInScope returns true for node within scope", () => {
  const nodes = {
    root: { id: "root", parentId: null, children: ["folder1"], nodeType: "text" },
    folder1: { id: "folder1", parentId: "root", children: ["child1"], nodeType: "folder" },
    child1: { id: "child1", parentId: "folder1", children: [], nodeType: "text" },
  };

  assert.equal(isInScope(nodes, "child1", "folder1", "root"), true);
  assert.equal(isInScope(nodes, "folder1", "folder1", "root"), true);
});

test("isInScope returns false for node outside scope", () => {
  const nodes = {
    root: { id: "root", parentId: null, children: ["folder1", "outside"], nodeType: "text" },
    folder1: { id: "folder1", parentId: "root", children: ["child1"], nodeType: "folder" },
    child1: { id: "child1", parentId: "folder1", children: [], nodeType: "text" },
    outside: { id: "outside", parentId: "root", children: [], nodeType: "text" },
  };

  assert.equal(isInScope(nodes, "outside", "folder1", "root"), false);
});

test("isInScope returns true for any node when scope is root", () => {
  const nodes = {
    root: { id: "root", parentId: null, children: ["child1"], nodeType: "text" },
    child1: { id: "child1", parentId: "root", children: [], nodeType: "text" },
  };

  assert.equal(isInScope(nodes, "child1", "root", "root"), true);
});

// ---------------------------------------------------------------------------
// Version management
// ---------------------------------------------------------------------------

test("version starts at 0 after reset", () => {
  assert.equal(getDocVersion(), 0);
});

test("incrementDocVersion increments and returns new value", () => {
  assert.equal(incrementDocVersion(), 1);
  assert.equal(incrementDocVersion(), 2);
  assert.equal(getDocVersion(), 2);
});

test("setDocVersion sets arbitrary value", () => {
  setDocVersion(42);
  assert.equal(getDocVersion(), 42);
});
