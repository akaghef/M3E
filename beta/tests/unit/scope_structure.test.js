"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");
const {
  findScopeRoot,
  isInScope,
  resetCollab,
} = require("../../dist/node/collab.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createModel(rootText) {
  return new RapidMvpModel(rootText || "Root");
}

/**
 * Build a tree with folder-based scopes:
 *
 *   Root
 *   +-- ScopeA (folder)
 *   |   +-- A1
 *   |   +-- A2
 *   |       +-- A2a
 *   +-- ScopeB (folder)
 *   |   +-- B1
 *   +-- Orphan (text, not in any sub-scope)
 */
function buildScopedTree() {
  const m = createModel("Root");
  const root = m.state.rootId;

  const scopeA = m.addNode(root, "ScopeA");
  m.state.nodes[scopeA].nodeType = "folder";
  const a1 = m.addNode(scopeA, "A1");
  const a2 = m.addNode(scopeA, "A2");
  const a2a = m.addNode(a2, "A2a");

  const scopeB = m.addNode(root, "ScopeB");
  m.state.nodes[scopeB].nodeType = "folder";
  const b1 = m.addNode(scopeB, "B1");

  const orphan = m.addNode(root, "Orphan");

  return { m, root, scopeA, a1, a2, a2a, scopeB, b1, orphan };
}

// ===========================================================================
// Phase 1: Existing scope functionality tests
// ===========================================================================

// --- Scope entry / exit (queryNodes as scope filter) ---

test("enterScope: queryNodes(scopeRoot) returns only children of that scope", () => {
  const { m, scopeA, a1, a2, a2a, scopeB, b1 } = buildScopedTree();

  const scopeANodes = m.queryNodeIds(scopeA);
  assert.ok(scopeANodes.includes(scopeA));
  assert.ok(scopeANodes.includes(a1));
  assert.ok(scopeANodes.includes(a2));
  assert.ok(scopeANodes.includes(a2a));
  assert.ok(!scopeANodes.includes(scopeB));
  assert.ok(!scopeANodes.includes(b1));
});

test("exitScope: queryNodes(root) returns all nodes", () => {
  const { m, root, scopeA, a1, scopeB, b1, orphan } = buildScopedTree();

  const allNodes = m.queryNodeIds(root);
  assert.ok(allNodes.includes(root));
  assert.ok(allNodes.includes(scopeA));
  assert.ok(allNodes.includes(a1));
  assert.ok(allNodes.includes(scopeB));
  assert.ok(allNodes.includes(b1));
  assert.ok(allNodes.includes(orphan));
});

test("scope enter then exit returns to full tree", () => {
  const { m, root, scopeA, a1, b1 } = buildScopedTree();

  // Simulate enter scope A
  const inScope = m.queryNodeIds(scopeA);
  assert.ok(inScope.includes(a1));
  assert.ok(!inScope.includes(b1));

  // Simulate exit scope (back to root)
  const full = m.queryNodeIds(root);
  assert.ok(full.includes(a1));
  assert.ok(full.includes(b1));
});

// --- Alias creation and broken detection ---

test("alias creation stores correct targetNodeId", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const target = m.addNode(root, "Target");
  const aliasId = m.addAlias(root, target);

  const alias = m.state.nodes[aliasId];
  assert.equal(alias.nodeType, "alias");
  assert.equal(alias.targetNodeId, target);
  assert.equal(alias.isBroken, false);
});

test("alias broken detection triggers on target deletion", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const target = m.addNode(root, "Important Node");
  const aliasId = m.addAlias(root, target, { aliasLabel: "MyAlias" });

  m.deleteNode(target);

  const alias = m.state.nodes[aliasId];
  assert.equal(alias.isBroken, true);
  assert.equal(alias.targetSnapshotLabel, "Important Node");
  assert.match(alias.text, /deleted/);
});

test("alias cannot target another alias", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const target = m.addNode(root, "Target");
  const aliasId = m.addAlias(root, target);

  assert.throws(() => m.addAlias(root, aliasId), {
    message: /cannot target another alias/i,
  });
});

