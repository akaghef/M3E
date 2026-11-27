import { expect, test, vi } from "vitest";
import { SaveStateTracker } from "../../src/browser/save_command";
import { initialKeys, keyBetween } from "../../src/shared/record_model/order_key";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import { diffState } from "../../src/shared/map_changes";
import { MapProjector, recordRk } from "../../src/shared/record_model/steady";

function state(count: number): any {
  const keys = initialKeys(count), nodes: any = { root: { id: "root", parentId: null, children: [], text: "root", nodeType: "text", attributes: {} } };
  for (let i = 0; i < count; i++) { const id = `n${i}`; nodes.root.children.push(id); nodes[id] = { id, parentId: "root", children: [], edgeOrder: keys[i], text: id, nodeType: "text", attributes: {} }; }
  return { rootId: "root", nodes };
}

test("building and acknowledging one keyed move visits only changed nodes and neighbours", () => {
  const work: number[] = [];
  for (const count of [50, 20000]) {
    const base = state(count), live = structuredClone(base);
    const tracker = new SaveStateTracker(base, live, { indexedEdges: true });
    const children = live.nodes.root.children;
    [children[20], children[21]] = [children[21], children[20]];
    live.nodes.n20.edgeOrder = keyBetween(live.nodes.n21.edgeOrder, live.nodes.n22.edgeOrder);
    let reads = 0;
    for (const value of [base, live]) {
      value.nodes.root.children = new Proxy(value.nodes.root.children, { get(target, key, receiver) {
        if (typeof key === "string" && /^\d+$/.test(key)) reads++;
        return Reflect.get(target, key, receiver);
      } });
      value.nodes = new Proxy(value.nodes, { ownKeys(target) { reads += Reflect.ownKeys(target).length; return Reflect.ownKeys(target); }, get(target, key, receiver) { reads++; return Reflect.get(target, key, receiver); } });
    }
    tracker.mark({ nodes: ["root", "n20"], edges: ["n20"] });
    const captured = tracker.capture();
    expect(captured.changes.filter(c => c.kind === "edge")).toHaveLength(1);
    captured.accept();
    work.push(reads);
    expect(base.nodes.root.children).toEqual(live.nodes.root.children);
  }
  console.info("R1 node/child reads (50, 20000):", work);
  expect(work[1]).toBeLessThan(200);
  expect(work[1]).toBeLessThanOrEqual(work[0] * 2);
});


function structuralState(count: number): any {
  const value = state(count), nodes = value.nodes;
  nodes.n0.children = ["leaf", "inner"];
  nodes.leaf = { ...nodes.n1, id: "leaf", parentId: "n0", edgeOrder: "a0" };
  nodes.inner = { ...nodes.n1, id: "inner", parentId: "n0", edgeOrder: "a1", nodeType: "folder", children: ["innerLeaf"] };
  nodes.innerLeaf = { ...nodes.n1, id: "innerLeaf", parentId: "inner", edgeOrder: "a0" };
  nodes.n1.nodeType = "folder";
  return value;
}

