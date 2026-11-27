import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { checkInvariants } from "../../src/shared/record_model/invariants";
import { isOrderKey } from "../../src/shared/record_model/order_key";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import type {
  AnnotationRecord,
  ConnectionRecord,
  DetailsRecord,
  EdgeConnectionRecord,
  GraphLinkConnectionRecord,
  IdMapRecord,
  LinearTextRecord,
  MapRecord,
  NodeRecord,
  NodeViewRecord,
  ScopeRecord,
  SnapshotRecord,
  SnapshotRow,
  SurfaceRecord,
} from "../../src/shared/record_model/types";

const WS = "ws_test";
const NOW = "2026-11-17T00:00:00.000Z";

type Loose = Record<string, unknown>;

function node(id: string, parentId: string | null, children: string[] = [], more: Loose = {}): Loose {
  return { id, parentId, children, text: id, collapsed: false, details: "", note: "", attributes: {}, link: "", ...more };
}

function row(id: string, state: Loose, more: Loose = {}): SnapshotRow {
  return { id, state, ...more } as SnapshotRow;
}

function convert(rows: SnapshotRow[]): SnapshotRecord[] {
  return toSnapshot(WS, rows, { now: NOW });
}

function sha(mapId: string, recordKind: string, seed: string): string {
  return createHash("sha256").update(`${WS}|${mapId}|${recordKind}|${seed}`).digest("hex").slice(0, 24);
}

function ofKind<T extends SnapshotRecord>(records: SnapshotRecord[], kind: T["kind"], mapId?: string): T[] {
  return records.filter((r) => r.kind === kind && (mapId === undefined || (r as { mapId?: string }).mapId === mapId)) as T[];
}

const nodesOf = (records: SnapshotRecord[], mapId?: string) => ofKind<NodeRecord>(records, "node", mapId);
const edgesOf = (records: SnapshotRecord[], mapId?: string) =>
  ofKind<ConnectionRecord>(records, "connection", mapId).filter((c): c is EdgeConnectionRecord => c.type === "edge");
const linksOf = (records: SnapshotRecord[], mapId?: string) =>
  ofKind<ConnectionRecord>(records, "connection", mapId).filter((c): c is GraphLinkConnectionRecord => c.type === "graphlink");
const nodeById = (records: SnapshotRecord[], id: string) => nodesOf(records).find((n) => n.id === id)!;
const idMapOf = (records: SnapshotRecord[]) => ofKind<IdMapRecord>(records, "idMap");

