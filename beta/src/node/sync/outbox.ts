/**
 * Device outbox: one JSON Lines file of Commands that are not yet committed or refused.
 * Append and fsync happen before the caller applies the Command locally or pushes it.
 * A committed or rejected result leaves the file. A rejection is reported so the
 * caller can roll the device state back. The file is the resume point after restart.
 *
 * Shape of one line: {commandId, baseSeq, command, createdAt, mapId}.
 * `mapId` is extra because a push addresses one map; the four fields the spec names are kept.
 */
import fs from "fs";
import path from "path";
import { writeFileDurably } from "./legacy_files_shim";
import type { SyncCommand } from "../record_store/sync_types";
import { fsyncDir } from "./legacy_files_shim";
import type { PushResponse, PushResultItem } from "./push";
import { squashUnsent } from "./outbox_squash";

export type OutboxEntry = SyncCommand & {
  commandId: string;
  baseSeq: number;
  createdAt: string;
  mapName?: string;
  issuer?: string;
  /** false is durable proof of never being sent; absent legacy values are unknown. */
  attempted?: boolean;
};

export interface OutboxRejection {
  entry: OutboxEntry;
  code?: string;
  message?: string;
}

export interface DrainReport {
  rejected: OutboxRejection[];
}

function isEntry(value: unknown): value is OutboxEntry {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Partial<OutboxEntry>;
  return typeof row.commandId === "string" && typeof row.mapId === "string"
    && typeof row.baseSeq === "number" && typeof row.createdAt === "string"
    && typeof row.command === "object" && row.command !== null;
}

export class DeviceOutbox {
  private constructor(private readonly filePath: string) {}

  static open(filePath: string): DeviceOutbox {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(filePath)) {
      const fd = fs.openSync(filePath, "w");
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fsyncDir(dir);
    }
    readDurableLines<OutboxEntry>(filePath, isEntry, true);
    return new DeviceOutbox(filePath);
  }

  /** Append one Command and fsync it. Returns only after the line is durable. */
  append(input: SyncCommand & { commandId: string; baseSeq: number; createdAt?: string; issuer?: string; mapName?: string }): OutboxEntry {
    if (!input.commandId.trim()) throw new Error("commandId is required.");
    if (!input.mapId.trim()) throw new Error("mapId is required.");
    if (!Number.isInteger(input.baseSeq) || input.baseSeq < 0) throw new Error("baseSeq must be a non-negative integer.");
    const entry: OutboxEntry = { ...input, attempted: false, createdAt: input.createdAt ?? new Date().toISOString() };
    appendJsonLine(this.filePath, entry);
    return entry;
  }

  /** Entries still waiting, oldest first. A torn last line is dropped. */
  list(): OutboxEntry[] {
    return readDurableLines<OutboxEntry>(this.filePath, isEntry);
  }

  squash(protectedIds: ReadonlySet<string> = new Set()): boolean {
    const before = this.list();
    const after = squashUnsent(before, protectedIds);
    if (before.length === after.length && before.every((entry, i) => entry === after[i])) return false;
    writeFileDurably(this.filePath, after.map((entry) => JSON.stringify(entry) + "\n").join(""));
    return true;
  }

  /** Freeze the complete push selection before any network I/O, once per push (O(pending)). */
  markAttempted(commandIds: ReadonlySet<string>): void {
    const entries = this.list();
    let changed = false;
    for (const entry of entries) if (commandIds.has(entry.commandId) && entry.attempted === false) {
      entry.attempted = true;
      changed = true;
    }
    if (changed) writeFileDurably(this.filePath, entries.map((entry) => JSON.stringify(entry) + "\n").join(""));
  }

  /**
   * Push the waiting Commands in order. Remove each one the remote committed,
   * duplicated, or rejected. Anything still unknown stays in the file.
   */
  async drain(send: (entries: OutboxEntry[]) => Promise<PushResponse>): Promise<DrainReport> {
    this.squash();
    const pending = this.list();
    if (pending.length === 0) return { rejected: [] };
    this.markAttempted(new Set(pending.map((entry) => entry.commandId)));
    const response = await send(pending);
    if (!response || !Array.isArray(response.results)) throw new Error("The push response has no results.");
    const { rejected, done } = settlePushResults(pending, response.results);
    this.remove(done);
    return { rejected };
  }

  remove(commandIds: ReadonlySet<string>): void {
    if (commandIds.size === 0) return;
    const waiting = this.list().filter((entry) => !commandIds.has(entry.commandId));
    writeFileDurably(this.filePath, waiting.map((entry) => JSON.stringify(entry) + "\n").join(""));
  }
}

