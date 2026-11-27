import { describe, expect, it } from "vitest";
import { fromSnapshot } from "../../src/shared/record_model/from_snapshot";
import { checkInvariants } from "../../src/shared/record_model/invariants";
import { parseSnapshot, serializeSnapshot, sortRecords } from "../../src/shared/record_model/jsonl";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import type { IdMapRecord, SnapshotRecord, SnapshotRow } from "../../src/shared/record_model/types";

const WS = "ws_roundtrip";
const NOW = "2026-11-17T00:00:00.000Z";
type Loose = Record<string, unknown>;

function node(id: string, parentId: string | null, children: string[] = [], more: Loose = {}): Loose {
  return { id, parentId, children, nodeType: "text", text: `text of ${id}`, collapsed: false, details: "", note: "", attributes: {}, link: "", ...more };
}

// Already in the shape the reverse conversion produces, so that the only allowed
// difference left is the surface id (contract section 4).
function canonicalRows(): SnapshotRow[] {
  return [
    {
      id: "map_a",
      tags: '["x"]',
      archived: 0,
      pinned: 1,
      source: "import",
      version: 1,
      saved_at: "2026-10-01T00:00:00.000Z",
      state: {
        rootId: "root",
        futureTopLevel: [1, 2],
        linearTextFontScale: 1.1,
        linearPanelWidth: 300,
        nodes: {
          root: node("root", null, ["f1", "leaf", "img"], { collapsed: true, details: "d", note: "n", link: "l" }),
          f1: node("f1", "root", ["inner", "al"], { nodeType: "folder", attributes: { k: "v", empty: "", "m3e:edge-label": "into f1" } }),
          leaf: node("leaf", "root", [], { createdAt: "2026-01-01", type: "legacy" }),
          img: node("img", "root", [], { nodeType: "image" }),
          inner: node("inner", "f1"),
          al: node("al", "f1", [], { nodeType: "alias", targetNodeId: "leaf", aliasLabel: "L", access: "write", targetSnapshotLabel: "s", isBroken: true }),
        },
        links: {
          l1: { id: "l1", sourceNodeId: "leaf", targetNodeId: "inner", relationType: "detail", label: "x", direction: "both", style: "soft", color: "#0f0", sourcePort: "left", targetPort: "bottom", attributes: { a: "1" }, future: true },
          l2: { id: "l2", sourceNodeId: "img", targetNodeId: "l1" },
        },
        annotations: {
          a1: { id: "a1", kind: "pen", scopeId: "f1", d: "M0 0", points: [{ x: 0, y: 1 }], stroke: "#000", strokeWidth: 1, opacity: 0.3, createdAt: "t" },
          a2: { id: "a2", kind: "text", scopeId: "leaf", x: 1, y: 2, text: "t", fill: "#fff", fontSize: 10, fontWeight: 600, variant: "label", custom: "c" },
        },
        scopes: {
          "scope:root": { id: "scope:root", label: "text of root", rootNodeIds: ["root"], relationIds: [], primarySurfaceId: "sf1" },
          "scope:f1": { id: "scope:f1", label: "text of f1", rootNodeIds: ["f1"], relationIds: [] },
        },
        surfaces: {
          sf1: { id: "sf1", scopeId: "scope:root", kind: "scatter", layout: "scatter", surfaceView: { direction: "left", space: "tight" }, nodeViews: { leaf: { x: 1, y: 2 }, f1: { flowCol: 0, flowRow: 3, shape: "rounded" } } },
          sf2: { id: "sf2", scopeId: "scope:f1", kind: "tree", layout: "tree" },
        },
        linearNotesByScope: { root: "root text", f1: "f1 text", leaf: "kept", "no such": "kept too" },
      },
    },
    {
      id: "map_b",
      state: { rootId: "b_root", nodes: { b_root: node("b_root", null, ["b1", "b2"]), b1: node("b1", "b_root"), b2: node("b2", "b_root") } },
    },
  ] as SnapshotRow[];
}

