// Steady-state projection of one map (src/shared/record_model/steady.ts). Synthetic data only.

import { describe, expect, it } from "vitest";
import { fromSnapshot } from "../../src/shared/record_model/from_snapshot";
import { serializeSnapshot, sortRecords } from "../../src/shared/record_model/jsonl";
import { isOrderKey } from "../../src/shared/record_model/order_key";
import { MapProjector, assignOrderKeys, isProjectedRecord, projectMap, recordRk } from "../../src/shared/record_model/steady";
import type { EdgeConnectionRecord, SnapshotRecord, SnapshotRow } from "../../src/shared/record_model/types";
import { NOW, WS, clone, node, randomEdit, richState, rng, snapshotOf, type Loose } from "./record_store_helpers";

const HEADER: SnapshotRecord = { kind: "snapshot", format: 1, workspaceId: WS, seq: 0 };

function rowsOf(): SnapshotRow[] {
  return [
    { id: "map_a", tags: '["x"]', archived: 0, pinned: 1, source: "import", version: 1, saved_at: "2026-10-01T00:00:00.000Z", state: richState() },
    { id: "map_b", state: richState("b_") },
  ];
}

function mapRecords(records: SnapshotRecord[], mapId: string): SnapshotRecord[] {
  return sortRecords(records.filter((record) => isProjectedRecord(record, mapId)));
}

function text(records: SnapshotRecord[]): string {
  return serializeSnapshot([HEADER, ...records]);
}

function stamp(records: SnapshotRecord[], rev: number): SnapshotRecord[] {
  return records.map((record) => ("rev" in record && record.rev === undefined ? { ...record, rev } : record));
}

function edges(records: SnapshotRecord[]): Map<string, EdgeConnectionRecord> {
  const out = new Map<string, EdgeConnectionRecord>();
  for (const record of records) {
    if (record.kind === "connection" && record.type === "edge") out.set(record.target, record);
  }
  return out;
}

function restoredRow(records: SnapshotRecord[], mapId: string): SnapshotRow {
  const row = fromSnapshot(records).rows.find((item) => item.id === mapId);
  if (!row) throw new Error(`no row ${mapId}`);
  return row;
}

function siblings(count: number): Loose {
  const ids = Array.from({ length: count }, (_, i) => `c${String(i).padStart(2, "0")}`);
  const nodes: Loose = { root: node("root", null, ids) };
  for (const id of ids) nodes[id] = node(id, "root");
  return { rootId: "root", nodes };
}

describe("projectMap: fixed point with the reverse conversion", () => {
  it("returns the migrated records of each map unchanged, byte for byte", () => {
    const records = snapshotOf(rowsOf());
    for (const mapId of ["map_a", "map_b"]) {
      const projected = projectMap(WS, restoredRow(records, mapId), records);
      expect(projected).toEqual(mapRecords(records, mapId));
      expect(text(projected)).toBe(text(mapRecords(records, mapId)));
    }
  });

  it("is a fixed point again after an edit: project, restore, project", () => {
    const records = snapshotOf(rowsOf());
    const row = restoredRow(records, "map_a");
    const state = clone(row.state) as unknown as Loose;
    const nodes = state.nodes as Record<string, Loose>;
    nodes.leaf.text = "edited";
    nodes.added = node("added", "f1", [], { details: "new details" });
    (nodes.f1.children as string[]).unshift("added");
    const first = stamp(projectMap(WS, { ...row, state }, records), 7);
    const second = projectMap(WS, restoredRow(first, "map_a"), first);
    expect(text(second)).toBe(text(first));
  });

  it("restores a state in the reverse conversion's shape as it was", () => {
    const state = richState();
    const records = stamp(projectMap(WS, { id: "map_a", state }, []), 1);
    expect(fromSnapshot(records).rows[0].state).toEqual(state);
  });

  it("gives the records of the migration when there is nothing previous and no surface", () => {
    const state = richState();
    delete state.surfaces;
    delete ((state.scopes as Loose)["scope:root"] as Loose).primarySurfaceId;
    const row: SnapshotRow = { id: "map_a", tags: "t", version: 3, saved_at: NOW, state };
    const migrated = mapRecords(snapshotOf([row]), "map_a");
    expect(text(stamp(projectMap(WS, row, []), 0))).toBe(text(migrated));
  });

  it("keeps surface ids as the state has them and never emits idMap or seeded records", () => {
    const records = projectMap(WS, { id: "map_a", state: richState() }, []);
    expect(records.filter((record) => record.kind === "surface").map((record) => (record as { id: string }).id)).toEqual(["sf1", "sf2"]);
    expect(new Set(records.map((record) => record.kind))).toEqual(
      new Set(["map", "node", "details", "connection", "scope", "surface", "nodeView", "linearText", "annotation"]),
    );
  });
});

