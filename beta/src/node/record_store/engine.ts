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

/** Runs the applier: start once, then one commit after another. Stops at the first failure. */
export class EngineQueue {
  private pending: EngineCommit[] = [];
  private started = false;
  private applied: number;
  private failure: string | undefined;
  private running: Promise<void> | undefined;

  constructor(private readonly applier: EngineApplier, private readonly source: EngineSource) {
    this.applied = 0;
  }

  get appliedSeq(): number {
    return this.applied;
  }

  get error(): string | undefined {
    return this.failure;
  }

  enqueue(commit: EngineCommit): void {
    this.pending.push(commit);
    this.pump();
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
        this.applied = await this.applier.start(this.source);
        this.started = true;
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
    } catch (error) {
      this.failure = error instanceof Error ? error.message : String(error);
    }
  }

  /** Resolves when the engine holds every commit; retries after a failure; rejects when it fails again. */
  async flush(): Promise<void> {
    await this.pump();
    // Commits enqueued while the last run was finishing.
    while (this.failure === undefined && (this.pending.length > 0 || !this.started)) await this.pump();
    if (this.failure !== undefined) throw new Error(`The storage engine is behind: ${this.failure}`);
  }

  async close(): Promise<void> {
    if (this.running) await this.running;
    await this.applier.close();
  }
}
