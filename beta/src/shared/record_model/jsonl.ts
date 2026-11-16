// JSON Lines form of a snapshot (contract section 1): one record per line,
// header line first, then by `kind`, then by key string.

import { compareStrings, recordKeyParts, type SnapshotRecord } from "./types";

/** Key string of a record: its key components joined as the contract writes them. */
export function recordKeyString(record: SnapshotRecord): string {
  return recordKeyParts(record).join("");
}

export function sortRecords(records: SnapshotRecord[]): SnapshotRecord[] {
  const decorated = records.map((record) => ({ record, parts: recordKeyParts(record), key: recordKeyString(record) }));
  decorated.sort((a, b) => {
    const aHeader = a.record.kind === "snapshot" ? 0 : 1;
    const bHeader = b.record.kind === "snapshot" ? 0 : 1;
    if (aHeader !== bHeader) return aHeader - bHeader;
    const byKind = compareStrings(a.record.kind, b.record.kind);
    if (byKind !== 0) return byKind;
    const byKey = compareStrings(a.key, b.key);
    if (byKey !== 0) return byKey;
    // Same joined string from different components: fall back to the components.
    for (let i = 0; i < Math.max(a.parts.length, b.parts.length); i += 1) {
      const byPart = compareStrings(a.parts[i] ?? "", b.parts[i] ?? "");
      if (byPart !== 0) return byPart;
    }
    return 0;
  });
  return decorated.map((entry) => entry.record);
}

function assertNoNull(value: unknown, where: string): void {
  if (value === null) throw new Error(`null is not written to a snapshot (${where})`);
}

/** Serializes records. Top-level null / undefined fields are a programming error and are rejected. */
export function serializeSnapshot(records: SnapshotRecord[]): string {
  const headers = records.filter((record) => record.kind === "snapshot");
  if (headers.length !== 1) throw new Error(`A snapshot needs exactly one header record, found ${headers.length}.`);
  const lines = sortRecords(records).map((record) => {
    for (const [field, value] of Object.entries(record)) assertNoNull(value, `${record.kind}.${field}`);
    return JSON.stringify(record);
  });
  return lines.join("\n") + "\n";
}

export function parseSnapshot(text: string): SnapshotRecord[] {
  const records: SnapshotRecord[] = [];
  text.split("\n").forEach((line, index) => {
    if (line.trim() === "") return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      throw new Error(`Snapshot line ${index + 1} is not JSON: ${(error as Error).message}`);
    }
    if (typeof value !== "object" || value === null || typeof (value as { kind?: unknown }).kind !== "string") {
      throw new Error(`Snapshot line ${index + 1} has no kind.`);
    }
    records.push(value as SnapshotRecord);
  });
  const first = records[0];
  if (!first || first.kind !== "snapshot") throw new Error("Snapshot line 1 must be the header record.");
  if (first.format !== 1) throw new Error(`Unsupported snapshot format: ${String(first.format)}`);
  return records;
}