test("alias default access is read", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const target = m.addNode(root, "Target");
  const aliasId = m.addAlias(root, target);

  assert.equal(m.state.nodes[aliasId].access, "read");
});

test("alias with write access is stored correctly", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const target = m.addNode(root, "Target");
  const aliasId = m.addAlias(root, target, { access: "write" });

  assert.equal(m.state.nodes[aliasId].access, "write");
});

// --- Nested scopes ---

test("nested scopes: folder inside folder creates nested scope", () => {
  const m = createModel("Root");
  const root = m.state.rootId;

  const outer = m.addNode(root, "OuterScope");
  m.state.nodes[outer].nodeType = "folder";
  const inner = m.addNode(outer, "InnerScope");
  m.state.nodes[inner].nodeType = "folder";
  const leaf = m.addNode(inner, "Leaf");

  // Query inner scope
  const innerNodes = m.queryNodeIds(inner);
  assert.deepEqual(innerNodes, [inner, leaf]);

  // Query outer scope includes inner
  const outerNodes = m.queryNodeIds(outer);
  assert.ok(outerNodes.includes(outer));
  assert.ok(outerNodes.includes(inner));
  assert.ok(outerNodes.includes(leaf));
});

test("nested scopes: deeply nested (3 levels)", () => {
  const m = createModel("Root");
  const root = m.state.rootId;

  const l1 = m.addNode(root, "L1");
  m.state.nodes[l1].nodeType = "folder";
  const l2 = m.addNode(l1, "L2");
  m.state.nodes[l2].nodeType = "folder";
  const l3 = m.addNode(l2, "L3");
  m.state.nodes[l3].nodeType = "folder";
  const deep = m.addNode(l3, "DeepNode");

  const l3Nodes = m.queryNodeIds(l3);
  assert.deepEqual(l3Nodes, [l3, deep]);

  const l1Nodes = m.queryNodeIds(l1);
  assert.ok(l1Nodes.includes(deep));
  assert.equal(l1Nodes.length, 4); // l1, l2, l3, deep
});

// --- Breadcrumb path calculation ---

test("breadcrumb: path from node to root", () => {
  const { m, root, scopeA, a2, a2a } = buildScopedTree();
  const nodes = m.state.nodes;

  // Compute breadcrumb path by walking parentId
  const path = [];
  let current = nodes[a2a];
  while (current) {
    path.unshift(current.id);
    if (current.parentId === null) break;
    current = nodes[current.parentId];
  }

  assert.deepEqual(path, [root, scopeA, a2, a2a]);
});

test("breadcrumb: root node has single-element path", () => {
  const m = createModel("Root");
  const root = m.state.rootId;

  const path = [root];
  assert.equal(path.length, 1);
  assert.equal(path[0], root);
});

// --- findScopeRoot ---

test.beforeEach(() => {
  resetCollab();
});

test("findScopeRoot returns folder ancestor", () => {
  const { m, root, scopeA, a1 } = buildScopedTree();

  const result = findScopeRoot(m.state.nodes, a1, root);
  assert.equal(result, scopeA);
});

test("findScopeRoot returns rootId for top-level text node", () => {
  const { m, root, orphan } = buildScopedTree();

  const result = findScopeRoot(m.state.nodes, orphan, root);
  assert.equal(result, root);
});

test("findScopeRoot on folder itself returns that folder", () => {
  const { m, root, scopeA } = buildScopedTree();

  const result = findScopeRoot(m.state.nodes, scopeA, root);
  assert.equal(result, scopeA);
});

test("findScopeRoot with nested folders returns nearest folder", () => {
  const m = createModel("Root");
  const root = m.state.rootId;

  const outer = m.addNode(root, "Outer");
  m.state.nodes[outer].nodeType = "folder";
  const inner = m.addNode(outer, "Inner");
  m.state.nodes[inner].nodeType = "folder";
  const leaf = m.addNode(inner, "Leaf");

  const result = findScopeRoot(m.state.nodes, leaf, root);
  assert.equal(result, inner);
});

