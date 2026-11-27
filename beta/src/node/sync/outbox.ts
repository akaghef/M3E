/**
 * Device outbox: Commands that are not yet committed or refused, as nodes in the device's Neo4j.
 * Label Outbox, property `store` names that outbox, ordered by `seq`.
 * Append is durable before the caller applies the Command locally or pushes it.
 * A committed or rejected result leaves the node. A rejection is reported so the
 * caller can roll the device state back. The nodes are the resume point after restart.
 *
 * Shape of one entry: {commandId, baseSeq, command, createdAt, mapId}.
 * `mapId` is extra because a push addresses one map; the four fields the spec names are kept.
 *
 * Conflicts use label Conflict and the same durability path.
 * `appendJsonLine` and `readDurableLines` stay for the record store's file helpers.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import type { Neo4jConnection } from "../record_store/neo4j_durability";
import { neo4jConnectionFromEnv } from "../record_store/neo4j_durability";
import type { SyncCommand } from "../record_store/sync_types";
import type { PushResponse, PushResultItem } from "./push";
import { squashUnsent } from "./outbox_squash";

export type OutboxEntry = SyncCommand & {
  commandId: string;
  baseSeq: number;
  createdAt: string;
  mapName?: string;
  issuer?: string;
  /** false is durable proof of never being sent; absent legacy values are unknown. */
  attempted?: boolean;
};

export interface OutboxRejection {
  entry: OutboxEntry;
  code?: string;
  message?: string;
}

export interface DrainReport {
  rejected: OutboxRejection[];
}

interface Statement {
  cypher: string;
  params?: Record<string, unknown>;
}

const nodeRequire = createRequire(__filename);
let worker: Worker | undefined;
let workerFailed: Error | undefined;
let ioSeq = 0;
const waiting = new Set<Int32Array>();
const schemaReady = new Set<string>();

const WORKER_SOURCE = `
const { parentPort, workerData } = require("worker_threads");
const fs = require("fs");
const neo4j = require(workerData.driverPath);
const drivers = new Map();
function driverFor(connection) {
  const key = [connection.uri, connection.user ?? "", connection.password ?? "", connection.database ?? ""].join("\\0");
  let driver = drivers.get(key);
  if (!driver) {
    const auth = connection.user !== undefined ? neo4j.auth.basic(connection.user, connection.password ?? "") : undefined;
    driver = neo4j.driver(connection.uri, auth, { disableLosslessIntegers: true });
    drivers.set(key, driver);
  }
  return driver;
}
function ints(value) {
  if (typeof value === "number" && Number.isInteger(value)) return neo4j.int(value);
  if (Array.isArray(value)) return value.map(ints);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = ints(item);
    return out;
  }
  return value;
}
parentPort.on("message", async (message) => {
  const flag = new Int32Array(message.sab);
  let session;
  try {
    const driver = driverFor(message.connection);
    session = driver.session({
      ...(message.connection.database ? { database: message.connection.database } : {}),
      defaultAccessMode: message.write ? neo4j.session.WRITE : neo4j.session.READ,
    });
    const runAll = async (tx) => {
      const rows = [];
      for (const statement of message.statements) {
        const result = await tx.run(statement.cypher, ints(statement.params ?? {}));
        rows.push(result.records.map((record) => record.toObject()));
      }
      return rows;
    };
    const rows = message.write ? await session.executeWrite(runAll) : await session.executeRead(runAll);
    fs.writeFileSync(message.file, JSON.stringify({ ok: true, rows }));
    Atomics.store(flag, 0, 1);
  } catch (error) {
    const text = error && error.message ? String(error.message) : String(error);
    try { fs.writeFileSync(message.file, JSON.stringify({ ok: false, message: text })); } catch { /* the waiter reports the missing file */ }
    Atomics.store(flag, 0, 2);
  } finally {
    if (session) await session.close().catch(() => {});
  }
  Atomics.notify(flag, 0);
});
`;

function failWaiters(error: Error): void {
  workerFailed = error;
  for (const flag of waiting) {
    Atomics.store(flag, 0, 2);
    Atomics.notify(flag, 0);
  }
}