function withSurfaceIds(rows: SnapshotRow[], records: SnapshotRecord[]): SnapshotRow[] {
  const copy = JSON.parse(JSON.stringify(rows)) as SnapshotRow[];
  for (const row of copy) {
    const state = row.state as Loose;
    const ids = new Map(
      records
        .filter((r): r is IdMapRecord => r.kind === "idMap" && r.recordKind === "surface" && r.mapId === row.id)
        .map((r) => [r.oldId, r.newId]),
    );
    const surfaces = state.surfaces as Record<string, Loose> | undefined;
    if (surfaces) {
      state.surfaces = Object.fromEntries(Object.values(surfaces).map((s) => [ids.get(s.id as string), { ...s, id: ids.get(s.id as string) }]));
    }
    for (const scope of Object.values((state.scopes ?? {}) as Record<string, Loose>)) {
      if (scope.primarySurfaceId) scope.primarySurfaceId = ids.get(scope.primarySurfaceId as string);
    }
  }
  return copy;
}

describe("record model round trip", () => {
  it("fromSnapshot(toSnapshot(x)) equals x up to surface ids for canonical input", () => {
    const rows = canonicalRows();
    const records = toSnapshot(WS, rows, { now: NOW });
    expect(checkInvariants(records)).toEqual([]);
    const restored = fromSnapshot(records);
    expect(restored.workspaceId).toBe(WS);
    const expected = withSurfaceIds(rows, records);
    // a map without scope records in the input still gets the scope of its root
    (expected[1].state as Loose).scopes = {
      "scope:b_root": { id: "scope:b_root", label: "text of b_root", rootNodeIds: ["b_root"], relationIds: [] },
    };
    expect(restored.rows).toEqual(expected);
  });

  it("survives the JSON Lines form", () => {
    const records = toSnapshot(WS, canonicalRows(), { now: NOW });
    const text = serializeSnapshot(records);
    expect(fromSnapshot(parseSnapshot(text))).toEqual(fromSnapshot(records));
    expect(serializeSnapshot(parseSnapshot(text))).toBe(text);
  });

  it("restores the allowed differences with current defaults", () => {
    const records = toSnapshot(WS, [{
      id: "m",
      state: {
        rootId: "root",
        selectedId: "a",
        nodes: {
          root: { id: "root", parentId: null, children: ["ghost", "b"], text: "root" },
          a: { id: "a", parentId: "root", children: [], text: "a", nodeType: "leaf", scopeId: "scope:root", attributes: { gone: null } },
          b: { id: "b", parentId: "root", children: [], text: "b", nodeType: "folder", collapsed: false },
        },
        links: { l: { id: "l", sourceNodeId: "a", targetNodeId: "b", sourcePort: "auto", targetPort: "auto" } },
        linearNotesByScope: { "scope:b": "prefixed", root: "" },
      },
    }], { now: NOW });
    const state = fromSnapshot(records).rows[0].state as unknown as Loose;
    expect(state).toEqual({
      rootId: "root",
      nodes: {
        root: { id: "root", parentId: null, children: ["b", "a"], nodeType: "text", text: "root", collapsed: false, details: "", note: "", attributes: {}, link: "" },
        a: { id: "a", parentId: "root", children: [], nodeType: "text", text: "a", collapsed: false, details: "", note: "", attributes: {}, link: "" },
        b: { id: "b", parentId: "root", children: [], nodeType: "folder", text: "b", collapsed: false, details: "", note: "", attributes: {}, link: "" },
      },
      links: { l: { id: "l", sourceNodeId: "a", targetNodeId: "b" } },
      scopes: {
        "scope:b": { id: "scope:b", label: "b", rootNodeIds: ["b"], relationIds: [] },
        "scope:root": { id: "scope:root", label: "root", rootNodeIds: ["root"], relationIds: [] },
      },
      linearNotesByScope: { b: "prefixed" },
    });
  });

  it("rebuilds a tree whose ids were reassigned", () => {
    const records = toSnapshot(WS, [{
      id: "m",
      state: { rootId: "r r", nodes: { "r r": node("r r", null, ["c 2", "c 1"]), "c 1": node("c 1", "r r"), "c 2": node("c 2", "r r") } },
    }], { now: NOW });
    const idOf = new Map(records.filter((r): r is IdMapRecord => r.kind === "idMap").map((r) => [r.oldId, r.newId]));
    const state = fromSnapshot(records).rows[0].state;
    expect(state.rootId).toBe(idOf.get("r r"));
    expect(state.nodes[idOf.get("r r")!].children).toEqual([idOf.get("c 2"), idOf.get("c 1")]);
    expect(state.nodes[idOf.get("c 1")!].parentId).toBe(idOf.get("r r"));
  });

  it("converting the restored rows again gives the same records, apart from surface ids", () => {
    const first = toSnapshot(WS, canonicalRows(), { now: NOW });
    const second = toSnapshot(WS, fromSnapshot(first).rows, { now: NOW });
    const stable = (records: SnapshotRecord[]) =>
      sortRecords(records).filter((r) => !["surface", "nodeView", "idMap", "scope"].includes(r.kind));
    expect(stable(second)).toEqual(stable(first));
  });
});

