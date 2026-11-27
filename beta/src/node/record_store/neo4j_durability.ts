// Neo4j as the database of a record store: the durable state, the journal (the exchange of
// committed changes with other devices) and the resend results all live in Neo4j.
// Design: .kiro/specs/rapid-persistence-redesign/neo4j-database-design.md.
//
// One Neo4j database holds several stores. Record nodes of a store carry its label
// (`storeLabel(name)`); journal entries, resend results, retired ids and per-map commit numbers
// carry the store name as a property and are unique per store.
//
// The store computes a commit in its own process and hands the result here; nothing is answered
// to a client before `durable()` resolves, i.e. before the Neo4j transaction holding the commit
// has committed. Units are written in order. When a write fails, or Neo4j stops answering the
// health probe, the connection is marked unavailable: the units not yet written are dropped (they
// were never answered as committed), waiting clients are refused, and the store reads its state
// again from Neo4j once Neo4j answers.

import { readFileSync } from "fs";
import neo4j, { type Driver, type ManagedTransaction } from "neo4j-driver";
import type { SnapshotRecord } from "../../shared/record_model/types";
import { applyOps, ensureSchema, writeMarker, type RecordOp } from "../neo4j_store/apply";
import { storeLabel } from "../neo4j_store/encoding";
import { dump } from "../neo4j_store/store";

export interface Neo4jConnection {
  uri: string;
  user?: string;
  password?: string;
  database?: string;
}

/** A remembered Command result as stored: `mapIds` as a list, `result` without the map state. */
export interface StoredCommand {
  seq: number;
  hash: string;
  canonicalHash?: string;
  syncHash?: string;
  mapIds: string[];
  result?: unknown;
}

export interface CommitUnit {
  kind: "commit";
  seq: number;
  workspaceId: string;
  /** The journal line in the exchange format of push and pull. */
  line: unknown;
  /** Record operations, including the commit record and the snapshot header. */
  ops: RecordOp[];
  commands: Array<[string, StoredCommand]>;
  /** Node ids whose reuse is forbidden (with the body an equal put must have), or null when allowed again. */
  retired: Array<[string, string | null]>;
  mapSeq: Array<[string, number | null]>;
}

export type DurableUnit =
  | CommitUnit
  | { kind: "result"; commandId: string; entry: StoredCommand }
  | { kind: "forget"; commandIds: string[] };

export interface LoadedStore {
  records: SnapshotRecord[];
  commands: Array<[string, StoredCommand]>;
  retired: Array<[string, string]>;
  mapSeq: Array<[string, number]>;
}

const JOURNAL = "JournalEntry";
const RESULT = "CommandResult";
const RETIRED = "RetiredId";
const MAP_SEQ = "MapSeq";
/** Units written in one transaction at most. */
const BATCH = 64;

function toNumber(value: unknown): number {
  return neo4j.isInt(value) ? value.toNumber() : Number(value);
}

function driverOf(connection: Neo4jConnection): Driver {
  const auth = connection.user !== undefined ? neo4j.auth.basic(connection.user, connection.password ?? "") : undefined;
  return neo4j.driver(connection.uri, auth, { disableLosslessIntegers: false });
}

function encodeCommand(commandId: string, entry: StoredCommand): Record<string, unknown> {
  return {
    commandId,
    seq: neo4j.int(entry.seq),
    hash: entry.hash,
    canonicalHash: entry.canonicalHash ?? null,
    syncHash: entry.syncHash ?? null,
    mapIds: entry.mapIds,
    result: entry.result === undefined ? null : JSON.stringify(entry.result),
  };
}

function decodeCommand(row: Record<string, unknown>): [string, StoredCommand] {
  const entry: StoredCommand = {
    seq: toNumber(row.seq),
    hash: String(row.hash),
    mapIds: Array.isArray(row.mapIds) ? row.mapIds.map(String) : [],
  };
  if (typeof row.canonicalHash === "string") entry.canonicalHash = row.canonicalHash;
  if (typeof row.syncHash === "string") entry.syncHash = row.syncHash;
  if (typeof row.result === "string") entry.result = JSON.parse(row.result);
  return [String(row.commandId), entry];
}

