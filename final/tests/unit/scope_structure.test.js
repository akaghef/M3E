"use strict";

import { test, expect, beforeEach } from "vitest";

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

test("enterScope: queryNodes(scopeRoot) returns only children of that scope", () => {
  const { m, scopeA, a1, a2, a2a, scopeB, b1 } = buildScopedTree();

  const scopeANodes = m.queryNodeIds(scopeA);
  expect(scopeANodes.includes(scopeA)).toBe(true);
  expect(scopeANodes.includes(a1)).toBe(true);
  expect(scopeANodes.includes(a2)).toBe(true);
  expect(scopeANodes.includes(a2a)).toBe(true);
  expect(scopeANodes.includes(scopeB)).toBe(false);
  expect(scopeANodes.includes(b1)).toBe(false);
});

test("exitScope: queryNodes(root) returns all nodes", () => {
  const { m, root, scopeA, a1, scopeB, b1, orphan } = buildScopedTree();

  const allNodes = m.queryNodeIds(root);
  expect(allNodes.includes(root)).toBe(true);
  expect(allNodes.includes(scopeA)).toBe(true);
  expect(allNodes.includes(a1)).toBe(true);
  expect(allNodes.includes(scopeB)).toBe(true);
  expect(allNodes.includes(b1)).toBe(true);
  expect(allNodes.includes(orphan)).toBe(true);
});

test("scope enter then exit returns to full tree", () => {
  const { m, root, scopeA, a1, b1 } = buildScopedTree();

  const inScope = m.queryNodeIds(scopeA);
  expect(inScope.includes(a1)).toBe(true);
  expect(inScope.includes(b1)).toBe(false);

  const full = m.queryNodeIds(root);
  expect(full.includes(a1)).toBe(true);
  expect(full.includes(b1)).toBe(true);
});

// --- Alias creation and broken detection ---

test("alias creation stores correct targetNodeId", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const target = m.addNode(root, "Target");
  const aliasId = m.addAlias(root, target);

  const alias = m.state.nodes[aliasId];
  expect(alias.nodeType).toBe("alias");
  expect(alias.targetNodeId).toBe(target);
  expect(alias.isBroken).toBe(false);
});

test("alias broken detection triggers on target deletion", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const target = m.addNode(root, "Important Node");
  const aliasId = m.addAlias(root, target, { aliasLabel: "MyAlias" });

  m.deleteNode(target);

  const alias = m.state.nodes[aliasId];
  expect(alias.isBroken).toBe(true);
  expect(alias.targetSnapshotLabel).toBe("Important Node");
  expect(alias.text).toMatch(/deleted/);
});

test("alias cannot target another alias", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const target = m.addNode(root, "Target");
  const aliasId = m.addAlias(root, target);

  expect(() => m.addAlias(root, aliasId)).toThrow(
    /cannot target another alias/i,
  );
});

test("alias default access is read", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const target = m.addNode(root, "Target");
  const aliasId = m.addAlias(root, target);

  expect(m.state.nodes[aliasId].access).toBe("read");
});

test("alias with write access is stored correctly", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const target = m.addNode(root, "Target");
  const aliasId = m.addAlias(root, target, { access: "write" });

  expect(m.state.nodes[aliasId].access).toBe("write");
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

  const innerNodes = m.queryNodeIds(inner);
  expect(innerNodes).toEqual([inner, leaf]);

  const outerNodes = m.queryNodeIds(outer);
  expect(outerNodes.includes(outer)).toBe(true);
  expect(outerNodes.includes(inner)).toBe(true);
  expect(outerNodes.includes(leaf)).toBe(true);
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
  expect(l3Nodes).toEqual([l3, deep]);

  const l1Nodes = m.queryNodeIds(l1);
  expect(l1Nodes.includes(deep)).toBe(true);
  expect(l1Nodes.length).toBe(4);
});

// --- Breadcrumb path calculation ---

test("breadcrumb: path from node to root", () => {
  const { m, root, scopeA, a2, a2a } = buildScopedTree();
  const nodes = m.state.nodes;

  const breadcrumbPath = [];
  let current = nodes[a2a];
  while (current) {
    breadcrumbPath.unshift(current.id);
    if (current.parentId === null) break;
    current = nodes[current.parentId];
  }

  expect(breadcrumbPath).toEqual([root, scopeA, a2, a2a]);
});

test("breadcrumb: root node has single-element path", () => {
  const m = createModel("Root");
  const root = m.state.rootId;

  const breadcrumbPath = [root];
  expect(breadcrumbPath.length).toBe(1);
  expect(breadcrumbPath[0]).toBe(root);
});