export function settlePushResults(pending: OutboxEntry[], results: PushResultItem[]): {
  rejected: OutboxRejection[];
  done: Set<string>;
  committed: number;
  noOp: number;
} {
    const rejected: OutboxRejection[] = [];
    const done = new Set<string>();
    let committed = 0;
    let noOp = 0;
  for (let i = 0; i < pending.length; i += 1) {
    const entry = pending[i]!;
    const result = results[i];
    if (!result || result.commandId !== entry.commandId) continue;
    if (result.status === "rejected" || result.status === "conflict") {
      rejected.push({ entry, code: result.code, message: result.message });
    } else if (result.status === "committed" || result.status === "duplicate") {
      committed += 1;
    } else if (result.status === "no-op") {
      noOp += 1;
    } else continue;
    done.add(entry.commandId);
  }
  return { rejected, done, committed, noOp };
}

/** Recover a torn tail before any new append; damage before the tail is an error. */
export function readDurableLines<T>(file: string, valid: (row: unknown) => boolean = () => true, repair = false): T[] {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  const rows: T[] = [];
  let position = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.trim() !== "") {
      try {
        const value = JSON.parse(line) as T;
        if (!valid(value)) throw new Error("Invalid JSON Lines entry.");
        rows.push(value);
      } catch (error) {
        if (i < lines.length - 1 || !repair) throw error;
        if (repair) writeFileDurably(file, text.slice(0, position));
        return rows;
      }
    }
    position += line.length + 1;
  }
  if (repair && text !== "" && !text.endsWith("\n")) writeFileDurably(file, text + "\n");
  return rows;
}

export function appendJsonLine(file: string, value: unknown): void {
  const fd = fs.openSync(file, "a+");
  const original = fs.fstatSync(fd).size;
  try {
    const buffer = Buffer.from(JSON.stringify(value) + "\n", "utf8");
    let offset = 0;
    while (offset < buffer.length) offset += fs.writeSync(fd, buffer, offset, buffer.length - offset);
    fs.fsyncSync(fd);
  } catch (error) {
    fs.ftruncateSync(fd, original);
    throw error;
  } finally {
    fs.closeSync(fd);
  }
  fsyncDir(path.dirname(file));
}

export function pushEnvelope({ commandId, baseSeq, createdAt: _at, issuer: _issuer, mapName: _name, attempted: _attempted, ...payload }: OutboxEntry) {
  return { commandId, baseSeq, ...payload };
}

/** Push the outbox at `outboxPath` to a server's `/api/sync/push`, in order. */
export async function pushOutboxFile(outboxPath: string, serverBase: string, headers: Record<string, string> = {}): Promise<DrainReport> {
  const outbox = DeviceOutbox.open(outboxPath);
  return outbox.drain(async (entries) => {
    const response = await fetch(new URL("/api/sync/push", serverBase), {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({
        commands: entries.map(pushEnvelope),
      }),
    });
    const text = await response.text();
    let body: PushResponse;
    try {
      body = JSON.parse(text) as PushResponse;
    } catch {
      throw new Error(`The push response was not JSON (${response.status}).`);
    }
    if (!response.ok) throw new Error(`The push failed (${response.status}).`);
    return body;
  });
}
