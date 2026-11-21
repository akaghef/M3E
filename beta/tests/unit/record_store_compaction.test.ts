// Compaction moves the journal into the archive; the records rebuilt from a snapshot and the
// journal lines after it are the records of the store. Synthetic data in temporary directories.

import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ARCHIVE_DIR,
  JOURNAL_FILE,
  RecordWorkspaceStore,
  SNAPSHOT_FILE,
  type EngineApplier,
  type EngineCommit,
  type EngineSource,
} from "../../src/node/record_store";
import { diffState } from "../../src/shared/map_changes";
import { serializeSnapshot } from "../../src/shared/record_model/jsonl";
import type { SnapshotRecord } from "../../src/shared/record_model/types";
import { ISSUER, clone, command, node, richState, snapshotOf, tempDir, type Loose } from "./record_store_helpers";

process.env.M3E_FORBID_LIVE_DATA = "1";

const DAY = 24 * 60 * 60 * 1000;
const open: RecordWorkspaceStore[] = [];

afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

let clock = 0;
function tick(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 10, 19, 0, 0, clock)).toISOString();
}

function newDir(name: string): string {
  const dir = path.join(tempDir(name), "store");
  RecordWorkspaceStore.create(dir, snapshotOf([{ id: "map_a", state: richState() }, { id: "map_b", state: richState("b_") }]));
  return dir;
}

function openStore(dir: string, options: Parameters<typeof RecordWorkspaceStore.open>[1] = {}): RecordWorkspaceStore {
  const store = RecordWorkspaceStore.open(dir, { now: tick, compactAfterLines: 0, ...options });
  open.push(store);
  return store;
}

function nodesOf(store: RecordWorkspaceStore, mapId = "map_a"): Record<string, Loose> {
  return (store.getMapRow(mapId).state as unknown as Loose).nodes as Record<string, Loose>;
}

function edit(store: RecordWorkspaceStore, change: (state: Loose) => void, mapId = "map_a"): void {
  const before = store.getMapRow(mapId).state as unknown as Loose;
  const after = clone(before);
  change(after);
  const result = store.commitMapCommand(mapId, command(diffState(before, after)), ISSUER);
  if (!result.ok) throw new Error(`commit failed: ${result.code} ${result.message ?? ""}`);
}

function text(records: SnapshotRecord[]): string {
  return serializeSnapshot(records);
}

function journalLines(file: string): Loose[] {
  return fs.readFileSync(file, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as Loose);
}

/** Commits of several kinds on both maps: text, a new node, an attribute, a deletion. */
function round(store: RecordWorkspaceStore, n: number): void {
  edit(store, (state) => { (state.nodes as Record<string, Loose>).leaf.text = `leaf ${n}`; });
  edit(store, (state) => {
    const nodes = state.nodes as Record<string, Loose>;
    nodes[`x${n}`] = node(`x${n}`, "f1", [], { details: `d${n}` });
    (nodes.f1.children as string[]).push(`x${n}`);
  });
  edit(store, (state) => { ((state.nodes as Record<string, Loose>).inner.attributes as Loose)[`k${n}`] = n; });
  edit(store, (state) => { (state.nodes as Record<string, Loose>).b_leaf.text = `b ${n}`; }, "map_b");
  if (n > 0) {
    edit(store, (state) => {
      const nodes = state.nodes as Record<string, Loose>;
      delete nodes[`x${n - 1}`];
      nodes.f1.children = (nodes.f1.children as string[]).filter((id) => id !== `x${n - 1}`);
    });
  }
}

