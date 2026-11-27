// Record store: ids shared between maps, saved-at time and row columns, the map list.
// Synthetic data only. The store is Neo4j.

import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordWorkspaceStore, type CommitResult, type OpenOptions } from "../../src/node/record_store";
import { aliasId } from "../../src/node/record_store/id_alias";
import { storeDuplicateMap, storeListMaps } from "../../src/node/record_store/legacy_api";
import { acceptEdgeOrders, diffState } from "../../src/shared/map_changes";
import { sha256Hex } from "../../src/shared/record_model/hash";
import { checkInvariants } from "../../src/shared/record_model/invariants";
import { serializeSnapshot } from "../../src/shared/record_model/jsonl";
import type { SnapshotRecord } from "../../src/shared/record_model/types";
import type { AppState } from "../../src/shared/types";
import { ISSUER, WS, withOrderKeys, bigState, clone, command, node, richState, snapshotOf, type Loose } from "./record_store_helpers";
import { createTestStore, dropTestStores, type TestStore } from "./neo4j_test_store";

const handles: TestStore[] = [];

afterEach(dropTestStores);

let clock = 0;
function tick(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 10, 17, 1, 0, clock)).toISOString();
}

async function openStore(rows: Array<{ id: string; state: Loose } & Loose> = [], options: OpenOptions = {}): Promise<RecordWorkspaceStore> {
  const handle = await createTestStore(snapshotOf(rows), { now: tick, ...options });
  handles.push(handle);
  return handle.store;
}

function reopenOf(store: RecordWorkspaceStore): Promise<RecordWorkspaceStore> {
  const handle = handles.find((item) => item.store === store);
  if (!handle) throw new Error("no test store for reopen");
  return handle.reopen();
}

function stateOf(store: RecordWorkspaceStore, mapId: string): Loose {
  return store.getMapRow(mapId).state as unknown as Loose;
}

function nodesOf(state: Loose): Record<string, Loose> {
  return state.nodes as Record<string, Loose>;
}

function ok(result: CommitResult): Extract<CommitResult, { ok: true }> {
  if (!result.ok) throw new Error(`commit failed: ${result.code} ${result.message ?? ""} ${JSON.stringify(result.conflicts)}`);
  return result;
}

function save(store: RecordWorkspaceStore, mapId: string, state: Loose): Extract<CommitResult, { ok: true }> {
  const changes = diffState(store.hasMap(mapId) ? stateOf(store, mapId) : {}, state);
  const result = ok(store.saveWholeMap(mapId, state as unknown as AppState, ISSUER));
  acceptEdgeOrders(state, changes);
  return result;
}

function recordsOfMap(store: RecordWorkspaceStore, mapId: string): SnapshotRecord[] {
  return store.records().filter((record) => (record.kind === "map" ? record.id : (record as { mapId?: string }).mapId) === mapId);
}

function text(records: SnapshotRecord[]): string {
  return serializeSnapshot(records);
}

/** Commits the difference between the map's state and an edited copy as a Command; the state must then be the copy. */
function edit(store: RecordWorkspaceStore, mapId: string, change: (state: Loose) => void): void {
  const before = stateOf(store, mapId);
  const after = clone(before);
  change(after);
  const changes = diffState(before, after);
  ok(store.commitMapCommand(mapId, command(changes), ISSUER));
  acceptEdgeOrders(after, changes);
  expect(stateOf(store, mapId)).toEqual(after);
}

/** The state the e2e spec seeds every map with. */
function feelState(): Loose {
  return withOrderKeys({
    rootId: "root",
    nodes: {
      root: node("root", null, ["A", "B", "C"], { text: "Feel Root" }),
      A: node("A", "root", ["a1", "a2"], { text: "Alpha" }),
      a1: node("a1", "A", [], { text: "Alpha one" }),
      a2: node("a2", "A", [], { text: "Alpha two" }),
      B: node("B", "root", [], { text: "Bravo" }),
      C: node("C", "root", [], { text: "Charlie" }),
    },
  });
}