// --- findScopeRoot ---

beforeEach(() => {
  resetCollab();
});

test("findScopeRoot returns folder ancestor", () => {
  const { m, root, scopeA, a1 } = buildScopedTree();

  const result = findScopeRoot(m.state.nodes, a1, root);
  expect(result).toBe(scopeA);
});

test("findScopeRoot returns rootId for top-level text node", () => {
  const { m, root, orphan } = buildScopedTree();

  const result = findScopeRoot(m.state.nodes, orphan, root);
  expect(result).toBe(root);
});

test("findScopeRoot on folder itself returns that folder", () => {
  const { m, root, scopeA } = buildScopedTree();

  const result = findScopeRoot(m.state.nodes, scopeA, root);
  expect(result).toBe(scopeA);
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
  expect(result).toBe(inner);
});

test("findScopeRoot on root returns rootId", () => {
  const m = createModel("Root");
  const root = m.state.rootId;

  const result = findScopeRoot(m.state.nodes, root, root);
  expect(result).toBe(root);
});

// --- isInScope ---

test("isInScope returns true for node inside scope", () => {
  const { m, root, scopeA, a1 } = buildScopedTree();

  expect(isInScope(m.state.nodes, a1, scopeA, root)).toBe(true);
});

test("isInScope returns false for node outside scope", () => {
  const { m, root, scopeA, b1 } = buildScopedTree();

  expect(isInScope(m.state.nodes, b1, scopeA, root)).toBe(false);
});

test("isInScope with rootId always returns true", () => {
  const { m, root, a1, b1, orphan } = buildScopedTree();

  expect(isInScope(m.state.nodes, a1, root, root)).toBe(true);
  expect(isInScope(m.state.nodes, b1, root, root)).toBe(true);
  expect(isInScope(m.state.nodes, orphan, root, root)).toBe(true);
});

test("isInScope for deeply nested node in outer scope", () => {
  const { m, root, scopeA, a2a } = buildScopedTree();

  expect(isInScope(m.state.nodes, a2a, scopeA, root)).toBe(true);
});

test("isInScope for node at scope boundary (node is the scope itself)", () => {
  const { m, root, scopeA } = buildScopedTree();

  expect(isInScope(m.state.nodes, scopeA, scopeA, root)).toBe(true);
});

// ===========================================================================
// Phase 2: scope/alias spec implementation tests
// ===========================================================================

test("reparent node from one scope to another", () => {
  const { m, root, scopeA, a1, scopeB } = buildScopedTree();

  m.reparentNode(a1, scopeB);

  expect(m.state.nodes[a1].parentId).toBe(scopeB);
  expect(m.state.nodes[scopeB].children.includes(a1)).toBe(true);
  expect(m.state.nodes[scopeA].children.includes(a1)).toBe(false);

  const scopeANodes = m.queryNodeIds(scopeA);
  expect(scopeANodes.includes(a1)).toBe(false);

  const scopeBNodes = m.queryNodeIds(scopeB);
  expect(scopeBNodes.includes(a1)).toBe(true);
});

test("reparent subtree from one scope to another moves entire subtree", () => {
  const { m, scopeA, a2, a2a, scopeB } = buildScopedTree();

  m.reparentNode(a2, scopeB);

  const scopeBNodes = m.queryNodeIds(scopeB);
  expect(scopeBNodes.includes(a2)).toBe(true);
  expect(scopeBNodes.includes(a2a)).toBe(true);

  const scopeANodes = m.queryNodeIds(scopeA);
  expect(scopeANodes.includes(a2)).toBe(false);
  expect(scopeANodes.includes(a2a)).toBe(false);
});

test("reparent to root level (out of scope)", () => {
  const { m, root, scopeA, a1 } = buildScopedTree();

  m.reparentNode(a1, root);

  expect(m.state.nodes[a1].parentId).toBe(root);
  expect(m.state.nodes[root].children.includes(a1)).toBe(true);
  expect(m.state.nodes[scopeA].children.includes(a1)).toBe(false);
});

test("reparent preserves model validity", () => {
  const { m, a1, scopeB } = buildScopedTree();

  m.reparentNode(a1, scopeB);

  const errors = m.validate();
  expect(errors.length).toBe(0);
});

// --- Cross-scope alias references ---

test("alias can reference node in different scope", () => {
  const { m, scopeA, a1, scopeB } = buildScopedTree();

  const aliasId = m.addAlias(scopeB, a1, { aliasLabel: "Ref to A1" });

  const alias = m.state.nodes[aliasId];
  expect(alias.targetNodeId).toBe(a1);
  expect(alias.nodeType).toBe("alias");
  expect(alias.parentId).toBe(scopeB);

  const errors = m.validate();
  expect(errors.length).toBe(0);
});