describe("record store compaction: nothing is discarded, replay is deterministic", () => {
  it("rebuilds the identical record set from the first snapshot and every journal line, across compactions", async () => {
    const dir = newDir("replay-archive");
    const store = openStore(dir);
    round(store, 0);
    store.compact();
    round(store, 1);
    store.compact();
    round(store, 2);
    const expected = text(store.records());
    const seq = store.seq();
    await store.close();

    // The store itself: the last snapshot and the journal after it.
    const again = openStore(dir);
    expect(again.seq()).toBe(seq);
    expect(text(again.records())).toBe(expected);
    await again.close();

    // The first snapshot and every journal line, taken from the archive and the journal.
    const archive = path.join(dir, ARCHIVE_DIR);
    const files = fs.readdirSync(archive);
    expect(files).toContain("snapshot.0.f2.jsonl");
    const bySeq = new Map<number, string>();
    for (const file of [...files.filter((name) => name.startsWith("journal.")).map((name) => path.join(archive, name)), path.join(dir, JOURNAL_FILE)]) {
      for (const line of journalLines(file)) bySeq.set(line.seq as number, JSON.stringify(line));
    }
    expect([...bySeq.keys()].sort((a, b) => a - b)).toEqual(Array.from({ length: seq }, (_, i) => i + 1));
    const rebuilt = path.join(tempDir("replay-rebuilt"), "store");
    fs.mkdirSync(rebuilt);
    fs.copyFileSync(path.join(archive, "snapshot.0.f2.jsonl"), path.join(rebuilt, SNAPSHOT_FILE));
    fs.writeFileSync(path.join(rebuilt, JOURNAL_FILE), [...bySeq.entries()].sort((a, b) => a[0] - b[0]).map(([, line]) => line + "\n").join(""));
    const fromScratch = openStore(rebuilt);
    expect(fromScratch.seq()).toBe(seq);
    expect(text(fromScratch.records())).toBe(expected);

    // And from the middle snapshot with the lines after it.
    const middle = files.find((name) => /^snapshot\.[1-9]\d*\.f2\.jsonl$/.test(name));
    expect(middle).toBeDefined();
    const middleSeq = Number(/^snapshot\.(\d+)\./.exec(middle as string)?.[1]);
    const fromMiddle = path.join(tempDir("replay-middle"), "store");
    fs.mkdirSync(fromMiddle);
    fs.copyFileSync(path.join(archive, middle as string), path.join(fromMiddle, SNAPSHOT_FILE));
    fs.writeFileSync(
      path.join(fromMiddle, JOURNAL_FILE),
      [...bySeq.entries()].filter(([s]) => s > middleSeq).sort((a, b) => a[0] - b[0]).map(([, line]) => line + "\n").join(""),
    );
    expect(text(openStore(fromMiddle).records())).toBe(expected);
  });

  it("keeps the journal of a compaction in the archive and lists it in the archive index", async () => {
    const dir = newDir("archive-index");
    const store = openStore(dir);
    round(store, 0);
    const journal = fs.readFileSync(path.join(dir, JOURNAL_FILE), "utf8");
    store.compact();
    expect(fs.readFileSync(path.join(dir, JOURNAL_FILE), "utf8")).toBe("");
    expect(fs.readFileSync(path.join(dir, ARCHIVE_DIR, "journal.1-4.f2.jsonl"), "utf8")).toBe(journal);
    const index = JSON.parse(fs.readFileSync(path.join(dir, ARCHIVE_DIR, "index.json"), "utf8")) as { entries: Loose[] };
    expect(index.entries.map((entry) => [entry.file, entry.kind, entry.fromSeq, entry.toSeq])).toEqual([
      ["journal.1-4.f2.jsonl", "journal", 1, 4],
      ["snapshot.0.f2.jsonl", "snapshot", 0, 0],
    ]);
    // A second compaction with nothing new changes nothing.
    store.compact();
    expect(fs.readdirSync(path.join(dir, ARCHIVE_DIR)).sort()).toEqual(["index.json", "journal.1-4.f2.jsonl", "snapshot.0.f2.jsonl"]);
  });

  it("still finds a committed Command and still catches the engine up from the archive after compaction", async () => {
    const dir = newDir("archive-reads");
    const store = openStore(dir);
    const before = store.getMapRow("map_a").state as unknown as Loose;
    const after = clone(before);
    (after.nodes as Record<string, Loose>).leaf.text = "kept";
    const kept = command(diffState(before, after), "edit", "kept-command");
    expect(store.commitMapCommand("map_a", kept, ISSUER)).toMatchObject({ ok: true, seq: 1 });
    round(store, 0);
    store.compact();
    round(store, 1);
    expect(store.committedCommand("map_a", "kept-command")).toMatchObject({ seq: 1, commandId: "kept-command", intent: "edit" });
    await store.close();

    let source: EngineSource | undefined;
    const applier: EngineApplier = {
      async start(given: EngineSource): Promise<number> {
        source = given;
        return given.seq();
      },
      async apply(_commit: EngineCommit): Promise<void> {},
      async close(): Promise<void> {},
    };
    const again = openStore(dir, { applier });
    await again.flush();
    // An engine that holds only commit 0 gets every commit from the archive, not a rebuild.
    const commits = source?.commitsAfter(0);
    expect(commits?.map((commit) => commit.seq)).toEqual(Array.from({ length: again.seq() }, (_, i) => i + 1));
  });
});

