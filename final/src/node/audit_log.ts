"use strict";

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OperationType = "add" | "edit" | "delete" | "move";

export interface AuditEntry {
  timestamp: string;       // ISO 8601
  userId: string;          // entityId or display name
  operationType: OperationType;
  targetNodeId: string;
  details: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Ring buffer (in-memory, last N entries)
// ---------------------------------------------------------------------------

const DEFAULT_BUFFER_SIZE = 500;

let buffer: AuditEntry[] = [];
let bufferMaxSize = DEFAULT_BUFFER_SIZE;

export function setBufferSize(size: number): void {
  bufferMaxSize = Math.max(1, size);
  if (buffer.length > bufferMaxSize) {
    buffer = buffer.slice(buffer.length - bufferMaxSize);
  }
}

export function getBufferSize(): number {
  return bufferMaxSize;
}

// ---------------------------------------------------------------------------
// File persistence (JSON Lines)
// ---------------------------------------------------------------------------

let logFilePath: string | null = null;
let logStream: fs.WriteStream | null = null;

export function initAuditFile(dataDir: string, mapId: string): void {
  const safeDocId = mapId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const auditDir = path.join(dataDir, "audit");
  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }
  logFilePath = path.join(auditDir, `${safeDocId}.jsonl`);
  // Open in append mode
  logStream = fs.createWriteStream(logFilePath, { flags: "a", encoding: "utf8" });
}

export function closeAuditFile(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
  logFilePath = null;
}

// ---------------------------------------------------------------------------
// Core: record an entry
// ---------------------------------------------------------------------------

export function recordAudit(entry: Omit<AuditEntry, "timestamp">): AuditEntry {
  const full: AuditEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  // Ring buffer push
  buffer.push(full);
  if (buffer.length > bufferMaxSize) {
    buffer.shift();
  }

  // File append (fire-and-forget)
  if (logStream && !logStream.destroyed) {
    logStream.write(JSON.stringify(full) + "\n");
  }

  return full;
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export function getRecentAuditEntries(limit?: number): AuditEntry[] {
  const n = limit ?? 100;
  if (n >= buffer.length) {
    return [...buffer];
  }
  return buffer.slice(buffer.length - n);
}

export function getAuditEntriesForNode(targetNodeId: string, limit?: number): AuditEntry[] {
  const filtered = buffer.filter((e) => e.targetNodeId === targetNodeId);
  const n = limit ?? 100;
  if (n >= filtered.length) {
    return filtered;
  }
  return filtered.slice(filtered.length - n);
}

// ---------------------------------------------------------------------------
// Reset (for testing)
// ---------------------------------------------------------------------------

export function resetAuditLog(): void {
  buffer = [];
  closeAuditFile();
}
