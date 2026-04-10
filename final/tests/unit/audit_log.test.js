// @ts-check
"use strict";
import { test, expect } from "vitest";

const { recordAudit, getRecentAuditEntries, getAuditEntriesForNode, resetAuditLog, setBufferSize } = require("../../dist/node/audit_log.js");

test("recordAudit adds entry with timestamp", () => {
  resetAuditLog();
  const entry = recordAudit({
    userId: "e_test1",
    operationType: "add",
    targetNodeId: "n_123",
    details: { text: "hello" },
  });
  expect(entry.timestamp).toBeTruthy();
  expect(entry.userId).toBe("e_test1");
  expect(entry.operationType).toBe("add");
  expect(entry.targetNodeId).toBe("n_123");
});

test("getRecentAuditEntries returns entries in order", () => {
  resetAuditLog();
  recordAudit({ userId: "u1", operationType: "add", targetNodeId: "n_1", details: {} });
  recordAudit({ userId: "u2", operationType: "edit", targetNodeId: "n_2", details: {} });
  recordAudit({ userId: "u1", operationType: "delete", targetNodeId: "n_3", details: {} });

  const entries = getRecentAuditEntries(10);
  expect(entries.length).toBe(3);
  expect(entries[0].operationType).toBe("add");
  expect(entries[2].operationType).toBe("delete");
});

test("ring buffer enforces max size", () => {
  resetAuditLog();
  setBufferSize(3);
  for (let i = 0; i < 5; i++) {
    recordAudit({ userId: "u1", operationType: "add", targetNodeId: `n_${i}`, details: {} });
  }
  const entries = getRecentAuditEntries(10);
  expect(entries.length).toBe(3);
  expect(entries[0].targetNodeId).toBe("n_2");
  expect(entries[2].targetNodeId).toBe("n_4");
  setBufferSize(500); // restore default
});

test("getAuditEntriesForNode filters by nodeId", () => {
  resetAuditLog();
  recordAudit({ userId: "u1", operationType: "add", targetNodeId: "n_a", details: {} });
  recordAudit({ userId: "u2", operationType: "edit", targetNodeId: "n_b", details: {} });
  recordAudit({ userId: "u1", operationType: "edit", targetNodeId: "n_a", details: {} });

  const entries = getAuditEntriesForNode("n_a");
  expect(entries.length).toBe(2);
  entries.forEach((e) => expect(e.targetNodeId).toBe("n_a"));
});

test("limit parameter caps returned entries", () => {
  resetAuditLog();
  for (let i = 0; i < 10; i++) {
    recordAudit({ userId: "u1", operationType: "add", targetNodeId: `n_${i}`, details: {} });
  }
  const entries = getRecentAuditEntries(3);
  expect(entries.length).toBe(3);
  expect(entries[0].targetNodeId).toBe("n_7");
});
