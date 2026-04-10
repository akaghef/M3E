"use strict";

import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createModel(rootText) {
  return new RapidMvpModel(rootText || "Root");
}

function validateModel(model) {
  const errors = model.validate();
  return errors;
}

function assertParentChildConsistency(model) {
  const { nodes, rootId } = model.state;
  for (const [id, node] of Object.entries(nodes)) {
    // Every child listed in children array must exist and point back
    for (const childId of node.children) {
      expect(nodes[childId]).toBeTruthy();
      expect(nodes[childId].parentId).toBe(id);
    }

    // Every node except root should appear in its parent's children
    if (node.parentId !== null) {
      const parent = nodes[node.parentId];
      expect(parent).toBeTruthy();
      expect(parent.children.includes(id)).toBe(true);
    } else {
      expect(id).toBe(rootId);
    }
  }
}

// ---------------------------------------------------------------------------
// CRUD integrity
// ---------------------------------------------------------------------------

test("addNode maintains parent-child consistency", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const a1 = model.addNode(a, "A1");

  assertParentChildConsistency(model);
  expect(Object.keys(model.state.nodes).length).toBe(4);
  expect(model.state.nodes[rootId].children).toEqual([a, b]);
  expect(model.state.nodes[a].children).toEqual([a1]);
});

test("addNode at specific index inserts correctly", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const c = model.addNode(rootId, "C", 1); // between A and B

  expect(model.state.nodes[rootId].children).toEqual([a, c, b]);
  assertParentChildConsistency(model);
});

test("deleteNode with deep subtree maintains consistency", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(a, "B");
  const c = model.addNode(b, "C");
  const d = model.addNode(c, "D");

  model.deleteNode(a);

  expect(model.state.nodes[a]).toBeUndefined();
  expect(model.state.nodes[b]).toBeUndefined();
  expect(model.state.nodes[c]).toBeUndefined();
  expect(model.state.nodes[d]).toBeUndefined();
  expect(model.state.nodes[rootId].children).toEqual([]);
  assertParentChildConsistency(model);
});

test("deleteNode preserves siblings", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const c = model.addNode(rootId, "C");

  model.deleteNode(b);

  expect(model.state.nodes[rootId].children).toEqual([a, c]);
  expect(model.state.nodes[a]).toBeTruthy();
  expect(model.state.nodes[c]).toBeTruthy();
  assertParentChildConsistency(model);
});

test("reparentNode updates children arrays correctly", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const a1 = model.addNode(a, "A1");

  model.reparentNode(a1, b);

  // Children arrays are updated correctly
  expect(model.state.nodes[a].children).toEqual([]);
  expect(model.state.nodes[b].children.includes(a1)).toBe(true);
});

// Fixed: _isDescendant used to call _requireNode which replaced the node object
// in state, causing the local `node` variable in reparentNode to become stale.
// Fix: reparentNode now re-fetches references after _isDescendant / _pushHistory.
test("reparentNode correctly updates parentId (stale reference bug fixed)", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const a1 = model.addNode(a, "A1");

  model.reparentNode(a1, b);

  expect(model.state.nodes[a1].parentId).toBe(b);
});

test("reparentNode with subtree moves children array correctly", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const a1 = model.addNode(a, "A1");
  const a1a = model.addNode(a1, "A1a");
  const b = model.addNode(rootId, "B");

  model.reparentNode(a, b);

  // Children arrays are correct
  expect(model.state.nodes[rootId].children).toEqual([b]);
  expect(model.state.nodes[b].children.includes(a)).toBe(true);
  // Subtree internal structure unchanged
  expect(model.state.nodes[a1].parentId).toBe(a);
  expect(model.state.nodes[a1a].parentId).toBe(a1);
});

test("reparentNode rejects moving root", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");

  expect(() => model.reparentNode(rootId, a)).toThrow();
});

// ---------------------------------------------------------------------------
// Multi-operation sequences
// ---------------------------------------------------------------------------

test("sequence: add, edit, delete keeps consistency", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;

  // Add several nodes
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const c = model.addNode(a, "C");
  const d = model.addNode(b, "D");

  // Edit
  model.editNode(c, "C-edited");
  expect(model.state.nodes[c].text).toBe("C-edited");

  // Delete D
  model.deleteNode(d);
  expect(model.state.nodes[d]).toBeUndefined();

  // Delete C
  model.deleteNode(c);
  expect(model.state.nodes[c]).toBeUndefined();
  expect(model.state.nodes[a].children).toEqual([]);

  assertParentChildConsistency(model);
  expect(validateModel(model)).toEqual([]);
});

test("sequence: add, delete, undo, redo maintains consistency", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;

  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  model.deleteNode(a);

  expect(model.state.nodes[a]).toBeUndefined();
  assertParentChildConsistency(model);

  model.undo();
  expect(model.state.nodes[a]).toBeTruthy();
  assertParentChildConsistency(model);

  model.redo();
  expect(model.state.nodes[a]).toBeUndefined();
  assertParentChildConsistency(model);
});

// ---------------------------------------------------------------------------
// Validate edge cases
// ---------------------------------------------------------------------------

test("validate passes for valid tree", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  model.addNode(rootId, "A");
  model.addNode(rootId, "B");
  const errors = validateModel(model);
  expect(errors).toEqual([]);
});

