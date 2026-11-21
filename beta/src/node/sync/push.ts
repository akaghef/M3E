/**
 * HTTP push: each Command is committed on its own, in order, and answered on its own.
 * A rejection does not stop the next Command. The issuer argument is the account id
 * chosen from the connection; `command.actor` is stored as the caller's label only.
 *
 * Success is the store's result, which returns after the journal fsync.
 * The same commandId returns the first result. The store remembers a committed
 * Command. A deterministic rejection is remembered beside the store
 * (`sync-rejections.jsonl`), because the store does not keep refusals.
 * `baseSeq` is accepted and not used: an old-base move is still CAS, not LWW.
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import type { MapCommand } from "../../shared/map_changes";
import type { RecordWorkspaceStore } from "../record_store/store";
import { fsyncDir } from "../record_store/journal_archive";
import { accountForConnection, type ConnectionIdentity } from "./issuer";

export type PushStatus = "committed" | "rejected" | "duplicate";

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
  mapId: string;
  baseSeq: number;
  command: MapCommand;
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
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (line.trim() === "") continue;
      try {
        const row = JSON.parse(line) as Remembered;
        if (row && typeof row.commandId === "string" && typeof row.hash === "string" && row.result) known.set(row.commandId, row);
      } catch {
        // A torn last line is ignored. The fsync'd lines before it stand.
      }
    }
  }
  memory.set(storeDir, known);
  return known;
}

function remember(storeDir: string, row: Remembered): void {
  const known = rejections(storeDir);
  if (known.has(row.commandId)) return;
  known.set(row.commandId, row);
  const file = rejectionFile(storeDir);
  const fd = fs.openSync(file, "a");
  try {
    fs.writeSync(fd, `${JSON.stringify(row)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fsyncDir(storeDir);
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
  return { commandId, mapId: value.mapId, baseSeq: value.baseSeq, command };
}

function isItem(value: PushItem | PushResultItem): value is PushItem {
  return "command" in value;
}

const REMEMBERED = new Set(["CONFLICT", "INVALID_STATE", "INVALID_COMMAND", "SAME_ID_DIFFERENT_CONTENT"]);

function fromStore(commandId: string, result: { ok: true; seq: number; replayed: boolean } | { ok: false; code: string; message?: string }): PushResultItem {
  if (result.ok) {
    return result.replayed
      ? { commandId, status: "duplicate", seq: result.seq }
      : { commandId, status: "committed", seq: result.seq };
  }
  const item: PushResultItem = { commandId, status: "rejected", code: result.code };
  if (result.message !== undefined) item.message = result.message;
  return item;
}

export function pushCommands(store: RecordWorkspaceStore, storeDir: string, commands: unknown, issuer: string): PushResponse {
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
    const hash = contentHash(parsed.command.changes);
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
    const committed = store.commitMapCommand(parsed.mapId, parsed.command, issuer);
    const item = fromStore(parsed.commandId, committed);
    if (!committed.ok && REMEMBERED.has(committed.code)) remember(storeDir, { commandId: parsed.commandId, hash, result: item });
    results.push(item);
  }
  return { results };
}

export function issuerForConnection(connection: ConnectionIdentity, _store?: RecordWorkspaceStore): string {
  const choice = accountForConnection(connection);
  return choice.accountId;
}
