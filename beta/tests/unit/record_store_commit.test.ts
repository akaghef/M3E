// Commits through the record store (src/node/record_store). Synthetic data only. The store is Neo4j.

import { afterEach, describe, expect, it } from "vitest";
import { RecordWorkspaceStore, type CommitResult } from "../../src/node/record_store";
import { acceptEdgeOrders, applyChanges, diffState, type RecordChange } from "../../src/shared/map_changes";
import { fromSnapshot } from "../../src/shared/record_model/from_snapshot";
import { checkInvariants } from "../../src/shared/record_model/invariants";
import { serializeSnapshot } from "../../src/shared/record_model/jsonl";
import { isProjectedRecord, projectMap, recordRk } from "../../src/shared/record_model/steady";
import type { SnapshotRecord } from "../../src/shared/record_model/types";
import type { AppState } from "../../src/shared/types";
import { ISSUER, NOW, WS, clone, command, node, richState, snapshotOf, type Loose } from "./record_store_helpers";
import { createTestStore, dropTestStores, type TestStore } from "./neo4j_test_store";

const handles: TestStore[] = [];

afterEach(dropTestStores);

function seedRows() {
  return [
    { id: "map_a", tags: '["x"]', archived: 0, pinned: 1, source: "import", version: 1, saved_at: "2026-10-01T00:00:00.000Z", state: richState() },
    { id: "map_b", state: richState("b_") },
  ];
}

let clock = 0;
function tick(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 10, 17, 0, 0, clock)).toISOString();
}

async function openStore(records: SnapshotRecord[] = snapshotOf(seedRows())): Promise<RecordWorkspaceStore> {
  const handle = await createTestStore(records, { now: tick });
  handles.push(handle);
  return handle.store;
}

function reopenOf(store: RecordWorkspaceStore): Promise<RecordWorkspaceStore> {
  const handle = handles.find((item) => item.store === store);
  if (!handle) throw new Error("no test store for reopen");
  return handle.reopen();
}

function stateOf(store: RecordWorkspaceStore, mapId = "map_a"): Loose {
  return store.getMapRow(mapId).state as unknown as Loose;
}

function nodesOf(state: Loose): Record<string, Loose> {
  return state.nodes as Record<string, Loose>;
}

function ok(result: CommitResult): Extract<CommitResult, { ok: true }> {
  if (!result.ok) throw new Error(`commit failed: ${result.code} ${result.message ?? ""} ${JSON.stringify(result.conflicts)}`);
  return result;
}

/** Edits a copy of the current state, commits the difference, and checks the store against applyChanges. */
function edit(store: RecordWorkspaceStore, change: (state: Loose) => void, mapId = "map_a"): RecordChange[] {
  const before = stateOf(store, mapId);
  const after = clone(before);
  change(after);
  const changes = diffState(before, after);
  expect(changes.length).toBeGreaterThan(0);
  const seq = store.seq();
  const result = ok(store.commitMapCommand(mapId, command(changes), ISSUER));
  expect(result).toMatchObject({ seq: seq + 1, replayed: false });
  const applied = applyChanges(before, changes);
  expect(applied.ok).toBe(true);
  expect(stateOf(store, mapId)).toEqual((applied as { state: object }).state);
  return changes;
}

function surfaceId(state: Loose, kind: string): string {
  const found = Object.values(state.surfaces as Record<string, Loose>).find((surface) => surface.kind === kind);
  return String(found?.id);
}

function text(records: SnapshotRecord[]): string {
  return serializeSnapshot(records);
}

function recordsOfMap(store: RecordWorkspaceStore, mapId: string): SnapshotRecord[] {
  return store.records().filter((record) => isProjectedRecord(record, mapId));
}

