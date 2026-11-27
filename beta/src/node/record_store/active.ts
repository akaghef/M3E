// The record store the server runs on, when it is switched on.
//
// A workspace that lives in Neo4j is named by M3E_RECORD_STORE or by `neo4j-store.json` in its data
// directory; the server then opens that store from the Neo4j of M3E_NEO4J_BOLT before it listens
// (credentials: M3E_NEO4J_USER / M3E_NEO4J_PASSWORD), and every map read and write goes to it
// (see ./legacy_api.ts). A local (local mode) opens its confirmed and working stores instead.
// Without either, `activeRecordStore()` is null and the server uses SQLite (workspaces that have
// not moved yet).

import fs from "fs";
import path from "path";
import { LocalSync } from "../sync/local";
import { RecordWorkspaceStore } from "./store";
import { SNAPSHOT_FORMAT, type SnapshotRecord } from "../../shared/record_model/types";
import { neo4jConnectionFromEnv } from "./neo4j_durability";

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
let shutdownRegistered = false;

/** Settings file in a data directory whose workspace lives in Neo4j: it names the Neo4j store. Configuration, not data. */
export const NEO4J_STORE_FILE = "neo4j-store.json";

/**
 * The Neo4j store this server runs on, or null when store mode is off (a workspace still on SQLite).
 * M3E_RECORD_STORE wins when set. Otherwise a data directory holding `neo4j-store.json` names it:
 * once a workspace lives in Neo4j, no launcher can open its old SQLite file by leaving the variable out.
 */
export function recordStoreName(env: NodeJS.ProcessEnv = process.env): string | null {
  const named = env.M3E_RECORD_STORE?.trim();
  if (named) return named;
  const dataDir = env.M3E_DATA_DIR?.trim();
  if (!dataDir) return null;
  const file = path.resolve(dataDir, NEO4J_STORE_FILE);
  if (!fs.existsSync(file)) return null;
  const store = (JSON.parse(fs.readFileSync(file, "utf8")) as { store?: unknown }).store;
  if (typeof store !== "string" || store.trim() === "") throw new Error(`${file} names no Neo4j store.`);
  return store;
}

/** No store directory exists any more; kept for callers that still pass one to the push entry. */
export function recordStoreDir(): string | null {
  return null;
}

/** The empty store a remote starts with: only the snapshot header of its workspace. */
function emptyStoreRecords(workspaceId: string): SnapshotRecord[] {
  return [{ kind: "snapshot", format: SNAPSHOT_FORMAT, workspaceId, seq: 0 } as SnapshotRecord];
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * Opens the store before the server listens: the local mode stores, or the one Neo4j store of
 * `recordStoreName()`, made empty when it does not exist yet. While Neo4j does not answer it waits
 * and tries again (the server does not listen meanwhile), so the boot order of Neo4j and M3E does
 * not matter. A store named without M3E_NEO4J_BOLT is an error.
 */
export async function openActiveRecordStore(log: (message: string) => void = (message) => console.error(`[record-store] ${message}`)): Promise<void> {
  if (local || active) return;
  const remote = localModeRemote();
  const name = remote ? null : recordStoreName();
  if (!remote && name === null) return;
  const connection = neo4jConnectionFromEnv();
  if (connection === null) throw new Error(`The record store lives in Neo4j, but M3E_NEO4J_BOLT is not set.`);
  for (let attempt = 0, wait = 500; ; attempt += 1, wait = Math.min(wait * 2, 5000)) {
    try {
      if (remote) {
        await startLocalMode();
      } else {
        try {
          active = await RecordWorkspaceStore.openNeo4j(connection, name as string);
        } catch (error) {
          if (!/^No record store named /.test((error as Error).message)) throw error;
          const workspaceId = process.env.M3E_WORKSPACE_ID?.trim() || (name as string);
          await RecordWorkspaceStore.createInNeo4j(connection, name as string, emptyStoreRecords(workspaceId));
          log(`created the empty store ${name} in Neo4j`);
          active = await RecordWorkspaceStore.openNeo4j(connection, name as string);
        }
      }
      if (attempt > 0) log("Neo4j answers; the store is open.");
      return;
    } catch (error) {
      if (!neo4jUnreachable(error)) throw error;
      if (attempt === 0) log(`waiting for Neo4j at ${connection.uri}: ${(error as Error).message}`);
      await sleep(wait);
    }
  }
}

/** Neo4j did not answer (not started yet, restarting): worth waiting for. Any other error is not. */
function neo4jUnreachable(error: unknown): boolean {
  const code = (error as { code?: string }).code ?? "";
  const message = (error as Error)?.message ?? "";
  return code === "ServiceUnavailable" || code === "SessionExpired" || code === "DATABASE_UNAVAILABLE"
    || /ECONNREFUSED|ServiceUnavailable|Failed to connect|connection.*(closed|refused)|ECONNRESET|socket hang up/i.test(message);
}

/** The opened store; null when store mode is off. `openActiveRecordStore()` must have run first. */
export function activeRecordStore(): RecordWorkspaceStore | null {
  if (local) return local.store();
  return active;
}

/** Waits for every commit to be in Neo4j and closes the store. The next `activeRecordStore()` opens it again. */
export async function closeActiveRecordStore(): Promise<void> {
  const store = active;
  active = null;
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
  if (shutdownRegistered || activeRecordStore() === null) return;
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
