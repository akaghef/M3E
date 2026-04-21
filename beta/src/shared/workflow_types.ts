/**
 * PJ03 SelfDrive — workflow engine 型定義
 *
 * 正本:
 *   - projects/PJ03_SelfDrive/docs/workflow_state_set.md (9 states)
 *   - projects/PJ03_SelfDrive/docs/workflow_edges.md (17 edges, fail-closed)
 *
 * 本ファイルは型と定数のみ。runtime ロジックは beta/src/node/workflow_reducer.ts 側に置く。
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type WorkflowStateKind =
  | "pending"
  | "ready"
  | "in_progress"
  | "eval_pending"
  | "blocked"
  | "sleeping"
  | "escalated"
  | "done"
  | "failed";

export const WORKFLOW_STATE_KINDS: readonly WorkflowStateKind[] = [
  "pending",
  "ready",
  "in_progress",
  "eval_pending",
  "blocked",
  "sleeping",
  "escalated",
  "done",
  "failed",
] as const;

export const TERMINAL_STATES: readonly WorkflowStateKind[] = ["done", "failed"] as const;

export type EscalationKind = "E1" | "E2" | "E3";

export type WakeupMechanism = "one-shot" | "cron";

/**
 * WorkflowState — 1 task の現在状態。tasks.yaml の 1 エントリに対応。
 *
 * invariants (workflow_state_set.md §invariant):
 *  - kind === "blocked"     ⇒ blocker        !== null
 *  - kind === "escalated"   ⇒ escalationKind !== null
 *  - kind === "sleeping"    ⇒ wakeupAt       is future ISO timestamp
 *  - kind === "failed"      ⇒ failureReason  !== null
 *  - round >= 0 && round <= roundMax
 *  - round > 0              ⇒ lastFeedback   !== null
 */
export interface WorkflowState {
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

// ---------------------------------------------------------------------------
// Node / Edge
// ---------------------------------------------------------------------------

export type NodeRole = "generator" | "evaluator" | "router";

/**
 * WorkflowNode — 実行可能な処理単位。1 task は 1+ node を持つ。
 *
 * 同一 taskId に属する node は generator -> evaluator -> router のチェーンを成すが、
 * 単純 task では role="generator" の 1 node のみでもよい。
 */
export interface WorkflowNode {
  id: string;
  taskId: string;
  role: NodeRole;
  description: string;
}

export type EdgeTrigger = "machine" | "human" | "timer";

export type EdgeId =
  | "E01"
  | "E02"
  | "E03"
  | "E04"
  | "E05"
  | "E06"
  | "E07"
  | "E08"
  | "E09"
  | "E10"
  | "E11"
  | "E12"
  | "E13"
  | "E14"
  | "E15"
  | "E16"
  | "E17";

/**
 * WorkflowEdge — 許容される state 間遷移。
 *
 * 本表（ALLOWED_EDGES）にない (source, target) は reducer が fail-closed で拒否する
 * (workflow_edges.md §設計原則)。
 */
export interface WorkflowEdge {
  id: EdgeId;
  source: WorkflowStateKind;
  target: WorkflowStateKind;
  condition: string;
  trigger: EdgeTrigger;
}

export const ALLOWED_EDGES: readonly WorkflowEdge[] = [
  { id: "E01", source: "pending",      target: "ready",        condition: "all dependencies done",          trigger: "machine" },
  { id: "E02", source: "ready",        target: "in_progress",  condition: "Generator dispatched",           trigger: "machine" },
  { id: "E03", source: "in_progress",  target: "eval_pending", condition: "Generator DONE && eval_required", trigger: "machine" },
  { id: "E04", source: "in_progress",  target: "done",         condition: "Generator DONE && !eval_required && objective check pass", trigger: "machine" },
  { id: "E05", source: "eval_pending", target: "done",         condition: "Evaluator pass",                  trigger: "machine" },
  { id: "E06", source: "eval_pending", target: "in_progress",  condition: "Evaluator fail && round+1 <= roundMax", trigger: "machine" },
  { id: "E07", source: "eval_pending", target: "blocked",      condition: "Evaluator fail && round+1 > roundMax",  trigger: "machine" },
  { id: "E08", source: "in_progress",  target: "sleeping",     condition: "ScheduleWakeup or CronCreate issued", trigger: "timer" },
  { id: "E09", source: "sleeping",     target: "ready",        condition: "wakeup time reached",             trigger: "timer" },
  { id: "E10", source: "in_progress",  target: "escalated",    condition: "E1/E2/E3 detected during exec",   trigger: "machine" },
  { id: "E11", source: "eval_pending", target: "escalated",    condition: "E1/E2/E3 detected during eval",   trigger: "machine" },
  { id: "E12", source: "escalated",    target: "ready",        condition: "human approve (akaghef)",         trigger: "human" },
  { id: "E13", source: "escalated",    target: "blocked",      condition: "human reject (akaghef)",          trigger: "human" },
  { id: "E14", source: "escalated",    target: "failed",       condition: "human abort (akaghef)",           trigger: "human" },
  { id: "E15", source: "blocked",      target: "ready",        condition: "blocker cleared",                 trigger: "machine" },
  { id: "E16", source: "blocked",      target: "failed",       condition: "human abort (akaghef)",           trigger: "human" },
  { id: "E17", source: "in_progress",  target: "failed",       condition: "fatal runtime exception",         trigger: "machine" },
] as const;

// ---------------------------------------------------------------------------
// Checkpoint / RunContext
// ---------------------------------------------------------------------------

/**
 * Checkpoint — 1 task の最小永続化単位。
 *
 * 正本は tasks.yaml（per-task 行）。resume-cheatsheet.md は human-facing summary。
 * checkpoint は idempotent でなければならない (workflow_state_set.md T-1-5 契約)。
 */
export interface Checkpoint {
  taskId: string;
  state: WorkflowState;
  savedAt: string;
  commitHash: string | null;
}

export type StopReason = "gate" | "blocked" | "sleeping" | "escalated" | "failed";

/**
 * RunContext — reducer の 1 回の invocation 単位。
 *
 * - tasksFile: tasks.yaml への絶対パス
 * - cheatsheetFile: resume-cheatsheet.md への絶対パス
 * - dryRun: true なら writeback せず inspection のみ
 * - resume: true なら前回 checkpoint から継続
 */
export interface RunContext {
  tasksFile: string;
  cheatsheetFile: string;
  dryRun: boolean;
  resume: boolean;
  startedAt: string;
  stopReason: StopReason | null;
}