describe("record store: every kind of change", () => {
  it("commits each RecordChange kind and reads back what applyChanges gives", async () => {
    const store = await openStore();
    const seen = new Set<string>();
    const run = (change: (state: Loose) => void): void => {
      const previous = recordsOfMap(store, "map_a");
      const before = stateOf(store);
      for (const item of edit(store, change)) seen.add(`${item.kind}:${item.op}`);
      // What the store holds is what the pure projection gives for the new state, stamped with this commit.
      const expected = projectMap(WS, { ...seedRows()[0], state: stateOf(store) }, previous)
        .map((record) => ("rev" in record && record.rev === undefined ? { ...record, rev: store.seq() } : record));
      expect(text([store.records()[0], ...recordsOfMap(store, "map_a")])).toBe(text([store.records()[0], ...expected]));
      expect(before).not.toEqual(stateOf(store));
    };

    // node fields
    run((state) => {
      const leaf = nodesOf(state).leaf;
      leaf.text = "new text";
      leaf.collapsed = true;
      leaf.details = "body";
      leaf.note = "note";
      leaf.link = "https://example.invalid/";
      leaf.type = "changed-extra";
      delete leaf.createdAt;
    });
    // new node with an attribute, in the middle of its siblings
    run((state) => {
      nodesOf(state).added = node("added", "root", [], { attributes: { "m3e:status": "open" } });
      (nodesOf(state).root.children as string[]).splice(1, 0, "added");
    });
    // parent change and order change
    run((state) => {
      const nodes = nodesOf(state);
      nodes.root.children = (nodes.root.children as string[]).filter((id) => id !== "added");
      nodes.f1.children = ["added", ...(nodes.f1.children as string[])];
      nodes.added.parentId = "f1";
    });
    run((state) => {
      nodesOf(state).root.children = [...(nodesOf(state).root.children as string[])].reverse();
    });
    // attributes: set, change, unset, and the edge label
    run((state) => {
      const attributes = nodesOf(state).f1.attributes as Loose;
      attributes.k = "v2";
      attributes.fresh = "1";
      delete attributes.empty;
      attributes["m3e:edge-label"] = "renamed edge";
    });
    run((state) => {
      (nodesOf(state).leaf.attributes as Loose)["m3e:edge-label"] = "label on leaf";
    });
    run((state) => {
      delete (nodesOf(state).f1.attributes as Loose)["m3e:edge-label"];
    });
    // graph links
    run((state) => {
      (state.links as Loose).l3 = { id: "l3", sourceNodeId: "root", targetNodeId: "leaf", relationType: "consist-of", attributes: { w: "1" } };
    });
    run((state) => {
      const l3 = (state.links as Record<string, Loose>).l3;
      l3.label = "labelled";
      l3.direction = "forward";
      (l3.attributes as Loose).w = "2";
      (l3.attributes as Loose).z = "3";
    });
    run((state) => {
      const attributes = (state.links as Record<string, Loose>).l1.attributes as Loose;
      delete attributes.a;
      attributes.b = "kept";
      delete (state.links as Loose).l3;
    });
    // linear text
    run((state) => {
      const notes = state.linearNotesByScope as Loose;
      notes.root = "root text, edited";
      notes.img = "text anchored on a node that is not a scope";
      delete notes.leaf;
    });
    // surfaces and node views
    run((state) => {
      const surfaces = state.surfaces as Record<string, Loose>;
      const scatter = surfaces[surfaceId(state, "scatter")];
      scatter.surfaceView = { direction: "right" };
      const views = scatter.nodeViews as Record<string, Loose>;
      views.leaf.x = 40;
      views.img = { x: 5, y: 6 };
      delete views.f1;
      surfaces.sf_new = { id: "sf_new", scopeId: "scope:f1", kind: "flow", layout: "flow", nodeViews: { inner: { flowCol: 1, flowRow: 2 } } };
    });
    // scope setting
    run((state) => {
      ((state.scopes as Record<string, Loose>)["scope:f1"]).primarySurfaceId = "sf_new";
      delete ((state.scopes as Record<string, Loose>)["scope:root"]).primarySurfaceId;
    });
    run((state) => {
      delete ((state.scopes as Record<string, Loose>)["scope:f1"]).primarySurfaceId;
      const surfaces = state.surfaces as Record<string, Loose>;
      delete surfaces.sf_new;
    });
    // annotations
    run((state) => {
      const annotations = state.annotations as Record<string, Loose>;
      annotations.a3 = { id: "a3", kind: "text", scopeId: "root", x: 3, y: 4, text: "hello" };
      annotations.a1.stroke = "#f00";
      delete annotations.a2;
    });
    // map fields
    run((state) => {
      state.linearPanelWidth = 480;
      delete state.futureTopLevel;
      state.anotherTopLevel = { nested: true };
    });
    // delete a node that has an attribute and details
    run((state) => {
      const nodes = nodesOf(state);
      nodes.f1.children = (nodes.f1.children as string[]).filter((id) => id !== "added");
      delete nodes.added;
    });

    for (const kind of ["node", "edge", "attribute", "graph-link", "linear-text", "scope-setting", "surface", "surface-node-view", "annotation", "map-field"]) {
      expect([...seen].some((item) => item.startsWith(`${kind}:`)), kind).toBe(true);
    }
    for (const item of ["node:create", "node:update", "node:delete", "edge:create", "edge:update", "edge:delete", "attribute:create", "attribute:update", "attribute:delete"]) {
      expect(seen.has(item), item).toBe(true);
    }
    expect(checkInvariants(store.records())).toEqual([]);
    // The other map was never touched.
    expect(store.revisionOf("map_b")).toBe("0");
    expect(stateOf(store, "map_b")).toEqual(fromSnapshot(snapshotOf(seedRows())).rows[1].state);
  });

  it("stamps rev with the commit sequence and records the commit", async () => {
    const store = await openStore();
    edit(store, (state) => { nodesOf(state).leaf.text = "one"; });
    edit(store, (state) => { nodesOf(state).inner.text = "two"; });
    const records = store.records();
    const byRk = new Map(records.map((record) => [recordRk(record), record]));
    expect(byRk.get("node|leaf")).toMatchObject({ rev: 1, text: "one" });
    expect(byRk.get("node|inner")).toMatchObject({ rev: 2, text: "two" });
    expect(byRk.get("node|img")).toMatchObject({ rev: 0 });
    expect(records[0]).toEqual({ kind: "snapshot", format: 3, workspaceId: WS, historyId: expect.any(String), epoch: 1, seq: 2 });
    expect(byRk.get("commit|2")).toMatchObject({ kind: "commit", seq: 2, issuer: ISSUER });
    expect(store.revisionOf("map_a")).toBe("2");
    expect(store.getMapRow("map_a").savedAt).toBe((byRk.get("commit|2") as { committedAt: string }).committedAt);
    expect(store.getMapRow("map_b").savedAt).toBe(NOW);
  });
});