function workerOf(): Worker {
  if (workerFailed && !worker) throw workerFailed;
  if (!worker) {
    workerFailed = undefined;
    worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { driverPath: nodeRequire.resolve("neo4j-driver") } });
    worker.unref();
    worker.on("error", (error) => failWaiters(error instanceof Error ? error : new Error(String(error))));
    worker.on("exit", (code) => {
      if (code !== 0) failWaiters(new Error(`Outbox worker exited ${code}.`));
      worker = undefined;
    });
  }
  return worker;
}

function runSync(connection: Neo4jConnection, write: boolean, statements: Statement[]): unknown[][] {
  const flag = new Int32Array(new SharedArrayBuffer(4));
  const file = path.join(os.tmpdir(), `m3e-outbox-io-${process.pid}-${ioSeq += 1}.json`);
  waiting.add(flag);
  Atomics.store(flag, 0, 0);
  try {
    workerOf().postMessage({ sab: flag.buffer, file, connection, write, statements });
    const waited = Atomics.wait(flag, 0, 0, 120_000);
    let text = "";
    try { text = fs.readFileSync(file, "utf8"); } catch { /* timed out or the worker died first */ }
    if (waited === "timed-out" || flag[0] === 0) throw new Error("Neo4j outbox write timed out.");
    if (!text) throw workerFailed ?? new Error("Neo4j outbox write failed.");
    const body = JSON.parse(text) as { ok: boolean; rows?: unknown[][]; message?: string };
    if (!body.ok) throw new Error(body.message || "Neo4j outbox write failed.");
    return body.rows ?? [];
  } finally {
    waiting.delete(flag);
    try { fs.unlinkSync(file); } catch { /* already gone */ }
  }
}

/** The durability seam tests replace. DeviceOutbox calls it as a property, so a spy sees every read and write. */
export const outboxIO = {
  run(connection: Neo4jConnection, write: boolean, statements: Statement[]): unknown[][] {
    return runSync(connection, write, statements);
  },
};

function schemaKey(connection: Neo4jConnection): string {
  return `${connection.uri}\0${connection.database ?? ""}`;
}

function ensureSchema(connection: Neo4jConnection): void {
  const key = schemaKey(connection);
  if (schemaReady.has(key)) return;
  // One committed transaction each. A constraint and db.awaitIndexes in the same
  // transaction never finishes: the index stays offline until that transaction commits.
  for (const cypher of [
    "CREATE CONSTRAINT outbox_store_seq IF NOT EXISTS FOR (o:Outbox) REQUIRE (o.store, o.seq) IS UNIQUE",
    "CREATE CONSTRAINT conflict_store_command IF NOT EXISTS FOR (c:Conflict) REQUIRE (c.store, c.commandId) IS UNIQUE",
  ]) {
    outboxIO.run(connection, true, [{ cypher }]);
  }
  schemaReady.add(key);
}

function isEntry(value: unknown): value is OutboxEntry {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Partial<OutboxEntry>;
  return typeof row.commandId === "string" && typeof row.mapId === "string"
    && typeof row.baseSeq === "number" && typeof row.createdAt === "string"
    && typeof row.command === "object" && row.command !== null;
}

export class DeviceOutbox {
  private constructor(private readonly connection: Neo4jConnection, private readonly store: string) {}

  static open(store: string, connection: Neo4jConnection): DeviceOutbox {
    if (!store.trim()) throw new Error("The outbox store name is required.");
    if (!connection?.uri) throw new Error("Local mode needs Neo4j (M3E_NEO4J_BOLT).");
    ensureSchema(connection);
    return new DeviceOutbox(connection, store);
  }

  /** Append one Command. Returns only after the node is durable. */
  append(input: SyncCommand & { commandId: string; baseSeq: number; createdAt?: string; issuer?: string; mapName?: string }): OutboxEntry {
    if (!input.commandId.trim()) throw new Error("commandId is required.");
    if (!input.mapId.trim()) throw new Error("mapId is required.");
    if (!Number.isInteger(input.baseSeq) || input.baseSeq < 0) throw new Error("baseSeq must be a non-negative integer.");
    const entry: OutboxEntry = { ...input, attempted: false, createdAt: input.createdAt ?? new Date().toISOString() };
    this.run(true, [{
      cypher: `OPTIONAL MATCH (o:Outbox {store: $store})
        WITH coalesce(max(o.seq), -1) + 1 AS seq
        CREATE (n:Outbox {store: $store, seq: seq, commandId: $commandId, entry: $entry})`,
      params: { store: this.store, commandId: entry.commandId, entry: JSON.stringify(entry) },
    }]);
    return entry;
  }

