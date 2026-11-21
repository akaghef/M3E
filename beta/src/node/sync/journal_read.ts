/**
 * Journal suffix for pull, from the hot journal and the archive.
 * A seq the files no longer hold answers `reclone`: the device takes the portable snapshot.
 * Disclosure rights are not applied; the implementation log records that gap.
 */
import fs from "fs";
import path from "path";
import { SNAPSHOT_FILE, JOURNAL_FILE, type JournalLine } from "../record_store/store";
import { archiveDir, readArchive } from "../record_store/journal_archive";

export interface JournalSuffix {
  lines: JournalLine[];
  throughSeq: number;
}

export interface Reclone {
  reclone: true;
  snapshotSeq: number;
}

function readJsonl(file: string): unknown[] {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  const parts = text.split("\n");
  const out: unknown[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const line = parts[i] ?? "";
    if (line.trim() === "") continue;
    try {
      out.push(JSON.parse(line) as unknown);
    } catch {
      const rest = parts.slice(i + 1).some((item) => item.trim() !== "");
      if (rest) throw new Error(`The journal is damaged before its last line: ${file}`);
      break;
    }
  }
  return out;
}

function asJournalLine(value: unknown): JournalLine | null {
  if (typeof value !== "object" || value === null) return null;
  const seq = (value as { seq?: unknown }).seq;
  if (!Number.isInteger(seq)) return null;
  return value as JournalLine;
}

/**
 * Lines with seq in (after, currentSeq]. `scope` is accepted and not applied:
 * scope disclosure is not modelled on the store.
 */
export function pullSince(storeDir: string, after: number, currentSeq: number, scope?: string): JournalSuffix | Reclone {
  void scope;
  if (after > currentSeq) return { reclone: true, snapshotSeq: currentSeq };
  const found = new Map<number, JournalLine>();
  const take = (value: unknown): void => {
    const line = asJournalLine(value);
    if (!line) return;
    if (line.seq > after && line.seq <= currentSeq) found.set(line.seq, line);
  };
  for (const archived of readArchive(storeDir, new Date().toISOString())) {
    if (archived.kind !== "journal" || archived.toSeq <= after || archived.fromSeq > currentSeq) continue;
    for (const value of readJsonl(path.join(archiveDir(storeDir), archived.file))) take(value);
  }
  for (const value of readJsonl(path.join(storeDir, JOURNAL_FILE))) take(value);
  const lines: JournalLine[] = [];
  for (let seq = after + 1; seq <= currentSeq; seq += 1) {
    const line = found.get(seq);
    if (!line) return { reclone: true, snapshotSeq: currentSeq };
    lines.push(line);
  }
  return { lines, throughSeq: currentSeq };
}

export function snapshotHeaderSeq(storeDir: string): number {
  const first = readJsonl(path.join(storeDir, SNAPSHOT_FILE))[0];
  const seq = typeof first === "object" && first !== null ? (first as { seq?: unknown }).seq : undefined;
  return Number.isInteger(seq) ? (seq as number) : 0;
}
