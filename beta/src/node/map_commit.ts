/**
 * Commit one Command for a map.
 * The maps table and state_json stay as they are. command_log is append-only
 * and is the start of the journal for that map.
 */
import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import type { AppState, SavedMap } from "../shared/types";
import { applyChanges, type FieldConflict, type MapCommand, type RecordChange } from "../shared/map_changes";
import { RapidMvpModel } from "./rapid_mvp";
import { activeRecordStore } from "./record_store/active";
import { storeCommitMapCommand, storeLoadSavedMap, storeReadCommittedCommand } from "./record_store/legacy_api";
import type { RecordWorkspaceStore } from "./record_store/store";

type SqliteDatabase = InstanceType<typeof Database>;

export interface CommitSuccess {
  ok: true;
  savedAt: string;
  seq: number;
  replayed: boolean;
}

export interface CommitFailure {
  ok: false;
  /** ENGINE_BEHIND comes from the record store only (M3E_STORE_DIR): its storage engine stopped following. */
  code: "NOT_FOUND" | "CONFLICT" | "INVALID_STATE" | "INVALID_COMMAND" | "ENGINE_BEHIND";
  conflicts: FieldConflict[];
  current: { savedAt: string; state: object } | null;
}

export type CommitResult = CommitSuccess | CommitFailure;

