// Record store of one workspace.
//
// Source of truth: a directory with `snapshot.jsonl` (portable snapshot) and `journal.jsonl`
// (append-only, one line per commit). One writer process per workspace keeps every record in
// memory and serves reads from there. A commit is durable when its journal line is appended and
// fsync-ed; memory is updated after that, and the same record operations are then applied to
// Neo4j asynchronously. Neo4j is derived and can always be rebuilt from snapshot + journal.
//
// Besides the two files, `compact()` writes `commit-index.json`: which commit last touched each
// map, the ids of the commands already committed (for idempotent retries) and the checksum of the
// snapshot it wrote. The snapshot stays a plain portable snapshot. Compaction moves the replaced
// journal and snapshot into `archive/` instead of discarding them (journal_archive.ts).
//
// Specs: .kiro/specs/rapid-persistence-redesign/snapshot-format.md and post-migration-spec.md 9-12.

import { createHash, randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { applyChanges, diffState, type FieldConflict, type MapCommand, type RecordChange } from "../../shared/map_changes";
import { advanceDecay, readDecay } from "../../shared/record_model/decay";
import { extensionDefShapeError, fillRequiredDefaults } from "../../shared/record_model/extensions";
import { fromSnapshot } from "../../shared/record_model/from_snapshot";
import { checkInvariants, type InvariantProblem } from "../../shared/record_model/invariants";
import { parseSnapshot, recordKeyString, serializeSnapshot, sortRecords } from "../../shared/record_model/jsonl";
import { NeighbourhoodIndex, subjectOfProblemKey } from "../../shared/record_model/neighbourhood";
import { MapProjector, recordRk, sameJson, type ProjectionResult } from "../../shared/record_model/steady";
import { takeLegacyCertainty } from "../../shared/record_model/certainty";
import { SNAPSHOT_FORMAT, compareStrings, type CommitRecord, type DecayRecord, type ExtensionDefRecord, type IdMapRecord, type JsonValue, type MapRecord, type ScopeRecord, type SnapshotHeader, type SnapshotRecord, type SnapshotRow } from "../../shared/record_model/types";
import type { AppState, TreeNode } from "../../shared/types";
import { applyChangesReduced } from "./apply_reduced";
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
import {
  ARCHIVE_RETENTION_MS,
  archiveFile,
  archiveDir,
  fsyncDir,
  journalArchiveName,
  pruneArchive,
  readArchive,
  sha256,
  snapshotArchiveName,
  touchedOf,
  writeArchiveIndex,
  type ArchiveEntry,
  type PruneResult,
  type TouchedRecord,
} from "./journal_archive";
import { commitTimeRefusal } from "./operations";
import { normalizeProvenance, type Provenance } from "./provenance";
import { commitValidationErrorCount, validationUnaffected } from "./validate";
import {
  EngineQueue,
  Neo4jApplier,
  assertNeo4jUsable,
  type EngineApplier,
  type EngineCommit,
  type EngineRetryOptions,
  type Neo4jOptions,
  type RecordOp,
} from "./engine";

import type { SyncCommand, SyncIdentity, SyncMapOperation } from "./sync_types";

export const SNAPSHOT_FILE = "snapshot.jsonl";
export const JOURNAL_FILE = "journal.jsonl";
export const COMMIT_INDEX_FILE = "commit-index.json";
/** Command ids kept by `compact()` for idempotent retries: the most recent ones, up to this many. */
export const COMMAND_INDEX_RETAIN = 100000;
/** Journal lines after the snapshot that make the store compact (after a commit, and on open). */
export const DEFAULT_COMPACT_AFTER_LINES = 50000;
/** Commits the storage engine may be behind before commits are refused with ENGINE_BEHIND. */
export const DEFAULT_ENGINE_BACKLOG_LIMIT = 10000;

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
  neo4j?: Neo4jOptions;
  /** Replaces the Neo4j applier (tests). Ignored when `neo4j` is given. */
  applier?: EngineApplier;
  /** Build the state of every map while opening (default). With false, a map is built on first use. */
  warm?: boolean;
  /**
   * Commits the storage engine may be behind before commits are refused with ENGINE_BEHIND.
   * Default: M3E_ENGINE_BACKLOG_LIMIT, or 10,000.
   */
  engineBacklogLimit?: number;
  /** Waits between the engine's retries after a failure: first and longest, in milliseconds. */
  engineRetry?: EngineRetryOptions;
  /**
   * Journal lines after the snapshot at which the store compacts: after the commit that reaches
   * it, and on open when the replay was that long. 0 turns automatic compaction off.
   * Default: M3E_COMPACT_AFTER_LINES, or 50,000.
   */
  compactAfterLines?: number;
}

/** One line of `journal.jsonl`. */
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
}

type Dict = Record<string, unknown>;

const ACTORS = new Set(["human", "ai-agent", "system"]);
const COLUMN_FIELDS = ["tags", "archived", "pinned", "source"] as const;
const SHARED_ID_KINDS = new Set(["node", "connection", "annotation"]);
const EMPTY_RECORDS: ReadonlyMap<string, SnapshotRecord> = new Map();

export function assertNotLiveM3e(dir: string): void {
  if (process.env.M3E_FORBID_LIVE_DATA !== "1") return;
  const live = path.join(os.homedir(), "Library", "Application Support", "M3E");
  const inside = (candidate: string): boolean => candidate === live || candidate.startsWith(live + path.sep);
  const refuse = (): never => {
    throw new Error("Refusing to open a record store inside the live M3E data directory.");
  };
  // By name first, before anything touches the file system.
  if (inside(path.resolve(dir))) refuse();
  let real: string | undefined;
  try {
    real = fs.realpathSync(dir);
  } catch {
    // The directory does not exist yet.
  }
  if (real !== undefined && inside(real)) refuse();
}

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