export class Neo4jDurability {
  readonly label: string;
  private readonly queue: DurableUnit[] = [];
  /** Units handed in so far; `durable()` waits until `written` reaches the count at its call. */
  private handed = 0;
  private written = 0;
  private running: Promise<void> | undefined;
  private failure: string | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private delay = 200;
  private waiters: Array<{ target: number; resolve: () => void; reject: (error: Error) => void }> = [];
  private closed = false;
  private broken: string | undefined;
  private probe: ReturnType<typeof setInterval> | undefined;
  /** Told once when Neo4j becomes unavailable; the store then reads itself again with `reload()`. */
  onUnavailable: ((reason: string) => void) | undefined;

  private constructor(private readonly driver: Driver, readonly store: string, private readonly database: string | undefined) {
    this.label = storeLabel(store);
  }

  /** Connects, makes the schema, and reads the store; `loaded` is null when the store does not exist yet. */
  static async open(connection: Neo4jConnection, store: string): Promise<{ durability: Neo4jDurability; loaded: LoadedStore | null }> {
    const durability = new Neo4jDurability(driverOf(connection), store, connection.database);
    try {
      await durability.ensureSchema();
      return { durability, loaded: await durability.load() };
    } catch (error) {
      await durability.driver.close();
      throw error;
    }
  }

  get error(): string | undefined {
    return this.broken ?? this.failure;
  }

  /** True while Neo4j cannot be used: nothing is written, read or answered from the store. */
  get unavailable(): boolean {
    return this.broken !== undefined;
  }

  private unavailableError(): Error {
    return Object.assign(new Error(`The database (Neo4j) is not available: ${this.broken ?? this.failure ?? "no answer"}`), { code: "DATABASE_UNAVAILABLE" });
  }

  /** Marks Neo4j unavailable: drops the units not yet written and refuses everyone waiting for them. */
  private markUnavailable(reason: string): void {
    if (this.broken !== undefined || this.closed) return;
    this.broken = reason;
    console.warn(`[record-store] Neo4j is not available for ${this.store}: ${reason}`);
    this.handed -= this.queue.length;
    this.queue.length = 0;
    const waiting = this.waiters;
    this.waiters = [];
    for (const waiter of waiting) waiter.reject(this.unavailableError());
    this.onUnavailable?.(reason);
  }

  /** Starts the health probe: one trivial query per second; a failure marks Neo4j unavailable. */
  startProbe(intervalMs = 1000): void {
    if (this.probe !== undefined) return;
    this.probe = setInterval(() => {
      if (this.broken !== undefined || this.closed) return;
      void this.ping(Math.max(500, intervalMs * 2)).catch((error) => this.markUnavailable((error as Error).message));
    }, intervalMs);
    this.probe.unref?.();
  }

  private async ping(timeoutMs: number): Promise<void> {
    const session = this.session(false);
    try {
      await session.run("RETURN 1", {}, { timeout: timeoutMs });
    } finally {
      await session.close();
    }
  }

  /** Resolves when Neo4j answers now; rejects with code DATABASE_UNAVAILABLE otherwise. For reads that must not serve state while Neo4j is down. */
  async reachable(timeoutMs = 3000): Promise<void> {
    if (this.broken !== undefined) throw this.unavailableError();
    try {
      await Promise.race([
        this.ping(timeoutMs),
        new Promise((_, reject) => { const t = setTimeout(() => reject(new Error("no answer")), timeoutMs); t.unref?.(); }),
      ]);
    } catch (error) {
      this.markUnavailable((error as Error).message);
      throw this.unavailableError();
    }
  }

  /** Reads the store again once Neo4j answers; null while it does not. Clears the unavailable mark. */
  async reload(): Promise<LoadedStore | null> {
    try {
      await this.ping(3000);
      const loaded = await this.load();
      if (loaded === null) throw new Error(`The Neo4j store ${this.store} is gone.`);
      this.broken = undefined;
      this.failure = undefined;
      this.written = this.handed;
      return loaded;
    } catch {
      return null;
    }
  }

  private session(write: boolean) {
    return this.driver.session({ database: this.database, defaultAccessMode: write ? neo4j.session.WRITE : neo4j.session.READ });
  }

  private async ensureSchema(): Promise<void> {
    const session = this.session(true);
    try {
      await ensureSchema(session);
      await session.run(`CREATE CONSTRAINT journal_store_seq IF NOT EXISTS FOR (j:${JOURNAL}) REQUIRE (j.store, j.seq) IS UNIQUE`);
      await session.run(`CREATE CONSTRAINT result_store_id IF NOT EXISTS FOR (c:${RESULT}) REQUIRE (c.store, c.commandId) IS UNIQUE`);
      await session.run(`CREATE CONSTRAINT retired_store_id IF NOT EXISTS FOR (r:${RETIRED}) REQUIRE (r.store, r.id) IS UNIQUE`);
      await session.run(`CREATE CONSTRAINT mapseq_store_map IF NOT EXISTS FOR (m:${MAP_SEQ}) REQUIRE (m.store, m.mapId) IS UNIQUE`);
      await session.run("CALL db.awaitIndexes(600)");
    } finally {
      await session.close();
    }
  }

