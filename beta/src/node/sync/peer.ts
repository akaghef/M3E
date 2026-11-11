import {
  admitToAccount,
  decideScopePermission,
  filterScopeChangeSequences,
  type ScopeChangeSequence,
  type ScopeGrant,
  type WorkspaceAccount,
} from "../../cutover/scope-permission";
import type { DeliveryCursor } from "./cursor";
import type { ScopeJournalReader, ScopeJournalStore } from "./journal_store";
import { replayScope } from "./replay";
import type { ScopeSyncTransport } from "./transport";
import type {
  RecordScopeChangeInput,
  ScopeCommand,
  ScopeJournalRecord,
  ScopePushReport,
  ScopeReceiveReport,
} from "./types";

function requireText(value: string, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }
  return value;
}

function copyCommand(command: ScopeCommand): ScopeCommand {
  requireText(command.intent, "command.intent");
  requireText(command.targetId, "command.targetId");
  const operation: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(command.operation)) {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean" && value !== null) {
      throw new Error(`command.operation.${key} must be a scalar`);
    }
    operation[key] = value;
  }
  return { intent: command.intent, targetId: command.targetId, operation };
}

function assertInbound(record: ScopeJournalRecord): void {
  requireText(record.recordId, "recordId");
  requireText(record.scopeId, "scopeId");
  requireText(record.workspaceId, "workspaceId");
  requireText(record.mapId, "mapId");
  requireText(record.deviceId, "deviceId");
  requireText(record.recordedAt, "recordedAt");
  if (!Number.isInteger(record.seq) || record.seq < 1) {
    throw new Error("seq must be a positive integer");
  }
  if (!Array.isArray(record.causalParentIds) || record.causalParentIds.some((id) => typeof id !== "string")) {
    throw new Error("causalParentIds must be string ids");
  }
  copyCommand(record.command);
}

/**
 * 1 端末分の scope 同期。
 * 権限は decideScopePermission / filterScopeChangeSequences / admitToAccount に委譲する。
 * ここでは採否を再実装しない。
 */
export class ScopeSyncPeer {
  private readonly grants: readonly ScopeGrant[];

  constructor(
    readonly deviceId: string,
    readonly actorAccountId: string,
    readonly workspace: WorkspaceAccount,
    grants: readonly ScopeGrant[],
    private readonly store: ScopeJournalStore,
    private readonly cursor: DeliveryCursor,
  ) {
    requireText(deviceId, "deviceId");
    requireText(actorAccountId, "actorAccountId");
    requireText(workspace.accountId, "workspace.accountId");
    requireText(workspace.workspaceId, "workspace.workspaceId");
    this.grants = grants.map((grant) => ({ ...grant }));
  }

  get journal(): ScopeJournalReader {
    return this.store;
  }

  /** offline 中でも端末内の journal にだけ足す。送れるかは push 時に判定する。 */
  record(input: RecordScopeChangeInput): ScopeJournalRecord {
    const scopeId = requireText(input.scopeId, "scopeId");
    const mapId = requireText(input.mapId, "mapId");
    const command = copyCommand(input.command);
    const existing = this.store.readScope(scopeId);
    const authored = existing.filter((record) => record.deviceId === this.deviceId);
    const seq = authored.length + 1;
    const parent = existing.length > 0 ? existing[existing.length - 1] : undefined;
    const record: ScopeJournalRecord = {
      recordId: `rec:${this.deviceId}:${scopeId}:${seq}`,
      scopeId,
      workspaceId: this.workspace.workspaceId,
      mapId,
      deviceId: this.deviceId,
      seq,
      causalParentIds: parent ? [parent.recordId] : [],
      command,
      recordedAt: input.recordedAt ?? new Date().toISOString(),
    };
    const result = this.store.append(record);
    if (!result.appended) {
      throw new Error(`local journal already has ${record.recordId}`);
    }
    return record;
  }

