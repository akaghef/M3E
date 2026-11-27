// Record store of one workspace, on Neo4j, the database.
//
// Neo4j holds the state (one node per record), the journal (one entry per commit, the exchange
// of committed changes with other devices) and the resend results. A store is opened from Neo4j;
// no file is read or written. A commit is computed in this process against the state read from
// Neo4j, written to Neo4j in one transaction (neo4j_durability.ts), and answered only after
// `durable()`. The process keeps the state it read and updates it with every commit it writes.
//
// Design: .kiro/specs/rapid-persistence-redesign/neo4j-database-design.md.


import { createHash, randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { applyChanges, diffState, nonEmptyChanges, type FieldConflict, type MapCommand, type RecordChange } from "../../shared/map_changes";
import { advanceDecay, readDecay } from "../../shared/record_model/decay";
import { extensionDefShapeError, fillRequiredDefaults } from "../../shared/record_model/extensions";
import { fromSnapshot } from "../../shared/record_model/from_snapshot";
import { checkInvariants, type InvariantProblem } from "../../shared/record_model/invariants";
import { recordKeyString, serializeSnapshot, sortRecords } from "../../shared/record_model/jsonl";
import { NeighbourhoodIndex, subjectOfProblemKey } from "../../shared/record_model/neighbourhood";
import { MapProjector, recordRk, sameJson, type ProjectionResult } from "../../shared/record_model/steady";
import { takeLegacyCertainty } from "../../shared/record_model/certainty";
import { SNAPSHOT_FORMAT, compareStrings, type CommitRecord, type DecayRecord, type ExtensionDefRecord, type IdMapRecord, type JsonValue, type MapRecord, type ScopeRecord, type SnapshotHeader, type SnapshotRecord, type SnapshotRow } from "../../shared/record_model/types";
import type { AppState, TreeNode } from "../../shared/types";
import { appendedLeaves, applyChangesReduced } from "./apply_reduced";
import {
  planDeleteNamedSnapshot,
  planLink,
  planNamedSnapshot,
  planProject,
  planPromote,
  planSetBand,
  planWriteBack,
  readProjectionView,
  type NodeChoice,
  type OccurrenceView,
} from "./bands";
import {
  ALIAS_KINDS,
  aliasId,
  emptyAliasTable,
  idsCreatedBy,
  idsOfState,
  translateChanges,
  translateConflicts,
  translateState,
  translatorOf,
  type AliasKind,
  type AliasTable,
  type IdTranslator,
  type IntroducedIds,
} from "./id_alias";
import { sha256, touchedOf, type TouchedRecord } from "./journal_line";
import { CommitGuardIndex, commitTimeRefusal } from "./operations";
import { normalizeProvenance, type Provenance } from "./provenance";
import { commitValidationErrorCount, validationUnaffected } from "./validate";
import type { CommitOps, RecordOp } from "./journal_line";

import { MapRecordChanges } from "./map_changes";

import type { SyncCommand, SyncIdentity, SyncMapOperation } from "./sync_types";
import { Neo4jDurability, type LoadedStore, type Neo4jConnection, type StoredCommand } from "./neo4j_durability";

/** Command ids a clone's index carries for idempotent retries: the most recent ones, up to this many. */
export const COMMAND_INDEX_RETAIN = 100000;

export interface CommitSuccess {
  ok: true;
  savedAt: string;
  /** Workspace-wide commit sequence number of the commit. */
  seq: number;
  replayed: boolean;
  noOp?: true;
}

export interface CommitFailure {
  ok: false;
  code: "NOT_FOUND" | "CONFLICT" | "INVALID_STATE" | "INVALID_COMMAND" | "SAME_ID_DIFFERENT_CONTENT" | "ENGINE_BEHIND";
  conflicts: FieldConflict[];
  current: { savedAt: string; state: object } | null;
  /** Why, for the codes that are not field conflicts. */
  message?: string;
}

export type CommitResult = CommitSuccess | CommitFailure;

export interface MapColumns {
  tags?: unknown;
  archived?: unknown;
  pinned?: unknown;
  source?: unknown;
}

export interface MapRow extends MapColumns {
  id: string;
  state: AppState;
  savedAt: string;
}

export interface MapListEntry extends MapColumns {
  id: string;
  savedAt: string;
  nodeCount: number;
  rootText: string;
  /** Characters of every node's text, details and note together. */
  charCount: number;
}

export interface OpenOptions {
  /** Clock for commit times; an ISO 8601 string. */
  now?: () => string;
  /** Build the state of every map while opening (default). With false, a map is built on first use. */
  warm?: boolean;
}

/** One line of the journal: one commit, as it is exchanged by push and pull and kept in Neo4j. */
export interface JournalLine {
  seq: number;
  commandId?: string;
  issuer: string;
  committedAt: string;
  mapId: string;
  intent: string;
  actor?: MapCommand["actor"];
  provenance?: unknown;
  /** The changes of the Command as they were sent (audit, undo). */
  changes?: RecordChange[];
  /** sha256 of the canonical JSON of `changes`; compared when the same command id comes again. */
  changesHash?: string;
  /** Map-level operation, when this commit carries one. */
  mapOp?: "create" | "delete" | "rename" | "columns";
  syncHash?: string;
  newMapId?: string;
  /** Reason carried by a promotion or a write-back. */
  reason?: string;
  ops: RecordOp[];
  /** Records whose canonical value the commit changed, with the kinds of change; derived by the store. */
  touched?: TouchedRecord[];
}

interface MapEntry {
  id: string;
  /** Records `projectMap` owns, keyed by rk. */
  records: Map<string, SnapshotRecord>;
  /** `idMap` records of the map: carried, never projected. */
  idMaps: Map<string, SnapshotRecord>;
  warm?: {
    projector: MapProjector;
    state: AppState;
    validationErrors: number;
    problems: Set<string>;
  };
  /** Node count and character count of the map, counted from the records; dropped by every content commit. */
  counts?: { nodes: number; chars: number };
  /** `idMap` records with `alias: true` as lookup tables; rebuilt when `idMaps` changes. */
  aliases?: { size: number; in: AliasTable; out: AliasTable };
  /** Reverse links for the local invariant check. Rebuilt when `warm` is rebuilt. */
  graph?: NeighbourhoodIndex;
}

/** Ids a commit is about to renumber: the `idMap` records to write and the tables that include them. */
interface AliasPlan {
  records: IdMapRecord[];
  in: IdTranslator;
}

const ALIAS_RECORD_RK: Record<Exclude<AliasKind, "surface">, string> = { node: "node", graphlink: "connection", annotation: "annotation" };

interface CommandEntry {
  seq: number;
  hash: string;
  canonicalHash?: string;
  syncHash?: string;
  mapIds: Set<string>;
  result?: CommitResult;
}

type StoredCommandEntry = Omit<CommandEntry, "mapIds"> & { mapIds: string[] };
type CommandResultLine = { afterSeq: number } & (
  { commandId: string; entry: StoredCommandEntry } | { forget: string[] }
);

const REMEMBERED_REJECTIONS = new Set(["CONFLICT", "INVALID_STATE", "INVALID_COMMAND"]);

type Dict = Record<string, unknown>;

const ACTORS = new Set(["human", "ai-agent", "system"]);
const COLUMN_FIELDS = ["tags", "archived", "pinned", "source"] as const;
const SHARED_ID_KINDS = new Set(["node", "connection", "annotation"]);
const EMPTY_RECORDS: ReadonlyMap<string, SnapshotRecord> = new Map();

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlain(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** JSON with object keys in sorted order: equal values give equal text. */
function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalStringify(item === undefined ? null : item)).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const source = value as Record<string, unknown>;
    return `{${Object.keys(source).sort().filter((key) => source[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(source[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** A remembered result without the map state a refusal carries; the state is the present one when it is answered again. */
function withoutState(result: CommitResult): CommitResult {
  if (result.ok) return jsonClone(result);
  const { current: _current, ...rest } = result as CommitFailure;
  return jsonClone(rest) as CommitResult;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** JSON text with object keys in string order; the same value always gives the same text. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const source = value as Dict;
    const parts: string[] = [];
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined || typeof source[key] === "function") continue;
      parts.push(`${JSON.stringify(key)}:${canonicalJson(source[key])}`);
    }
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function hashChanges(changes: unknown): string {
  return createHash("sha256").update(canonicalJson(changes === undefined ? null : changes), "utf8").digest("hex");
}

/**
 * True when the operations cannot change what `checkInvariants` finds: each one replaces an
 * existing record, and the fields the invariants read (ids, map, endpoints, references, alias) are
 * the same before and after.
 */
function invariantFactsUnchanged(previous: ReadonlyMap<string, SnapshotRecord>, ops: readonly RecordOp[]): boolean {
  for (const op of ops) {
    if (op.op !== "put" || op.record === undefined) return false;
    const before = previous.get(op.rk);
    if (before === undefined || before.kind !== op.record.kind) return false;
    const a = before as unknown as Dict;
    const b = op.record as unknown as Dict;
    if (a.mapId !== b.mapId) return false;
    switch (before.kind) {
      case "node":
        if ((a.nodeType === "alias") !== (b.nodeType === "alias") || !sameJson(a.alias, b.alias)) return false;
        if (!sameJson(a.extensions, b.extensions) || !sameJson(a.attributes, b.attributes)) return false;
        break;
      case "details":
      case "nodeView":
        break; // only the key is read, and the key is the same
      case "connection":
        if (a.type !== b.type || a.source !== b.source || a.target !== b.target) return false;
        if (!sameJson(a.ord, b.ord) || !sameJson(a.extensions, b.extensions) || !sameJson(a.attributes, b.attributes)) return false;
        break;
      case "scope":
        if (a.rootNodeId !== b.rootNodeId || a.primarySurfaceId !== b.primarySurfaceId) return false;
        break;
      case "surface":
        if (a.scopeId !== b.scopeId) return false;
        break;
      case "linearText":
        if (a.scopeId !== b.scopeId || a.orphanKey !== b.orphanKey || a.anchorNodeId !== b.anchorNodeId) return false;
        break;
      case "annotation":
        if (a.scopeId !== b.scopeId) return false;
        break;
      case "map":
        if (a.rootNodeId !== b.rootNodeId) return false;
        break;
      default:
        return false;
    }
  }
  return true;
}

function sameExceptRev(left: SnapshotRecord, right: SnapshotRecord): boolean {
  if (left === right) return true;
  const a = { ...left } as Dict;
  const b = { ...right } as Dict;
  delete a.rev;
  delete b.rev;
  return sameJson(a, b);
}

function problemKey(problem: InvariantProblem): string {
  return `${problem.rule}|${problem.kind}|${problem.key}|${problem.message}`;
}

/** Keeps problems outside the neighbourhood. Drops a problem whose subject was checked and is no longer reported. */
function mergeBaseline(baseline: ReadonlySet<string>, problems: readonly InvariantProblem[], checked: ReadonlySet<string>): Set<string> {
  const local = new Set(problems.map(problemKey));
  const next = new Set<string>();
  for (const key of baseline) {
    const subject = subjectOfProblemKey(key);
    if (subject !== undefined && checked.has(subject) && !local.has(key)) continue;
    next.add(key);
  }
  for (const key of local) next.add(key);
  return next;
}

/** Node ids a commit's own operations touched: the node record, or its details, once each. Decay rows are not operations yet. */
function activityNodeIds(ops: readonly RecordOp[], before: (rk: string) => SnapshotRecord | undefined): string[] {
  const ids = new Set<string>();
  for (const entry of touchedOf(ops, before)) {
    if (entry.rk.startsWith("node|")) ids.add(entry.rk.slice("node|".length));
    else if (entry.rk.startsWith("details|")) ids.add(entry.rk.slice("details|".length));
  }
  return [...ids];
}

/** Intent of the journal line a local working store writes when it is rebased onto the confirmed state. */
export const LOCAL_REBASE_INTENT = "local-rebase";

function commandShape(command: MapCommand): string | null {
  if (typeof command.commandId !== "string" || !command.commandId.trim()) return "commandId is required.";
  if (!command.actor || !ACTORS.has(command.actor.kind) || typeof command.actor.id !== "string" || !command.actor.id.trim()) return "actor is required.";
  if (typeof command.intent !== "string" || !command.intent.trim()) return "intent is required.";
  if (!Array.isArray(command.changes)) return "changes must be a list.";
  return null;
}

const SYNC_CHANGE_KEY_LENGTH: Record<RecordChange["kind"], number> = {
  node: 1, edge: 1, attribute: 3, "graph-link": 1, "linear-text": 1, "scope-setting": 1,
  surface: 1, "surface-node-view": 2, annotation: 1, "map-field": 1,
};

function validSyncChange(change: RecordChange): boolean {
  return isPlain(change) && hasOwn(SYNC_CHANGE_KEY_LENGTH, change.kind)
    && Array.isArray(change.key) && change.key.length === SYNC_CHANGE_KEY_LENGTH[change.kind]
    && change.key.every((key) => typeof key === "string")
    && (change.kind !== "attribute" || change.key[0] === "node" || change.key[0] === "graph-link")
    && (change.op === "create" || change.op === "update" || change.op === "delete")
    && (change.op === "create" ? change.before === undefined : isPlain(change.before))
    && (change.op === "delete" ? change.after === undefined : isPlain(change.after));
}

export function syncHash({ mapId, command, ...operation }: SyncCommand): string {
  return hashChanges([mapId, command, operation]);
}

type MapOpCommit = { command: MapCommand; hash: string };

export class RecordWorkspaceStore {
  workspaceId = "";
  private historyId = "";
  private epoch = 1;
  private readonly warmOnLoad: boolean;
  /** Set while Neo4j is unavailable: the store answers nothing until it has read itself again. */
  private unavailable: string | undefined;
  /** Map states kept as the bases of work projections, by `<mapId>@<seq>`; also kept in Neo4j. */
  private readonly bases = new Map<string, SnapshotRecord[]>();

  private capture: ((command: SyncCommand, issuer: string, at: string, mapName: string) => void) | undefined;
  readonly mapChanges = new MapRecordChanges();
  private committed: ((line: JournalLine) => void) | undefined;
  private readonly now: () => string;
  private readonly guardIndexes = new Map<string, CommitGuardIndex>();
  /** Every record of the workspace but the snapshot header, keyed by rk. */
  private readonly all = new Map<string, SnapshotRecord>();
  /** Workspace extensionDef records. They are not owned by a map. */
  private readonly extensionDefs = new Map<string, SnapshotRecord>();
  /** Decay record rks by map. Decay is state of the snapshot and is not a projected map record. */
  private readonly decayByMap = new Map<string, Set<string>>();
  private readonly maps = new Map<string, MapEntry>();
  /** Ids of node, connection and annotation records: unique across those kinds and across maps. */
  private readonly idIndex = new Map<string, string>();
  /** Deleted node id -> canonical node record without `rev`. Only an equal put may use the id again. */
  private readonly retired = new Map<string, string>();
  private readonly mapSeq = new Map<string, number>();
  private readonly commands = new Map<string, CommandEntry>();
  private commandCollisions = 0;
  private currentSeq = 0;
  /** Commit the snapshot file holds; the journal holds everything after it. */
  private snapshotSeq = 0;
  /** Lines of the journal file after the snapshot: what an open would replay. */
  private journalLines = 0;
  /** Snapshot format of the snapshot file; archive names carry it. */
  private snapshotFormat: 1 | 2 | 3 = 1;
  /** Neo4j, when the store runs on it: then it is the database and no file is read or written. */
  private durability: Neo4jDurability | undefined;
  private closed = false;

  /** Problems of the database's background work; empty while every write reached Neo4j. */
  maintenanceStatus(): { problems: string[] } {
    const error = this.durability?.error;
    return { problems: error === undefined ? [] : [`Neo4j: ${error}`] };
  }

  /**
   * Opens the store `name` in Neo4j, the database of the record store. The store must exist
   * (made by `createInNeo4j`, a clone, or the one-time migration from the old files).
   */
  static async openNeo4j(connection: Neo4jConnection, name: string, options: OpenOptions = {}): Promise<RecordWorkspaceStore> {
    const { durability, loaded } = await Neo4jDurability.open(connection, name);
    if (loaded === null) {
      await durability.close();
      throw new Error(`No record store named ${name} in Neo4j (${connection.uri}).`);
    }
    try {
      return new RecordWorkspaceStore(options, { durability, loaded });
    } catch (error) {
      await durability.close();
      throw error;
    }
  }

  /** Writes a new store into Neo4j from records (a snapshot header first). Refuses a name that exists. */
  static async createInNeo4j(connection: Neo4jConnection, name: string, records: SnapshotRecord[]): Promise<void> {
    const header = records[0] as SnapshotHeader | undefined;
    if (!header || header.kind !== "snapshot") throw new Error("The records must start with the snapshot header.");
    const filled: SnapshotHeader = { ...header, historyId: header.historyId ?? randomUUID(), epoch: header.epoch ?? 1 };
    await Neo4jDurability.create(connection, name, { records: [filled, ...records.slice(1)], commands: [], retired: [], mapSeq: [] });
  }

  private storedCommand(entry: CommandEntry): StoredCommand {
    const stored: StoredCommand = { seq: entry.seq, hash: entry.hash, mapIds: [...entry.mapIds] };
    if (entry.canonicalHash !== undefined) stored.canonicalHash = entry.canonicalHash;
    if (entry.syncHash !== undefined) stored.syncHash = entry.syncHash;
    if (entry.result !== undefined) stored.result = withoutState(entry.result);
    return stored;
  }

  private constructor(options: OpenOptions, neo4jStore: { durability: Neo4jDurability; loaded: LoadedStore }) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.warmOnLoad = options.warm !== false;
    this.durability = neo4jStore.durability;
    this.initFrom(neo4jStore.loaded);
    neo4jStore.durability.onUnavailable = (reason) => this.becomeUnavailable(reason);
    neo4jStore.durability.startProbe();
  }

  /** The state of the store, from what was read from Neo4j. Used on open and after Neo4j was unavailable. */
  private initFrom(loaded: LoadedStore): void {
    for (const table of [this.guardIndexes, this.all, this.extensionDefs, this.decayByMap, this.maps, this.idIndex, this.retired, this.mapSeq, this.commands, this.bases]) {
      (table as Map<unknown, unknown>).clear();
    }
    for (const [key, records] of loaded.bases ?? []) this.bases.set(key, records);
    this.commandCollisions = 0;
    {
      const header = loaded.records.find((record) => record.kind === "snapshot") as SnapshotHeader | undefined;
      if (!header) throw new Error(`The Neo4j store ${this.durability?.store ?? ""} has no snapshot header record.`);
      if (header.format !== SNAPSHOT_FORMAT) throw new Error(`The Neo4j store holds format ${String(header.format)}, not ${SNAPSHOT_FORMAT}.`);
      this.workspaceId = header.workspaceId;
      this.historyId = header.historyId ?? randomUUID();
      this.epoch = header.epoch ?? 1;
      this.snapshotFormat = header.format;
      let seq = Number.isInteger(header.seq) ? header.seq : 0;
      for (const record of loaded.records) {
        if (record.kind === "snapshot") continue;
        const rk = recordRk(record);
        if (this.all.has(rk)) throw new Error(`Two records of the store share the key ${JSON.stringify(rk)}.`);
        this.all.set(rk, record);
        if (record.kind === "commit" && record.seq > seq) seq = record.seq;
      }
      this.currentSeq = seq;
      this.snapshotSeq = seq;
      for (const [id, body] of loaded.retired) this.retired.set(id, body);
      for (const [mapId, value] of loaded.mapSeq) this.mapSeq.set(mapId, value);
      for (const [id, entry] of loaded.commands) {
        this.commands.set(id, { ...entry, mapIds: new Set(entry.mapIds), result: entry.result as CommitResult | undefined });
      }
    }

    this.idIndex.clear();
    for (const [rk, record] of this.all) {
      if (SHARED_ID_KINDS.has(record.kind)) this.idIndex.set((record as { id: string }).id, rk);
    }
    for (const record of this.all.values()) {
      if (record.kind === "map") this.maps.set(record.id, { id: record.id, records: new Map(), idMaps: new Map() });
    }
    for (const [rk, record] of this.all) {
      if (record.kind === "extensionDef") {
        this.extensionDefs.set(rk, record);
        continue;
      }
      if (record.kind === "decay") {
        this.rememberDecay(record);
        continue;
      }
      const mapId = record.kind === "map" ? record.id : (record as { mapId?: unknown }).mapId;
      const entry = typeof mapId === "string" ? this.maps.get(mapId) : undefined;
      if (!entry) continue;
      if (record.kind === "idMap") entry.idMaps.set(rk, record);
      else entry.records.set(rk, record);
    }
    if (this.warmOnLoad) {
      for (const entry of this.maps.values()) this.warm(entry);
    }
  }

  /**
   * Neo4j stopped answering or a write failed: commits that were not written are gone (no client
   * was told they were saved), so the state in this process is dropped and read again from Neo4j
   * as soon as it answers. Until then every call refuses with code DATABASE_UNAVAILABLE.
   */
  private becomeUnavailable(reason: string): void {
    if (this.unavailable !== undefined || this.closed) return;
    this.unavailable = reason;
    const retry = (wait: number): void => {
      const timer = setTimeout(() => {
        void (async () => {
          if (this.closed || !this.durability) return;
          const loaded = await this.durability.reload();
          if (loaded === null) return retry(Math.min(wait * 2, 5000));
          try {
            this.initFrom(loaded);
          } catch (error) {
            console.error(`[record-store] reading the store again from Neo4j failed: ${(error as Error).message}`);
            return retry(5000);
          }
          this.mapChanges.reset();
          this.unavailable = undefined;
          console.warn(`[record-store] Neo4j answers again; the store was read again at commit ${this.currentSeq}.`);
        })();
      }, wait);
      timer.unref?.();
    };
    retry(500);
  }

  /**
   * Neo4j is the database: a record changed there without a commit of this store (by hand, by a
   * tool) is what holds. Compares `fresh`, read from Neo4j, with the process state for the records
   * in `scope`, and commits the differences as one journal line (intent `database-edit`, issuer
   * `system`), so the checks, the clone and every device that pulls see them. Work is proportional
   * to the records compared.
   */
  private reconcile(fresh: readonly SnapshotRecord[], inScope: (record: SnapshotRecord) => boolean, mapId: string): number {
    const ignoreRev = (record: SnapshotRecord): string => {
      const { rev: _rev, ...rest } = record as SnapshotRecord & { rev?: number };
      return canonicalStringify(rest);
    };
    const seen = new Set<string>();
    const seq = this.currentSeq + 1;
    const ops: RecordOp[] = [];
    for (const record of fresh) {
      if (record.kind === "snapshot" || record.kind === "commit") continue;
      const rk = recordRk(record);
      seen.add(rk);
      const known = this.all.get(rk);
      if (known !== undefined && ignoreRev(known) === ignoreRev(record)) continue;
      const put = jsonClone(record) as SnapshotRecord & { rev?: number };
      if (hasOwn(put, "rev")) put.rev = seq;
      ops.push({ op: "put", rk, record: put });
    }
    for (const [rk, record] of this.all) {
      if (seen.has(rk) || record.kind === "commit" || !inScope(record)) continue;
      ops.push({ op: "delete", rk });
    }
    if (ops.length === 0) return 0;
    const line: JournalLine = { seq, issuer: "system", committedAt: this.now(), mapId, intent: "database-edit", ops };
    this.appendTracked(line);
    console.warn(`[record-store] ${ops.length} record(s) changed in Neo4j outside a commit; committed as ${seq}.`);
    return ops.length;
  }

  /** Reconciles one map with the records just read from Neo4j for it (display reads). */
  reconcileMap(mapId: string, fresh: readonly SnapshotRecord[]): number {
    this.assertOpen();
    return this.reconcile(fresh, (record) => (record.kind === "map" ? record.id : (record as { mapId?: unknown }).mapId) === mapId || record.kind === "extensionDef", mapId);
  }

  /** Reconciles the whole store with Neo4j (clone). */
  async reconcileAll(): Promise<number> {
    this.assertOpen();
    const fresh = await this.durability!.allRecords();
    return this.reconcile(fresh, () => true, "");
  }

  /** Reconciles the records a Command on these ids reads (push, before the checks). Proportional to the ids. */
  async reconcileIds(ids: Iterable<string>): Promise<number> {
    this.assertOpen();
    const list = [...new Set(ids)].filter((id) => typeof id === "string" && id !== "");
    if (list.length === 0) return 0;
    const fresh = await this.durability!.recordsAbout(list);
    const wanted = new Set(list);
    const about = (record: SnapshotRecord): boolean => {
      const r = record as { id?: unknown; nodeId?: unknown; target?: unknown };
      return wanted.has(String(r.id)) || wanted.has(String(r.nodeId)) || wanted.has(String(r.target));
    };
    return this.reconcile(fresh, about, "");
  }

  /** Resolves when Neo4j answers now. A read that serves state awaits this first, so nothing is served while Neo4j is down. */
  async reachable(): Promise<void> {
    this.assertOpen();
    await this.durability!.reachable();
  }

  // ---------------------------------------------------------------- reads

  /** Workspace-wide commit sequence. */
  seq(): number {
    return this.currentSeq;
  }

  listMaps(): MapListEntry[] {
    this.assertOpen();
    return [...this.maps.values()]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((entry) => {
        const map = this.mapRecord(entry);
        const counts = this.countsOf(entry);
        const root = map.rootNodeId !== undefined ? entry.records.get(`node|${map.rootNodeId}`) : undefined;
        const rootText = root && root.kind === "node" && typeof root.text === "string" ? root.text : "";
        const columns: MapColumns = {};
        this.copyColumns(columns, map);
        return { id: entry.id, savedAt: this.savedAtOf(entry), ...columns, nodeCount: counts.nodes, rootText, charCount: counts.chars };
      });
  }

  hasMap(mapId: string): boolean {
    return this.maps.has(mapId);
  }

  /** The map as a row of the current shape. `state` is a fresh deep copy. */
  getMapRow(mapId: string): MapRow {
    this.assertOpen();
    const entry = this.requireMap(mapId);
    const row: MapRow = { id: mapId, state: this.clientState(entry), savedAt: this.savedAtOf(entry) };
    this.copyColumns(row, this.mapRecord(entry));
    return row;
  }

  /**
   * Reads from the map's state without copying it: `read` gets the state the store itself
   * holds and must not change it or keep a reference into it. A whole-state copy of a large
   * map costs far more than reading one scope out of it. Returns null when the map has id
   * aliases (the client then needs translated ids; use `getMapRow`).
   */
  readState<T>(mapId: string, read: (state: AppState, savedAt: string) => T): T | null {
    this.assertOpen();
    const entry = this.requireMap(mapId);
    if (this.aliasesOf(entry).size !== 0) return null;
    return read(this.warm(entry).state, this.savedAtOf(entry));
  }

  /**
   * Changes on every commit that changed the content of the map: the sequence number of the last
   * such commit. A commit that only sets row columns (tags, archived, pinned, source) leaves it.
   */
  revisionOf(mapId: string): string {
    this.requireMap(mapId);
    return String(this.mapSeq.get(mapId) ?? 0);
  }

  /**
   * The records a reader of map `mapId` is shown for these nodes and relation edges, with their
   * current `rev` (Database_Spec 6, provenance). Ids are the ones the reader got (the store may hold
   * a record under another id); a node also brings its details record. Unknown ids are skipped.
   */
  shownRecords(mapId: string, ids: { nodes?: readonly string[]; links?: readonly string[] }): Array<{ rk: string; rev: number }> {
    const entry = this.maps.get(mapId);
    if (!entry) return [];
    const aliases = this.aliasesOf(entry);
    const out: Array<{ rk: string; rev: number }> = [];
    const add = (rk: string): void => {
      const record = entry.records.get(rk) as { rev?: unknown } | undefined;
      if (record && typeof record.rev === "number") out.push({ rk, rev: record.rev });
    };
    for (const id of ids.nodes ?? []) {
      const stored = aliases.in.node.get(id) ?? id;
      add(`node|${stored}`);
      add(`details|${stored}`);
    }
    for (const id of ids.links ?? []) add(`connection|${aliases.in.graphlink.get(id) ?? id}`);
    return out;
  }

  /** Current `rev` of each record key that exists; absent keys are left out. */
  revsOf(rks: Iterable<string>): Map<string, number> {
    const out = new Map<string, number>();
    for (const rk of rks) {
      const record = this.all.get(rk) as { rev?: unknown } | undefined;
      if (record && typeof record.rev === "number") out.set(rk, record.rev);
    }
    return out;
  }

  syncIdentity(): SyncIdentity {
    return { workspaceId: this.workspaceId, historyId: this.historyId, epoch: this.epoch };
  }

  /** The index preserves record reuse checks, map revisions and deduplication across a clone. */
  snapshotIndex(records: SnapshotRecord[]): string {
    const body: Dict = {
      format: 1,
      seq: this.currentSeq,
      mapSeq: Object.fromEntries(this.mapSeq),
      commandResults: [...this.commands.entries()]
        .filter(([, value]) => value.result === undefined)
        .sort((a, b) => a[1].seq - b[1].seq)
        .slice(-COMMAND_INDEX_RETAIN)
        .map(([key, value]) => [key, { ...value, mapIds: [...value.mapIds] }]),
      snapshot: { seq: this.currentSeq, sha256: sha256(serializeSnapshot(records)) },
    };
    if (this.retired.size > 0) body.retired = Object.fromEntries([...this.retired.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    return JSON.stringify(body) + "\n";
  }

  /** Install the durable outbox writer once a local working store is ready. */
  setCapture(capture: NonNullable<RecordWorkspaceStore["capture"]>): void {
    this.capture = capture;
  }

  /** Import exact committed lines into a confirmed store. Reopen it before reading map caches. */
  appendConfirmed(lines: JournalLine[], throughSeq: number): void {
    if (!Array.isArray(lines) || throughSeq !== this.currentSeq + lines.length || lines.some((line, index) =>
      !line || line.seq !== this.currentSeq + index + 1
      || typeof line.mapId !== "string" || typeof line.issuer !== "string"
      || typeof line.intent !== "string" || typeof line.committedAt !== "string"
      || !Array.isArray(line.ops) || line.ops.some((op) =>
        !op || typeof op.rk !== "string" || (op.op !== "delete"
          && (op.op !== "put" || !op.record || recordRk(op.record as SnapshotRecord) !== op.rk)))
    )) throw new Error("The remote journal is not a contiguous suffix.");
    for (const line of lines) this.appendTracked(line);
  }

  /** Called with every journal line this store appends, after it is durable and applied. */
  setCommitListener(listener: ((line: JournalLine) => void) | undefined): void {
    this.committed = listener;
  }

  /** One record by rk, as a copy; undefined when the store has none. */
  record(rk: string): SnapshotRecord | undefined {
    const record = this.all.get(rk);
    return record === undefined ? undefined : jsonClone(record);
  }

  /** Canonical record baseline/delta for map-watch clients. Null means the cursor has a gap. */
  readMapRecords(mapId: string, since?: string) {
    this.assertOpen();
    const cursor = this.mapChanges.cursor(mapId, this.currentSeq);
    const delta = since === undefined ? undefined : this.mapChanges.since(mapId, since, this.currentSeq);
    if (delta === null) return null;
    const entry = this.maps.get(mapId);
    if (since === undefined && !entry) return undefined;
    const keys = delta?.recordKeys ?? [...new Set([
      ...entry!.records.keys(), ...entry!.idMaps.keys(), ...(this.decayByMap.get(mapId) ?? []),
    ])];
    const records = keys.map(rk => {
      const record = this.record(rk);
      // A rename moves keys to another map. Those keys are deletions for the old map.
      const belongs = record && (record.kind === "extensionDef"
        || (record.kind === "map" ? record.id === mapId : "mapId" in record && record.mapId === mapId));
      return { rk, record: belongs ? record : null };
    });
    return { mapId, ...cursor, seq: this.currentSeq, full: since === undefined,
      ...(since === undefined ? { header: this.header() } : { previousRevision: since }),
      deleted: !entry, records };
  }

  /** Journal lines after `seq` through the current commit: from Neo4j, or from the old files. Null when they no longer reach back that far. */
  async readJournalAfter(seq: number): Promise<JournalLine[] | null> {
    this.assertOpen();
    if (!this.durability) throw new Error("The record store is closed.");
    if (seq >= this.currentSeq) return [];
    try {
      return await this.durability.readLines(seq, this.currentSeq) as JournalLine[];
    } catch (error) {
      if ((error as { code?: string }).code === "JOURNAL_GAP") return null;
      throw error;
    }
  }

  /**
   * Local mode: give the records `rks` the values `target` holds, as one journal line, and forget
   * the Commands `forget` so they can be committed again. The work is proportional to `rks`.
   * Returns the line's sequence number.
   */
  resetRecords(rks: Iterable<string>, target: (rk: string) => SnapshotRecord | undefined, forget: ReadonlyArray<{ mapId: string; commandId: string; newMapId?: string }>): number {
    this.assertOpen();
    const ops: RecordOp[] = [];
    for (const rk of new Set(rks)) {
      if (rk.startsWith("commit|") || rk.startsWith("snapshot|")) continue;
      const current = this.all.get(rk);
      const wanted = target(rk);
      if (wanted === undefined) {
        if (current !== undefined) ops.push({ op: "delete", rk });
      } else if (current === undefined || canonicalStringify(current) !== canonicalStringify(wanted)) {
        if (wanted.kind === "node") this.retired.delete(wanted.id);
        ops.push({ op: "put", rk, record: wanted });
      }
    }
    const ids = [...new Set(forget.map(item => item.commandId))].filter(id => {
      const known = this.commands.get(id);
      return known !== undefined && known.result?.ok !== false;
    });
    if (ids.length > 0) {
      const row: CommandResultLine = { afterSeq: this.currentSeq, forget: ids };
      this.durability!.enqueue({ kind: "forget", commandIds: ids });
      this.loadResultLine(row);
    }
    const line: JournalLine = { seq: this.currentSeq + 1, issuer: "system", committedAt: this.now(), mapId: "", intent: LOCAL_REBASE_INTENT, ops };
    this.appendTracked(line);
    return line.seq;
  }

  /** Appends a line that did not come through a commit, and brings the map caches up to date for its records. */
  private appendTracked(line: JournalLine): void {
    const changed = line.ops.map((op) => ({ rk: op.rk, before: this.all.get(op.rk), after: op.op === "put" ? op.record as SnapshotRecord : undefined }));
    this.append(line, true);
    this.reindexMaps(changed, line.seq);
  }

  /** Map caches after records changed outside a commit: the tables follow the records, derived caches are dropped. */
  private reindexMaps(changed: ReadonlyArray<{ rk: string; before: SnapshotRecord | undefined; after: SnapshotRecord | undefined }>, seq: number): void {
    const mapOf = (record: SnapshotRecord | undefined): string | undefined => {
      if (record === undefined || record.kind === "extensionDef" || record.kind === "decay" || record.kind === "commit" || record.kind === "snapshot") return undefined;
      const mapId = record.kind === "map" ? record.id : (record as { mapId?: unknown }).mapId;
      return typeof mapId === "string" ? mapId : undefined;
    };
    const touched = new Set<string>();
    for (const { before, after } of changed) {
      if (before?.kind === "map" && after === undefined) this.maps.delete(before.id);
      if (after?.kind === "map" && !this.maps.has(after.id)) this.maps.set(after.id, { id: after.id, records: new Map(), idMaps: new Map() });
    }
    for (const { rk, before, after } of changed) {
      const from = mapOf(before);
      const to = mapOf(after);
      const fromEntry = from === undefined ? undefined : this.maps.get(from);
      if (fromEntry) {
        (before!.kind === "idMap" ? fromEntry.idMaps : fromEntry.records).delete(rk);
        touched.add(from!);
      }
      const toEntry = to === undefined ? undefined : this.maps.get(to);
      if (toEntry) {
        (after!.kind === "idMap" ? toEntry.idMaps : toEntry.records).set(rk, after!);
        touched.add(to!);
      }
    }
    for (const mapId of touched) {
      const entry = this.maps.get(mapId);
      if (!entry) continue;
      entry.warm = undefined;
      entry.graph = undefined;
      entry.counts = undefined;
      entry.aliases = undefined;
      this.mapSeq.set(mapId, seq);
    }
  }

  /** The current full record set in canonical order. The records are copies. */
  records(): SnapshotRecord[] {
    return sortRecords(jsonClone([this.header(), ...this.all.values()]));
  }

  /**
   * Activity of a node or scope at `at`, one multiply per scale and no increment.
   * `target` is the rk (`node|id` or `scope|id`). Undefined when that target has never been touched.
   */
  activityAt(target: string, at: string): number[] | undefined {
    this.assertOpen();
    const record = this.all.get(`decay|${target}`);
    if (record?.kind !== "decay") return undefined;
    return readDecay(record.v, record.t, at);
  }

  /** The journal line of a Command committed under this id: from Neo4j, or from the old files. */
  async readCommittedCommand(mapId: string, commandId: string): Promise<JournalLine | null> {
    if (!this.durability) throw new Error("The record store is closed.");
    const known = this.commands.get(commandId);
    if (!known || known.result) return null;
    const lines = await this.durability.readLines(known.seq - 1, known.seq).catch(() => null);
    return (lines?.[0] as JournalLine | undefined) ?? null;
  }

  /**
   * `appliedSeq`: the last commit the storage engine holds (the journal position when there is no
   * engine). `error`: why the engine is behind, while it is; the applier keeps retrying.
   */
  engineStatus(): { appliedSeq: number; error?: string; database: "neo4j" } {
    const status: { appliedSeq: number; error?: string; database: "neo4j" } = { appliedSeq: this.currentSeq, database: "neo4j" };
    if (this.durability?.error !== undefined) status.error = this.durability.error;
    return status;
  }

  // ---------------------------------------------------------------- commits

  private commandResult(entry: CommandEntry, askedMapId?: string): CommitResult {
    if (entry.result) {
      const result = jsonClone(entry.result);
      if (!result.ok && (result as Partial<CommitFailure>).current === undefined) {
        const mapId = askedMapId !== undefined && this.maps.has(askedMapId) ? askedMapId : [...entry.mapIds][0];
        const map = mapId === undefined ? undefined : this.maps.get(mapId);
        (result as CommitFailure).current = map ? this.currentOf(map) : null;
      }
      return result;
    }
    return { ok: true, savedAt: this.committedAtOf(entry.seq), seq: entry.seq, replayed: true };
  }

  /** O(1) in the remembered set. Journal data is always replayed even on a legacy collision. */
  private indexCommand(id: string, entry: CommandEntry): void {
    const prior = this.commands.get(id);
    if (!prior) { this.commands.set(id, entry); return; }
    if (prior.seq === entry.seq && !prior.result && !entry.result) {
      // Old indexes held separate map and sync keys for the same journal line.
      for (const mapId of entry.mapIds) prior.mapIds.add(mapId);
      if (entry.mapIds.size > 0) { prior.hash = entry.hash; prior.canonicalHash = entry.canonicalHash; }
      prior.syncHash ??= entry.syncHash;
      return;
    }
    this.commandCollisions += 1;
    if (entry.seq < prior.seq) this.commands.set(id, entry);
  }

  private rememberResult(id: string, content: Pick<CommandEntry, "hash" | "syncHash" | "mapIds">, result: CommitResult): void {
    if (!id.trim() || this.commands.has(id)) return;
    if (result.ok ? !result.noOp : !REMEMBERED_REJECTIONS.has(result.code)) return;
    const entry: StoredCommandEntry = { ...content, mapIds: [...content.mapIds], seq: this.currentSeq, result: withoutState(result) };
    const row: CommandResultLine = { afterSeq: this.currentSeq, commandId: id, entry };
    this.durability!.enqueue({ kind: "result", commandId: id, entry: { ...entry, mapIds: [...content.mapIds] } as StoredCommand });
    this.loadResultLine(row);
  }

  private loadResultLine(row: CommandResultLine): void {
    if ("forget" in row) {
      for (const id of row.forget) {
        const known = this.commands.get(id);
        if (known && known.seq <= row.afterSeq && known.result?.ok !== false) this.commands.delete(id);
      }
    } else if (!this.commands.has(row.commandId)) {
      this.commands.set(row.commandId, { ...row.entry, mapIds: new Set(row.entry.mapIds) });
    }
  }

  commitMapCommand(mapId: string, command: MapCommand, issuer: string, expectedRevision?: string, sync?: { hash: string; create: boolean }): CommitResult {
    this.assertOpen();
    if (!command || typeof command !== "object" || typeof command.commandId !== "string") {
      return this.failure("INVALID_COMMAND", null, "Command must be an object with a commandId.");
    }
    const hash = hashChanges(command.changes);
    const known = this.commands.get(command.commandId);
    if (known) {
      if (known.hash === hash || known.canonicalHash === hash) {
        return this.commandResult(known, mapId);
      }
      const entry = this.maps.get(mapId);
      return this.failure("SAME_ID_DIFFERENT_CONTENT", entry ? this.currentOf(entry) : null, "The Command ID was already used with different content.");
    }
    const result = this.commitNewMapCommand(mapId, command, issuer, expectedRevision, sync);
    this.rememberResult(command.commandId, { hash, syncHash: sync?.hash, mapIds: new Set([mapId]) }, result);
    return result;
  }

  private commitNewMapCommand(mapId: string, command: MapCommand, issuer: string, expectedRevision?: string, sync?: { hash: string; create: boolean }): CommitResult {
    const entry = this.maps.get(mapId);
    if (!entry && !sync?.create) return this.failure("NOT_FOUND", null);
    if (entry && sync?.create) return this.failure("CONFLICT", this.currentOf(entry), "The map already exists.");
    const shape = commandShape(command);
    if (shape) return this.failure("INVALID_COMMAND", entry ? this.currentOf(entry) : null, shape);
    if (expectedRevision !== undefined && expectedRevision !== this.revisionOf(mapId)) {
      return this.failure("CONFLICT", entry ? this.currentOf(entry) : null, "The map changed since the revision the command was built on.");
    }
    let changes: RecordChange[];
    try {
      changes = jsonClone(command.changes).filter(change => change.op !== "update" || !sameJson(change.before ?? {}, change.after ?? {}));
    } catch {
      return this.failure("INVALID_COMMAND", entry ? this.currentOf(entry) : null, "changes cannot be written as JSON.");
    }
    if (entry && changes.length === 0) return { ok: true, savedAt: this.savedAtOf(entry), seq: this.currentSeq, replayed: false, noOp: true };
    let provenance: Provenance | undefined;
    try {
      provenance = normalizeProvenance(command.provenance);
    } catch (error) {
      return this.failure("INVALID_COMMAND", entry ? this.currentOf(entry) : null, (error as Error).message);
    }
    const meta = {
      commandId: command.commandId,
      intent: command.intent,
      actor: command.actor,
      provenance,
      reason: typeof command.reason === "string" ? command.reason : undefined,
      confirm: command.confirm === true,
      syncHash: sync?.hash,
      sent: changes,
    };
    // The client names records by its own ids; the store may hold some of them under another id.
    const plan = this.planAliases(entry, mapId, idsCreatedBy(changes));
    if (plan === null) return this.commitChanges(mapId, entry, changes, issuer, meta);
    return this.commitChanges(mapId, entry, translateChanges(changes, plan.in), issuer, meta, { aliases: plan.records, sent: changes });
  }

  /** Saves a whole state: the difference to the current state goes through the commit path. Creates the map if absent. */
  saveWholeMap(mapId: string, state: AppState, issuer: string, intent?: string): CommitResult {
    this.assertOpen();
    const entry = this.maps.get(mapId);
    let next: AppState;
    try {
      next = jsonClone(state);
    } catch {
      return this.failure("INVALID_STATE", entry ? this.currentOf(entry) : null, "state cannot be written as JSON.");
    }
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      return this.failure("INVALID_STATE", entry ? this.currentOf(entry) : null, "state must be an object.");
    }
    // Ids of this state that another map already holds get a stored id of their own; the state
    // is committed with the stored ids, and the client keeps seeing the ids it sent.
    const sent = this.capture ? diffState(entry ? this.clientState(entry) : {}, next) : undefined;
    const plan = this.planAliases(entry, mapId, idsOfState(next));
    if (plan !== null) next = translateState(next, plan.in);
    const changes = diffState(entry ? this.warm(entry).state : {}, next);
    if (entry && changes.length === 0) {
      return { ok: true, savedAt: this.savedAtOf(entry), seq: this.mapSeq.get(mapId) ?? 0, replayed: false };
    }
    return this.commitChanges(mapId, entry, changes, issuer, {
      commandId: `save:${randomUUID()}`,
      intent: intent ?? (entry ? "save-map" : "create-map"),
      actor: { kind: "system", id: issuer },
      sent,
    }, plan !== null ? { aliases: plan.records } : undefined);
  }

  /** Sets the row columns of a map. A key that is present with null or undefined removes the column. */
  setMapColumns(mapId: string, columns: MapColumns, issuer: string, sync?: MapOpCommit): void {
    this.assertOpen();
    const entry = this.requireMap(mapId);
    const warm = this.warm(entry);
    const row = this.rowOf(entry, warm.state) as unknown as Dict;
    for (const field of COLUMN_FIELDS) {
      if (!hasOwn(columns, field)) continue;
      const value = columns[field];
      if (value === null || value === undefined) delete row[field];
      else row[field] = jsonClone(value);
    }
    const result = warm.projector.project(row as unknown as SnapshotRow, entry.records);
    const seq = this.currentSeq + 1;
    const ops = this.opsOf(result, seq);
    if (ops.length === 0) {
      entry.records = result.records;
      warm.state = result.state;
      return;
    }
    // A journal line and a commit number of its own, but not a change of the map's content:
    // the saved-at time and the revision of the map stay as they are.
    const capture = this.capture && !sync;
    const before: MapColumns = {};
    const after: MapColumns = {};
    if (capture) {
      const prior = this.mapRecord(entry);
      for (const field of COLUMN_FIELDS) {
        if (!hasOwn(columns, field)) continue;
        before[field] = prior[field] ?? null;
        after[field] = columns[field] ?? null;
      }
    }
    this.appendMapOperation({ seq, issuer, committedAt: this.now(), mapId, intent: "set-map-columns", mapOp: "columns", ops },
      entry, sync, capture ? { mapOp: "columns", before, columns: after } : undefined);
    entry.records = result.records;
    warm.state = result.state;
  }

  /** Deletes the map and every record that belongs to it. */
  deleteMap(mapId: string, issuer: string, sync?: MapOpCommit): void {
    this.assertOpen();
    const entry = this.requireMap(mapId);
    const ops: RecordOp[] = [];
    for (const [rk, record] of entry.records) {
      if (record.kind === "extensionDef") continue;
      ops.push({ op: "delete", rk });
    }
    for (const rk of entry.idMaps.keys()) ops.push({ op: "delete", rk });
    for (const rk of [...(this.decayByMap.get(mapId) ?? [])]) ops.push({ op: "delete", rk });
    this.appendMapOperation({ seq: this.currentSeq + 1, issuer, committedAt: this.now(), mapId, intent: "delete-map", mapOp: "delete", ops },
      entry, sync, this.capture && !sync ? { mapOp: "delete", before: this.mapFingerprint(entry) } : undefined);
    this.maps.delete(mapId);
  }

  /** Gives the map another id. Node, connection, scope and surface ids stay as they are. */
  renameMapId(oldId: string, newId: string, issuer: string, sync?: MapOpCommit): void {
    this.assertOpen();
    const entry = this.requireMap(oldId);
    if (typeof newId !== "string" || newId === "") throw new Error("The new map id is empty.");
    if (newId === oldId) return;
    if (this.maps.has(newId) || this.all.has(`map|${newId}`)) throw new Error(`Map already exists: ${newId}`);
    const seq = this.currentSeq + 1;
    const ops: RecordOp[] = [];
    const renamed: MapEntry = { id: newId, records: new Map(), idMaps: new Map() };
    const own = new Set<string>([...entry.records.keys(), ...entry.idMaps.keys()]);
    const move = (source: Map<string, SnapshotRecord>, target: Map<string, SnapshotRecord>): void => {
      for (const [rk, record] of source) {
        if (record.kind === "extensionDef") continue;
        const copy = (record.kind === "map" ? { ...record, id: newId } : { ...record, mapId: newId }) as SnapshotRecord;
        if (hasOwn(copy, "rev")) (copy as { rev: number }).rev = seq;
        const nextRk = recordRk(copy);
        if (nextRk !== rk) {
          if (this.all.has(nextRk) && !own.has(nextRk)) throw new Error(`Renaming would overwrite the record ${JSON.stringify(nextRk)}.`);
          ops.push({ op: "delete", rk });
        }
        target.set(nextRk, copy);
      }
    };
    move(entry.records, renamed.records);
    move(entry.idMaps, renamed.idMaps);
    for (const [rk, record] of [...renamed.records, ...renamed.idMaps]) ops.push({ op: "put", rk, record });
    for (const rk of [...(this.decayByMap.get(oldId) ?? [])]) {
      const record = this.all.get(rk);
      if (record?.kind !== "decay") continue;
      const copy: DecayRecord = { ...record, mapId: newId, rev: seq };
      ops.push({ op: "put", rk, record: copy });
    }
    this.appendMapOperation({ seq, issuer, committedAt: this.now(), mapId: oldId, intent: "rename-map", mapOp: "rename", newMapId: newId, ops },
      entry, sync, this.capture && !sync ? { mapOp: "rename", newMapId: newId } : undefined);
    this.maps.delete(oldId);
    this.maps.set(newId, renamed);
    if (entry.warm) this.warm(renamed);
  }

  private mapFingerprint(entry: MapEntry): string {
    const columns: MapColumns = {};
    this.copyColumns(columns, this.mapRecord(entry));
    return hashChanges([this.clientState(entry), columns]);
  }

  private mapName(entry: MapEntry | undefined): string {
    if (!entry) return "";
    const map = this.mapRecord(entry);
    const label = map.extra?.mapLabel;
    if (typeof label === "string" && label.trim()) return label;
    const root = entry.records.get(`node|${map.rootNodeId}`);
    return root?.kind === "node" ? root.text ?? "" : "";
  }

  private appendMapOperation(
    line: JournalLine, entry: MapEntry, sync: MapOpCommit | undefined,
    operation: SyncMapOperation | undefined,
  ): void {
    if (operation && this.capture) {
      const command: MapCommand = {
        commandId: randomUUID(), intent: line.intent, actor: { kind: "system", id: line.issuer }, changes: [],
      };
      const payload = { ...operation, mapId: line.mapId, command };
      this.capture(payload, line.issuer, line.committedAt, this.mapName(entry));
      sync = { command, hash: syncHash(payload) };
    }
    if (sync) {
      line.commandId = sync.command.commandId;
      line.actor = sync.command.actor;
      line.intent = sync.command.intent;
      line.syncHash = sync.hash;
    }
    this.append(line);
  }

  syncReceipt(payload: SyncCommand): CommitResult | undefined {
    const { command } = payload;
    const known = this.commands.get(command.commandId);
    if (known === undefined) return undefined;
    const same = known.syncHash !== undefined ? known.syncHash === syncHash(payload)
      : payload.mapOp === undefined && (known.hash === hashChanges(command.changes) || known.canonicalHash === hashChanges(command.changes));
    if (!same) {
      return this.failure("SAME_ID_DIFFERENT_CONTENT", null, "The Command ID was already used with different content.");
    }
    return this.commandResult(known, payload.mapOp === "rename" ? payload.newMapId : payload.mapId);
  }

  /** Validates a pending Command against the current state, for push and working-store replay. */
  commitSyncCommand(payload: SyncCommand, issuer: string): CommitResult {
    this.assertOpen();
    const prior = this.syncReceipt(payload);
    if (prior !== undefined) return prior;
    const result = this.commitNewSyncCommand(payload, issuer);
    this.rememberResult(payload.command.commandId, {
      hash: payload.mapOp === undefined || payload.mapOp === "create" ? hashChanges(payload.command.changes) : syncHash(payload),
      syncHash: syncHash(payload), mapIds: new Set(payload.mapOp === "rename" ? [payload.mapId, payload.newMapId] : [payload.mapId]),
    }, result);
    return result;
  }

  private commitNewSyncCommand(payload: SyncCommand, issuer: string): CommitResult {
    const { command, mapId, mapOp } = payload;
    const shape = commandShape(command);
    if (shape) return this.failure("INVALID_COMMAND", null, shape);
    if (command.changes.some((change) => !validSyncChange(change))) {
      return this.failure("INVALID_COMMAND", null, "The Command has an unsupported record change.");
    }
    const entry = this.maps.get(mapId);
    if (!entry && mapOp !== "create") return this.failure("CONFLICT", null, "The map does not exist.");
    const hash = syncHash(payload);
    if (mapOp === undefined || mapOp === "create") {
      return this.commitMapCommand(mapId, command, issuer, undefined, { hash, create: mapOp === "create" });
    }
    // The shape checks above ensure all other map operations have an existing source map.
    const source = this.requireMap(mapId);
    const conflict = (message: string): CommitFailure => this.failure("CONFLICT", this.currentOf(source), message);
    const sync = { command, hash };
    const previousSeq = this.currentSeq;
    if (mapOp === "delete") {
      if (payload.before !== undefined && payload.before !== this.mapFingerprint(source)) return conflict("The map changed before deletion.");
      this.deleteMap(mapId, issuer, sync);
    } else if (mapOp === "rename") {
      if (payload.newMapId !== mapId && this.hasMap(payload.newMapId)) return conflict("The destination map already exists.");
      this.renameMapId(mapId, payload.newMapId, issuer, sync);
    } else {
      const current = this.mapRecord(source);
      for (const field of COLUMN_FIELDS) {
        const desired = payload.columns[field] ?? null;
        const actual = current[field] ?? null;
        if (hasOwn(payload.before ?? {}, field) && !sameJson(actual, payload.before?.[field]) && !sameJson(actual, desired)) {
          return conflict(`The map column ${field} changed.`);
        }
      }
      this.setMapColumns(mapId, payload.columns, issuer, sync);
    }
    return {
      ok: true, seq: this.currentSeq, savedAt: this.committedAtOf(this.currentSeq), replayed: false,
      ...(this.currentSeq === previousSeq ? { noOp: true as const } : {}),
    };
  }

  /**
   * One Command. Work mode creates a scope, one alias per entity in the range and the parent
   * edges between those aliases. Observe mode stores only the scope.
   */
  project(mapId: string, issuer: string, input: {
    commandId?: string;
    mode: "observe" | "work";
    scopeKey?: string;
    relationType?: string;
    root?: string;
    entities?: string[];
    depth?: number;
    parentId?: string;
    label?: string;
  }): CommitResult {
    const entry = this.maps.get(mapId);
    if (!entry) return this.failure("NOT_FOUND", null);
    const warm = this.warm(entry);
    let source: ScopeRecord | undefined;
    if (!input.relationType) {
      const token = input.scopeKey ?? this.planeKeyOf(warm.state, input.root);
      if (!token) return this.failure("INVALID_COMMAND", this.currentOf(entry), "A plane projection names the source scope.");
      source = this.scopeByToken(entry, token);
      if (!source) return this.failure("NOT_FOUND", this.currentOf(entry), "The source scope does not exist.");
    }
    const commandId = input.commandId ?? `project:${randomUUID()}`;
    const reads = input.relationType ? this.readsOf(input.relationType) : undefined;
    return this.keepBase(mapId, input.mode === "work", this.commitPlanned(mapId, issuer, "project", (state) => planProject(state, {
      commandId,
      mode: input.mode,
      workspaceId: this.workspaceId,
      mapId,
      seq: this.currentSeq + 1,
      sourceScopeId: source?.id,
      scopeRootId: source?.rootNodeId,
      relationType: input.relationType,
      reads,
      root: input.root,
      entities: input.entities,
      depth: input.depth,
      parentId: input.parentId,
      label: input.label,
    }), { commandId }));
  }

  /**
   * After a work projection or a write-back: the map's state at that commit is the base the next
   * write-back diffs against, so it is kept (in this process and in Neo4j, as a store of its own).
   * Bases no scope refers to any more are dropped.
   */
  private keepBase(mapId: string, keep: boolean, result: CommitResult): CommitResult {
    if (!keep || !result.ok || result.replayed) return result;
    const entry = this.maps.get(mapId);
    if (!entry) return result;
    const records = [...entry.records.values(), ...this.extensionDefs.values()].map((record) => jsonClone(record));
    const key = `${mapId}@${result.seq}`;
    this.bases.set(key, records);
    this.durability!.enqueue({ kind: "base", key, records });
    const referenced = new Set<string>();
    for (const map of this.maps.values()) {
      for (const record of map.records.values()) {
        const projection = record.kind === "scope" ? (record as ScopeRecord).projection : undefined;
        if (projection?.mode === "work" && projection.baseSeq !== undefined) referenced.add(`${map.id}@${projection.baseSeq}`);
      }
    }
    for (const old of [...this.bases.keys()]) {
      if (referenced.has(old) || old === key) continue;
      this.bases.delete(old);
      this.durability!.enqueue({ kind: "dropBase", key: old });
    }
    return result;
  }

  /** Diffs a work plane against `projection.baseSeq` and applies the write-back table in one Command. */
  writeBack(mapId: string, issuer: string, input: {
    commandId?: string;
    scopeKey: string;
    reason: string;
    name?: string;
    nodes?: Record<string, NodeChoice>;
  }): CommitResult {
    const entry = this.maps.get(mapId);
    if (!entry) return this.failure("NOT_FOUND", null);
    const scope = this.scopeFor(entry, input.scopeKey);
    if (!scope?.projection) return this.failure("NOT_FOUND", this.currentOf(entry), "This scope has no projection.");
    if (scope.projection.mode !== "work" || scope.projection.baseSeq === undefined) {
      return this.failure("INVALID_COMMAND", this.currentOf(entry), "Write-back applies to a work projection.");
    }
    const base = this.stateAt(mapId, scope.projection.baseSeq);
    if (!base) return this.failure("INVALID_COMMAND", this.currentOf(entry), "The projection base cannot be read.");
    const commandId = input.commandId ?? `write-back:${randomUUID()}`;
    const from = scope.projection.from;
    const homeRootId = "scopeId" in from ? this.scopeRootOf(entry, from.scopeId) : undefined;
    const reads = "relationType" in from ? this.readsOf(from.relationType) : undefined;
    const stateKey = `scope:${scope.rootNodeId}`;
    return this.keepBase(mapId, true, this.commitPlanned(mapId, issuer, "write-back", (state) => planWriteBack(state, base, {
      commandId,
      workspaceId: this.workspaceId,
      mapId,
      seq: this.currentSeq + 1,
      scopeKey: stateKey,
      reason: input.reason,
      name: input.name,
      nodes: input.nodes,
      reads,
      homeRootId,
      scopeRecordId: scope.id,
    }), { commandId, reason: input.reason }));
  }

  /** Turns a node into an alias of an existing entity. No binding record. */
  linkToEntity(mapId: string, issuer: string, input: { commandId?: string; nodeId: string; targetId?: string; unlink?: boolean }): CommitResult {
    const commandId = input.commandId ?? `link-entity:${randomUUID()}`;
    return this.commitPlanned(mapId, issuer, "link-entity", (state) => planLink(state, input.nodeId, input.targetId, input.unlink === true), { commandId });
  }

  /**
   * Sets band to rapid, or retention. Deep is refused: a scope becomes deep by promotion.
   * Shortening retention.ms needs `confirm`.
   */
  setBand(mapId: string, issuer: string, input: {
    commandId?: string;
    scopeKey: string;
    band?: "rapid" | "deep";
    retentionMs?: number;
    retentionBytes?: number;
    confirm?: boolean;
  }): CommitResult {
    const entry = this.maps.get(mapId);
    if (!entry) return this.failure("NOT_FOUND", null);
    const scope = this.scopeFor(entry, input.scopeKey);
    if (!scope) return this.failure("NOT_FOUND", this.currentOf(entry), "The scope does not exist.");
    const commandId = input.commandId ?? `set-band:${randomUUID()}`;
    const stateKey = scope.projection?.mode === "observe" ? `scope:${scope.id}` : `scope:${scope.rootNodeId}`;
    return this.commitPlanned(mapId, issuer, "set-band", (state) => planSetBand(state, stateKey, input.band, input.retentionMs, input.retentionBytes), {
      commandId,
      confirm: input.confirm,
    });
  }

  /** Promotes a rapid scope. Every node needs `new` or an existing entity. A committed promotion writes a namedSnapshot. */
  promote(mapId: string, issuer: string, input: {
    commandId?: string;
    scopeKey: string;
    nodes: Record<string, NodeChoice>;
    reason?: string;
  }): CommitResult {
    const entry = this.maps.get(mapId);
    if (!entry) return this.failure("NOT_FOUND", null);
    const scope = this.scopeFor(entry, input.scopeKey);
    if (!scope) return this.failure("NOT_FOUND", this.currentOf(entry), "The scope does not exist.");
    const commandId = input.commandId ?? `promote:${randomUUID()}`;
    const reason = input.reason?.trim() ? input.reason : "promotion";
    const stateKey = `scope:${scope.rootNodeId}`;
    return this.commitPlanned(mapId, issuer, "promote", (state) => planPromote(state, {
      scopeKey: stateKey,
      nodes: input.nodes,
      reason,
      workspaceId: this.workspaceId,
      mapId,
      commandId,
      seq: this.currentSeq + 1,
      scopeRecordId: scope.id,
    }), { commandId, reason });
  }

  /** Writes a portable snapshot at the commit seq and marks it so retention and compaction keep the file. */
  createNamedSnapshot(mapId: string, issuer: string, input: { commandId?: string; scopeKey: string; name: string; reason: string; id?: string }): CommitResult {
    const entry = this.maps.get(mapId);
    if (!entry) return this.failure("NOT_FOUND", null);
    const scope = this.scopeFor(entry, input.scopeKey);
    if (!scope) return this.failure("NOT_FOUND", this.currentOf(entry), "The scope does not exist.");
    const commandId = input.commandId ?? `named-snapshot:${randomUUID()}`;
    return this.commitPlanned(mapId, issuer, "named-snapshot", (state) => planNamedSnapshot(state, {
      id: input.id,
      name: input.name,
      seq: this.currentSeq + 1,
      scopeRecordId: scope.id,
      reason: input.reason,
      workspaceId: this.workspaceId,
      mapId,
      commandId,
    }), { commandId, reason: input.reason });
  }

  /** Deletes the namedSnapshot record. `confirm` is required; the archive file loses its keep-mark. */
  deleteNamedSnapshot(mapId: string, issuer: string, input: { commandId?: string; id: string; confirm?: boolean }): CommitResult {
    const commandId = input.commandId ?? `delete-named-snapshot:${randomUUID()}`;
    return this.commitPlanned(mapId, issuer, "delete-named-snapshot", (state) => planDeleteNamedSnapshot(state, input.id), {
      commandId,
      confirm: input.confirm === true,
    });
  }

  /** Occurrences of a projection. Observe mode is computed; work mode is the aliases on the plane. */
  readProjection(mapId: string, scopeKey: string): { ok: true; occurrences: OccurrenceView[] } | { ok: false; code: "NOT_FOUND" | "INVALID_COMMAND"; message: string } {
    this.assertOpen();
    const entry = this.maps.get(mapId);
    if (!entry) return { ok: false, code: "NOT_FOUND", message: "The map does not exist." };
    const scope = this.scopeFor(entry, scopeKey);
    if (!scope?.projection) return { ok: false, code: "NOT_FOUND", message: "This scope has no projection." };
    const warm = this.warm(entry);
    const stateKey = scope.projection.mode === "observe" ? `scope:${scope.id}` : `scope:${scope.rootNodeId}`;
    const view = warm.state.scopes?.[stateKey];
    if (!view) return { ok: false, code: "NOT_FOUND", message: "This scope has no projection." };
    const from = scope.projection.from;
    const scopeRootId = "scopeId" in from ? this.scopeRootOf(entry, from.scopeId) : undefined;
    const reads = "relationType" in from ? this.readsOf(from.relationType) : undefined;
    const read = readProjectionView(warm.state, view, { scopeRootId, reads });
    return read.ok ? read : { ok: false, code: "INVALID_COMMAND", message: read.message };
  }

  /** Resolves when Neo4j holds every commit; the same as `durable()`. */
  flush(): Promise<void> {
    return this.durable();
  }

  /**
   * Resolves when every commit made so far is in the database. A client is answered only after
   * this: it is the Neo4j transaction that holds the commit. Rejects with code `DATABASE_UNAVAILABLE` while Neo4j cannot be written.
   */
  durable(): Promise<void> {
    if (!this.durability) return Promise.reject(new Error("The record store is closed."));
    return this.durability.durable();
  }

  /** True while the store is open on Neo4j, the database. */
  onNeo4j(): boolean {
    return this.durability !== undefined;
  }

  /** Neo4j's state for display: the records of one map, read by query. */
  async mapRecordsFromDatabase(mapId: string): Promise<SnapshotRecord[]> {
    this.assertOpen();
    return this.durability!.mapRecords(mapId);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    const durability = this.durability;
    this.durability = undefined;
    this.closed = true;
    if (durability) await durability.close();
  }

  // ---------------------------------------------------------------- internals

  private assertOpen(): void {
    if (this.closed) throw new Error("The record store is closed.");
    if (this.unavailable !== undefined) {
      throw Object.assign(new Error(`The database (Neo4j) is not available: ${this.unavailable}`), { code: "DATABASE_UNAVAILABLE" });
    }
  }

  /** Node record without `rev`. The Undo of a delete puts this body back; any other reuse is refused. */
  private retiredBody(record: SnapshotRecord): string {
    const copy = { ...(record as unknown as Dict) };
    delete copy.rev;
    return canonicalJson(copy);
  }

  private reuseRefusal(ops: readonly RecordOp[]): string | null {
    for (const op of ops) {
      if (op.op !== "put" || op.record?.kind !== "node") continue;
      const record = op.record;
      const prior = this.all.get(op.rk);
      if (prior?.kind === "node") continue;
      const retired = this.retired.get(record.id);
      if (retired === undefined || retired === this.retiredBody(record)) continue;
      return `A deleted id cannot be reused (${record.id}). Only the Undo of the delete may restore it.`;
    }
    return null;
  }

  private failure(code: CommitFailure["code"], current: CommitFailure["current"], message?: string, conflicts: FieldConflict[] = []): CommitFailure {
    const result: CommitFailure = { ok: false, code, conflicts, current };
    if (message !== undefined) result.message = message;
    return result;
  }

  private header(): SnapshotHeader {
    return { kind: "snapshot", format: this.snapshotFormat, ...this.syncIdentity(), seq: this.currentSeq };
  }

  private requireMap(mapId: string): MapEntry {
    const entry = this.maps.get(mapId);
    if (!entry) throw new Error(`Map not found: ${mapId}`);
    return entry;
  }

  private mapRecord(entry: MapEntry): MapRecord {
    return entry.records.get(`map|${entry.id}`) as MapRecord;
  }

  private copyColumns(target: MapColumns, map: MapRecord): void {
    for (const field of COLUMN_FIELDS) {
      if (map[field] !== undefined) target[field] = jsonClone(map[field]);
    }
  }

  private committedAtOf(seq: number): string {
    const commit = this.all.get(`commit|${seq}`) as CommitRecord | undefined;
    return commit?.committedAt ?? "";
  }

  private savedAtOf(entry: MapEntry): string {
    const seq = this.mapSeq.get(entry.id);
    if (seq !== undefined) return this.committedAtOf(seq);
    const legacy = this.mapRecord(entry).legacySavedAt;
    return typeof legacy === "string" ? legacy : this.committedAtOf(0);
  }

  private currentOf(entry: MapEntry): { savedAt: string; state: object } {
    return { savedAt: this.savedAtOf(entry), state: this.clientState(entry) };
  }

  /** A deep copy of the map's state with the ids the client uses. */
  private clientState(entry: MapEntry): AppState {
    const state = jsonClone(this.warm(entry).state);
    const aliases = this.aliasesOf(entry);
    return aliases.size === 0 ? state : translateState(state, translatorOf(aliases.out));
  }

  private countsOf(entry: MapEntry): { nodes: number; chars: number } {
    if (entry.counts) return entry.counts;
    let nodes = 0;
    let chars = 0;
    const length = (value: unknown): number => (typeof value === "string" ? value.length : 0);
    for (const record of entry.records.values()) {
      if (record.kind === "node") {
        nodes += 1;
        chars += length(record.text);
      } else if (record.kind === "details") {
        chars += length(record.body) + length(record.note);
      }
    }
    entry.counts = { nodes, chars };
    return entry.counts;
  }

  private aliasesOf(entry: MapEntry): NonNullable<MapEntry["aliases"]> {
    if (entry.aliases) return entry.aliases;
    const aliases = { size: 0, in: emptyAliasTable(), out: emptyAliasTable() };
    for (const record of entry.idMaps.values()) {
      if (record.kind !== "idMap" || record.alias !== true) continue;
      aliases.in[record.recordKind].set(record.oldId, record.newId);
      aliases.out[record.recordKind].set(record.newId, record.oldId);
      aliases.size += 1;
    }
    entry.aliases = aliases;
    return aliases;
  }

  /**
   * Decides the stored ids for the client ids a commit brings into the map. An id keeps its
   * alias when it has one. Otherwise it is kept as it is, unless a record of another map (or a
   * record of another kind) already holds it; then it gets the deterministic id of the migration.
   * Order as in the migration: nodes, GraphLinks, annotations, each in string order of the id.
   * Returns null when the map has no alias and needs none (nothing is translated then).
   */
  private planAliases(entry: MapEntry | undefined, mapId: string, ids: IntroducedIds): AliasPlan | null {
    const known = entry ? this.aliasesOf(entry) : undefined;
    const records: IdMapRecord[] = [];
    const table = emptyAliasTable();
    const used = new Set<string>();
    const taken = (id: string): boolean => used.has(id) || this.idIndex.has(id) || this.all.has(`surface|${id}`);
    const assign = (kind: AliasKind, oldId: string): void => {
      // The migration may have left an `idMap` record under the same key (it renumbered this id
      // then, and the client has used the new id since). That record is not replaced: the id
      // gets no alias, and the commit is refused for the collision as it always was.
      if (entry?.idMaps.has(recordRk({ kind: "idMap", recordKind: kind, mapId, oldId, newId: "" }))) return;
      let attempt = 0;
      let newId = aliasId(this.workspaceId, mapId, kind, oldId);
      while (taken(newId)) newId = aliasId(this.workspaceId, mapId, kind, oldId, (attempt += 1));
      used.add(newId);
      table[kind].set(oldId, newId);
      records.push({ kind: "idMap", recordKind: kind, mapId, oldId, newId, alias: true });
    };
    for (const kind of ALIAS_KINDS) {
      for (const oldId of [...new Set(ids[kind])].sort(compareStrings)) {
        if (known?.in[kind].has(oldId)) continue;
        if (kind === "surface") {
          const holder = this.all.get(`surface|${oldId}`) as { mapId?: unknown } | undefined;
          if (holder !== undefined && holder.mapId !== mapId) assign(kind, oldId);
          continue;
        }
        const ownerRk = this.idIndex.get(oldId);
        const owner = ownerRk !== undefined ? (this.all.get(ownerRk) as { mapId?: unknown } | undefined) : undefined;
        const heldElsewhere = owner !== undefined && (owner.mapId !== mapId || ownerRk !== `${ALIAS_RECORD_RK[kind]}|${oldId}`);
        if (heldElsewhere || used.has(oldId)) assign(kind, oldId);
        else used.add(oldId);
      }
    }
    if (records.length === 0 && (known === undefined || known.size === 0)) return null;
    if (known) {
      for (const kind of ALIAS_KINDS) for (const [oldId, newId] of known.in[kind]) table[kind].set(oldId, newId);
    }
    return { records, in: translatorOf(table) };
  }

  private rowOf(entry: MapEntry, state: object): SnapshotRow {
    const map = this.mapRecord(entry);
    const row: SnapshotRow = { id: entry.id, state };
    for (const field of COLUMN_FIELDS) {
      if (map[field] !== undefined) row[field] = map[field];
    }
    if (map.legacyVersion !== undefined) row.version = map.legacyVersion;
    if (map.legacySavedAt !== undefined) row.saved_at = map.legacySavedAt;
    return row;
  }

  /** Puts the workspace extension definitions where the map's projection can see them. */
  private attachExtensionDefs(entry: MapEntry): void {
    for (const [rk, record] of this.extensionDefs) entry.records.set(rk, record);
  }

  /** State, projector and check baselines of a map; built on first use. */
  private warm(entry: MapEntry): NonNullable<MapEntry["warm"]> {
    if (entry.warm) return entry.warm;
    this.attachExtensionDefs(entry);
    this.guardIndex(entry.id); // Build with the loaded map, before any in-place commit projection.
    const records = [...entry.records.values()];
    const restored = fromSnapshot(records).rows[0]?.state ?? ({ nodes: {} } as unknown as AppState);
    const projector = new MapProjector(this.workspaceId);
    let state = restored;
    try {
      // The stored records are normally exactly what the projection gives for their own state.
      // Then the projector starts with them and the next commit only looks at what it touches.
      const result = projector.project(this.rowOf(entry, restored), entry.records);
      const same = result.delta.size === 0;
      if (same) {
        entry.records = result.records;
        state = result.state;
      }
    } catch {
      // Records the projection cannot reproduce: the first commit of the map reports why.
    }
    entry.graph = NeighbourhoodIndex.fromRecords(entry.records.values());
    entry.warm = {
      projector,
      state,
      validationErrors: commitValidationErrorCount(state),
      problems: new Set(checkInvariants(records).map(problemKey)),
    };
    return entry.warm;
  }

  /** The projection's difference as record operations. Stamps `rev` on every record that is put. */
  private opsOf(result: ProjectionResult, seq: number): RecordOp[] {
    const ops: RecordOp[] = [];
    for (const [rk, record] of result.delta) {
      if (record === null) continue;
      if (hasOwn(record, "rev")) (record as { rev: number }).rev = seq;
      ops.push({ op: "put", rk, record });
    }
    for (const [rk, record] of result.delta) {
      if (record === null) ops.push({ op: "delete", rk });
    }
    return ops;
  }

  private commitChanges(
    mapId: string,
    entry: MapEntry | undefined,
    changes: RecordChange[],
    issuer: string,
    meta: { commandId: string; intent: string; actor?: MapCommand["actor"]; provenance?: Provenance; reason?: string; confirm?: boolean; sent?: RecordChange[]; syncHash?: string },
    /**
     * `changes` use stored ids. `aliases`: the `idMap` records this commit adds. `sent`: the
     * changes with the ids the client used, kept in the journal in place of `changes`.
     */
    translated?: { aliases: IdMapRecord[]; sent?: RecordChange[] },
  ): CommitResult {
    const warm = entry ? this.warm(entry) : undefined;
    const current = (): CommitFailure["current"] => (entry ? this.currentOf(entry) : null);
    const clientConflicts = (conflicts: FieldConflict[]): FieldConflict[] => {
      const known = entry ? this.aliasesOf(entry) : undefined;
      const added = translated?.aliases ?? [];
      if ((known === undefined || known.size === 0) && added.length === 0) return conflicts;
      const out = emptyAliasTable();
      if (known) for (const kind of ALIAS_KINDS) for (const [newId, oldId] of known.out[kind]) out[kind].set(newId, oldId);
      for (const record of added) out[record.recordKind].set(record.newId, record.oldId);
      return translateConflicts(conflicts, translatorOf(out));
    };

    // A scope's label, root list and relation list are derived from the tree and are not
    // stored, so they take no part in compare-and-set: a client holding an older derived
    // label must not be refused for it.
    changes = withCurrentDerivedScopeFields(changes, warm ? warm.state : {});

    // Ordinary position changes are LWW in confirmation order. Only the position's
    // expected values are refreshed; content remains CAS and projection write-back
    // retains its original position base. Missing edges still fail CAS.
    if (warm && meta.intent !== "write-back") {
      changes = changes.map(change => {
        if (change.kind !== "edge" || change.op !== "update") return change;
        const node = warm.state.nodes[change.key[0]];
        if (!node || typeof node.parentId !== "string") return change;
        const before = { ...change.before };
        for (const field of Object.keys(before)) {
          if (field === "parentId") before.parentId = node.parentId;
          else if (field === "ord") before.ord = node.edgeOrder;
          // Compatibility reader only. New Commands carry stable order keys.
          else if (field === "index") before.index = warm.state.nodes[node.parentId]?.children.indexOf(change.key[0]);
        }
        return { ...change, before };
      });
    }

    // Content updates reach only named nodes. Keep the full table out of copy-on-write
    // and projection; the projector installs those nodes with a rollback after validation.
    const contentOnly = warm !== undefined && validationUnaffected(changes)
      && warm.projector.canProjectContent(entry!.records);
    const parentEdgesOnly = warm !== undefined && warm.validationErrors === 0 && warm.problems.size === 0
      && warm.projector.canProjectContent(entry!.records) && warm.projector.canProjectParentEdges(warm.state, changes);
    let structurePlan = !parentEdgesOnly && !contentOnly && warm && warm.validationErrors === 0 && warm.problems.size === 0
      && warm.projector.canProjectContent(entry!.records) ? warm.projector.prepareStructure(warm.state, changes) : undefined;
    if (structurePlan && changes.some(change => change.kind === "node" && change.op === "create" && entry?.graph?.hasAliasesTo(change.key[0]))) structurePlan = undefined;
    let appendPlan: ReturnType<typeof appendedLeaves>;
    // 2. Compare-and-set on the `before` values.
    let applied: ReturnType<typeof applyChanges>;
    try {
      appendPlan = warm && warm.validationErrors === 0 && warm.problems.size === 0
        && warm.projector.canProjectContent(entry!.records) ? appendedLeaves(warm.state, changes) : undefined;
      if (appendPlan && [...appendPlan.parents.values()].some((ids) => ids.some((id) => entry?.graph?.hasAliasesTo(id)))) appendPlan = undefined;
      let input: object = structurePlan?.input ?? (warm ? warm.state : {});
      if (contentOnly || parentEdgesOnly) {
        const nodes: Dict = {};
        for (const change of changes) {
          const id = change.key[0];
          if (hasOwn(warm!.state.nodes, id)) {
            const source = warm!.state.nodes[id] as unknown as Dict, node: Dict = { children: [] };
            for (const key of Object.keys(source)) if (key !== "children") node[key] = source[key];
            nodes[id] = node;
          }
        }
        input = { ...warm!.state, nodes };
      }
      applied = appendPlan ? { ok: true, state: { ...input, nodes: appendPlan.nodes } }
        : parentEdgesOnly || structurePlan ? applyChanges(input, changes, meta.syncHash !== undefined)
        : applyChangesReduced(input, changes, meta.syncHash !== undefined);
    } catch (error) {
      return this.failure("INVALID_COMMAND", current(), (error as Error).message);
    }
    if (!applied.ok) return this.failure("CONFLICT", current(), undefined, clientConflicts(applied.conflicts));
    if (!contentOnly && !parentEdgesOnly) this.fillExtensionDefaults(warm?.state, applied.state, changes);

    // 3. The app's own validation. A state that already had errors may not get more of them.
    // A Command that only edits node content cannot change what validation reports.
    const validationErrors = warm && (parentEdgesOnly || structurePlan !== undefined || appendPlan !== undefined || validationUnaffected(changes))
      ? warm.validationErrors
      : commitValidationErrorCount(applied.state);
    const allowedErrors = warm ? warm.validationErrors : 0;
    if (validationErrors > allowedErrors) {
      return this.failure("INVALID_STATE", current(), "The resulting state does not pass validation.");
    }

    // 4. Records of the map before and after; `rev` of every put is this commit.
    const previous = entry ? entry.records : EMPTY_RECORDS;
    const projector = warm ? warm.projector : new MapProjector(this.workspaceId);
    const row: SnapshotRow = entry ? this.rowOf(entry, applied.state) : { id: mapId, state: applied.state };
    let result: ProjectionResult;
    try {
      // An existing map is projected in place: its record table becomes the new one, and
      // `revert` puts it back when the commit is refused further down.
      result = appendPlan
        ? projector.projectAppendedLeaves(mapId, warm!.state, appendPlan.nodes, appendPlan.parents, entry!.records)
        : structurePlan
        ? projector.projectStructure(mapId, warm!.state, applied.state as AppState, changes, structurePlan, entry!.records)
        : parentEdgesOnly
        ? projector.projectParentEdges(warm!.state, (applied.state as unknown as Dict).nodes as Dict, entry!.records)
        : contentOnly
        ? projector.projectContent(mapId, warm!.state, (applied.state as unknown as Dict).nodes as Dict, entry!.records)
        : projector.project(row, previous, { inPlace: entry !== undefined });
    } catch (error) {
      return this.failure("INVALID_STATE", current(), (error as Error).message);
    }
    if (structurePlan || parentEdgesOnly || appendPlan || contentOnly) projector.indexChanges(result);
    let undoGraph: (() => void) | undefined;
    let postGraph: NeighbourhoodIndex | undefined;
    const refuse = (message: string): CommitFailure => {
      undoGraph?.();
      undoGraph = undefined;
      result.revert?.();
      return this.failure("INVALID_STATE", current(), message);
    };
    const seq = this.currentSeq + 1;
    const ops = this.opsOf(result, seq);

    // 5. Ids this commit introduces are unique in the workspace; no new invariant problem in the map.
    const deleted = new Set<string>();
    for (const op of ops) if (op.op === "delete") deleted.add(op.rk);
    const introduced = new Map<string, string>();
    for (const op of ops) {
      if (op.op !== "put" || result.replaced.has(op.rk)) continue;
      const record = op.record as SnapshotRecord;
      const existing = this.all.get(op.rk);
      if (existing !== undefined && record.kind !== "extensionDef" && (existing as { mapId?: unknown }).mapId !== mapId) {
        return refuse(`The key ${JSON.stringify(op.rk)} is already used outside map ${mapId}.`);
      }
      if (!SHARED_ID_KINDS.has(record.kind)) continue;
      const id = (record as { id: string }).id;
      const owner = this.idIndex.get(id) ?? introduced.get(id);
      if (owner !== undefined && owner !== op.rk && !deleted.has(owner)) {
        return refuse(`The id ${JSON.stringify(id)} is already used by ${JSON.stringify(owner)}.`);
      }
      introduced.set(id, op.rk);
    }
    for (const op of ops) {
      if (op.op !== "put" || op.record === undefined || (op.record as SnapshotRecord).kind !== "extensionDef") continue;
      const record = op.record as ExtensionDefRecord;
      const shape = extensionDefShapeError(record);
      if (shape) return refuse(shape);
      const existing = this.all.get(op.rk);
      if (existing !== undefined && existing.kind === "extensionDef" && !sameExceptRev(existing, record)) {
        result.revert?.();
        return this.failure("CONFLICT", current(), `extensionDef ${recordKeyString(record)} already exists with different content.`);
      }
    }

    const baseline = warm ? warm.problems : new Set<string>();
    let problemKeys = baseline;
    const activityIds = activityNodeIds(ops, (rk) => this.all.get(rk));
    const preScope = new Map<string, string[]>();
    if (entry?.graph) {
      const pre = (rk: string): SnapshotRecord | undefined => this.all.get(rk);
      for (const id of activityIds) {
        if (pre(`node|${id}`)) preScope.set(id, entry.graph.scopeIdsOf(id, pre));
      }
    }
    // Checked on the records the Command touched and their neighbourhood, after every
    // reparent in the Command. The whole-map scan stays available as `checkInvariants`.
    // Skipped when no fact it reads changed: the outcome is then the one already known.
    if (!invariantFactsUnchanged(result.replaced, ops)) {
      const graph = entry?.graph ?? NeighbourhoodIndex.fromRecords(result.records.values());
      if (entry?.graph) undoGraph = graph.apply(ops, (rk) => result.replaced.get(rk));
      const outcome = graph.check((rk) => result.records.get(rk), ops, (rk) => result.replaced.get(rk), this.defsFor(ops));
      const fresh = outcome.problems.filter((problem) => !baseline.has(problemKey(problem)) && !this.satisfiedElsewhere(problem));
      if (fresh.length > 0) {
        const shown = fresh.slice(0, 5).map((problem) => `rule ${problem.rule}: ${problem.kind} ${problem.key}: ${problem.message}`);
        return refuse(`The commit breaks an invariant (${fresh.length}): ${shown.join("; ")}`);
      }
      problemKeys = mergeBaseline(baseline, outcome.problems, outcome.checked);
      postGraph = graph;
    }

    // 6. Locks, grants, operation shape and id reuse, judged on the pre-commit record set.
    const committedAt = this.now();
    const refusal = commitTimeRefusal({
      intent: meta.intent,
      actor: meta.actor,
      committedAt,
      mapId,
      confirm: meta.confirm,
      ops,
      before: (rk) => this.all.get(rk),
      preimage: this.all.values(),
      index: this.guardIndex(mapId),
    });
    if (refusal) return refuse(refusal);
    const reuse = this.reuseRefusal(ops);
    if (reuse) return refuse(reuse);

    // 7. The journal line. Once it is on disk, the commit has happened.
    const line = { seq, commandId: meta.commandId, issuer, committedAt, mapId, intent: meta.intent } as JournalLine;
    if (meta.actor !== undefined) line.actor = meta.actor;
    if (meta.provenance !== undefined) line.provenance = meta.provenance;
    if (meta.reason !== undefined && meta.reason !== "") line.reason = meta.reason;
    // Keep client ids, but write parent assignments with stable keys even for legacy requests.
    // Preserve the original hash separately so retries of either representation are idempotent.
    const sentChanges = translated?.sent ?? changes;
    line.changes = nonEmptyChanges(sentChanges.map((sent, index) => {
      if (sent.kind !== "edge" || !(hasOwn(sent.before ?? {}, "index") || hasOwn(sent.after ?? {}, "index"))) return sent;
      const id = changes[index].key[0];
      const beforeNode = warm?.state.nodes[id], afterNode = result.state.nodes[id];
      const clientParent = (parent: string): string => {
        if (!translated) return parent;
        return (entry ? this.aliasesOf(entry).out.node.get(parent) : undefined)
          ?? translated.aliases.find(alias => alias.recordKind === "node" && alias.newId === parent)?.oldId ?? parent;
      };
      const assignment = (node: AppState["nodes"][string] | undefined, wire: Record<string, unknown> | undefined) =>
        node && typeof node.parentId === "string" ? { parentId: typeof wire?.parentId === "string" ? wire.parentId : clientParent(node.parentId), ord: node.edgeOrder } : undefined;
      return { ...sent,
        ...(sent.op !== "create" ? { before: assignment(beforeNode, sent.before) } : {}),
        ...(sent.op !== "delete" ? { after: assignment(afterNode, sent.after) } : {}),
      };
    }));
    // Repeated legacy requests still compare with the bytes accepted at the boundary.
    line.changesHash = hashChanges(meta.sent ?? sentChanges);
    const aliasRecords = translated?.aliases ?? [];
    const userOps = aliasRecords.length === 0
      ? ops
      : [...ops, ...aliasRecords.map((record): RecordOp => ({ op: "put", rk: recordRk(record), record }))];
    if (entry && userOps.length === 0 && (meta.syncHash !== undefined || line.changes.length === 0)) {
      undoGraph?.();
      result.revert?.();
      return { ok: true, savedAt: this.savedAtOf(entry), seq: this.currentSeq, replayed: false, noOp: true };
    }
    if (meta.syncHash !== undefined) {
      line.syncHash = meta.syncHash;
      if (!entry) line.mapOp = "create";
      line.changesHash = hashChanges(meta.sent ?? line.changes);
    }
    const scopeOf = postGraph ?? entry?.graph;
    const targets = new Set<string>();
    for (const id of activityIds) {
      targets.add(`node|${id}`);
      const scopes = preScope.get(id) ?? scopeOf?.scopeIdsOf(id, (rk) => result.records.get(rk)) ?? [];
      for (const scopeId of scopes) targets.add(`scope|${scopeId}`);
    }
    const decayOps = targets.size === 0 ? [] : this.decayPuts(mapId, targets, committedAt, seq);
    line.ops = decayOps.length === 0 ? userOps : [...userOps, ...decayOps];
    try {
      if (this.capture && meta.syncHash === undefined && meta.actor !== undefined) {
        const command: MapCommand = {
          commandId: meta.commandId, intent: meta.intent, actor: meta.actor,
          provenance: meta.provenance, reason: meta.reason, confirm: meta.confirm || undefined,
          changes: line.changes,
        };
        const payload: SyncCommand = { mapId, command, ...(entry ? {} : { mapOp: "create" }) };
        const state = result.state as AppState;
        const root = state.nodes?.[state.rootId];
        this.capture(payload, issuer, committedAt, this.mapName(entry) || root?.text || "");
        line.changesHash = hashChanges(meta.sent ?? command.changes);
      }
      this.append(line);
    } catch (error) {
      undoGraph?.();
      result.revert?.();
      throw error;
    }

    // 8. Memory.
    const target = entry ?? { id: mapId, records: new Map<string, SnapshotRecord>(), idMaps: new Map<string, SnapshotRecord>() };
    if (!entry) this.maps.set(mapId, target);
    target.records = result.records;
    target.graph = postGraph ?? entry?.graph ?? target.graph;
    target.counts = undefined;
    if (aliasRecords.length > 0) {
      for (const record of aliasRecords) target.idMaps.set(recordRk(record), record);
      target.aliases = undefined;
    }
    target.warm = {
      projector,
      state: result.state,
      validationErrors,
      problems: problemKeys,
    };
    this.noteNamedSnapshots(result.replaced, line.ops);
    return { ok: true, savedAt: committedAt, seq, replayed: false };
  }

  /** Definitions in force for this commit: the workspace set, then this Command's puts and deletes. */
  private defsFor(ops: readonly RecordOp[]): Map<string, ExtensionDefRecord> {
    const defs = new Map<string, ExtensionDefRecord>();
    for (const record of this.extensionDefs.values()) {
      if (record.kind === "extensionDef") defs.set(`${record.name}@${record.version}`, record);
    }
    for (const op of ops) {
      if (op.op === "delete") {
        const prior = this.all.get(op.rk);
        if (prior?.kind === "extensionDef") defs.delete(`${prior.name}@${prior.version}`);
      } else if (op.record?.kind === "extensionDef") {
        defs.set(`${op.record.name}@${op.record.version}`, op.record);
      }
    }
    return defs;
  }

  /** Fills required defaults on extensions this Command newly attaches. The filled values are projected into the ops. */
  private fillExtensionDefaults(before: object | undefined, after: object, changes: readonly RecordChange[]): void {
    const defs = this.defsFor([]);
    const afterDict = after as unknown as Dict;
    const beforeDict = (before ?? {}) as unknown as Dict;
    const listed = afterDict.extensionDefs;
    if (Array.isArray(listed)) {
      for (const item of listed) {
        if (!isPlain(item)) continue;
        const def = item as unknown as ExtensionDefRecord;
        if (typeof def.name !== "string" || !Number.isInteger(def.version) || !Array.isArray(def.fields)) continue;
        defs.set(`${def.name}@${def.version}`, def);
      }
    }
    const nodeIds = new Set<string>();
    const linkIds = new Set<string>();
    for (const change of changes) {
      if (!change || !Array.isArray(change.key)) continue;
      const head = typeof change.key[0] === "string" ? change.key[0] : "";
      const second = typeof change.key[1] === "string" ? change.key[1] : "";
      if (change.kind === "node" || change.kind === "edge") nodeIds.add(head);
      else if (change.kind === "graph-link") linkIds.add(head);
      else if (change.kind === "attribute") {
        if (head === "graph-link") linkIds.add(second);
        else nodeIds.add(second);
      }
    }
    const asAttrs = (value: unknown): { [key: string]: JsonValue } | undefined => (
      isPlain(value) ? value as { [key: string]: JsonValue } : undefined
    );
    const fillTable = (beforeTable: unknown, afterTable: unknown, ids: ReadonlySet<string>, edge: boolean): Dict | undefined => {
      if (!isPlain(afterTable) || ids.size === 0) return undefined;
      const previous = isPlain(beforeTable) ? beforeTable : {};
      let table = afterTable;
      let copied = false;
      for (const id of ids) {
        if (!hasOwn(table, id)) continue;
        const raw = table[id];
        if (!isPlain(raw)) continue;
        const prev = isPlain(previous[id]) ? previous[id] : undefined;
        const attributes = fillRequiredDefaults(prev?.extensions, raw.extensions, asAttrs(raw.attributes), defs);
        const edgeAttributes = edge
          ? fillRequiredDefaults(prev?.edgeExtensions, raw.edgeExtensions, asAttrs(raw.edgeAttributes), defs)
          : undefined;
        if (!attributes && !edgeAttributes) continue;
        if (!copied && table === afterTable && beforeTable === afterTable) {
          table = { ...table };
          copied = true;
        }
        let next = raw;
        if (prev && raw === prev) {
          next = { ...raw };
          table[id] = next;
        }
        if (attributes) next.attributes = attributes;
        if (edgeAttributes) next.edgeAttributes = edgeAttributes;
      }
      return copied ? table : undefined;
    };
    const nodes = fillTable(beforeDict.nodes, afterDict.nodes, nodeIds, true);
    if (nodes) afterDict.nodes = nodes;
    const links = fillTable(beforeDict.links, afterDict.links, linkIds, false);
    if (links) afterDict.links = links;
  }

  private decayPuts(mapId: string, targets: ReadonlySet<string>, committedAt: string, seq: number): RecordOp[] {
    const ops: RecordOp[] = [];
    for (const target of [...targets].sort(compareStrings)) {
      const rk = `decay|${target}`;
      const previous = this.all.get(rk);
      const prior = previous?.kind === "decay" ? previous : undefined;
      const advanced = advanceDecay(prior?.v, prior?.t, committedAt, 1);
      const record: DecayRecord = { kind: "decay", target, mapId, v: advanced.v, t: advanced.t, rev: seq };
      ops.push({ op: "put", rk, record });
    }
    return ops;
  }

  private rememberDecay(record: DecayRecord): void {
    let set = this.decayByMap.get(record.mapId);
    if (!set) {
      set = new Set();
      this.decayByMap.set(record.mapId, set);
    }
    set.add(recordRk(record));
  }

  private forgetDecay(record: DecayRecord): void {
    const set = this.decayByMap.get(record.mapId);
    if (!set) return;
    set.delete(recordRk(record));
    if (set.size === 0) this.decayByMap.delete(record.mapId);
  }

  /** An alias may point into another map of the workspace; the map's own records cannot show that. */
  private satisfiedElsewhere(problem: InvariantProblem): boolean {
    if (problem.rule !== 3 || problem.kind !== "node") return false;
    const match = /^alias target (.*) does not exist$/.exec(problem.message);
    if (!match) return false;
    const target = this.all.get(`node|${match[1]}`);
    return target !== undefined && target.kind === "node" && target.nodeType !== "alias" && target.alias === undefined;
  }

  /** Appends the journal line (the commit point), then updates memory and hands the commit to the engine. */
  private append(line: JournalLine, confirmed = false): void {
    if (this.closed || this.durability === undefined) throw new Error("The record store is closed.");
    if (!confirmed) {
      const touched = touchedOf(line.ops, (rk) => this.all.get(rk));
      if (touched.length > 0) line.touched = touched;
    }
    this.journalLines += 1;
    const changed = new Map<string, Set<string>>();
    const add = (mapId: string, rk: string): void => {
      let keys = changed.get(mapId);
      if (!keys) changed.set(mapId, keys = new Set());
      keys.add(rk);
    };
    for (const op of line.ops) {
      for (const record of [this.all.get(op.rk), op.op === "put" ? op.record : undefined]) {
        if (!record) continue;
        if (record.kind === "extensionDef") {
          // A shared definition changes every map that exposes it.
          for (const mapId of this.maps.keys()) add(mapId, op.rk);
        } else {
          const mapId = record.kind === "map" ? record.id : (record as { mapId?: string }).mapId;
          if (typeof mapId === "string") add(mapId, op.rk);
        }
      }
    }
    this.applyLine(line);
    this.durability.enqueue(this.durableCommit(line));
    for (const [mapId, keys] of changed) this.mapChanges.append(mapId, line.seq, line.committedAt, keys);
    this.committed?.(line);
  }

  /** What one commit writes to Neo4j, in one transaction: the records, the journal line and the bookkeeping. */
  private durableCommit(line: JournalLine): import("./neo4j_durability").CommitUnit {
    const commands: Array<[string, StoredCommand]> = [];
    if (line.commandId !== undefined) {
      const entry = this.commands.get(line.commandId);
      if (entry !== undefined) commands.push([line.commandId, this.storedCommand(entry)]);
    }
    const retired: Array<[string, string | null]> = [];
    for (const op of line.ops) {
      if (!op.rk.startsWith("node|")) continue;
      const id = op.rk.slice("node|".length);
      retired.push([id, this.retired.get(id) ?? null]);
    }
    const mapIds = new Set<string>();
    if (line.mapId) mapIds.add(line.mapId);
    if (line.newMapId) mapIds.add(line.newMapId);
    return {
      kind: "commit",
      seq: line.seq,
      workspaceId: this.workspaceId,
      line,
      ops: this.engineCommit(line).ops,
      commands,
      retired,
      mapSeq: [...mapIds].map((mapId) => [mapId, this.mapSeq.get(mapId) ?? null]),
    };
  }

  private engineCommit(line: JournalLine): CommitOps {
    const commit: CommitRecord = { kind: "commit", seq: line.seq, committedAt: line.committedAt, issuer: line.issuer };
    const header: SnapshotHeader = { kind: "snapshot", format: this.snapshotFormat, ...this.syncIdentity(), seq: line.seq };
    return {
      seq: line.seq,
      ops: [
        ...line.ops,
        { op: "put", rk: recordRk(commit), record: commit },
        { op: "put", rk: recordRk(header), record: header },
      ],
    };
  }

  /** Bookkeeping a journal line carries besides its record operations. */
  private indexLine(line: JournalLine, touchedMaps?: Set<string>): void {
    if (line.intent === LOCAL_REBASE_INTENT) return;
    if (line.mapOp === "delete") {
      this.mapSeq.delete(line.mapId);
    } else if (line.mapOp === "rename" && line.newMapId !== undefined) {
      this.mapSeq.delete(line.mapId);
      this.mapSeq.set(line.newMapId, line.seq);
    } else if (line.mapOp !== "columns" && !(line.mapOp === undefined && line.commandId === undefined && line.intent === "set-map-columns")) {
      // A commit that only sets row columns is not a change of the map's content. (The second
      // test reads journals written before such lines were marked.)
      this.mapSeq.set(line.mapId, line.seq);
    }
    if (line.commandId !== undefined) {
      const mapIds = touchedMaps ?? new Set<string>();
      mapIds.add(line.mapId);
      if (line.newMapId) mapIds.add(line.newMapId);
      for (const op of line.ops) if (op.op === "put") {
        const record = op.record as SnapshotRecord;
        if (record.kind === "map") mapIds.add(record.id);
        else if ("mapId" in record && typeof record.mapId === "string") mapIds.add(record.mapId);
      }
      this.indexCommand(line.commandId, {
        seq: line.seq,
        hash: line.changesHash ?? (line.mapOp && line.mapOp !== "create" ? line.syncHash : undefined) ?? hashChanges(line.changes),
        canonicalHash: line.changesHash && line.changesHash !== hashChanges(line.changes) ? hashChanges(line.changes) : undefined,
        syncHash: line.syncHash, mapIds,
      });
    }
  }

  /** Lazy pre-commit index; successful appends maintain it, refused commits leave it alone. */
  private guardIndex(mapId: string): CommitGuardIndex {
    let index = this.guardIndexes.get(mapId);
    if (!index) {
      index = new CommitGuardIndex(this.maps.get(mapId)?.records.values() ?? [], mapId);
      this.guardIndexes.set(mapId, index);
    }
    return index;
  }

  /** Applies a committed journal line to the record set in memory. */
  private applyLine(line: JournalLine): void {
    const touchedMaps = new Set<string>();
    for (const op of line.ops) {
      const before = this.all.get(op.rk);
      const after = op.op === "put" ? op.record as SnapshotRecord : undefined;
      const mapIds = new Set<string>();
      for (const record of [before, after]) {
        if (record?.kind === "map") touchedMaps.add(record.id);
        if (record && "mapId" in record && typeof record.mapId === "string") {
          mapIds.add(record.mapId);
          touchedMaps.add(record.mapId);
        }
      }
      for (const id of mapIds) this.guardIndexes.get(id)?.update(before, after);
      if (before !== undefined && SHARED_ID_KINDS.has(before.kind)) {
        const id = (before as { id: string }).id;
        if (this.idIndex.get(id) === op.rk) this.idIndex.delete(id);
      }
      const touchedDef = before?.kind === "extensionDef" || (op.op === "put" && (op.record as SnapshotRecord | undefined)?.kind === "extensionDef");
      if (before?.kind === "decay") this.forgetDecay(before);
      if (op.op === "delete") {
        if (before?.kind === "node") this.retired.set(before.id, this.retiredBody(before));
        this.all.delete(op.rk);
        if (touchedDef) {
          this.extensionDefs.delete(op.rk);
          this.broadcastExtensionDef(op.rk, undefined);
        }
        continue;
      }
      const record = op.record as SnapshotRecord;
      if (record.kind === "node" && this.retired.get(record.id) === this.retiredBody(record)) this.retired.delete(record.id);
      this.all.set(op.rk, record);
      if (SHARED_ID_KINDS.has(record.kind)) this.idIndex.set((record as { id: string }).id, op.rk);
      if (record.kind === "decay") this.rememberDecay(record);
      if (touchedDef) {
        this.extensionDefs.set(op.rk, record);
        this.broadcastExtensionDef(op.rk, record);
      }
    }
    const commit: CommitRecord = { kind: "commit", seq: line.seq, committedAt: line.committedAt, issuer: line.issuer };
    this.all.set(recordRk(commit), commit);
    this.currentSeq = line.seq;
    this.indexLine(line, touchedMaps);
  }

  /** Copies one extensionDef into every map and drops cached state, so a later save does not write the old definition back. */
  private broadcastExtensionDef(rk: string, record: SnapshotRecord | undefined): void {
    for (const entry of this.maps.values()) {
      if (record === undefined) {
        if (!entry.records.delete(rk)) continue;
      } else {
        entry.records.set(rk, record);
      }
      entry.warm = undefined;
    }
  }

  /** Clones the map, applies one planner, and commits the difference as one Command. */
  private commitPlanned(
    mapId: string,
    issuer: string,
    intent: string,
    mutate: (state: AppState) => { ok: true } | { ok: false; code: "INVALID_COMMAND" | "CONFLICT" | "NOT_FOUND"; message: string },
    options: { commandId: string; reason?: string; confirm?: boolean },
  ): CommitResult {
    this.assertOpen();
    const entry = this.maps.get(mapId);
    if (!entry) return this.failure("NOT_FOUND", null);
    const warm = this.warm(entry);
    const next = jsonClone(warm.state);
    const planned = mutate(next);
    if (!planned.ok) return this.failure(planned.code, this.currentOf(entry), planned.message);
    const changes = diffState(warm.state, next);
    if (changes.length === 0) {
      return { ok: true, savedAt: this.savedAtOf(entry), seq: this.mapSeq.get(mapId) ?? this.currentSeq, replayed: false };
    }
    return this.commitMapCommand(mapId, {
      commandId: options.commandId,
      intent,
      actor: { kind: "system", id: issuer },
      changes,
      reason: options.reason,
      confirm: options.confirm,
    }, issuer);
  }

  /** State key of the scope that contains `nodeId`: a folder, or the map root. */
  private planeKeyOf(state: AppState, nodeId: string | undefined): string | undefined {
    if (!nodeId) return undefined;
    let at: string | null | undefined = nodeId;
    const seen = new Set<string>();
    while (typeof at === "string" && !seen.has(at)) {
      seen.add(at);
      const node: TreeNode | undefined = state.nodes[at];
      if (!node) return undefined;
      if (node.nodeType === "folder" || node.parentId === null) return `scope:${at}`;
      at = node.parentId;
    }
    return undefined;
  }

  /** Resolves a scope, walking from a node up to the folder or map root when the token is not itself a scope. */
  private scopeFor(entry: MapEntry, token: string): ScopeRecord | undefined {
    const found = this.scopeByToken(entry, token);
    if (found) return found;
    const raw = token.startsWith("scope:") ? token.slice("scope:".length) : token;
    const plane = this.planeKeyOf(this.warm(entry).state, raw);
    return plane ? this.scopeByToken(entry, plane) : undefined;
  }

  /** A scope record by id, state key, or root node. An observe scope does not win a root-node lookup. */
  private scopeByToken(entry: MapEntry, token: string): ScopeRecord | undefined {
    const raw = token.startsWith("scope:") ? token.slice("scope:".length) : token;
    const exact = entry.records.get(`scope|${raw}`);
    if (exact?.kind === "scope") return exact;
    let byRoot: ScopeRecord | undefined;
    for (const record of entry.records.values()) {
      if (record.kind !== "scope") continue;
      if (record.id === raw) return record;
      if (record.projection?.mode === "observe") continue;
      if (record.rootNodeId === raw && !byRoot) byRoot = record;
    }
    return byRoot;
  }

  private scopeRootOf(entry: MapEntry, scopeId: string): string | undefined {
    const record = entry.records.get(`scope|${scopeId}`);
    return record?.kind === "scope" ? record.rootNodeId : undefined;
  }

  private readsOf(name: string): "source-to-target" | "target-to-source" {
    for (const record of this.all.values()) {
      if (record.kind === "relationTypeDef" && record.name === name) return record.reads;
    }
    return "source-to-target";
  }

  /** Map state as of `seq`. The current seq is memory; an older seq is snapshot plus journal. */
  private stateAt(mapId: string, seq: number): AppState | null {
    const kept = seq === this.currentSeq ? undefined : this.bases.get(`${mapId}@${seq}`);
    const records = kept ?? this.recordsAt(seq);
    if (!records) return null;
    return fromSnapshot(records).rows.find((row) => row.id === mapId)?.state ?? null;
  }

  private recordsAt(target: number): SnapshotRecord[] | null {
    if (target === this.currentSeq) return [...this.all.values()];
    // An older state is not kept in Neo4j yet (open item in the design): a write-back on an older base is refused.
    return null;
  }

  /** A namedSnapshot's state is not kept apart in Neo4j yet (open item in the design). */
  private noteNamedSnapshots(_replaced: ReadonlyMap<string, SnapshotRecord>, _ops: readonly RecordOp[]): void {}

}

const DERIVED_SCOPE_FIELDS = ["label", "rootNodeIds", "relationIds"];

/**
 * Makes the derived scope fields of a change agree with the current state, so that
 * compare-and-set never refuses a command because of them.
 */
function withCurrentDerivedScopeFields(changes: RecordChange[], state: object): RecordChange[] {
  const scopes = ((state as { scopes?: Record<string, Record<string, unknown>> }).scopes ?? {}) as Record<
    string,
    Record<string, unknown> | undefined
  >;
  return changes.map((change) => {
    if (change.kind !== "scope-setting" || change.op === "create" || !change.before) return change;
    const current = scopes[change.key[0] ?? ""];
    if (!current) return change;
    const before: Record<string, unknown> = { ...change.before };
    for (const field of DERIVED_SCOPE_FIELDS) {
      if (field in current) before[field] = current[field];
      else delete before[field];
    }
    return { ...change, before };
  });
}
