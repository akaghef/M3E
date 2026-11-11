/**
 * scope 同期の配送型。権限の採否は cutover/scope-permission が決める。
 * journal は Command / operation の因果と履歴を replay できる論理記録。
 * 物理形式は file_layout.ts の配置案。
 */

export interface ScopeCommand {
  intent: string;
  targetId: string;
  operation: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ScopeJournalRecord {
  /** 再送しても受け側が同一記録と判定する鍵。 */
  recordId: string;
  scopeId: string;
  /** アカウント境界の所在。同期の分割キーにはしない。 */
  workspaceId: string;
  mapId: string;
  deviceId: string;
  /** この device がこの scope に書いた通番。 */
  seq: number;
  /** この Command が因果的に続く記録。空なら scope 内の起点。 */
  causalParentIds: readonly string[];
  command: ScopeCommand;
  recordedAt: string;
}

export interface RecordScopeChangeInput {
  scopeId: string;
  mapId: string;
  command: ScopeCommand;
  recordedAt?: string;
}

export interface ScopePushReport {
  ok: boolean;
  reason?: "unreachable" | "empty";
  detail?: string;
  /** admitToAccount の結果。false のとき変更列は送らない。 */
  accountAdmitted: boolean;
  sentRecordIds: readonly string[];
  withheldScopeIds: readonly string[];
}

export interface ScopeReceiveReport {
  applied: readonly ScopeJournalRecord[];
  duplicateIds: readonly string[];
}
