"use strict";

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { activeRecordStore } from "./record_store/active";
import { COMMIT_INDEX_FILE, JOURNAL_FILE, SNAPSHOT_FILE } from "./record_store/store";

/**
 * SQLite snapshot backup module.
 *
 * Primary strategy: better-sqlite3 `.backup()` API (online-safe).
 * Fallback: `fs.copyFileSync()` when `.backup()` is unavailable.
 *
 * Design ref: docs/design/data_import_export.md section 2.e
 */

const BACKUP_SUFFIX = ".sqlite";
/** Record store backups are directories: `M3E_records_<YYYYMMDD_HHmmss>` (a `_<n>` follows when the name is taken). */
const RECORD_BACKUP_PREFIX = "M3E_records_";
const RECORD_BACKUP_PATTERN = /^M3E_records_\d{8}_\d{6}(_\d+)?$/;
const RECORD_BACKUP_FILES = new Set([SNAPSHOT_FILE, JOURNAL_FILE, COMMIT_INDEX_FILE]);

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_MAX_GENERATIONS = 10;

function formatTimestamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}${m}${d}_${hh}${mm}${ss}`;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Create a snapshot backup of the SQLite database.
 *
 * Returns the absolute path of the created backup file.
 * Throws only if both primary and fallback strategies fail.
 */
export async function createBackup(dbPath: string, backupDir: string): Promise<string> {
  const store = activeRecordStore();
  if (store) {
    // Record store (M3E_STORE_DIR): the maps are in its snapshot and journal, not in the SQLite file.
    // The store copies the pair in one step, so the copy is one consistent commit.
    ensureDir(backupDir);
    const base = path.join(backupDir, `${RECORD_BACKUP_PREFIX}${formatTimestamp(new Date())}`);
    let target = base;
    for (let n = 2; fs.existsSync(target); n += 1) target = `${base}_${n}`;
    const files = store.backupTo(target);
    console.log(`[backup] Created: ${target} (${files.join(", ")}) at commit ${store.seq()}`);
    return target;
  }
  ensureDir(backupDir);

  const timestamp = formatTimestamp(new Date());
  const backupName = `M3E_dataV1_${timestamp}${BACKUP_SUFFIX}`;
  const backupPath = path.join(backupDir, backupName);

  // Strategy A: better-sqlite3 .backup() — online-safe, no WAL issues
  let usedFallback = false;
  try {
    const db = new Database(dbPath, { readonly: true });
    try {
      await db.backup(backupPath);
    } finally {
      db.close();
    }
  } catch (primaryErr) {
    // Fallback: fs.copyFileSync — acceptable when DB is not being written
    usedFallback = true;
    try {
      fs.copyFileSync(dbPath, backupPath);
    } catch (fallbackErr) {
      throw new Error(
        `Backup failed. Primary: ${(primaryErr as Error).message}; Fallback: ${(fallbackErr as Error).message}`,
      );
    }
  }

  const method = usedFallback ? "fs.copyFileSync (fallback)" : "better-sqlite3 .backup()";
  console.log(`[backup] Created: ${backupPath} via ${method}`);
  return backupPath;
}

/**
 * Delete old backup files exceeding `maxGenerations`, oldest first (FIFO).
 */
export function pruneOldBackups(backupDir: string, maxGenerations: number): void {
  if (!fs.existsSync(backupDir)) {
    return;
  }

  const files = fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith(BACKUP_SUFFIX) && /^.+_\d{8}_\d{6}\.sqlite$/.test(name))
    .sort(); // lexicographic sort = chronological for YYYYMMDD_HHmmss

  pruneOldRecordBackups(backupDir, maxGenerations);

  const excess = files.length - maxGenerations;
  if (excess <= 0) {
    return;
  }

  const toDelete = files.slice(0, excess);
  for (const name of toDelete) {
    const fullPath = path.join(backupDir, name);
    try {
      fs.unlinkSync(fullPath);
      console.log(`[backup] Pruned old backup: ${name}`);
    } catch (err) {
      console.error(`[backup] Failed to prune ${name}: ${(err as Error).message}`);
    }
  }
}

/**
 * The same for record store backups (directories). Only the files a backup is made of are
 * removed; a directory that holds anything else is left as it is.
 */
function pruneOldRecordBackups(backupDir: string, maxGenerations: number): void {
  const byTime = (name: string): string => name.replace(/^(M3E_records_\d{8}_\d{6})(?:_(\d+))?$/, (_all, stamp: string, n?: string) => `${stamp}_${(n ?? "1").padStart(6, "0")}`);
  const dirs = fs
    .readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && RECORD_BACKUP_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => (byTime(a) < byTime(b) ? -1 : byTime(a) > byTime(b) ? 1 : 0));
  for (const name of dirs.slice(0, Math.max(0, dirs.length - maxGenerations))) {
    const fullPath = path.join(backupDir, name);
    try {
      const content = fs.readdirSync(fullPath);
      if (content.some((file) => !RECORD_BACKUP_FILES.has(file))) {
        console.error(`[backup] Not pruned (holds other files): ${name}`);
        continue;
      }
      for (const file of content) fs.unlinkSync(path.join(fullPath, file));
      fs.rmdirSync(fullPath);
      console.log(`[backup] Pruned old backup: ${name}`);
    } catch (err) {
      console.error(`[backup] Failed to prune ${name}: ${(err as Error).message}`);
    }
  }
}

let autoBackupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic automatic backups.
 *
 * - Runs `createBackup` followed by `pruneOldBackups` at each interval.
 * - Failures are logged but never crash the server.
 */
export function startAutoBackup(
  dbPath: string,
  backupDir: string,
  intervalMs?: number,
  maxGenerations?: number,
): void {
  const interval = intervalMs ?? (Number(process.env.M3E_BACKUP_INTERVAL_MS) || DEFAULT_INTERVAL_MS);
  const maxGen = maxGenerations ?? (Number(process.env.M3E_BACKUP_MAX_GENERATIONS) || DEFAULT_MAX_GENERATIONS);

  // Clear any existing timer to avoid duplicates
  stopAutoBackup();

  console.log(`[backup] Auto-backup every ${interval / 1000}s, keeping ${maxGen} generations`);

  autoBackupTimer = setInterval(() => {
    createBackup(dbPath, backupDir)
      .then(() => {
        pruneOldBackups(backupDir, maxGen);
      })
      .catch((err) => {
        console.error(`[backup] Auto-backup failed: ${(err as Error).message}`);
      });
  }, interval);

  // Allow the Node process to exit even if the timer is still running
  if (autoBackupTimer && typeof autoBackupTimer === "object" && "unref" in autoBackupTimer) {
    autoBackupTimer.unref();
  }
}

/**
 * Stop the periodic backup timer (useful for tests / graceful shutdown).
 */
export function stopAutoBackup(): void {
  if (autoBackupTimer !== null) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
}
