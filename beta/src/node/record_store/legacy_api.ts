// How the server's existing persistence calls are answered by the record store.
//
// `RapidMvpModel` (../rapid_mvp.ts) and ../map_commit.ts call these when `activeRecordStore()` is
// not null. Results, error messages and thrown errors are the ones the SQLite code gives, so the
// HTTP routes and the MCP service above them need no change. The `dbPath` of the callers is not
// used: one process has one store.
//
// Row columns are kept in the form the SQLite table has (tags and source as JSON text, archived
// and pinned as 0 / 1), which is also what a snapshot made from SQLite carries.

import type { MapCommand, FieldConflict, RecordChange } from "../../shared/map_changes";
import { fromSnapshot } from "../../shared/record_model/from_snapshot";
import { MapProjector, recordRk } from "../../shared/record_model/steady";
import type { AppState, SavedMap } from "../../shared/types";
import type { MapRecord, SnapshotRecord, SnapshotRow } from "../../shared/record_model/types";
import type { MapSource, MapSummaryInternal } from "../rapid_mvp";
import type { CommitFailure as StoreCommitFailure, JournalLine, MapColumns, RecordWorkspaceStore } from "./store";

/** Issuer of the commits that do not come from a Command with an actor. */
const SERVER_ISSUER = "system:server";

type Dict = Record<string, unknown>;

export interface LegacyCommitSuccess {
  ok: true;
  savedAt: string;
  seq: number;
  replayed: boolean;
}

export interface LegacyCommitFailure {
  ok: false;
  code: "NOT_FOUND" | "CONFLICT" | "INVALID_STATE" | "INVALID_COMMAND" | "ENGINE_BEHIND";
  conflicts: FieldConflict[];
  current: { savedAt: string; state: object } | null;
}

export interface LegacyStoredCommand {
  mapId: string;
  seq: number;
  commandId: string;
  actor: MapCommand["actor"];
  intent: string;
  provenance: unknown;
  changes: RecordChange[];
  committedAt: string;
  savedAt: string;
}

function failed(result: StoreCommitFailure, fallback: string): Error {
  const error = new Error(result.code === "ENGINE_BEHIND" ? `ENGINE_BEHIND: ${result.message ?? "the storage engine is behind."}` : result.message ?? fallback) as Error & { code?: string };
  error.code = result.code;
  return error;
}

function requireMap(store: RecordWorkspaceStore, mapId: string): void {
  if (!store.hasMap(mapId)) throw new Error("Map not found.");
}

// ---------------------------------------------------------------- loads and whole-map saves

export function storeLoadSavedMap(store: RecordWorkspaceStore, mapId: string): SavedMap {
  requireMap(store, mapId);
  const row = store.getMapRow(mapId);
  if (!row.savedAt) throw new Error("Unsupported or invalid save format.");
  return { version: 1, savedAt: row.savedAt, state: row.state };
}

const MAP_COLUMN_FIELDS = ["tags", "archived", "pinned", "source"] as const;

/**
 * The same projection `RecordWorkspaceStore` uses for a map: `fromSnapshot`, then `MapProjector`
 * when that projection reproduces the records. Alias translation is `clientState` / `aliasesOf`
 * (both private). The commit time is `savedAtOf` (private). Those two stay on `getMapRow`.
 */
function stateFromMapRecords(workspaceId: string, mapId: string, records: SnapshotRecord[]): AppState {
  const restored = fromSnapshot(records).rows.find((row) => row.id === mapId)?.state;
  if (!restored) throw new Error("Map not found.");
  const map = records.find((record): record is MapRecord => record.kind === "map" && record.id === mapId);
  const row: SnapshotRow = { id: mapId, state: restored };
  if (map) {
    for (const field of MAP_COLUMN_FIELDS) {
      if (map[field] !== undefined) row[field] = map[field];
    }
    if (map.legacyVersion !== undefined) row.version = map.legacyVersion;
    if (map.legacySavedAt !== undefined) row.saved_at = map.legacySavedAt;
  }
  const previous = new Map<string, SnapshotRecord>();
  for (const record of records) {
    if (record.kind === "snapshot") continue;
    previous.set(recordRk(record), record);
  }
  try {
    const projected = new MapProjector(workspaceId).project(row, previous);
    if (projected.delta.size === 0) return projected.state;
  } catch {
    // Records the projection cannot reproduce: the stored state is the fromSnapshot state.
  }
  return restored;
}

