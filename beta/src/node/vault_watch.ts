"use strict";

import fs from "fs";
import path from "path";
import { exportVaultFromSqlite } from "./vault_exporter";
import { importVaultToSqlite } from "./vault_importer";
import { RapidMvpModel } from "./rapid_mvp";
import { validateVaultPath } from "./vault_path";
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
  pendingRelativePaths: Set<string>;
  suppressEventsUntil: number;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
};

const sessions = new Map<string, WatchSession>();
let emitEvent: ((event: VaultWatchEvent) => void) | null = null;
let emitDocUpdate: ((documentId: string, savedAt: string) => void) | null = null;

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
    const result = await importVaultToSqlite(dbPath, {
      vaultPath: session.vaultPath,
      documentId: session.documentId,
      modelAlias: session.modelAlias ?? null,
      options: session.importOptions,
    });
    session.lastInboundAt = result.savedAt;
    emitDocUpdate?.(session.documentId, result.savedAt);
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

export function configureVaultWatchDocUpdateEmitter(handler: (documentId: string, savedAt: string) => void): void {
  emitDocUpdate = handler;
}

export function startVaultWatch(dbPath: string, request: VaultWatchStartRequest): VaultWatchStatus {
  if (!request.documentId?.trim()) {
    throw new Error("documentId is required.");
  }
  const vaultPath = validateVaultPath(request.vaultPath, { mustExist: true });

  stopVaultWatch(request.documentId);

  const debounceMs = Math.max(250, request.debounceMs ?? 1000);
  const watcher = fs.watch(vaultPath, { recursive: true }, (_eventType, filename) => {
    const session = sessions.get(request.documentId);
    if (!session || !isMarkdownFile(filename)) {
      return;
    }
    if (Date.now() < session.suppressEventsUntil) {
      return;
    }
    session.pendingRelativePaths.add(String(filename).replace(/\\/g, "/"));
    if (session.inboundTimer) {
      clearTimeout(session.inboundTimer);
    }
    session.inboundTimer = setTimeout(() => {
      session.inboundTimer = null;
      void processPendingVaultChanges(dbPath, session);
    }, debounceMs);
  });

  const session: WatchSession = {
    watcher,
    documentId: request.documentId,
    vaultPath,
    modelAlias: request.modelAlias ?? null,
    debounceMs,
    importOptions: request.importOptions,
    exportOptions: request.exportOptions,
    inboundTimer: null,
    outboundTimer: null,
    pendingRelativePaths: new Set<string>(),
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

async function processPendingVaultChanges(dbPath: string, session: WatchSession): Promise<void> {
  const relativePaths = [...session.pendingRelativePaths];
  session.pendingRelativePaths.clear();
  if (relativePaths.length === 0) {
    return;
  }

  const deletedPaths = relativePaths.filter((relativePath) => !fs.existsSync(path.join(session.vaultPath, relativePath)));
  const changedPaths = relativePaths.filter((relativePath) => !deletedPaths.includes(relativePath));

  if (deletedPaths.length > 0) {
    const savedAt = softDeleteMissingVaultFiles(dbPath, session.documentId, deletedPaths);
    if (savedAt) {
      session.lastInboundAt = savedAt;
      emitDocUpdate?.(session.documentId, savedAt);
      emit("vault-to-m3e", session, `Vault deletion synced (${deletedPaths.length} file(s) kept as missing placeholders).`);
    }
  }

  if (changedPaths.length > 0) {
    await runInboundSync(dbPath, session);
  }
}

function softDeleteMissingVaultFiles(dbPath: string, documentId: string, relativePaths: string[]): string | null {
  const normalizedTargets = new Set(relativePaths.map((relativePath) => relativePath.replace(/\\/g, "/")));
  const model = RapidMvpModel.loadFromSqlite(dbPath, documentId);
  let changed = false;
  const missingAt = nowIso();
  const byPath = new Map<string, typeof model.state.nodes[string]>();
  const byBaseName = new Map<string, Array<typeof model.state.nodes[string]>>();

  Object.values(model.state.nodes).forEach((node) => {
    if (node.attributes["vault:kind"] !== "file") {
      return;
    }
    const relativePath = node.attributes["vault:path"];
    if (relativePath) {
      byPath.set(relativePath, node);
      const baseName = path.posix.basename(relativePath);
      const bucket = byBaseName.get(baseName) ?? [];
      bucket.push(node);
      byBaseName.set(baseName, bucket);
    }
  });

  normalizedTargets.forEach((targetPath) => {
    const exact = byPath.get(targetPath);
    const fallbackCandidates = byBaseName.get(path.posix.basename(targetPath)) ?? [];
    const matchedNode = exact ?? (fallbackCandidates.length === 1 ? fallbackCandidates[0]! : null);
    if (!matchedNode) {
      return;
    }
    const relativePath = matchedNode.attributes["vault:path"] || targetPath;
    const node = matchedNode;
    node.attributes["vault:status"] = "missing";
    node.attributes["vault:missingAt"] = missingAt;
    if (!node.details.includes("Vault file deleted externally.")) {
      node.details = node.details
        ? `Vault file deleted externally.\nOriginal path: ${relativePath}\n\n${node.details}`
        : `Vault file deleted externally.\nOriginal path: ${relativePath}`;
    }
    changed = true;

    Object.values(model.state.nodes).forEach((candidate) => {
      if (candidate.nodeType !== "alias" || candidate.targetNodeId !== node.id) {
        return;
      }
      candidate.isBroken = true;
      candidate.targetSnapshotLabel = candidate.targetSnapshotLabel || node.text;
      candidate.text = `${candidate.targetSnapshotLabel} (deleted)`;
      candidate.targetNodeId = `missing:${node.id}`;
    });
  });

  if (!changed) {
    return null;
  }

  model.saveToSqlite(dbPath, documentId);
  return RapidMvpModel.loadSavedDocFromSqlite(dbPath, documentId).savedAt;
}