  private async load(): Promise<LoadedStore | null> {
    const records = await dump(this.driver, { database: this.database, store: this.store });
    if (records.length === 0) return null;
    const session = this.session(false);
    try {
      const store = this.store;
      const commands: Array<[string, StoredCommand]> = [];
      for await (const row of session.run(`MATCH (c:${RESULT} {store: $store}) RETURN properties(c) AS p`, { store })) {
        commands.push(decodeCommand(row.get("p") as Record<string, unknown>));
      }
      const retired: Array<[string, string]> = [];
      for await (const row of session.run(`MATCH (r:${RETIRED} {store: $store}) RETURN r.id AS id, r.body AS body`, { store })) {
        retired.push([String(row.get("id")), String(row.get("body"))]);
      }
      const mapSeq: Array<[string, number]> = [];
      for await (const row of session.run(`MATCH (m:${MAP_SEQ} {store: $store}) RETURN m.mapId AS mapId, m.seq AS seq`, { store })) {
        mapSeq.push([String(row.get("mapId")), toNumber(row.get("seq"))]);
      }
      return { records, commands, retired, mapSeq };
    } finally {
      await session.close();
    }
  }

  /** Writes a whole store at once (a new store, a clone, a one-time migration). The store must be empty. */
  static async create(connection: Neo4jConnection, store: string, input: LoadedStore & { lines?: Array<{ seq: number; line: unknown }> }): Promise<void> {
    const { durability, loaded } = await Neo4jDurability.open(connection, store);
    try {
      if (loaded !== null) throw new Error(`The Neo4j store ${store} already exists.`);
      const { load } = await import("../neo4j_store/store");
      await load(durability.driver, input.records, { database: durability.database, store });
      const session = durability.session(true);
      try {
        const chunk = <T,>(items: T[]): T[][] => {
          const out: T[][] = [];
          for (let i = 0; i < items.length; i += 5000) out.push(items.slice(i, i + 5000));
          return out;
        };
        for (const rows of chunk(input.commands.map(([id, entry]) => encodeCommand(id, entry)))) {
          await session.executeWrite((tx) => tx.run(`UNWIND $rows AS row CREATE (c:${RESULT}) SET c = row, c.store = $store`, { rows, store }));
        }
        for (const rows of chunk(input.retired.map(([id, body]) => ({ id, body })))) {
          await session.executeWrite((tx) => tx.run(`UNWIND $rows AS row CREATE (r:${RETIRED} {store: $store, id: row.id, body: row.body})`, { rows, store }));
        }
        for (const rows of chunk(input.mapSeq.map(([mapId, seq]) => ({ mapId, seq: neo4j.int(seq) })))) {
          await session.executeWrite((tx) => tx.run(`UNWIND $rows AS row CREATE (m:${MAP_SEQ} {store: $store, mapId: row.mapId, seq: row.seq})`, { rows, store }));
        }
        for (const rows of chunk((input.lines ?? []).map(({ seq, line }) => ({ seq: neo4j.int(seq), line: JSON.stringify(line) })))) {
          await session.executeWrite((tx) => tx.run(`UNWIND $rows AS row CREATE (j:${JOURNAL} {store: $store, seq: row.seq, line: row.line})`, { rows, store }));
        }
      } finally {
        await session.close();
      }
    } finally {
      await durability.close();
    }
  }