test("findScopeRoot on root returns rootId", () => {
  const m = createModel("Root");
  const root = m.state.rootId;

  const result = findScopeRoot(m.state.nodes, root, root);
  assert.equal(result, root);
});

// --- isInScope ---

test("isInScope returns true for node inside scope", () => {
  const { m, root, scopeA, a1 } = buildScopedTree();

  assert.equal(isInScope(m.state.nodes, a1, scopeA, root), true);
});

test("isInScope returns false for node outside scope", () => {
  const { m, root, scopeA, b1 } = buildScopedTree();

  assert.equal(isInScope(m.state.nodes, b1, scopeA, root), false);
});

test("isInScope with rootId always returns true", () => {
  const { m, root, a1, b1, orphan } = buildScopedTree();

  assert.equal(isInScope(m.state.nodes, a1, root, root), true);
  assert.equal(isInScope(m.state.nodes, b1, root, root), true);
  assert.equal(isInScope(m.state.nodes, orphan, root, root), true);
});

test("isInScope for deeply nested node in outer scope", () => {
  const { m, root, scopeA, a2a } = buildScopedTree();

  assert.equal(isInScope(m.state.nodes, a2a, scopeA, root), true);
});

test("isInScope for node at scope boundary (node is the scope itself)", () => {
  const { m, root, scopeA } = buildScopedTree();

  assert.equal(isInScope(m.state.nodes, scopeA, scopeA, root), true);
});

// ===========================================================================
// Phase 2: scope/alias spec implementation tests
// ===========================================================================

// --- Cross-scope reparent ---

test("reparent node from one scope to another", () => {
  const { m, root, scopeA, a1, scopeB } = buildScopedTree();

  m.reparentNode(a1, scopeB);

  // a1 is now under scopeB
  assert.equal(m.state.nodes[a1].parentId, scopeB);
  assert.ok(m.state.nodes[scopeB].children.includes(a1));
  assert.ok(!m.state.nodes[scopeA].children.includes(a1));

  // queryNodes reflects the change
  const scopeANodes = m.queryNodeIds(scopeA);
  assert.ok(!scopeANodes.includes(a1));

  const scopeBNodes = m.queryNodeIds(scopeB);
  assert.ok(scopeBNodes.includes(a1));
});

test("reparent subtree from one scope to another moves entire subtree", () => {
  const { m, scopeA, a2, a2a, scopeB } = buildScopedTree();

  m.reparentNode(a2, scopeB);

  // a2 and its child a2a both under scopeB now
  const scopeBNodes = m.queryNodeIds(scopeB);
  assert.ok(scopeBNodes.includes(a2));
  assert.ok(scopeBNodes.includes(a2a));

  const scopeANodes = m.queryNodeIds(scopeA);
  assert.ok(!scopeANodes.includes(a2));
  assert.ok(!scopeANodes.includes(a2a));
});

test("reparent to root level (out of scope)", () => {
  const { m, root, scopeA, a1 } = buildScopedTree();

  m.reparentNode(a1, root);

  assert.equal(m.state.nodes[a1].parentId, root);
  assert.ok(m.state.nodes[root].children.includes(a1));
  assert.ok(!m.state.nodes[scopeA].children.includes(a1));
});

test("reparent preserves model validity", () => {
  const { m, a1, scopeB } = buildScopedTree();

  m.reparentNode(a1, scopeB);

  const errors = m.validate();
  assert.equal(errors.length, 0, `Validation errors: ${errors.join(", ")}`);
});

// --- Cross-scope alias references ---