test("scopen, unscopen and composite subtree moves visit the boundary, not unrelated map nodes", async () => {
  const sizes: number[][] = [], recordSizes: number[][] = [];
  for (const count of [50, 20000]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-structural-delta-"));
    const source = structuralState(count);
    source.surfaces = { board: { id: "board", scopeId: "scope:root", kind: "scatter", nodeViews: Object.fromEntries(Array.from({ length: count }, (_, i) => [`n${i}`, { x: i }])) } };
    RecordWorkspaceStore.create(dir, toSnapshot("work-counter", [{ id: "m", state: source }]));
    const store = RecordWorkspaceStore.open(dir);
    let reads = 0, recordReads = 0;
    const counts: number[] = [], recordCounts: number[] = [];
    store.getMapRow("m"); // Open/warm is outside the measured commit.
    const internals = store as any;
    const undoInstrumentation: Array<() => void> = [];
    for (const table of [internals.all, internals.maps.get("m").records] as Map<string, unknown>[]) {
      for (const method of ["get", "values", "entries", Symbol.iterator] as const) {
        const original = (table as any)[method];
        (table as any)[method] = method === "get" ? function(key: string) { recordReads++; return original.call(table, key); }
          : function* () { for (const record of original.call(table)) { recordReads++; yield record; } };
        undoInstrumentation.push(() => { delete (table as any)[method]; });
      }
    }
    try {
      for (const [i, edit] of [
        (s: any) => { s.nodes.n0.nodeType = "folder"; },
        (s: any) => { s.nodes.n0.nodeType = "text"; delete s.scopes["scope:n0"]; },
        (s: any) => { s.nodes.root.children = s.nodes.root.children.filter((id: string) => id !== "n0"); s.nodes.n1.children.push("n0"); s.nodes.n0.parentId = "n1"; s.nodes.n0.text = "moved"; (Object.values(s.surfaces)[0] as any).nodeViews.n0.x = -1; },
        (s: any) => { s.nodes.n1.children = []; s.nodes.root.children.push("n0"); s.nodes.n0.parentId = "root"; s.nodes.leaf.attributes = { value: "updated" }; },
        (s: any) => { s.nodes.added = { ...s.nodes.leaf, id: "added", parentId: "n0", children: [], edgeOrder: "a2" }; s.nodes.n0.children.push("added"); s.nodes.n0.text = "added child"; },
        (s: any) => { s.nodes.n0.children = s.nodes.n0.children.filter((id: string) => id !== "added"); delete s.nodes.added; s.nodes.n0.text = "removed child"; },
      ].entries()) {
        const before = store.getMapRow("m").state, after = structuredClone(before); edit(after);
        const changes = diffState(before, after);
        store.readState("m", source => { source.nodes = new Proxy(source.nodes, {
          ownKeys(target) { reads += Reflect.ownKeys(target).length; return Reflect.ownKeys(target); },
          get(target, key, receiver) { reads++; return Reflect.get(target, key, receiver); },
        }); });
        reads = 0; recordReads = 0;
        const result = store.commitMapCommand("m", { commandId: `edit-${i}`, intent: "assert", actor: { kind: "human", id: "test" }, changes }, "human");
        expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
        counts.push(reads); recordCounts.push(recordReads);
      }
      sizes.push(counts); recordSizes.push(recordCounts);
    } finally { for (const undo of undoInstrumentation) undo(); await store.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  }
  console.info("R2 node reads (50, 20000):", sizes, "record reads:", recordSizes);
  for (let i = 0; i < sizes[0].length; i++) {
    expect(sizes[1][i], `operation ${i}`).toBeLessThan(500);
    expect(sizes[1][i], `operation ${i}`).toBeLessThanOrEqual(sizes[0][i] * 2);
    expect(recordSizes[1][i], `record operation ${i}`).toBeLessThan(1000);
    expect(recordSizes[1][i], `record operation ${i}`).toBeLessThanOrEqual(recordSizes[0][i] * 2);
  }
});


test("structural deltas agree with full canonical projection across scope resources and rollback", async () => {
  const source = structuralState(50);
  source.nodes.n0.nodeType = "folder";
  source.annotations = { ink: { id: "ink", kind: "text", text: "hello", scopeId: "n0" } };
  source.surfaces = { board: { id: "board", scopeId: "scope:n0", kind: "scatter", nodeViews: { leaf: { x: 1, y: 2 } } } };
  source.scopes = { "scope:n0": { primarySurfaceId: "board" } };
  source.linearNotesByScope = { n0: "scope text", "scope:n0": "second text" };
  const dirs = [0, 1].map(() => fs.mkdtempSync(path.join(os.tmpdir(), "m3e-structure-parity-")));
  const snapshot = toSnapshot("parity", [{ id: "m", state: source }]);
  Object.assign(snapshot.find(record => record.kind === "snapshot")!, { historyId: "a304d7ae-2c52-4072-bf3b-a1b958ef4d0a", epoch: 1 });
  RecordWorkspaceStore.create(dirs[0], snapshot);
  fs.cpSync(dirs[0], dirs[1], { recursive: true });
  const stores = dirs.map(dir => RecordWorkspaceStore.open(dir, { now: () => "2026-11-27T00:00:00Z" }));
  const [fast, reference] = stores;
  const records = (store: RecordWorkspaceStore) => store.records().sort((a, b) => recordRk(a).localeCompare(recordRk(b)));
  const move = (s: any, parent: string) => {
    const old = s.nodes.n0.parentId;
    s.nodes[old].children = s.nodes[old].children.filter((id: string) => id !== "n0");
    s.nodes[parent].children.push("n0"); s.nodes.n0.parentId = parent;
  };
  try {
    const edits: Array<(s: any) => void> = [
      s => { s.nodes.n0.nodeType = "text"; },
      s => { s.nodes.n0.nodeType = "folder"; },
      s => { move(s, "n1"); s.nodes.n0.text = "moved folder"; },
      s => { s.nodes.leaf.edgeOutsideScope = true; },
      s => { move(s, "root"); s.nodes.leaf.details = "details"; },
      s => { s.nodes.n0.nodeType = "text"; delete s.nodes.leaf.edgeOutsideScope; },
      s => { s.nodes.n0.nodeType = "folder"; s.surfaces = { newBoard: { id: "newBoard", scopeId: "scope:n0", kind: "scatter", nodeViews: { leaf: { x: 3 } } } }; },
      s => { move(s, "n1"); s.surfaces.newBoard.nodeViews.leaf.x = 9; },
      s => { s.nodes.n0.nodeType = "text"; delete s.surfaces.newBoard; },
      s => { s.nodes.branch = { ...s.nodes.leaf, id: "branch", parentId: "n0", children: [], nodeType: "folder", edgeOrder: "a2" }; s.nodes.n0.children.push("branch"); s.nodes.n0.text = "with branch"; },
      s => { s.nodes.n0.children = s.nodes.n0.children.filter((id: string) => id !== "branch"); delete s.nodes.branch; s.nodes.n0.text = "branch removed"; },
    ];
    for (const [i, edit] of edits.entries()) {
      const before = fast.getMapRow("m").state, after = structuredClone(before); edit(after);
      const cmd = { commandId: `parity-${i}`, intent: "assert" as const, actor: { kind: "human" as const, id: "test" }, changes: diffState(before, after) };
      expect(fast.commitMapCommand("m", cmd, "human"), `fast ${i}`).toMatchObject({ ok: true });
      const fallback = vi.spyOn(MapProjector.prototype, "prepareStructure").mockReturnValue(undefined);
      try { expect(reference.commitMapCommand("m", cmd, "human"), `reference ${i}`).toMatchObject({ ok: true }); } finally { fallback.mockRestore(); }
      expect(fast.getMapRow("m").state, `state ${i}`).toEqual(reference.getMapRow("m").state);
      expect(records(fast), `records ${i}`).toEqual(records(reference));
    }
    const before = fast.getMapRow("m").state, saved = structuredClone(records(fast));
    const cycle = structuredClone(before); move(cycle, "leaf"); cycle.nodes.n0.text = "must roll back";
    expect(fast.commitMapCommand("m", { commandId: "cycle", intent: "assert", actor: { kind: "human", id: "test" }, changes: diffState(before, cycle) }, "human")).toMatchObject({ ok: false });
    expect(fast.getMapRow("m").state).toEqual(before); expect(records(fast)).toEqual(saved);
    const pending = structuredClone(before); pending.nodes.n0.nodeType = "folder";
    const cmd = { commandId: "durability", intent: "assert" as const, actor: { kind: "human" as const, id: "test" }, changes: diffState(before, pending) };
    const fsync = vi.spyOn(fs, "fsyncSync").mockImplementationOnce(() => { throw new Error("injected fsync failure"); });
    try { expect(() => fast.commitMapCommand("m", cmd, "human")).toThrow("injected fsync failure"); } finally { fsync.mockRestore(); }
    expect(fast.getMapRow("m").state).toEqual(before); expect(records(fast)).toEqual(saved);
    expect(fast.commitMapCommand("m", cmd, "human")).toMatchObject({ ok: true });
    const fallback = vi.spyOn(MapProjector.prototype, "prepareStructure").mockReturnValue(undefined);
    try { expect(reference.commitMapCommand("m", cmd, "human")).toMatchObject({ ok: true }); } finally { fallback.mockRestore(); }
    expect(fast.getMapRow("m").state).toEqual(reference.getMapRow("m").state);
    expect(records(fast)).toEqual(records(reference));
  } finally { for (const store of stores) await store.close(); for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true }); }
});