describe("toSnapshot: header and seeded records (1, 3.5)", () => {
  it("emits the header, relation types, prefixes, account and commit", () => {
    const records = convert([]);
    expect(records[0]).toEqual({ kind: "snapshot", format: 3, workspaceId: WS, seq: 0 });
    expect(ofKind(records, "relationTypeDef")).toEqual([
      { kind: "relationTypeDef", name: "m3e:consist-of", reads: "source-to-target", rev: 0 },
      { kind: "relationTypeDef", name: "m3e:detail", reads: "source-to-target", rev: 0 },
      { kind: "relationTypeDef", name: "rdfs:subClassOf", reads: "target-to-source", rev: 0 },
      { kind: "relationTypeDef", name: "rdf:type", reads: "target-to-source", rev: 0 },
    ]);
    expect(ofKind(records, "prefix")).toEqual([
      { kind: "prefix", prefix: "rdf", uri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#", rev: 0 },
      { kind: "prefix", prefix: "rdfs", uri: "http://www.w3.org/2000/01/rdf-schema#", rev: 0 },
    ]);
    expect(ofKind(records, "account")).toEqual([
      { kind: "account", id: "acct_migration", accountKind: "system", displayName: "移行", rev: 0 },
    ]);
    expect(ofKind(records, "commit")).toEqual([{ kind: "commit", seq: 0, committedAt: NOW, issuer: "acct_migration" }]);
  });
});

describe("toSnapshot: ids (3.1)", () => {
  it("keeps the id in the first map and reassigns duplicates in later maps", () => {
    const state = () => ({ rootId: "root", nodes: { root: node("root", null, ["a"]), a: node("a", "root") } });
    // rows given out of order: maps are processed in id order
    const records = convert([row("m2", state()), row("m1", state())]);
    expect(nodesOf(records, "m1").map((n) => n.id).sort()).toEqual(["a", "root"]);
    const newRoot = `n_${sha("m2", "node", "root")}`;
    const newA = `n_${sha("m2", "node", "a")}`;
    expect(nodesOf(records, "m2").map((n) => n.id).sort()).toEqual([newA, newRoot].sort());
    expect(newRoot).toMatch(/^n_[0-9a-f]{24}$/);
    expect(idMapOf(records)).toEqual(expect.arrayContaining([
      { kind: "idMap", recordKind: "node", mapId: "m2", oldId: "root", newId: newRoot },
      { kind: "idMap", recordKind: "node", mapId: "m2", oldId: "a", newId: newA },
    ]));
    expect(idMapOf(records).filter((r) => r.mapId === "m1")).toEqual([]);
    // references follow the new ids
    expect(ofKind<MapRecord>(records, "map").find((m) => m.id === "m2")!.rootNodeId).toBe(newRoot);
    expect(edgesOf(records, "m2")).toEqual([
      { kind: "connection", id: `c_${sha("m2", "edge", newA)}`, mapId: "m2", type: "edge", source: newRoot, target: newA, ord: "a0", scopeId: `s_${sha("m2", "scope", newRoot)}`, rev: 0 },
    ]);
    expect(ofKind<ScopeRecord>(records, "scope", "m2")).toEqual([
      { kind: "scope", id: `s_${sha("m2", "scope", newRoot)}`, mapId: "m2", rootNodeId: newRoot, rev: 0 },
    ]);
    expect(checkInvariants(records)).toEqual([]);
  });

  it("reassigns over-long ids and ids with other characters, and keeps the boundary cases", () => {
    const long64 = "x".repeat(64);
    const long65 = "x".repeat(65);
    const ok = "A-z_0.9:b";
    const bad = ["has space", "日本語", "a/b", "a|b"];
    const children = [long64, long65, ok, ...bad];
    const nodes: Loose = { root: node("root", null, children) };
    for (const id of children) nodes[id] = node(id, "root");
    const records = convert([row("m1", { rootId: "root", nodes })]);
    const ids = new Set(nodesOf(records).map((n) => n.id));
    expect(ids.has(long64)).toBe(true);
    expect(ids.has(ok)).toBe(true);
    for (const id of [long65, ...bad]) {
      expect(ids.has(id)).toBe(false);
      expect(ids.has(`n_${sha("m1", "node", id)}`)).toBe(true);
    }
    expect(idMapOf(records).map((r) => r.oldId).sort()).toEqual([long65, ...bad].sort());
    expect(checkInvariants(records)).toEqual([]);
  });

  it("reassigns links and annotations whose id is already used (node, then GraphLink, then annotation)", () => {
    const records = convert([row("m1", {
      rootId: "root",
      nodes: { root: node("root", null, ["x"]), x: node("x", "root") },
      links: {
        x: { id: "x", sourceNodeId: "root", targetNodeId: "x" },
        l1: { id: "l1", sourceNodeId: "x", targetNodeId: "root" },
        "bad id": { id: "bad id", sourceNodeId: "x", targetNodeId: "root" },
      },
      annotations: {
        x: { id: "x", kind: "text", x: 1, y: 2, text: "t", fill: "#000", fontSize: 12 },
        l1: { id: "l1", kind: "text", x: 1, y: 2, text: "t", fill: "#000", fontSize: 12 },
        a1: { id: "a1", kind: "text", x: 1, y: 2, text: "t", fill: "#000", fontSize: 12 },
      },
    })]);
    expect(nodeById(records, "x")).toBeDefined();
    expect(linksOf(records).map((l) => l.id).sort()).toEqual(
      [`c_${sha("m1", "graphlink", "x")}`, "l1", `c_${sha("m1", "graphlink", "bad id")}`].sort(),
    );
    expect(ofKind<AnnotationRecord>(records, "annotation").map((a) => a.id).sort()).toEqual(
      [`a_${sha("m1", "annotation", "x")}`, `a_${sha("m1", "annotation", "l1")}`, "a1"].sort(),
    );
    expect(idMapOf(records).map((r) => `${r.recordKind}:${r.oldId}`).sort()).toEqual(
      ["annotation:l1", "annotation:x", "graphlink:bad id", "graphlink:x"],
    );
    // the link that reused the node id still points at the node
    const moved = linksOf(records).find((l) => l.id === `c_${sha("m1", "graphlink", "x")}`)!;
    expect([moved.source, moved.target]).toEqual(["root", "x"]);
    expect(checkInvariants(records)).toEqual([]);
  });

  it("uses the injected hash with the documented seed string", () => {
    const seen: string[] = [];
    const records = toSnapshot(WS, [row("m1", {
      rootId: "r r",
      nodes: { "r r": node("r r", null) },
      surfaces: { sf: { id: "sf", scopeId: "scope:r r", kind: "tree", layout: "tree" } },
    })], {
      now: NOW,
      hash: (input) => {
        seen.push(input);
        return String(seen.length).padStart(4, "0").repeat(16);
      },
    });
    const rootId = nodesOf(records)[0].id;
    expect(rootId).toMatch(/^n_[0-9]{24}$/);
    expect(seen).toEqual(expect.arrayContaining([
      `${WS}|m1|node|r r`,
      `${WS}|m1|scope|${rootId}`,
      `${WS}|m1|surface|sf`,
    ]));
  });

  it("is deterministic: the same input gives identical output", () => {
    const build = () => [
      row("m2", { rootId: "root", nodes: { root: node("root", null, ["b", "a"]), a: node("a", "root"), b: node("b", "root") } }),
      row("m1", { rootId: "root", nodes: { root: node("root", null, ["bad id"]), "bad id": node("bad id", "root") } }),
    ];
    const first = JSON.stringify(convert(build()));
    expect(JSON.stringify(convert(build()))).toBe(first);
    expect(JSON.stringify(convert(build().reverse()))).toBe(first);
  });
});

describe("toSnapshot: node and details (3.2)", () => {
  const records = convert([row("m1", {
    rootId: "root",
    nodes: {
      root: node("root", null, ["folder", "leaf", "plain", "img", "odd", "alias", "broken", "attrs"], { collapsed: true }),
      folder: node("folder", "root", [], { nodeType: "folder", scopeId: "scope:root", aliasOf: "zzz" }),
      leaf: node("leaf", "root", [], { nodeType: "leaf", details: "body text", note: "", link: "" }),
      plain: (() => { const n = node("plain", "root", [], { note: "a note", link: "https://example.test" }); delete n.nodeType; return n; })(),
      img: node("img", "root", [], { nodeType: "image", type: "legacy", notes: ["n"], createdAt: "2026-01-01", updatedAt: 5, gone: null }),
      odd: node("odd", "root", [], { nodeType: "widget" }),
      alias: node("alias", "root", [], {
        nodeType: "alias", targetNodeId: "leaf", aliasLabel: "L", access: "read", targetSnapshotLabel: "snap", isBroken: false,
      }),
      broken: node("broken", "root", [], { nodeType: "alias", targetNodeId: "nowhere", isBroken: true }),
      attrs: node("attrs", "root", [], {
        attributes: { plainKey: "v", "m3e:status": "", dropped: null, n: 3, flag: true, list: ["a"], nested: { k: "v" }, "m3e:edge-label": "from root" },
      }),
    },
  })]);

  it("writes id, text and collapsed only when true", () => {
    expect(nodeById(records, "root")).toEqual({ kind: "node", id: "root", mapId: "m1", text: "root", collapsed: true, certainty: -1, rev: 0 });
    expect(nodeById(records, "plain")).toEqual({ kind: "node", id: "plain", mapId: "m1", text: "plain", certainty: -1, rev: 0 });
  });

  it("drops folder / leaf / missing nodeType and keeps the others", () => {
    expect("nodeType" in nodeById(records, "folder")).toBe(false);
    expect("nodeType" in nodeById(records, "leaf")).toBe(false);
    expect("nodeType" in nodeById(records, "plain")).toBe(false);
    expect(nodeById(records, "img").nodeType).toBe("image");
    expect(nodeById(records, "odd").nodeType).toBe("widget");
    expect(nodeById(records, "alias").nodeType).toBe("alias");
  });

  it("drops scopeId and aliasOf, and moves unknown fields to extra as they are", () => {
    expect(nodeById(records, "folder")).toEqual({ kind: "node", id: "folder", mapId: "m1", text: "folder", certainty: -1, rev: 0 });
    expect(nodeById(records, "img").extra).toEqual({ type: "legacy", notes: ["n"], createdAt: "2026-01-01", updatedAt: 5 });
  });

  it("creates details only for non-empty body / note / link", () => {
    expect(ofKind<DetailsRecord>(records, "details")).toEqual(expect.arrayContaining([
      { kind: "details", nodeId: "leaf", mapId: "m1", v: 1, body: "body text", rev: 0 },
      { kind: "details", nodeId: "plain", mapId: "m1", v: 1, note: "a note", link: "https://example.test", rev: 0 },
    ]));
    expect(ofKind<DetailsRecord>(records, "details")).toHaveLength(2);
  });

  it("maps alias fields, with broken only when true", () => {
    expect(nodeById(records, "alias").alias).toEqual({ target: "leaf", label: "L", access: "read", snapshotLabel: "snap" });
    expect(nodeById(records, "broken").alias).toEqual({ target: "nowhere", broken: true });
    expect(nodeById(records, "leaf").alias).toBeUndefined();
  });

  it("drops null attributes, keeps empty strings and key spelling, and moves m3e:edge-label to the edge", () => {
    expect(nodeById(records, "attrs").attributes).toEqual({
      plainKey: "v", "m3e:status": "", n: 3, flag: true, list: ["a"], nested: { k: "v" },
    });
    expect("attributes" in nodeById(records, "leaf")).toBe(false);
    expect(edgesOf(records).find((e) => e.target === "attrs")!.label).toBe("from root");
    expect(edgesOf(records).filter((e) => "label" in e)).toHaveLength(1);
  });

  it("writes no null anywhere at record top level and rev 0 on every record that carries rev", () => {
    for (const record of records) {
      for (const value of Object.values(record)) expect(value).not.toBeNull();
      if (!["snapshot", "nodeView", "commit", "idMap"].includes(record.kind)) expect((record as { rev: number }).rev).toBe(0);
    }
  });

  it("an empty m3e:edge-label writes no label and leaves no attribute", () => {
    const out = convert([row("m1", {
      rootId: "root",
      nodes: { root: node("root", null, ["a"]), a: node("a", "root", [], { attributes: { "m3e:edge-label": "" } }) },
    })]);
    expect("attributes" in nodeById(out, "a")).toBe(false);
    expect("label" in edgesOf(out)[0]).toBe(false);
  });
});

describe("toSnapshot: connections (3.3)", () => {
  it("orders edges by the parent's children, drops missing children, appends unlisted children by id", () => {
    const records = convert([row("m1", {
      rootId: "root",
      nodes: {
        root: node("root", null, ["c", "ghost", "a", "c", "elsewhere"]),
        a: node("a", "root"),
        c: node("c", "root"),
        z_unlisted: node("z_unlisted", "root"),
        b_unlisted: node("b_unlisted", "root"),
        elsewhere: node("elsewhere", "a"), // listed by root, but its parent is a
      },
    })]);
    const underRoot = edgesOf(records).filter((e) => e.source === "root").sort((x, y) => (x.ord < y.ord ? -1 : 1));
    expect(underRoot.map((e) => e.target)).toEqual(["c", "a", "b_unlisted", "z_unlisted"]);
    const ords = underRoot.map((e) => e.ord);
    expect(new Set(ords).size).toBe(ords.length);
    for (const ord of ords) expect(isOrderKey(ord)).toBe(true);
    expect(edgesOf(records).filter((e) => e.source === "a").map((e) => e.target)).toEqual(["elsewhere"]);
    expect(edgesOf(records)).toHaveLength(5);
    expect(edgesOf(records).every((e) => e.id === `c_${sha("m1", "edge", e.target)}`)).toBe(true);
    expect(checkInvariants(records)).toEqual([]);
  });

  it("keeps order for many siblings", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `k${String(199 - i).padStart(3, "0")}`);
    const nodes: Loose = { root: node("root", null, ids) };
    for (const id of ids) nodes[id] = node(id, "root");
    const records = convert([row("m1", { rootId: "root", nodes })]);
    const sorted = edgesOf(records).sort((x, y) => (x.ord < y.ord ? -1 : x.ord > y.ord ? 1 : 0));
    expect(sorted.map((e) => e.target)).toEqual(ids);
    expect(new Set(sorted.map((e) => e.ord)).size).toBe(200);
  });

  it("maps GraphLink fields, drops auto ports, and puts unknown fields in extra", () => {
    const records = convert([row("m1", {
      rootId: "root",
      nodes: { root: node("root", null, ["a"]), a: node("a", "root") },
      links: {
        l1: {
          id: "l1", sourceNodeId: "root", targetNodeId: "a", relationType: "detail", label: "", direction: "forward",
          style: "dashed", color: "#f00", sourcePort: "auto", targetPort: "left", attributes: { w: "1", gone: null },
          weight: 3, meta: { a: 1 },
        },
        l2: { id: "l2", sourceNodeId: "a", targetNodeId: "l1", sourcePort: "top", targetPort: "auto", attributes: {} },
      },
    })]);
    expect(linksOf(records)).toEqual(expect.arrayContaining([
      {
        kind: "connection", id: "l1", mapId: "m1", type: "graphlink", source: "root", target: "a", relationType: "detail",
        label: "", attributes: { w: "1" }, direction: "forward", style: "dashed", color: "#f00", targetPort: "left",
        extra: { weight: 3, meta: { a: 1 } }, rev: 0,
      },
      { kind: "connection", id: "l2", mapId: "m1", type: "graphlink", source: "a", target: "l1", sourcePort: "top", rev: 0 },
    ]));
    expect(checkInvariants(records)).toEqual([]);
  });
});

