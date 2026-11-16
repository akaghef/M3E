// The derived engine behind the record store. The journal is the source of truth; an applier
// brings the engine (Neo4j) to the same commit, one commit per transaction, in order.

import { spawnSync } from "child_process";
import neo4j, { type Driver } from "neo4j-driver";
import type { SnapshotRecord } from "../../shared/record_model/types";
import { applyCommit, ensureSchema, readEngineState, writeMarker, type RecordOp } from "../neo4j_store/apply";
import { deleteAllRecords, load } from "../neo4j_store/store";

export type { RecordOp };

export interface EngineCommit {
  seq: number;
  /** Every record operation of the commit, including its commit record and the snapshot header. */
  ops: RecordOp[];
}

/** What an applier may ask of the store. All calls are synchronous and describe the same instant. */
export interface EngineSource {
  workspaceId: string;
  seq(): number;
  records(): SnapshotRecord[];
  /** Commits after `seq` up to now, or null when the journal no longer holds all of them. */
  commitsAfter(seq: number): EngineCommit[] | null;
}

export interface EngineApplier {
  /** Brings the engine to the store's current commit and returns the sequence number it then holds. */
  start(source: EngineSource): Promise<number>;
  apply(commit: EngineCommit): Promise<void>;
  close(): Promise<void>;
}

export interface Neo4jOptions {
  uri: string;
  user?: string;
  password?: string;
  database?: string;
}

export class EngineRefusal extends Error {}

function refusal(found: { workspaceId: string; appliedSeq: number } | null, records: number, source: { workspaceId: string; seq: number }): string | null {
  if (records === 0) return null;
  if (found === null) {
    return `The Neo4j database holds ${records} records but nothing says which workspace and commit they are.`;
  }
  if (found.workspaceId !== source.workspaceId) {
    return `The Neo4j database belongs to workspace ${JSON.stringify(found.workspaceId)}, not ${JSON.stringify(source.workspaceId)}.`;
  }
  if (found.appliedSeq > source.seq) {
    return `The Neo4j database is at commit ${found.appliedSeq}, ahead of the journal (commit ${source.seq}).`;
  }
  return null;
}

export class Neo4jApplier implements EngineApplier {
  private driver: Driver | undefined;
  private workspaceId = "";

  constructor(private readonly options: Neo4jOptions) {}

  private getDriver(): Driver {
    if (!this.driver) {
      const auth = this.options.user !== undefined
        ? neo4j.auth.basic(this.options.user, this.options.password ?? "")
        : undefined;
      this.driver = neo4j.driver(this.options.uri, auth);
    }
    return this.driver;
  }

  async start(source: EngineSource): Promise<number> {
    const driver = this.getDriver();
    const database = this.options.database;
    this.workspaceId = source.workspaceId;
    const session = driver.session({ database, defaultAccessMode: neo4j.session.WRITE });
    try {
      await ensureSchema(session);
      const state = await readEngineState(session);
      const found = state.marker ?? state.header;
      const message = refusal(state.records === 0 ? null : found, state.records, { workspaceId: source.workspaceId, seq: source.seq() });
      if (message !== null) throw new EngineRefusal(message);

      const rebuild = async (): Promise<number> => {
        // Same instant: the records and the commit they belong to.
        const records = source.records();
        const seq = source.seq();
        // A load is many transactions. Until the last one, the marker says "before any commit",
        // so that a load that stopped half-way is started over instead of being trusted.
        await writeMarker(session, { workspaceId: source.workspaceId, appliedSeq: -1 });
        await load(driver, records, { database });
        await writeMarker(session, { workspaceId: source.workspaceId, appliedSeq: seq });
        return seq;
      };
      if (state.records === 0 || found === null) return await rebuild();
      if (found.appliedSeq === source.seq()) {
        if (state.marker === null) await writeMarker(session, found);
        return found.appliedSeq;
      }
      const missing = found.appliedSeq < 0 ? null : source.commitsAfter(found.appliedSeq);
      if (missing === null) {
        // The journal was compacted past the commit the database holds: build it again from the records.
        await deleteAllRecords(driver, { database });
        return await rebuild();
      }
      let applied = found.appliedSeq;
      for (const commit of missing) {
        await applyCommit(driver, source.workspaceId, commit, { database });
        applied = commit.seq;
      }
      if (missing.length === 0) await writeMarker(session, { workspaceId: source.workspaceId, appliedSeq: applied });
      return applied;
    } finally {
      await session.close();
    }
  }

  async apply(commit: EngineCommit): Promise<void> {
    await applyCommit(this.getDriver(), this.workspaceId, commit, { database: this.options.database });
  }

  async close(): Promise<void> {
    const driver = this.driver;
    this.driver = undefined;
    if (driver) await driver.close();
  }
}

const PROBE_SCRIPT = `
const neo4j = require(process.argv[1]);
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  const options = JSON.parse(input);
  const auth = options.user !== undefined ? neo4j.auth.basic(options.user, options.password || "") : undefined;
  const driver = neo4j.driver(options.uri, auth, { connectionTimeout: 5000, maxTransactionRetryTime: 5000 });
  const session = driver.session({ database: options.database });
  const num = (value) => (neo4j.isInt(value) ? value.toNumber() : Number(value));
  const pair = (result) => {
    const row = result.records[0];
    if (!row || row.get("w") === null || row.get("s") === null) return null;
    return { workspaceId: String(row.get("w")), appliedSeq: num(row.get("s")) };
  };
  try {
    const count = await session.run("MATCH (r:Rec) RETURN count(r) AS n");
    const marker = await session.run("MATCH (m:RecordStoreMarker) RETURN m.workspaceId AS w, m.appliedSeq AS s LIMIT 1");
    const header = await session.run("MATCH (h:Rec:Snapshot) RETURN h.f_workspaceId AS w, h.f_seq AS s LIMIT 1");
    process.stdout.write(JSON.stringify({ records: num(count.records[0].get("n")), marker: pair(marker), header: pair(header) }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: String(error && error.message ? error.message : error) }));
  } finally {
    await session.close();
    await driver.close();
  }
});
`;

