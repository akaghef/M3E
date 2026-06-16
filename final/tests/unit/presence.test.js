// @ts-check
"use strict";
import { test, expect } from "vitest";

const { touchPresence, removePresence, getPresenceList, resetPresence } = require("../../dist/node/presence.js");

test("touchPresence creates entry and getPresenceList returns it", () => {
  resetPresence();
  touchPresence("map1", "e_1", "Alice", "human");
  const list = getPresenceList("map1");
  expect(list.length).toBe(1);
  expect(list[0].entityId).toBe("e_1");
  expect(list[0].displayName).toBe("Alice");
  expect(list[0].role).toBe("human");
  expect(list[0].status).toBe("active");
});

test("touchPresence updates existing entry", () => {
  resetPresence();
  touchPresence("map1", "e_1", "Alice", "human");
  touchPresence("map1", "e_1", "Alice Updated", "owner");
  const list = getPresenceList("map1");
  expect(list.length).toBe(1);
  expect(list[0].displayName).toBe("Alice Updated");
  expect(list[0].role).toBe("owner");
});

test("removePresence removes entry", () => {
  resetPresence();
  touchPresence("map1", "e_1", "Alice", "human");
  touchPresence("map1", "e_2", "Bob", "ai");
  expect(removePresence("map1", "e_1")).toBe(true);
  const list = getPresenceList("map1");
  expect(list.length).toBe(1);
  expect(list[0].entityId).toBe("e_2");
});

test("removePresence returns false for unknown entity", () => {
  resetPresence();
  expect(removePresence("map1", "e_unknown")).toBe(false);
});

test("getPresenceList returns empty for unknown map", () => {
  resetPresence();
  const list = getPresenceList("nonexistent");
  expect(list.length).toBe(0);
});

test("multiple maps are tracked independently", () => {
  resetPresence();
  touchPresence("map1", "e_1", "Alice", "human");
  touchPresence("map2", "e_2", "Bob", "ai");

  expect(getPresenceList("map1").length).toBe(1);
  expect(getPresenceList("map2").length).toBe(1);
  expect(getPresenceList("map1")[0].entityId).toBe("e_1");
  expect(getPresenceList("map2")[0].entityId).toBe("e_2");
});
