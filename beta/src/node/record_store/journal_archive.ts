// The journal archive and the `touched` field of journal lines.
//
// Compaction does not discard journal lines: the journal file is hard-linked (copied where links
// are not available) into `archive/` before a new snapshot replaces it, and so is the snapshot it
// replaces. `archive/index.json` says when each file was archived. A retention pass deletes
// archived files older than the retention period (90 days), and only when the current snapshot,
// which covers them, is fsynced and matches the checksum recorded when it was written; any problem
// stops the pass before anything is deleted.
//
// `touched` lists the records whose canonical value a commit changed, with the kinds of change.
// The store derives it from the commit's record operations and the records before the commit;
// clients never send it. A change of `rev` alone is not a change.
//
// Specs: Database_Spec.md 6; freeze v1 F1, F2 and the 2026-11-19 revision (90 days).

import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { sameJson } from "../../shared/record_model/steady";
import type { SnapshotRecord } from "../../shared/record_model/types";
import type { RecordOp } from "./engine";

export const ARCHIVE_DIR = "archive";
export const ARCHIVE_INDEX_FILE = "index.json";
/** Archived files are deleted this long after they were archived (akaghef, 2026-11-19). */
export const ARCHIVE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export interface TouchedRecord {
  rk: string;
  /** Kinds of change, prefixed names in string order. Readers ignore kinds they do not know. */
  ev: string[];
}

export interface ArchiveEntry {
  file: string;
  kind: "journal" | "snapshot";
  /** First commit the file holds (journal) or the commit the snapshot ends at (snapshot). */
  fromSeq: number;
  toSeq: number;
  /** Snapshot format the lines were written under. */
  format: number;
  archivedAt: string;
}

export interface PruneResult {
  deleted: string[];
  /** Why nothing was deleted; empty when the pass ran. */
  problems: string[];
}

const JOURNAL_NAME = /^journal\.(\d+)-(\d+)\.f(\d+)\.jsonl$/;
const SNAPSHOT_NAME = /^snapshot\.(\d+)\.f(\d+)\.jsonl$/;

const STRUCTURE_FIELDS: Record<string, ReadonlySet<string>> = {
  connection: new Set(["source", "target", "ord", "scopeId", "type"]),
  scope: new Set(["rootNodeId"]),
};

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/** fsync a directory so that a rename or link in it survives a crash. Not available on every platform. */
export function fsyncDir(dir: string): void {
  let fd: number | undefined;
  try {
    fd = fs.openSync(dir, "r");
    fs.fsyncSync(fd);
  } catch {
    // Windows cannot open a directory for fsync; the rename itself is what the platform offers.
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function fieldsOf(record: SnapshotRecord | undefined): Record<string, unknown> {
  return (record ?? {}) as Record<string, unknown>;
}

/** The kinds of change between two versions of one record; empty when only `rev` differs. */
function changeKinds(before: SnapshotRecord, after: SnapshotRecord): string[] {
  const a = fieldsOf(before);
  const b = fieldsOf(after);
  const kinds = new Set<string>();
  const structure = STRUCTURE_FIELDS[after.kind];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key === "rev") continue;
    if (sameJson(a[key], b[key])) continue;
    if (key === "attributes") kinds.add("m3e:attribute");
    else if (key === "extensions") kinds.add("m3e:extension");
    else if (structure?.has(key)) kinds.add("m3e:structure");
    else kinds.add("m3e:content");
  }
  return [...kinds].sort();
}

/**
 * The records a commit changes. `before` reads the record set as it was before the commit.
 * Sorted by rk; one entry per rk.
 */
export function touchedOf(ops: readonly RecordOp[], before: (rk: string) => SnapshotRecord | undefined): TouchedRecord[] {
  const last = new Map<string, RecordOp>();
  for (const op of ops) last.set(op.rk, op);
  const touched: TouchedRecord[] = [];
  for (const [rk, op] of last) {
    const prior = before(rk);
    let ev: string[];
    if (op.op === "delete") {
      if (prior === undefined) continue;
      ev = ["m3e:delete"];
    } else if (prior === undefined) {
      ev = ["m3e:create"];
    } else {
      ev = changeKinds(prior, op.record as SnapshotRecord);
      if (ev.length === 0) continue;
    }
    touched.push({ rk, ev });
  }
  return touched.sort((x, y) => (x.rk < y.rk ? -1 : x.rk > y.rk ? 1 : 0));
}

export function archiveDir(storeDir: string): string {
  return path.join(storeDir, ARCHIVE_DIR);
}

export function journalArchiveName(fromSeq: number, toSeq: number, format: number): string {
  return `journal.${fromSeq}-${toSeq}.f${format}.jsonl`;
}

export function snapshotArchiveName(seq: number, format: number): string {
  return `snapshot.${seq}.f${format}.jsonl`;
}

function parseName(file: string): Omit<ArchiveEntry, "archivedAt"> | null {
  let match = JOURNAL_NAME.exec(file);
  if (match) return { file, kind: "journal", fromSeq: Number(match[1]), toSeq: Number(match[2]), format: Number(match[3]) };
  match = SNAPSHOT_NAME.exec(file);
  if (match) return { file, kind: "snapshot", fromSeq: Number(match[1]), toSeq: Number(match[1]), format: Number(match[2]) };
  return null;
}