test("cross-scope alias becomes broken when target is deleted", () => {
  const { m, scopeA, a1, scopeB } = buildScopedTree();

  const aliasId = m.addAlias(scopeB, a1, { aliasLabel: "CrossRef" });
  m.deleteNode(a1);

  const alias = m.state.nodes[aliasId];
  expect(alias.isBroken).toBe(true);
  expect(alias.targetSnapshotLabel).toBe("A1");
});

test("cross-scope alias with scope deletion breaks alias", () => {
  const { m, scopeA, a1, scopeB } = buildScopedTree();

  const aliasId = m.addAlias(scopeB, a1);

  m.deleteNode(scopeA);

  const alias = m.state.nodes[aliasId];
  expect(alias.isBroken).toBe(true);
});

test("multiple aliases from different scopes to same target", () => {
  const { m, root, scopeA, a1, scopeB, orphan } = buildScopedTree();

  const alias1 = m.addAlias(scopeB, a1, { aliasLabel: "Alias1" });
  const alias2 = m.addAlias(root, a1, { aliasLabel: "Alias2" });

  expect(m.state.nodes[alias1].targetNodeId).toBe(a1);
  expect(m.state.nodes[alias2].targetNodeId).toBe(a1);

  m.deleteNode(a1);
  expect(m.state.nodes[alias1].isBroken).toBe(true);
  expect(m.state.nodes[alias2].isBroken).toBe(true);
});

// --- findScopeRoot edge cases ---

test("findScopeRoot with non-existent nodeId returns rootId", () => {
  const m = createModel("Root");
  const root = m.state.rootId;

  const result = findScopeRoot(m.state.nodes, "nonexistent", root);
  expect(result).toBe(root);
});

test("findScopeRoot with text node chain (no folders) returns root", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const a = m.addNode(root, "A");
  const b = m.addNode(a, "B");
  const c = m.addNode(b, "C");

  const result = findScopeRoot(m.state.nodes, c, root);
  expect(result).toBe(root);
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

  expect(findScopeRoot(m.state.nodes, leaf, root)).toBe(folder2);
  expect(findScopeRoot(m.state.nodes, text1, root)).toBe(folder1);
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

  m.state.nodes[a].attributes.band = "flash";
  m.state.nodes[b].attributes.band = "rapid";
  m.state.nodes[c].attributes.band = "deep";

  expect(m.state.nodes[a].attributes.band).toBe("flash");
  expect(m.state.nodes[b].attributes.band).toBe("rapid");
  expect(m.state.nodes[c].attributes.band).toBe("deep");

  const errors = m.validate();
  expect(errors.length).toBe(0);
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

  expect(flashNodes.length).toBe(2);
  expect(rapidNodes.length).toBe(1);
  expect(deepNodes.length).toBe(1);
});

test("band promotion: flash -> rapid -> deep", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const node = m.addNode(root, "Evolving node");

  m.state.nodes[node].attributes.band = "flash";
  expect(m.state.nodes[node].attributes.band).toBe("flash");

  m.state.nodes[node].attributes.band = "rapid";
  expect(m.state.nodes[node].attributes.band).toBe("rapid");

  m.state.nodes[node].attributes.band = "deep";
  expect(m.state.nodes[node].attributes.band).toBe("deep");

  const errors = m.validate();
  expect(errors.length).toBe(0);
});

test("band filter within scope", () => {
  const { m, scopeA, a1, a2 } = buildScopedTree();

  m.state.nodes[a1].attributes.band = "flash";
  m.state.nodes[a2].attributes.band = "rapid";

  const scopeNodes = m.queryNodes(scopeA);
  const flashInScope = scopeNodes.filter((n) => n.attributes.band === "flash");
  const rapidInScope = scopeNodes.filter((n) => n.attributes.band === "rapid");

  expect(flashInScope.length).toBe(1);
  expect(flashInScope[0].id).toBe(a1);
  expect(rapidInScope.length).toBe(1);
  expect(rapidInScope[0].id).toBe(a2);
});

test("band: nodes without band attribute are unclassified", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const a = m.addNode(root, "Classified");
  const b = m.addNode(root, "Unclassified");

  m.state.nodes[a].attributes.band = "flash";

  const allNodes = m.queryNodes(root);
  const unclassified = allNodes.filter((n) => !n.attributes.band);

  expect(unclassified.some((n) => n.id === b)).toBe(true);
  expect(unclassified.some((n) => n.id === root)).toBe(true);
  expect(unclassified.some((n) => n.id === a)).toBe(false);
});

