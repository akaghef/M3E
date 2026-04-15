import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function makeTempDb() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-scope-test-"));
  return path.join(base, "data.sqlite");
}

/**
 * Build a doc:
 *     root
 *     ├── A
 *     │   ├── A1
 *     │   └── A2
 *     └── B
 *         └── B1
 * with a link A1 <-> B1 (crosses subtrees), and a link A1 <-> A2 (inside A).
 */
function seedDoc(dbPath, mapId) {
  const model = new RapidMvpModel("root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const a1 = model.addNode(a, "A1");
  const a2 = model.addNode(a, "A2");
  const b = model.addNode(rootId, "B");
  const b1 = model.addNode(b, "B1");
  model.addLink(a1, a2, { label: "inside-A" });
  model.addLink(a1, b1, { label: "cross-subtree" });
  model.saveToSqlite(dbPath, mapId);
  return { rootId, a, a1, a2, b, b1 };
}

test("readScopedState returns subtree rooted at scope", () => {
  const dbPath = makeTempDb();
  const ids = seedDoc(dbPath, "d1");
  const result = RapidMvpModel.readScopedState(dbPath, "d1", ids.a);
  expect(result.ok).toBe(true);
  expect(result.doc.state.rootId).toBe(ids.a);
  expect(Object.keys(result.doc.state.nodes).sort()).toEqual([ids.a, ids.a1, ids.a2].sort());
  expect(result.doc.state.nodes[ids.a].parentId).toBe(null);
  expect(result.nodeCount).toBe(3);
});

test("readScopedState excludes links crossing subtree boundary", () => {
  const dbPath = makeTempDb();
  const ids = seedDoc(dbPath, "d1");
  const result = RapidMvpModel.readScopedState(dbPath, "d1", ids.a);
  expect(result.ok).toBe(true);
  const links = Object.values(result.doc.state.links ?? {});
  expect(links.length).toBe(1);
  expect(links[0].label).toBe("inside-A");
});

test("readScopedState depth=0 returns only the scope node", () => {
  const dbPath = makeTempDb();
  const ids = seedDoc(dbPath, "d1");
  const result = RapidMvpModel.readScopedState(dbPath, "d1", ids.a, 0);
  expect(result.ok).toBe(true);
  expect(Object.keys(result.doc.state.nodes)).toEqual([ids.a]);
  expect(result.doc.state.nodes[ids.a].children).toEqual([]);
});

test("readScopedState returns SCOPE_NOT_FOUND for missing scope", () => {
  const dbPath = makeTempDb();
  seedDoc(dbPath, "d1");
  const result = RapidMvpModel.readScopedState(dbPath, "d1", "no-such-id");
  expect(result.ok).toBe(false);
  expect(result.error.code).toBe("SCOPE_NOT_FOUND");
});

test("writeScopedState replaces only the subtree and preserves outside nodes", () => {
  const dbPath = makeTempDb();
  const ids = seedDoc(dbPath, "d1");

  // Build a new subtree under A:  A -> A_new
  const newSubtree = {
    rootId: ids.a,
    nodes: {
      [ids.a]: {
        id: ids.a,
        parentId: ids.rootId, // caller may echo; server preserves stored parent anyway
        children: ["a_new"],
        nodeType: "text",
        text: "A-updated",
        collapsed: false,
        details: "",
        note: "",
        attributes: {},
        link: "",
      },
      a_new: {
        id: "a_new",
        parentId: ids.a,
        children: [],
        nodeType: "text",
        text: "fresh child",
        collapsed: false,
        details: "",
        note: "",
        attributes: {},
        link: "",
      },
    },
    links: {},
  };

  const result = RapidMvpModel.writeScopedState(dbPath, "d1", ids.a, newSubtree);
  expect(result.ok).toBe(true);
  expect(result.replacedNodeCount).toBe(2);

  // Reload — verify outside nodes preserved, subtree replaced
  const reloaded = RapidMvpModel.loadFromSqlite(dbPath, "d1");
  const state = reloaded.toJSON();
  expect(state.rootId).toBe(ids.rootId);
  expect(state.nodes[ids.b]).toBeTruthy();
  expect(state.nodes[ids.b1]).toBeTruthy();
  expect(state.nodes[ids.a].text).toBe("A-updated");
  expect(state.nodes[ids.a].parentId).toBe(ids.rootId); // preserved
  expect(state.nodes[ids.a].children).toEqual(["a_new"]);
  expect(state.nodes["a_new"]).toBeTruthy();
  // Old A1/A2 are gone
  expect(state.nodes[ids.a1]).toBeUndefined();
  expect(state.nodes[ids.a2]).toBeUndefined();

  // Cross-subtree link (A1<->B1) is removed because A1 is gone; validate() would fail otherwise.
  // Inside-A link (A1<->A2) is removed because the old subtree was replaced.
  const linkLabels = Object.values(state.links ?? {}).map((l) => l.label);
  expect(linkLabels).not.toContain("inside-A");
  expect(linkLabels).not.toContain("cross-subtree");
});

test("writeScopedState rejects incoming rootId mismatch", () => {
  const dbPath = makeTempDb();
  const ids = seedDoc(dbPath, "d1");
  const bad = {
    rootId: "some-other-id",
    nodes: {},
    links: {},
  };
  const result = RapidMvpModel.writeScopedState(dbPath, "d1", ids.a, bad);
  expect(result.ok).toBe(false);
  expect(result.error.code).toBe("SCOPE_WRITE_ROOT_MISMATCH");
});

test("writeScopedState rejects references to nodes outside subtree", () => {
  const dbPath = makeTempDb();
  const ids = seedDoc(dbPath, "d1");
  const bad = {
    rootId: ids.a,
    nodes: {
      [ids.a]: {
        id: ids.a,
        parentId: ids.rootId,
        children: [ids.b1], // b1 lives outside subtree
        nodeType: "text",
        text: "A",
        collapsed: false,
        details: "",
        note: "",
        attributes: {},
        link: "",
      },
    },
    links: {},
  };
  const result = RapidMvpModel.writeScopedState(dbPath, "d1", ids.a, bad);
  expect(result.ok).toBe(false);
  expect(result.error.code).toBe("SCOPE_WRITE_OUTSIDE_REFERENCE");
});

test("writeScopedState returns SCOPE_NOT_FOUND when scope missing", () => {
  const dbPath = makeTempDb();
  seedDoc(dbPath, "d1");
  const body = { rootId: "ghost", nodes: { ghost: {} }, links: {} };
  const result = RapidMvpModel.writeScopedState(dbPath, "d1", "ghost", body);
  expect(result.ok).toBe(false);
  expect(result.error.code).toBe("SCOPE_NOT_FOUND");
});
