"use strict";

import { test, expect } from "vitest";

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function makeModel() {
  const m = new RapidMvpModel("Root");
  const root = m.state.rootId;
  const target = m.addNode(root, "Target");
  const aliasId = m.addAlias(root, target, { aliasLabel: "MyAlias" });
  return { m, root, target, aliasId };
}

// --- setAliasAccess ---

test("setAliasAccess toggles read<->write", () => {
  const { m, aliasId } = makeModel();
  expect(m.state.nodes[aliasId].access).toBe("read");

  m.setAliasAccess(aliasId, "write");
  expect(m.state.nodes[aliasId].access).toBe("write");

  m.setAliasAccess(aliasId, "read");
  expect(m.state.nodes[aliasId].access).toBe("read");

  expect(m.validate()).toEqual([]);
});

test("setAliasAccess rejects non-alias node", () => {
  const { m, target } = makeModel();
  expect(() => m.setAliasAccess(target, "write")).toThrow(/not an alias/);
});

test("setAliasAccess rejects invalid access value", () => {
  const { m, aliasId } = makeModel();
  expect(() => m.setAliasAccess(aliasId, "admin")).toThrow(/invalid alias access/i);
});

// --- renameAlias ---

test("renameAlias updates aliasLabel and display text", () => {
  const { m, aliasId } = makeModel();
  m.renameAlias(aliasId, "Renamed");
  expect(m.state.nodes[aliasId].aliasLabel).toBe("Renamed");
  expect(m.state.nodes[aliasId].text).toBe("Renamed");
});

test("renameAlias with empty clears aliasLabel and falls back to target text", () => {
  const { m, aliasId } = makeModel();
  m.renameAlias(aliasId, "");
  expect(m.state.nodes[aliasId].aliasLabel).toBeUndefined();
  expect(m.state.nodes[aliasId].text).toBe("Target");
});

test("renameAlias rejects non-alias", () => {
  const { m, target } = makeModel();
  expect(() => m.renameAlias(target, "x")).toThrow(/not an alias/);
});

test("renameAlias on broken alias only updates label, not '(deleted)' text", () => {
  const { m, aliasId, target } = makeModel();
  m.deleteNode(target);
  expect(m.state.nodes[aliasId].isBroken).toBe(true);
  m.renameAlias(aliasId, "NewLabel");
  expect(m.state.nodes[aliasId].aliasLabel).toBe("NewLabel");
  // broken display preserved
  expect(m.state.nodes[aliasId].text).toMatch(/deleted/);
});

// --- resolveAliasTarget ---

test("resolveAliasTarget returns canonical node", () => {
  const { m, aliasId, target } = makeModel();
  const resolved = m.resolveAliasTarget(aliasId);
  expect(resolved).not.toBeNull();
  expect(resolved.id).toBe(target);
});

test("resolveAliasTarget returns null for broken alias", () => {
  const { m, aliasId, target } = makeModel();
  m.deleteNode(target);
  expect(m.resolveAliasTarget(aliasId)).toBeNull();
});

test("resolveAliasTarget rejects non-alias", () => {
  const { m, target } = makeModel();
  expect(() => m.resolveAliasTarget(target)).toThrow(/not an alias/);
});

// --- editViaAlias ---

test("editViaAlias with write access edits target", () => {
  const { m, aliasId, target } = makeModel();
  m.setAliasAccess(aliasId, "write");
  m.editViaAlias(aliasId, "Edited via alias");
  expect(m.state.nodes[target].text).toBe("Edited via alias");
});

test("editViaAlias blocked on read-only alias", () => {
  const { m, aliasId, target } = makeModel();
  expect(() => m.editViaAlias(aliasId, "nope")).toThrow(/read-only/);
  expect(m.state.nodes[target].text).toBe("Target");
});

test("editViaAlias blocked on broken alias", () => {
  const { m, aliasId, target } = makeModel();
  m.setAliasAccess(aliasId, "write");
  m.deleteNode(target);
  expect(() => m.editViaAlias(aliasId, "nope")).toThrow(/broken/);
});

test("editViaAlias rejects non-alias", () => {
  const { m, target } = makeModel();
  expect(() => m.editViaAlias(target, "x")).toThrow(/not an alias/);
});

// --- combined validation ---

test("alias commands leave model valid after sequence", () => {
  const { m, aliasId, target } = makeModel();
  m.setAliasAccess(aliasId, "write");
  m.renameAlias(aliasId, "Write Ref");
  m.editViaAlias(aliasId, "New Target Text");
  expect(m.state.nodes[target].text).toBe("New Target Text");
  expect(m.validate()).toEqual([]);
});