function commandKey(mapId: string, commandId: string): string {
  return `${mapId}\u0000${commandId}`;
}

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

interface JournalRead {
  lines: JournalLine[];
  /** Bytes of the file that hold complete, readable lines. */
  goodLength: number;
  size: number;
  /** The last line was readable but had no line end. */
  needsNewline: boolean;
}

function readJournal(journalPath: string): JournalRead {
  const buffer = fs.readFileSync(journalPath);
  const lines: JournalLine[] = [];
  let goodLength = 0;
  let needsNewline = false;
  let start = 0;
  const parse = (text: string): JournalLine | null => {
    try {
      const value = JSON.parse(text) as JournalLine;
      if (typeof value !== "object" || value === null || !Number.isInteger(value.seq) || !Array.isArray(value.ops)) return null;
      return value;
    } catch {
      return null;
    }
  };
  while (start < buffer.length) {
    const end = buffer.indexOf(0x0a, start);
    const complete = end !== -1;
    const text = buffer.toString("utf8", start, complete ? end : buffer.length);
    const next = complete ? end + 1 : buffer.length;
    if (text.trim() === "") {
      if (complete) goodLength = next;
      start = next;
      continue;
    }
    const line = parse(text);
    if (line === null) {
      // Only the last line may be unreadable: a write that did not finish.
      if (buffer.toString("utf8", next).trim() !== "") {
        throw new Error(`The journal is damaged before its last line (byte ${start}): ${journalPath}`);
      }
      break;
    }
    lines.push(line);
    goodLength = next;
    needsNewline = !complete;
    start = next;
  }
  return { lines, goodLength, size: buffer.length, needsNewline };
}

export class RecordWorkspaceStore {
  readonly workspaceId: string;
  private readonly historyId: string;
  private readonly epoch: number;

  private capture: ((command: SyncCommand, issuer: string, at: string, mapName: string) => void) | undefined;
  private committed: ((line: JournalLine) => void) | undefined;
  private readonly dir: string;
  private readonly now: () => string;
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
  private currentSeq = 0;
  /** Commit the snapshot file holds; the journal holds everything after it. */
  private snapshotSeq = 0;
  private journalFd: number | undefined;
  private journalSize = 0;
  /** Lines of the journal file after the snapshot: what an open would replay. */
  private journalLines = 0;
  /** Checksum of the snapshot file, recorded by the compaction that wrote it. */
  private snapshotSum: { seq: number; sha256: string } | undefined;
  /** Snapshot format of the snapshot file; archive names carry it. */
  private snapshotFormat: 1 | 2 | 3 = 1;
  private readonly compactAfterLines: number;
  /** Problems of the last compaction or archive retention pass that stopped; empty when it ran. */
  private maintenanceProblems: string[] = [];
  private engine: EngineQueue | undefined;
  private readonly engineBacklogLimit: number;
  private readonly engineRetry: EngineRetryOptions | undefined;
  private closed = false;

  /** Writes `snapshot.jsonl` and an empty `journal.jsonl`. Refuses a directory that is not empty. */
  static create(dir: string, records: SnapshotRecord[], index?: string): void {
    assertNotLiveM3e(dir);
    if (fs.existsSync(dir)) {
      if (!fs.statSync(dir).isDirectory()) throw new Error(`Not a directory: ${dir}`);
      if (fs.readdirSync(dir).length > 0) throw new Error(`Refusing to create a record store in a directory that is not empty: ${dir}`);
    } else {
      fs.mkdirSync(dir, { recursive: true });
    }
    const seen = new Set<string>();
    for (const record of records) {
      const rk = recordRk(record);
      if (seen.has(rk)) throw new Error(`Two records share the key ${JSON.stringify(rk)}.`);
      seen.add(rk);
    }
    const content = serializeSnapshot(records);
    if (index !== undefined) {
      const metadata = JSON.parse(index) as { snapshot?: { seq: number; sha256: string } };
      const header = records.find((record) => record.kind === "snapshot");
      if (metadata.snapshot?.seq !== header?.seq || metadata.snapshot?.sha256 !== sha256(content)) {
        throw new Error("The commit index does not match the snapshot.");
      }
    }
    writeFileDurably(path.join(dir, SNAPSHOT_FILE), content);
    writeFileDurably(path.join(dir, JOURNAL_FILE), "");
    if (index !== undefined) writeFileDurably(path.join(dir, COMMIT_INDEX_FILE), index);
  }

  /** Number of journal lines after the snapshot. */
  journalLength(): number {
    return this.journalLines;
  }

  /** Problems that stopped the last compaction or archive retention pass; empty when it ran. */
  maintenanceStatus(): { problems: string[] } {
    return { problems: [...this.maintenanceProblems] };
  }

  static open(dir: string, options: OpenOptions = {}): RecordWorkspaceStore {
    assertNotLiveM3e(dir);
    const store = new RecordWorkspaceStore(dir, options);
    try {
      store.maintain();
      if (options.neo4j) {
        assertNeo4jUsable(options.neo4j, { workspaceId: store.workspaceId, seq: store.currentSeq });
        store.attachEngine(new Neo4jApplier(options.neo4j));
      } else if (options.applier) {
        store.attachEngine(options.applier);
      }
    } catch (error) {
      store.closeFiles();
      throw error;
    }
    return store;
  }

