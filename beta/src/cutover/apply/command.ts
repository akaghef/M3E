/**
 * Command をメモリ上の node レコード配列へ適用する。
 * Glossary の Command。intent は assert / rename / reparent / delete。
 * commandId は再送の識別、baseRevision は呼び手が読んだ現在の revision。
 * エンジンは呼ばない。引数を変えず、新しい配列だけを返す。
 *
 * 同じ commandId が既に適用済みなら、中身も revision も変えずに無視する。
 * 未適用で baseRevision が現在と違えば拒否する。拒否しても commandId は消費しない。
 */

export interface NodeRecord {
  readonly id: string;
  readonly text: string;
  readonly parentId: string | null;
}

export interface RecordLog {
  readonly revision: string;
  readonly records: readonly NodeRecord[];
  readonly appliedCommandIds: readonly string[];
}

interface CommandEnvelope {
  readonly commandId: string;
  readonly baseRevision: string;
}

export type Command =
  | (CommandEnvelope & {
      readonly intent: "assert";
      readonly nodeId: string;
      readonly text: string;
      readonly parentId: string | null;
    })
  | (CommandEnvelope & {
      readonly intent: "rename";
      readonly nodeId: string;
      readonly text: string;
    })
  | (CommandEnvelope & {
      readonly intent: "reparent";
      readonly nodeId: string;
      readonly parentId: string;
    })
  | (CommandEnvelope & {
      readonly intent: "delete";
      readonly nodeId: string;
    });

export type ApplyRejection =
  | "empty-command-id"
  | "missing-base-revision"
  | "stale-revision"
  | "invalid-revision"
  | "empty-node-id"
  | "missing-node"
  | "duplicate-node"
  | "missing-parent"
  | "cycle"
  | "root-delete";

export type ApplyResult =
  | { readonly outcome: "applied"; readonly log: RecordLog }
  | { readonly outcome: "ignored"; readonly log: RecordLog }
  | { readonly outcome: "rejected"; readonly reason: ApplyRejection; readonly log: RecordLog };

const DECIMAL_REVISION = /^(0|[1-9]\d*)$/;

/** Command を1件適用する。成功時だけ revision を進め、commandId を記録する。 */
export function applyCommand(log: RecordLog, command: Command): ApplyResult {
  if (command.commandId === "") return reject(log, "empty-command-id");
  if (log.appliedCommandIds.includes(command.commandId)) return { outcome: "ignored", log };
  if (command.baseRevision === "") return reject(log, "missing-base-revision");
  if (command.baseRevision !== log.revision) return reject(log, "stale-revision");
  if (!DECIMAL_REVISION.test(log.revision)) return reject(log, "invalid-revision");

  const records = applyIntent(log.records, command);
  if (!records.ok) return reject(log, records.reason);

  return {
    outcome: "applied",
    log: {
      revision: nextRevision(log.revision),
      records: records.records,
      appliedCommandIds: [...log.appliedCommandIds, command.commandId],
    },
  };
}

function applyIntent(
  records: readonly NodeRecord[],
  command: Command,
): { ok: true; records: readonly NodeRecord[] } | { ok: false; reason: ApplyRejection } {
  switch (command.intent) {
    case "assert":
      return applyAssert(records, command);
    case "rename":
      return applyRename(records, command);
    case "reparent":
      return applyReparent(records, command);
    case "delete":
      return applyDelete(records, command);
  }
}

function applyAssert(
  records: readonly NodeRecord[],
  command: Extract<Command, { intent: "assert" }>,
): { ok: true; records: readonly NodeRecord[] } | { ok: false; reason: ApplyRejection } {
  if (command.nodeId === "") return { ok: false, reason: "empty-node-id" };
  if (records.some((record) => record.id === command.nodeId)) {
    return { ok: false, reason: "duplicate-node" };
  }
  if (command.parentId !== null && !records.some((record) => record.id === command.parentId)) {
    return { ok: false, reason: "missing-parent" };
  }
  if (command.parentId !== null && createsCycle(records, command.nodeId, command.parentId)) {
    return { ok: false, reason: "cycle" };
  }
  return {
    ok: true,
    records: [...records, { id: command.nodeId, text: command.text, parentId: command.parentId }],
  };
}

function applyRename(
  records: readonly NodeRecord[],
  command: Extract<Command, { intent: "rename" }>,
): { ok: true; records: readonly NodeRecord[] } | { ok: false; reason: ApplyRejection } {
  const located = locate(records, command.nodeId);
  if (!located.ok) return located;
  return {
    ok: true,
    records: records.map((record) =>
      record.id === command.nodeId ? { id: record.id, text: command.text, parentId: record.parentId } : record,
    ),
  };
}

function applyReparent(
  records: readonly NodeRecord[],
  command: Extract<Command, { intent: "reparent" }>,
): { ok: true; records: readonly NodeRecord[] } | { ok: false; reason: ApplyRejection } {
  const located = locate(records, command.nodeId);
  if (!located.ok) return located;
  if (command.parentId === "" || !records.some((record) => record.id === command.parentId)) {
    return { ok: false, reason: "missing-parent" };
  }
  if (createsCycle(records, command.nodeId, command.parentId)) return { ok: false, reason: "cycle" };
  return {
    ok: true,
    records: records.map((record) =>
      record.id === command.nodeId ? { id: record.id, text: record.text, parentId: command.parentId } : record,
    ),
  };
}

function applyDelete(
  records: readonly NodeRecord[],
  command: Extract<Command, { intent: "delete" }>,
): { ok: true; records: readonly NodeRecord[] } | { ok: false; reason: ApplyRejection } {
  const located = locate(records, command.nodeId);
  if (!located.ok) return located;
  if (located.record.parentId === null) return { ok: false, reason: "root-delete" };
  const removed = subtreeIds(records, command.nodeId);
  return { ok: true, records: records.filter((record) => !removed.has(record.id)) };
}

function locate(
  records: readonly NodeRecord[],
  nodeId: string,
): { ok: true; record: NodeRecord } | { ok: false; reason: ApplyRejection } {
  if (nodeId === "") return { ok: false, reason: "empty-node-id" };
  const found = records.filter((record) => record.id === nodeId);
  if (found.length === 0) return { ok: false, reason: "missing-node" };
  if (found.length > 1) return { ok: false, reason: "duplicate-node" };
  return { ok: true, record: found[0]! };
}

function createsCycle(records: readonly NodeRecord[], nodeId: string, parentId: string): boolean {
  const parentOf = new Map<string, string | null>();
  for (const record of records) {
    if (!parentOf.has(record.id)) parentOf.set(record.id, record.parentId);
  }
  parentOf.set(nodeId, parentId);

  const seen = new Set<string>();
  let current: string | null = nodeId;
  while (current !== null) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = parentOf.get(current) ?? null;
  }
  return false;
}

function subtreeIds(records: readonly NodeRecord[], rootId: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const record of records) {
    if (record.parentId === null) continue;
    const list = children.get(record.parentId);
    if (list) list.push(record.id);
    else children.set(record.parentId, [record.id]);
  }

  const removed = new Set<string>();
  const pending = [rootId];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (removed.has(id)) continue;
    removed.add(id);
    for (const childId of children.get(id) ?? []) pending.push(childId);
  }
  return removed;
}

function nextRevision(revision: string): string {
  return String(BigInt(revision) + 1n);
}

function reject(log: RecordLog, reason: ApplyRejection): ApplyResult {
  return { outcome: "rejected", reason, log };
}