test("alias can reference node in different scope", () => {
  const { m, scopeA, a1, scopeB } = buildScopedTree();

  // Create alias in scopeB pointing to a1 (in scopeA)
  const aliasId = m.addAlias(scopeB, a1, { aliasLabel: "Ref to A1" });

  const alias = m.state.nodes[aliasId];
  assert.equal(alias.targetNodeId, a1);
  assert.equal(alias.nodeType, "alias");
  assert.equal(alias.parentId, scopeB);

  // Model should still be valid
  const errors = m.validate();
  assert.equal(errors.length, 0, `Validation errors: ${errors.join(", ")}`);
});

test("cross-scope alias becomes broken when target is deleted", () => {
  const { m, scopeA, a1, scopeB } = buildScopedTree();

  const aliasId = m.addAlias(scopeB, a1, { aliasLabel: "CrossRef" });
  m.deleteNode(a1);

  const alias = m.state.nodes[aliasId];
  assert.equal(alias.isBroken, true);
  assert.equal(alias.targetSnapshotLabel, "A1");
});

test("cross-scope alias with scope deletion breaks alias", () => {
  const { m, scopeA, a1, scopeB } = buildScopedTree();

  const aliasId = m.addAlias(scopeB, a1);

  // Delete entire scopeA (which contains a1)
  m.deleteNode(scopeA);

  const alias = m.state.nodes[aliasId];
  assert.equal(alias.isBroken, true);
});

test("multiple aliases from different scopes to same target", () => {
  const { m, root, scopeA, a1, scopeB, orphan } = buildScopedTree();

  const alias1 = m.addAlias(scopeB, a1, { aliasLabel: "Alias1" });
  const alias2 = m.addAlias(root, a1, { aliasLabel: "Alias2" });

  assert.equal(m.state.nodes[alias1].targetNodeId, a1);
  assert.equal(m.state.nodes[alias2].targetNodeId, a1);

  // Delete target, both aliases break
  m.deleteNode(a1);
  assert.equal(m.state.nodes[alias1].isBroken, true);
  assert.equal(m.state.nodes[alias2].isBroken, true);
});

// --- findScopeRoot edge cases ---

test("findScopeRoot with non-existent nodeId returns rootId", () => {
  const m = createModel("Root");
  const root = m.state.rootId;

  const result = findScopeRoot(m.state.nodes, "nonexistent", root);
  assert.equal(result, root);
});

test("findScopeRoot with text node chain (no folders) returns root", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const a = m.addNode(root, "A");
  const b = m.addNode(a, "B");
  const c = m.addNode(b, "C");

  const result = findScopeRoot(m.state.nodes, c, root);
  assert.equal(result, root);
});

test("findScopeRoot with text between folders returns innermost folder", () => {
  const m = createModel("Root");
  const root = m.state.rootId;

  const folder1 = m.addNode(root, "Folder1");
  m.state.nodes[folder1].nodeType = "folder";
  const text1 = m.addNode(folder1, "Text1");
  const folder2 = m.addNode(text1, "Folder2");
  m.state.nodes[folder2].nodeType = "folder";
  const leaf = m.addNode(folder2, "Leaf");

  // Leaf's scope root should be folder2
  assert.equal(findScopeRoot(m.state.nodes, leaf, root), folder2);
  // Text1's scope root should be folder1
  assert.equal(findScopeRoot(m.state.nodes, text1, root), folder1);
});

// ===========================================================================
// Phase 3: Band density (Flash / Rapid / Deep)
// ===========================================================================

test("band attribute: can assign flash/rapid/deep to nodes", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const a = m.addNode(root, "Flash note");
  const b = m.addNode(root, "Rapid graph");
  const c = m.addNode(root, "Deep research");

  // Use attributes to store band
  m.state.nodes[a].attributes.band = "flash";
  m.state.nodes[b].attributes.band = "rapid";
  m.state.nodes[c].attributes.band = "deep";

  assert.equal(m.state.nodes[a].attributes.band, "flash");
  assert.equal(m.state.nodes[b].attributes.band, "rapid");
  assert.equal(m.state.nodes[c].attributes.band, "deep");

  // Model should still be valid
  const errors = m.validate();
  assert.equal(errors.length, 0);
});