  private constructor(dir: string, options: OpenOptions) {
    this.dir = dir;
    this.now = options.now ?? (() => new Date().toISOString());
    const envLimit = Number(process.env.M3E_ENGINE_BACKLOG_LIMIT);
    const limit = options.engineBacklogLimit ?? (Number.isFinite(envLimit) && envLimit > 0 ? envLimit : DEFAULT_ENGINE_BACKLOG_LIMIT);
    this.engineBacklogLimit = Math.max(1, Math.floor(limit));
    this.engineRetry = options.engineRetry;
    const envCompact = Number(process.env.M3E_COMPACT_AFTER_LINES);
    const compactAfter = options.compactAfterLines ?? (Number.isFinite(envCompact) && envCompact >= 0 ? envCompact : DEFAULT_COMPACT_AFTER_LINES);
    this.compactAfterLines = Math.max(0, Math.floor(compactAfter));

    const snapshotPath = path.join(dir, SNAPSHOT_FILE);
    const journalPath = path.join(dir, JOURNAL_FILE);
    if (!fs.existsSync(snapshotPath)) throw new Error(`No record store in ${dir} (${SNAPSHOT_FILE} is missing).`);
    const snapshotText = fs.readFileSync(snapshotPath, "utf8");
    const records = parseSnapshot(snapshotText);
    const header = records[0] as SnapshotHeader;
    this.workspaceId = header.workspaceId;
    this.historyId = header.historyId ?? randomUUID();
    this.epoch = header.epoch ?? 1;
    if (header.format !== 1 && header.format !== 2 && header.format !== 3) {
      throw new Error(`Unsupported snapshot format: ${String(header.format)}`);
    }
    this.snapshotFormat = header.format;
    let seq = Number.isInteger(header.seq) ? header.seq : 0;
    for (let i = 1; i < records.length; i += 1) {
      const record = records[i];
      if (record.kind === "snapshot") throw new Error("The snapshot has more than one header record.");
      const rk = recordRk(record);
      if (this.all.has(rk)) throw new Error(`Two records of the snapshot share the key ${JSON.stringify(rk)}.`);
      this.all.set(rk, record);
      if (record.kind === "commit" && record.seq > seq) seq = record.seq;
    }
    this.currentSeq = seq;
    this.snapshotSeq = seq;

    const indexPath = path.join(dir, COMMIT_INDEX_FILE);
    if (fs.existsSync(indexPath)) {
      const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
        mapSeq?: Record<string, number>;
        commands?: Array<[string, string, number, string]>;
        snapshot?: { seq: number; sha256: string };
        retired?: Record<string, string>;
      };
      this.snapshotSum = index.snapshot;
      for (const [id, body] of Object.entries(index.retired ?? {})) {
        if (typeof body === "string") this.retired.set(id, body);
      }
      for (const [mapId, value] of Object.entries(index.mapSeq ?? {})) this.mapSeq.set(mapId, value);
      for (const [mapId, commandId, commandSeq, hash] of index.commands ?? []) {
        this.commands.set(commandKey(mapId, commandId), { seq: commandSeq, hash });
      }
    }