describe("record model JSON Lines", () => {
  it("writes the header first, then by kind, then by key", () => {
    const text = serializeSnapshot(toSnapshot(WS, canonicalRows(), { now: NOW }));
    expect(text.endsWith("\n")).toBe(true);
    const lines = text.trimEnd().split("\n").map((line) => JSON.parse(line) as SnapshotRecord);
    expect(lines[0]).toEqual({ kind: "snapshot", format: 3, workspaceId: WS, seq: 0 });
    const kinds = lines.slice(1).map((l) => l.kind);
    expect(kinds).toEqual([...kinds].sort());
    expect(kinds).not.toContain("snapshot");
    const nodeIds = lines.filter((l) => l.kind === "node").map((l) => (l as { id: string }).id);
    expect(nodeIds).toEqual([...nodeIds].sort());
    const defs = lines.filter((l) => l.kind === "relationTypeDef").map((l) => (l as { name: string }).name);
    expect(defs).toEqual(["m3e:consist-of", "m3e:detail", "rdf:type", "rdfs:subClassOf"]);
    expect(text).not.toContain("null");
  });

  it("is independent of the order of the input records", () => {
    const records = toSnapshot(WS, canonicalRows(), { now: NOW });
    expect(serializeSnapshot([...records].reverse())).toBe(serializeSnapshot(records));
  });

  it("rejects a missing header, a bad line and a null field", () => {
    expect(() => parseSnapshot('{"kind":"node","id":"a"}\n')).toThrow(/header/);
    expect(() => parseSnapshot('{"kind":"snapshot","format":1,"workspaceId":"w","seq":0}\nnot json\n')).toThrow(/line 2/);
    expect(() => parseSnapshot('{"kind":"snapshot","format":4,"workspaceId":"w","seq":0}\n')).toThrow(/format/);
    expect(() => serializeSnapshot([{ kind: "prefix", prefix: "p", uri: "u", rev: 0 }])).toThrow(/header/);
    expect(() => serializeSnapshot([
      { kind: "snapshot", format: 1, workspaceId: "w", seq: 0 },
      { kind: "prefix", prefix: "p", uri: null as unknown as string, rev: 0 },
    ])).toThrow(/null/);
  });
});