  /** Deletes a whole store (a local's working store before it is built again). */
  static async drop(connection: Neo4jConnection, store: string): Promise<void> {
    const driver = driverOf(connection);
    try {
      const label = storeLabel(store);
      const session = driver.session({ database: connection.database, defaultAccessMode: neo4j.session.WRITE });
      try {
        for (const query of [
          `MATCH (r:Rec {store: $store}) WITH r LIMIT 10000 DETACH DELETE r RETURN count(*) AS n`,
          `MATCH (j:${JOURNAL} {store: $store}) WITH j LIMIT 10000 DELETE j RETURN count(*) AS n`,
          `MATCH (c:${RESULT} {store: $store}) WITH c LIMIT 10000 DELETE c RETURN count(*) AS n`,
          `MATCH (r:${RETIRED} {store: $store}) WITH r LIMIT 10000 DELETE r RETURN count(*) AS n`,
          `MATCH (m:${MAP_SEQ} {store: $store}) WITH m LIMIT 10000 DELETE m RETURN count(*) AS n`,
        ]) {
          for (;;) {
            const result = await session.executeWrite((tx) => tx.run(query, { store }));
            if (toNumber(result.records[0].get("n")) === 0) break;
          }
        }
        await session.run(`MATCH (m:RecordStoreMarker {name: $store}) DELETE m`, { store });
      } finally {
        await session.close();
      }
    } finally {
      await driver.close();
    }
  }

  enqueue(unit: DurableUnit): void {
    if (this.closed) throw new Error("The record store's database connection is closed.");
    if (this.broken !== undefined) throw this.unavailableError();
    this.queue.push(unit);
    this.handed += 1;
    if (this.retryTimer === undefined) void this.pump();
  }

