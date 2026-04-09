// @ts-check
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

const { touchPresence, removePresence, getPresenceList, resetPresence } = require("../../dist/node/presence.js");

test("touchPresence creates entry and getPresenceList returns it", () => {
  resetPresence();
  touchPresence("doc1", "e_1", "Alice", "human");
  const list = getPresenceList("doc1");
  assert.equal(list.length, 1);
  assert.equal(list[0].entityId, "e_1");
  assert.equal(list[0].displayName, "Alice");
  assert.equal(list[0].role, "human");
  assert.equal(list[0].status, "active");
});

test("touchPresence updates existing entry", () => {
  resetPresence();
  touchPresence("doc1", "e_1", "Alice", "human");
  touchPresence("doc1", "e_1", "Alice Updated", "owner");
  const list = getPresenceList("doc1");
  assert.equal(list.length, 1);
  assert.equal(list[0].displayName, "Alice Updated");
  assert.equal(list[0].role, "owner");
});

test("removePresence removes entry", () => {
  resetPresence();
  touchPresence("doc1", "e_1", "Alice", "human");
  touchPresence("doc1", "e_2", "Bob", "ai");
  assert.ok(removePresence("doc1", "e_1"));
  const list = getPresenceList("doc1");
  assert.equal(list.length, 1);
  assert.equal(list[0].entityId, "e_2");
});

test("removePresence returns false for unknown entity", () => {
  resetPresence();
  assert.equal(removePresence("doc1", "e_unknown"), false);
});

test("getPresenceList returns empty for unknown doc", () => {
  resetPresence();
  const list = getPresenceList("nonexistent");
  assert.equal(list.length, 0);
});

test("multiple docs are tracked independently", () => {
  resetPresence();
  touchPresence("doc1", "e_1", "Alice", "human");
  touchPresence("doc2", "e_2", "Bob", "ai");

  assert.equal(getPresenceList("doc1").length, 1);
  assert.equal(getPresenceList("doc2").length, 1);
  assert.equal(getPresenceList("doc1")[0].entityId, "e_1");
  assert.equal(getPresenceList("doc2")[0].entityId, "e_2");
});
