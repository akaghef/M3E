import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JOURNAL_FILE, RecordWorkspaceStore } from "../../src/node/record_store/store";
import { MapProjector } from "../../src/shared/record_model/steady";
import { command, ISSUER, NOW, richState, snapshotOf, tempDir, node, clone } from "./record_store_helpers";
import { diffState, type RecordChange } from "../../src/shared/map_changes";

const stores: RecordWorkspaceStore[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const store of stores.splice(0)) await store.close();
});
function open(dir: string): RecordWorkspaceStore {
  const store = RecordWorkspaceStore.open(dir, { now: () => NOW, compactAfterLines: 0 });
  stores.push(store);
  return store;
}
function create(): { store: RecordWorkspaceStore; dir: string } {
  const dir = path.join(tempDir("delta"), "store");
  RecordWorkspaceStore.create(dir, snapshotOf([{ id: "m", state: richState() }]));
  return { store: open(dir), dir };
}
function edit(store: RecordWorkspaceStore, id: string, after: Record<string, unknown>) {
  const before: Record<string, unknown> = {};
  store.readState("m", (state) => {
    const source = state.nodes[id] as unknown as Record<string, unknown>;
    for (const key of Object.keys(after)) if (Object.hasOwn(source, key)) before[key] = source[key];
  });
  return command([{ kind: "node", key: [id], op: "update", before, after }]);
}