  /** Entries still waiting, oldest first. */
  list(): OutboxEntry[] {
    const [rows] = this.run(false, [{
      cypher: "MATCH (o:Outbox {store: $store}) RETURN o.entry AS entry ORDER BY o.seq",
      params: { store: this.store },
    }]);
    return ((rows ?? []) as Array<{ entry?: unknown }>).map((row) => {
      const value = JSON.parse(String(row.entry)) as unknown;
      if (!isEntry(value)) throw new Error("Invalid outbox entry.");
      return value;
    });
  }

  /** Replace the outbox with these entries, in order, including legacy entries that omit `attempted`. */
  replace(entries: OutboxEntry[]): void {
    const rows = entries.map((entry, seq) => ({ seq, commandId: entry.commandId, entry: JSON.stringify(entry) }));
    this.run(true, [
      { cypher: "MATCH (o:Outbox {store: $store}) DETACH DELETE o", params: { store: this.store } },
      { cypher: "UNWIND $rows AS row CREATE (n:Outbox {store: $store, seq: row.seq, commandId: row.commandId, entry: row.entry})", params: { store: this.store, rows } },
    ]);
  }

  squash(protectedIds: ReadonlySet<string> = new Set()): boolean {
    const before = this.list();
    const after = squashUnsent(before, protectedIds);
    if (before.length === after.length && before.every((entry, i) => entry === after[i])) return false;
    this.replace(after);
    return true;
  }

  /** Freeze the complete push selection before any network I/O, once per push (O(pending)). */
  markAttempted(commandIds: ReadonlySet<string>): void {
    const entries = this.list();
    let changed = false;
    for (const entry of entries) if (commandIds.has(entry.commandId) && entry.attempted === false) {
      entry.attempted = true;
      changed = true;
    }
    if (changed) this.replace(entries);
  }

  /**
   * Push the waiting Commands in order. Remove each one the remote committed,
   * duplicated, or rejected. Anything still unknown stays.
   */
  async drain(send: (entries: OutboxEntry[]) => Promise<PushResponse>): Promise<DrainReport> {
    this.squash();
    const pending = this.list();
    if (pending.length === 0) return { rejected: [] };
    this.markAttempted(new Set(pending.map((entry) => entry.commandId)));
    const response = await send(pending);
    if (!response || !Array.isArray(response.results)) throw new Error("The push response has no results.");
    const { rejected, done } = settlePushResults(pending, response.results);
    this.remove(done);
    return { rejected };
  }

  remove(commandIds: ReadonlySet<string>): void {
    if (commandIds.size === 0) return;
    this.replace(this.list().filter((entry) => !commandIds.has(entry.commandId)));
  }

  private run(write: boolean, statements: Statement[]): unknown[][] {
    return outboxIO.run(this.connection, write, statements);
  }
}

export function settlePushResults(pending: OutboxEntry[], results: PushResultItem[]): {
  rejected: OutboxRejection[];
  done: Set<string>;
  committed: number;
  noOp: number;
} {
  const rejected: OutboxRejection[] = [];
  const done = new Set<string>();
  let committed = 0;
  let noOp = 0;
  for (let i = 0; i < pending.length; i += 1) {
    const entry = pending[i]!;
    const result = results[i];
    if (!result || result.commandId !== entry.commandId) continue;
    if (result.status === "rejected" || result.status === "conflict") {
      rejected.push({ entry, code: result.code, message: result.message });
    } else if (result.status === "committed" || result.status === "duplicate") {
      committed += 1;
    } else if (result.status === "no-op") {
      noOp += 1;
    } else continue;
    done.add(entry.commandId);
  }
  return { rejected, done, committed, noOp };
}