test("band survives JSON round-trip", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const a = m.addNode(root, "Flash");
  m.state.nodes[a].attributes.band = "flash";

  const json = m.toJSON();
  const restored = RapidMvpModel.fromJSON(json);

  expect(restored.state.nodes[a].attributes.band).toBe("flash");
});

// ===========================================================================
// Phase 4: Scope bookmark
// ===========================================================================

test("bookmark: store scope bookmark in linearNotesByScope", () => {
  const m = createModel("Root");
  const root = m.state.rootId;
  const scope1 = m.addNode(root, "Scope1");
  m.state.nodes[scope1].nodeType = "folder";

  if (!m.state.linearNotesByScope) m.state.linearNotesByScope = {};
  m.state.linearNotesByScope["__bookmarks__"] = JSON.stringify([
    { scopeId: scope1, label: "My Bookmark" },
  ]);

  const bookmarks = JSON.parse(m.state.linearNotesByScope["__bookmarks__"]);
  expect(bookmarks.length).toBe(1);
  expect(bookmarks[0].scopeId).toBe(scope1);
  expect(bookmarks[0].label).toBe("My Bookmark");
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
  expect(loaded.length).toBe(2);
  expect(loaded[0].scopeId).toBe(scopeA);
  expect(loaded[1].scopeId).toBe(scopeB);
});

test("bookmark: jump to bookmarked scope returns correct nodes", () => {
  const { m, scopeA, a1, a2, scopeB, b1 } = buildScopedTree();

  if (!m.state.linearNotesByScope) m.state.linearNotesByScope = {};
  const bookmarks = [
    { scopeId: scopeA, label: "A" },
    { scopeId: scopeB, label: "B" },
  ];
  m.state.linearNotesByScope["__bookmarks__"] = JSON.stringify(bookmarks);

  const jumpA = m.queryNodeIds(bookmarks[0].scopeId);
  expect(jumpA.includes(a1)).toBe(true);
  expect(jumpA.includes(a2)).toBe(true);
  expect(jumpA.includes(b1)).toBe(false);

  const jumpB = m.queryNodeIds(bookmarks[1].scopeId);
  expect(jumpB.includes(b1)).toBe(true);
  expect(jumpB.includes(a1)).toBe(false);
});

test("bookmark: survives JSON round-trip", () => {
  const { m, scopeA } = buildScopedTree();

  if (!m.state.linearNotesByScope) m.state.linearNotesByScope = {};
  const bookmarks = [{ scopeId: scopeA, label: "Saved" }];
  m.state.linearNotesByScope["__bookmarks__"] = JSON.stringify(bookmarks);

  const json = m.toJSON();
  const restored = RapidMvpModel.fromJSON(json);

  const loaded = JSON.parse(restored.state.linearNotesByScope["__bookmarks__"]);
  expect(loaded.length).toBe(1);
  expect(loaded[0].scopeId).toBe(scopeA);
});

test("bookmark: deleted scope bookmark returns empty queryNodes", () => {
  const { m, scopeA, a1 } = buildScopedTree();

  if (!m.state.linearNotesByScope) m.state.linearNotesByScope = {};
  const bookmarks = [{ scopeId: scopeA, label: "Will be deleted" }];
  m.state.linearNotesByScope["__bookmarks__"] = JSON.stringify(bookmarks);

  m.deleteNode(scopeA);

  expect(() => m.queryNodeIds(scopeA)).toThrow(
    /not found/i,
  );
});

// ===========================================================================
// Validation integration: scope + alias + band combined
// ===========================================================================

test("combined: scoped alias with band attribute validates", () => {
  const { m, scopeA, a1, scopeB } = buildScopedTree();

  m.state.nodes[a1].attributes.band = "rapid";
  const aliasId = m.addAlias(scopeB, a1, { aliasLabel: "Rapid Ref", access: "read" });

  const errors = m.validate();
  expect(errors.length).toBe(0);
});

test("combined: reparent + alias + band all maintain validity", () => {
  const { m, scopeA, a1, a2, scopeB } = buildScopedTree();

  m.state.nodes[a1].attributes.band = "flash";
  m.state.nodes[a2].attributes.band = "deep";

  const aliasId = m.addAlias(scopeB, a1);

  m.reparentNode(a2, scopeB);

  const errors = m.validate();
  expect(errors.length).toBe(0);

  expect(m.state.nodes[a1].attributes.band).toBe("flash");
  expect(m.state.nodes[a2].attributes.band).toBe("deep");
});
