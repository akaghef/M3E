import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { MapProjector } from "../../src/shared/record_model/steady";
import { command, ISSUER, NOW, richState, snapshotOf, node, clone } from "./record_store_helpers";
import { diffState, type RecordChange } from "../../src/shared/map_changes";
import { createTestStore, dropTestStores, type TestStore } from "./neo4j_test_store";

afterEach(async () => {
  vi.restoreAllMocks();
  await dropTestStores();
});
async function create(state: Record<string, unknown> = richState()): Promise<TestStore> {
  return createTestStore(snapshotOf([{ id: "m", state }]), { now: () => NOW, compactAfterLines: 0 });
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
  it("reads the one journal line after the cursor, after a reopen and an append", async () => {
    const handle = await create();
    let store = handle.store;
    let last = edit(store, "leaf", { text: "日本語 🐦" });
    for (let i = 0; i < 30; i += 1) {
      last = edit(store, "leaf", { text: `日本語 🐦 ${i}` });
      expect(store.commitMapCommand("m", last, ISSUER).ok).toBe(true);
    }
    store = await handle.reopen();
    const check = async () => {
      const lines = (await store.readJournalAfter(store.seq() - 1))!;
      expect(lines).toHaveLength(1);
      const found = (await store.readCommittedCommand("m", last.commandId))!;
      expect(found).toEqual(lines[0]);
      found.ops.length = 0;
      expect((await store.readCommittedCommand("m", last.commandId))?.ops.length).toBeGreaterThan(0);
      expect(await store.readJournalAfter(store.seq())).toEqual([]);
    };
    await check();
    last = edit(store, "leaf", { text: "appended" });
    expect(store.commitMapCommand("m", last, ISSUER).ok).toBe(true);
    await check();
    store = await handle.reopen();
    await check();
  });

  it("does not enumerate unrelated nodes or records for content commits", async () => {
    const { store } = await create();
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

  it("keeps the commit guard indexed across commits without scanning the workspace", async () => {
    const { store } = await create();
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

  it("matches full projection, journal operations, normalization and subsequent structural edits", async () => {
    const { store: fast } = await create();
    const { store: full } = await create();
    const compare = async (changes: RecordChange[]) => {
      const cmd = command(changes);
      const result = fast.commitMapCommand("m", cmd, ISSUER);
      const fallback = vi.spyOn(MapProjector.prototype, "canProjectContent").mockReturnValue(false);
      let reference;
      try { reference = full.commitMapCommand("m", cmd, ISSUER); } finally { fallback.mockRestore(); }
      expect(result).toEqual(reference);
      expect(fast.records().slice(1)).toEqual(full.records().slice(1));
      expect(fast.getMapRow("m")).toEqual(full.getMapRow("m"));
      expect(await fast.readCommittedCommand("m", cmd.commandId)).toEqual(await full.readCommittedCommand("m", cmd.commandId));
    };
    for (const id of ["root", "f1", "leaf", "al"]) {
      for (const after of [{ text: "new", details: "body", note: "memo", link: "url", collapsed: true },
        { text: "", details: "", note: "", link: "", collapsed: false },
        { text: null, details: null, note: null, link: null, collapsed: null }]) {
        await compare(edit(fast, id, after).changes);
      }
      await compare([{ kind: "node", key: [id], op: "update", before: { text: "", details: "", note: "", link: "", collapsed: false }, after: {} }]);
    }
    await compare([{ kind: "attribute", key: ["node", "leaf", "x"], op: "create", after: { value: "attribute" } }]);
    await compare(edit(fast, "leaf", { text: "after full projection" }).changes);
    await compare([{ kind: "node", key: ["leaf"], op: "update", before: { text: "stale" }, after: { text: "conflict" } }]);
  });

  it.each([0, 1, 3])("inserts a leaf at %i without enumerating existing node or sibling tables", async (position) => {
    const { store } = await create();
    const state = store.getMapRow("m").state;
    const after = clone(state);
    after.nodes.fresh = node("fresh", "root") as typeof after.nodes[string];
    after.nodes.root.children.splice(position, 0, "fresh");
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

  it("matches the full projection and journal for batch appends, content edits and later reorders", async () => {
    const { store: fast } = await create();
    const { store: full } = await create();
    const compare = async (cmd: ReturnType<typeof command>) => {
      const result = fast.commitMapCommand("m", cmd, ISSUER);
      const fallback = vi.spyOn(MapProjector.prototype, "canProjectContent").mockReturnValue(false);
      let reference;
      try { reference = full.commitMapCommand("m", cmd, ISSUER); } finally { fallback.mockRestore(); }
      expect(result).toEqual(reference);
      expect(fast.getMapRow("m")).toEqual(full.getMapRow("m"));
      expect(fast.records().slice(1)).toEqual(full.records().slice(1));
      expect(await fast.readCommittedCommand("m", cmd.commandId)).toEqual(await full.readCommittedCommand("m", cmd.commandId));
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
      await compare(command(diffState(before, after)));
      await compare(edit(fast, "root", { text: `root ${batch}` }));
    }
    const before = fast.getMapRow("m").state;
    const after = clone(before);
    after.nodes.root.children.reverse();
    await compare(command(diffState(before, after)));
    await compare(edit(fast, "leaf", { text: "after reorder" }));
  });

  it("falls back when a new leaf changes an orphan note or a broken alias", async () => {
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
      const { store: fast } = await create(state);
      const { store: full } = await create(state);
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

  it("a committed append leaves the caller's earlier state copy unchanged", async () => {
    const { store } = await create();
    const before = store.getMapRow("m");
    const after = clone(before.state);
    after.nodes.fresh = node("fresh", "root") as typeof after.nodes[string];
    after.nodes.root.children.push("fresh");
    const cmd = command(diffState(before.state, after));
    expect(store.commitMapCommand("m", cmd, ISSUER).ok).toBe(true);
    expect(before.state.nodes.root.children).not.toContain("fresh");
    const copy = store.getMapRow("m");
    copy.state.nodes.root.children.length = 0;
    expect(store.getMapRow("m").state.nodes.root.children).toContain("fresh");
  });
});