describe("record store: a map whose ids another map already uses", () => {
  it("creates the second map, renumbers only the colliding ids as the migration does, and answers with the ids the client sent", async () => {
    const store = await openStore();
    save(store, "first", feelState());
    const second = feelState();
    nodesOf(second).only_here = node("only_here", "root", [], { text: "Only here" });
    (nodesOf(second).root.children as string[]).push("only_here");
    save(store, "second", second);

    // Both maps read back exactly as they were sent.
    expect(nodesOf(stateOf(store, "first"))).toEqual(feelState().nodes);
    expect(stateOf(store, "second").rootId).toBe("root");
    expect(nodesOf(stateOf(store, "second"))).toEqual(second.nodes);

    // The first map keeps its ids. In the second, every colliding id has the migration's id; the other stays.
    const stored = (mapId: string): string[] => recordsOfMap(store, mapId).filter((record) => record.kind === "node").map((record) => (record as { id: string }).id).sort();
    expect(stored("first")).toEqual(["A", "B", "C", "a1", "a2", "root"]);
    const renumbered = (id: string): string => `n_${sha256Hex(`${WS}|second|node|${id}`).slice(0, 24)}`;
    expect(aliasId(WS, "second", "node", "A")).toBe(renumbered("A"));
    expect(stored("second")).toEqual(["only_here", ...["A", "B", "C", "a1", "a2", "root"].map(renumbered)].sort());
    const idMaps = recordsOfMap(store, "second").filter((record) => record.kind === "idMap");
    expect(idMaps.map((record) => record.kind === "idMap" && [record.recordKind, record.oldId, record.newId, record.alias])).toEqual(
      ["A", "B", "C", "a1", "a2", "root"].map((id) => ["node", id, renumbered(id), true]),
    );
    const map = recordsOfMap(store, "second").find((record) => record.kind === "map") as { rootNodeId: string };
    expect(map.rootNodeId).toBe(renumbered("root"));
    expect(checkInvariants(store.records())).toEqual([]);
  });

  it("is deterministic: the same saves give the same records in another store", async () => {
    const build = async (): Promise<string> => {
      const store = await openStore([], { now: () => "2026-11-17T02:00:00.000Z" });
      save(store, "first", richState());
      save(store, "second", richState());
      // The history id of a store is random; everything else must be the same.
      return text(store.records()).replace(/"commandId":"save:[^"]*"/g, "").replace(/"historyId":"[^"]*"/, "");
    };
    expect(await build()).toBe(await build());
  });

  it("remaps every reference inside the state: tree, alias target, GraphLink ends, scopes, surfaces, node views, linear text, annotations", async () => {
    const store = await openStore();
    save(store, "first", richState());
    const sent = richState();
    save(store, "second", sent);
    // What comes back is what was sent, id for id.
    expect(stateOf(store, "second")).toEqual(sent);
    expect(stateOf(store, "first")).toEqual(richState());

    // Nothing stored for the second map names an id of the first.
    const firstIds = new Set(["root", "f1", "leaf", "img", "inner", "al", "l1", "l2", "a1", "a2", "sf1", "sf2"]);
    const idFields = ["id", "nodeId", "source", "target", "rootNodeId", "surfaceId", "primarySurfaceId"];
    for (const record of recordsOfMap(store, "second")) {
      if (record.kind === "idMap" || record.kind === "map") continue;
      for (const field of idFields) {
        const value = (record as unknown as Loose)[field];
        if (typeof value === "string") expect(firstIds.has(value), `${record.kind}.${field} = ${value}`).toBe(false);
      }
      if (record.kind === "node" && record.alias?.target !== undefined) expect(firstIds.has(record.alias.target)).toBe(false);
    }
    const kinds = recordsOfMap(store, "second").filter((record) => record.kind === "idMap").map((record) => record.kind === "idMap" && record.recordKind);
    expect(new Set(kinds)).toEqual(new Set(["node", "graphlink", "annotation", "surface"]));
    const surface = recordsOfMap(store, "second").find((record) => record.kind === "surface") as { id: string };
    expect(surface.id.startsWith("v_")).toBe(true);
    expect(checkInvariants(store.records())).toEqual([]);
  });

  it("keeps taking whole-map saves and Commands that use the original ids, and reports conflicts in them", async () => {
    const store = await openStore();
    save(store, "first", richState());
    save(store, "second", richState());
    const seqAfterCreate = store.seq();

    // A whole-map save with the ids the client knows: only the edit is committed.
    const whole = stateOf(store, "second");
    nodesOf(whole).leaf.text = "edited by a whole-map save";
    save(store, "second", whole);
    expect(store.seq()).toBe(seqAfterCreate + 1);
    expect(stateOf(store, "second")).toEqual(whole);
    // The same state again: nothing to commit.
    save(store, "second", whole);
    expect(store.seq()).toBe(seqAfterCreate + 1);

    // Commands: edit, create under an aliased parent, move, GraphLink, node view, linear text, delete.
    edit(store, "second", (state) => { nodesOf(state).inner.text = "edited by a command"; });
    edit(store, "second", (state) => {
      nodesOf(state).fresh = node("fresh", "f1");
      (nodesOf(state).f1.children as string[]).push("fresh");
    });
    edit(store, "second", (state) => {
      const nodes = nodesOf(state);
      nodes.root.children = ["f1", "img"];
      nodes.inner.children = ["leaf"];
      nodes.leaf.parentId = "inner";
    });
    edit(store, "second", (state) => {
      (state.links as Loose).l3 = { id: "l3", sourceNodeId: "fresh", targetNodeId: "root", label: "new link" };
    });
    edit(store, "second", (state) => {
      const surface = (state.surfaces as Record<string, Loose>).sf1;
      surface.nodeViews = { ...(surface.nodeViews as Loose), img: { x: 5, y: 6 } };
    });
    edit(store, "second", (state) => { (state.linearNotesByScope as Loose).f1 = "f1 text, edited"; });
    edit(store, "second", (state) => {
      const nodes = nodesOf(state);
      nodes.f1.children = (nodes.f1.children as string[]).filter((id) => id !== "al");
      delete nodes.al;
    });
    // The first map saw none of it.
    expect(stateOf(store, "first")).toEqual(richState());
    expect(checkInvariants(store.records())).toEqual([]);

    // A stale Command is refused with the client's ids in the conflict and in the current state.
    const now = stateOf(store, "second");
    const stale = clone(now);
    nodesOf(stale).inner.text = "an older text";
    const wanted = clone(stale);
    nodesOf(wanted).inner.text = "from a stale tab";
    const refused = store.commitMapCommand("second", command(diffState(stale, wanted)), ISSUER);
    expect(refused).toMatchObject({ ok: false, code: "CONFLICT", conflicts: [{ kind: "node", key: ["inner"], field: "text" }] });
    expect(!refused.ok && refused.current?.state).toEqual(now);
  });

  it("gives a stored id to an id a later Command or save brings in, when another map holds it", async () => {
    const store = await openStore();
    save(store, "first", feelState());
    const other = { rootId: "o_root", nodes: { o_root: node("o_root", null, [], { text: "Other" }) } };
    save(store, "other", other);
    expect(recordsOfMap(store, "other").filter((record) => record.kind === "idMap")).toEqual([]);

    // A Command creates node "A" (held by the first map) and an annotation named like its own node.
    edit(store, "other", (state) => {
      nodesOf(state).A = node("A", "o_root", [], { text: "A of the other map" });
      (nodesOf(state).o_root.children as string[]).push("A");
    });
    edit(store, "other", (state) => {
      state.annotations = { o_root: { id: "o_root", kind: "text", x: 0, y: 0, text: "t" } };
    });
    // A whole-map save brings in "B".
    const whole = stateOf(store, "other");
    nodesOf(whole).B = node("B", "A", [], { text: "B of the other map" });
    (nodesOf(whole).A.children as string[]).push("B");
    save(store, "other", whole);
    expect(stateOf(store, "other")).toEqual(whole);

    const maps = recordsOfMap(store, "other").filter((record) => record.kind === "idMap").map((record) => record.kind === "idMap" && `${record.recordKind}:${record.oldId}`);
    expect(maps.sort()).toEqual(["annotation:o_root", "node:A", "node:B"]);
    expect(nodesOf(stateOf(store, "first")).A.text).toBe("Alpha");
    expect(checkInvariants(store.records())).toEqual([]);
  });

  it("answers a repeated Command as the first time and gives the committed Command back with the ids it was sent with", async () => {
    const store = await openStore();
    save(store, "first", feelState());
    save(store, "second", feelState());
    const before = stateOf(store, "second");
    const after = clone(before);
    nodesOf(after).B.text = "Bravo renamed";
    const sent = command(diffState(before, after), "edit-text", "alias-replay-1");
    const first = ok(store.commitMapCommand("second", sent, ISSUER));
    expect(store.commitMapCommand("second", sent, ISSUER)).toEqual({ ...first, replayed: true });
    expect((await store.readCommittedCommand("second", "alias-replay-1"))?.changes).toEqual(sent.changes);
    const other = clone(after);
    nodesOf(other).B.text = "something else";
    expect(store.commitMapCommand("second", { ...sent, changes: diffState(before, other) }, ISSUER)).toMatchObject({ ok: false, code: "SAME_ID_DIFFERENT_CONTENT" });
  });

  it("keeps the ids after the store is opened again and after the map id changes", async () => {
    const store = await openStore();
    save(store, "first", richState());
    save(store, "second", richState());
    edit(store, "second", (state) => { nodesOf(state).leaf.text = "before reopen"; });
    const expected = stateOf(store, "second");

    const again = await reopenOf(store);
    expect(stateOf(again, "second")).toEqual(expected);
    edit(again, "second", (state) => { nodesOf(state).leaf.text = "after reopen"; });
    again.renameMapId("second", "third", ISSUER);
    const renamed = stateOf(again, "third");

    const third = await reopenOf(again);
    expect(stateOf(third, "third")).toEqual(renamed);
    edit(third, "third", (state) => { nodesOf(state).inner.text = "after reopen and rename"; });
    expect(stateOf(third, "first")).toEqual(richState());
    // A new map under the old map id: its ids would get the stored ids the renamed map holds.
    save(third, "second", richState());
    expect(stateOf(third, "second")).toEqual(richState());
    expect(checkInvariants(third.records())).toEqual([]);
    third.deleteMap("third", ISSUER);
    expect(third.records().filter((record) => record.kind === "idMap" && record.mapId === "third")).toEqual([]);
  });

  it("a copy of a map has the ids of its source for the client, and ids of its own in the store", async () => {
    const store = await openStore();
    save(store, "source", richState());
    store.setMapColumns("source", { tags: '["t"]', pinned: 1 }, ISSUER);
    storeDuplicateMap(store, "source", "copy");
    expect(stateOf(store, "copy")).toEqual(stateOf(store, "source"));
    expect(store.getMapRow("copy")).toMatchObject({ tags: '["t"]' });
    expect("pinned" in store.getMapRow("copy")).toBe(false);
    const ids = (mapId: string): string[] => recordsOfMap(store, mapId).filter((record) => record.kind === "node").map((record) => (record as { id: string }).id);
    expect(ids("copy").filter((id) => ids("source").includes(id))).toEqual([]);
    // The two maps are edited apart.
    edit(store, "copy", (state) => { nodesOf(state).leaf.text = "only in the copy"; });
    expect(nodesOf(stateOf(store, "source")).leaf.text).toBe("text of leaf");
    expect(checkInvariants(store.records())).toEqual([]);
  });

  it("leaves a map without colliding ids exactly as before: no idMap record, the changes in the journal as they were sent", async () => {
    const store = await openStore();
    save(store, "first", richState());
    save(store, "second", richState("s_"));
    expect(store.records().filter((record) => record.kind === "idMap")).toEqual([]);
    expect(stateOf(store, "second")).toEqual(richState("s_"));
  });
});