  /** Resolves when every unit handed in so far is in Neo4j. Rejects after `timeoutMs` while Neo4j cannot be written. */
  durable(timeoutMs = 15000): Promise<void> {
    if (this.broken !== undefined) return Promise.reject(this.unavailableError());
    const target = this.handed;
    if (this.written >= target) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const waiter = { target, resolve, reject };
      this.waiters.push(waiter);
      const timer = setTimeout(() => {
        // Not written in time: what was not written is dropped, so a refused commit never appears later.
        this.markUnavailable(this.failure ?? "no answer from Neo4j");
      }, timeoutMs);
      timer.unref?.();
      waiter.resolve = () => {
        clearTimeout(timer);
        resolve();
      };
      waiter.reject = (error: Error) => {
        clearTimeout(timer);
        reject(error);
      };
    });
  }

  private pump(): Promise<void> {
    if (!this.running) this.running = this.run().finally(() => { this.running = undefined; });
    return this.running;
  }

  private async run(): Promise<void> {
    while (this.queue.length > 0) {
      const batch = this.queue.slice(0, BATCH);
      const session = this.session(true);
      try {
        await session.executeWrite(async (tx) => {
          for (const unit of batch) await this.write(tx, unit);
        });
      } catch (error) {
        this.failure = error instanceof Error ? error.message : String(error);
        this.markUnavailable(`a write failed: ${this.failure}`);
        return;
      } finally {
        await session.close();
      }
      this.queue.splice(0, batch.length);
      this.written += batch.length;
      this.failure = undefined;
      this.delay = 200;
      const ready = this.waiters.filter((waiter) => waiter.target <= this.written);
      this.waiters = this.waiters.filter((waiter) => waiter.target > this.written);
      for (const waiter of ready) waiter.resolve();
    }
  }

  private scheduleRetry(): void {
    if (this.closed || this.retryTimer !== undefined) return;
    const wait = this.delay;
    this.delay = Math.min(this.delay * 2, 10000);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.pump();
    }, wait);
    this.retryTimer.unref?.();
  }

  private async write(tx: ManagedTransaction, unit: DurableUnit): Promise<void> {
    const store = this.store;
    if (unit.kind === "result") {
      await tx.run(`MERGE (c:${RESULT} {store: $store, commandId: $commandId}) SET c += $props`, {
        store, commandId: unit.commandId, props: encodeCommand(unit.commandId, unit.entry),
      });
      return;
    }
    if (unit.kind === "forget") {
      await tx.run(`UNWIND $ids AS id MATCH (c:${RESULT} {store: $store, commandId: id}) DELETE c`, { store, ids: unit.commandIds });
      return;
    }
    await applyOps(tx, unit.ops, this.store);
    await tx.run(`CREATE (j:${JOURNAL} {store: $store, seq: $seq, line: $line})`, {
      store, seq: neo4j.int(unit.seq), line: JSON.stringify(unit.line),
    });
    for (const [commandId, entry] of unit.commands) {
      await tx.run(`MERGE (c:${RESULT} {store: $store, commandId: $commandId}) SET c += $props`, {
        store, commandId, props: encodeCommand(commandId, entry),
      });
    }
    const retire = unit.retired.filter(([, body]) => body !== null).map(([id, body]) => ({ id, body }));
    const allow = unit.retired.filter(([, body]) => body === null).map(([id]) => id);
    if (retire.length > 0) {
      await tx.run(`UNWIND $rows AS row MERGE (r:${RETIRED} {store: $store, id: row.id}) SET r.body = row.body`, { store, rows: retire });
    }
    if (allow.length > 0) {
      await tx.run(`UNWIND $ids AS id MATCH (r:${RETIRED} {store: $store, id: id}) DELETE r`, { store, ids: allow });
    }
    for (const [mapId, seq] of unit.mapSeq) {
      if (seq === null) await tx.run(`MATCH (m:${MAP_SEQ} {store: $store, mapId: $mapId}) DELETE m`, { store, mapId });
      else await tx.run(`MERGE (m:${MAP_SEQ} {store: $store, mapId: $mapId}) SET m.seq = $seq`, { store, mapId, seq: neo4j.int(seq) });
    }
    await writeMarker(tx, { workspaceId: unit.workspaceId, appliedSeq: unit.seq }, store);
  }

  /** Journal lines after `afterSeq`, through `throughSeq`, in order. Waits for pending writes first. */
  async readLines(afterSeq: number, throughSeq: number): Promise<unknown[]> {
    await this.durable();
    const session = this.session(false);
    try {
      const result = await session.run(
        `MATCH (j:${JOURNAL} {store: $store}) WHERE j.seq > $after AND j.seq <= $through RETURN j.seq AS seq, j.line AS line ORDER BY j.seq`,
        { store: this.store, after: neo4j.int(afterSeq), through: neo4j.int(throughSeq) },
      );
      const lines = result.records.map((row) => ({ seq: toNumber(row.get("seq")), line: JSON.parse(String(row.get("line"))) }));
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i].seq !== afterSeq + 1 + i) throw Object.assign(new Error(`The journal in Neo4j lacks commit ${afterSeq + 1 + i}.`), { code: "JOURNAL_GAP" });
      }
      if (lines.length !== Math.max(0, throughSeq - afterSeq)) throw Object.assign(new Error(`The journal in Neo4j ends before commit ${throughSeq}.`), { code: "JOURNAL_GAP" });
      return lines.map((item) => item.line);
    } finally {
      await session.close();
    }
  }

  /** Records of one map (and the shared records it shows), read by query, for display. */
  async mapRecords(mapId: string): Promise<SnapshotRecord[]> {
    await this.durable();
    const { decodeRecord } = await import("../neo4j_store/encoding");
    const session = this.session(false);
    try {
      const result = await session.run(
        `MATCH (r:Rec {store: $store, f_mapId: $mapId}) RETURN properties(r) AS p
         UNION ALL MATCH (r:Rec {store: $store, id: $mapId}) WHERE r.kind = 'map' RETURN properties(r) AS p
         UNION ALL MATCH (r:Rec:ExtensionDef {store: $store}) RETURN properties(r) AS p`,
        { mapId, store: this.store },
      );
      return result.records.map((row) => decodeRecord(row.get("p") as never));
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    if (this.probe !== undefined) clearInterval(this.probe);
    this.probe = undefined;
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    if (this.running) await this.running;
    if (this.queue.length > 0 && this.broken === undefined) {
      try {
        await this.durable(5000);
      } catch {
        // Not durable: those commits were never answered as committed.
      }
    }
    this.closed = true;
    await this.driver.close();
  }
}

/**
 * The Neo4j the record store runs on, from the environment: M3E_NEO4J_BOLT (required),
 * M3E_NEO4J_USER with the password from the file M3E_NEO4J_PASSWORD_FILE (preferred, so that no
 * secret is in a launcher or a process listing) or M3E_NEO4J_PASSWORD; no user means the server has
 * no authentication. M3E_NEO4J_DATABASE names the database (the server's default when omitted).
 * Null when M3E_NEO4J_BOLT is unset.
 */
export function neo4jConnectionFromEnv(env: NodeJS.ProcessEnv = process.env, prefix = "M3E_NEO4J"): Neo4jConnection | null {
  const uri = env[`${prefix}_BOLT`]?.trim();
  if (!uri) return null;
  const connection: Neo4jConnection = { uri };
  const user = env[`${prefix}_USER`]?.trim();
  if (user) {
    connection.user = user;
    const file = env[`${prefix}_PASSWORD_FILE`]?.trim();
    connection.password = file ? readFileSync(file, "utf8").replace(/\r?\n$/, "") : env[`${prefix}_PASSWORD`] ?? "";
  }
  const database = env[`${prefix}_DATABASE`]?.trim();
  if (database) connection.database = database;
  return connection;
}