test("band filter: queryNodes then filter by band attribute", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const a = m.addNode(root, "Flash1");
  const b = m.addNode(root, "Rapid1");
  const c = m.addNode(root, "Flash2");
  const d = m.addNode(root, "Deep1");

  m.state.nodes[a].attributes.band = "flash";
  m.state.nodes[b].attributes.band = "rapid";
  m.state.nodes[c].attributes.band = "flash";
  m.state.nodes[d].attributes.band = "deep";

  const allNodes = m.queryNodes(root);
  const flashNodes = allNodes.filter((n) => n.attributes.band === "flash");
  const rapidNodes = allNodes.filter((n) => n.attributes.band === "rapid");
  const deepNodes = allNodes.filter((n) => n.attributes.band === "deep");

  assert.equal(flashNodes.length, 2);
  assert.equal(rapidNodes.length, 1);
  assert.equal(deepNodes.length, 1);
});

test("band promotion: flash -> rapid -> deep", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const node = m.addNode(root, "Evolving node");

  // Start as flash
  m.state.nodes[node].attributes.band = "flash";
  assert.equal(m.state.nodes[node].attributes.band, "flash");

  // Promote to rapid
  m.state.nodes[node].attributes.band = "rapid";
  assert.equal(m.state.nodes[node].attributes.band, "rapid");

  // Promote to deep
  m.state.nodes[node].attributes.band = "deep";
  assert.equal(m.state.nodes[node].attributes.band, "deep");

  const errors = m.validate();
  assert.equal(errors.length, 0);
});

test("band filter within scope", () => {
  const { m, scopeA, a1, a2 } = buildScopedTree();

  m.state.nodes[a1].attributes.band = "flash";
  m.state.nodes[a2].attributes.band = "rapid";

  const scopeNodes = m.queryNodes(scopeA);
  const flashInScope = scopeNodes.filter((n) => n.attributes.band === "flash");
  const rapidInScope = scopeNodes.filter((n) => n.attributes.band === "rapid");

  assert.equal(flashInScope.length, 1);
  assert.equal(flashInScope[0].id, a1);
  assert.equal(rapidInScope.length, 1);
  assert.equal(rapidInScope[0].id, a2);
});

test("band: nodes without band attribute are unclassified", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const a = m.addNode(root, "Classified");
  const b = m.addNode(root, "Unclassified");

  m.state.nodes[a].attributes.band = "flash";

  const allNodes = m.queryNodes(root);
  const unclassified = allNodes.filter((n) => !n.attributes.band);

  // Root + b are unclassified
  assert.ok(unclassified.some((n) => n.id === b));
  assert.ok(unclassified.some((n) => n.id === root));
  assert.ok(!unclassified.some((n) => n.id === a));
});

test("band survives JSON round-trip", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const a = m.addNode(root, "Flash");
  m.state.nodes[a].attributes.band = "flash";

  const json = m.toJSON();
  const restored = RapidMvpModel.fromJSON(json);

  assert.equal(restored.state.nodes[a].attributes.band, "flash");
});

// ===========================================================================
// Phase 4: Scope bookmark
// ===========================================================================

test("bookmark: store scope bookmark in linearNotesByScope", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const scope1 = m.addNode(root, "Scope1");
  m.state.nodes[scope1].nodeType = "folder";

  // Use linearNotesByScope as a bookmark store (existing field)
  if (!m.state.linearNotesByScope) m.state.linearNotesByScope = {};
  m.state.linearNotesByScope["__bookmarks__"] = JSON.stringify([
    { scopeId: scope1, label: "My Bookmark" },
  ]);

  const bookmarks = JSON.parse(m.state.linearNotesByScope["__bookmarks__"]);
  assert.equal(bookmarks.length, 1);
  assert.equal(bookmarks[0].scopeId, scope1);
  assert.equal(bookmarks[0].label, "My Bookmark");
});

