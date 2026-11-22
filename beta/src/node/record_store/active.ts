// The record store the server runs on, when it is switched on.
//
// With the environment variable M3E_STORE_DIR set, or with a migrated store in the workspace's data
// directory (`<M3E_DATA_DIR>/store/snapshot.jsonl`), every map read and write of the server goes to
// ONE `RecordWorkspaceStore` opened on that directory (see ./legacy_api.ts for how the existing
// persistence calls are answered). Without either, `activeRecordStore()` is null and the server
// uses SQLite exactly as before. With M3E_NEO4J_BOLT set as well, every commit is mirrored
// to that Neo4j server (credentials: M3E_NEO4J_USER / M3E_NEO4J_PASSWORD, as in record_store_cli).
// While Neo4j cannot be reached commits go on (the journal is the source of truth) and the applier
// retries; they are refused only when Neo4j is M3E_ENGINE_BACKLOG_LIMIT commits behind (default 10,000).

import fs from "fs";
import os from "os";
import path from "path";
import { LocalSync } from "../sync/local";
import { RecordWorkspaceStore, type OpenOptions } from "./store";

let local: LocalSync | null = null;

/**
 * The remote a local runs against, or null when the server is not a local. M3E_SYNC_REMOTE wins
 * (it is needed for the first clone). Otherwise a data directory that holds a clone
 * (`sync/remote.json`) is a local of the remote recorded there: once cloned, no launcher can open
 * the working store as a remote of its own by leaving M3E_SYNC_REMOTE out.
 */
export function localModeRemote(env: NodeJS.ProcessEnv = process.env): string | null {
  const remote = env.M3E_SYNC_REMOTE?.trim();
  if (remote) return remote;
  const dataDir = env.M3E_DATA_DIR?.trim();
  if (!dataDir) return null;
  const metadata = path.resolve(dataDir, "sync", "remote.json");
  if (!fs.existsSync(metadata)) return null;
  const origin = (JSON.parse(fs.readFileSync(metadata, "utf8")) as { origin?: unknown }).origin;
  if (typeof origin !== "string" || origin.trim() === "") throw new Error(`${metadata} names no remote origin.`);
  return origin;
}

export async function startLocalMode(): Promise<void> {
  const remote = localModeRemote();
  if (!remote) return;
  const dataDir = process.env.M3E_DATA_DIR?.trim();
  if (!dataDir) throw new Error("Local mode requires M3E_DATA_DIR.");
  local = await LocalSync.open(dataDir, remote);
}

export function localModeStore(): LocalSync | null {
  return local;
}

let active: RecordWorkspaceStore | null = null;
let activeDir: string | null = null;
let shutdownRegistered = false;

/**
 * The directory of the record store, or null when store mode is off.
 * M3E_STORE_DIR wins when set. Otherwise a workspace whose data directory (M3E_DATA_DIR) holds a
 * migrated store, `store/snapshot.jsonl`, runs on that store: once a workspace is migrated, no
 * launcher can open its frozen SQLite file for writing by leaving M3E_STORE_DIR out.
 */
export function recordStoreDir(): string | null {
  if (local) return local.storeDir();
  const dir = process.env.M3E_STORE_DIR?.trim();
  if (dir) return path.resolve(dir);
  const dataDir = process.env.M3E_DATA_DIR?.trim();
  if (!dataDir) return null;
  const migrated = path.resolve(dataDir, "store");
  return fs.existsSync(path.join(migrated, "snapshot.jsonl")) ? migrated : null;
}

function assertNotLiveM3e(dir: string): void {
  if (process.env.M3E_FORBID_LIVE_DATA !== "1") return;
  const live = path.join(os.homedir(), "Library", "Application Support", "M3E");
  if (dir === live || dir.startsWith(live + path.sep)) {
    throw new Error("Refusing to run on a record store inside the live M3E data directory (M3E_FORBID_LIVE_DATA=1).");
  }
}

/** The one store of `recordStoreDir()`, opened on first use; null when that is null (no M3E_STORE_DIR and no migrated store in M3E_DATA_DIR). */
export function activeRecordStore(): RecordWorkspaceStore | null {
  if (local) return local.store();
  const dir = recordStoreDir();
  if (dir === null) return null;
  if (active !== null && activeDir === dir) return active;
  if (active !== null) throw new Error(`M3E_STORE_DIR changed while the record store of ${activeDir} is open.`);
  assertNotLiveM3e(dir);
  const options: OpenOptions = { engineRetry: { log: (message) => console.error(`[record-store] ${message}`) } };
  const bolt = process.env.M3E_NEO4J_BOLT?.trim();
  if (bolt) {
    options.neo4j = { uri: bolt };
    const user = process.env.M3E_NEO4J_USER;
    if (user) {
      options.neo4j.user = user;
      options.neo4j.password = process.env.M3E_NEO4J_PASSWORD ?? "";
    }
  }
  active = RecordWorkspaceStore.open(dir, options);
  activeDir = dir;
  return active;
}

/** Brings Neo4j up to the last commit and closes the store. The next `activeRecordStore()` opens it again. */
export async function closeActiveRecordStore(): Promise<void> {
  const store = active;
  active = null;
  activeDir = null;
  if (store) await store.close();
  if (local) {
    await local.close();
    local = null;
  }
}

/**
 * For the server process: on SIGINT / SIGTERM the store is closed (which waits for Neo4j) before
 * the process ends. Does nothing when store mode is off, so the default signal behaviour stays.
 */
export function closeActiveRecordStoreOnSignal(): void {
  if (shutdownRegistered || recordStoreDir() === null) return;
  shutdownRegistered = true;
  let stopping = false;
  const stop = (): void => {
    if (stopping) return;
    stopping = true;
    closeActiveRecordStore()
      .catch((error) => { console.error(`[record-store] close failed: ${(error as Error).message}`); })
      .finally(() => { process.exit(0); });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
