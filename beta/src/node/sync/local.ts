import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import neo4j from "neo4j-driver";
import type { SnapshotRecord } from "../../shared/record_model/types";
import { Neo4jDurability, neo4jConnectionFromEnv, type Neo4jConnection } from "../record_store/neo4j_durability";
import { LOCAL_REBASE_INTENT, RecordWorkspaceStore, type JournalLine } from "../record_store/store";
import { sameSyncIdentity, type SyncIdentity } from "../record_store/sync_types";
import { accountForConnection, LOCAL_HUMAN_ACCOUNT_ID } from "./issuer";
import { deleteSyncNodes, DeviceOutbox, pushEnvelope, readConflicts, rememberConflict, settlePushResults, writeFileDurably, type OutboxEntry, type OutboxRejection } from "./outbox";
import type { PushResultItem } from "./push";

interface RemoteMetadata extends SyncIdentity {
  origin: string;
  confirmedSeq: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
  pushBlocked?: PushBlocked;
  /**
   * The working store at `workingSeq` holds what the confirmed store holds at `confirmedSeq`;
   * every working commit after it is a pending Command, in outbox order.
   */
  working?: { confirmedSeq: number; workingSeq: number };
  /** Increments when the working store is built again. A rebase keeps the number. */
  workingGeneration?: number;
}

interface Clone extends SyncIdentity {
  snapshotSeq: number;
  records: SnapshotRecord[];
  index?: string;
}

interface Conflict extends OutboxRejection {
  at: string;
}

type RemoteState = "ok" | "unreachable" | "refused";

interface PushBlocked {
  state: "blocked";
  code: "PUSH_COMMAND_TOO_LARGE";
  commandId: string;
  mapName: string;
  intent: string;
  reason: string;
  bytes: number;
  limitBytes?: number;
}

export class LocalSyncError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly limitBytes?: number) { super(message); }
}

/**
 * Names of one device's stores in Neo4j: `<workspaceId>:confirmed`, `<workspaceId>:working`, and
 * the outbox and conflicts of that device. A device has one data directory per workspace. Only
 * tests share one Neo4j between data directories; they set M3E_LOCAL_STORE_SUFFIX=data-dir, and the
 * names then end in a hash of the data directory.
 */
export function deviceStoreNames(workspaceId: string, dataDir: string, env: NodeJS.ProcessEnv = process.env): {
  confirmed: string; working: string; outbox: string; conflicts: string;
} {
  const suffix = env.M3E_LOCAL_STORE_SUFFIX === "data-dir"
    ? `:${createHash("sha256").update(path.resolve(dataDir)).digest("hex").slice(0, 12)}`
    : "";
  const name = (kind: string) => `${workspaceId}:${kind}${suffix}`;
  return { confirmed: name("confirmed"), working: name("working"), outbox: name("outbox"), conflicts: name("conflicts") };
}

/** Drop confirmed and working stores, and the outbox and conflict nodes, for every data directory under `root`. */
export async function dropDevicesUnder(connection: Neo4jConnection, root: string): Promise<void> {
  const dirs: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let names: string[];
    try { names = fs.readdirSync(dir); } catch { continue; }
    if (names.includes("remote.json") && path.basename(dir) === "sync") dirs.push(path.dirname(dir));
    for (const name of names) {
      if (name === "node_modules" || name === ".git") continue;
      const full = path.join(dir, name);
      try { if (fs.statSync(full).isDirectory()) stack.push(full); } catch { /* skip */ }
    }
  }
  for (const dataDir of dirs) {
    let workspaceId = "";
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dataDir, "sync", "remote.json"), "utf8")) as { workspaceId?: unknown };
      if (typeof meta.workspaceId === "string") workspaceId = meta.workspaceId;
    } catch { continue; }
    if (!workspaceId) continue;
    const names = deviceStoreNames(workspaceId, dataDir);
    await Neo4jDurability.drop(connection, names.confirmed);
    await Neo4jDurability.drop(connection, names.working);
    deleteSyncNodes(connection, names.outbox);
    deleteSyncNodes(connection, names.conflicts);
  }
}

