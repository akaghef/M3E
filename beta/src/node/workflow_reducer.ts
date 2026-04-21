/**
 * PJ03 SelfDrive — workflow reducer (T-1-9: runner → reducer rename)
 *
 * 責務 (akaghef Qn3 P2 確定):
 *   - tasks.yaml = 人間向け sprint contract（status / round / last_feedback / blocker は含まない）
 *   - projects/PJ{NN}_{Name}/runtime/checkpoints/{taskId}.json = machine state の SSOT
 *   - reduce(state, signal) → nextState の純粋関数群
 *   - fail-closed: ALLOWED_EDGES にない遷移は reject
 *   - persistence adapter: checkpoint JSON の atomic read/write
 *
 * 非責務 (engine 化は Phase 2 で別 task として切り出し):
 *   - Generator / Evaluator 起動 (subagent spawn)
 *   - 時刻ベース wakeup 発火 (Clock polling)
 *   - 依存解決 (dependency resolution)
 *   - review resolver との統合
 *
 * CLI は workflow_cli.ts に分離（本ファイルは副作用を持たない library モジュール）。
 * Date / fs 直参照は T-1-10 で Clock interface と persistence adapter に切り出す予定。
 *
 * 詳細: projects/PJ03_SelfDrive/docs/reducer_responsibility.md
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

import {
  ALLOWED_EDGES,
  EdgeId,
  RunContext,
  WorkflowEdge,
  WorkflowState,
  WorkflowStateKind,
} from "../shared/workflow_types";

import {
  CHECKPOINT_SCHEMA_VERSION,
  CheckpointFile,
  PersistedState,
  WorkflowStateCamel,
  checkpointPath,
  fromWorkflowState,
  toWorkflowState,
} from "../shared/checkpoint_types";

// ---------------------------------------------------------------------------
// tasks.yaml schema (contract only; no machine state)
// ---------------------------------------------------------------------------

export interface TaskContract {
  id: string;
  phase: number;
  verb: string;
  target: string;
  done_when: string[];
  eval_required: boolean;
  eval_criteria?: string[];
  parallelizable?: boolean;
  scope?: string;
  facet?: string;
  round_max: number;
  dependencies?: string[];      // T-1-10 で全 entry 設定
  linked_review?: string | null; // T-1-10 で設定
}

// ---------------------------------------------------------------------------
// tasks.yaml read (contract)
// ---------------------------------------------------------------------------

export function readContracts(tasksFile: string): TaskContract[] {
  let raw: string;
  try {
    raw = fs.readFileSync(tasksFile, "utf8");
  } catch (e) {
    throw new Error(`contract read failed: cannot open ${tasksFile}: ${(e as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (e) {
    throw new Error(`contract corrupt: YAML parse error in ${tasksFile}: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`contract corrupt: tasks.yaml must be a top-level list, got ${typeof parsed}`);
  }
  for (const entry of parsed as TaskContract[]) {
    if (!entry || typeof entry.id !== "string") {
      throw new Error(`contract corrupt: entry missing 'id': ${JSON.stringify(entry)}`);
    }
  }
  return parsed as TaskContract[];
}

export function loadContract(tasksFile: string, taskId: string): TaskContract {
  const entries = readContracts(tasksFile);
  const e = entries.find((x) => x.id === taskId);
  if (!e) throw new Error(`contract not found: ${taskId} in ${tasksFile}`);
  return e;
}

// ---------------------------------------------------------------------------
// Checkpoint JSON (machine state SSOT)
// ---------------------------------------------------------------------------

const WORKFLOW_STATE_KINDS_SET: ReadonlySet<string> = new Set([
  "pending", "ready", "in_progress", "eval_pending",
  "blocked", "sleeping", "escalated", "done", "failed",
]);

export function loadCheckpointFile(runtimeDir: string, taskId: string): CheckpointFile {
  const cpPath = checkpointPath(runtimeDir, taskId);
  let raw: string;
  try {
    raw = fs.readFileSync(cpPath, "utf8");
  } catch (e) {
    throw new Error(`checkpoint read failed: cannot open ${cpPath}: ${(e as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`checkpoint corrupt: JSON parse error in ${cpPath}: ${(e as Error).message}`);
  }
  const cp = parsed as CheckpointFile;
  if (!cp || typeof cp !== "object") {
    throw new Error(`checkpoint corrupt: ${cpPath} is not a JSON object`);
  }
  if (cp.schema_version !== CHECKPOINT_SCHEMA_VERSION) {
    throw new Error(`checkpoint corrupt: schema_version mismatch in ${cpPath} (got ${cp.schema_version}, want ${CHECKPOINT_SCHEMA_VERSION})`);
  }
  if (cp.task_id !== taskId) {
    throw new Error(`checkpoint corrupt: task_id mismatch in ${cpPath} (file says '${cp.task_id}', lookup was '${taskId}')`);
  }
  if (!cp.state || !WORKFLOW_STATE_KINDS_SET.has(cp.state.kind)) {
    throw new Error(`checkpoint corrupt: unknown state.kind '${cp.state?.kind}' in ${cpPath}`);
  }
  return cp;
}

/**
 * saveCheckpointFile — atomic write via tmp + rename。
 * 部分書き込みで本体が壊れないことを保証する（POSIX atomic; Windows は最善努力）。
 */
