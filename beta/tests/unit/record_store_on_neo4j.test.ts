// The record store with Neo4j as its database: the state, the journal and the resend results live
// in Neo4j, no file is read or written, and a store opened again comes back from Neo4j alone.
// Uses the disposable test Neo4j (M3E_TEST_NEO4J_BOLT) and fails when it is unreachable.

import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { RecordWorkspaceStore } from "../../src/node/record_store";
import { Neo4jDurability } from "../../src/node/record_store/neo4j_durability";
import { diffState } from "../../src/shared/map_changes";
import { ISSUER, clone, command, richState, snapshotOf, tempDir, type Loose } from "./record_store_helpers";
import { TEST_NEO4J } from "./neo4j_test_store";

const connection = TEST_NEO4J;

describe("record store on Neo4j", () => {
  const names: string[] = [];
  const open: RecordWorkspaceStore[] = [];

  afterEach(async () => {
    for (const store of open.splice(0)) await store.close();
    for (const name of names.splice(0)) await Neo4jDurability.drop(connection, name);
  });

  async function newStore(): Promise<string> {
    const name = `test-${randomUUID()}`;
    names.push(name);
    await RecordWorkspaceStore.createInNeo4j(connection, name, snapshotOf([{ id: "map_a", state: richState() }]));
    return name;
  }

  async function openStore(name: string): Promise<RecordWorkspaceStore> {
    const store = await RecordWorkspaceStore.openNeo4j(connection, name);
    open.push(store);
    return store;
  }

  async function closeStore(store: RecordWorkspaceStore): Promise<void> {
    open.splice(open.indexOf(store), 1);
    await store.close();
  }

  it("keeps a commit in Neo4j and gives it back to a store opened again, with no file", async () => {
    const cwd = tempDir("neo4j-cwd");
    const before = fs.readdirSync(cwd);
    const name = await newStore();
    const store = await openStore(name);
    expect(store.onNeo4j()).toBe(true);
    const state = store.getMapRow("map_a").state as unknown as Loose;
    const next = clone(state);
    const first = Object.keys(next.nodes).find((id) => id !== next.rootId) as string;
    next.nodes[first].text = "written to Neo4j";
    const result = store.commitMapCommand("map_a", command(diffState(state, next), "edit-text", "neo4j-edit-1"), ISSUER);
    expect(result.ok).toBe(true);
    await store.durable();
    const seq = store.seq();
    await closeStore(store);

    const again = await openStore(name);
    expect(again.seq()).toBe(seq);
    expect((again.getMapRow("map_a").state as unknown as Loose).nodes[first].text).toBe("written to Neo4j");
    // The same Command again: the first result, from the resend record in Neo4j.
    const replay = again.commitMapCommand("map_a", command(diffState(state, next), "edit-text", "neo4j-edit-1"), ISSUER);
    expect(replay).toMatchObject({ ok: true, seq, replayed: true });
    // The journal line is in Neo4j for pull.
    const lines = await again.readJournalAfter(seq - 1);
    expect(lines?.map((line) => line.commandId)).toEqual(["neo4j-edit-1"]);
    // Display reads come from Neo4j by query.
    const records = await again.mapRecordsFromDatabase("map_a");
    expect(records?.some((record) => record.kind === "node" && (record as Loose).text === "written to Neo4j")).toBe(true);
    expect(fs.readdirSync(cwd)).toEqual(before);
    expect(fs.existsSync(path.join(cwd, "snapshot.jsonl"))).toBe(false);
  });

  it("remembers a deterministic refusal in Neo4j across a reopen", async () => {
    const name = await newStore();
    const store = await openStore(name);
    const state = store.getMapRow("map_a").state as unknown as Loose;
    const first = Object.keys(state.nodes).find((id) => id !== state.rootId) as string;
    const stale = clone(state);
    stale.nodes[first].text = "stale";
    const staleChanges = diffState({ ...state, nodes: { ...state.nodes, [first]: { ...state.nodes[first], text: "not the current text" } } }, stale);
    const refused = store.commitMapCommand("map_a", command(staleChanges, "edit-text", "neo4j-refused"), ISSUER);
    expect(refused).toMatchObject({ ok: false, code: "CONFLICT" });
    await store.durable();
    await closeStore(store);
    const again = await openStore(name);
    expect(again.commitMapCommand("map_a", command(staleChanges, "edit-text", "neo4j-refused"), ISSUER)).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("writes commit after commit when each comes right after the previous one became durable", async () => {
    const name = await newStore();
    const store = await openStore(name);
    let state = store.getMapRow("map_a").state as unknown as Loose;
    const first = Object.keys(state.nodes).find((id) => id !== state.rootId) as string;
    for (let i = 0; i < 20; i += 1) {
      const next = clone(state);
      next.nodes[first].text = `back to back ${i}`;
      expect(store.commitMapCommand("map_a", command(diffState(state, next), "edit-text", `back-to-back-${i}`), ISSUER).ok).toBe(true);
      const begun = Date.now();
      await store.durable();
      expect(Date.now() - begun).toBeLessThan(5000);
      state = next;
    }
    const again = await (async () => { await closeStore(store); return openStore(name); })();
    expect((again.getMapRow("map_a").state as unknown as Loose).nodes[first].text).toBe("back to back 19");
  });
});
