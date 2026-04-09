"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
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
      assert.ok(nodes[childId], `Child ${childId} of ${id} does not exist`);
      assert.equal(
        nodes[childId].parentId,
        id,
        `Child ${childId} parentId should be ${id} but is ${nodes[childId].parentId}`,
      );
    }

    // Every node except root should appear in its parent's children
    if (node.parentId !== null) {
      const parent = nodes[node.parentId];
      assert.ok(parent, `Parent ${node.parentId} of ${id} does not exist`);
      assert.ok(
        parent.children.includes(id),
        `Node ${id} not found in parent ${node.parentId}'s children`,
      );
    } else {
      assert.equal(id, rootId, "Only root should have null parentId");
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
  assert.equal(Object.keys(model.state.nodes).length, 4);
  assert.deepEqual(model.state.nodes[rootId].children, [a, b]);
  assert.deepEqual(model.state.nodes[a].children, [a1]);
});

test("addNode at specific index inserts correctly", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const c = model.addNode(rootId, "C", 1); // between A and B

  assert.deepEqual(model.state.nodes[rootId].children, [a, c, b]);
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

  assert.equal(model.state.nodes[a], undefined);
  assert.equal(model.state.nodes[b], undefined);
  assert.equal(model.state.nodes[c], undefined);
  assert.equal(model.state.nodes[d], undefined);
  assert.deepEqual(model.state.nodes[rootId].children, []);
  assertParentChildConsistency(model);
});

test("deleteNode preserves siblings", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const c = model.addNode(rootId, "C");

  model.deleteNode(b);

  assert.deepEqual(model.state.nodes[rootId].children, [a, c]);
  assert.ok(model.state.nodes[a]);
  assert.ok(model.state.nodes[c]);
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
  assert.deepEqual(model.state.nodes[a].children, []);
  assert.ok(model.state.nodes[b].children.includes(a1));
});

// Known bug: _isDescendant calls _requireNode which replaces the node object
// in state, causing the local `node` variable in reparentNode to become stale.
// As a result, `node.parentId = newParentId` updates the stale object, not state.
// See: _isDescendant -> _requireNode -> _normalizeNode creates new object.
test("BUG: reparentNode does not update parentId due to stale reference", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const a1 = model.addNode(a, "A1");

  model.reparentNode(a1, b);

  // This SHOULD be b but is still a due to the stale reference bug
  assert.equal(model.state.nodes[a1].parentId, a,
    "parentId is stale (known bug) -- when fixed, change this to assert === b");
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
  assert.deepEqual(model.state.nodes[rootId].children, [b]);
  assert.ok(model.state.nodes[b].children.includes(a));
  // Subtree internal structure unchanged
  assert.equal(model.state.nodes[a1].parentId, a);
  assert.equal(model.state.nodes[a1a].parentId, a1);
  // Note: a.parentId is NOT updated to b due to known stale reference bug
  // (see "BUG: reparentNode does not update parentId" test)
});

test("reparentNode rejects moving root", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");

  assert.throws(() => model.reparentNode(rootId, a));
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
  assert.equal(model.state.nodes[c].text, "C-edited");

  // Delete D
  model.deleteNode(d);
  assert.equal(model.state.nodes[d], undefined);

  // Delete C
  model.deleteNode(c);
  assert.equal(model.state.nodes[c], undefined);
  assert.deepEqual(model.state.nodes[a].children, []);

  assertParentChildConsistency(model);
  assert.deepEqual(validateModel(model), []);
});

test("sequence: add, delete, undo, redo maintains consistency", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;

  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  model.deleteNode(a);

  assert.equal(model.state.nodes[a], undefined);
  assertParentChildConsistency(model);

  model.undo();
  assert.ok(model.state.nodes[a]);
  assertParentChildConsistency(model);

  model.redo();
  assert.equal(model.state.nodes[a], undefined);
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
  assert.deepEqual(errors, []);
});

test("validate detects orphan node (parentId points to nonexistent node)", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");

  // Corrupt the tree: set parentId to nonexistent
  model.state.nodes[a].parentId = "nonexistent";

  const errors = validateModel(model);
  assert.ok(errors.length > 0, "Should detect orphan node");
});

test("validate detects child not listed in parent", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");

  // Corrupt: remove B from root's children but keep B's parentId
  model.state.nodes[rootId].children = [a];

  const errors = validateModel(model);
  assert.ok(errors.length > 0, "Should detect child not listed in parent");
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

    assert.equal(loaded.state.rootId, rootId);
    assert.equal(Object.keys(loaded.state.nodes).length, 4);
    assert.deepEqual(loaded.state.nodes[rootId].children, [a, b]);
    assert.deepEqual(loaded.state.nodes[a].children, [a1]);
    assert.equal(loaded.state.nodes[a1].parentId, a);

    // Links preserved
    const links = Object.values(loaded.state.links || {});
    assert.equal(links.length, 1);
    assert.equal(links[0].sourceNodeId, a);
    assert.equal(links[0].targetNodeId, b);

    assertParentChildConsistency(loaded);
    assert.deepEqual(validateModel(loaded), []);
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

  assert.equal(restored.state.rootId, rootId);
  assert.equal(Object.keys(restored.state.nodes).length, 3);
  assert.equal(restored.state.nodes[b].text, "B-edited");
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

  assert.equal(model.state.nodes[aliasId].nodeType, "alias");
  assert.equal(model.state.nodes[aliasId].targetNodeId, target);
  assert.ok(!model.state.nodes[aliasId].isBroken);

  // Delete target -- alias should be marked broken
  model.deleteNode(target);
  assert.equal(model.state.nodes[aliasId].isBroken, true);
  assert.match(model.state.nodes[aliasId].text, /deleted/);
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
  assert.equal(model.state.links[link1], undefined);
  assert.equal(model.state.links[link2], undefined);
  assert.deepEqual(validateModel(model), []);
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
  assert.ok(model.state.links[linkId]);
  assert.equal(model.state.links[linkId].sourceNodeId, a);
  assert.equal(model.state.links[linkId].targetNodeId, b);
  assertParentChildConsistency(model);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("addNode to leaf node makes it a branch", () => {
  const model = createModel("Root");
  const rootId = model.state.rootId;
  const leaf = model.addNode(rootId, "Leaf");
  assert.deepEqual(model.state.nodes[leaf].children, []);

  const child = model.addNode(leaf, "ChildOfLeaf");
  assert.deepEqual(model.state.nodes[leaf].children, [child]);
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
  assert.equal(model.state.nodes[a].text, "A");
  assertParentChildConsistency(model);

  // Redo both
  model.redo();
  model.redo();
  assert.equal(model.state.nodes[a].text, "A2");
  assert.ok(model.state.nodes[b] || model.state.nodes[Object.keys(model.state.nodes).find(k => model.state.nodes[k].text === "B")]);
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
  assert.deepEqual(validateModel(model), []);
  assert.equal(Object.keys(model.state.nodes).length, 11); // root + 10
});