export function saveCheckpointFile(runtimeDir: string, file: CheckpointFile): void {
  const cpPath = checkpointPath(runtimeDir, file.task_id);
  fs.mkdirSync(path.dirname(cpPath), { recursive: true });
  const tmpPath = `${cpPath}.tmp-${crypto.randomBytes(6).toString("hex")}`;
  fs.writeFileSync(tmpPath, JSON.stringify(file, null, 2) + "\n", "utf8");
  fs.renameSync(tmpPath, cpPath);
}

/**
 * loadCheckpointState — checkpoint JSON を読み、runtime 型 WorkflowStateCamel を返す。
 * invariant 完全性: 読み戻しで全 9 field が復元される。
 */
export function loadCheckpointState(runtimeDir: string, taskId: string): WorkflowStateCamel {
  const cp = loadCheckpointFile(runtimeDir, taskId);
  return toWorkflowState(cp.state);
}

export function saveCheckpointState(runtimeDir: string, taskId: string, state: WorkflowStateCamel): void {
  const file: CheckpointFile = {
    schema_version: CHECKPOINT_SCHEMA_VERSION,
    task_id: taskId,
    updated_at: new Date().toISOString(),
    state: fromWorkflowState(state),
  };
  saveCheckpointFile(runtimeDir, file);
}

// ---------------------------------------------------------------------------
// Task selection
// ---------------------------------------------------------------------------

export interface TaskView {
  contract: TaskContract;
  state: WorkflowStateCamel;
}

export function loadAllTaskViews(tasksFile: string, runtimeDir: string): TaskView[] {
  const contracts = readContracts(tasksFile);
  const views: TaskView[] = [];
  for (const c of contracts) {
    const state = loadCheckpointState(runtimeDir, c.id);
    views.push({ contract: c, state });
  }
  return views;
}

/**
 * pickNextTask — 次処理対象 task を選ぶ。
 *
 * 注意: 依存解決 / sleeping wakeup / escalated 再開判定は T-1-10 で追加。
 * 現 T-1-8 時点では status kind ベースの FIFO。
 */
export function pickNextTask(tasksFile: string, runtimeDir: string): TaskView | null {
  const views = loadAllTaskViews(tasksFile, runtimeDir);
  const inProgress = views.find((v) => v.state.kind === "in_progress");
  if (inProgress) return inProgress;
  const ready = views.find((v) => v.state.kind === "ready");
  if (ready) return ready;
  const pending = views
    .filter((v) => v.state.kind === "pending")
    .sort((a, b) => a.contract.phase - b.contract.phase || a.contract.id.localeCompare(b.contract.id));
  return pending[0] ?? null;
}

// ---------------------------------------------------------------------------
// Edge selection (fail-closed)
// ---------------------------------------------------------------------------

export type StepSignal =
  | { kind: "dependencies_done" }
  | { kind: "dispatch_generator" }
  | { kind: "generator_done"; evalRequired: boolean; objectiveCheckPass: boolean }
  | { kind: "evaluator_verdict"; pass: boolean; feedback?: string }
  | { kind: "schedule_wakeup"; wakeupAt: string; mechanism: "one-shot" | "cron" }
  | { kind: "wakeup_fired" }
  | { kind: "escalation_detected"; escalation: "E1" | "E2" | "E3" }
  | { kind: "human_approve" }
  | { kind: "human_reject" }
  | { kind: "human_abort" }
  | { kind: "blocker_cleared" }
  | { kind: "fatal_exception"; reason: string };