function writeDurably(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, content, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, filePath);
  fsyncDir(path.dirname(filePath));
}

/**
 * The archive's entries. Files the index does not list (an archiving that stopped before the
 * index was written) are listed with `now` as their archive time: later, never earlier.
 */
export function readArchive(storeDir: string, now: string): ArchiveEntry[] {
  const dir = archiveDir(storeDir);
  if (!fs.existsSync(dir)) return [];
  const indexPath = path.join(dir, ARCHIVE_INDEX_FILE);
  const listed = new Map<string, ArchiveEntry>();
  if (fs.existsSync(indexPath)) {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as { entries?: ArchiveEntry[] };
    for (const entry of index.entries ?? []) listed.set(entry.file, entry);
  }
  const entries: ArchiveEntry[] = [];
  for (const file of fs.readdirSync(dir).sort()) {
    const parsed = parseName(file);
    if (!parsed) continue;
    entries.push(listed.get(file) ?? { ...parsed, archivedAt: now });
  }
  return entries.sort((a, b) => a.fromSeq - b.fromSeq || a.toSeq - b.toSeq || (a.kind < b.kind ? -1 : 1));
}

export function writeArchiveIndex(storeDir: string, entries: ArchiveEntry[]): void {
  writeDurably(path.join(archiveDir(storeDir), ARCHIVE_INDEX_FILE), JSON.stringify({ format: 1, entries }, null, 1) + "\n");
}

/**
 * Puts `source` into the archive under `name`: a hard link, or a copy where links are not
 * available. An existing archive file of that name is kept when it has the same content.
 */
export function archiveFile(storeDir: string, source: string, name: string): void {
  const dir = archiveDir(storeDir);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, name);
  if (fs.existsSync(target)) {
    if (sha256(fs.readFileSync(target)) === sha256(fs.readFileSync(source))) return;
    throw new Error(`The archive already holds a different ${name}.`);
  }
  try {
    fs.linkSync(source, target);
  } catch {
    const tmp = `${target}.tmp`;
    fs.copyFileSync(source, tmp);
    const fd = fs.openSync(tmp, "r+");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, target);
  }
  fsyncDir(dir);
}

/** Checks that the current snapshot is on disk and matches the checksum recorded when it was written. */
export function verifySnapshot(snapshotPath: string, expected: { seq: number; sha256: string } | undefined): { seq: number; problems: string[] } {
  const problems: string[] = [];
  if (!expected) return { seq: -1, problems: ["no checksum was recorded for the current snapshot"] };
  let content: Buffer;
  try {
    const fd = fs.openSync(snapshotPath, "r+");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    content = fs.readFileSync(snapshotPath);
  } catch (error) {
    return { seq: -1, problems: [`the snapshot cannot be read: ${(error as Error).message}`] };
  }
  if (sha256(content) !== expected.sha256) problems.push("the snapshot does not match its recorded checksum");
  let seq = -1;
  try {
    const header = JSON.parse(content.toString("utf8", 0, content.indexOf(0x0a) === -1 ? content.length : content.indexOf(0x0a))) as { kind?: string; seq?: number };
    if (header.kind !== "snapshot" || !Number.isInteger(header.seq)) problems.push("the snapshot has no header");
    else seq = header.seq as number;
  } catch {
    problems.push("the snapshot header cannot be read");
  }
  if (seq !== -1 && seq !== expected.seq) problems.push(`the snapshot ends at commit ${seq}, the checksum was recorded for ${expected.seq}`);
  return { seq, problems };
}

/**
 * Deletes archived files older than the retention period. The current snapshot must cover each of
 * them and pass `verifySnapshot`; with any problem, nothing is deleted.
 */
export function pruneArchive(
  storeDir: string,
  snapshotPath: string,
  expected: { seq: number; sha256: string } | undefined,
  options: { now: string; retentionMs?: number },
): PruneResult {
  const retention = options.retentionMs ?? ARCHIVE_RETENTION_MS;
  const now = Date.parse(options.now);
  const entries = readArchive(storeDir, options.now);
  const due = entries.filter((entry) => Date.parse(entry.archivedAt) + retention <= now);
  if (due.length === 0) return { deleted: [], problems: [] };
  const checked = verifySnapshot(snapshotPath, expected);
  const problems = [...checked.problems];
  for (const entry of due) {
    if (checked.seq !== -1 && entry.toSeq > checked.seq) problems.push(`${entry.file} reaches past the snapshot (commit ${checked.seq})`);
  }
  if (problems.length > 0) return { deleted: [], problems };
  const dir = archiveDir(storeDir);
  const deleted: string[] = [];
  for (const entry of due) {
    fs.unlinkSync(path.join(dir, entry.file));
    deleted.push(entry.file);
  }
  fsyncDir(dir);
  writeArchiveIndex(storeDir, entries.filter((entry) => !deleted.includes(entry.file)));
  return { deleted, problems: [] };
}
