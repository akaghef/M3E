// Commits through the record store (src/node/record_store). Synthetic data only.

import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  JOURNAL_FILE,
  RecordWorkspaceStore,
  SNAPSHOT_FILE,
  type CommitResult,
  type EngineApplier,
  type EngineCommit,
  type EngineSource,
} from "../../src/node/record_store";
import { applyChanges, diffState, type RecordChange } from "../../src/shared/map_changes";
import { fromSnapshot } from "../../src/shared/record_model/from_snapshot";
import { checkInvariants } from "../../src/shared/record_model/invariants";
import { serializeSnapshot, sortRecords } from "../../src/shared/record_model/jsonl";
import { isProjectedRecord, projectMap, recordRk } from "../../src/shared/record_model/steady";
import type { SnapshotRecord } from "../../src/shared/record_model/types";
import type { AppState } from "../../src/shared/types";
import { ISSUER, NOW, WS, clone, command, node, richState, snapshotOf, tempDir, type Loose } from "./record_store_helpers";

const open: RecordWorkspaceStore[] = [];

afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

function seedRows() {
  return [
    { id: "map_a", tags: '["x"]', archived: 0, pinned: 1, source: "import", version: 1, saved_at: "2026-10-01T00:00:00.000Z", state: richState() },
    { id: "map_b", state: richState("b_") },
  ];
}

function newDir(name: string, records: SnapshotRecord[] = snapshotOf(seedRows())): string {
  const dir = path.join(tempDir(name), "store");
  RecordWorkspaceStore.create(dir, records);
  return dir;
}

let clock = 0;
function tick(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 10, 17, 0, 0, clock)).toISOString();
}