    if (!fs.existsSync(journalPath)) fs.writeFileSync(journalPath, "");
    const journal = readJournal(journalPath);
    let lastSeq: number | undefined;
    for (const line of journal.lines) {
      if (lastSeq !== undefined && line.seq !== lastSeq + 1) {
        throw new Error(`The journal skips from commit ${lastSeq} to ${line.seq}: ${journalPath}`);
      }
      lastSeq = line.seq;
      if (line.seq <= this.snapshotSeq) {
        // Already in the snapshot (a compaction that did not get to empty the journal).
        this.indexLine(line);
        continue;
      }
      if (line.seq !== this.currentSeq + 1) {
        throw new Error(`The journal starts at commit ${line.seq} but the snapshot ends at ${this.currentSeq}: ${journalPath}`);
      }
      this.applyLine(line);
      this.journalLines += 1;
    }
    if (journal.goodLength < journal.size) fs.truncateSync(journalPath, journal.goodLength);
    this.journalFd = fs.openSync(journalPath, "a");
    this.journalSize = journal.goodLength;
    if (journal.needsNewline) {
      fs.writeSync(this.journalFd, "\n");
      fs.fsyncSync(this.journalFd);
      this.journalSize += 1;
    }
    if (this.snapshotFormat !== SNAPSHOT_FORMAT) this.migrateToCurrentFormat();
    else if (header.historyId === undefined || header.epoch === undefined) {
      header.historyId = this.historyId;
      header.epoch = this.epoch;
      const content = serializeSnapshot(records);
      // Keep the checksum used by archive retention in step with the upgraded header.
      if (this.snapshotSum !== undefined && this.snapshotSum.sha256 === sha256(snapshotText)) {
        const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
        this.snapshotSum = { seq: this.snapshotSeq, sha256: sha256(content) };
        writeFileDurably(indexPath, JSON.stringify({ ...index, snapshot: this.snapshotSum }) + "\n");
      }
      writeFileDurably(snapshotPath, content);
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
    if (options.warm !== false) {
      for (const entry of this.maps.values()) this.warm(entry);
    }
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
    return this.commitIndexText({ seq: this.currentSeq, sha256: sha256(serializeSnapshot(records)) });
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

  /** Journal lines after `seq`, from the journal and the archive; null when they no longer reach back that far. */
  journalLinesAfter(seq: number): JournalLine[] | null {
    this.assertOpen();
    return this.linesAfter(seq);
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
    for (const item of forget) {
      this.commands.delete(commandKey(item.mapId, item.commandId));
      this.commands.delete(commandKey("", item.commandId));
      if (item.newMapId !== undefined) this.commands.delete(commandKey(item.newMapId, item.commandId));
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

  /** The journal line of a Command committed under this id, from the journal or the archive; null when neither holds it. */
  committedCommand(mapId: string, commandId: string): JournalLine | null {
    const known = this.commands.get(commandKey(mapId, commandId));
    if (!known) return null;
    const inJournal = readJournal(path.join(this.dir, JOURNAL_FILE)).lines.find((line) => line.seq === known.seq);
    if (inJournal) return inJournal;
    for (const entry of readArchive(this.dir, this.now())) {
      if (entry.kind !== "journal" || entry.fromSeq > known.seq || entry.toSeq < known.seq) continue;
      const line = readJournal(path.join(archiveDir(this.dir), entry.file)).lines.find((item) => item.seq === known.seq);
      if (line) return line;
    }
    return null;
  }

  /**
   * `appliedSeq`: the last commit the storage engine holds (the journal position when there is no
   * engine). `error`: why the engine is behind, while it is; the applier keeps retrying.
   */
  engineStatus(): { appliedSeq: number; error?: string } {
    if (!this.engine) return { appliedSeq: this.currentSeq };
    const status: { appliedSeq: number; error?: string } = { appliedSeq: this.engine.appliedSeq };
    if (this.engine.error !== undefined) status.error = this.engine.error;
    return status;
  }

  /**
   * Copies `snapshot.jsonl`, `journal.jsonl` and, when it exists, `commit-index.json` into
   * `targetDir` (created; must be empty or absent). Nothing is compacted. The copy is taken in one
   * synchronous step: commits and compaction are synchronous too, so no commit can fall between
   * the files, and the journal copy ends at the last complete commit line. The directory can be
   * opened with `RecordWorkspaceStore.open`. Returns the names of the files copied.
   */
  backupTo(targetDir: string): string[] {
    this.assertOpen();
    assertNotLiveM3e(targetDir);
    if (path.resolve(targetDir) === path.resolve(this.dir)) throw new Error("The backup directory is the store directory itself.");
    if (fs.existsSync(targetDir)) {
      if (!fs.statSync(targetDir).isDirectory()) throw new Error(`Not a directory: ${targetDir}`);
      if (fs.readdirSync(targetDir).length > 0) throw new Error(`Refusing to back up into a directory that is not empty: ${targetDir}`);
    } else {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const copied: string[] = [];
    const copy = (name: string, length?: number): void => {
      const source = path.join(this.dir, name);
      if (!fs.existsSync(source)) return;
      let content = fs.readFileSync(source);
      if (length !== undefined && content.length > length) content = content.subarray(0, length);
      const fd = fs.openSync(path.join(targetDir, name), "wx");
      try {
        fs.writeSync(fd, content);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      copied.push(name);
    };
    // The index may be ahead of the snapshot but never behind it, so it goes first here as well.
    copy(COMMIT_INDEX_FILE);
    copy(SNAPSHOT_FILE);
    copy(JOURNAL_FILE, this.journalSize);
    return copied;
  }

  // ---------------------------------------------------------------- commits

  commitMapCommand(mapId: string, command: MapCommand, issuer: string, expectedRevision?: string, sync?: { hash: string; create: boolean }): CommitResult {
    this.assertOpen();
    if (this.engineTooFarBehind()) return this.engineBehind();
    if (!command || typeof command !== "object" || typeof command.commandId !== "string") {
      return this.failure("INVALID_COMMAND", null, "Command must be an object with a commandId.");
    }
    const entry = this.maps.get(mapId);
    // 1. A command id seen before: the first result again, or a refusal when the content differs.
    const known = this.commands.get(commandKey(mapId, command.commandId));
    if (known) {
      if (known.hash === hashChanges(command.changes)) {
        return { ok: true, savedAt: this.committedAtOf(known.seq), seq: known.seq, replayed: true };
      }
      return this.failure(
        "SAME_ID_DIFFERENT_CONTENT",
        entry ? this.currentOf(entry) : null,
        `Command ${command.commandId} was already committed with different changes.`,
      );
    }
    if (!entry && !sync?.create) return this.failure("NOT_FOUND", null);
    if (entry && sync?.create) return this.failure("CONFLICT", this.currentOf(entry), "The map already exists.");
    const shape = commandShape(command);
    if (shape) return this.failure("INVALID_COMMAND", entry ? this.currentOf(entry) : null, shape);
    if (expectedRevision !== undefined && expectedRevision !== this.revisionOf(mapId)) {
      return this.failure("CONFLICT", entry ? this.currentOf(entry) : null, "The map changed since the revision the command was built on.");
    }
    let changes: RecordChange[];
    try {
      changes = jsonClone(command.changes);
    } catch {
      return this.failure("INVALID_COMMAND", entry ? this.currentOf(entry) : null, "changes cannot be written as JSON.");
    }
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
    if (this.engineTooFarBehind()) return this.engineBehind();
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
    this.assertEngineNotTooFarBehind();
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
    this.assertEngineNotTooFarBehind();
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
    this.assertEngineNotTooFarBehind();
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
    const known = this.commands.get(commandKey("", command.commandId));
    if (known === undefined) return undefined;
    if (known.hash !== syncHash(payload)) {
      return this.failure("SAME_ID_DIFFERENT_CONTENT", null, "The Command ID was already used with different content.");
    }
    return { ok: true, seq: known.seq, savedAt: this.committedAtOf(known.seq), replayed: true };
  }

  /** Validates a pending Command against the current state, for push and working-store replay. */
  commitSyncCommand(payload: SyncCommand, issuer: string): CommitResult {
    this.assertOpen();
    const prior = this.syncReceipt(payload);
    if (prior !== undefined) return prior;
    const { command, mapId, mapOp } = payload;
    const shape = commandShape(command);
    if (shape) return this.failure("INVALID_COMMAND", null, shape);
    if (command.changes.some((change) => !validSyncChange(change))) {
      return this.failure("INVALID_COMMAND", null, "The Command has an unsupported record change.");
    }
    if (this.engineTooFarBehind()) return this.engineBehind();
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
    return this.commitPlanned(mapId, issuer, "project", (state) => planProject(state, {
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
    }), { commandId });
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
    return this.commitPlanned(mapId, issuer, "write-back", (state) => planWriteBack(state, base, {
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
    }), { commandId, reason: input.reason });
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

  /**
   * Writes a new snapshot from memory and starts an empty journal. Nothing is discarded: the
   * journal file and the snapshot it replaces go into `archive/` first (journal_archive.ts). The
   * last commit of each map, the command ids and the new snapshot's checksum go to
   * `commit-index.json`.
   *
   * Order, for a crash in between: the archive (links to files that no longer change), the index
   * (it may be ahead of the snapshot), the snapshot (journal lines it already holds are skipped on
   * open), then the journal.
   */
  compact(): void {
    this.assertOpen();
    const journalPath = path.join(this.dir, JOURNAL_FILE);
    const snapshotPath = path.join(this.dir, SNAPSHOT_FILE);
    if (this.journalSize === 0 && this.currentSeq === this.snapshotSeq) return;
    const now = this.now();
    const archived = readArchive(this.dir, now);
    const added: ArchiveEntry[] = [];
    const lines = this.journalSize > 0 ? readJournal(journalPath).lines : [];
    if (lines.length > 0) {
      const fromSeq = lines[0].seq;
      const toSeq = lines[lines.length - 1].seq;
      const name = journalArchiveName(fromSeq, toSeq, this.snapshotFormat);
      archiveFile(this.dir, journalPath, name);
      added.push({ file: name, kind: "journal", fromSeq, toSeq, format: this.snapshotFormat, archivedAt: now });
    }
    if (this.currentSeq !== this.snapshotSeq) {
      const name = snapshotArchiveName(this.snapshotSeq, this.snapshotFormat);
      archiveFile(this.dir, snapshotPath, name);
      added.push({ file: name, kind: "snapshot", fromSeq: this.snapshotSeq, toSeq: this.snapshotSeq, format: this.snapshotFormat, archivedAt: now });
    }
    if (added.length > 0) {
      const prior = new Map(archived.map((entry) => [entry.file, entry]));
      const names = new Set(added.map((entry) => entry.file));
      const merged = added.map((entry) => {
        const old = prior.get(entry.file);
        if (old?.retain === true) return { ...entry, retain: true as const, archivedAt: old.archivedAt };
        return entry;
      });
      writeArchiveIndex(this.dir, [...archived.filter((entry) => !names.has(entry.file)), ...merged]);
    }

    const content = serializeSnapshot([this.header(), ...this.all.values()]);
    const snapshotSum = { seq: this.currentSeq, sha256: sha256(content) };
    writeFileDurably(path.join(this.dir, COMMIT_INDEX_FILE), this.commitIndexText(snapshotSum));
    writeFileDurably(snapshotPath, content);
    this.snapshotSeq = this.currentSeq;
    this.snapshotSum = snapshotSum;
    if (this.journalFd !== undefined) fs.closeSync(this.journalFd);
    this.journalFd = undefined;
    writeFileDurably(journalPath, "");
    this.journalFd = fs.openSync(journalPath, "a");
    this.journalSize = 0;
    this.journalLines = 0;
  }

  /**
   * Deletes archived files older than the retention period (90 days), after checking that the
   * current snapshot is on disk and matches its recorded checksum. With any problem, nothing is
   * deleted and the problems are returned.
   */
  pruneArchive(options: { now?: string; retentionMs?: number } = {}): PruneResult {
    this.assertOpen();
    // The 30-day default is not a deletion floor. An explicit scope window can only lengthen the 90-day pass.
    // A shared journal segment cannot be cut per scope; bytes and inheritance stay undecided.
    const requested = options.retentionMs ?? ARCHIVE_RETENTION_MS;
    const retentionMs = Math.max(requested, this.longestExplicitRetentionMs());
    return pruneArchive(this.dir, path.join(this.dir, SNAPSHOT_FILE), this.snapshotSum, {
      now: options.now ?? this.now(),
      retentionMs,
    });
  }

  /** Resolves when the storage engine holds every commit (at once when there is no engine). */
  flush(): Promise<void> {
    return this.engine ? this.engine.flush() : Promise.resolve();
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.engine) {
      try {
        await this.engine.flush();
      } catch {
        // The journal has everything; the engine catches up the next time the store opens.
      }
      await this.engine.close();
    }
    this.closeFiles();
  }

  // ---------------------------------------------------------------- internals

  /** Compaction when the journal is long enough, then the archive retention pass. Never throws. */
  private maintain(): void {
    const problems: string[] = [];
    try {
      if (this.compactAfterLines > 0 && this.journalLines >= this.compactAfterLines) this.compact();
    } catch (error) {
      problems.push(`compaction stopped: ${(error as Error).message}`);
    }
    try {
      problems.push(...this.pruneArchive().problems);
    } catch (error) {
      problems.push(`archive retention stopped: ${(error as Error).message}`);
    }
    this.maintenanceProblems = problems;
    if (problems.length > 0) console.warn(`[record-store] maintenance of ${this.dir} stopped: ${problems.join("; ")}`);
  }

  private attachEngine(applier: EngineApplier): void {
    this.engine = new EngineQueue(applier, {
      workspaceId: this.workspaceId,
      seq: () => this.currentSeq,
      records: () => [this.header(), ...this.all.values()],
      commitsAfter: (seq) => this.commitsAfter(seq),
    }, this.engineRetry);
    void this.engine.pump();
  }

  private closeFiles(): void {
    this.closed = true;
    if (this.journalFd !== undefined) fs.closeSync(this.journalFd);
    this.journalFd = undefined;
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("The record store is closed.");
  }

  /**
   * The journal is the source of truth and the engine is derived from it, so a commit is accepted
   * while the engine is behind. Only when it is behind by more than the limit is a commit refused:
   * the backlog must not grow without bound while nobody notices.
   */
  private engineTooFarBehind(): boolean {
    return this.engine !== undefined && this.engine.backlog(this.currentSeq) >= this.engineBacklogLimit;
  }

  private engineBehindMessage(): string {
    const backlog = this.engine ? this.engine.backlog(this.currentSeq) : 0;
    const why = this.engine?.error !== undefined ? `: ${this.engine.error}` : ".";
    return `the storage engine is ${backlog} commits behind (limit ${this.engineBacklogLimit})${why}`;
  }

  private assertEngineNotTooFarBehind(): void {
    if (this.engineTooFarBehind()) {
      const error = new Error(`ENGINE_BEHIND: ${this.engineBehindMessage()}`) as Error & { code: string };
      error.code = "ENGINE_BEHIND";
      throw error;
    }
  }

  private engineBehind(): CommitFailure {
    return this.failure("ENGINE_BEHIND", null, this.engineBehindMessage());
  }

  /** `commit-index.json`. `retired` is omitted when empty, so an index without it keeps its shape. */
  private commitIndexText(snapshot: { seq: number; sha256: string }): string {
    const commands = [...this.commands.entries()]
      .sort((a, b) => a[1].seq - b[1].seq)
      .slice(-COMMAND_INDEX_RETAIN)
      .map(([key, value]) => {
        const cut = key.indexOf("\u0000");
        return [key.slice(0, cut), key.slice(cut + 1), value.seq, value.hash];
      });
    const body: Dict = {
      format: 1,
      seq: this.currentSeq,
      mapSeq: Object.fromEntries(this.mapSeq),
      commands,
      snapshot,
    };
    if (this.retired.size > 0) {
      body.retired = Object.fromEntries([...this.retired.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
    }
    return JSON.stringify(body) + "\n";
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

  /**
   * A format 1 snapshot is migrated once: the format 1 snapshot and journal are archived
   * under their existing names (`f1`), and a format 2 base snapshot is written at the
   * current seq. Journal lines are not rewritten.
   */
  /**
   * The one-time move of an older store to the current format. The old snapshot and journal go
   * to `archive/` under their format; the records are rewritten as one new base snapshot.
   * Format 3 adds the required node field `certainty` (Database_Spec 3.2, 7): every node gets the
   * value of its `m3e:confidence` attribute, which is dropped, or -1.
   */
  private migrateToCurrentFormat(): void {
    const from = this.snapshotFormat;
    const now = this.now();
    const journalPath = path.join(this.dir, JOURNAL_FILE);
    const snapshotPath = path.join(this.dir, SNAPSHOT_FILE);
    const archived = readArchive(this.dir, now);
    const added: ArchiveEntry[] = [];
    if (this.journalSize > 0) {
      const lines = readJournal(journalPath).lines;
      if (lines.length > 0) {
        const fromSeq = lines[0].seq;
        const toSeq = lines[lines.length - 1].seq;
        const name = journalArchiveName(fromSeq, toSeq, from);
        archiveFile(this.dir, journalPath, name);
        added.push({ file: name, kind: "journal", fromSeq, toSeq, format: from, archivedAt: now });
      }
    }
    const snapshotName = snapshotArchiveName(this.snapshotSeq, from);
    archiveFile(this.dir, snapshotPath, snapshotName);
    added.push({
      file: snapshotName,
      kind: "snapshot",
      fromSeq: this.snapshotSeq,
      toSeq: this.snapshotSeq,
      format: from,
      archivedAt: now,
    });
    const names = new Set(added.map((entry) => entry.file));
    writeArchiveIndex(this.dir, [...archived.filter((entry) => !names.has(entry.file)), ...added]);

    if (from < 3) {
      for (const record of this.all.values()) {
        if (record.kind === "node") record.certainty = takeLegacyCertainty(record as unknown as { certainty?: unknown; attributes?: { [key: string]: unknown } });
      }
    }
    this.snapshotFormat = SNAPSHOT_FORMAT;
    const content = serializeSnapshot([this.header(), ...this.all.values()]);
    const snapshotSum = { seq: this.currentSeq, sha256: sha256(content) };
    writeFileDurably(path.join(this.dir, COMMIT_INDEX_FILE), this.commitIndexText(snapshotSum));
    writeFileDurably(snapshotPath, content);
    this.snapshotSeq = this.currentSeq;
    this.snapshotSum = snapshotSum;
    if (this.journalFd !== undefined) fs.closeSync(this.journalFd);
    this.journalFd = undefined;
    writeFileDurably(journalPath, "");
    this.journalFd = fs.openSync(journalPath, "a");
    this.journalSize = 0;
    this.journalLines = 0;
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

    // 2. Compare-and-set on the `before` values.
    let applied: ReturnType<typeof applyChanges>;
    try {
      applied = applyChangesReduced(warm ? warm.state : {}, changes, meta.syncHash !== undefined);
    } catch (error) {
      return this.failure("INVALID_COMMAND", current(), (error as Error).message);
    }
    if (!applied.ok) return this.failure("CONFLICT", current(), undefined, clientConflicts(applied.conflicts));
    this.fillExtensionDefaults(warm?.state, applied.state, changes);

    // 3. The app's own validation. A state that already had errors may not get more of them.
    // A Command that only edits node content cannot change what validation reports.
    const validationErrors = warm && validationUnaffected(changes)
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
      result = projector.project(row, previous, { inPlace: entry !== undefined });
    } catch (error) {
      return this.failure("INVALID_STATE", current(), (error as Error).message);
    }
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
    });
    if (refusal) return refuse(refusal);
    const reuse = this.reuseRefusal(ops);
    if (reuse) return refuse(reuse);

    // 7. The journal line. Once it is on disk, the commit has happened.
    const line = { seq, commandId: meta.commandId, issuer, committedAt, mapId, intent: meta.intent } as JournalLine;
    if (meta.actor !== undefined) line.actor = meta.actor;
    if (meta.provenance !== undefined) line.provenance = meta.provenance;
    if (meta.reason !== undefined && meta.reason !== "") line.reason = meta.reason;
    // The journal keeps a Command's changes as the client sent them: a repeated command id is
    // compared with them, and a reader of the committed Command gets its own ids back.
    line.changes = translated?.sent ?? changes;
    line.changesHash = hashChanges(line.changes);
    const aliasRecords = translated?.aliases ?? [];
    const userOps = aliasRecords.length === 0
      ? ops
      : [...ops, ...aliasRecords.map((record): RecordOp => ({ op: "put", rk: recordRk(record), record }))];
    if (meta.syncHash !== undefined && entry && userOps.length === 0) {
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
          changes: meta.sent ?? line.changes,
        };
        const payload: SyncCommand = { mapId, command, ...(entry ? {} : { mapOp: "create" }) };
        const state = result.state as AppState;
        const root = state.nodes?.[state.rootId];
        this.capture(payload, issuer, committedAt, this.mapName(entry) || root?.text || "");
        line.changesHash = hashChanges(command.changes);
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
    if (this.journalFd === undefined) throw new Error("The record store is closed.");
    if (!confirmed) {
      const touched = touchedOf(line.ops, (rk) => this.all.get(rk));
      if (touched.length > 0) line.touched = touched;
    }
    const buffer = Buffer.from(JSON.stringify(line) + "\n", "utf8");
    try {
      let written = 0;
      while (written < buffer.length) written += fs.writeSync(this.journalFd, buffer, written, buffer.length - written);
      fs.fsyncSync(this.journalFd);
    } catch (error) {
      try {
        fs.ftruncateSync(this.journalFd, this.journalSize);
      } catch {
        // Opening the store again cuts an unfinished last line.
      }
      throw error;
    }
    this.journalSize += buffer.length;
    this.journalLines += 1;
    this.applyLine(line);
    this.committed?.(line);
    this.engine?.enqueue(this.engineCommit(line));
    // The commit has happened; compaction must not turn it into a failure.
    if (this.compactAfterLines > 0 && this.journalLines >= this.compactAfterLines) this.maintain();
  }

  private engineCommit(line: JournalLine): EngineCommit {
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

  /** Commits after `seq`, read from the journal file; null when it no longer reaches back that far. */
  private commitsAfter(seq: number): EngineCommit[] | null {
    const lines = this.linesAfter(seq);
    return lines === null ? null : lines.map((line) => this.engineCommit(line));
  }

  /**
   * Journal lines after `seq`: from the journal file, and from the archive for the commits the
   * snapshot already holds. Null when the archive does not hold every one of those commits.
   */
  private linesAfter(seq: number): JournalLine[] | null {
    const current = readJournal(path.join(this.dir, JOURNAL_FILE)).lines.filter((line) => line.seq > Math.max(seq, this.snapshotSeq));
    if (seq >= this.snapshotSeq) return current;
    const found = new Map<number, JournalLine>();
    for (const entry of readArchive(this.dir, this.now())) {
      if (entry.kind !== "journal" || entry.toSeq <= seq || entry.fromSeq > this.snapshotSeq) continue;
      for (const line of readJournal(path.join(archiveDir(this.dir), entry.file)).lines) {
        if (line.seq > seq && line.seq <= this.snapshotSeq) found.set(line.seq, line);
      }
    }
    for (let next = seq + 1; next <= this.snapshotSeq; next += 1) if (!found.has(next)) return null;
    return [...[...found.values()].sort((a, b) => a.seq - b.seq), ...current];
  }

  /** Bookkeeping a journal line carries besides its record operations. */
  private indexLine(line: JournalLine): void {
    if (line.intent === LOCAL_REBASE_INTENT) return;
    if (line.mapOp === "delete") {
      this.mapSeq.delete(line.mapId);
    } else if (line.mapOp === "rename" && line.newMapId !== undefined) {
      this.mapSeq.delete(line.mapId);
      this.mapSeq.set(line.newMapId, line.seq);
      const prefix = commandKey(line.mapId, "");
      for (const [key, value] of [...this.commands]) {
        if (!key.startsWith(prefix)) continue;
        this.commands.delete(key);
        this.commands.set(commandKey(line.newMapId, key.slice(prefix.length)), value);
      }
    } else if (line.mapOp !== "columns" && !(line.mapOp === undefined && line.commandId === undefined && line.intent === "set-map-columns")) {
      // A commit that only sets row columns is not a change of the map's content. (The second
      // test reads journals written before such lines were marked.)
      this.mapSeq.set(line.mapId, line.seq);
    }
    if (line.commandId !== undefined && line.syncHash !== undefined) {
      this.commands.set(commandKey("", line.commandId), { seq: line.seq, hash: line.syncHash });
    }
    if (line.commandId !== undefined && (line.mapOp === undefined || line.mapOp === "create")) {
      this.commands.set(commandKey(line.mapId, line.commandId), {
        seq: line.seq,
        hash: line.changesHash ?? hashChanges(line.changes),
      });
    }
  }

  /** Applies a committed journal line to the record set in memory. */
  private applyLine(line: JournalLine): void {
    for (const op of line.ops) {
      const before = this.all.get(op.rk);
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
    this.indexLine(line);
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
    if (this.engineTooFarBehind()) return this.engineBehind();
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
    const records = this.recordsAt(seq);
    if (!records) return null;
    return fromSnapshot(records).rows.find((row) => row.id === mapId)?.state ?? null;
  }

  private recordsAt(target: number): SnapshotRecord[] | null {
    if (target === this.currentSeq) return [...this.all.values()];
    if (!Number.isInteger(target) || target < 0 || target > this.currentSeq) return null;
    let baseSeq = -1;
    let base: SnapshotRecord[] | null = null;
    if (this.snapshotSeq <= target) {
      baseSeq = this.snapshotSeq;
      base = parseSnapshot(fs.readFileSync(path.join(this.dir, SNAPSHOT_FILE), "utf8"));
    } else {
      for (const archived of readArchive(this.dir, this.now())) {
        if (archived.kind !== "snapshot" || archived.toSeq > target || archived.toSeq < baseSeq) continue;
        baseSeq = archived.toSeq;
        base = parseSnapshot(fs.readFileSync(path.join(archiveDir(this.dir), archived.file), "utf8"));
      }
    }
    if (!base || baseSeq < 0) return null;
    const lines = target === baseSeq ? [] : this.linesThrough(baseSeq, target);
    if (!lines) return null;
    const map = new Map<string, SnapshotRecord>();
    for (const record of base) {
      if (record.kind === "snapshot") continue;
      map.set(recordRk(record), record);
    }
    for (const line of lines) {
      for (const op of line.ops) {
        if (op.op === "delete") map.delete(op.rk);
        else if (op.record) map.set(op.rk, op.record as SnapshotRecord);
      }
      const commit: CommitRecord = { kind: "commit", seq: line.seq, committedAt: line.committedAt, issuer: line.issuer };
      map.set(recordRk(commit), commit);
    }
    return [...map.values()];
  }

  /** Journal lines with seq in (fromSeq, toSeq], from the archive and the live journal. */
  private linesThrough(fromSeq: number, toSeq: number): JournalLine[] | null {
    if (toSeq < fromSeq) return null;
    const found = new Map<number, JournalLine>();
    const consider = (line: JournalLine): void => {
      if (line.seq > fromSeq && line.seq <= toSeq) found.set(line.seq, line);
    };
    for (const archived of readArchive(this.dir, this.now())) {
      if (archived.kind !== "journal" || archived.toSeq <= fromSeq || archived.fromSeq > toSeq) continue;
      for (const line of readJournal(path.join(archiveDir(this.dir), archived.file)).lines) consider(line);
    }
    const journalPath = path.join(this.dir, JOURNAL_FILE);
    if (fs.existsSync(journalPath)) {
      for (const line of readJournal(journalPath).lines) consider(line);
    }
    const lines: JournalLine[] = [];
    for (let seq = fromSeq + 1; seq <= toSeq; seq += 1) {
      const line = found.get(seq);
      if (!line) return null;
      lines.push(line);
    }
    return lines;
  }

  /**
   * A namedSnapshot at this commit keeps a portable snapshot in the archive.
   * Deleting the last record of a seq clears the keep-mark. The file stays until a later prune.
   */
  private noteNamedSnapshots(replaced: ReadonlyMap<string, SnapshotRecord>, ops: readonly RecordOp[]): void {
    // Only a commit that writes or deletes a namedSnapshot record changes what the archive keeps.
    if (!ops.some((op) => op.rk.startsWith("namedSnapshot|"))) return;
    const kept = new Set<number>();
    for (const record of this.all.values()) {
      if (record.kind !== "namedSnapshot") continue;
      kept.add(record.seq);
      if (record.seq !== this.currentSeq || replaced.has(recordRk(record))) continue;
      this.retainSnapshot(record.seq);
    }
    this.releaseSnapshots(kept);
  }

  private retainSnapshot(seq: number): void {
    const name = snapshotArchiveName(seq, this.snapshotFormat);
    const header: SnapshotHeader = { kind: "snapshot", format: this.snapshotFormat, ...this.syncIdentity(), seq };
    const content = serializeSnapshot([header, ...this.all.values()]);
    const dir = archiveDir(this.dir);
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, name);
    if (fs.existsSync(target)) {
      if (sha256(fs.readFileSync(target)) !== sha256(content)) return;
    } else {
      writeFileDurably(target, content);
    }
    const archived = readArchive(this.dir, this.now());
    if (archived.some((entry) => entry.file === name && entry.retain === true)) return;
    const now = this.now();
    const next = archived.some((entry) => entry.file === name)
      ? archived.map((entry) => (entry.file === name ? { ...entry, retain: true as const } : entry))
      : [...archived, { file: name, kind: "snapshot" as const, fromSeq: seq, toSeq: seq, format: this.snapshotFormat, archivedAt: now, retain: true as const }];
    writeArchiveIndex(this.dir, next);
  }

  private releaseSnapshots(keptSeqs: ReadonlySet<number>): void {
    const dir = archiveDir(this.dir);
    if (!fs.existsSync(dir)) return;
    const archived = readArchive(this.dir, this.now());
    let changed = false;
    const next = archived.map((entry) => {
      if (entry.kind !== "snapshot" || entry.retain !== true || keptSeqs.has(entry.toSeq)) return entry;
      changed = true;
      const copy: ArchiveEntry = { ...entry };
      delete copy.retain;
      return copy;
    });
    if (changed) writeArchiveIndex(this.dir, next);
  }

  /** The longest retention.ms a scope states. The 30-day default is not a deletion floor. */
  private longestExplicitRetentionMs(): number {
    let longest = 0;
    for (const record of this.all.values()) {
      if (record.kind !== "scope") continue;
      const ms = record.retention?.ms;
      if (typeof ms === "number" && Number.isFinite(ms) && ms > longest) longest = ms;
    }
    return longest;
  }
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