/** The clone index is not part of `createInNeo4j` (records only). It still holds map revisions, so a clone keeps `savedAt`. */
async function applyCloneIndex(connection: Neo4jConnection, store: string, index: string | undefined): Promise<void> {
  if (!index?.trim()) return;
  const body = JSON.parse(index) as {
    mapSeq?: Record<string, number>;
    retired?: Record<string, string>;
    commandResults?: Array<[string, { seq: number; hash: string; canonicalHash?: string; syncHash?: string; mapIds: string[]; result?: unknown }]>;
  };
  const mapSeq = Object.entries(body.mapSeq ?? {}).map(([mapId, seq]) => ({ mapId, seq: neo4j.int(seq) }));
  const retired = Object.entries(body.retired ?? {}).map(([id, retiredBody]) => ({ id, body: retiredBody }));
  const commands = (body.commandResults ?? []).map(([commandId, entry]) => ({
    commandId, seq: neo4j.int(entry.seq), hash: entry.hash,
    canonicalHash: entry.canonicalHash ?? null, syncHash: entry.syncHash ?? null,
    mapIds: entry.mapIds, result: entry.result === undefined ? null : JSON.stringify(entry.result),
  }));
  if (mapSeq.length === 0 && retired.length === 0 && commands.length === 0) return;
  const auth = connection.user !== undefined ? neo4j.auth.basic(connection.user, connection.password ?? "") : undefined;
  const driver = neo4j.driver(connection.uri, auth, { disableLosslessIntegers: false });
  const session = driver.session({ ...(connection.database ? { database: connection.database } : {}), defaultAccessMode: neo4j.session.WRITE });
  try {
    if (mapSeq.length > 0) await session.run("UNWIND $rows AS row CREATE (m:MapSeq {store: $store, mapId: row.mapId, seq: row.seq})", { store, rows: mapSeq });
    if (retired.length > 0) await session.run("UNWIND $rows AS row CREATE (r:RetiredId {store: $store, id: row.id, body: row.body})", { store, rows: retired });
    if (commands.length > 0) await session.run("UNWIND $rows AS row CREATE (c:CommandResult) SET c = row, c.store = $store", { store, rows: commands });
  } finally {
    await session.close();
    await driver.close();
  }
}

function assertNotLiveM3e(dir: string): void {
  if (process.env.M3E_FORBID_LIVE_DATA !== "1") return;
  const live = path.join(os.homedir(), "Library", "Application Support", "M3E");
  if (dir === live || dir.startsWith(live + path.sep)) {
    throw new Error("Refusing to run on a record store inside the live M3E data directory (M3E_FORBID_LIVE_DATA=1).");
  }
}

function identityOf(body: Partial<SyncIdentity>): SyncIdentity {
  const { workspaceId, historyId, epoch } = body;
  if (typeof workspaceId !== "string" || workspaceId === "" || typeof historyId !== "string"
      || historyId === "" || typeof epoch !== "number" || !Number.isSafeInteger(epoch) || epoch < 1) {
    throw new LocalSyncError(409, "FENCED", "The remote did not supply a workspace and history identity.");
  }
  return { workspaceId, historyId, epoch };
}

const GATEWAY_DOWN = new Set([502, 503, 504]);