/**
 * `open` is synchronous, the driver is not. This asks the database, in a short-lived child
 * process, which workspace and commit it holds, and throws when the store must refuse to open:
 * the database is ahead of the journal or belongs to another workspace. When the database
 * cannot be asked at all, nothing is thrown here; the applier reports that as an engine error.
 */
export function assertNeo4jUsable(options: Neo4jOptions, source: { workspaceId: string; seq: number }): void {
  let driverPath: string;
  try {
    driverPath = require.resolve("neo4j-driver");
  } catch {
    return;
  }
  const child = spawnSync(process.execPath, ["-e", PROBE_SCRIPT, driverPath], {
    input: JSON.stringify(options),
    encoding: "utf8",
    timeout: 20000,
  });
  if (child.error || child.status !== 0 || !child.stdout) return;
  let state: { error?: string; records?: number; marker?: { workspaceId: string; appliedSeq: number } | null; header?: { workspaceId: string; appliedSeq: number } | null };
  try {
    state = JSON.parse(child.stdout);
  } catch {
    return;
  }
  if (state.error !== undefined || typeof state.records !== "number") return;
  const message = refusal(state.marker ?? state.header ?? null, state.records, source);
  if (message !== null) throw new EngineRefusal(message);
}

export interface EngineRetryOptions {
  /** Wait before the first retry after a failure, in milliseconds (default 500). Doubles up to `maxMs`. */
  firstMs?: number;
  /** Longest wait between two retries, in milliseconds (default 30,000). */
  maxMs?: number;
}

/**
 * Runs the applier: start, then one commit after another, in order.
 *
 * A failure does not stop the store: the journal holds every commit, so the queue lets go of what
 * it was holding, waits (500 ms, doubling up to 30 s), and starts the applier again. Starting
 * brings the engine from whatever commit it holds to the journal's current one, and the commits
 * made after that follow from the queue. `error` is set from a failure until the engine has
 * caught up again.
 */
export class EngineQueue {
  private pending: EngineCommit[] = [];
  private started = false;
  private everStarted = false;
  private applied = 0;
  /** The journal position when the queue was made: the backlog is counted from here until the applier has started once. */
  private readonly baseSeq: number;
  private failure: string | undefined;
  private running: Promise<void> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly firstDelay: number;
  private readonly maxDelay: number;
  private delay: number;
  private closed = false;

  constructor(private readonly applier: EngineApplier, private readonly source: EngineSource, retry: EngineRetryOptions = {}) {
    this.baseSeq = source.seq();
    this.firstDelay = Math.max(1, retry.firstMs ?? 500);
    this.maxDelay = Math.max(this.firstDelay, retry.maxMs ?? 30000);
    this.delay = this.firstDelay;
  }

  get appliedSeq(): number {
    return this.applied;
  }

  get error(): string | undefined {
    return this.failure;
  }

  /** Commits the engine does not hold yet, given the journal's current commit. */
  backlog(currentSeq: number): number {
    return Math.max(0, currentSeq - (this.everStarted ? this.applied : this.baseSeq));
  }

  enqueue(commit: EngineCommit): void {
    if (this.closed) return;
    // While a failed engine waits for its retry nothing is held here: the journal has the commit,
    // and the next start reads it from there.
    if (this.started || this.running) this.pending.push(commit);
    if (this.retryTimer === undefined) void this.pump();
  }

  /** Starts working through the queue unless that is already happening. */
  pump(): Promise<void> {
    if (!this.running) {
      this.running = this.run().finally(() => {
        this.running = undefined;
      });
    }
    return this.running;
  }

  private async run(): Promise<void> {
    try {
      if (!this.started) {
        // Everything up to now is in the journal, which `start` reads; commits made while it
        // runs are queued behind it and skipped below when `start` already covered them.
        this.pending = [];
        this.applied = await this.applier.start(this.source);
        this.started = true;
        this.everStarted = true;
      }
      while (this.pending.length > 0) {
        const commit = this.pending[0];
        if (commit.seq > this.applied) {
          await this.applier.apply(commit);
          this.applied = commit.seq;
        }
        this.pending.shift();
      }
      this.failure = undefined;
      this.delay = this.firstDelay;
    } catch (error) {
      this.failure = error instanceof Error ? error.message : String(error);
      // What the engine holds now is not known for sure: the next attempt asks it and catches up
      // from the journal.
      this.started = false;
      this.pending = [];
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.closed || this.retryTimer !== undefined) return;
    const wait = this.delay;
    this.delay = Math.min(this.delay * 2, this.maxDelay);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.pump();
    }, wait);
    // A waiting retry must not keep the process alive.
    this.retryTimer.unref?.();
  }

  private cancelRetry(): void {
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }

  /** Resolves when the engine holds every commit. After a failure it tries again at once, and rejects when that fails too. */
  async flush(): Promise<void> {
    this.cancelRetry();
    await this.pump();
    // Commits enqueued while the last run was finishing.
    while (this.failure === undefined && (this.pending.length > 0 || !this.started)) await this.pump();
    if (this.failure !== undefined) throw new Error(`The storage engine is behind: ${this.failure}`);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.cancelRetry();
    if (this.running) await this.running;
    this.cancelRetry();
    await this.applier.close();
  }
}
