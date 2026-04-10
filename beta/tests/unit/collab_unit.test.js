"use strict";

import { test, expect, beforeEach } from "vitest";

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

beforeEach(() => {
  resetCollab();
});

test("registerEntity returns entity with expected fields", () => {
  const e = registerEntity("Alice", "human", ["read", "write"]);
  expect(e.entityId.startsWith("e_")).toBe(true);
  expect(e.token.startsWith("tok_")).toBe(true);
  expect(e.displayName).toBe("Alice");
  expect(e.role).toBe("human");
  expect(e.priority).toBe(100);
  expect(e.capabilities).toEqual(["read", "write"]);
  expect(e.lastHeartbeat > 0).toBe(true);
});

test("registerEntity assigns correct priority for each role", () => {
  const owner = registerEntity("O", "owner", ["read", "write"]);
  const human = registerEntity("H", "human", ["read", "write"]);
  const aiSup = registerEntity("AS", "ai-supervised", ["read", "write"]);
  const ai = registerEntity("A", "ai", ["read", "write"]);
  const aiRo = registerEntity("AR", "ai-readonly", ["read"]);

  expect(owner.priority).toBe(1000);
  expect(human.priority).toBe(100);
  expect(aiSup.priority).toBe(50);
  expect(ai.priority).toBe(10);
  expect(aiRo.priority).toBe(1);
});

test("unregisterEntity removes entity and returns true", () => {
  const e = registerEntity("Bob", "ai", ["read"]);
  expect(unregisterEntity(e.entityId)).toBe(true);
  expect(getActiveEntities().length).toBe(0);
});

test("unregisterEntity returns false for unknown entityId", () => {
  expect(unregisterEntity("nonexistent")).toBe(false);
});