describe("record store: retries and conflicts", () => {
  it("returns the first result for a command id seen before, and refuses the same id with other content", async () => {
    const store = await openStore();
    const before = stateOf(store);
    const after = clone(before);
    nodesOf(after).leaf.text = "once";
    const changes = diffState(before, after);
    const first = ok(store.commitMapCommand("map_a", command(changes, "edit", "same-id"), ISSUER));
    const again = store.commitMapCommand("map_a", command(clone(changes), "edit", "same-id"), ISSUER);
    expect(again).toEqual({ ok: true, savedAt: first.savedAt, seq: first.seq, replayed: true });
    expect(store.seq()).toBe(first.seq);

    const other = clone(changes);
    (other[0].after as Loose).text = "something else";
    const refused = store.commitMapCommand("map_a", command(other, "edit", "same-id"), ISSUER);
    expect(refused).toMatchObject({ ok: false, code: "SAME_ID_DIFFERENT_CONTENT", conflicts: [] });
    expect(store.seq()).toBe(first.seq);
    expect(nodesOf(stateOf(store)).leaf.text).toBe("once");
    // Command ids are unique across the workspace.
    const onB = diffState(stateOf(store, "map_b"), { ...stateOf(store, "map_b"), linearPanelWidth: 10 });
    expect(store.commitMapCommand("map_b", command(onB, "edit", "same-id"), ISSUER)).toMatchObject({ ok: false, code: "SAME_ID_DIFFERENT_CONTENT" });
  });

  it("rejects a command whose before values are stale, field by field", async () => {
    const store = await openStore();
    const base = stateOf(store);
    const mine = clone(base);
    nodesOf(mine).leaf.text = "mine";
    const theirs = clone(base);
    nodesOf(theirs).leaf.text = "theirs";
    const other = clone(base);
    nodesOf(other).leaf.collapsed = true;
    ok(store.commitMapCommand("map_a", command(diffState(base, theirs)), ISSUER));
    const conflict = store.commitMapCommand("map_a", command(diffState(base, mine)), ISSUER);
    expect(conflict).toMatchObject({ ok: false, code: "CONFLICT", conflicts: [{ kind: "node", key: ["leaf"], field: "text" }] });
    if (!conflict.ok) {
      expect(conflict.current?.state).toEqual(stateOf(store));
      expect(conflict.current?.savedAt).toBe(store.getMapRow("map_a").savedAt);
    }
    // Another field of the same node does not conflict.
    ok(store.commitMapCommand("map_a", command(diffState(base, other)), ISSUER));
    expect(nodesOf(stateOf(store)).leaf).toMatchObject({ text: "theirs", collapsed: true });
  });

  it("checks the expected revision, the map and the shape of the command", async () => {
    const store = await openStore();
    const base = stateOf(store);
    const after = clone(base);
    nodesOf(after).leaf.text = "x";
    const changes = diffState(base, after);
    expect(store.commitMapCommand("map_a", command(changes), ISSUER, "41")).toMatchObject({ ok: false, code: "CONFLICT", conflicts: [] });
    expect(store.commitMapCommand("nowhere", command(changes), ISSUER)).toEqual({ ok: false, code: "NOT_FOUND", conflicts: [], current: null });
    expect(store.commitMapCommand("map_a", { ...command(changes), intent: "" }, ISSUER)).toMatchObject({ ok: false, code: "INVALID_COMMAND" });
    expect(store.commitMapCommand("map_a", { ...command(changes), actor: { kind: "robot" as never, id: "x" } }, ISSUER)).toMatchObject({ ok: false, code: "INVALID_COMMAND" });
    expect(store.commitMapCommand("map_a", null as never, ISSUER)).toMatchObject({ ok: false, code: "INVALID_COMMAND", current: null });
    expect(store.seq()).toBe(0);
    ok(store.commitMapCommand("map_a", command(changes), ISSUER, store.revisionOf("map_a")));
    expect(store.revisionOf("map_a")).toBe("1");
  });

  it("rejects a state the app's validation or an invariant does not accept, and writes nothing", async () => {
    const store = await openStore();
    const untouched = text(store.records());
    const attempt = (change: (state: Loose) => void): CommitResult => {
      const before = stateOf(store);
      const after = clone(before);
      change(after);
      return store.commitMapCommand("map_a", command(diffState(before, after)), ISSUER);
    };
    // A node deleted while a graph link still points at it.
    expect(attempt((state) => {
      const nodes = nodesOf(state);
      nodes.f1.children = ["al"];
      delete nodes.inner;
    })).toMatchObject({ ok: false, code: "INVALID_STATE" });
    // A cycle.
    expect(attempt((state) => {
      const nodes = nodesOf(state);
      nodes.root.children = ["leaf", "img"];
      nodes.f1.parentId = "inner";
      nodes.inner.children = ["f1"];
    })).toMatchObject({ ok: false, code: "INVALID_STATE" });
    // (An id another map already uses is not refused: see record_store_fixes.test.ts.)
    expect(store.seq()).toBe(0);
    expect(text(store.records())).toBe(untouched);
    expect(await store.readJournalAfter(0)).toEqual([]);
    // The store still works after the refusals.
    edit(store, (state) => { nodesOf(state).leaf.text = "fine"; });
  });

  it("lets a map that already has validation errors be edited, but not made worse", async () => {
    const state = richState();
    // A link between a node and a link: valid as a record, an error for the app's validation.
    (state.links as Loose).l9 = { id: "l9", sourceNodeId: "img", targetNodeId: "l1" };
    const store = await openStore(snapshotOf([{ id: "map_a", state }]));
    edit(store, (next) => { nodesOf(next).leaf.text = "still editable"; });
    const before = stateOf(store);
    const worse = clone(before);
    (worse.links as Loose).l10 = { id: "l10", sourceNodeId: "img", targetNodeId: "l2" };
    expect(store.commitMapCommand("map_a", command(diffState(before, worse)), ISSUER)).toMatchObject({ ok: false, code: "INVALID_STATE" });
    const better = clone(before);
    delete (better.links as Loose).l9;
    ok(store.commitMapCommand("map_a", command(diffState(before, better)), ISSUER));
  });
});