describe("delta-proportional store paths", () => {
  it("reads only the requested journal bytes after reopen, append and compaction", async () => {
    const { store: initial, dir } = create();
    let last = edit(initial, "leaf", { text: "日本語 🐦" });
    for (let i = 0; i < 30; i += 1) {
      last = edit(initial, "leaf", { text: `日本語 🐦 ${i}` });
      expect(initial.commitMapCommand("m", last, ISSUER).ok).toBe(true);
    }
    await initial.close();
    // Recovery adds a missing newline; offsets must remain byte offsets, not character counts.
    const file = path.join(dir, JOURNAL_FILE);
    fs.truncateSync(file, fs.statSync(file).size - 1);
    const store = open(dir);
    const check = () => {
      const whole = vi.spyOn(fs, "readFileSync");
      const ranged = vi.spyOn(fs, "readSync");
      try {
        const lines = store.journalLinesAfter(store.seq() - 1)!;
        expect(lines).toHaveLength(1);
        const found = store.committedCommand("m", last.commandId)!;
        expect(found).toEqual(lines[0]);
        found.ops.length = 0;
        expect(store.committedCommand("m", last.commandId)?.ops.length).toBeGreaterThan(0);
        // No scan of the current journal or an archived segment, even after compaction.
        expect(whole.mock.calls.filter(([file]) => String(file).endsWith(".jsonl"))).toHaveLength(0);
        const bytes = ranged.mock.results.reduce((n, result) => n + Number(result.value), 0);
        const lineBytes = Buffer.byteLength(JSON.stringify(lines[0]) + "\n");
        expect(bytes).toBeLessThanOrEqual(3 * lineBytes);
        expect(store.journalLinesAfter(store.seq())).toEqual([]);
      } finally { whole.mockRestore(); ranged.mockRestore(); }
    };
    check();
    last = edit(store, "leaf", { text: "appended" });
    expect(store.commitMapCommand("m", last, ISSUER).ok).toBe(true);
    check();
    store.compact();
    check();
  });

  it("does not enumerate unrelated nodes or records for content commits", () => {
    const { store } = create();
    const change = edit(store, "root", { text: "new root", details: "body", collapsed: false });
    let enumerations = 0;
    store.readState("m", (state) => {
      state.nodes = new Proxy(state.nodes, { ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); } });
    });
    const full = vi.spyOn(MapProjector.prototype, "project");
    expect(store.commitMapCommand("m", change, ISSUER).ok).toBe(true);
    expect(enumerations).toBe(0);
    expect(full).not.toHaveBeenCalled();
    const state = store.getMapRow("m").state;
    expect(state.nodes.root.text).toBe("new root");
    expect(state.scopes?.["scope:root"].label).toBe("new root");
  });

  it("keeps the commit guard indexed across commits without scanning the workspace", () => {
    const { store } = create();
    expect(store.commitMapCommand("m", edit(store, "leaf", { text: "warm guard" }), ISSUER).ok).toBe(true);
    const all = (store as unknown as { all: Map<string, unknown> }).all;
    const scan = vi.spyOn(all, "values");
    const cmd = edit(store, "leaf", { text: "indexed guard" });
    expect(store.commitMapCommand("m", cmd, ISSUER).ok).toBe(true);
    // Calling values is harmless; consuming the resulting iterator is the costly scan.
    // The indexed guard must not read records from that iterator.
    const consumed = scan.mock.results.map((result) => [...result.value].length);
    expect(consumed.every((count) => count === all.size)).toBe(true);
    expect(store.getMapRow("m").state.nodes.leaf.text).toBe("indexed guard");
  });

  it("matches full projection, journal operations, normalization and subsequent structural edits", () => {
    const { store: fast } = create();
    const { store: full } = create();
    const compare = (changes: RecordChange[]) => {
      const cmd = command(changes);
      const result = fast.commitMapCommand("m", cmd, ISSUER);
      const fallback = vi.spyOn(MapProjector.prototype, "canProjectContent").mockReturnValue(false);
      let reference;
      try { reference = full.commitMapCommand("m", cmd, ISSUER); } finally { fallback.mockRestore(); }
      expect(result).toEqual(reference);
      expect(fast.records().slice(1)).toEqual(full.records().slice(1));
      expect(fast.getMapRow("m")).toEqual(full.getMapRow("m"));
      expect(fast.committedCommand("m", cmd.commandId)).toEqual(full.committedCommand("m", cmd.commandId));
    };
    for (const id of ["root", "f1", "leaf", "al"]) {
      for (const after of [{ text: "new", details: "body", note: "memo", link: "url", collapsed: true },
        { text: "", details: "", note: "", link: "", collapsed: false },
        { text: null, details: null, note: null, link: null, collapsed: null }]) {
        compare(edit(fast, id, after).changes);
      }
      compare([{ kind: "node", key: [id], op: "update", before: { text: "", details: "", note: "", link: "", collapsed: false }, after: {} }]);
    }
    compare([{ kind: "attribute", key: ["node", "leaf", "x"], op: "create", after: { value: "attribute" } }]);
    compare(edit(fast, "leaf", { text: "after full projection" }).changes);
    compare([{ kind: "node", key: ["leaf"], op: "update", before: { text: "stale" }, after: { text: "conflict" } }]);
  });

  it("appends leaves without enumerating the existing node or sibling tables", () => {
    const { store } = create();
    const state = store.getMapRow("m").state;
    const after = clone(state);
    after.nodes.fresh = node("fresh", "root") as typeof after.nodes[string];
    after.nodes.root.children.push("fresh");
    const cmd = command(diffState(state, after));
    let enumerations = 0;
    let siblingsRead = 0;
    store.readState("m", (source) => {
      source.nodes = new Proxy(source.nodes, { ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); } });
      source.nodes.root.children = new Proxy(source.nodes.root.children, {
        get(target, key, receiver) {
          if (typeof key === "string" && /^\d+$/.test(key)) siblingsRead += 1;
          return Reflect.get(target, key, receiver);
        },
      });
    });
    expect(store.commitMapCommand("m", cmd, ISSUER).ok).toBe(true);
    expect(enumerations).toBe(0);
    expect(siblingsRead).toBeLessThanOrEqual(1);
    expect(store.getMapRow("m").state.nodes.fresh.parentId).toBe("root");
  });

  it("matches the full projection and journal for batch appends, content edits and later reorders", () => {
    const { store: fast } = create();
    const { store: full } = create();
    const compare = (cmd: ReturnType<typeof command>) => {
      const result = fast.commitMapCommand("m", cmd, ISSUER);
      const fallback = vi.spyOn(MapProjector.prototype, "canProjectContent").mockReturnValue(false);
      let reference;
      try { reference = full.commitMapCommand("m", cmd, ISSUER); } finally { fallback.mockRestore(); }
      expect(result).toEqual(reference);
      expect(fast.getMapRow("m")).toEqual(full.getMapRow("m"));
      expect(fast.records().slice(1)).toEqual(full.records().slice(1));
      expect(fast.committedCommand("m", cmd.commandId)).toEqual(full.committedCommand("m", cmd.commandId));
    };
    for (let batch = 0; batch < 4; batch += 1) {
      const before = fast.getMapRow("m").state;
      const after = clone(before);
      for (const parent of ["root", "f1", "leaf"]) {
        for (let i = 0; i < 2; i += 1) {
          const id = `${batch % 2 ? "a" : "z"}-${batch}-${parent}-${i}`;
          after.nodes[id] = node(id, parent, [], { text: "新しい子", nodeType: i ? "image" : "text", details: "body", attributes: { "m3e:edge-label": "label", x: "v" }, edgeAttributes: { a: "b" }, edgeRelationType: "detail", future: 42 }) as typeof after.nodes[string];
          after.nodes[parent].children.push(id);
        }
      }
      compare(command(diffState(before, after)));
      compare(edit(fast, "root", { text: `root ${batch}` }));
    }
    const before = fast.getMapRow("m").state;
    const after = clone(before);
    after.nodes.root.children.reverse();
    compare(command(diffState(before, after)));
    compare(edit(fast, "leaf", { text: "after reorder" }));
  });

  it("falls back when a new leaf changes an orphan note or a broken alias", () => {
    for (const alias of [false, true]) {
      const state = richState();
      const nodes = state.nodes as Record<string, Record<string, unknown>>;
      (state.linearNotesByScope as Record<string, unknown>).fresh = "orphan text";
      if (alias) {
        nodes.al.targetNodeId = "fresh";
        nodes.al.isBroken = true;
        nodes.al.targetSnapshotLabel = "missing target";
        delete (state.linearNotesByScope as Record<string, unknown>).fresh;
      }
      const make = () => {
        const dir = path.join(tempDir("append-fallback"), "store");
        RecordWorkspaceStore.create(dir, snapshotOf([{ id: "m", state }]));
        return open(dir);
      };
      const fast = make();
      const full = make();
      const before = fast.getMapRow("m").state;
      const after = clone(before);
      after.nodes.fresh = node("fresh", "root") as typeof after.nodes[string];
      after.nodes.root.children.push("fresh");
      const cmd = command(diffState(before, after));
      const result = fast.commitMapCommand("m", cmd, ISSUER);
      const fallback = vi.spyOn(MapProjector.prototype, "canProjectContent").mockReturnValue(false);
      try { expect(result).toEqual(full.commitMapCommand("m", cmd, ISSUER)); } finally { fallback.mockRestore(); }
      expect(fast.records().slice(1)).toEqual(full.records().slice(1));
      expect(fast.getMapRow("m")).toEqual(full.getMapRow("m"));
      expect(result.ok).toBe(!alias);
    }
  });

  it("rolls back an appended suffix on append failure and preserves deep-copy reads", () => {
    const { store } = create();
    const before = store.getMapRow("m");
    const records = store.records();
    const after = clone(before.state);
    after.nodes.fresh = node("fresh", "root") as typeof after.nodes[string];
    after.nodes.root.children.push("fresh");
    const cmd = command(diffState(before.state, after));
    const write = vi.spyOn(fs, "fsyncSync").mockImplementationOnce(() => { throw new Error("disk failure"); });
    expect(() => store.commitMapCommand("m", cmd, ISSUER)).toThrow("disk failure");
    write.mockRestore();
    expect(store.records()).toEqual(records);
    expect(store.getMapRow("m")).toEqual(before);
    expect(store.commitMapCommand("m", cmd, ISSUER).ok).toBe(true);
    expect(before.state.nodes.root.children).not.toContain("fresh");
    const copy = store.getMapRow("m");
    copy.state.nodes.root.children.length = 0;
    expect(store.getMapRow("m").state.nodes.root.children).toContain("fresh");
  });

  it("rolls back nodes, scope labels, records and journal positions when append fails", () => {
    const { store } = create();
    const state = store.getMapRow("m");
    const records = store.records();
    const seq = store.seq();
    const cmd = edit(store, "root", { text: "refused", details: "body" });
    const write = vi.spyOn(fs, "fsyncSync").mockImplementationOnce(() => { throw new Error("disk failure"); });
    expect(() => store.commitMapCommand("m", cmd, ISSUER)).toThrow("disk failure");
    write.mockRestore();
    expect(store.seq()).toBe(seq);
    expect(store.records()).toEqual(records);
    expect(store.getMapRow("m")).toEqual(state);
    expect(store.journalLinesAfter(seq)).toEqual([]);
    expect(store.committedCommand("m", cmd.commandId)).toBeNull();
    expect(store.commitMapCommand("m", cmd, ISSUER).ok).toBe(true);
    expect(store.journalLinesAfter(seq)).toHaveLength(1);
  });
});