describe("projectMap: rev", () => {
  it("copies rev for unchanged records and leaves it undefined for changed and new ones", () => {
    const records = stamp(projectMap(WS, { id: "m", state: richState() }, []), 4);
    const state = richState();
    const nodes = state.nodes as Record<string, Loose>;
    nodes.leaf.text = "changed";
    nodes.inner.details = "now has details";
    const next = projectMap(WS, { id: "m", state }, records);
    const changed = next.filter((record) => "rev" in record && record.rev === undefined).map(recordRk);
    expect(changed.sort()).toEqual(["details|inner", "node|leaf"]);
    for (const record of next) {
      if ("rev" in record && record.rev !== undefined) expect(record.rev).toBe(4);
    }
  });

  it("marks the surface as changed when one of its node views changes", () => {
    const records = stamp(projectMap(WS, { id: "m", state: richState() }, []), 4);
    const state = richState();
    (((state.surfaces as Loose).sf1 as Loose).nodeViews as Record<string, Loose>).leaf.x = 99;
    const next = projectMap(WS, { id: "m", state }, records);
    const changed = next.filter((record) => record.kind !== "nodeView" && (record as { rev?: number }).rev === undefined).map(recordRk);
    expect(changed).toEqual(["surface|sf1"]);
    expect(next.find((record) => recordRk(record) === "nodeView|sf1leaf")).toMatchObject({ x: 99, y: 2 });
  });
});

describe("projectMap: sibling order keys", () => {
  it("rewrites exactly one key when one child moves", () => {
    const before = stamp(projectMap(WS, { id: "m", state: siblings(10) }, []), 1);
    for (const [from, to] of [[0, 9], [9, 0], [3, 4], [7, 2], [2, 7]]) {
      const state = siblings(10);
      const children = ((state.nodes as Record<string, Loose>).root.children as string[]);
      const [moved] = children.splice(from, 1);
      children.splice(to, 0, moved);
      const after = projectMap(WS, { id: "m", state }, before);
      const old = edges(before);
      const now = edges(after);
      const rewritten = [...now.values()].filter((edge) => edge.ord !== old.get(edge.target)!.ord);
      expect(rewritten.map((edge) => edge.target)).toHaveLength(1);
      expect(after.filter((record) => (record as { rev?: number }).rev === undefined && "rev" in record)).toHaveLength(1);
      const inOrder = children.map((id) => now.get(id)!.ord);
      expect([...inOrder].sort()).toEqual(inOrder);
      expect(new Set(inOrder).size).toBe(inOrder.length);
      for (const key of inOrder) expect(isOrderKey(key)).toBe(true);
    }
  });

  it("gives a new child a key between its neighbours and leaves the others alone", () => {
    const before = stamp(projectMap(WS, { id: "m", state: siblings(5) }, []), 1);
    const state = siblings(5);
    const nodes = state.nodes as Record<string, Loose>;
    nodes.fresh = node("fresh", "root");
    (nodes.root.children as string[]).splice(2, 0, "fresh");
    const after = edges(projectMap(WS, { id: "m", state }, before));
    const old = edges(before);
    for (const [target, edge] of old) expect(after.get(target)).toBe(edge);
    expect(after.get("fresh")!.ord > old.get("c01")!.ord).toBe(true);
    expect(after.get("fresh")!.ord < old.get("c02")!.ord).toBe(true);
  });

  it("keeps the edge id and rewrites the edge when a child moves to another parent", () => {
    const state = richState();
    const before = stamp(projectMap(WS, { id: "m", state }, []), 1);
    const next = richState();
    const nodes = next.nodes as Record<string, Loose>;
    nodes.inner.parentId = "root";
    nodes.f1.children = ["al"];
    (nodes.root.children as string[]).push("inner");
    const after = projectMap(WS, { id: "m", state: next }, before);
    expect(edges(after).get("inner")).toMatchObject({ id: edges(before).get("inner")!.id, source: "root" });
    expect(after.filter((record) => "rev" in record && record.rev === undefined).map(recordRk)).toEqual([recordRk(edges(before).get("inner")!)]);
  });

  it("assignOrderKeys keeps a longest increasing run and fills the rest in between", () => {
    expect(assignOrderKeys([undefined, undefined, undefined])).toEqual(["1", "2", "3"]);
    expect(assignOrderKeys(["1", "2", "3"])).toEqual(["1", "2", "3"]);
    const moved = assignOrderKeys(["2", "3", "1", "4"]);
    expect([moved[0], moved[1], moved[3]]).toEqual(["2", "3", "4"]);
    expect(moved[2] > "3" && moved[2] < "4").toBe(true);
    const many = assignOrderKeys(["1", ...new Array(200).fill(undefined), "2"]);
    expect([...many].sort()).toEqual(many);
    expect(new Set(many).size).toBe(many.length);
    expect(Math.max(...many.map((key) => key.length))).toBeLessThan(8);
    const duplicate = assignOrderKeys(["5", "5", "0bad", "7"]);
    expect([...duplicate].sort()).toEqual(duplicate);
    expect(new Set(duplicate).size).toBe(4);
  });
});