describe("record store: journal, reopen, compaction", () => {
  function someCommits(store: RecordWorkspaceStore): void {
    edit(store, (state) => { nodesOf(state).leaf.text = "first"; });
    edit(store, (state) => {
      nodesOf(state).n1 = node("n1", "f1", [], { details: "d" });
      (nodesOf(state).f1.children as string[]).push("n1");
    });
    edit(store, (state) => { (state.linearNotesByScope as Loose).root = "third"; }, "map_a");
    edit(store, (state) => { nodesOf(state).b_leaf.text = "on b"; }, "map_b");
  }

  it("replays the journal on open to the identical record set", async () => {
    const store = await openStore();
    someCommits(store);
    const records = text(store.records());
    const stateA = stateOf(store);
    const rowB = store.getMapRow("map_b");
    const lines = (await store.readJournalAfter(0)) ?? [];
    expect(lines.map((line) => line.seq)).toEqual([1, 2, 3, 4]);
    expect(lines[1]).toMatchObject({ issuer: ISSUER, mapId: "map_a", intent: "test" });
    expect(Object.keys(lines[1])).toEqual(expect.arrayContaining(["seq", "commandId", "issuer", "committedAt", "mapId", "intent", "changes", "ops"]));
    const opNames = lines[1].ops.map((op: { op: string; rk: string }) => `${op.op} ${op.rk}`);
    expect(opNames.filter((name: string) => !name.includes(" decay|")).sort()).toEqual(
      ["put details|n1", "put node|n1", expect.stringMatching(/^put connection\|c_/)].sort(),
    );
    expect(opNames).toContain("put decay|node|n1");
    expect(opNames.some((name: string) => name.startsWith("put decay|scope|"))).toBe(true);

    const again = await reopenOf(store);
    expect(again.seq()).toBe(4);
    expect(text(again.records())).toBe(records);
    expect(stateOf(again)).toEqual(stateA);
    expect(again.getMapRow("map_b")).toEqual(rowB);
    expect(again.revisionOf("map_a")).toBe("3");
    expect(again.revisionOf("map_b")).toBe("4");
    edit(again, (state) => { nodesOf(state).leaf.text = "after reopen"; });
    expect(again.seq()).toBe(5);
  });

});