describe("record store: ids the migration renumbered", () => {
  it("are not treated as aliases: the client keeps seeing the stored ids, and the migration's idMap records stay", async () => {
    // Two rows with the same ids: the migration renumbers the ids of the second map.
    const store = await openStore([{ id: "m1", state: feelState() }, { id: "m2", state: feelState() }]);
    const migrated = store.records().filter((record) => record.kind === "idMap");
    expect(migrated.length).toBe(6);
    expect(migrated.every((record) => record.kind === "idMap" && record.alias === undefined && record.mapId === "m2")).toBe(true);
    const renumbered = `n_${sha256Hex(`${WS}|m2|node|B`).slice(0, 24)}`;
    expect(Object.keys(nodesOf(stateOf(store, "m2")))).toContain(renumbered);
    expect(nodesOf(stateOf(store, "m2")).B).toBeUndefined();
    // Edits with the stored ids work as before.
    edit(store, "m2", (state) => { nodesOf(state)[renumbered].text = "Bravo of m2"; });

    // The old id again, in a Command: the migration's record is not replaced, the collision is refused.
    const before = stateOf(store, "m2");
    const after = clone(before);
    const rootId = after.rootId as string;
    nodesOf(after).B = node("B", rootId, [], { text: "B again" });
    (nodesOf(after)[rootId].children as string[]).push("B");
    expect(store.commitMapCommand("m2", command(diffState(before, after)), ISSUER)).toMatchObject({ ok: false, code: "INVALID_STATE" });
    expect(store.saveWholeMap("m2", after as unknown as AppState, ISSUER)).toMatchObject({ ok: false, code: "INVALID_STATE" });
    expect(store.records().filter((record) => record.kind === "idMap")).toEqual(migrated);
    // An id the migration did not touch gets an alias like in any other map.
    edit(store, "m1", (state) => {
      nodesOf(state)[renumbered] = node(renumbered, "root", [], { text: "named like a stored id of m2" });
      (nodesOf(state).root.children as string[]).push(renumbered);
    });
    expect(nodesOf(stateOf(store, "m2"))[renumbered].text).toBe("Bravo of m2");
    expect(checkInvariants(store.records())).toEqual([]);
  });
});