describe("record model invariants (post-migration-spec section 9)", () => {
  const base = (): SnapshotRecord[] => [
    { kind: "snapshot", format: 1, workspaceId: WS, seq: 0 },
    { kind: "map", id: "m", rootNodeId: "root", rev: 0 },
    { kind: "node", id: "root", mapId: "m", text: "root", certainty: -1, rev: 0 },
    { kind: "node", id: "a", mapId: "m", text: "a", certainty: -1, rev: 0 },
    { kind: "node", id: "b", mapId: "m", text: "b", certainty: -1, rev: 0 },
    { kind: "connection", id: "e_a", mapId: "m", type: "edge", source: "root", target: "a", ord: "1", scopeId: "s_root", rev: 0 },
    { kind: "connection", id: "e_b", mapId: "m", type: "edge", source: "a", target: "b", ord: "1", scopeId: "s_root", rev: 0 },
    { kind: "scope", id: "s_root", mapId: "m", rootNodeId: "root", rev: 0 },
  ];
  const rules = (records: SnapshotRecord[]) => [...new Set(checkInvariants(records).map((p) => p.rule))].sort();

  it("accepts a well-formed set", () => {
    expect(checkInvariants(base())).toEqual([]);
  });

  it("1: a non-root node needs exactly one incoming edge and the root none", () => {
    expect(rules(base().filter((r) => !(r.kind === "connection" && r.id === "e_b")))).toEqual([1]);
    expect(rules([...base(), { kind: "connection", id: "e_b2", mapId: "m", type: "edge", source: "root", target: "b", ord: "2", scopeId: "s_root", rev: 0 }])).toEqual([1]);
    expect(rules([...base(), { kind: "connection", id: "e_r", mapId: "m", type: "edge", source: "b", target: "root", ord: "1", scopeId: "s_root", rev: 0 }])).toContain(1);
    expect(rules(base().map((r) => (r.kind === "map" ? { ...r, rootNodeId: "nope" } : r)))).toContain(1);
  });

  it("2: edges must not form a cycle", () => {
    const records = base().map((r) => (r.kind === "connection" && r.id === "e_a" ? { ...r, source: "b" } : r));
    const problems = checkInvariants(records);
    expect(problems.filter((p) => p.rule === 2)).toHaveLength(1);
    expect(problems.find((p) => p.rule === 2)!.message).toMatch(/cycle/);
  });

  it("3: an alias points to a non-alias node and may have children", () => {
    const alias = (id: string, target: string | undefined, more: Loose = {}): SnapshotRecord =>
      ({ kind: "node", id, mapId: "m", nodeType: "alias", text: id, alias: { ...(target ? { target } : {}), ...more }, certainty: -1, rev: 0 }) as SnapshotRecord;
    const edge = (id: string, source: string, target: string, ord = "9"): SnapshotRecord =>
      ({ kind: "connection", id, mapId: "m", type: "edge", source, target, ord, scopeId: "s_root", rev: 0 });
    expect(rules([...base(), alias("al", "a"), edge("e_al", "root", "al")])).toEqual([]);
    expect(rules([...base(), alias("al", "gone"), edge("e_al", "root", "al")])).toEqual([3]);
    expect(rules([...base(), alias("al", "gone", { broken: true }), edge("e_al", "root", "al")])).toEqual([]);
    expect(rules([...base(), alias("al", undefined), edge("e_al", "root", "al")])).toEqual([3]);
    expect(rules([...base(), alias("al", "al2"), alias("al2", "a"), edge("e_al", "root", "al", "8"), edge("e_al2", "root", "al2", "7")])).toEqual([3]);
    expect(rules([
      ...base(), alias("al", "a"), edge("e_al", "root", "al"),
      { kind: "node", id: "c", mapId: "m", text: "c", certainty: -1, rev: 0 }, edge("e_c", "al", "c"),
    ])).toEqual([]);
  });

  it("4: connection endpoints exist; a GraphLink may end on a connection", () => {
    const link = (id: string, source: string, target: string): SnapshotRecord =>
      ({ kind: "connection", id, mapId: "m", type: "graphlink", source, target, rev: 0 });
    expect(rules([...base(), link("g1", "a", "b"), link("g2", "a", "g1"), link("g3", "e_a", "b")])).toEqual([]);
    expect(rules([...base(), link("g1", "a", "gone")])).toEqual([4]);
    expect(rules([...base(), link("g1", "g1", "a")])).toEqual([4]);
    const dangling = base().map((r) => (r.kind === "connection" && r.id === "e_b" ? { ...r, source: "gone" } : r));
    // the edge also loses its place on a scope: its parent is on no scope
    expect(rules(dangling)).toEqual([4, 5]);
  });

  it("5: a scope root exists and is not an alias; one node may root several scopes (DA60)", () => {
    expect(rules([...base(), { kind: "scope", id: "s_x", mapId: "m", rootNodeId: "gone", rev: 0 }])).toEqual([5]);
    expect(rules([...base(), { kind: "scope", id: "s_2", mapId: "m", rootNodeId: "root", rev: 0 }])).toEqual([]);
    expect(rules([
      ...base().map((r) => (r.kind === "node" && r.id === "b" ? { ...r, nodeType: "alias", alias: { target: "a" } } : r)),
      { kind: "scope", id: "s_b", mapId: "m", rootNodeId: "b", rev: 0 },
    ])).toEqual([5]);
  });

  it("5a: an edge lies on a scope whose edges form one tree under its root (DA59)", () => {
    const edge = (id: string, source: string, target: string, scopeId: string | undefined, ord = "9"): SnapshotRecord =>
      ({ kind: "connection", id, mapId: "m", type: "edge", source, target, ord, ...(scopeId ? { scopeId } : {}), rev: 0 }) as SnapshotRecord;
    const node = (id: string): SnapshotRecord => ({ kind: "node", id, mapId: "m", text: id, certainty: -1, rev: 0 });
    const scope = (id: string, rootNodeId: string): SnapshotRecord => ({ kind: "scope", id, mapId: "m", rootNodeId, rev: 0 });
    // X = a opens two scopes; its child b stays on the root scope with a, c and d lie on a's scopes,
    // and e under c stays on c's scope.
    const planes = [
      ...base(), scope("s_a1", "a"), scope("s_a2", "a"),
      node("c"), node("d"), node("e"),
      edge("e_c", "a", "c", "s_a1", "a0"), edge("e_d", "a", "d", "s_a2", "a1"), edge("e_e", "c", "e", "s_a1"),
    ];
    expect(rules(planes)).toEqual([]);
    // e cannot jump to the other scope of a: its parent c is neither the root of s_a2 nor on it
    expect(rules(planes.map((r) => (r.kind === "connection" && r.id === "e_e" ? { ...r, scopeId: "s_a2" } : r)))).toEqual([5]);
    // an edge needs a scope, and an existing one
    expect(rules(planes.map((r) => (r.kind === "connection" && r.id === "e_e" ? { ...r, scopeId: undefined } : r)))).toEqual([5]);
    expect(rules(planes.map((r) => (r.kind === "connection" && r.id === "e_e" ? { ...r, scopeId: "s_gone" } : r)))).toEqual([5]);
  });

  it("6: a connection id is unique across edge and GraphLink", () => {
    expect(rules([...base(), { kind: "connection", id: "e_a", mapId: "m", type: "graphlink", source: "a", target: "b", rev: 0 }])).toEqual([6]);
  });

  it("7: details, linear text, surfaces, node views and annotations point at something that exists", () => {
    const one = (record: SnapshotRecord) => rules([...base(), record]);
    expect(one({ kind: "details", nodeId: "gone", mapId: "m", v: 1, body: "x", rev: 0 })).toEqual([7]);
    expect(one({ kind: "details", nodeId: "a", mapId: "m", v: 1, body: "x", rev: 0 })).toEqual([]);
    expect(one({ kind: "linearText", scopeId: "s_gone", mapId: "m", text: "x", rev: 0 })).toEqual([7]);
    expect(one({ kind: "linearText", mapId: "m", orphanKey: "k", text: "x", anchorNodeId: "gone", rev: 0 })).toEqual([7]);
    expect(one({ kind: "linearText", mapId: "m", orphanKey: "k", text: "x", anchorNodeId: "a", rev: 0 })).toEqual([]);
    expect(one({ kind: "surface", id: "v1", mapId: "m", scopeId: "s_gone", surfaceKind: "tree", layout: "tree", rev: 0 })).toEqual([7]);
    expect(one({ kind: "nodeView", surfaceId: "v_gone", nodeId: "a", mapId: "m", x: 1 })).toEqual([7]);
    expect(one({ kind: "annotation", id: "an", mapId: "m", scopeId: "s_gone", rev: 0 })).toEqual([7]);
    expect(one({ kind: "annotation", id: "an", mapId: "m", scopeId: "s_root", rev: 0 })).toEqual([]);
    expect(rules(base().map((r) => (r.kind === "scope" ? { ...r, primarySurfaceId: "v_gone" } : r)))).toEqual([7]);
  });

  it("0: flags duplicate keys and records of an unknown map", () => {
    expect(rules([...base(), { kind: "node", id: "a", mapId: "m", text: "again", certainty: -1, rev: 0 }])).toEqual([0]);
    expect(rules([...base(), { kind: "details", nodeId: "a", mapId: "other", v: 1, body: "x", rev: 0 }])).toEqual([0]);
  });

  it("reports what a conversion of broken input leaves behind", () => {
    const records = toSnapshot(WS, [{
      id: "m",
      state: {
        rootId: "root",
        nodes: {
          root: node("root", null, []),
          orphan: node("orphan", "nowhere"),
          x: node("x", "y"),
          y: node("y", "x"),
          al: node("al", "root", [], { nodeType: "alias", targetNodeId: "nowhere" }),
        },
        links: { l: { id: "l", sourceNodeId: "root", targetNodeId: "nowhere" } },
      },
    }], { now: NOW });
    // 5: the edges under the cycle and the orphan reach no scope root
    expect(rules(records)).toEqual([2, 3, 4, 5]);
  });
});