/** Remember one conflict. A commandId already stored is left as it was. */
export function rememberConflict(connection: Neo4jConnection, store: string, row: { entry: { commandId: string } }): void {
  ensureSchema(connection);
  outboxIO.run(connection, true, [{
    cypher: "MERGE (c:Conflict {store: $store, commandId: $commandId}) ON CREATE SET c.row = $row",
    params: { store, commandId: row.entry.commandId, row: JSON.stringify(row) },
  }]);
}

export function readConflicts<T>(connection: Neo4jConnection, store: string): T[] {
  ensureSchema(connection);
  const [rows] = outboxIO.run(connection, false, [{
    cypher: "MATCH (c:Conflict {store: $store}) RETURN c.row AS row ORDER BY c.commandId",
    params: { store },
  }]);
  return ((rows ?? []) as Array<{ row?: unknown }>).map((item) => JSON.parse(String(item.row)) as T);
}

/** Delete outbox and conflict nodes for one store name. */
export function deleteSyncNodes(connection: Neo4jConnection, store: string): void {
  outboxIO.run(connection, true, [
    { cypher: "MATCH (o:Outbox {store: $store}) DETACH DELETE o", params: { store } },
    { cypher: "MATCH (c:Conflict {store: $store}) DETACH DELETE c", params: { store } },
  ]);
}

/** Replace a settings file so a crash keeps the previous contents or the new ones. */
export function writeFileDurably(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, content, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, filePath);
  fsyncDir(path.dirname(filePath));
}

/** fsync a directory so that a rename in it survives a crash. Not available on every platform. */
function fsyncDir(dir: string): void {
  let fd: number | undefined;
  try {
    fd = fs.openSync(dir, "r");
    fs.fsyncSync(fd);
  } catch {
    // Windows cannot open a directory for fsync; the rename itself is what the platform offers.
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** Recover a torn tail before any new append; damage before the tail is an error. */
export function readDurableLines<T>(file: string, valid: (row: unknown) => boolean = () => true, repair = false): T[] {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  const rows: T[] = [];
  let position = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.trim() !== "") {
      try {
        const value = JSON.parse(line) as T;
        if (!valid(value)) throw new Error("Invalid JSON Lines entry.");
        rows.push(value);
      } catch (error) {
        if (i < lines.length - 1 || !repair) throw error;
        if (repair) writeFileDurably(file, text.slice(0, position));
        return rows;
      }
    }
    position += line.length + 1;
  }
  if (repair && text !== "" && !text.endsWith("\n")) writeFileDurably(file, text + "\n");
  return rows;
}

export function appendJsonLine(file: string, value: unknown): void {
  const fd = fs.openSync(file, "a+");
  const original = fs.fstatSync(fd).size;
  try {
    const buffer = Buffer.from(JSON.stringify(value) + "\n", "utf8");
    let offset = 0;
    while (offset < buffer.length) offset += fs.writeSync(fd, buffer, offset, buffer.length - offset);
    fs.fsyncSync(fd);
  } catch (error) {
    fs.ftruncateSync(fd, original);
    throw error;
  } finally {
    fs.closeSync(fd);
  }
  fsyncDir(path.dirname(file));
}

export function pushEnvelope({ commandId, baseSeq, createdAt: _at, issuer: _issuer, mapName: _name, attempted: _attempted, ...payload }: OutboxEntry) {
  return { commandId, baseSeq, ...payload };
}

/** Push the outbox named `store` to a server's `/api/sync/push`, in order. The connection is M3E_NEO4J_*. */
export async function pushOutboxFile(store: string, serverBase: string, headers: Record<string, string> = {}): Promise<DrainReport> {
  const connection = neo4jConnectionFromEnv();
  if (!connection?.uri) throw new Error("Local mode needs Neo4j (M3E_NEO4J_BOLT).");
  const outbox = DeviceOutbox.open(store, connection);
  return outbox.drain(async (entries) => {
    const response = await fetch(new URL("/api/sync/push", serverBase), {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({
        commands: entries.map(pushEnvelope),
      }),
    });
    const text = await response.text();
    let body: PushResponse;
    try {
      body = JSON.parse(text) as PushResponse;
    } catch {
      throw new Error(`The push response was not JSON (${response.status}).`);
    }
    if (!response.ok) throw new Error(`The push failed (${response.status}).`);
    return body;
  });
}