/**
 * `GET /api/maps/:id`. On Neo4j the map's records are read by query. Null from the store means
 * the store is not on Neo4j, and the in-memory row is the map.
 */
export async function storeLoadSavedMapFromDatabase(store: RecordWorkspaceStore, mapId: string): Promise<SavedMap> {
  const records = await store.mapRecordsFromDatabase(mapId);
  if (records === null) return storeLoadSavedMap(store, mapId);
  if (!records.some((record) => record.kind === "map" && record.id === mapId)) throw new Error("Map not found.");
  if (!store.hasMap(mapId)) throw new Error("Map not found.");
  const memory = store.getMapRow(mapId);
  if (!memory.savedAt) throw new Error("Unsupported or invalid save format.");
  const aliased = records.some((record) => record.kind === "idMap" && record.alias === true);
  const state = aliased ? memory.state : stateFromMapRecords(store.workspaceId, mapId, records);
  return { version: 1, savedAt: memory.savedAt, state };
}

export function storedCommandFromLine(mapId: string, line: JournalLine | null): LegacyStoredCommand | null {
  if (!line || line.commandId === undefined) return null;
  return {
    mapId,
    seq: line.seq,
    commandId: line.commandId,
    actor: line.actor as MapCommand["actor"],
    intent: line.intent,
    provenance: line.provenance,
    changes: line.changes ?? [],
    committedAt: line.committedAt,
    savedAt: line.committedAt,
  };
}

/** Saves the whole state (the difference to the stored state is committed) and returns the saved-at time. */
export function storeSaveMap(store: RecordWorkspaceStore, mapId: string, state: AppState): string {
  const result = store.saveWholeMap(mapId, state, SERVER_ISSUER);
  if (!result.ok) throw failed(result, "The record store refused the map state.");
  return result.savedAt;
}

/** `saveToSqliteIfUnchanged`: the save happens only when the stored map still has the revision the caller read. */
export function storeSaveMapIfUnchanged(
  store: RecordWorkspaceStore,
  mapId: string,
  state: AppState,
  expectedRevision: string,
  revisionOf: (saved: SavedMap) => string,
): SavedMap {
  if (!store.hasMap(mapId) || revisionOf(storeLoadSavedMap(store, mapId)) !== expectedRevision) {
    throw new Error("REVISION_CONFLICT");
  }
  return { version: 1, savedAt: storeSaveMap(store, mapId, state), state };
}

// ---------------------------------------------------------------- map list and row columns

function parseTags(raw: unknown): string[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    list = undefined;
    if (trimmed.startsWith("[")) {
      try { list = JSON.parse(trimmed) as unknown; } catch { list = undefined; }
    }
    if (!Array.isArray(list)) list = trimmed.split(",");
  }
  if (!Array.isArray(list)) return [];
  return list.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter((tag) => tag.length > 0);
}

function parseSource(raw: unknown): MapSource | undefined {
  let value: unknown = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return undefined;
    try { value = JSON.parse(raw) as unknown; } catch { return undefined; }
  }
  if (value && typeof value === "object" && (value as Dict).kind === "obsidian" && typeof (value as Dict).path === "string") {
    return { kind: "obsidian", path: (value as { path: string }).path };
  }
  return undefined;
}

function isSet(raw: unknown): boolean {
  return raw === true || Number(raw ?? 0) === 1;
}

export function storeListMaps(store: RecordWorkspaceStore, includeArchived: boolean): MapSummaryInternal[] {
  const summaries: MapSummaryInternal[] = [];
  for (const entry of store.listMaps()) {
    const archived = isSet(entry.archived);
    if (archived && !includeArchived) continue;
    // Counts and root text come from the store's own bookkeeping; no map state is copied for the list.
    const rootText = entry.rootText.trim();
    const summary: MapSummaryInternal = {
      id: entry.id,
      label: rootText.length > 0 ? rootText : "Untitled",
      savedAt: entry.savedAt,
      nodeCount: entry.nodeCount,
      charCount: entry.charCount,
      tags: parseTags(entry.tags),
      archived,
      pinned: isSet(entry.pinned),
    };
    const source = parseSource(entry.source);
    if (source) summary.source = source;
    summaries.push(summary);
  }
  // The SQLite list is ordered by saved_at, newest first.
  return summaries.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}

