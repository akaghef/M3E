// The record store with Neo4j behind it. Runs only when M3E_TEST_NEO4J_BOLT points at a throwaway
// Neo4j instance (for example bolt://127.0.0.1:37687); every `Rec` node of that instance is deleted.

import path from "path";
import neo4j, { type Driver } from "neo4j-driver";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MARKER_LABEL, applyCommit, readEngineState } from "../../src/node/neo4j_store/apply";
import { deleteAllRecords, dump, load } from "../../src/node/neo4j_store/store";
import { main as cli } from "../../src/node/record_store_cli";
import { RecordWorkspaceStore } from "../../src/node/record_store";
import { diffState } from "../../src/shared/map_changes";
import { serializeSnapshot } from "../../src/shared/record_model/jsonl";
import type { AppState } from "../../src/shared/types";
import { ISSUER, clone, command, node, richState, snapshotOf, tempDir, type Loose } from "./record_store_helpers";

const BOLT = process.env.M3E_TEST_NEO4J_BOLT;

function seedRows() {
  return [
    { id: "map_a", tags: '["x"]', pinned: 1, state: richState() },
    { id: "map_b", state: richState("b_") },
  ];
}

describe.skipIf(!BOLT)("record store with Neo4j", () => {
  let driver: Driver;
  const stores: RecordWorkspaceStore[] = [];

  beforeAll(() => {
    driver = neo4j.driver(BOLT as string);
  });
  afterAll(async () => {
    await driver.close();
  });
  beforeEach(async () => {
    await deleteAllRecords(driver);
  });
  afterEach(async () => {
    for (const store of stores.splice(0)) await store.close();
  });

  function newDir(name: string, workspaceId?: string): string {
    const dir = path.join(tempDir(name), "store");
    RecordWorkspaceStore.create(dir, snapshotOf(seedRows(), workspaceId));
    return dir;
  }

  function openStore(dir: string, withNeo4j = true): RecordWorkspaceStore {
    const store = RecordWorkspaceStore.open(dir, withNeo4j ? { neo4j: { uri: BOLT as string } } : {});
    stores.push(store);
    return store;
  }

  async function closeStore(store: RecordWorkspaceStore): Promise<void> {
    stores.splice(stores.indexOf(store), 1);
    await store.close();
  }

  function edit(store: RecordWorkspaceStore, mapId: string, change: (state: Loose) => void): void {
    const before = store.getMapRow(mapId).state as unknown as Loose;
    const after = clone(before);
    change(after);
    const result = store.commitMapCommand(mapId, command(diffState(before, after)), ISSUER);
    if (!result.ok) throw new Error(`${result.code} ${result.message ?? ""}`);
  }

  function manyCommits(store: RecordWorkspaceStore): void {
    const nodes = (state: Loose): Record<string, Loose> => state.nodes as Record<string, Loose>;
    edit(store, "map_a", (state) => { nodes(state).leaf.text = "edited 😀 \"quoted\""; });
    edit(store, "map_a", (state) => {
      nodes(state).n1 = node("n1", "f1", [], { details: "d", attributes: { "m3e:edge-label": "to n1", weight: 1.5, list: [1, "two", null] as never } });
      nodes(state).n2 = node("n2", "n1");
      nodes(state).n1.children = ["n2"];
      (nodes(state).f1.children as string[]).unshift("n1");
    });
    edit(store, "map_a", (state) => {
      (state.links as Loose).l5 = { id: "l5", sourceNodeId: "n2", targetNodeId: "root", label: "link" };
      (state.linearNotesByScope as Loose).f1 = "changed";
      nodes(state).n2.nodeType = "folder";
    });
    edit(store, "map_a", (state) => {
      // Move n1 (with n2 under it) to the root and reorder.
      nodes(state).f1.children = (nodes(state).f1.children as string[]).filter((id) => id !== "n1");
      (nodes(state).root.children as string[]).unshift("n1");
      nodes(state).n1.parentId = "root";
    });
    edit(store, "map_b", (state) => {
      const surfaces = state.surfaces as Record<string, Loose>;
      const scatter = Object.values(surfaces).find((surface) => surface.kind === "scatter") as Loose;
      (scatter.nodeViews as Loose).b_img = { x: 1.25, y: -3 };
      delete (scatter.nodeViews as Loose).b_leaf;
      (state.annotations as Loose).b_a9 = { id: "b_a9", kind: "pen", d: "M1 1", stroke: "#123" };
    });
    edit(store, "map_a", (state) => {
      // Delete the subtree n1 > n2 and the link that touches it.
      delete nodes(state).n1;
      delete nodes(state).n2;
      nodes(state).root.children = (nodes(state).root.children as string[]).filter((id) => id !== "n1");
      delete (state.links as Loose).l5;
    });
    store.setMapColumns("map_a", { archived: 1, tags: null }, ISSUER);
    const created = store.saveWholeMap("map_c", richState("c_") as unknown as AppState, ISSUER);
    if (!created.ok) throw new Error(created.code);
    store.renameMapId("map_b", "map_renamed", ISSUER);
    edit(store, "map_renamed", (state) => { nodes(state).b_inner.text = "after rename"; });
    store.deleteMap("map_c", ISSUER);
  }

  async function relationships(): Promise<string[]> {
    const session = driver.session();
    try {
      const result = await session.run("MATCH (a:Rec)-[x]->(b:Rec) RETURN a.rk AS a, type(x) AS t, b.rk AS b");
      return result.records.map((row) => `${row.get("a")} -${row.get("t")}-> ${row.get("b")}`).sort();
    } finally {
      await session.close();
    }
  }

  async function engineState() {
    const session = driver.session();
    try {
      return await readEngineState(session);
    } finally {
      await session.close();
    }
  }

  it("holds, after a sequence of commits and a flush, exactly the records of the store", async () => {
    const store = openStore(newDir("sequence"));
    await store.flush();
    expect(serializeSnapshot(await dump(driver))).toBe(serializeSnapshot(store.records()));
    manyCommits(store);
    await store.flush();
    expect(store.engineStatus()).toEqual({ appliedSeq: store.seq() });
    const expected = serializeSnapshot(store.records());
    expect(serializeSnapshot(await dump(driver))).toBe(expected);
    expect(await engineState()).toMatchObject({ marker: { workspaceId: "ws_record_store", appliedSeq: store.seq() } });

    // The derived relationships are those a fresh load of the same records creates.
    const incremental = await relationships();
    const records = store.records();
    await closeStore(store);
    await deleteAllRecords(driver);
    await load(driver, records);
    expect(await relationships()).toEqual(incremental);
    expect(serializeSnapshot(await dump(driver))).toBe(expected);
  });

  it("catches up on open when Neo4j is a few commits behind", async () => {
    const dir = newDir("behind");
    const first = openStore(dir);
    edit(first, "map_a", (state) => { (state.nodes as Record<string, Loose>).leaf.text = "one"; });
    await first.flush();
    await closeStore(first);

    // Commits made while Neo4j is not attached.
    const offline = openStore(dir, false);
    manyCommits(offline);
    const expected = serializeSnapshot(offline.records());
    const seq = offline.seq();
    await closeStore(offline);
    expect((await engineState()).marker).toEqual({ workspaceId: "ws_record_store", appliedSeq: 1 });

    const again = openStore(dir);
    await again.flush();
    expect(again.engineStatus()).toEqual({ appliedSeq: seq });
    expect(serializeSnapshot(await dump(driver))).toBe(expected);
    edit(again, "map_a", (state) => { (state.nodes as Record<string, Loose>).leaf.text = "after catch-up"; });
    await again.flush();
    expect(serializeSnapshot(await dump(driver))).toBe(serializeSnapshot(again.records()));
  });

  it("rebuilds Neo4j when the journal was compacted past the commit Neo4j holds", async () => {
    const dir = newDir("compacted");
    const first = openStore(dir);
    await first.flush();
    await closeStore(first);
    const offline = openStore(dir, false);
    manyCommits(offline);
    offline.compact();
    const expected = serializeSnapshot(offline.records());
    await closeStore(offline);

    const again = openStore(dir);
    await again.flush();
    expect(serializeSnapshot(await dump(driver))).toBe(expected);
  });

  it("takes over a database that was loaded with the snapshot but has no marker", async () => {
    const dir = newDir("preloaded");
    await load(driver, snapshotOf(seedRows()));
    const session = driver.session();
    try {
      await session.run(`MATCH (m:${MARKER_LABEL}) DETACH DELETE m`);
    } finally {
      await session.close();
    }
    const store = openStore(dir);
    edit(store, "map_a", (state) => { (state.nodes as Record<string, Loose>).leaf.text = "one"; });
    await store.flush();
    expect(serializeSnapshot(await dump(driver))).toBe(serializeSnapshot(store.records()));
  });

  it("refuses to open when Neo4j is ahead of the journal or belongs to another workspace", async () => {
    const dir = newDir("ahead");
    const store = openStore(dir);
    edit(store, "map_a", (state) => { (state.nodes as Record<string, Loose>).leaf.text = "one"; });
    await store.flush();
    await closeStore(store);

    // A store of the same workspace that never saw that commit.
    const older = newDir("older");
    expect(() => RecordWorkspaceStore.open(older, { neo4j: { uri: BOLT as string } })).toThrow(/ahead of the journal/);
    const foreign = newDir("foreign", "ws_other");
    expect(() => RecordWorkspaceStore.open(foreign, { neo4j: { uri: BOLT as string } })).toThrow(/belongs to workspace/);
    // The database is as it was.
    const reopened = openStore(dir);
    await reopened.flush();
    expect(serializeSnapshot(await dump(driver))).toBe(serializeSnapshot(reopened.records()));
  });

  it("reports ENGINE_BEHIND while Neo4j cannot be reached; the journal keeps the commits for later", async () => {
    const dir = newDir("unreachable");
    const first = openStore(dir);
    edit(first, "map_a", (state) => { (state.nodes as Record<string, Loose>).leaf.text = "one"; });
    await first.flush();
    await closeStore(first);

    const down = RecordWorkspaceStore.open(dir, { neo4j: { uri: "bolt://127.0.0.1:1" } });
    stores.push(down);
    await expect(down.flush()).rejects.toThrow(/behind/);
    expect(down.engineStatus().error).toBeDefined();
    expect(down.commitMapCommand("map_a", command([]), ISSUER)).toMatchObject({ ok: false, code: "ENGINE_BEHIND" });
    expect((down.getMapRow("map_a").state.nodes as unknown as Record<string, Loose>).leaf.text).toBe("one");
    await closeStore(down);

    const again = openStore(dir);
    edit(again, "map_a", (state) => { (state.nodes as Record<string, Loose>).leaf.text = "two"; });
    await again.flush();
    expect(serializeSnapshot(await dump(driver))).toBe(serializeSnapshot(again.records()));
  }, 60000);

  it("applyCommit is idempotent for the same commit", async () => {
    const records = snapshotOf(seedRows());
    await load(driver, records);
    const commit = {
      seq: 1,
      ops: [
        { op: "put" as const, rk: "node|leaf", record: { kind: "node" as const, id: "leaf", mapId: "map_a", text: "again", rev: 1 } },
        { op: "delete" as const, rk: "details|root" },
      ],
    };
    await applyCommit(driver, "ws_record_store", commit);
    const once = serializeSnapshot(await dump(driver));
    await applyCommit(driver, "ws_record_store", commit);
    expect(serializeSnapshot(await dump(driver))).toBe(once);
    expect(once).toContain('"text":"again"');
    expect(once).not.toContain('"kind":"details","nodeId":"root"');
  });

  it("CLI --verify compares the Neo4j dump with the store byte for byte", async () => {
    const dir = newDir("cli");
    const store = openStore(dir);
    manyCommits(store);
    await store.flush();
    await closeStore(store);
    const lines: string[] = [];
    const io = { out: (line: string) => lines.push(line), err: (line: string) => lines.push(line) };
    expect(await cli(["--verify", dir, "--bolt", BOLT as string], io)).toBe(0);
    expect(lines.join("\n")).toMatch(/neo4j dump: identical/);

    const session = driver.session();
    try {
      await session.run("MATCH (r:Rec {rk: 'node|leaf'}) SET r.f_text = 'tampered'");
    } finally {
      await session.close();
    }
    lines.length = 0;
    expect(await cli(["--verify", dir, "--bolt", BOLT as string], io)).toBe(1);
    expect(lines.join("\n")).toMatch(/differs from the store/);
  });
});
