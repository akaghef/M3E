// @ts-check
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

const { recordAudit, getRecentAuditEntries, getAuditEntriesForNode, resetAuditLog, setBufferSize } = require("../../dist/node/audit_log.js");

test("recordAudit adds entry with timestamp", () => {
  resetAuditLog();
  const entry = recordAudit({
    userId: "e_test1",
    operationType: "add",
    targetNodeId: "n_123",
    details: { text: "hello" },
  });
  assert.ok(entry.timestamp);
  assert.equal(entry.userId, "e_test1");
  assert.equal(entry.operationType, "add");
  assert.equal(entry.targetNodeId, "n_123");
});

test("getRecentAuditEntries returns entries in order", () => {
  resetAuditLog();
  recordAudit({ userId: "u1", operationType: "add", targetNodeId: "n_1", details: {} });
  recordAudit({ userId: "u2", operationType: "edit", targetNodeId: "n_2", details: {} });
  recordAudit({ userId: "u1", operationType: "delete", targetNodeId: "n_3", details: {} });

  const entries = getRecentAuditEntries(10);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].operationType, "add");
  assert.equal(entries[2].operationType, "delete");
});

test("ring buffer enforces max size", () => {
  resetAuditLog();
  setBufferSize(3);
  for (let i = 0; i < 5; i++) {
    recordAudit({ userId: "u1", operationType: "add", targetNodeId: `n_${i}`, details: {} });
  }
  const entries = getRecentAuditEntries(10);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].targetNodeId, "n_2");
  assert.equal(entries[2].targetNodeId, "n_4");
  setBufferSize(500); // restore default
});

test("getAuditEntriesForNode filters by nodeId", () => {
  resetAuditLog();
  recordAudit({ userId: "u1", operationType: "add", targetNodeId: "n_a", details: {} });
  recordAudit({ userId: "u2", operationType: "edit", targetNodeId: "n_b", details: {} });
  recordAudit({ userId: "u1", operationType: "edit", targetNodeId: "n_a", details: {} });

  const entries = getAuditEntriesForNode("n_a");
  assert.equal(entries.length, 2);
  entries.forEach((e) => assert.equal(e.targetNodeId, "n_a"));
});

test("limit parameter caps returned entries", () => {
  resetAuditLog();
  for (let i = 0; i < 10; i++) {
    recordAudit({ userId: "u1", operationType: "add", targetNodeId: `n_${i}`, details: {} });
  }
  const entries = getRecentAuditEntries(3);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].targetNodeId, "n_7");
});