export interface StoredCommand {
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

const ACTORS = new Set(["human", "ai-agent", "system"]);

function assertNotLiveM3e(dbPath: string): void {
  if (process.env.M3E_FORBID_LIVE_DATA !== "1") return;
  const live = path.join(os.homedir(), "Library", "Application Support", "M3E");
  const resolved = path.resolve(dbPath);
  if (resolved === live || resolved.startsWith(live + path.sep)) {
    throw new Error("Refusing to open the live M3E database.");
  }
}

function openDb(dbPath: string): SqliteDatabase {
  assertNotLiveM3e(dbPath);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS command_log (
      map_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      command_id TEXT NOT NULL,
      actor TEXT NOT NULL,
      intent TEXT NOT NULL,
      provenance TEXT,
      changes TEXT NOT NULL,
      committed_at TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (map_id, seq),
      UNIQUE (map_id, command_id)
    )
  `);
  return db;
}

function rowToStored(row: {
  map_id: string;
  seq: number;
  command_id: string;
  actor: string;
  intent: string;
  provenance: string | null;
  changes: string;
  committed_at: string;
  saved_at: string;
}): StoredCommand {
  return {
    mapId: row.map_id,
    seq: row.seq,
    commandId: row.command_id,
    actor: JSON.parse(row.actor) as MapCommand["actor"],
    intent: row.intent,
    provenance: row.provenance ? JSON.parse(row.provenance) as unknown : undefined,
    changes: JSON.parse(row.changes) as RecordChange[],
    committedAt: row.committed_at,
    savedAt: row.saved_at,
  };
}

export function readCommittedCommand(dbPath: string, mapId: string, commandId: string): StoredCommand | null {
  const store = activeRecordStore();
  if (store) return storeReadCommittedCommand(store, mapId, commandId);
  const db = openDb(dbPath);
  try {
    const row = db.prepare(`
      SELECT map_id, seq, command_id, actor, intent, provenance, changes, committed_at, saved_at
      FROM command_log WHERE map_id = ? AND command_id = ?
    `).get(mapId, commandId) as Parameters<typeof rowToStored>[0] | undefined;
    return row ? rowToStored(row) : null;
  } finally {
    db.close();
  }
}

function invalid(code: CommitFailure["code"], current: CommitFailure["current"], conflicts: FieldConflict[] = []): CommitFailure {
  return { ok: false, code, conflicts, current };
}

function commitWithIssuer(store: RecordWorkspaceStore, mapId: string, command: MapCommand, expectedRevision: string | undefined, issuer: string): CommitResult {
  let expected: string | undefined;
  if (expectedRevision !== undefined && store.hasMap(mapId)) {
    expected = RapidMvpModel.savedRevision(storeLoadSavedMap(store, mapId)) === expectedRevision ? store.revisionOf(mapId) : "stale";
  }
  const result = store.commitMapCommand(mapId, command, issuer, expected);
  if (result.ok) return { ok: true, savedAt: result.savedAt, seq: result.seq, replayed: result.replayed };
  const code: CommitFailure["code"] = result.code === "SAME_ID_DIFFERENT_CONTENT" ? "CONFLICT"
    : result.code === "ENGINE_BEHIND" ? "ENGINE_BEHIND"
    : result.code === "NOT_FOUND" ? "NOT_FOUND"
    : result.code === "CONFLICT" ? "CONFLICT"
    : result.code === "INVALID_STATE" ? "INVALID_STATE"
    : "INVALID_COMMAND";
  return { ok: false, code, conflicts: result.conflicts, current: result.current };
}

function commandShape(command: MapCommand): string | null {
  if (!command || typeof command !== "object") return "Command must be an object.";
  if (typeof command.commandId !== "string" || !command.commandId.trim()) return "commandId is required.";
  if (!command.actor || !ACTORS.has(command.actor.kind) || typeof command.actor.id !== "string" || !command.actor.id.trim()) return "actor is required.";
  if (typeof command.intent !== "string" || !command.intent.trim()) return "intent is required.";
  if (!Array.isArray(command.changes)) return "changes must be a list.";
  return null;
}

/**
 * `expectedRevision`, when given, is the whole-map revision the caller read
 * (RapidMvpModel.savedRevision). A different stored revision rejects the Command.
 * The check, the state write and the journal row are one transaction.
 *
 * `issuer`, when given, is the account id the server chose from the connection.
 * It is written on the journal line. The Command's actor is not the issuer.
 * Without it, the record store still derives an issuer from the actor (legacy).
 */
export function commitMapCommand(dbPath: string, mapId: string, command: MapCommand, expectedRevision?: string, issuer?: string): CommitResult {
  const store = activeRecordStore();
  if (store) {
    if (issuer === undefined) return storeCommitMapCommand(store, mapId, command, expectedRevision, RapidMvpModel.savedRevision);
    return commitWithIssuer(store, mapId, command, expectedRevision, issuer);
  }
  if (!command || typeof command !== "object" || typeof command.commandId !== "string") {
    return invalid("INVALID_COMMAND", null);
  }
  const db = openDb(dbPath);
  try {
    const run = db.transaction((): CommitResult => {
      const existing = db.prepare(`
        SELECT seq, saved_at AS savedAt FROM command_log WHERE map_id = ? AND command_id = ?
      `).get(mapId, command.commandId) as { seq: number; savedAt: string } | undefined;
      if (existing) return { ok: true, savedAt: existing.savedAt, seq: existing.seq, replayed: true };

      const row = db.prepare(`
        SELECT saved_at AS savedAt, state_json AS stateJson FROM maps WHERE id = ?
      `).get(mapId) as { savedAt: string; stateJson: string } | undefined;
      if (!row) return invalid("NOT_FOUND", null);
      const shape = commandShape(command);
      let currentState: object;
      try { currentState = JSON.parse(row.stateJson) as object; }
      catch { return invalid("INVALID_STATE", null); }
      const current = { savedAt: row.savedAt, state: currentState };
      if (shape) return invalid("INVALID_COMMAND", current);
      if (expectedRevision !== undefined) {
        const stored = RapidMvpModel.savedRevision({ version: 1, savedAt: row.savedAt, state: currentState as AppState });
        if (stored !== expectedRevision) return invalid("CONFLICT", current);
      }

      let applied: ReturnType<typeof applyChanges>;
      try { applied = applyChanges(currentState, command.changes); }
      catch { return invalid("INVALID_COMMAND", current); }
      if (!applied.ok) return invalid("CONFLICT", current, applied.conflicts);

      try {
        const model = RapidMvpModel.fromJSON(applied.state as AppState);
        if (model.validate().length) return invalid("INVALID_STATE", current);
      } catch {
        return invalid("INVALID_STATE", current);
      }

      const savedAt = new Date().toISOString();
      const seqRow = db.prepare(`SELECT COALESCE(MAX(seq), 0) AS seq FROM command_log WHERE map_id = ?`).get(mapId) as { seq: number };
      const seq = seqRow.seq + 1;
      db.prepare(`UPDATE maps SET state_json = ?, saved_at = ? WHERE id = ?`).run(JSON.stringify(applied.state), savedAt, mapId);
      db.prepare(`
        INSERT INTO command_log (map_id, seq, command_id, actor, intent, provenance, changes, committed_at, saved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        mapId,
        seq,
        command.commandId,
        JSON.stringify(command.actor),
        command.intent,
        command.provenance === undefined ? null : JSON.stringify(command.provenance),
        JSON.stringify(command.changes),
        savedAt,
        savedAt,
      );
      return { ok: true, savedAt, seq, replayed: false };
    });
    return run.immediate();
  } finally {
    db.close();
  }
}

export function savedMap(dbPath: string, mapId: string): SavedMap {
  return RapidMvpModel.loadSavedMapFromSqlite(dbPath, mapId);
}