describe("record store compaction: when it runs", () => {
  it("compacts after the commit that makes the journal as long as the limit", () => {
    const dir = newDir("auto");
    const store = openStore(dir, { compactAfterLines: 3 });
    edit(store, (state) => { (state.nodes as Record<string, Loose>).leaf.text = "1"; });
    edit(store, (state) => { (state.nodes as Record<string, Loose>).leaf.text = "2"; });
    expect(store.journalLength()).toBe(2);
    edit(store, (state) => { (state.nodes as Record<string, Loose>).leaf.text = "3"; });
    expect(store.journalLength()).toBe(0);
    expect(fs.readFileSync(path.join(dir, JOURNAL_FILE), "utf8")).toBe("");
    expect(fs.existsSync(path.join(dir, ARCHIVE_DIR, "journal.1-3.f2.jsonl"))).toBe(true);
    expect(store.maintenanceStatus().problems).toEqual([]);
  });

  it("compacts on open when the replay was as long as the limit", async () => {
    const dir = newDir("auto-open");
    const store = openStore(dir);
    round(store, 0);
    const expected = text(store.records());
    await store.close();
    const again = openStore(dir, { compactAfterLines: 4 });
    expect(again.journalLength()).toBe(0);
    expect(text(again.records())).toBe(expected);
    expect(fs.existsSync(path.join(dir, ARCHIVE_DIR, "journal.1-4.f2.jsonl"))).toBe(true);
  });
});

describe("record store compaction: archive retention (90 days, gated on the snapshot)", () => {
  function compacted(name: string): { dir: string; store: RecordWorkspaceStore; archivedAt: number } {
    const dir = newDir(name);
    const store = openStore(dir);
    round(store, 0);
    store.compact();
    const index = JSON.parse(fs.readFileSync(path.join(dir, ARCHIVE_DIR, "index.json"), "utf8")) as { entries: Loose[] };
    return { dir, store, archivedAt: Date.parse(String(index.entries[0].archivedAt)) };
  }

  it("deletes archived files only after 90 days", () => {
    const { dir, store, archivedAt } = compacted("prune");
    expect(store.pruneArchive({ now: new Date(archivedAt + 89 * DAY).toISOString() })).toEqual({ deleted: [], problems: [] });
    expect(fs.readdirSync(path.join(dir, ARCHIVE_DIR))).toHaveLength(3);
    const result = store.pruneArchive({ now: new Date(archivedAt + 90 * DAY).toISOString() });
    expect(result.problems).toEqual([]);
    expect(result.deleted.sort()).toEqual(["journal.1-4.f2.jsonl", "snapshot.0.f2.jsonl"]);
    expect(fs.readdirSync(path.join(dir, ARCHIVE_DIR))).toEqual(["index.json"]);
  });

  it("deletes nothing when the snapshot does not match its recorded checksum", () => {
    const { dir, store, archivedAt } = compacted("prune-damaged");
    fs.appendFileSync(path.join(dir, SNAPSHOT_FILE), "\n");
    const result = store.pruneArchive({ now: new Date(archivedAt + 91 * DAY).toISOString() });
    expect(result.deleted).toEqual([]);
    expect(result.problems.join(" ")).toMatch(/checksum/);
    expect(fs.readdirSync(path.join(dir, ARCHIVE_DIR))).toHaveLength(3);
  });

  it("deletes nothing when no checksum was recorded for the snapshot", () => {
    const { dir, store, archivedAt } = compacted("prune-no-sum");
    const indexPath = path.join(dir, "commit-index.json");
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as Loose;
    delete index.snapshot;
    fs.writeFileSync(indexPath, JSON.stringify(index));
    return store.close().then(() => {
      const again = openStore(dir);
      const result = again.pruneArchive({ now: new Date(archivedAt + 91 * DAY).toISOString() });
      expect(result.deleted).toEqual([]);
      expect(result.problems.join(" ")).toMatch(/no checksum/);
      expect(fs.readdirSync(path.join(dir, ARCHIVE_DIR))).toHaveLength(3);
    });
  });
});

describe("journal envelope: touched", () => {
  it("lists the records a commit changed, with the kinds of change, derived by the store", () => {
    const dir = newDir("touched");
    const store = openStore(dir);
    edit(store, (state) => { (state.nodes as Record<string, Loose>).leaf.text = "changed"; });
    edit(store, (state) => { ((state.nodes as Record<string, Loose>).inner.attributes as Loose).k = "v"; });
    edit(store, (state) => {
      const nodes = state.nodes as Record<string, Loose>;
      nodes.n1 = node("n1", "f1");
      (nodes.f1.children as string[]).push("n1");
    });
    const lines = journalLines(path.join(dir, JOURNAL_FILE));
    expect(lines[0].touched).toEqual([{ rk: "node|leaf", ev: ["m3e:content"] }]);
    expect(lines[1].touched).toEqual([{ rk: "node|inner", ev: ["m3e:attribute"] }]);
    const created = lines[2].touched as Array<{ rk: string; ev: string[] }>;
    expect(created.map((entry) => entry.rk)).toEqual([...created.map((entry) => entry.rk)].sort());
    expect(created.find((entry) => entry.rk === "node|n1")).toEqual({ rk: "node|n1", ev: ["m3e:create"] });
    expect(created.some((entry) => entry.rk.startsWith("connection|") && entry.ev.includes("m3e:create"))).toBe(true);
    expect(nodesOf(store).n1.text).toBe("text of n1");
  });
});