  /** 未送信の自記録を scope ごとの変更列にする。権限ではまだ削らない。 */
  unsentSequences(remotePeerId: string): ScopeChangeSequence<ScopeJournalRecord>[] {
    const sent = this.cursor.sentIds(remotePeerId);
    const unsent = this.store.readAll().filter((record) =>
      record.deviceId === this.deviceId
      && record.workspaceId === this.workspace.workspaceId
      && !sent.has(record.recordId)
    );
    const byScope = new Map<string, ScopeJournalRecord[]>();
    for (const record of unsent) {
      const list = byScope.get(record.scopeId) ?? [];
      list.push(record);
      byScope.set(record.scopeId, list);
    }
    return [...byScope.keys()].sort().map((scopeId) => ({
      scopeId,
      changes: (byScope.get(scopeId) ?? []).slice().sort((left, right) => left.seq - right.seq),
    }));
  }

  /**
   * 未送信分を scope ごとに送る。
   * アカウント外は admitToAccount が拒否する。
   * 送れる列だけが filterScopeChangeSequences に残る。書けない scope の changes は空。
   * 相手が落ちていれば cursor を進めず、journal に留める。
   */
  async push(remotePeerId: string, transport: ScopeSyncTransport): Promise<ScopePushReport> {
    const sequences = this.unsentSequences(remotePeerId);
    const accountAdmitted = admitToAccount(this.actorAccountId, this.workspace);
    const decisions = new Map(sequences.map((sequence) => [
      sequence.scopeId,
      decideScopePermission(this.actorAccountId, this.workspace, this.grants, sequence.scopeId),
    ]));
    const filtered = filterScopeChangeSequences(
      this.actorAccountId,
      this.workspace,
      this.grants,
      sequences,
    );
    const withheldScopeIds = filtered.filter((sequence) => sequence.changes.length === 0).map((sequence) => sequence.scopeId);
    const sendable = accountAdmitted
      ? filtered.filter((sequence) => sequence.changes.length > 0 && decisions.get(sequence.scopeId)?.send === true)
      : [];
    if (!accountAdmitted || sendable.length === 0) {
      return { ok: true, reason: "empty", accountAdmitted, sentRecordIds: [], withheldScopeIds };
    }
    let result;
    try {
      result = await transport.send(sendable);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false, reason: "unreachable", detail, accountAdmitted, sentRecordIds: [], withheldScopeIds };
    }
    if (!result.ok) {
      return {
        ok: false,
        reason: "unreachable",
        detail: result.detail,
        accountAdmitted,
        sentRecordIds: [],
        withheldScopeIds,
      };
    }
    const offered = new Set(sendable.flatMap((sequence) => sequence.changes.map((record) => record.recordId)));
    const accepted = result.acceptedIds.filter((id) => offered.has(id));
    this.cursor.markSent(remotePeerId, accepted);
    return { ok: true, accountAdmitted, sentRecordIds: accepted, withheldScopeIds };
  }

  /** 同じ recordId は二度目以降 append しない。 */
  receive(records: readonly ScopeJournalRecord[]): ScopeReceiveReport {
    const applied: ScopeJournalRecord[] = [];
    const duplicateIds: string[] = [];
    for (const record of records) {
      assertInbound(record);
      if (this.store.has(record.recordId)) {
        duplicateIds.push(record.recordId);
        continue;
      }
      const result = this.store.append(record);
      if (!result.appended) {
        duplicateIds.push(record.recordId);
        continue;
      }
      applied.push(record);
    }
    return { applied, duplicateIds };
  }

  receiveSequences(sequences: readonly ScopeChangeSequence<ScopeJournalRecord>[]): ScopeReceiveReport {
    return this.receive(sequences.flatMap((sequence) => [...sequence.changes]));
  }

  replay(scopeId: string): ScopeJournalRecord[] {
    return replayScope(this.store.readScope(scopeId));
  }
}