describe("projectMap: scope records follow folder nodes", () => {
  it("creates a scope when a node becomes a folder and removes it, with what hangs on it, when it stops", () => {
    const base = stamp(projectMap(WS, { id: "m", state: richState() }, []), 1);
    const toFolder = richState();
    (toFolder.nodes as Record<string, Loose>).leaf.nodeType = "folder";
    const withScope = stamp(projectMap(WS, { id: "m", state: toFolder }, base), 2);
    const scope = withScope.find((record) => record.kind === "scope" && record.rootNodeId === "leaf") as { id: string };
    expect(scope.id).toMatch(/^s_[0-9a-f]{24}$/);
    // The linear text and the annotation that named `leaf` now belong to its scope.
    expect(withScope.find((record) => record.kind === "linearText" && record.scopeId === scope.id)).toMatchObject({ text: "kept" });
    expect(withScope.find((record) => record.kind === "annotation" && record.id === "a2")).toMatchObject({ scopeId: scope.id });
    expect(fromSnapshot(withScope).rows[0].state.nodes.leaf.nodeType).toBe("folder");

    const back = richState();
    (back.nodes as Record<string, Loose>).f1.nodeType = "text";
    const withoutF1 = projectMap(WS, { id: "m", state: back }, base);
    expect(withoutF1.some((record) => record.kind === "scope" && record.rootNodeId === "f1")).toBe(false);
    expect(withoutF1.some((record) => record.kind === "surface" && record.id === "sf2")).toBe(false);
    expect(withoutF1.find((record) => record.kind === "linearText" && record.orphanKey === "f1")).toMatchObject({ anchorNodeId: "f1" });
    expect(withoutF1.find((record) => record.kind === "annotation" && record.id === "a1")).toMatchObject({ extra: { scopeId: "f1" } });
  });

  it("gives a scope that comes back the same deterministic id", () => {
    const base = projectMap(WS, { id: "m", state: richState() }, []);
    const scopeId = (base.find((record) => record.kind === "scope" && record.rootNodeId === "f1") as { id: string }).id;
    const off = richState();
    (off.nodes as Record<string, Loose>).f1.nodeType = "text";
    const without = stamp(projectMap(WS, { id: "m", state: off }, stamp(base, 1)), 2);
    const again = projectMap(WS, { id: "m", state: richState() }, without);
    expect((again.find((record) => record.kind === "scope" && record.rootNodeId === "f1") as { id: string }).id).toBe(scopeId);
  });
});

describe("MapProjector: a remembered projection gives what a fresh one gives", () => {
  it("over random edits: same records, same delta, and the state fromSnapshot gives", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const random = rng(seed);
      const counter = { n: 0 };
      const projector = new MapProjector(WS);
      let previous = new Map<string, SnapshotRecord>();
      let state = richState();
      let rev = 0;
      for (let step = 0; step < 60; step += 1) {
        const before = sortRecords([...previous.values()]);
        const result = projector.project({ id: "m", state }, previous);
        const fresh = projectMap(WS, { id: "m", state: clone(state) }, before);
        expect(text(sortRecords([...result.records.values()]))).toBe(text(fresh));

        // The delta is exactly the difference between the two record sets.
        const expectedDelta = new Map<string, SnapshotRecord | null>();
        for (const [rk, record] of result.records) if (previous.get(rk) !== record) expectedDelta.set(rk, record);
        for (const rk of previous.keys()) if (!result.records.has(rk)) expectedDelta.set(rk, null);
        expect(new Map(result.delta)).toEqual(expectedDelta);

        rev += 1;
        for (const record of result.records.values()) {
          if ("rev" in record && record.rev === undefined) (record as { rev: number }).rev = rev;
        }
        const stored = sortRecords([...result.records.values()]);
        expect(result.state).toEqual(fromSnapshot(stored).rows[0].state);
        // What came out is a fixed point.
        expect(text(projectMap(WS, { id: "m", state: clone(result.state) }, stored))).toBe(text(stored));

        previous = result.records;
        // The next state is built on the returned one and shares its untouched objects.
        const next = { ...(result.state as unknown as Loose) };
        const nodes = { ...(next.nodes as Record<string, Loose>) };
        next.nodes = nodes;
        const draft = clone(next);
        randomEdit(draft, random, counter);
        // Keep the identity of every node the edit did not change.
        const draftNodes = draft.nodes as Record<string, Loose>;
        for (const id of Object.keys(draftNodes)) {
          if (nodes[id] !== undefined && JSON.stringify(nodes[id]) === JSON.stringify(draftNodes[id])) draftNodes[id] = nodes[id];
        }
        state = draft;
      }
    }
  });
});
