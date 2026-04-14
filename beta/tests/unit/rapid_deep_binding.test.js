import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function tmpDb(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `m3e-binding-${tag}-`));
  return path.join(dir, "test.sqlite");
}

function baseNode(id, overrides = {}) {
  return {
    id,
    label: `Node ${id}`,
    domain: "knot",
    role: "object",
    level: "technical",
    status: "accepted",
    attributes: {},
    ...overrides,
  };
}

function baseBinding(id, semanticId, overrides = {}) {
  return {
    id,
    syntacticId: `syn_${id}`,
    spanStart: 0,
    spanEnd: 10,
    semanticId,
    bindType: "mentions",
    confidence: 0.9,
    ...overrides,
  };
}

test("createSemanticNode + listBindings round trip", () => {
  const db = tmpDb("roundtrip");
  RapidMvpModel.createSemanticNode(db, baseNode("n1", { label: "Knot K" }));
  RapidMvpModel.addBinding(db, baseBinding("b1", "n1", { syntacticId: "para17", spanStart: 45, spanEnd: 78, bindType: "defines", confidence: 0.92 }));

  const bindings = RapidMvpModel.listBindings(db, "para17");
  expect(bindings).toHaveLength(1);
  expect(bindings[0]).toMatchObject({
    id: "b1",
    syntacticId: "para17",
    spanStart: 45,
    spanEnd: 78,
    semanticId: "n1",
    bindType: "defines",
    confidence: 0.92,
  });
});

test("listOccurrences finds all bindings for a semantic node", () => {
  const db = tmpDb("occ");
  RapidMvpModel.createSemanticNode(db, baseNode("lift"));
  RapidMvpModel.addBinding(db, baseBinding("b1", "lift", { syntacticId: "p1", spanStart: 0, spanEnd: 5 }));
  RapidMvpModel.addBinding(db, baseBinding("b2", "lift", { syntacticId: "p2", spanStart: 10, spanEnd: 20 }));

  const occ = RapidMvpModel.listOccurrences(db, "lift");
  expect(occ).toHaveLength(2);
  expect(occ.map((b) => b.id).sort()).toEqual(["b1", "b2"]);
});

test("listBindings / listOccurrences return [] for unknown ids", () => {
  const db = tmpDb("empty");
  expect(RapidMvpModel.listBindings(db, "nope")).toEqual([]);
  expect(RapidMvpModel.listOccurrences(db, "nope")).toEqual([]);
});

test("addBinding rejects unknown semantic node (FK-like check)", () => {
  const db = tmpDb("fkbind");
  expect(() => RapidMvpModel.addBinding(db, baseBinding("b1", "ghost"))).toThrow(
    /missing semantic_node/i,
  );
});

test("addSemanticEdge rejects unknown endpoints", () => {
  const db = tmpDb("fkedge");
  RapidMvpModel.createSemanticNode(db, baseNode("a"));
  expect(() => RapidMvpModel.addSemanticEdge(db, { id: "e1", src: "a", dst: "b", edgeType: "depends_on" })).toThrow(
    /missing semantic_node/i,
  );
});

test("addSemanticEdge rejects self loop", () => {
  const db = tmpDb("selfloop");
  RapidMvpModel.createSemanticNode(db, baseNode("a"));
  expect(() => RapidMvpModel.addSemanticEdge(db, { id: "e1", src: "a", dst: "a", edgeType: "depends_on" })).toThrow(
    /itself/,
  );
});

test("addBinding rejects invalid confidence and span", () => {
  const db = tmpDb("inv");
  RapidMvpModel.createSemanticNode(db, baseNode("n1"));
  expect(() => RapidMvpModel.addBinding(db, baseBinding("b1", "n1", { confidence: 1.5 }))).toThrow(/confidence/i);
  expect(() => RapidMvpModel.addBinding(db, baseBinding("b1", "n1", { confidence: -0.1 }))).toThrow(/confidence/i);
  expect(() => RapidMvpModel.addBinding(db, baseBinding("b1", "n1", { spanStart: 10, spanEnd: 5 }))).toThrow(/spanEnd/);
  expect(() => RapidMvpModel.addBinding(db, baseBinding("b1", "n1", { spanStart: -1 }))).toThrow(/spanStart/);
});

test("addBinding rejects invalid bindType", () => {
  const db = tmpDb("bt");
  RapidMvpModel.createSemanticNode(db, baseNode("n1"));
  expect(() => RapidMvpModel.addBinding(db, baseBinding("b1", "n1", { bindType: "wiggles" }))).toThrow(/bindType/);
});

test("deleteSemanticNode orphans bindings but removes incident edges", () => {
  const db = tmpDb("orphan");
  RapidMvpModel.createSemanticNode(db, baseNode("a"));
  RapidMvpModel.createSemanticNode(db, baseNode("b"));
  RapidMvpModel.addSemanticEdge(db, { id: "e1", src: "a", dst: "b", edgeType: "depends_on" });
  RapidMvpModel.addBinding(db, baseBinding("bind1", "a", { syntacticId: "syn1" }));

  RapidMvpModel.deleteSemanticNode(db, "a");

  // Binding survives as orphan (semantic_id still "a", but node is gone)
  const occ = RapidMvpModel.listOccurrences(db, "a");
  expect(occ).toHaveLength(1);
  expect(occ[0].id).toBe("bind1");

  // Incident edge is gone
  expect(() => RapidMvpModel.addSemanticEdge(db, { id: "e2", src: "a", dst: "b", edgeType: "depends_on" })).toThrow(
    /missing semantic_node/i,
  );
});

test("deleteSemanticNode throws when node not found", () => {
  const db = tmpDb("delnope");
  expect(() => RapidMvpModel.deleteSemanticNode(db, "ghost")).toThrow(/not found/i);
});

test("schema coexists with existing documents table (additive migration)", () => {
  const db = tmpDb("coexist");
  // Simulate pre-existing doc usage.
  const model = new RapidMvpModel("Root");
  model.saveToSqlite(db, "doc-1");
  // New binding tables should now exist — inserting a semantic node must succeed.
  RapidMvpModel.createSemanticNode(db, baseNode("n1"));
  // And the original document should still be loadable.
  const reopened = RapidMvpModel.loadFromSqlite(db, "doc-1");
  expect(reopened.state.nodes[reopened.state.rootId].text).toBe("Root");
});
