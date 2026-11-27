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

  it("takes a record changed in Neo4j outside a commit into the checks and the journal, and changes nothing when nothing changed", async () => {
    const name = await newStore();
    const store = await openStore(name);
    const state = store.getMapRow("map_a").state as unknown as Loose;
    const first = Object.keys(state.nodes).find((id) => id !== state.rootId) as string;
    // Nothing changed: no commit.
    expect(await store.reconcileIds([first])).toBe(0);
    expect(store.reconcileMap("map_a", await store.mapRecordsFromDatabase("map_a"))).toBe(0);
    const seq = store.seq();
    // Someone changes the node's text in Neo4j directly.
    const neo4j = (await import("neo4j-driver")).default;
    const driver = neo4j.driver(connection.uri);
    try {
      await driver.executeQuery("MATCH (r:Rec {store: $store, id: $id}) WHERE r.kind = 'node' SET r.f_text = 'changed in Neo4j'", { store: name, id: first });
    } finally {
      await driver.close();
    }
    expect(await store.reconcileIds([first])).toBe(1);
    expect(store.seq()).toBe(seq + 1);
    expect((store.getMapRow("map_a").state as unknown as Loose).nodes[first].text).toBe("changed in Neo4j");
    const lines = await store.readJournalAfter(seq);
    expect(lines?.map((line) => line.intent)).toEqual(["database-edit"]);
    // A Command made against the value Neo4j holds passes the check.
    const now = store.getMapRow("map_a").state as unknown as Loose;
    const next = clone(now);
    next.nodes[first].text = "edited after";
    expect(store.commitMapCommand("map_a", command(diffState(now, next), "edit-text", "after-direct"), ISSUER).ok).toBe(true);
    await store.durable();
  });

  it("answers DATABASE_UNAVAILABLE instead of hanging when Neo4j stops answering", async () => {
    const net = await import("net");
    const target = new URL(connection.uri.replace("bolt://", "http://"));
    let silent = false;
    const sockets = new Set<import("net").Socket>();
    const proxy = net.createServer((client) => {
      sockets.add(client);
      const upstream = net.connect(Number(target.port), target.hostname);
      sockets.add(upstream);
      client.on("data", (chunk) => { if (!silent) upstream.write(chunk); });
      upstream.on("data", (chunk) => { if (!silent) client.write(chunk); });
      const end = () => { client.destroy(); upstream.destroy(); };
      client.on("error", end); upstream.on("error", end); client.on("close", end); upstream.on("close", end);
    });
    await new Promise<void>((done) => proxy.listen(0, "127.0.0.1", () => done()));
    const port = (proxy.address() as import("net").AddressInfo).port;
    const proxied = { ...connection, uri: `bolt://127.0.0.1:${port}` };
    const name = `test-${randomUUID()}`;
    names.push(name);
    await RecordWorkspaceStore.createInNeo4j(proxied, name, snapshotOf([{ id: "map_a", state: richState() }]));
    const store = await RecordWorkspaceStore.openNeo4j(proxied, name);
    try {
      expect((await store.mapRecordsFromDatabase("map_a")).length).toBeGreaterThan(0);
      silent = true; // Neo4j stops answering; connections stay open.
      const begun = Date.now();
      await expect(store.mapRecordsFromDatabase("map_a")).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
      expect(Date.now() - begun).toBeLessThan(20000);
      expect(() => store.listMaps()).toThrow(/not available/);
    } finally {
      silent = false;
      for (const socket of sockets) socket.destroy();
      await store.close().catch(() => undefined);
      await new Promise<void>((done) => proxy.close(() => done()));
    }
  }, 120000);
});