describe("record store: row columns and the saved-at time", () => {
  it("a column change gets a commit of its own but leaves the saved-at time and the revision of the map", async () => {
    const store = await openStore();
    const created = save(store, "m", feelState());
    const savedAt = store.getMapRow("m").savedAt;
    const revision = store.revisionOf("m");
    expect(savedAt).toBe(created.savedAt);

    store.setMapColumns("m", { tags: '["a"]' }, ISSUER);
    store.setMapColumns("m", { archived: 1 }, ISSUER);
    store.setMapColumns("m", { pinned: 1 }, ISSUER);
    store.setMapColumns("m", { source: '{"kind":"obsidian","path":"/x"}' }, ISSUER);
    // Four commits, four journal lines.
    expect(store.seq()).toBe(created.seq + 4);
    const lines = (await store.readJournalAfter(0)) ?? [];
    expect(lines.slice(-4).map((line) => [line.seq, line.intent, line.mapOp])).toEqual([2, 3, 4, 5].map((seq) => [seq, "set-map-columns", "columns"]));
    expect(store.getMapRow("m")).toMatchObject({ tags: '["a"]', archived: 1, pinned: 1 });
    // The content did not change: same saved-at time, same revision.
    expect(store.getMapRow("m").savedAt).toBe(savedAt);
    expect(store.revisionOf("m")).toBe(revision);
    expect(store.listMaps()[0].savedAt).toBe(savedAt);
    // A Command built on the revision read before the column changes is still current.
    const before = stateOf(store, "m");
    const after = clone(before);
    nodesOf(after).B.text = "Bravo after columns";
    const committed = ok(store.commitMapCommand("m", command(diffState(before, after)), ISSUER, revision));
    expect(store.getMapRow("m").savedAt).toBe(committed.savedAt);
    expect(store.revisionOf("m")).not.toBe(revision);
    const contentSavedAt = committed.savedAt;
    store.setMapColumns("m", { pinned: 0 }, ISSUER);

    // The same after the journal is read again.
    const again = await reopenOf(store);
    expect(again.getMapRow("m").savedAt).toBe(contentSavedAt);
    again.setMapColumns("m", { archived: 0 }, ISSUER);
    const third = await reopenOf(again);
    expect(third.getMapRow("m").savedAt).toBe(contentSavedAt);
    expect(third.getMapRow("m")).toMatchObject({ archived: 0, pinned: 0 });
  });
});