export function selectEdge(current: WorkflowStateCamel, signal: StepSignal): WorkflowEdge | null {
  const from = current.kind;
  const table = ALLOWED_EDGES.filter((e) => e.source === from);
  const byId = (id: EdgeId) => table.find((e) => e.id === id) ?? null;

  switch (signal.kind) {
    case "dependencies_done": return byId("E01");
    case "dispatch_generator": return byId("E02");
    case "generator_done":
      if (signal.evalRequired) return byId("E03");
      return signal.objectiveCheckPass ? byId("E04") : null;
    case "evaluator_verdict":
      if (signal.pass) return byId("E05");
      return current.round + 1 <= current.roundMax ? byId("E06") : byId("E07");
    case "schedule_wakeup": return byId("E08");
    case "wakeup_fired": return byId("E09");
    case "escalation_detected":
      if (from === "in_progress") return byId("E10");
      if (from === "eval_pending") return byId("E11");
      return null;
    case "human_approve": return byId("E12");
    case "human_reject": return byId("E13");
    case "human_abort":
      if (from === "escalated") return byId("E14");
      if (from === "blocked") return byId("E16");
      return null;
    case "blocker_cleared": return byId("E15");
    case "fatal_exception": return byId("E17");
  }
}

// ---------------------------------------------------------------------------
// stepOnce (pure transition)
// ---------------------------------------------------------------------------

export interface StepResult {
  edge: WorkflowEdge | null;
  nextState: WorkflowStateCamel | null;
  rejected: boolean;
  rejectionReason: string | null;
}

export function stepOnce(current: WorkflowStateCamel, signal: StepSignal): StepResult {
  const edge = selectEdge(current, signal);
  if (!edge) {
    return {
      edge: null,
      nextState: null,
      rejected: true,
      rejectionReason: `no allowed edge from '${current.kind}' for signal '${signal.kind}'`,
    };
  }
  const next: WorkflowStateCamel = { ...current, kind: edge.target };

  if (edge.id === "E06") next.round = current.round + 1;

  if (signal.kind === "evaluator_verdict") {
    next.lastFeedback = signal.feedback ?? (signal.pass ? "evaluator pass" : "evaluator fail");
  }
  if (signal.kind === "escalation_detected") {
    next.escalationKind = signal.escalation;
  } else if (edge.target !== "escalated") {
    next.escalationKind = null;
  }
  if (signal.kind === "schedule_wakeup") {
    next.wakeupAt = signal.wakeupAt;
    next.wakeupMechanism = signal.mechanism;
  } else if (edge.target !== "sleeping") {
    next.wakeupAt = null;
    next.wakeupMechanism = null;
  }
  if (signal.kind === "fatal_exception") {
    next.failureReason = signal.reason;
  } else if (edge.target !== "failed") {
    next.failureReason = null;
  }
  if (edge.target === "blocked" && !next.blocker) {
    next.blocker =
      signal.kind === "evaluator_verdict"
        ? `round_max breach after ${next.round} rounds`
        : signal.kind === "human_reject"
          ? "human reject at escalation"
          : "unspecified";
  }
  if (edge.target === "ready") {
    next.blocker = null;
  }

  return { edge, nextState: next, rejected: false, rejectionReason: null };
}

// ---------------------------------------------------------------------------
// runOneStep — high-level (contract + checkpoint + write)
// ---------------------------------------------------------------------------

export interface RunOneStepInput {
  taskId: string;
  signal: StepSignal;
}

export interface RunOneStepOutput {
  taskId: string;
  fromState: WorkflowStateCamel;
  edge: WorkflowEdge | null;
  nextState: WorkflowStateCamel | null;
  rejected: boolean;
  rejectionReason: string | null;
  wrote: boolean;
}

export interface ReducerContext {
  tasksFile: string;
  runtimeDir: string;  // checkpoints/ の親ディレクトリ
  cheatsheetFile: string;
  dryRun: boolean;
}

export function runOneStep(ctx: ReducerContext, input: RunOneStepInput): RunOneStepOutput {
  const cur = loadCheckpointState(ctx.runtimeDir, input.taskId);
  const { edge, nextState, rejected, rejectionReason } = stepOnce(cur, input.signal);

  let wrote = false;
  if (!rejected && nextState && !ctx.dryRun) {
    saveCheckpointState(ctx.runtimeDir, input.taskId, nextState);
    wrote = true;
    if (ctx.cheatsheetFile) {
      regenerateCheatsheet(ctx.tasksFile, ctx.runtimeDir, ctx.cheatsheetFile);
    }
  }
  return {
    taskId: input.taskId,
    fromState: cur,
    edge,
    nextState,
    rejected,
    rejectionReason,
    wrote,
  };
}

// ---------------------------------------------------------------------------
// Resume cheatsheet (runner-managed block regeneration)
// ---------------------------------------------------------------------------

