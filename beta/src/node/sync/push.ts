/**
 * HTTP push: each Command is committed on its own, in order, and answered on its own.
 * A rejection does not stop the next Command. The issuer argument is the account id
 * chosen from the connection; `command.actor` is stored as the caller's label only.
 *
 * Success is the store's result, which returns after the journal fsync.
 * The same commandId returns the first result. The store remembers a committed
 * Command. A deterministic rejection or a no-op is remembered beside the store
 * (`sync-rejections.jsonl`), because neither produces a journal commit.
 * `baseSeq` is accepted and not used: an old-base move is still CAS, not LWW.
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import type { MapCommand } from "../../shared/map_changes";
import { syncHash, type RecordWorkspaceStore } from "../record_store/store";
import type { SyncCommand, SyncMapOperation } from "../record_store/sync_types";
import { appendJsonLine, readDurableLines } from "./outbox";
import { accountForConnection, type ConnectionIdentity } from "./issuer";

export type PushStatus = "committed" | "rejected" | "duplicate" | "no-op" | "conflict";

export interface PushResultItem {
  commandId: string;
  status: PushStatus;
  seq?: number;
  code?: string;
  message?: string;
}

export interface PushResponse {
  results: PushResultItem[];
}

interface PushItem {
  commandId: string;
  payload: SyncCommand;
}

interface Remembered {
  commandId: string;
  hash: string;
  result: PushResultItem;
}

const memory = new Map<string, Map<string, Remembered>>();

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const source = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${canonicalJson(source[key])}`);
    }
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function contentHash(changes: unknown): string {
  return createHash("sha256").update(canonicalJson(changes), "utf8").digest("hex");
}

function rejectionFile(storeDir: string): string {
  return path.join(storeDir, "sync-rejections.jsonl");
}

function rejections(storeDir: string): Map<string, Remembered> {
  let known = memory.get(storeDir);
  if (known) return known;
  known = new Map();
  const file = rejectionFile(storeDir);
  if (fs.existsSync(file)) {
    for (const row of readDurableLines<Remembered>(file, (item) => {
      const row = item as Partial<Remembered> | null;
      return !!row && typeof row.commandId === "string" && typeof row.hash === "string" && !!row.result;
    }, true)) known.set(row.commandId, row);
  }
  memory.set(storeDir, known);
  return known;
}

function remember(storeDir: string, row: Remembered): void {
  const known = rejections(storeDir);
  if (known.has(row.commandId)) return;
  appendJsonLine(rejectionFile(storeDir), row);
  known.set(row.commandId, row);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseItem(value: unknown): PushItem | PushResultItem {
  if (!isRecord(value)) return { commandId: "", status: "rejected", code: "INVALID_COMMAND", message: "Each push item must be an object." };
  const commandId = typeof value.commandId === "string" ? value.commandId : "";
  const fail = (message: string): PushResultItem => ({ commandId, status: "rejected", code: "INVALID_COMMAND", message });
  if (!commandId.trim()) return fail("commandId is required.");
  if (typeof value.mapId !== "string" || !value.mapId.trim()) return fail("mapId is required.");
  if (typeof value.baseSeq !== "number" || !Number.isInteger(value.baseSeq) || value.baseSeq < 0) return fail("baseSeq must be a non-negative integer.");
  if (!isRecord(value.command)) return fail("command must be an object.");
  const command = value.command as unknown as MapCommand;
  if (command.commandId !== commandId) return fail("command.commandId must match commandId.");
  const core = { mapId: value.mapId, command };
  const mapOp = value.mapOp;
  let operation: SyncMapOperation | { mapOp?: undefined } = {};
  if (mapOp !== undefined && mapOp !== "create" && command.changes?.length !== 0) return fail("Map operations require empty changes.");
  switch (mapOp) {
    case undefined: break;
    case "create": operation = { mapOp }; break;
    case "delete":
      if (value.before !== undefined && typeof value.before !== "string") return fail("Invalid map deletion precondition.");
      operation = { mapOp, before: value.before };
      break;
    case "rename":
      if (typeof value.newMapId !== "string" || !value.newMapId.trim()) return fail("newMapId is required.");
      operation = { mapOp, newMapId: value.newMapId };
      break;
    case "columns":
      if (!isRecord(value.columns) || (value.before !== undefined && !isRecord(value.before))) return fail("Invalid map columns.");
      if (Object.keys(value.columns).some((field) => !["tags", "archived", "pinned", "source"].includes(field))) {
        return fail("Unknown map column.");
      }
      if (Object.keys(value.before ?? {}).some((field) => !Object.prototype.hasOwnProperty.call(value.columns, field))) {
        return fail("Column preconditions must address updated columns.");
      }
      operation = { mapOp, columns: value.columns, before: value.before };
      break;
    default: return fail("Unknown map operation.");
  }
  return { commandId, payload: { ...core, ...operation } };
}

function isItem(value: PushItem | PushResultItem): value is PushItem {
  return "payload" in value;
}

const REMEMBERED = new Set(["CONFLICT", "INVALID_STATE", "INVALID_COMMAND", "SAME_ID_DIFFERENT_CONTENT"]);

function fromStore(commandId: string, result: { ok: true; seq: number; replayed: boolean; noOp?: true } | { ok: false; code: string; message?: string }, fenced: boolean): PushResultItem {
  if (result.ok) {
    if (result.noOp) return { commandId, status: "no-op", seq: result.seq };
    return result.replayed
      ? { commandId, status: "duplicate", seq: result.seq }
      : { commandId, status: "committed", seq: result.seq };
  }
  const item: PushResultItem = { commandId, status: fenced && result.code === "CONFLICT" ? "conflict" : "rejected", code: result.code };
  if (item.status === "conflict") item.message = "The current value differs from both the expected and proposed values.";
  if (result.message !== undefined) item.message = result.message;
  return item;
}

export function pushCommands(store: RecordWorkspaceStore, storeDir: string, commands: unknown, issuer: string, fenced = false): PushResponse {
  if (!Array.isArray(commands)) {
    return { results: [{ commandId: "", status: "rejected", code: "INVALID_COMMAND", message: "commands must be a list." }] };
  }
  const results: PushResultItem[] = [];
  for (const raw of commands) {
    const parsed = parseItem(raw);
    if (!isItem(parsed)) {
      results.push(parsed);
      continue;
    }
    const { payload } = parsed;
    const sync = fenced || payload.mapOp !== undefined;
    const hash = sync ? syncHash(payload) : contentHash(payload.command.changes);
    const prior = rejections(storeDir).get(parsed.commandId);
    if (prior) {
      results.push(prior.hash === hash ? prior.result : {
        commandId: parsed.commandId,
        status: "rejected",
        code: "SAME_ID_DIFFERENT_CONTENT",
        message: `Command ${parsed.commandId} was already refused with different changes.`,
      });
      continue;
    }
    const committed = sync
      ? store.commitSyncCommand(payload, issuer)
      : store.commitMapCommand(payload.mapId, payload.command, issuer);
    const item = fromStore(parsed.commandId, committed, sync);
    if (item.status === "no-op" || (!committed.ok && REMEMBERED.has(committed.code))) remember(storeDir, { commandId: parsed.commandId, hash, result: item });
    results.push(item);
  }
  return { results };
}

export function issuerForConnection(connection: ConnectionIdentity, _store?: RecordWorkspaceStore): string {
  const choice = accountForConnection(connection);
  return choice.accountId;
}
