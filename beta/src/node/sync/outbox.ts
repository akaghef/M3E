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
import type { MapCommand } from "../../shared/map_changes";
import { fsyncDir } from "../record_store/journal_archive";
import type { PushResponse, PushResultItem } from "./push";

export interface OutboxEntry {
  commandId: string;
  baseSeq: number;
  command: MapCommand;
  createdAt: string;
  mapId: string;
}

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
    return new DeviceOutbox(filePath);
  }

  /** Append one Command and fsync it. Returns only after the line is durable. */
  append(input: { commandId: string; baseSeq: number; command: MapCommand; mapId: string; createdAt?: string }): OutboxEntry {
    if (!input.commandId.trim()) throw new Error("commandId is required.");
    if (!input.mapId.trim()) throw new Error("mapId is required.");
    if (!Number.isInteger(input.baseSeq) || input.baseSeq < 0) throw new Error("baseSeq must be a non-negative integer.");
    const entry: OutboxEntry = {
      commandId: input.commandId,
      baseSeq: input.baseSeq,
      command: input.command,
      mapId: input.mapId,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    const fd = fs.openSync(this.filePath, "a");
    try {
      fs.writeSync(fd, `${JSON.stringify(entry)}\n`);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fsyncDir(path.dirname(this.filePath));
    return entry;
  }

  /** Entries still waiting, oldest first. A torn last line is dropped. */
  list(): OutboxEntry[] {
    const text = fs.readFileSync(this.filePath, "utf8");
    const parts = text.split("\n");
    const out: OutboxEntry[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const line = parts[i] ?? "";
      if (line.trim() === "") continue;
      try {
        const value = JSON.parse(line) as unknown;
        if (!isEntry(value)) throw new Error("not an outbox entry");
        out.push(value);
      } catch (error) {
        const rest = parts.slice(i + 1).some((item) => item.trim() !== "");
        if (rest) throw error;
        break;
      }
    }
    return out;
  }

  /**
   * Push the waiting Commands in order. Remove each one the remote committed,
   * duplicated, or rejected. Anything still unknown stays in the file.
   */
  async drain(send: (entries: OutboxEntry[]) => Promise<PushResponse>): Promise<DrainReport> {
    const pending = this.list();
    if (pending.length === 0) return { rejected: [] };
    const response = await send(pending);
    if (!response || !Array.isArray(response.results)) throw new Error("The push response has no results.");
    const rejected: OutboxRejection[] = [];
    const keep: OutboxEntry[] = [];
    for (let i = 0; i < pending.length; i += 1) {
      const entry = pending[i]!;
      const result: PushResultItem | undefined = response.results[i];
      if (!result || result.commandId !== entry.commandId) {
        keep.push(entry);
        continue;
      }
      if (result.status === "rejected") {
        rejected.push({ entry, code: result.code, message: result.message });
        continue;
      }
      if (result.status !== "committed" && result.status !== "duplicate") keep.push(entry);
    }
    this.replace(keep);
    return { rejected };
  }

  private replace(entries: OutboxEntry[]): void {
    const dir = path.dirname(this.filePath);
    const tmp = `${this.filePath}.tmp`;
    const body = entries.map((entry) => JSON.stringify(entry)).join("\n") + (entries.length > 0 ? "\n" : "");
    const fd = fs.openSync(tmp, "w");
    try {
      fs.writeSync(fd, body);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, this.filePath);
    fsyncDir(dir);
  }
}

/** Push the outbox at `outboxPath` to a server's `/api/sync/push`, in order. */
export async function pushOutboxFile(outboxPath: string, serverBase: string, headers: Record<string, string> = {}): Promise<DrainReport> {
  const outbox = DeviceOutbox.open(outboxPath);
  return outbox.drain(async (entries) => {
    const response = await fetch(new URL("/api/sync/push", serverBase), {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({
        commands: entries.map((entry) => ({
          commandId: entry.commandId,
          mapId: entry.mapId,
          baseSeq: entry.baseSeq,
          command: entry.command,
        })),
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