export function regenerateCheatsheet(tasksFile: string, runtimeDir: string, cheatsheetFile: string): { updated: boolean } {
  const views = loadAllTaskViews(tasksFile, runtimeDir);
  const next = pickNextTask(tasksFile, runtimeDir);
  const nonTerminal = views.find((v) => v.state.kind !== "done" && v.state.kind !== "failed");
  const phase = nonTerminal?.contract.phase ?? views[views.length - 1]?.contract.phase ?? 0;
  const byKind: Record<string, number> = {};
  for (const v of views) byKind[v.state.kind] = (byKind[v.state.kind] ?? 0) + 1;

  const block = [
    "<!-- runner-managed:begin -->",
    `<!-- auto-generated by workflow_reducer at ${new Date().toISOString()} -->`,
    "",
    `- Phase: ${phase}`,
    `- Next task: ${next ? `\`${next.contract.id}\` (${next.contract.verb} ${next.contract.target}) [state=${next.state.kind}]` : "(none — E1 Phase gate candidate)"}`,
    `- Task state breakdown: ${Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join(", ")}`,
    `- Total tasks: ${views.length}`,
    "",
    "<!-- runner-managed:end -->",
  ].join("\n");

  let existing = "";
  try { existing = fs.readFileSync(cheatsheetFile, "utf8"); } catch { /* new */ }

  let newContent: string;
  if (existing.includes("<!-- runner-managed:begin -->") && existing.includes("<!-- runner-managed:end -->")) {
    newContent = existing.replace(/<!-- runner-managed:begin -->[\s\S]*?<!-- runner-managed:end -->/, block);
  } else if (existing) {
    newContent = block + "\n\n" + existing;
  } else {
    newContent = `# Resume Cheatsheet (runner-managed)\n\n${block}\n`;
  }

  if (newContent === existing) return { updated: false };
  fs.writeFileSync(cheatsheetFile, newContent, "utf8");
  return { updated: true };
}

// ---------------------------------------------------------------------------
// Helpers (resume / suggest)
// ---------------------------------------------------------------------------

export function suggestNextSignal(kind: WorkflowStateKind): string {
  switch (kind) {
    case "pending":      return "dependencies_done";
    case "ready":        return "dispatch_generator";
    case "in_progress":  return "generator_done | schedule_wakeup | escalation_detected | fatal_exception";
    case "eval_pending": return "evaluator_verdict | escalation_detected";
    case "blocked":      return "blocker_cleared | human_abort";
    case "sleeping":     return "wakeup_fired";
    case "escalated":    return "human_approve | human_reject | human_abort";
    case "done":         return "(terminal; no signal)";
    case "failed":       return "(terminal; no signal)";
  }
}

// ---------------------------------------------------------------------------
// Cycle driver (T-1-4 — preserved)
// ---------------------------------------------------------------------------

export interface CycleTraceStep {
  signalKind: string;
  from: WorkflowStateKind;
  edge: EdgeId | null;
  to: WorkflowStateKind | null;
  round: number;
  rejected: boolean;
}

export interface CycleResult {
  initial: WorkflowStateCamel;
  final: WorkflowStateCamel;
  trace: CycleTraceStep[];
  terminated: "done" | "failed" | "blocked" | "escalated" | "sleeping" | "rejected";
}

export function driveCycle(initial: WorkflowStateCamel, signals: StepSignal[]): CycleResult {
  const trace: CycleTraceStep[] = [];
  let cur = { ...initial };
  let terminated: CycleResult["terminated"] | null = null;

  for (const sig of signals) {
    const r = stepOnce(cur, sig);
    trace.push({
      signalKind: sig.kind,
      from: cur.kind,
      edge: r.edge?.id ?? null,
      to: r.nextState?.kind ?? null,
      round: cur.round,
      rejected: r.rejected,
    });
    if (r.rejected || !r.nextState) { terminated = "rejected"; break; }
    cur = r.nextState;
    if (cur.kind === "done")     { terminated = "done"; break; }
    if (cur.kind === "failed")   { terminated = "failed"; break; }
    if (cur.kind === "blocked")  { terminated = "blocked"; break; }
    if (cur.kind === "escalated"){ terminated = "escalated"; break; }
    if (cur.kind === "sleeping") { terminated = "sleeping"; break; }
  }

  return { initial, final: cur, trace, terminated: terminated ?? "rejected" };
}

export function freshState(roundMax: number): WorkflowStateCamel {
  return {
    kind: "pending",
    round: 0,
    roundMax,
    lastFeedback: null,
    blocker: null,
    escalationKind: null,
    wakeupAt: null,
    wakeupMechanism: null,
    failureReason: null,
  };
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

// Export for re-use by RunContext clients (legacy T-1-1 type, retained for API continuity)
export type { RunContext };
