// @ts-check
"use strict";
import { test, expect } from "vitest";

const { touchPresence, removePresence, getPresenceList, resetPresence } = require("../../dist/node/presence.js");

test("touchPresence creates entry and getPresenceList returns it", () => {
  resetPresence();
  touchPresence("doc1", "e_1", "Alice", "human");
  const list = getPresenceList("doc1");
  expect(list.length).toBe(1);
  expect(list[0].entityId).toBe("e_1");
  expect(list[0].displayName).toBe("Alice");
  expect(list[0].role).toBe("human");
  expect(list[0].status).toBe("active");
});

test("touchPresence updates existing entry", () => {
  resetPresence();
  touchPresence("doc1", "e_1", "Alice", "human");
  touchPresence("doc1", "e_1", "Alice Updated", "owner");
  const list = getPresenceList("doc1");
  expect(list.length).toBe(1);
  expect(list[0].displayName).toBe("Alice Updated");
  expect(list[0].role).toBe("owner");
});

test("removePresence removes entry", () => {
  resetPresence();
  touchPresence("doc1", "e_1", "Alice", "human");
  touchPresence("doc1", "e_2", "Bob", "ai");
  expect(removePresence("doc1", "e_1")).toBe(true);
  const list = getPresenceList("doc1");
  expect(list.length).toBe(1);
  expect(list[0].entityId).toBe("e_2");
});

test("removePresence returns false for unknown entity", () => {
  resetPresence();
  expect(removePresence("doc1", "e_unknown")).toBe(false);
});

test("getPresenceList returns empty for unknown doc", () => {
  resetPresence();
  const list = getPresenceList("nonexistent");
  expect(list.length).toBe(0);
});

test("multiple docs are tracked independently", () => {
  resetPresence();
  touchPresence("doc1", "e_1", "Alice", "human");
  touchPresence("doc2", "e_2", "Bob", "ai");

  expect(getPresenceList("doc1").length).toBe(1);
  expect(getPresenceList("doc2").length).toBe(1);
  expect(getPresenceList("doc1")[0].entityId).toBe("e_1");
  expect(getPresenceList("doc2")[0].entityId).toBe("e_2");
});