export function storeSetMapColumns(store: RecordWorkspaceStore, mapId: string, columns: MapColumns): void {
  requireMap(store, mapId);
  store.setMapColumns(mapId, columns, SERVER_ISSUER);
}

export function storeRenameMap(store: RecordWorkspaceStore, mapId: string, label: string): void {
  const state = storeLoadSavedMap(store, mapId).state;
  const root = state?.nodes?.[state.rootId];
  if (root) root.text = label;
  const result = store.saveWholeMap(mapId, state, SERVER_ISSUER, "rename-map-label");
  if (!result.ok) throw failed(result, "The record store refused the map state.");
}

export function storeDeleteMap(store: RecordWorkspaceStore, mapId: string): void {
  requireMap(store, mapId);
  const row = store.listMaps().find((entry) => entry.id === mapId);
  if (!row || !isSet(row.archived)) throw new Error("Map is not archived.");
  store.deleteMap(mapId, SERVER_ISSUER);
}

// ---------------------------------------------------------------- duplicate

/**
 * The copy is saved with the ids of its source, as the SQLite copy is. The store keeps ids unique
 * across the maps of a workspace: it gives every colliding id of the copy a stored id of its own
 * and keeps answering with the ids of the source (see ./id_alias.ts).
 */
export function storeDuplicateMap(store: RecordWorkspaceStore, sourceId: string, newId: string): void {
  if (!store.hasMap(sourceId)) throw new Error("Map not found.");
  const row = store.getMapRow(sourceId);
  const result = store.saveWholeMap(newId, row.state, SERVER_ISSUER, "duplicate-map");
  if (!result.ok) throw failed(result, "The record store refused the copy of the map.");
  // The SQLite copy carries the tags and starts neither archived nor pinned.
  if (row.tags !== undefined && row.tags !== null) store.setMapColumns(newId, { tags: row.tags }, SERVER_ISSUER);
}

// ---------------------------------------------------------------- Commands

function issuerOf(command: MapCommand): string {
  const actor = command && typeof command === "object" ? command.actor : undefined;
  return actor && typeof actor.kind === "string" && typeof actor.id === "string" && actor.id.trim()
    ? `${actor.kind}:${actor.id}`
    : SERVER_ISSUER;
}

/**
 * `expectedRevision` is the revision the callers compute from a loaded map (`revisionOf`, a hash
 * of saved-at time and state). It is compared here and handed to the store as "matches" or "does
 * not match", so that the store keeps its own order of checks (a repeated command id first).
 */
export function storeCommitMapCommand(
  store: RecordWorkspaceStore,
  mapId: string,
  command: MapCommand,
  expectedRevision: string | undefined,
  revisionOf: (saved: SavedMap) => string,
): LegacyCommitSuccess | LegacyCommitFailure {
  let expected: string | undefined;
  if (expectedRevision !== undefined && store.hasMap(mapId)) {
    expected = revisionOf(storeLoadSavedMap(store, mapId)) === expectedRevision ? store.revisionOf(mapId) : "stale";
  }
  const result = store.commitMapCommand(mapId, command, issuerOf(command), expected);
  if (result.ok) return { ok: true, savedAt: result.savedAt, seq: result.seq, replayed: result.replayed };
  // The same command id with other changes: the callers know this as a conflict.
  const code = result.code === "SAME_ID_DIFFERENT_CONTENT" ? "CONFLICT" : result.code;
  return { ok: false, code, conflicts: result.conflicts, current: result.current };
}

export function storeReadCommittedCommand(store: RecordWorkspaceStore, _mapId: string, _commandId: string): LegacyStoredCommand | null {
  // The file-store reader is gone with the file store. Neo4j reads go through `store.readCommittedCommand`.
  void store;
  throw new Error("A committed Command is read with readCommittedCommand.");
}