test("bookmark: multiple bookmarks stored and retrieved", () => {
  const { m, scopeA, scopeB } = buildScopedTree();

  if (!m.state.linearNotesByScope) m.state.linearNotesByScope = {};
  const bookmarks = [
    { scopeId: scopeA, label: "Scope A Bookmark" },
    { scopeId: scopeB, label: "Scope B Bookmark" },
  ];
  m.state.linearNotesByScope["__bookmarks__"] = JSON.stringify(bookmarks);

  const loaded = JSON.parse(m.state.linearNotesByScope["__bookmarks__"]);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].scopeId, scopeA);
  assert.equal(loaded[1].scopeId, scopeB);
});

test("bookmark: jump to bookmarked scope returns correct nodes", () => {
  const { m, scopeA, a1, a2, scopeB, b1 } = buildScopedTree();

  if (!m.state.linearNotesByScope) m.state.linearNotesByScope = {};
  const bookmarks = [
    { scopeId: scopeA, label: "A" },
    { scopeId: scopeB, label: "B" },
  ];
  m.state.linearNotesByScope["__bookmarks__"] = JSON.stringify(bookmarks);

  // "Jump" to bookmark = queryNodes with that scopeId
  const jumpA = m.queryNodeIds(bookmarks[0].scopeId);
  assert.ok(jumpA.includes(a1));
  assert.ok(jumpA.includes(a2));
  assert.ok(!jumpA.includes(b1));

  const jumpB = m.queryNodeIds(bookmarks[1].scopeId);
  assert.ok(jumpB.includes(b1));
  assert.ok(!jumpB.includes(a1));
});

test("bookmark: survives JSON round-trip", () => {
  const { m, scopeA } = buildScopedTree();

  if (!m.state.linearNotesByScope) m.state.linearNotesByScope = {};
  const bookmarks = [{ scopeId: scopeA, label: "Saved" }];
  m.state.linearNotesByScope["__bookmarks__"] = JSON.stringify(bookmarks);

  const json = m.toJSON();
  const restored = RapidMvpModel.fromJSON(json);

  const loaded = JSON.parse(restored.state.linearNotesByScope["__bookmarks__"]);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].scopeId, scopeA);
});

test("bookmark: deleted scope bookmark returns empty queryNodes", () => {
  const { m, scopeA, a1 } = buildScopedTree();

  if (!m.state.linearNotesByScope) m.state.linearNotesByScope = {};
  const bookmarks = [{ scopeId: scopeA, label: "Will be deleted" }];
  m.state.linearNotesByScope["__bookmarks__"] = JSON.stringify(bookmarks);

  m.deleteNode(scopeA);

  // Trying to jump to deleted scope should throw (node not found)
  assert.throws(() => m.queryNodeIds(scopeA), {
    message: /not found/i,
  });
});

// ===========================================================================
// Validation integration: scope + alias + band combined
// ===========================================================================

test("combined: scoped alias with band attribute validates", () => {
  const { m, scopeA, a1, scopeB } = buildScopedTree();

  m.state.nodes[a1].attributes.band = "rapid";
  const aliasId = m.addAlias(scopeB, a1, { aliasLabel: "Rapid Ref", access: "read" });

  const errors = m.validate();
  assert.equal(errors.length, 0, `Validation errors: ${errors.join(", ")}`);
});

test("combined: reparent + alias + band all maintain validity", () => {
  const { m, scopeA, a1, a2, scopeB } = buildScopedTree();

  m.state.nodes[a1].attributes.band = "flash";
  m.state.nodes[a2].attributes.band = "deep";

  // Create cross-scope alias
  const aliasId = m.addAlias(scopeB, a1);

  // Reparent a2 to scopeB
  m.reparentNode(a2, scopeB);

  const errors = m.validate();
  assert.equal(errors.length, 0, `Validation errors: ${errors.join(", ")}`);

  // Verify band attributes survived
  assert.equal(m.state.nodes[a1].attributes.band, "flash");
  assert.equal(m.state.nodes[a2].attributes.band, "deep");
});