function openStore(dir: string, options: Parameters<typeof RecordWorkspaceStore.open>[1] = {}): RecordWorkspaceStore {
  const store = RecordWorkspaceStore.open(dir, { now: tick, ...options });
  open.push(store);
  return store;
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
  it("commits each RecordChange kind and reads back what applyChanges gives", () => {
    const dir = newDir("kinds");
    const store = openStore(dir);
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

  it("stamps rev with the commit sequence and records the commit", () => {
    const store = openStore(newDir("rev"));
    edit(store, (state) => { nodesOf(state).leaf.text = "one"; });
    edit(store, (state) => { nodesOf(state).inner.text = "two"; });
    const records = store.records();
    const byRk = new Map(records.map((record) => [recordRk(record), record]));
    expect(byRk.get("node|leaf")).toMatchObject({ rev: 1, text: "one" });
    expect(byRk.get("node|inner")).toMatchObject({ rev: 2, text: "two" });
    expect(byRk.get("node|img")).toMatchObject({ rev: 0 });
    expect(records[0]).toEqual({ kind: "snapshot", format: 2, workspaceId: WS, historyId: expect.any(String), epoch: 1, seq: 2 });
    expect(byRk.get("commit|2")).toMatchObject({ kind: "commit", seq: 2, issuer: ISSUER });
    expect(store.revisionOf("map_a")).toBe("2");
    expect(store.getMapRow("map_a").savedAt).toBe((byRk.get("commit|2") as { committedAt: string }).committedAt);
    expect(store.getMapRow("map_b").savedAt).toBe(NOW);
  });
});

describe("record store: retries and conflicts", () => {
  it("returns the first result for a command id seen before, and refuses the same id with other content", () => {
    const store = openStore(newDir("retry"));
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
    // The same id on another map is another command.
    const onB = diffState(stateOf(store, "map_b"), { ...stateOf(store, "map_b"), linearPanelWidth: 10 });
    expect(ok(store.commitMapCommand("map_b", command(onB, "edit", "same-id"), ISSUER)).replayed).toBe(false);
  });

  it("rejects a command whose before values are stale, field by field", () => {
    const store = openStore(newDir("cas"));
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

  it("checks the expected revision, the map and the shape of the command", () => {
    const store = openStore(newDir("shape"));
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

  it("rejects a state the app's validation or an invariant does not accept, and writes nothing", () => {
    const store = openStore(newDir("invalid"));
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
    expect(fs.readFileSync(path.join((store as unknown as { dir: string }).dir, JOURNAL_FILE), "utf8")).toBe("");
    // The store still works after the refusals.
    edit(store, (state) => { nodesOf(state).leaf.text = "fine"; });
  });

  it("lets a map that already has validation errors be edited, but not made worse", () => {
    const state = richState();
    // A link between a node and a link: valid as a record, an error for the app's validation.
    (state.links as Loose).l9 = { id: "l9", sourceNodeId: "img", targetNodeId: "l1" };
    const store = openStore(newDir("already-invalid", snapshotOf([{ id: "map_a", state }])));
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
    const dir = newDir("replay");
    const store = openStore(dir);
    someCommits(store);
    const records = text(store.records());
    const stateA = stateOf(store);
    const rowB = store.getMapRow("map_b");
    const lines = fs.readFileSync(path.join(dir, JOURNAL_FILE), "utf8").trimEnd().split("\n").map((line) => JSON.parse(line));
    expect(lines.map((line) => line.seq)).toEqual([1, 2, 3, 4]);
    expect(lines[1]).toMatchObject({ issuer: ISSUER, mapId: "map_a", intent: "test" });
    expect(Object.keys(lines[1])).toEqual(expect.arrayContaining(["seq", "commandId", "issuer", "committedAt", "mapId", "intent", "changes", "ops"]));
    const opNames = lines[1].ops.map((op: { op: string; rk: string }) => `${op.op} ${op.rk}`);
    expect(opNames.filter((name: string) => !name.includes(" decay|")).sort()).toEqual(
      ["put details|n1", "put node|n1", expect.stringMatching(/^put connection\|c_/)].sort(),
    );
    expect(opNames).toContain("put decay|node|n1");
    expect(opNames.some((name: string) => name.startsWith("put decay|scope|"))).toBe(true);
    await store.close();

    const again = openStore(dir);
    expect(again.seq()).toBe(4);
    expect(text(again.records())).toBe(records);
    expect(stateOf(again)).toEqual(stateA);
    expect(again.getMapRow("map_b")).toEqual(rowB);
    expect(again.revisionOf("map_a")).toBe("3");
    expect(again.revisionOf("map_b")).toBe("4");
    // The snapshot file is still the one written at creation, except that the first open gave its header
    // the history of the store (historyId, epoch) once.
    const [fileHeader, ...fileRest] = fs.readFileSync(path.join(dir, SNAPSHOT_FILE), "utf8").trimEnd().split("\n");
    const [createdHeader, ...createdRest] = text(snapshotOf(seedRows())).trimEnd().split("\n");
    expect(fileRest).toEqual(createdRest);
    expect(JSON.parse(fileHeader)).toEqual({ ...JSON.parse(createdHeader), historyId: again.syncIdentity().historyId, epoch: 1 });
    edit(again, (state) => { nodesOf(state).leaf.text = "after reopen"; });
    expect(again.seq()).toBe(5);
  });

  it("ignores a truncated last journal line and cuts the file back to the last good line", async () => {
    const dir = newDir("truncated");
    const store = openStore(dir);
    edit(store, (state) => { nodesOf(state).leaf.text = "first"; });
    edit(store, (state) => { nodesOf(state).leaf.text = "second"; });
    const afterTwo = text(store.records());
    const journalPath = path.join(dir, JOURNAL_FILE);
    const goodSize = fs.statSync(journalPath).size;
    edit(store, (state) => { nodesOf(state).leaf.text = "third, lost"; });
    await store.close();
    fs.truncateSync(journalPath, fs.statSync(journalPath).size - 25);

    const again = openStore(dir);
    expect(again.seq()).toBe(2);
    expect(text(again.records())).toBe(afterTwo);
    expect(fs.statSync(journalPath).size).toBe(goodSize);
    edit(again, (state) => { nodesOf(state).leaf.text = "third, again"; });
    await again.close();
    const third = openStore(dir);
    expect(third.seq()).toBe(3);
    expect(nodesOf(stateOf(third)).leaf.text).toBe("third, again");
  });

  it("keeps a last line that is complete but has no line end, and refuses damage further up", async () => {
    const dir = newDir("damaged");
    const store = openStore(dir);
    edit(store, (state) => { nodesOf(state).leaf.text = "first"; });
    edit(store, (state) => { nodesOf(state).leaf.text = "second"; });
    const records = text(store.records());
    await store.close();
    const journalPath = path.join(dir, JOURNAL_FILE);
    const content = fs.readFileSync(journalPath, "utf8");
    fs.writeFileSync(journalPath, content.slice(0, -1));
    const again = openStore(dir);
    expect(text(again.records())).toBe(records);
    await again.close();
    expect(fs.readFileSync(journalPath, "utf8")).toBe(content);

    fs.writeFileSync(journalPath, `{"seq":1,"ops":[` + "\n" + content.split("\n")[1] + "\n");
    expect(() => RecordWorkspaceStore.open(dir)).toThrow(/damaged/);
  });

  it("compacts: the snapshot is rewritten, the journal emptied, nothing is lost", async () => {
    const dir = newDir("compact");
    const store = openStore(dir);
    someCommits(store);
    const before = stateOf(store);
    const after = clone(before);
    nodesOf(after).img.text = "kept command";
    const kept = command(diffState(before, after), "edit", "kept-command");
    const first = ok(store.commitMapCommand("map_a", kept, ISSUER));
    const records = text(store.records());
    const savedAtA = store.getMapRow("map_a").savedAt;
    store.compact();
    expect(fs.readFileSync(path.join(dir, JOURNAL_FILE), "utf8")).toBe("");
    expect(fs.readFileSync(path.join(dir, SNAPSHOT_FILE), "utf8")).toBe(records);
    expect(text(store.records())).toBe(records);
    // Still usable without reopening.
    edit(store, (state) => { nodesOf(state).leaf.text = "after compaction"; });
    const afterCompaction = text(store.records());
    await store.close();

    const again = openStore(dir);
    expect(again.seq()).toBe(6);
    expect(text(again.records())).toBe(afterCompaction);
    expect(again.records().filter((record) => record.kind === "commit").map((record) => (record as { seq: number }).seq)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(again.revisionOf("map_b")).toBe("4");
    expect(again.revisionOf("map_a")).toBe("6");
    expect(again.commitMapCommand("map_a", kept, ISSUER)).toEqual({ ok: true, savedAt: first.savedAt, seq: first.seq, replayed: true });
    expect(first.savedAt).toBe(savedAtA);
    const changed = clone(kept);
    (changed.changes[0].after as Loose).text = "other";
    expect(again.commitMapCommand("map_a", changed, ISSUER)).toMatchObject({ ok: false, code: "SAME_ID_DIFFERENT_CONTENT" });
    again.compact();
    again.compact();
    await again.close();
    const third = openStore(dir);
    expect(text(third.records())).toBe(afterCompaction);
    expect(third.commitMapCommand("map_a", kept, ISSUER)).toMatchObject({ ok: true, replayed: true });
  });

  it("opens a store whose compaction stopped after the snapshot was rewritten", async () => {
    const dir = newDir("half-compacted");
    const store = openStore(dir);
    someCommits(store);
    const journal = fs.readFileSync(path.join(dir, JOURNAL_FILE), "utf8");
    const records = text(store.records());
    store.compact();
    await store.close();
    // The journal as it was before it would have been emptied.
    fs.writeFileSync(path.join(dir, JOURNAL_FILE), journal);
    const again = openStore(dir);
    expect(again.seq()).toBe(4);
    expect(text(again.records())).toBe(records);
  });
});

describe("record store: whole-map saves and map-level operations", () => {
  it("saves a whole state as the difference to the current one, and creates a map that is absent", () => {
    const store = openStore(newDir("whole"));
    const state = stateOf(store);
    nodesOf(state).leaf.text = "whole save";
    nodesOf(state).w1 = node("w1", "root");
    (nodesOf(state).root.children as string[]).push("w1");
    const saved = ok(store.saveWholeMap("map_a", state as unknown as AppState, ISSUER));
    expect(saved).toMatchObject({ seq: 1, replayed: false });
    expect(stateOf(store)).toEqual(state);
    // Nothing changed: no commit.
    expect(store.saveWholeMap("map_a", state as unknown as AppState, ISSUER)).toMatchObject({ ok: true, seq: 1, savedAt: saved.savedAt });
    expect(store.seq()).toBe(1);

    const created = richState("c_");
    expect(store.hasMap("map_c")).toBe(false);
    ok(store.saveWholeMap("map_c", created as unknown as AppState, ISSUER, "import"));
    expect(store.hasMap("map_c")).toBe(true);
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
    const dir = newDir("map-ops");
    const store = openStore(dir);
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
    await store.close();
    const again = openStore(dir);
    expect(again.seq()).toBe(seq);
    expect(text(again.records())).toBe(records);
    expect(again.listMaps().map((item) => item.id)).toEqual(["map_new", "map_renamed"]);
    expect(stateOf(again, "map_renamed").nodes).toMatchObject({ b_inner: { text: "after rename" } });
    expect(again.commitMapCommand("map_renamed", kept, ISSUER)).toMatchObject({ ok: true, replayed: true });
  });
});

describe("record store: scope records and subtree deletion", () => {
  it("creates and removes the scope record when nodeType changes to and from folder", () => {
    const store = openStore(newDir("folder"));
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

  it("deletes the edges, details, node views, links and scope records of a deleted subtree", () => {
    const store = openStore(newDir("subtree"));
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

describe("record store: the storage engine behind the journal", () => {
  class FakeApplier implements EngineApplier {
    broken = false;
    started = 0;
    closed = false;
    readonly applied: number[] = [];
    readonly records = new Map<string, SnapshotRecord>();

    async start(source: EngineSource): Promise<number> {
      if (this.broken) throw new Error("engine unreachable");
      this.started += 1;
      this.records.clear();
      for (const record of source.records()) this.records.set(recordRk(record), record);
      return source.seq();
    }

    async apply(commit: EngineCommit): Promise<void> {
      await Promise.resolve();
      if (this.broken) throw new Error("engine write failed");
      for (const op of commit.ops) {
        if (op.op === "delete") this.records.delete(op.rk);
        else this.records.set(op.rk, op.record as SnapshotRecord);
      }
      this.applied.push(commit.seq);
    }

    async close(): Promise<void> {
      this.closed = true;
    }

    dump(): string {
      return text(sortRecords(clone([...this.records.values()])));
    }
  }

  it("applies every commit in order; the engine then holds exactly the records of the store", async () => {
    const applier = new FakeApplier();
    const store = openStore(newDir("engine"), { applier });
    edit(store, (state) => { nodesOf(state).leaf.text = "one"; });
    edit(store, (state) => {
      const nodes = nodesOf(state);
      nodes.f1.children = ["inner"];
      delete nodes.al;
    });
    store.setMapColumns("map_b", { pinned: 1 }, ISSUER);
    store.renameMapId("map_b", "map_z", ISSUER);
    await store.flush();
    expect(applier.applied).toEqual([1, 2, 3, 4]);
    expect(store.engineStatus()).toEqual({ appliedSeq: 4 });
    expect(applier.dump()).toBe(text(store.records()));
    store.deleteMap("map_z", ISSUER);
    await store.flush();
    expect(applier.dump()).toBe(text(store.records()));
    await store.close();
    expect(applier.closed).toBe(true);
  });

  const waitUntil = async (done: () => boolean): Promise<void> => {
    const deadline = Date.now() + 5000;
    while (!done()) {
      if (Date.now() > deadline) throw new Error("the engine did not catch up in time");
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };

  it("keeps committing while the engine is down, and the engine catches up from the journal by itself", async () => {
    const applier = new FakeApplier();
    const dir = newDir("engine-behind");
    const store = openStore(dir, { applier, engineRetry: { firstMs: 5, maxMs: 20 } });
    await store.flush();
    applier.broken = true;
    // The journal append is the commit point: every one of these commits stands.
    edit(store, (state) => { nodesOf(state).leaf.text = "one"; });
    await expect(store.flush()).rejects.toThrow(/engine write failed|engine unreachable/);
    expect(store.engineStatus().appliedSeq).toBe(0);
    expect(store.engineStatus().error).toMatch(/engine write failed|engine unreachable/);
    edit(store, (state) => { nodesOf(state).leaf.text = "two"; });
    ok(store.saveWholeMap("map_b", { ...stateOf(store, "map_b"), linearPanelWidth: 111 } as unknown as AppState, ISSUER));
    store.setMapColumns("map_a", { pinned: 0 }, ISSUER);
    store.renameMapId("map_b", "map_y", ISSUER);
    expect(store.seq()).toBe(5);
    // Retries happen in the background and keep failing; the status says so.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(store.engineStatus()).toMatchObject({ appliedSeq: 0, error: "engine unreachable" });
    expect(applier.applied).toEqual([]);

    // The engine comes back. Nobody calls flush: the next retry brings it to the last commit.
    applier.broken = false;
    await waitUntil(() => store.engineStatus().error === undefined && store.engineStatus().appliedSeq === 5);
    expect(store.engineStatus()).toEqual({ appliedSeq: 5 });
    expect(applier.dump()).toBe(text(store.records()));
    // And the commits after that go to it one by one, in order.
    edit(store, (state) => { nodesOf(state).leaf.text = "three"; });
    edit(store, (state) => { nodesOf(state).leaf.text = "four"; });
    await store.flush();
    expect(applier.applied).toEqual([6, 7]);
    expect(applier.dump()).toBe(text(store.records()));
  });

  it("an applier that fails on a commit is started again and resumes at the commit it did not get", async () => {
    // An engine that keeps what it has between starts, like Neo4j: it reports the commit it holds
    // and takes the missing ones from the journal.
    class KeepingApplier extends FakeApplier {
      held = -1;
      failAt: number | undefined;
      async start(source: EngineSource): Promise<number> {
        if (this.broken) throw new Error("engine unreachable");
        this.started += 1;
        if (this.held < 0) {
          for (const record of source.records()) this.records.set(recordRk(record), record);
          this.held = source.seq();
          return this.held;
        }
        for (const commit of source.commitsAfter(this.held) ?? []) await this.apply(commit);
        return this.held;
      }
      async apply(commit: EngineCommit): Promise<void> {
        if (commit.seq === this.failAt) throw new Error(`engine write failed at ${commit.seq}`);
        await super.apply(commit);
        this.held = commit.seq;
      }
    }
    const applier = new KeepingApplier();
    const store = openStore(newDir("engine-resume"), { applier, engineRetry: { firstMs: 5, maxMs: 20 } });
    await store.flush();
    applier.failAt = 2;
    edit(store, (state) => { nodesOf(state).leaf.text = "one"; });
    edit(store, (state) => { nodesOf(state).leaf.text = "two"; });
    edit(store, (state) => { nodesOf(state).leaf.text = "three"; });
    await waitUntil(() => store.engineStatus().error !== undefined);
    expect(store.engineStatus()).toEqual({ appliedSeq: 1, error: "engine write failed at 2" });
    edit(store, (state) => { nodesOf(state).leaf.text = "four"; });
    applier.failAt = undefined;
    await waitUntil(() => store.engineStatus().error === undefined && store.engineStatus().appliedSeq === 4);
    expect(applier.applied).toEqual([1, 2, 3, 4]);
    expect(applier.dump()).toBe(text(store.records()));
  });

  it("refuses commits with ENGINE_BEHIND only when the engine is behind by the limit, and accepts them again after it caught up", async () => {
    const applier = new FakeApplier();
    const store = openStore(newDir("engine-limit"), { applier, engineBacklogLimit: 3, engineRetry: { firstMs: 5, maxMs: 20 } });
    await store.flush();
    applier.broken = true;
    edit(store, (state) => { nodesOf(state).leaf.text = "one"; });
    edit(store, (state) => { nodesOf(state).leaf.text = "two"; });
    edit(store, (state) => { nodesOf(state).leaf.text = "three"; });
    expect(store.seq()).toBe(3);

    const before = stateOf(store);
    const after = clone(before);
    nodesOf(after).leaf.text = "refused";
    const refused = command(diffState(before, after));
    expect(store.commitMapCommand("map_a", refused, ISSUER)).toMatchObject({ ok: false, code: "ENGINE_BEHIND", conflicts: [], current: null });
    expect((store.commitMapCommand("map_a", refused, ISSUER) as { message?: string }).message).toMatch(/3 commits behind \(limit 3\)/);
    expect(store.saveWholeMap("map_a", after as unknown as AppState, ISSUER)).toMatchObject({ ok: false, code: "ENGINE_BEHIND" });
    expect(() => store.setMapColumns("map_a", { pinned: 0 }, ISSUER)).toThrow(/ENGINE_BEHIND/);
    expect(() => store.deleteMap("map_b", ISSUER)).toThrow(/ENGINE_BEHIND/);
    expect(() => store.renameMapId("map_b", "map_y", ISSUER)).toThrow(/ENGINE_BEHIND/);
    expect(store.seq()).toBe(3);
    // Reads keep working.
    expect(nodesOf(stateOf(store)).leaf.text).toBe("three");

    await waitUntil(() => store.engineStatus().error !== undefined);
    applier.broken = false;
    await waitUntil(() => store.engineStatus().error === undefined);
    expect(store.engineStatus()).toEqual({ appliedSeq: 3 });
    ok(store.commitMapCommand("map_a", refused, ISSUER));
    await store.flush();
    expect(applier.dump()).toBe(text(store.records()));
  });

  it("takes the backlog limit from M3E_ENGINE_BACKLOG_LIMIT, 10,000 when it is not set", async () => {
    const saved = process.env.M3E_ENGINE_BACKLOG_LIMIT;
    try {
      process.env.M3E_ENGINE_BACKLOG_LIMIT = "1";
      const applier = new FakeApplier();
      const store = openStore(newDir("engine-env"), { applier, engineRetry: { firstMs: 1000, maxMs: 1000 } });
      await store.flush();
      applier.broken = true;
      edit(store, (state) => { nodesOf(state).leaf.text = "one"; });
      expect(store.commitMapCommand("map_a", command([]), ISSUER)).toMatchObject({ ok: false, code: "ENGINE_BEHIND" });

      delete process.env.M3E_ENGINE_BACKLOG_LIMIT;
      const other = new FakeApplier();
      const second = openStore(newDir("engine-default"), { applier: other, engineRetry: { firstMs: 1000, maxMs: 1000 } });
      await second.flush();
      other.broken = true;
      for (let i = 0; i < 20; i += 1) second.setMapColumns("map_a", { pinned: i }, ISSUER);
      expect(second.commitMapCommand("map_a", command([]), ISSUER)).toMatchObject({ ok: true });
    } finally {
      if (saved === undefined) delete process.env.M3E_ENGINE_BACKLOG_LIMIT; else process.env.M3E_ENGINE_BACKLOG_LIMIT = saved;
    }
  });

  it("reports an engine that cannot be reached at open, keeps committing, and catches up when it can", async () => {
    const applier = new FakeApplier();
    applier.broken = true;
    const store = openStore(newDir("engine-down"), { applier, engineRetry: { firstMs: 5, maxMs: 20 } });
    await expect(store.flush()).rejects.toThrow(/engine unreachable/);
    expect(store.engineStatus()).toEqual({ appliedSeq: 0, error: "engine unreachable" });
    edit(store, (state) => { nodesOf(state).leaf.text = "while down"; });
    applier.broken = false;
    await waitUntil(() => store.engineStatus().error === undefined);
    edit(store, (state) => { nodesOf(state).leaf.text = "now"; });
    await store.flush();
    expect(store.engineStatus()).toEqual({ appliedSeq: 2 });
    expect(applier.dump()).toBe(text(store.records()));
  });

  it("resolves flush at once and reports the journal position when there is no engine", async () => {
    const store = openStore(newDir("no-engine"));
    edit(store, (state) => { nodesOf(state).leaf.text = "x"; });
    await store.flush();
    expect(store.engineStatus()).toEqual({ appliedSeq: 1 });
  });
});

describe("record store: where it may live", () => {
  it("refuses a directory that is not empty, and a directory without a store", () => {
    const dir = tempDir("not-empty");
    fs.writeFileSync(path.join(dir, "something"), "x");
    expect(() => RecordWorkspaceStore.create(dir, snapshotOf(seedRows()))).toThrow(/not empty/);
    expect(() => RecordWorkspaceStore.open(tempDir("no-store"))).toThrow(/missing/);
  });

  it("refuses the live M3E data directory when M3E_FORBID_LIVE_DATA is 1", () => {
    expect(process.env.M3E_FORBID_LIVE_DATA).toBe("1");
    const live = path.join(os.homedir(), "Library", "Application Support", "M3E", "record-store-test-that-must-not-exist");
    expect(() => RecordWorkspaceStore.create(live, snapshotOf(seedRows()))).toThrow(/live M3E/);
    expect(() => RecordWorkspaceStore.open(live)).toThrow(/live M3E/);
  });

  it("refuses to use a store after it is closed", async () => {
    const store = RecordWorkspaceStore.open(newDir("closed"));
    await store.close();
    expect(() => store.getMapRow("map_a")).toThrow(/closed/);
    expect(() => store.commitMapCommand("map_a", command([]), ISSUER)).toThrow(/closed/);
  });
});
