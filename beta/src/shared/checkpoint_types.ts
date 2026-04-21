/**
 * PJ03 SelfDrive — checkpoint JSON schema
 *
 * 正本 layout:
 *   projects/PJ{NN}_{Name}/runtime/checkpoints/{taskId}.json
 *
 * 責務分離 (Qn3_gate2_rework P1 akaghef 確定):
 *   tasks.yaml = 人間向け sprint contract (何をやるか)
 *   checkpoint JSON = 機械向け実行状態 (state machine の現在値)
 *
 * invariant 完全性要件 (rework 完了条件):
 *   saveCheckpoint → loadCheckpoint の round-trip で
 *   WorkflowState の全 field が欠落なく復元されなければならない。
 *
 * 詳細: projects/PJ03_SelfDrive/docs/checkpoint_schema.md
 */

import type {
  EscalationKind,
  WakeupMechanism,
  WorkflowStateKind,
} from "./workflow_types";

export const CHECKPOINT_SCHEMA_VERSION = 1 as const;

/**
 * PersistedState — checkpoint JSON に書かれる state フィールド群。
 *
 * WorkflowState と 1:1 対応するが、JSON 用に snake_case にしている。
 * runtime では `toWorkflowState` / `fromWorkflowState` で相互変換する。
 */
export interface PersistedState {
  kind: WorkflowStateKind;
  round: number;
  round_max: number;
  last_feedback: string | null;
  blocker: string | null;
  escalation_kind: EscalationKind | null;
  wakeup_at: string | null;
  wakeup_mechanism: WakeupMechanism | null;
  failure_reason: string | null;
}

export interface CheckpointFile {
  schema_version: typeof CHECKPOINT_SCHEMA_VERSION;
  task_id: string;
  updated_at: string;
  state: PersistedState;
}

/**
 * checkpoint JSON ファイルのパス規約。
 */
export function checkpointPath(runtimeDir: string, taskId: string): string {
  return `${runtimeDir}/checkpoints/${taskId}.json`;
}

/**
 * PersistedState -> WorkflowState (runtime 型、camelCase)。
 * escalationKind / wakeupAt / wakeupMechanism / failureReason を null に潰さず
 * そのまま復元する。この関数が rework 完了条件の core。
 */
export interface WorkflowStateCamel {
  kind: WorkflowStateKind;
  round: number;
  roundMax: number;
  lastFeedback: string | null;
  blocker: string | null;
  escalationKind: EscalationKind | null;
  wakeupAt: string | null;
  wakeupMechanism: WakeupMechanism | null;
  failureReason: string | null;
}

export function toWorkflowState(p: PersistedState): WorkflowStateCamel {
  return {
    kind: p.kind,
    round: p.round,
    roundMax: p.round_max,
    lastFeedback: p.last_feedback,
    blocker: p.blocker,
    escalationKind: p.escalation_kind,
    wakeupAt: p.wakeup_at,
    wakeupMechanism: p.wakeup_mechanism,
    failureReason: p.failure_reason,
  };
}

export function fromWorkflowState(s: WorkflowStateCamel): PersistedState {
  return {
    kind: s.kind,
    round: s.round,
    round_max: s.roundMax,
    last_feedback: s.lastFeedback,
    blocker: s.blocker,
    escalation_kind: s.escalationKind,
    wakeup_at: s.wakeupAt,
    wakeup_mechanism: s.wakeupMechanism,
    failure_reason: s.failureReason,
  };
}