test("validate detects orphan node (parentId points to nonexistent node)", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");

  // Corrupt the tree: set parentId to nonexistent
  model.state.nodes[a].parentId = "nonexistent";

  const errors = validateModel(model);
  expect(errors.length > 0).toBe(true);
});

test("validate detects child not listed in parent", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");

  // Corrupt: remove B from root's children but keep B's parentId
  model.state.nodes[rootId].children = [a];

  const errors = validateModel(model);
  expect(errors.length > 0).toBe(true);
});

// ---------------------------------------------------------------------------
// Save/load round-trip integrity
// ---------------------------------------------------------------------------

test("SQLite save and load preserves full tree structure", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const a1 = model.addNode(a, "A1");
  model.addLink(a, b, { relationType: "reference", label: "see" });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-integrity-"));
  const sqlitePath = path.join(tmpDir, "test.sqlite");
  const docId = "integrity-test";

  try {
    model.saveToSqlite(sqlitePath, docId);
    const loaded = RapidMvpModel.loadFromSqlite(sqlitePath, docId);

    expect(loaded.state.rootId).toBe(rootId);
    expect(Object.keys(loaded.state.nodes).length).toBe(4);
    expect(loaded.state.nodes[rootId].children).toEqual([a, b]);
    expect(loaded.state.nodes[a].children).toEqual([a1]);
    expect(loaded.state.nodes[a1].parentId).toBe(a);

    // Links preserved
    const links = Object.values(loaded.state.links || {});
    expect(links.length).toBe(1);
    expect(links[0].sourceNodeId).toBe(a);
    expect(links[0].targetNodeId).toBe(b);

    assertParentChildConsistency(loaded);
    expect(validateModel(loaded)).toEqual([]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("JSON save and load preserves full tree structure", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(a, "B");
  model.editNode(b, "B-edited");

  const json = model.toJSON();
  const restored = RapidMvpModel.fromJSON(json);

  expect(restored.state.rootId).toBe(rootId);
  expect(Object.keys(restored.state.nodes).length).toBe(3);
  expect(restored.state.nodes[b].text).toBe("B-edited");
  assertParentChildConsistency(restored);
});

// ---------------------------------------------------------------------------
// Alias integrity
// ---------------------------------------------------------------------------

test("alias points to valid target after multi-operation", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const target = model.addNode(rootId, "Target");
  const aliasId = model.addAlias(rootId, target);

  expect(model.state.nodes[aliasId].nodeType).toBe("alias");
  expect(model.state.nodes[aliasId].targetNodeId).toBe(target);
  expect(model.state.nodes[aliasId].isBroken).toBeFalsy();

  // Delete target -- alias should be marked broken
  model.deleteNode(target);
  expect(model.state.nodes[aliasId].isBroken).toBe(true);
  expect(model.state.nodes[aliasId].text).toMatch(/deleted/);
  assertParentChildConsistency(model);
});

// ---------------------------------------------------------------------------
// Graph link integrity
// ---------------------------------------------------------------------------

test("links are cleaned up when either endpoint is deleted", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const c = model.addNode(rootId, "C");

  const link1 = model.addLink(a, b);
  const link2 = model.addLink(b, c);

  // Delete B -- both links should be removed
  model.deleteNode(b);
  expect(model.state.links[link1]).toBeUndefined();
  expect(model.state.links[link2]).toBeUndefined();
  expect(validateModel(model)).toEqual([]);
});

test("links survive when nodes are edited but not deleted", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const linkId = model.addLink(a, b);

  // Edit both endpoints
  model.editNode(a, "A-edited");
  model.editNode(b, "B-edited");

  // Link should still exist
  expect(model.state.links[linkId]).toBeTruthy();
  expect(model.state.links[linkId].sourceNodeId).toBe(a);
  expect(model.state.links[linkId].targetNodeId).toBe(b);
  assertParentChildConsistency(model);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("addNode to leaf node makes it a branch", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const leaf = model.addNode(rootId, "Leaf");
  expect(model.state.nodes[leaf].children).toEqual([]);

  const child = model.addNode(leaf, "ChildOfLeaf");
  expect(model.state.nodes[leaf].children).toEqual([child]);
  assertParentChildConsistency(model);
});

test("multiple undo/redo cycles preserve integrity", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;

  const a = model.addNode(rootId, "A");
  model.editNode(a, "A2");
  const b = model.addNode(rootId, "B");

  // Undo B addition
  model.undo();
  assertParentChildConsistency(model);

  // Undo edit
  model.undo();
  expect(model.state.nodes[a].text).toBe("A");
  assertParentChildConsistency(model);

  // Redo both
  model.redo();
  model.redo();
  expect(model.state.nodes[a].text).toBe("A2");
  expect(model.state.nodes[b] || model.state.nodes[Object.keys(model.state.nodes).find(k => model.state.nodes[k].text === "B")]).toBeTruthy();
  assertParentChildConsistency(model);
});

test("deeply nested tree (10 levels) validates correctly", () => {
  const model = createModel("Root");
  let parentId = model.state.rootId;
  const ids = [];
  for (let i = 0; i < 10; i++) {
    const id = model.addNode(parentId, `Level ${i}`);
    ids.push(id);
    parentId = id;
  }

  assertParentChildConsistency(model);
  expect(validateModel(model)).toEqual([]);
  expect(Object.keys(model.state.nodes).length).toBe(11); // root + 10
});