async function request<T>(url: URL, options?: RequestInit): Promise<T> {
  let response: Response;
  let body: T & { code?: string };
  try {
    response = await fetch(url, { ...options, redirect: "manual", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new LocalSyncError(503, "REMOTE_UNREACHABLE", "The remote could not be reached.");
  }
  // A gateway in front of the remote (tailscale serve, a reverse proxy) answers 502 / 503 / 504
  // while the remote process is down: the remote is unreachable, it has not refused anything.
  if (GATEWAY_DOWN.has(response.status)) {
    throw new LocalSyncError(503, "REMOTE_UNREACHABLE", "The remote could not be reached.");
  }
  if (response.status === 413) {
    // Proxies may return HTML instead of the remote's JSON error.
    const refusal = await response.json().catch(() => null) as { limitBytes?: unknown } | null;
    const limit = refusal?.limitBytes;
    throw new LocalSyncError(413, "PUSH_BODY_TOO_LARGE", "The remote refused the push body size.",
      typeof limit === "number" && Number.isSafeInteger(limit) && limit > 0 ? limit : undefined);
  }
  try {
    body = await response.json() as typeof body;
  } catch (error) {
    if (error instanceof SyntaxError) throw new LocalSyncError(502, "REMOTE_REFUSED", "The remote did not return a sync response.");
    throw new LocalSyncError(503, "REMOTE_UNREACHABLE", "The remote could not be reached.");
  }
  if (response.status === 409 && body?.code === "FENCED") {
    throw new LocalSyncError(409, "FENCED", "The remote refused synchronization for this workspace or history.");
  }
  if (!response.ok || !body || typeof body !== "object") {
    throw new LocalSyncError(502, "REMOTE_REFUSED", "The remote refused synchronization.");
  }
  return body;
}

/** Target request size, not a Command limit: a larger Command travels alone. */
const PUSH_BATCH_BYTES = 4_000_000;

function pushHeaders(entry: OutboxEntry): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (outboxIssuer(entry) !== LOCAL_HUMAN_ACCOUNT_ID) {
    headers["x-m3e-connection"] = "mcp";
    headers["x-m3e-actor-instance"] = entry.command.actor.id;
  }
  return headers;
}

function outboxIssuer(entry: OutboxEntry): string {
  const mcp = accountForConnection({ kind: "mcp", instanceId: entry.command.actor.id }).accountId;
  return entry.issuer === mcp ? mcp : LOCAL_HUMAN_ACCOUNT_ID;
}

/**
 * Wait until the store's commits are in Neo4j, then one microtask more.
 * The durability pump clears its running flag only after `durable()` resumes the caller.
 * A commit enqueued in that same turn never starts.
 */
async function settled(store: RecordWorkspaceStore): Promise<void> {
  await store.durable();
  await Promise.resolve();
}

export class LocalSync {
  private readonly syncDir: string;
  private readonly metadataFile: string;
  private outbox!: DeviceOutbox;
  private readonly conflicts = new Map<string, Conflict>();
  private metadata!: RemoteMetadata;
  private confirmed!: RecordWorkspaceStore;
  private working!: RecordWorkspaceStore;
  private remoteState: RemoteState = "unreachable";
  private fenced: LocalSyncError | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  /** Records the working store changed after its base: what a rebase resets to the confirmed values. */
  private dirty = new Set<string>();
  /** Maps those commits addressed. */
  private dirtyMaps = new Set<string>();
  /** Commands committed in the working store after its base, forgotten so a rebase can commit them again. */
  private committedSinceBase: Array<{ mapId: string; commandId: string; newMapId?: string }> = [];
  /** A push or a refusal changed the pending set since the base. */
  private pendingChanged = false;

  private constructor(private readonly dataDir: string, private readonly origin: string, private readonly connection: Neo4jConnection) {
    this.syncDir = path.join(dataDir, "sync");
    this.metadataFile = path.join(this.syncDir, "remote.json");
    fs.mkdirSync(this.syncDir, { recursive: true });
  }

  static async open(dataDir: string, origin: string, connection?: Neo4jConnection | null): Promise<LocalSync> {
    const url = new URL(origin);
    if (!/^https?:$/.test(url.protocol) || url.origin !== origin.replace(/\/$/, "")) {
      throw new Error("M3E_SYNC_REMOTE must be an HTTP(S) origin.");
    }
    const resolved = connection === undefined ? neo4jConnectionFromEnv() : connection;
    if (!resolved?.uri) throw new Error("Local mode needs Neo4j (M3E_NEO4J_BOLT).");
    const dir = path.resolve(dataDir);
    assertNotLiveM3e(dir);
    // Never replace a record store or a SQLite workspace with a clone.
    const recorded = fs.existsSync(path.join(dir, "sync", "remote.json"));
    if (!recorded && fs.existsSync(dir) && fs.readdirSync(dir).some((name) => name !== "sync")) {
      throw new Error("Local mode needs an empty data directory for the initial clone.");
    }
    const local = new LocalSync(dir, url.origin, resolved);
    try {
      let cloned = !recorded;
      if (recorded) {
        local.metadata = JSON.parse(fs.readFileSync(local.metadataFile, "utf8")) as RemoteMetadata;
        identityOf(local.metadata);
        try {
          local.confirmed = await local.openConfirmed();
        } catch (error) {
          // A device bound to the remote whose confirmed store is not in its Neo4j yet (the store moved
          // into Neo4j, or the device's Neo4j was rebuilt): clone again, but only the same history.
          if (!/^No record store named /.test((error as Error).message)) throw error;
          const clone = await request<Clone>(new URL("/api/sync/clone?index=1", url));
          if (!sameSyncIdentity(local.metadata, identityOf(clone))) throw new Error("The remote holds a different history than this device was bound to.");
          await local.installClone(clone);
          local.metadata = { ...local.metadata, ...identityOf(clone), confirmedSeq: clone.snapshotSeq };
          local.remoteState = "ok";
          cloned = true;
        }
        if (!sameSyncIdentity(local.metadata, local.confirmed.syncIdentity())) throw new Error("The confirmed store is from a different history.");
        if (local.confirmed.seq() < local.metadata.confirmedSeq) throw new Error("The confirmed store moved backwards.");
      } else {
        const clone = await request<Clone>(new URL("/api/sync/clone?index=1", url));
        await local.installClone(clone);
        local.metadata = { ...identityOf(clone), origin: url.origin, confirmedSeq: clone.snapshotSeq, lastPushAt: null, lastPullAt: null };
        local.remoteState = "ok";
      }
      local.bindDevice();
      local.persistMetadata();
      if (cloned || !(await local.resume())) await local.rebuild();
      await settled(local.working);
      await settled(local.confirmed);
      return local;
    } catch (error) {
      await local.close();
      throw error;
    }
  }

  store(): RecordWorkspaceStore { return this.working; }

  /** Stable across a rebase. Changes when the working store is built again. */
  storeDir(): string {
    return `${this.names().working}#${this.metadata.workingGeneration ?? 0}`;
  }

  async close(): Promise<void> {
    await this.queue;
    await this.confirmed?.close();
    await this.working?.close();
  }

  private names() {
    return deviceStoreNames(this.metadata.workspaceId, this.dataDir);
  }

  private bindDevice(): void {
    const names = this.names();
    this.outbox = DeviceOutbox.open(names.outbox, this.connection);
    for (const conflict of readConflicts<Conflict>(this.connection, names.conflicts)) {
      if (typeof conflict?.at === "string" && typeof conflict.entry?.commandId === "string") {
        this.conflicts.set(conflict.entry.commandId, conflict);
      }
    }
  }

  private persistMetadata(): void {
    this.metadata.confirmedSeq = this.confirmed.seq();
    writeFileDurably(this.metadataFile, JSON.stringify(this.metadata) + "\n");
  }

  private openConfirmed(): Promise<RecordWorkspaceStore> {
    return RecordWorkspaceStore.openNeo4j(this.connection, this.names().confirmed, { warm: false });
  }

  private async installClone(clone: Clone): Promise<void> {
    const header = clone.records?.[0];
    if (header?.kind !== "snapshot" || header.seq !== clone.snapshotSeq || !sameSyncIdentity(identityOf(clone), header)) {
      throw new LocalSyncError(409, "FENCED", "The snapshot header does not match the remote response.");
    }
    const name = deviceStoreNames(identityOf(clone).workspaceId, this.dataDir).confirmed;
    const previous = this.confirmed;
    const fallback = previous ? previous.records() : undefined;
    const fallbackIndex = previous && fallback ? previous.snapshotIndex(fallback) : undefined;
    await previous?.close();
    let next: RecordWorkspaceStore | undefined;
    try {
      await Neo4jDurability.drop(this.connection, name);
      await RecordWorkspaceStore.createInNeo4j(this.connection, name, clone.records);
      await applyCloneIndex(this.connection, name, clone.index);
      next = await RecordWorkspaceStore.openNeo4j(this.connection, name, { warm: false });
      if (next.seq() !== clone.snapshotSeq) throw new Error("The snapshot does not end at its declared sequence.");
      this.confirmed = next;
    } catch (error) {
      await next?.close().catch(() => {});
      if (fallback) {
        try {
          await Neo4jDurability.drop(this.connection, name);
          await RecordWorkspaceStore.createInNeo4j(this.connection, name, fallback);
          await applyCloneIndex(this.connection, name, fallbackIndex);
          this.confirmed = await RecordWorkspaceStore.openNeo4j(this.connection, name, { warm: false });
        } catch { /* report the clone error */ }
      }
      throw error;
    }
  }

  private preserve(rejections: OutboxRejection[]): void {
    for (const rejected of rejections) {
      const id = rejected.entry.commandId;
      if (this.conflicts.has(id)) continue;
      const row = { ...rejected, at: new Date().toISOString() };
      rememberConflict(this.connection, this.names().conflicts, row);
      this.conflicts.set(id, row);
      this.pendingChanged = true;
    }
  }

  conflictList(): Array<Conflict & { mapName: string; intent: string; reason: string }> {
    return [...this.conflicts.values()].map((row) => ({
      ...row, mapName: row.entry.mapName || this.working.listMaps().find((map) => map.id === row.entry.mapId)?.rootText || "Map",
      intent: row.entry.command.intent, reason: row.message ?? row.code ?? "The Command conflicted with the remote.",
    }));
  }

  /** Watch the working store's commits: their records and Commands are what the next rebase undoes. */
  private track(store: RecordWorkspaceStore): void {
    this.dirty = new Set();
    this.dirtyMaps = new Set();
    this.committedSinceBase = [];
    store.setCommitListener((line) => {
      if (line.intent === LOCAL_REBASE_INTENT) return;
      for (const op of line.ops) this.dirty.add(op.rk);
      if (line.mapId) this.dirtyMaps.add(line.mapId);
      if (line.newMapId) this.dirtyMaps.add(line.newMapId);
      if (line.commandId !== undefined) this.committedSinceBase.push({ mapId: line.mapId, commandId: line.commandId, newMapId: line.newMapId });
    });
  }

  private captureInto(store: RecordWorkspaceStore): void {
    store.setCapture((payload, issuer, at, mapName) => {
      this.outbox.append({ ...payload, commandId: payload.command.commandId, baseSeq: this.metadata.confirmedSeq, createdAt: at, issuer, mapName });
    });
  }

  /** Commit pending Commands on the working store in order; a refused one becomes a conflict. */
  private replay(store: RecordWorkspaceStore, entries: OutboxEntry[]): void {
    const failed: OutboxRejection[] = [];
    for (const entry of entries) {
      const result = store.commitSyncCommand(pushEnvelopePayload(entry), outboxIssuer(entry));
      if (!result.ok) failed.push({ entry, code: result.code, message: result.message });
    }
    this.preserve(failed);
    this.outbox.remove(new Set(this.conflicts.keys()));
  }

  private pending(): OutboxEntry[] {
    return this.outbox.list().filter((entry) => !this.conflicts.has(entry.commandId));
  }

  private setBase(workingSeq: number): void {
    this.metadata.working = { confirmedSeq: this.confirmed.seq(), workingSeq };
    this.pendingChanged = false;
    this.persistMetadata();
  }

  /**
   * Full rebuild: a new working store from every confirmed record, then the pending Commands.
   * Proportional to the workspace; used only for a clone, a reclone, or a working store that
   * cannot be resumed.
   */
  private async rebuild(): Promise<string[]> {
    const records = this.confirmed.records();
    const index = this.confirmed.snapshotIndex(records);
    const name = this.names().working;
    const previous = this.working;
    const fallback = previous ? previous.records() : undefined;
    const fallbackIndex = previous && fallback ? previous.snapshotIndex(fallback) : undefined;
    const changed = new Set(previous ? previous.listMaps().map((map) => map.id) : []);
    await previous?.close();
    let next: RecordWorkspaceStore | undefined;
    try {
      await Neo4jDurability.drop(this.connection, name);
      await RecordWorkspaceStore.createInNeo4j(this.connection, name, records);
      await applyCloneIndex(this.connection, name, index);
      next = await RecordWorkspaceStore.openNeo4j(this.connection, name, { warm: false });
      const base = next.seq();
      this.track(next);
      this.replay(next, this.pending());
      await settled(next);
      for (const map of next.listMaps()) changed.add(map.id);
      this.captureInto(next);
      this.working = next;
      this.metadata.workingGeneration = (this.metadata.workingGeneration ?? 0) + 1;
      this.setBase(base);
    } catch (error) {
      await next?.close().catch(() => {});
      if (fallback) {
        try {
          await Neo4jDurability.drop(this.connection, name);
          await RecordWorkspaceStore.createInNeo4j(this.connection, name, fallback);
          await applyCloneIndex(this.connection, name, fallbackIndex);
          this.working = await RecordWorkspaceStore.openNeo4j(this.connection, name, { warm: false });
          this.captureInto(this.working);
        } catch { /* report the rebuild error */ }
      }
      throw error;
    }
    return [...changed];
  }

  /**
   * Rebase the working store onto the confirmed store after `delta` arrived: reset the records the
   * pending Commands or the delta touched to their confirmed values, then commit the pending
   * Commands again. Proportional to the delta and the pending Commands, never to the workspace.
   */
  private async rebase(delta: JournalLine[]): Promise<string[]> {
    const rks = new Set(this.dirty);
    const changed = new Set(this.dirtyMaps);
    for (const line of delta) {
      for (const op of line.ops) rks.add(op.rk);
      if (line.mapId) changed.add(line.mapId);
      if (line.newMapId) changed.add(line.newMapId);
    }
    const pending = this.pending();
    let base: number;
    try {
      // A no-op leaves no line, so every pending Command is forgotten, not only those with a commit.
      // resetRecords forgets tentative successes, never deterministic refusals. Remote refusals
      // stay recorded and pending() excludes them, including after restart or rebuild.
      const forget = [...this.committedSinceBase, ...pending.map((entry) => ({ mapId: entry.mapId, commandId: entry.commandId, newMapId: entry.mapOp === "rename" ? entry.newMapId : undefined }))];
      base = this.working.resetRecords(rks, (rk) => this.confirmed.record(rk), forget);
      await settled(this.working);
      this.track(this.working);
      this.replay(this.working, pending);
      await settled(this.working);
    } catch (error) {
      // The working store is half rebased: forget its base, so the next pull or start rebuilds it.
      this.metadata.working = undefined;
      this.persistMetadata();
      throw error;
    }
    for (const entry of pending) {
      changed.add(entry.mapId);
      if (entry.mapOp === "rename") changed.add(entry.newMapId);
    }
    this.setBase(base);
    return [...changed];
  }

  /**
   * Open the working store as it was left, when its base still describes it: no full rebuild at
   * start. False when the store cannot be resumed; the caller rebuilds it.
   */
  private async resume(): Promise<boolean> {
    const base = this.metadata.working;
    if (!base) return false;
    let store: RecordWorkspaceStore | undefined;
    try {
      store = await RecordWorkspaceStore.openNeo4j(this.connection, this.names().working, { warm: false });
      const lines = store.seq() >= base.workingSeq ? await store.readJournalAfter(base.workingSeq) : null;
      const delta = await this.confirmed.readJournalAfter(base.confirmedSeq);
      const expected = this.pending();
      // Each line is the commit of a pending Command, in outbox order. A pending Command that was a
      // no-op left no line, so the lines are matched as a subsequence of the pending Commands.
      let next = 0;
      const matched = !!lines && lines.every((line) => {
        if (line.commandId === undefined) return false;
        while (next < expected.length && expected[next]!.commandId !== line.commandId) next += 1;
        if (next === expected.length) return false;
        next += 1;
        return true;
      });
      if (!lines || !delta || !sameSyncIdentity(store.syncIdentity(), this.confirmed.syncIdentity())) {
        await store.close();
        return false;
      }
      this.working = store;
      this.track(store);
      for (const line of lines) {
        for (const op of line.ops) this.dirty.add(op.rk);
        if (line.mapId) this.dirtyMaps.add(line.mapId);
        if (line.newMapId) this.dirtyMaps.add(line.newMapId);
        this.committedSinceBase.push({ mapId: line.mapId, commandId: line.commandId!, newMapId: line.newMapId });
      }
      // A Command written to the outbox before a stop that came before its local commit.
      if (matched) this.replay(store, expected.slice(next));
      else this.pendingChanged = true; // A squash changed IDs; rebase only the tracked delta.
      await settled(store);
      this.captureInto(store);
      if (delta.length > 0 || this.pendingChanged) await this.rebase(delta);
      return true;
    } catch (error) {
      // A working store that cannot be opened is rebuilt; a failure after it was adopted is not hidden.
      if (this.working === store && store !== undefined) throw error;
      await store?.close();
      return false;
    }
  }

  private ordered<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation);
    this.queue = run.catch(() => {});
    return run;
  }

  private async remote<T extends SyncIdentity>(url: URL, options?: RequestInit): Promise<T> {
    if (this.fenced) throw this.fenced;
    try {
      const body = await request<T>(url, options);
      if (!sameSyncIdentity(this.metadata, body)) throw new LocalSyncError(409, "FENCED", "The remote response belongs to a different workspace or history.");
      this.remoteState = "ok";
      return body;
    } catch (error) {
      this.remoteState = error instanceof LocalSyncError && error.code === "REMOTE_UNREACHABLE" ? "unreachable" : "refused";
      if (error instanceof LocalSyncError && error.code === "FENCED") this.fenced = error;
      throw error;
    }
  }

  private fencedUrl(route: string, params: Record<string, string>): URL {
    const url = new URL(route, this.origin);
    url.search = new URLSearchParams({
      ...params, workspaceId: this.metadata.workspaceId, historyId: this.metadata.historyId, epoch: String(this.metadata.epoch),
    }).toString();
    return url;
  }

  private async probe(): Promise<void> {
    // The tip-only response is small even if this device is far behind. It never applies a pull.
    const tip = await this.remote<SyncIdentity & { snapshotSeq: number }>(
      this.fencedUrl("/api/sync/pull", { after: String(Number.MAX_SAFE_INTEGER) }),
    );
    if (tip.snapshotSeq < this.confirmed.seq()) this.refuseRollback();
  }

  private refuseRollback(): never {
    this.remoteState = "refused";
    this.fenced = new LocalSyncError(409, "FENCED", "The remote history moved backwards.");
    throw this.fenced;
  }

  status() {
    return this.ordered(async () => {
      try { await this.probe(); } catch { /* reflected in remoteState */ }
      const { confirmedSeq, lastPushAt, lastPullAt } = this.metadata;
      const pending = this.pending();
      const blocked = this.metadata.pushBlocked;
      return {
        mode: "local", remote: { origin: this.origin, state: this.remoteState },
        unsent: pending.length,
        push: blocked && pending.some((entry) => entry.commandId === blocked.commandId) ? blocked : { state: "idle" },
        conflicts: this.conflicts.size, confirmedSeq, lastPushAt, lastPullAt,
      };
    });
  }

  pull(notify: (mapIds: string[]) => void) { return this.ordered(() => this.pullNow(notify)); }

  private async pullNow(notify: (mapIds: string[]) => void) {
    const before = this.confirmed.seq();
    const response = await this.remote<SyncIdentity & (
      { reclone: true; snapshotSeq: number } | { reclone?: false; lines: JournalLine[]; throughSeq: number }
    )>(this.fencedUrl("/api/sync/pull", { after: String(before) }));
    let pulled = 0;
    let delta: JournalLine[] = [];
    if (response.reclone) {
      const clone = await this.remote<Clone>(this.fencedUrl("/api/sync/clone", { index: "1" }));
      if (clone.snapshotSeq < Math.max(before, response.snapshotSeq)) this.refuseRollback();
      try {
        await this.installClone(clone);
      } catch (error) {
        if (error instanceof LocalSyncError && error.code === "FENCED") {
          this.remoteState = "refused";
          this.fenced = error;
        }
        throw error;
      }
      this.persistMetadata();
    } else {
      try {
        this.confirmed.appendConfirmed(response.lines, response.throughSeq);
        await settled(this.confirmed);
        pulled = response.lines.length;
        delta = response.lines;
      } catch (error) {
        // Recover the valid prefix of an append that failed midway; the next start rebases from it.
        await this.confirmed.close();
        this.confirmed = await this.openConfirmed();
        this.persistMetadata();
        throw error;
      }
      this.persistMetadata();
    }
    const changed = response.reclone || !this.metadata.working ? await this.rebuild()
      : delta.length > 0 || this.pendingChanged ? await this.rebase(delta) : [];
    this.metadata.origin = this.origin;
    this.metadata.lastPullAt = new Date().toISOString();
    this.persistMetadata();
    notify(changed);
    return { pulled, recloned: response.reclone === true, confirmedSeq: this.metadata.confirmedSeq };
  }

  push(notify: (mapIds: string[]) => void) {
    return this.ordered(async () => {
      await this.probe();
      const protectedIds = new Set(this.conflicts.keys());
      if (this.metadata.pushBlocked) protectedIds.add(this.metadata.pushBlocked.commandId);
      if (this.outbox.squash(protectedIds)) this.pendingChanged = true;
      const pending = this.outbox.list().filter((entry) => !this.conflicts.has(entry.commandId));
      this.outbox.markAttempted(new Set(pending.map((entry) => entry.commandId)));
      let sent = 0;
      let committed = 0;
      let noOp = 0;
      let conflicts = 0;
      const identity = identityOf(this.metadata);
      const done = new Set<string>();
      // Reuse each serialized batch envelope for byte counting and sending.
      // Include the fence, JSON punctuation and UTF-8 bytes.
      const prefix = JSON.stringify(identity).slice(0, -1) + ',"commands":[';
      let batchLimit = PUSH_BATCH_BYTES;
      try {
        // One request carries a run of Commands from one issuer: the remote takes a list,
        // commits it in order and answers each Command, and the issuer is read from the headers.
        for (let start = 0; start < pending.length;) {
          const headers = pushHeaders(pending[start]!);
          const key = JSON.stringify(headers);
          const batch: OutboxEntry[] = [];
          const envelopes: string[] = [];
          let bytes = Buffer.byteLength(prefix) + 2;
          for (let i = start; i < pending.length; i += 1) {
            const entry = pending[i]!;
            const envelope = JSON.stringify(pushEnvelope(entry));
            const size = Buffer.byteLength(envelope, "utf8") + (batch.length > 0 ? 1 : 0);
            if (batch.length > 0 && (JSON.stringify(pushHeaders(entry)) !== key || bytes + size > batchLimit)) break;
            batch.push(entry);
            envelopes.push(envelope);
            bytes += size;
            if (bytes >= batchLimit) break;
          }
          let response: SyncIdentity & { results: PushResultItem[] };
          try {
            response = await this.remote(new URL("/api/sync/push", this.origin), {
              method: "POST", headers, body: prefix + envelopes.join(",") + "]}",
            });
          } catch (error) {
            if (!(error instanceof LocalSyncError) || error.status !== 413) throw error;
            if (batch.length > 1) {
              // A proxy/older remote may have a smaller cap. Reduce batches before attributing
              // the failure to one Command. The threshold only shrinks within this push.
              batchLimit = Math.max(1, Math.min(Math.floor(bytes / 2), error.limitBytes ?? Infinity));
              continue;
            }
            const entry = batch[0]!;
            const mapName = entry.mapName || "Map";
            const reason = `${mapName}: ${entry.command.intent} — ${bytes} bytes; `
              + (error.limitBytes ? `remote limit ${error.limitBytes} bytes.` : "remote or proxy returned HTTP 413.");
            this.metadata.pushBlocked = {
              state: "blocked", code: "PUSH_COMMAND_TOO_LARGE", commandId: entry.commandId,
              mapName, intent: entry.command.intent, reason, bytes, limitBytes: error.limitBytes,
            };
            throw new LocalSyncError(413, "PUSH_COMMAND_TOO_LARGE", reason, error.limitBytes);
          }
          const result = settlePushResults(batch, Array.isArray(response.results) ? response.results : []);
          if (this.metadata.pushBlocked && result.done.has(this.metadata.pushBlocked.commandId)) this.metadata.pushBlocked = undefined;
          this.preserve(result.rejected);
          for (const id of result.done) done.add(id);
          sent += batch.length;
          committed += result.committed;
          noOp += result.noOp;
          conflicts += result.rejected.length;
          // A Command without a result stays in the outbox and ends this push.
          if (result.done.size < batch.length) break;
          start += batch.length;
        }
      } finally {
        // Re-read on removal so a local commit made during an HTTP request is retained.
        this.outbox.remove(done);
        if (done.size > 0) this.pendingChanged = true;
        this.persistMetadata();
      }
      this.metadata.lastPushAt = new Date().toISOString();
      this.persistMetadata();
      const pulled = await this.pullNow(notify);
      return { sent, committed, noOp, conflicts, ...pulled };
    });
  }
}

function pushEnvelopePayload(entry: OutboxEntry) {
  const { commandId: _id, baseSeq: _seq, ...payload } = pushEnvelope(entry);
  return payload;
}