describe("record store: the map list", () => {
  it("lists label, node count and character count without copying a map state", async () => {
    const store = await openStore();
    const rich = richState();
    save(store, "rich", rich);
    save(store, "feel", feelState());
    save(store, "untitled", { rootId: "u_root", nodes: { u_root: node("u_root", null, [], { text: "   " }) } });
    store.setMapColumns("feel", { tags: '["x","y"]', pinned: 1 }, ISSUER);
    store.setMapColumns("untitled", { archived: 1 }, ISSUER);

    // What the list showed before, computed from the states.
    const expected = (mapId: string): { nodeCount: number; charCount: number } => {
      const nodes = Object.values(nodesOf(stateOf(store, mapId)));
      const length = (value: unknown): number => (typeof value === "string" ? value.length : 0);
      return { nodeCount: nodes.length, charCount: nodes.reduce((sum, item) => sum + length(item.text) + length(item.details) + length(item.note), 0) };
    };
    const want = { rich: expected("rich"), feel: expected("feel"), untitled: expected("untitled") };
    expect(want.rich.charCount).toBeGreaterThan(0);

    const copied = vi.spyOn(store, "getMapRow");
    const list = storeListMaps(store, true);
    expect(copied).not.toHaveBeenCalled();
    const byId = new Map(list.map((item) => [item.id, item]));
    expect(byId.get("rich")).toMatchObject({ label: "text of root", ...want.rich, tags: [], archived: false, pinned: false });
    expect(byId.get("feel")).toMatchObject({ label: "Feel Root", ...want.feel, tags: ["x", "y"], pinned: true });
    expect(byId.get("untitled")).toMatchObject({ label: "Untitled", ...want.untitled, archived: true });
    expect(storeListMaps(store, false).map((item) => item.id).sort()).toEqual(["feel", "rich"]);
    // Newest saved first; the column changes did not reorder anything.
    expect(list.map((item) => item.id)).toEqual(["untitled", "feel", "rich"]);

    // The counts follow a commit.
    edit(store, "feel", (state) => {
      nodesOf(state).B.text = "Bravo, longer";
      nodesOf(state).B.details = "with details";
      nodesOf(state).D = node("D", "root", [], { text: "Delta", note: "a note" });
      (nodesOf(state).root.children as string[]).push("D");
    });
    copied.mockClear();
    const feel = storeListMaps(store, true).find((item) => item.id === "feel");
    expect(copied).not.toHaveBeenCalled();
    copied.mockRestore();
    expect(feel).toMatchObject(expected("feel"));
    expect(feel?.nodeCount).toBe(7);
  });

  it("does not grow with the size of the maps (20,000 nodes and 40 small maps)", { timeout: 180000 }, async () => {
    const store = await openStore();
    save(store, "large", bigState(200, 99, "L"));
    for (let i = 0; i < 40; i += 1) save(store, `small-${i}`, bigState(2, 3, `s${i}_`));
    const time = (run: () => void): number => {
      const begun = performance.now();
      for (let i = 0; i < 5; i += 1) run();
      return (performance.now() - begun) / 5;
    };
    // The way the list was built before: a copy of every state.
    const copying = time(() => { for (const item of store.listMaps()) store.getMapRow(item.id); });
    storeListMaps(store, true);
    const counting = time(() => { storeListMaps(store, true); });
    console.log(`map list, 1 map of 20,001 nodes + 40 small maps: ${copying.toFixed(2)} ms with a copy of every state, ${counting.toFixed(3)} ms now`);
    expect(storeListMaps(store, true).find((item) => item.id === "large")?.nodeCount).toBe(20001);
    expect(counting).toBeLessThan(copying / 10);
  });
});
