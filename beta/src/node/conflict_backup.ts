"use strict";

import fs from "fs";
import path from "path";
import type { AppState, SavedMap } from "../shared/types";

export interface ConflictBackupEntry {
  backupId: string;
  mapId: string;
  reason: string;
  createdAt: string;
  savedAt: string;
}

export interface ConflictBackupFull extends ConflictBackupEntry {
  version: 1;
  state: AppState;
}

const MAX_BACKUPS_PER_DOC = 10;

function backupDir(dataDir: string): string {
  return path.join(dataDir, "conflict-backups");
}

function ensureBackupDir(dataDir: string): void {
  const dir = backupDir(dataDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function backupFileName(mapId: string, backupId: string): string {
  const safeDocId = mapId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${safeDocId}_${backupId}.json`;
}

function parseBackupFileName(
  fileName: string,
  mapId: string,
): string | null {
  const safeDocId = mapId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const prefix = `${safeDocId}_`;
  if (!fileName.startsWith(prefix) || !fileName.endsWith(".json")) {
    return null;
  }
  return fileName.slice(prefix.length, -5);
}

function generateBackupId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, -1);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}_${rand}`;
}

/**
 * Save a conflict backup of the local state before it is overwritten.
 */
export function createConflictBackup(
  dataDir: string,
  mapId: string,
  localState: AppState,
  reason: string,
): ConflictBackupEntry {
  ensureBackupDir(dataDir);

  const backupId = generateBackupId();
  const now = new Date().toISOString();

  const entry: ConflictBackupFull = {
    version: 1,
    backupId,
    mapId,
    reason,
    createdAt: now,
    savedAt: now,
    state: localState,
  };

  const filePath = path.join(backupDir(dataDir), backupFileName(mapId, backupId));
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf8");

  // Enforce max backups per map
  pruneOldBackups(dataDir, mapId);

  return {
    backupId: entry.backupId,
    mapId: entry.mapId,
    reason: entry.reason,
    createdAt: entry.createdAt,
    savedAt: entry.savedAt,
  };
}

/**
 * List all conflict backups for a map, newest first.
 */
export function listConflictBackups(
  dataDir: string,
  mapId: string,
): ConflictBackupEntry[] {
  const dir = backupDir(dataDir);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir);
  const entries: ConflictBackupEntry[] = [];

  for (const file of files) {
    const bid = parseBackupFileName(file, mapId);
    if (!bid) continue;

    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const parsed = JSON.parse(raw) as ConflictBackupFull;
      if (parsed.version === 1 && parsed.mapId === mapId) {
        entries.push({
          backupId: parsed.backupId,
          mapId: parsed.mapId,
          reason: parsed.reason,
          createdAt: parsed.createdAt,
          savedAt: parsed.savedAt,
        });
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Sort newest first
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries;
}

/**
 * Get a single conflict backup with full state.
 */
export function getConflictBackup(
  dataDir: string,
  mapId: string,
  backupId: string,
): ConflictBackupFull | null {
  const dir = backupDir(dataDir);
  const filePath = path.join(dir, backupFileName(mapId, backupId));
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as ConflictBackupFull;
    if (parsed.version === 1 && parsed.mapId === mapId) {
      return parsed;
    }
  } catch {
    // Invalid backup
  }
  return null;
}

/**
 * Delete a conflict backup.
 */
export function deleteConflictBackup(
  dataDir: string,
  mapId: string,
  backupId: string,
): boolean {
  const dir = backupDir(dataDir);
  const filePath = path.join(dir, backupFileName(mapId, backupId));
  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

/**
 * Remove oldest backups when count exceeds MAX_BACKUPS_PER_DOC.
 */
function pruneOldBackups(dataDir: string, mapId: string): void {
  const entries = listConflictBackups(dataDir, mapId);
  if (entries.length <= MAX_BACKUPS_PER_DOC) {
    return;
  }

  // entries is sorted newest first; remove from the end
  const toRemove = entries.slice(MAX_BACKUPS_PER_DOC);
  for (const entry of toRemove) {
    deleteConflictBackup(dataDir, mapId, entry.backupId);
  }
}
