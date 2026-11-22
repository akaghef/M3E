import fs from "fs";
import path from "path";
import type { SnapshotRecord } from "../../shared/record_model/types";
import { fsyncDir } from "../record_store/journal_archive";
import { assertNotLiveM3e, RecordWorkspaceStore, writeFileDurably, type JournalLine } from "../record_store/store";
import { sameSyncIdentity, type SyncIdentity } from "../record_store/sync_types";
import { accountForConnection, LOCAL_HUMAN_ACCOUNT_ID } from "./issuer";
import { appendJsonLine, DeviceOutbox, pushEnvelope, readDurableLines, settlePushResults, type OutboxEntry, type OutboxRejection } from "./outbox";
import type { PushResultItem } from "./push";

interface RemoteMetadata extends SyncIdentity {
  origin: string;
  confirmedSeq: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
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

export class LocalSyncError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

function identityOf(body: Partial<SyncIdentity>): SyncIdentity {
  const { workspaceId, historyId, epoch } = body;
  if (typeof workspaceId !== "string" || workspaceId === "" || typeof historyId !== "string"
      || historyId === "" || typeof epoch !== "number" || !Number.isSafeInteger(epoch) || epoch < 1) {
    throw new LocalSyncError(409, "FENCED", "The remote did not supply a workspace and history identity.");
  }
  return { workspaceId, historyId, epoch };
}

function currentTarget(link: string): string | undefined {
  let target: string;
  try {
    const name = process.platform === "win32"
      ? fs.readFileSync(path.join(link, "CURRENT"), "utf8").trim()
      : fs.readlinkSync(link);
    target = path.resolve(path.dirname(link), name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const relative = path.relative(path.dirname(link), target);
  if (!relative.startsWith(`.${path.basename(link)}-`) || relative.includes(path.sep)) {
    throw new Error("The active sync store points outside its data directory.");
  }
  return target;
}

/** Commit a complete directory with one atomic rename of its pointer. */
function activateDirectory(link: string, target: string): void {
  const previous = currentTarget(link);
  fsyncDir(path.dirname(target));
  if (process.platform === "win32") {
    // Windows cannot atomically replace an existing directory junction. Use a file
    // pointer for the same commit operation; the record store opens its target.
    fs.mkdirSync(link, { recursive: true });
    writeFileDurably(path.join(link, "CURRENT"), path.basename(target) + "\n");
  } else {
    const temporary = `${link}.next`;
    fs.rmSync(temporary, { force: true });
    fs.symlinkSync(path.basename(target), temporary, "dir");
    fs.renameSync(temporary, link);
  }
  fsyncDir(path.dirname(link));
  if (previous !== undefined && previous !== target) {
    // The new generation is already committed. Retaining the previous one on a cleanup error is safe.
    try { fs.rmSync(previous, { recursive: true, force: true }); } catch { /* retry through manual cleanup */ }
  }
}

async function request<T>(url: URL, options?: RequestInit): Promise<T> {
  let response: Response;
  let body: T & { code?: string };
  try {
    response = await fetch(url, { ...options, redirect: "manual", signal: AbortSignal.timeout(15_000) });
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

function outboxIssuer(entry: OutboxEntry): string {
  const mcp = accountForConnection({ kind: "mcp", instanceId: entry.command.actor.id }).accountId;
  return entry.issuer === mcp ? mcp : LOCAL_HUMAN_ACCOUNT_ID;
}

export class LocalSync {
  private readonly syncDir: string;
  private readonly metadataFile: string;
  private readonly confirmedLink: string;
  private readonly workingLink: string;
  private readonly conflictsFile: string;
  private readonly outbox: DeviceOutbox;
  private readonly conflicts = new Map<string, Conflict>();
  private metadata!: RemoteMetadata;
  private confirmed!: RecordWorkspaceStore;
  private working!: RecordWorkspaceStore;
  private remoteState: RemoteState = "unreachable";
  private fenced: LocalSyncError | undefined;
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(dataDir: string, private readonly origin: string) {
    this.syncDir = path.join(dataDir, "sync");
    this.metadataFile = path.join(this.syncDir, "remote.json");
    this.confirmedLink = path.join(this.syncDir, "confirmed");
    this.workingLink = path.join(dataDir, "store");
    this.conflictsFile = path.join(this.syncDir, "conflicts.jsonl");
    this.outbox = DeviceOutbox.open(path.join(this.syncDir, "outbox.jsonl"));
    if (fs.existsSync(this.conflictsFile)) {
      const rows = readDurableLines<Conflict>(this.conflictsFile, (value) => {
        const row = value as Partial<Conflict> | null;
        return typeof row?.at === "string" && typeof row.entry?.commandId === "string";
      }, true);
      for (const conflict of rows) this.conflicts.set(conflict.entry.commandId, conflict);
    }
  }

  static async open(dataDir: string, origin: string): Promise<LocalSync> {
    const url = new URL(origin);
    if (!/^https?:$/.test(url.protocol) || url.origin !== origin.replace(/\/$/, "")) {
      throw new Error("M3E_SYNC_REMOTE must be an HTTP(S) origin.");
    }
    const dir = path.resolve(dataDir);
    assertNotLiveM3e(dir);
    // Never replace a record store or a SQLite workspace with a clone.
    const recorded = fs.existsSync(path.join(dir, "sync", "remote.json"));
    if (!recorded && fs.existsSync(dir) && fs.readdirSync(dir).some((name) => name !== "sync")) {
      throw new Error("Local mode needs an empty data directory for the initial clone.");
    }
    const local = new LocalSync(dir, url.origin);
    try {
      if (recorded) {
        local.metadata = JSON.parse(fs.readFileSync(local.metadataFile, "utf8")) as RemoteMetadata;
        identityOf(local.metadata);
        local.confirmed = local.openConfirmed();
        if (!sameSyncIdentity(local.metadata, local.confirmed.syncIdentity())) throw new Error("The confirmed store is from a different history.");
        if (local.confirmed.seq() < local.metadata.confirmedSeq) throw new Error("The confirmed store moved backwards.");
      } else {
        const clone = await request<Clone>(new URL("/api/sync/clone?index=1", url));
        local.installClone(clone);
        local.metadata = { ...identityOf(clone), origin: url.origin, confirmedSeq: clone.snapshotSeq, lastPushAt: null, lastPullAt: null };
        local.remoteState = "ok";
      }
      local.persistMetadata();
      local.rebuild();
      return local;
    } catch (error) {
      await local.close();
      throw error;
    }
  }

  store(): RecordWorkspaceStore { return this.working; }

  storeDir(): string {
    return currentTarget(this.workingLink) ?? this.workingLink;
  }

  async close(): Promise<void> {
    await this.queue;
    await this.confirmed?.close();
    await this.working?.close();
  }

  private persistMetadata(): void {
    this.metadata.confirmedSeq = this.confirmed.seq();
    writeFileDurably(this.metadataFile, JSON.stringify(this.metadata) + "\n");
  }

  private openConfirmed(): RecordWorkspaceStore {
    const dir = currentTarget(this.confirmedLink);
    if (dir === undefined) throw new Error("The confirmed store is missing.");
    return RecordWorkspaceStore.open(dir, { warm: false, compactAfterLines: 0 });
  }

  private installClone(clone: Clone): void {
    const header = clone.records?.[0];
    if (header?.kind !== "snapshot" || header.seq !== clone.snapshotSeq || !sameSyncIdentity(identityOf(clone), header)) {
      throw new LocalSyncError(409, "FENCED", "The snapshot header does not match the remote response.");
    }
    const dir = fs.mkdtempSync(path.join(this.syncDir, ".confirmed-"));
    let next: RecordWorkspaceStore | undefined;
    try {
      RecordWorkspaceStore.create(dir, clone.records, clone.index);
      next = RecordWorkspaceStore.open(dir, { warm: false, compactAfterLines: 0 });
      if (next.seq() !== clone.snapshotSeq) throw new Error("The snapshot does not end at its declared sequence.");
      void this.confirmed?.close();
      activateDirectory(this.confirmedLink, dir);
      this.confirmed = next;
    } catch (error) {
      void next?.close();
      fs.rmSync(dir, { recursive: true, force: true });
      if (this.confirmed) this.confirmed = this.openConfirmed();
      throw error;
    }
  }

  private preserve(rejections: OutboxRejection[]): void {
    for (const rejected of rejections) {
      const id = rejected.entry.commandId;
      if (this.conflicts.has(id)) continue;
      const row = { ...rejected, at: new Date().toISOString() };
      appendJsonLine(this.conflictsFile, row);
      this.conflicts.set(id, row);
    }
  }

  conflictList(): Array<Conflict & { mapName: string; intent: string; reason: string }> {
    return [...this.conflicts.values()].map((row) => ({
      ...row, mapName: row.entry.mapName || this.working.listMaps().find((map) => map.id === row.entry.mapId)?.rootText || "Map",
      intent: row.entry.command.intent, reason: row.message ?? row.code ?? "The Command conflicted with the remote.",
    }));
  }

  /** Reapply pending Command preconditions on a separate store, then publish it. */
  private rebuild(): string[] {
    const records = this.confirmed.records();
    const dir = fs.mkdtempSync(path.join(path.dirname(this.workingLink), ".store-"));
    const changed = new Set(this.working?.listMaps().map((map) => map.id));
    let next: RecordWorkspaceStore | undefined;
    try {
      RecordWorkspaceStore.create(dir, records, this.confirmed.snapshotIndex(records));
      next = RecordWorkspaceStore.open(dir, { warm: false });
      const failed: OutboxRejection[] = [];
      for (const entry of this.outbox.list()) {
        if (this.conflicts.has(entry.commandId)) continue;
        const result = next.commitSyncCommand(pushEnvelopePayload(entry), outboxIssuer(entry));
        if (!result.ok) failed.push({ entry, code: result.code, message: result.message });
      }
      this.preserve(failed);
      for (const map of next.listMaps()) changed.add(map.id);
      next.setCapture((payload, issuer, at, mapName) => {
        this.outbox.append({ ...payload, commandId: payload.command.commandId, baseSeq: this.metadata.confirmedSeq, createdAt: at, issuer, mapName });
      });
      const previous = this.working;
      activateDirectory(this.workingLink, dir);
      this.working = next;
      void previous?.close();
    } catch (error) {
      void next?.close();
      fs.rmSync(dir, { recursive: true, force: true });
      throw error;
    }
    this.outbox.remove(new Set(this.conflicts.keys()));
    return [...changed];
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
      return {
        mode: "local", remote: { origin: this.origin, state: this.remoteState },
        unsent: this.outbox.list().filter((entry) => !this.conflicts.has(entry.commandId)).length,
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
    if (response.reclone) {
      const clone = await this.remote<Clone>(this.fencedUrl("/api/sync/clone", { index: "1" }));
      if (clone.snapshotSeq < Math.max(before, response.snapshotSeq)) this.refuseRollback();
      try {
        this.installClone(clone);
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
        pulled = response.lines.length;
      } finally {
        // Refresh map indexes and recover the valid prefix if an append failed midway.
        void this.confirmed.close();
        this.confirmed = this.openConfirmed();
        this.persistMetadata();
      }
    }
    const changed = this.rebuild();
    this.metadata.origin = this.origin;
    this.metadata.lastPullAt = new Date().toISOString();
    this.persistMetadata();
    notify(changed);
    return { pulled, recloned: response.reclone === true, confirmedSeq: this.metadata.confirmedSeq };
  }

  push(notify: (mapIds: string[]) => void) {
    return this.ordered(async () => {
      await this.probe();
      const pending = this.outbox.list().filter((entry) => !this.conflicts.has(entry.commandId));
      let sent = 0;
      let committed = 0;
      let noOp = 0;
      let conflicts = 0;
      const identity = identityOf(this.metadata);
      const done = new Set<string>();
      try {
        for (const entry of pending) {
          const headers: Record<string, string> = { "content-type": "application/json" };
          if (outboxIssuer(entry) !== LOCAL_HUMAN_ACCOUNT_ID) {
            headers["x-m3e-connection"] = "mcp";
            headers["x-m3e-actor-instance"] = entry.command.actor.id;
          }
          const response = await this.remote<SyncIdentity & { results: PushResultItem[] }>(new URL("/api/sync/push", this.origin), {
            method: "POST", headers, body: JSON.stringify({ ...identity, commands: [pushEnvelope(entry)] }),
          });
          const result = settlePushResults([entry], Array.isArray(response.results) ? response.results : []);
          this.preserve(result.rejected);
          for (const id of result.done) done.add(id);
          sent += 1;
          committed += result.committed;
          noOp += result.noOp;
          conflicts += result.rejected.length;
          if (result.done.size === 0) break;
        }
      } finally {
        // Re-read on removal so a local commit made during an HTTP request is retained.
        this.outbox.remove(done);
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