describe("record store: whole-map saves and map-level operations", () => {
  it("saves a whole state as the difference to the current one, and creates a map that is absent", async () => {
    const store = await openStore();
    const state = stateOf(store);
    nodesOf(state).leaf.text = "whole save";
    nodesOf(state).w1 = node("w1", "root");
    (nodesOf(state).root.children as string[]).push("w1");
    const expectedOrders = diffState(stateOf(store), state);
    const saved = ok(store.saveWholeMap("map_a", state as unknown as AppState, ISSUER));
    acceptEdgeOrders(state, expectedOrders);
    expect(saved).toMatchObject({ seq: 1, replayed: false });
    expect(stateOf(store)).toEqual(state);
    // Nothing changed: no commit.
    expect(store.saveWholeMap("map_a", state as unknown as AppState, ISSUER)).toMatchObject({ ok: true, seq: 1, savedAt: saved.savedAt });
    expect(store.seq()).toBe(1);

    const created = richState("c_");
    expect(store.hasMap("map_c")).toBe(false);
    ok(store.saveWholeMap("map_c", created as unknown as AppState, ISSUER, "import"));
    expect(store.hasMap("map_c")).toBe(true);
    acceptEdgeOrders(created, diffState({}, created));
    expect(stateOf(store, "map_c")).toEqual(created);
    expect(store.listMaps().map((item) => [item.id, item.nodeCount, item.rootText])).toEqual([
      ["map_a", 7, "text of root"],
      ["map_b", 6, "text of b_root"],
      ["map_c", 6, "text of c_root"],
    ]);
    expect(store.listMaps()[0]).toMatchObject({ tags: '["x"]', archived: 0, pinned: 1, source: "import" });
    expect(checkInvariants(store.records())).toEqual([]);
    // A map is not created from a state the app does not accept.
    // (A new map that reuses ids of another map: see record_store_fixes.test.ts.)
    expect(store.saveWholeMap("map_e", { rootId: "missing", nodes: {} } as unknown as AppState, ISSUER)).toMatchObject({ ok: false, code: "INVALID_STATE", current: null });
  });

  it("sets columns, renames and deletes a map; all of it survives a reopen", async () => {
    const store = await openStore();
    store.setMapColumns("map_a", { tags: ["a", "b"], pinned: null, source: undefined }, ISSUER);
    expect(store.getMapRow("map_a")).toMatchObject({ tags: ["a", "b"], archived: 0 });
    expect("pinned" in store.getMapRow("map_a")).toBe(false);
    expect("source" in store.getMapRow("map_a")).toBe(false);
    expect(store.seq()).toBe(1);
    store.setMapColumns("map_a", { tags: ["a", "b"] }, ISSUER);
    expect(store.seq()).toBe(1);

    const before = stateOf(store, "map_b");
    const after = clone(before);
    nodesOf(after).b_leaf.text = "before rename";
    const kept = command(diffState(before, after), "edit", "before-rename");
    ok(store.commitMapCommand("map_b", kept, ISSUER));
    const stateB = stateOf(store, "map_b");
    const idsBefore = recordsOfMap(store, "map_b").map((record) => recordRk(record)).filter((rk) => !rk.startsWith("map|") && !rk.startsWith("linearText|map_b"));
    store.renameMapId("map_b", "map_renamed", ISSUER);
    expect(store.hasMap("map_b")).toBe(false);
    expect(stateOf(store, "map_renamed")).toEqual(stateB);
    const renamed = recordsOfMap(store, "map_renamed");
    expect(renamed.map((record) => recordRk(record)).filter((rk) => !rk.startsWith("map|") && !rk.startsWith("linearText|map_renamed"))).toEqual(idsBefore);
    expect(store.records().some((record) => (record as { mapId?: string }).mapId === "map_b")).toBe(false);
    expect(store.commitMapCommand("map_renamed", kept, ISSUER)).toMatchObject({ ok: true, replayed: true });
    edit(store, (state) => { nodesOf(state).b_inner.text = "after rename"; }, "map_renamed");
    expect(() => store.renameMapId("map_renamed", "map_a", ISSUER)).toThrow(/exists/);
    expect(checkInvariants(store.records())).toEqual([]);

    store.deleteMap("map_a", ISSUER);
    expect(store.hasMap("map_a")).toBe(false);
    expect(store.records().some((record) => (record as { mapId?: string }).mapId === "map_a" || recordRk(record) === "map|map_a")).toBe(false);
    expect(() => store.getMapRow("map_a")).toThrow(/not found/);
    expect(() => store.deleteMap("map_a", ISSUER)).toThrow(/not found/);
    expect(checkInvariants(store.records())).toEqual([]);
    // A deleted id stays retired. Only the Undo of that delete may put the same node record back.
    expect(store.saveWholeMap("map_reuse", richState() as unknown as AppState, ISSUER)).toMatchObject({
      ok: false,
      code: "INVALID_STATE",
      message: expect.stringMatching(/deleted id cannot be reused/),
    });
    ok(store.saveWholeMap("map_new", richState("n_") as unknown as AppState, ISSUER));

    const records = text(store.records());
    const seq = store.seq();
    const again = await reopenOf(store);
    expect(again.seq()).toBe(seq);
    expect(text(again.records())).toBe(records);
    expect(again.listMaps().map((item) => item.id)).toEqual(["map_new", "map_renamed"]);
    expect(stateOf(again, "map_renamed").nodes).toMatchObject({ b_inner: { text: "after rename" } });
    expect(again.commitMapCommand("map_renamed", kept, ISSUER)).toMatchObject({ ok: true, replayed: true });
  });
});