test("unregisterEntity releases locks held by entity", () => {
  const e = registerEntity("Locker", "human", ["read", "write"]);
  acquireScopeLock("scope_1", e);
  expect(getScopeLocks().length).toBe(1);

  unregisterEntity(e.entityId);
  expect(getScopeLocks().length).toBe(0);
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

test("authenticateRequest returns entity for valid token", () => {
  const e = registerEntity("Auth", "human", ["read", "write"]);
  const result = authenticateRequest(makeRequest(e.token));
  expect(result).toBeTruthy();
  expect(result.entityId).toBe(e.entityId);
});

test("authenticateRequest returns null for missing Authorization header", () => {
  const result = authenticateRequest({ headers: {} });
  expect(result).toBe(null);
});

test("authenticateRequest returns null for non-Bearer auth", () => {
  const result = authenticateRequest({ headers: { authorization: "Basic abc" } });
  expect(result).toBe(null);
});

test("authenticateRequest returns null for unknown token", () => {
  const result = authenticateRequest(makeRequest("tok_unknown_value"));
  expect(result).toBe(null);
});

test("authenticateRequest returns null for timed-out entity", () => {
  const e = registerEntity("Timeout", "ai", ["read"]);
  // Simulate timeout by backdating lastHeartbeat
  e.lastHeartbeat = Date.now() - 60_000;
  const result = authenticateRequest(makeRequest(e.token));
  expect(result).toBe(null);
});

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

test("heartbeat updates lastHeartbeat timestamp", () => {
  const e = registerEntity("HB", "ai", ["read"]);
  const before = e.lastHeartbeat;
  // Small delay to ensure time advances
  const updated = heartbeat(e.entityId, []);
  expect(updated).toBe(true);
  expect(e.lastHeartbeat >= before).toBe(true);
});

test("heartbeat returns false for unknown entity", () => {
  expect(heartbeat("unknown_id", [])).toBe(false);
});

test("heartbeat extends lock expiry", () => {
  const e = registerEntity("LockHB", "human", ["read", "write"]);
  const lockResult = acquireScopeLock("scope_hb", e);
  expect(lockResult.ok).toBe(true);
  const originalExpiry = lockResult.lock.expiresAt;

  // Simulate time passing
  lockResult.lock.expiresAt = Date.now() + 5000; // 5 seconds left
  heartbeat(e.entityId, [lockResult.lock.lockId]);

  // Lock should be extended
  expect(lockResult.lock.expiresAt > Date.now() + 5000).toBe(true);
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
  expect(active.length).toBe(2);
  const ids = active.map((a) => a.entityId);
  expect(ids.includes(e1.entityId)).toBe(true);
  expect(ids.includes(e2.entityId)).toBe(true);
  expect(ids.includes(e3.entityId)).toBe(false);
});

// ---------------------------------------------------------------------------
// Scope locking
// ---------------------------------------------------------------------------

test("acquireScopeLock succeeds for unlocked scope", () => {
  const e = registerEntity("Locker", "human", ["read", "write"]);
  const result = acquireScopeLock("scope_a", e);
  expect(result.ok).toBe(true);
  expect(result.lock.lockId.startsWith("lock_")).toBe(true);
  expect(result.lock.scopeId).toBe("scope_a");
  expect(result.lock.entityId).toBe(e.entityId);
  expect(result.lock.expiresAt > Date.now()).toBe(true);
});

test("acquireScopeLock refreshes own lock", () => {
  const e = registerEntity("SelfRefresh", "human", ["read", "write"]);
  const first = acquireScopeLock("scope_self", e);
  expect(first.ok).toBe(true);

  const second = acquireScopeLock("scope_self", e);
  expect(second.ok).toBe(true);
  expect(second.lock.lockId).toBe(first.lock.lockId);
  expect(second.lock.expiresAt >= first.lock.expiresAt).toBe(true);
});

test("acquireScopeLock fails for lower priority", () => {
  const human = registerEntity("Human", "human", ["read", "write"]);
  const ai = registerEntity("AI", "ai", ["read", "write"]);

  acquireScopeLock("scope_pri", human);
  const result = acquireScopeLock("scope_pri", ai);
  expect(result.ok).toBe(false);
  expect(result.status).toBe(409);
});

test("acquireScopeLock preempts for higher priority", () => {
  const ai = registerEntity("AI", "ai", ["read", "write"]);
  const human = registerEntity("Human", "human", ["read", "write"]);

  acquireScopeLock("scope_preempt", ai);
  const result = acquireScopeLock("scope_preempt", human);
  expect(result.ok).toBe(true);
  expect(result.lock.entityId).toBe(human.entityId);
});

test("releaseScopeLock removes lock", () => {
  const e = registerEntity("Releaser", "human", ["read", "write"]);
  acquireScopeLock("scope_rel", e);
  expect(getScopeLocks().length).toBe(1);

  const released = releaseScopeLock("scope_rel", e);
  expect(released).toBe(true);
  expect(getScopeLocks().length).toBe(0);
});

test("releaseScopeLock returns false if entity does not hold the lock", () => {
  const e1 = registerEntity("Holder", "human", ["read", "write"]);
  const e2 = registerEntity("Other", "human", ["read", "write"]);
  acquireScopeLock("scope_other", e1);

  expect(releaseScopeLock("scope_other", e2)).toBe(false);
});

test("expired locks are cleaned up on getScopeLocks", () => {
  const e = registerEntity("Expiry", "human", ["read", "write"]);
  const result = acquireScopeLock("scope_exp", e);
  expect(result.ok).toBe(true);

  // Expire the lock manually
  result.lock.expiresAt = Date.now() - 1000;

  const locks = getScopeLocks();
  expect(locks.length).toBe(0);
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

  expect(findScopeRoot(nodes, "child1", "root")).toBe("folder1");
  expect(findScopeRoot(nodes, "folder1", "root")).toBe("folder1");
  expect(findScopeRoot(nodes, "root", "root")).toBe("root");
});

test("findScopeRoot returns rootId when no folder ancestor", () => {
  const nodes = {
    root: { id: "root", parentId: null, children: ["child1"], nodeType: "text" },
    child1: { id: "child1", parentId: "root", children: [], nodeType: "text" },
  };

  expect(findScopeRoot(nodes, "child1", "root")).toBe("root");
});

test("isInScope returns true for node within scope", () => {
  const nodes = {
    root: { id: "root", parentId: null, children: ["folder1"], nodeType: "text" },
    folder1: { id: "folder1", parentId: "root", children: ["child1"], nodeType: "folder" },
    child1: { id: "child1", parentId: "folder1", children: [], nodeType: "text" },
  };

  expect(isInScope(nodes, "child1", "folder1", "root")).toBe(true);
  expect(isInScope(nodes, "folder1", "folder1", "root")).toBe(true);
});

test("isInScope returns false for node outside scope", () => {
  const nodes = {
    root: { id: "root", parentId: null, children: ["folder1", "outside"], nodeType: "text" },
    folder1: { id: "folder1", parentId: "root", children: ["child1"], nodeType: "folder" },
    child1: { id: "child1", parentId: "folder1", children: [], nodeType: "text" },
    outside: { id: "outside", parentId: "root", children: [], nodeType: "text" },
  };

  expect(isInScope(nodes, "outside", "folder1", "root")).toBe(false);
});

test("isInScope returns true for any node when scope is root", () => {
  const nodes = {
    root: { id: "root", parentId: null, children: ["child1"], nodeType: "text" },
    child1: { id: "child1", parentId: "root", children: [], nodeType: "text" },
  };

  expect(isInScope(nodes, "child1", "root", "root")).toBe(true);
});

// ---------------------------------------------------------------------------
// Version management
// ---------------------------------------------------------------------------

test("version starts at 0 after reset", () => {
  expect(getDocVersion()).toBe(0);
});

test("incrementDocVersion increments and returns new value", () => {
  expect(incrementDocVersion()).toBe(1);
  expect(incrementDocVersion()).toBe(2);
  expect(getDocVersion()).toBe(2);
});

test("setDocVersion sets arbitrary value", () => {
  setDocVersion(42);
  expect(getDocVersion()).toBe(42);
});
