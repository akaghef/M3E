import type { ScopeJournalRecord } from "./types";

function compareReady(a: ScopeJournalRecord, b: ScopeJournalRecord): number {
  if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? -1 : 1;
  if (a.seq !== b.seq) return a.seq - b.seq;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1;
  return a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0;
}

/** 1 scope の journal を因果順に並べる。循環なら replay を止める。 */
export function replayScope(records: readonly ScopeJournalRecord[]): ScopeJournalRecord[] {
  const byId = new Map(records.map((record) => [record.recordId, record]));
  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const record of records) indegree.set(record.recordId, 0);
  for (const record of records) {
    for (const parentId of record.causalParentIds) {
      if (!byId.has(parentId)) continue;
      indegree.set(record.recordId, (indegree.get(record.recordId) ?? 0) + 1);
      const next = children.get(parentId) ?? [];
      next.push(record.recordId);
      children.set(parentId, next);
    }
  }
  const ready = records.filter((record) => (indegree.get(record.recordId) ?? 0) === 0).sort(compareReady);
  const ordered: ScopeJournalRecord[] = [];
  while (ready.length > 0) {
    const next = ready.shift();
    if (!next) break;
    ordered.push(next);
    for (const childId of children.get(next.recordId) ?? []) {
      const left = (indegree.get(childId) ?? 1) - 1;
      indegree.set(childId, left);
      if (left === 0) {
        const child = byId.get(childId);
        if (!child) throw new Error(`journal replay missing ${childId}`);
        ready.push(child);
        ready.sort(compareReady);
      }
    }
  }
  if (ordered.length !== records.length) {
    throw new Error("journal causality cycle; replay stopped");
  }
  return ordered;
}