describe("record store: scope records and subtree deletion", () => {
  it("creates and removes the scope record when nodeType changes to and from folder", async () => {
    const store = await openStore();
    const scopeRoots = (): string[] => recordsOfMap(store, "map_a")
      .filter((record) => record.kind === "scope")
      .map((record) => (record as { rootNodeId: string }).rootNodeId)
      .sort();
    expect(scopeRoots()).toEqual(["f1", "root"]);

    const before = stateOf(store);
    const after = clone(before);
    nodesOf(after).leaf.nodeType = "folder";
    ok(store.commitMapCommand("map_a", command(diffState(before, after)), ISSUER));
    expect(scopeRoots()).toEqual(["f1", "leaf", "root"]);
    const withScope = stateOf(store);
    expect(nodesOf(withScope).leaf.nodeType).toBe("folder");
    expect((withScope.scopes as Loose)["scope:leaf"]).toEqual({ id: "scope:leaf", label: "text of leaf", rootNodeIds: ["leaf"], relationIds: [] });

    const back = clone(withScope);
    nodesOf(back).f1.nodeType = "text";
    ok(store.commitMapCommand("map_a", command(diffState(withScope, back)), ISSUER));
    expect(scopeRoots()).toEqual(["leaf", "root"]);
    const withoutF1 = stateOf(store);
    expect(nodesOf(withoutF1).f1.nodeType).toBe("text");
    expect((withoutF1.scopes as Loose)["scope:f1"]).toBeUndefined();
    // The surface of the scope that is gone went with it.
    expect(Object.values(withoutF1.surfaces as Record<string, Loose>).map((surface) => surface.kind)).toEqual(["scatter"]);
    expect(checkInvariants(store.records())).toEqual([]);
  });

  it("deletes the edges, details, node views, links and scope records of a deleted subtree", async () => {
    const store = await openStore();
    edit(store, (state) => {
      const nodes = nodesOf(state);
      nodes.deep = node("deep", "inner", [], { details: "deep details", nodeType: "folder" });
      nodes.inner.children = ["deep"];
      nodes.inner.details = "inner details";
      const scatter = (state.surfaces as Record<string, Loose>)[surfaceId(state, "scatter")];
      (scatter.nodeViews as Loose).inner = { x: 7, y: 8 };
      (scatter.nodeViews as Loose).deep = { x: 9, y: 9 };
      (state.links as Loose).l4 = { id: "l4", sourceNodeId: "deep", targetNodeId: "root" };
      // A folder is a scope root; the state the store gives back says so.
      (state.scopes as Loose)["scope:deep"] = { id: "scope:deep", label: "text of deep", rootNodeIds: ["deep"], relationIds: [] };
    });
    const gone = new Set(["f1", "inner", "al", "deep"]);
    const refers = (record: SnapshotRecord): boolean => {
      const fields = record as unknown as Loose;
      return [fields.id, fields.nodeId, fields.source, fields.target, fields.rootNodeId].some((value) => typeof value === "string" && gone.has(value));
    };
    expect(recordsOfMap(store, "map_a").filter(refers).map((record) => record.kind).sort()).toEqual([
      "connection", "connection", "connection", "connection", "connection", "connection", "connection",
      "details", "details", "node", "node", "node", "node", "nodeView", "nodeView", "nodeView", "scope", "scope",
    ]);

    const before = stateOf(store);
    const after = clone(before);
    const nodes = nodesOf(after);
    for (const id of gone) delete nodes[id];
    nodes.root.children = (nodes.root.children as string[]).filter((id) => id !== "f1");
    for (const id of ["l1", "l2", "l4"]) delete (after.links as Loose)[id];
    ok(store.commitMapCommand("map_a", command(diffState(before, after), "delete subtree"), ISSUER));
    expect(recordsOfMap(store, "map_a").filter(refers)).toEqual([]);
    expect(recordsOfMap(store, "map_a").filter((record) => record.kind === "surface")).toHaveLength(1);
    expect(Object.keys(nodesOf(stateOf(store))).sort()).toEqual(["img", "leaf", "root"]);
    expect(checkInvariants(store.records())).toEqual([]);
  });
});

describe("record store: a closed store", () => {
  it("refuses to use a store after it is closed", async () => {
    const store = await openStore();
    await store.close();
    expect(() => store.getMapRow("map_a")).toThrow(/closed/);
    expect(() => store.commitMapCommand("map_a", command([]), ISSUER)).toThrow(/closed/);
  });
});
