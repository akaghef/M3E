// Record stores for tests, in the Neo4j named by M3E_TEST_NEO4J_BOLT (default: the local
// bolt://127.0.0.1:7687). Each store has a name of its own, so tests never see each other's
// records; `dropTestStores()` in afterEach deletes them. There is no file-backed store.

import { randomUUID } from "crypto";
import { RecordWorkspaceStore, type OpenOptions } from "../../src/node/record_store";
import { Neo4jDurability, type Neo4jConnection } from "../../src/node/record_store/neo4j_durability";
import type { SnapshotRecord } from "../../src/shared/record_model/types";

export const TEST_NEO4J: Neo4jConnection = { uri: process.env.M3E_TEST_NEO4J_BOLT ?? "bolt://127.0.0.1:7687" };

const made: string[] = [];
const opened: RecordWorkspaceStore[] = [];

export interface TestStore {
  store: RecordWorkspaceStore;
  name: string;
  /** Waits until every commit is in Neo4j, closes the store, and opens it again from Neo4j. */
  reopen(options?: OpenOptions): Promise<RecordWorkspaceStore>;
}

/** A new store in Neo4j holding `records` (snapshot header first), opened. */
export async function createTestStore(records: SnapshotRecord[], options: OpenOptions = {}): Promise<TestStore> {
  const name = `test-${randomUUID()}`;
  made.push(name);
  await RecordWorkspaceStore.createInNeo4j(TEST_NEO4J, name, records);
  const handle: TestStore = {
    name,
    store: await openTestStore(name, options),
    async reopen(again: OpenOptions = options) {
      await handle.store.durable();
      await handle.store.close();
      handle.store = await openTestStore(name, again);
      return handle.store;
    },
  };
  return handle;
}

/** Opens an existing test store by name. */
export async function openTestStore(name: string, options: OpenOptions = {}): Promise<RecordWorkspaceStore> {
  const store = await RecordWorkspaceStore.openNeo4j(TEST_NEO4J, name, options);
  opened.push(store);
  return store;
}

/** A fresh name for a store a test creates itself (a clone, a working store); dropped by `dropTestStores`. */
export function testStoreName(): string {
  const name = `test-${randomUUID()}`;
  made.push(name);
  return name;
}

/** Closes every store opened by the helpers and deletes every store they made. */
export async function dropTestStores(): Promise<void> {
  for (const store of opened.splice(0)) await store.close().catch(() => undefined);
  for (const name of made.splice(0)) await Neo4jDurability.drop(TEST_NEO4J, name);
}