describe("toSnapshot: scope, linear text, surface, annotation, map (3.4)", () => {
  const state = (): Loose => ({
    rootId: "root",
    selectedId: "leaf",
    scopeId: "scope:root",
    savedAt: "2026-01-01T00:00:00.000Z",
    futureField: { keep: true },
    linearTextFontScale: 1.25,
    linearPanelWidth: 420,
    nodes: {
      root: node("root", null, ["f1", "f2", "leaf"]),
      f1: node("f1", "root", ["inner"], { nodeType: "folder" }),
      f2: node("f2", "root", [], { nodeType: "folder" }),
      leaf: node("leaf", "root"),
      inner: node("inner", "f1"),
    },
    scopes: {
      "scope:root": { id: "scope:root", label: "Root", rootNodeIds: ["root"], relationIds: ["r"], primarySurfaceId: "sf_root" },
      "scope:f1": { id: "scope:f1", label: "F1", rootNodeIds: ["f1"], relationIds: [] },
      "scope:leaf": { id: "scope:leaf", label: "Leaf", rootNodeIds: ["leaf"], relationIds: [], primarySurfaceId: "sf_leaf" },
      "scope:ghost": { id: "scope:ghost", label: "Ghost", rootNodeIds: ["ghost"], relationIds: [], primarySurfaceId: "sf_ghost" },
    },
    surfaces: {
      sf_root: {
        id: "sf_root", scopeId: "scope:root", kind: "system", layout: "flow-lr",
        surfaceView: { direction: "right", space: "normal" },
        nodeViews: { leaf: { x: 10, y: 20 }, f1: { flowCol: 1, flowRow: 2, shape: "diamond" }, inner: {}, ghost: { x: 1 }, f2: { x: null } },
      },
      sf_f1: { id: "sf_f1", scopeId: "scope:f1", kind: "tree", layout: "tree", nodeViews: {} },
      sf_leaf: { id: "sf_leaf", scopeId: "scope:leaf", kind: "tree", layout: "tree", nodeViews: { leaf: { x: 1, y: 1 } } },
      sf_ghost: { id: "sf_ghost", scopeId: "scope:ghost", kind: "tree", layout: "tree", nodeViews: { root: { x: 1, y: 1 } } },
    },
    linearNotesByScope: {
      f1: "by scope root",
      "scope:root": "scope prefixed",
      leaf: "non-scope node",
      "scope:inner": "prefixed non-scope node",
      ghost: "missing node",
      "scope:ghost": "prefixed missing node",
      f2: "",
    },
    annotations: {
      a_pen: { id: "a_pen", kind: "pen", scopeId: "f1", d: "M0 0", points: [{ x: 0, y: 0 }], stroke: "#000", strokeWidth: 2, opacity: 0.5, createdAt: "t" },
      a_text: { id: "a_text", kind: "text", scopeId: "scope:root", x: 1, y: 2, text: "label", fill: "#111", fontSize: 14, fontWeight: 700, variant: "date", createdAt: "t", future: 1 },
      a_lost: { id: "a_lost", kind: "text", scopeId: "leaf", x: 1, y: 2, text: "t", fill: "#111", fontSize: 14 },
      a_free: { id: "a_free", kind: "text", x: 1, y: 2, text: "t", fill: "#111", fontSize: 14 },
    },
  });
  const records = convert([row("m1", state(), { tags: '["a","b"]', archived: 0, pinned: 1, source: null, version: 1, saved_at: "2026-10-01T00:00:00.000Z" })]);
  const scopeId = (root: string) => `s_${sha("m1", "scope", root)}`;
  const surfaceId = (old: string) => `v_${sha("m1", "surface", old)}`;

  it("creates a scope for the map root and each folder, and drops label / rootNodeIds / relationIds", () => {
    expect(ofKind<ScopeRecord>(records, "scope")).toEqual(expect.arrayContaining([
      { kind: "scope", id: scopeId("root"), mapId: "m1", rootNodeId: "root", primarySurfaceId: surfaceId("sf_root"), rev: 0 },
      { kind: "scope", id: scopeId("f1"), mapId: "m1", rootNodeId: "f1", rev: 0 },
      { kind: "scope", id: scopeId("f2"), mapId: "m1", rootNodeId: "f2", rev: 0 },
    ]));
    expect(ofKind<ScopeRecord>(records, "scope")).toHaveLength(3);
  });

  it("drops surfaces and node views of scopes whose root is missing or is not a scope", () => {
    expect(ofKind<SurfaceRecord>(records, "surface")).toEqual(expect.arrayContaining([
      {
        kind: "surface", id: surfaceId("sf_root"), mapId: "m1", scopeId: scopeId("root"), surfaceKind: "system",
        layout: "flow-lr", surfaceView: { direction: "right", space: "normal" }, rev: 0,
      },
      { kind: "surface", id: surfaceId("sf_f1"), mapId: "m1", scopeId: scopeId("f1"), surfaceKind: "tree", layout: "tree", rev: 0 },
    ]));
    expect(ofKind<SurfaceRecord>(records, "surface")).toHaveLength(2);
    expect(idMapOf(records)).toEqual(expect.arrayContaining([
      { kind: "idMap", recordKind: "surface", mapId: "m1", oldId: "sf_root", newId: surfaceId("sf_root") },
      { kind: "idMap", recordKind: "surface", mapId: "m1", oldId: "sf_f1", newId: surfaceId("sf_f1") },
    ]));
    expect(idMapOf(records)).toHaveLength(2);
  });

  it("keeps only node views that hold a value and whose node exists", () => {
    expect(ofKind<NodeViewRecord>(records, "nodeView")).toEqual(expect.arrayContaining([
      { kind: "nodeView", surfaceId: surfaceId("sf_root"), nodeId: "leaf", mapId: "m1", x: 10, y: 20 },
      { kind: "nodeView", surfaceId: surfaceId("sf_root"), nodeId: "f1", mapId: "m1", flowCol: 1, flowRow: 2, shape: "diamond" },
    ]));
    expect(ofKind<NodeViewRecord>(records, "nodeView")).toHaveLength(2);
    expect(ofKind<NodeViewRecord>(records, "nodeView").every((v) => !("rev" in v))).toBe(true);
  });

  it("keys linear text by scope, keeps other keys verbatim with an anchor when the node exists, skips empty text", () => {
    expect(ofKind<LinearTextRecord>(records, "linearText")).toEqual(expect.arrayContaining([
      { kind: "linearText", scopeId: scopeId("f1"), mapId: "m1", text: "by scope root", rev: 0 },
      { kind: "linearText", scopeId: scopeId("root"), mapId: "m1", text: "scope prefixed", rev: 0 },
      { kind: "linearText", mapId: "m1", orphanKey: "leaf", text: "non-scope node", anchorNodeId: "leaf", rev: 0 },
      { kind: "linearText", mapId: "m1", orphanKey: "scope:inner", text: "prefixed non-scope node", anchorNodeId: "inner", rev: 0 },
      { kind: "linearText", mapId: "m1", orphanKey: "ghost", text: "missing node", rev: 0 },
      { kind: "linearText", mapId: "m1", orphanKey: "scope:ghost", text: "prefixed missing node", rev: 0 },
    ]));
    expect(ofKind<LinearTextRecord>(records, "linearText")).toHaveLength(6);
  });

  it("copies annotation fields, rewrites scopeId, and parks an unresolved scopeId in extra", () => {
    expect(ofKind<AnnotationRecord>(records, "annotation")).toEqual(expect.arrayContaining([
      {
        kind: "annotation", id: "a_pen", mapId: "m1", scopeId: scopeId("f1"), annotationKind: "pen", d: "M0 0",
        points: [{ x: 0, y: 0 }], stroke: "#000", strokeWidth: 2, opacity: 0.5, createdAt: "t", rev: 0,
      },
      {
        kind: "annotation", id: "a_text", mapId: "m1", scopeId: scopeId("root"), annotationKind: "text", x: 1, y: 2,
        text: "label", fill: "#111", fontSize: 14, fontWeight: 700, variant: "date", createdAt: "t", extra: { future: 1 }, rev: 0,
      },
      { kind: "annotation", id: "a_lost", mapId: "m1", annotationKind: "text", x: 1, y: 2, text: "t", fill: "#111", fontSize: 14, extra: { scopeId: "leaf" }, rev: 0 },
      { kind: "annotation", id: "a_free", mapId: "m1", annotationKind: "text", x: 1, y: 2, text: "t", fill: "#111", fontSize: 14, rev: 0 },
    ]));
  });

  it("writes the map record with row columns as they are, and unknown top-level fields in extra", () => {
    expect(ofKind<MapRecord>(records, "map")).toEqual([{
      kind: "map", id: "m1", rootNodeId: "root", tags: '["a","b"]', archived: 0, pinned: 1, legacyVersion: 1,
      legacySavedAt: "2026-10-01T00:00:00.000Z", linearTextFontScale: 1.25, linearPanelWidth: 420,
      extra: { futureField: { keep: true } }, rev: 0,
    }]);
  });

  it("satisfies the invariants", () => {
    expect(checkInvariants(records)).toEqual([]);
  });

  it("rewrites references to reassigned ids in views, linear text and annotations", () => {
    const out = convert([row("m1", {
      rootId: "the root",
      nodes: {
        "the root": node("the root", null, ["a folder", "a leaf"]),
        "a folder": node("a folder", "the root", [], { nodeType: "folder" }),
        "a leaf": node("a leaf", "the root", [], { nodeType: "alias", targetNodeId: "a folder" }),
      },
      links: { l1: { id: "l1", sourceNodeId: "a leaf", targetNodeId: "a folder" } },
      scopes: { "scope:a folder": { id: "scope:a folder", label: "", rootNodeIds: ["a folder"], relationIds: [], primarySurfaceId: "s 1" } },
      surfaces: { "s 1": { id: "s 1", scopeId: "scope:a folder", kind: "tree", layout: "tree", nodeViews: { "a leaf": { x: 1 } } } },
      linearNotesByScope: { "scope:a folder": "text", "a leaf": "orphan" },
      annotations: { an: { id: "an", kind: "text", scopeId: "a folder", x: 0, y: 0, text: "", fill: "", fontSize: 1 } },
    })]);
    const id = (old: string) => `n_${sha("m1", "node", old)}`;
    const folderScope = `s_${sha("m1", "scope", id("a folder"))}`;
    const surface = `v_${sha("m1", "surface", "s 1")}`;
    expect(nodeById(out, id("a leaf")).alias).toEqual({ target: id("a folder") });
    expect(linksOf(out)[0]).toMatchObject({ source: id("a leaf"), target: id("a folder") });
    expect(ofKind<ScopeRecord>(out, "scope").find((s) => s.id === folderScope)).toEqual(
      { kind: "scope", id: folderScope, mapId: "m1", rootNodeId: id("a folder"), primarySurfaceId: surface, rev: 0 },
    );
    expect(ofKind<NodeViewRecord>(out, "nodeView")).toEqual([{ kind: "nodeView", surfaceId: surface, nodeId: id("a leaf"), mapId: "m1", x: 1 }]);
    expect(ofKind<LinearTextRecord>(out, "linearText")).toEqual(expect.arrayContaining([
      { kind: "linearText", scopeId: folderScope, mapId: "m1", text: "text", rev: 0 },
      { kind: "linearText", mapId: "m1", orphanKey: "a leaf", text: "orphan", anchorNodeId: id("a leaf"), rev: 0 },
    ]));
    expect(ofKind<AnnotationRecord>(out, "annotation")[0].scopeId).toBe(folderScope);
    expect(checkInvariants(out)).toEqual([]);
  });
});
