"use strict";

import fs from "fs";
import path from "path";
import { exportVaultFromSqlite } from "./vault_exporter";
import { importVaultToSqlite } from "./vault_importer";
import type {
  VaultWatchEvent,
  VaultWatchStartRequest,
  VaultWatchStatus,
} from "../shared/types";

type WatchSession = {
  watcher: fs.FSWatcher;
  documentId: string;
  vaultPath: string;
  modelAlias?: string | null;
  debounceMs: number;
  importOptions?: VaultWatchStartRequest["importOptions"];
  exportOptions?: VaultWatchStartRequest["exportOptions"];
  inboundTimer: NodeJS.Timeout | null;
  outboundTimer: NodeJS.Timeout | null;
  suppressEventsUntil: number;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
};

const sessions = new Map<string, WatchSession>();
let emitEvent: ((event: VaultWatchEvent) => void) | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function emit(type: VaultWatchEvent["type"], session: WatchSession, detail?: string): void {
  emitEvent?.({
    type,
    documentId: session.documentId,
    vaultPath: session.vaultPath,
    timestamp: nowIso(),
    detail,
  });
}

function isMarkdownFile(filename: string | null | undefined): boolean {
  return Boolean(filename && filename.toLowerCase().endsWith(".md"));
}

async function runInboundSync(dbPath: string, session: WatchSession): Promise<void> {
  try {
    await importVaultToSqlite(dbPath, {
      vaultPath: session.vaultPath,
      documentId: session.documentId,
      modelAlias: session.modelAlias ?? null,
      options: session.importOptions,
    });
    session.lastInboundAt = nowIso();
    emit("vault-to-m3e", session, "Vault change imported.");
  } catch (err) {
    session.lastError = (err as Error).message || "Inbound sync failed.";
    emit("watch-error", session, session.lastError);
  }
}

async function runOutboundSync(dbPath: string, session: WatchSession): Promise<void> {
  try {
    session.suppressEventsUntil = Date.now() + Math.max(2_000, session.debounceMs * 2);
    await exportVaultFromSqlite(dbPath, {
      documentId: session.documentId,
      vaultPath: session.vaultPath,
      modelAlias: session.modelAlias ?? null,
      options: session.exportOptions,
    });
    session.lastOutboundAt = nowIso();
    emit("m3e-to-vault", session, "Document saved back to vault.");
  } catch (err) {
    session.lastError = (err as Error).message || "Outbound sync failed.";
    emit("watch-error", session, session.lastError);
  }
}

export function configureVaultWatchEmitter(handler: (event: VaultWatchEvent) => void): void {
  emitEvent = handler;
}

export function startVaultWatch(dbPath: string, request: VaultWatchStartRequest): VaultWatchStatus {
  if (!request.documentId?.trim()) {
    throw new Error("documentId is required.");
  }
  if (!request.vaultPath || !path.isAbsolute(request.vaultPath)) {
    throw new Error("vaultPath must be an absolute path.");
  }

  stopVaultWatch(request.documentId);

  const debounceMs = Math.max(250, request.debounceMs ?? 1000);
  const watcher = fs.watch(request.vaultPath, { recursive: true }, (_eventType, filename) => {
    const session = sessions.get(request.documentId);
    if (!session || !isMarkdownFile(filename)) {
      return;
    }
    if (Date.now() < session.suppressEventsUntil) {
      return;
    }
    if (session.inboundTimer) {
      clearTimeout(session.inboundTimer);
    }
    session.inboundTimer = setTimeout(() => {
      session.inboundTimer = null;
      void runInboundSync(dbPath, session);
    }, debounceMs);
  });

  const session: WatchSession = {
    watcher,
    documentId: request.documentId,
    vaultPath: path.resolve(request.vaultPath),
    modelAlias: request.modelAlias ?? null,
    debounceMs,
    importOptions: request.importOptions,
    exportOptions: request.exportOptions,
    inboundTimer: null,
    outboundTimer: null,
    suppressEventsUntil: 0,
    lastInboundAt: null,
    lastOutboundAt: null,
    lastError: null,
  };
  sessions.set(request.documentId, session);
  emit("watch-started", session, "Vault watch started.");
  return getVaultWatchStatus(request.documentId)!;
}

export function stopVaultWatch(documentId: string): VaultWatchStatus | null {
  const session = sessions.get(documentId);
  if (!session) {
    return null;
  }
  if (session.inboundTimer) {
    clearTimeout(session.inboundTimer);
  }
  if (session.outboundTimer) {
    clearTimeout(session.outboundTimer);
  }
  session.watcher.close();
  sessions.delete(documentId);
  emit("watch-stopped", session, "Vault watch stopped.");
  return {
    ok: true,
    documentId,
    vaultPath: session.vaultPath,
    running: false,
    lastInboundAt: session.lastInboundAt,
    lastOutboundAt: session.lastOutboundAt,
    lastError: session.lastError,
  };
}

export function handleDocumentSavedForVaultWatch(dbPath: string, documentId: string): void {
  const session = sessions.get(documentId);
  if (!session) {
    return;
  }
  if (session.outboundTimer) {
    clearTimeout(session.outboundTimer);
  }
  session.outboundTimer = setTimeout(() => {
    session.outboundTimer = null;
    void runOutboundSync(dbPath, session);
  }, session.debounceMs);
}

export function getVaultWatchStatus(documentId: string): VaultWatchStatus | null {
  const session = sessions.get(documentId);
  if (!session) {
    return null;
  }
  return {
    ok: true,
    documentId: session.documentId,
    vaultPath: session.vaultPath,
    running: true,
    lastInboundAt: session.lastInboundAt,
    lastOutboundAt: session.lastOutboundAt,
    lastError: session.lastError,
  };
}

export function listVaultWatchStatuses(): VaultWatchStatus[] {
  return [...sessions.values()].map((session) => ({
    ok: true,
    documentId: session.documentId,
    vaultPath: session.vaultPath,
    running: true,
    lastInboundAt: session.lastInboundAt,
    lastOutboundAt: session.lastOutboundAt,
    lastError: session.lastError,
  }));
}
