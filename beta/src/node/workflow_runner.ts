/**
 * PJ03 SelfDrive — minimal workflow engine runner
 *
 * 責務 (T-1-3 契約):
 *   - tasks.yaml を読み込み、各 task の current Checkpoint を返す
 *   - 1 step 進める: 現 state + 受領シグナル → ALLOWED_EDGES から 1 辺を選び next state
 *   - fail-closed: ALLOWED_EDGES にない (source, target) は reject
 *   - writeback: status / round / lastFeedback / blocker を tasks.yaml に surgical に書き戻す
 *     （行単位の targeted replace。コメント・順序・空行を保持）
 *   - dry-run mode: writeback を抑止して計画のみ返す
 *
 * 正本:
 *   - beta/src/shared/workflow_types.ts: 型と ALLOWED_EDGES
 *   - projects/PJ03_SelfDrive/docs/workflow_edges.md: 遷移の根拠
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

import {
  ALLOWED_EDGES,
  Checkpoint,
  EdgeId,
  RunContext,
  WorkflowEdge,
  WorkflowState,
  WorkflowStateKind,
} from "../shared/workflow_types";

// ---------------------------------------------------------------------------
// tasks.yaml schema (parse-only view)
// ---------------------------------------------------------------------------

/**
 * TasksYamlEntry — tasks.yaml の 1 エントリの読み取り視点。
 *
 * 書き戻しは本 shape ではなく surgical replace で行うため、フィールド追加に寛容。
 */
interface TasksYamlEntry {
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
  status: WorkflowStateKind;
  round: number;
  round_max: number;
  last_feedback: string | null;
  blocker: string | null;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function readTasks(tasksFile: string): TasksYamlEntry[] {
  let raw: string;
  try {
    raw = fs.readFileSync(tasksFile, "utf8");
  } catch (e) {
    throw new Error(`checkpoint read failed: cannot open ${tasksFile}: ${(e as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (e) {
    throw new Error(`checkpoint corrupt: YAML parse error in ${tasksFile}: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`checkpoint corrupt: tasks.yaml must be a top-level list, got ${typeof parsed}`);
  }
  for (const entry of parsed as TasksYamlEntry[]) {
    if (!entry || typeof entry.id !== "string") {
      throw new Error(`checkpoint corrupt: entry missing 'id' field: ${JSON.stringify(entry)}`);
    }
    if (entry.status && !WORKFLOW_STATE_KINDS_SET.has(entry.status)) {
      throw new Error(`checkpoint corrupt: ${entry.id} has unknown status '${entry.status}'`);
    }
  }
  return parsed as TasksYamlEntry[];
}

const WORKFLOW_STATE_KINDS_SET: ReadonlySet<string> = new Set([
  "pending", "ready", "in_progress", "eval_pending",
  "blocked", "sleeping", "escalated", "done", "failed",
]);

/**
 * loadCheckpoint — 単一 task の checkpoint を読む。
 * resume 時の主要 API。タスクが無ければ明示的エラー。
 */
export function loadCheckpoint(tasksFile: string, taskId: string): Checkpoint {
  const entries = readTasks(tasksFile);
  const entry = entries.find((e) => e.id === taskId);
  if (!entry) {
    throw new Error(`checkpoint not found: task ${taskId} absent from ${tasksFile}`);
  }
  return entryToCheckpoint(entry);
}

/**
 * pickNextTask — resume 時に処理すべき次 task を選ぶ。
 * 優先順 (2_session.md §task 選定):
 *   1. status: in_progress（前セッションで中断）
 *   2. status: pending（先頭から phase → id 昇順）
 *   3. すべて terminal/blocked → null (E1 / 完了)
 */
export function pickNextTask(tasksFile: string): TasksYamlEntry | null {
  const entries = readTasks(tasksFile);
  const inProgress = entries.find((e) => e.status === "in_progress");
  if (inProgress) return inProgress;
  const ready = entries.find((e) => e.status === "ready");
  if (ready) return ready;
  const pending = entries
    .filter((e) => e.status === "pending")
    .sort((a, b) => a.phase - b.phase || a.id.localeCompare(b.id));
  return pending[0] ?? null;
}

export function entryToCheckpoint(entry: TasksYamlEntry, commitHash: string | null = null): Checkpoint {
  const state: WorkflowState = {
    kind: entry.status,
    round: entry.round ?? 0,
    roundMax: entry.round_max ?? 3,
    lastFeedback: entry.last_feedback ?? null,
    blocker: entry.blocker ?? null,
    escalationKind: null,
    wakeupAt: null,
    wakeupMechanism: null,
    failureReason: null,
  };
  return {
    taskId: entry.id,
    state,
    savedAt: new Date().toISOString(),
    commitHash,
  };
}

export function readCheckpoints(tasksFile: string): Checkpoint[] {
  return readTasks(tasksFile).map((e) => entryToCheckpoint(e));
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

/**
 * selectEdge — 現 state と受領シグナルに対して ALLOWED_EDGES から 1 辺を選ぶ。
 * 該当 edge が無ければ null を返す（= runner は fail-closed で拒否）。
 */
export function selectEdge(current: WorkflowState, signal: StepSignal): WorkflowEdge | null {
  const from = current.kind;
  const table = ALLOWED_EDGES.filter((e) => e.source === from);

  const byId = (id: EdgeId) => table.find((e) => e.id === id) ?? null;

  switch (signal.kind) {
    case "dependencies_done":
      return byId("E01"); // pending -> ready
    case "dispatch_generator":
      return byId("E02"); // ready -> in_progress
    case "generator_done":
      if (signal.evalRequired) return byId("E03"); // in_progress -> eval_pending
      return signal.objectiveCheckPass ? byId("E04") : null; // in_progress -> done (only on pass)
    case "evaluator_verdict":
      if (signal.pass) return byId("E05"); // eval_pending -> done
      return current.round + 1 <= current.roundMax
        ? byId("E06") // retry
        : byId("E07"); // round_max breach -> blocked
    case "schedule_wakeup":
      return byId("E08"); // in_progress -> sleeping
    case "wakeup_fired":
      return byId("E09"); // sleeping -> ready
    case "escalation_detected":
      if (from === "in_progress") return byId("E10");
      if (from === "eval_pending") return byId("E11");
      return null;
    case "human_approve":
      return byId("E12"); // escalated -> ready
    case "human_reject":
      return byId("E13"); // escalated -> blocked
    case "human_abort":
      if (from === "escalated") return byId("E14");
      if (from === "blocked") return byId("E16");
      return null;
    case "blocker_cleared":
      return byId("E15"); // blocked -> ready
    case "fatal_exception":
      return byId("E17"); // in_progress -> failed
  }
}

// ---------------------------------------------------------------------------
// Step (one transition)
// ---------------------------------------------------------------------------

export interface StepResult {
  edge: WorkflowEdge | null;
  nextState: WorkflowState | null;
  rejected: boolean;
  rejectionReason: string | null;
}

/**
 * stepOnce — 1 遷移だけ計算する。副作用なし（writeback は別関数）。
 * null edge の場合は rejected: true を返す（fail-closed）。
 */
export function stepOnce(current: WorkflowState, signal: StepSignal): StepResult {
  const edge = selectEdge(current, signal);
  if (!edge) {
    return {
      edge: null,
      nextState: null,
      rejected: true,
      rejectionReason: `no allowed edge from '${current.kind}' for signal '${signal.kind}'`,
    };
  }
  const next: WorkflowState = { ...current, kind: edge.target };

  // round bookkeeping
  if (edge.id === "E06") next.round = current.round + 1;
  if (edge.id === "E02" || edge.id === "E09" || edge.id === "E12" || edge.id === "E15") {
    // reset on re-entry to ready / in_progress from non-retry paths is not desired;
    // keep round as-is. E06 increments, E02 keeps (first dispatch).
  }

  // invariant fields
  if (signal.kind === "evaluator_verdict") {
    next.lastFeedback =
      signal.feedback ?? (signal.pass ? "evaluator pass" : "evaluator fail");
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
// Writeback (surgical line-replace to preserve comments / order)
// ---------------------------------------------------------------------------

export interface WritebackPatch {
  taskId: string;
  status: WorkflowStateKind;
  round: number;
  lastFeedback: string | null;
  blocker: string | null;
}

/**
 * applyWriteback — tasks.yaml 内の指定 task のフィールドを surgical に書き戻す。
 *
 * 動作:
 *   1. ファイルを行配列で読む
 *   2. `- id: ${taskId}` で始まる行を探索
 *   3. 次の `- id:` 行（または EOF）までが対象 task 区画
 *   4. 区画内の `  status:` / `  round:` / `  last_feedback:` / `  blocker:` 行を
 *      値だけ置換（インデント・コメント付きコロン後末尾は保持）
 *   5. dryRun なら書き戻さずパッチ本文を返す
 *
 * 構造保持: 行挿入・削除・順序変更はしない。値トークンのみ置換。
 */
export function applyWriteback(
  tasksFile: string,
  patch: WritebackPatch,
  opts: { dryRun: boolean },
): { updated: boolean; newContent: string; hits: string[] } {
  const raw = fs.readFileSync(tasksFile, "utf8");
  const lines = raw.split(/\r?\n/);

  const startIdx = lines.findIndex((l) => /^- id:\s*/.test(l) && l.includes(patch.taskId));
  if (startIdx === -1) {
    throw new Error(`task not found in tasks.yaml: ${patch.taskId}`);
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^- id:\s*/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  const hits: string[] = [];
  const fieldReplacers: Array<{ field: string; value: string }> = [
    { field: "status", value: patch.status },
    { field: "round", value: String(patch.round) },
    {
      field: "last_feedback",
      value: patch.lastFeedback === null ? "null" : JSON.stringify(patch.lastFeedback),
    },
    {
      field: "blocker",
      value: patch.blocker === null ? "null" : JSON.stringify(patch.blocker),
    },
  ];

  for (let i = startIdx; i < endIdx; i++) {
    for (const fr of fieldReplacers) {
      const re = new RegExp(`^(\\s+${fr.field}:\\s*)(.*)$`);
      const m = lines[i].match(re);
      if (m) {
        lines[i] = `${m[1]}${fr.value}`;
        hits.push(fr.field);
      }
    }
  }

  const newContent = lines.join("\n");
  const updated = newContent !== raw;

  if (!opts.dryRun && updated) {
    fs.writeFileSync(tasksFile, newContent, "utf8");
  }
  return { updated, newContent, hits };
}

// ---------------------------------------------------------------------------
// Resume cheatsheet regeneration (T-1-6)
// ---------------------------------------------------------------------------

/**
 * regenerateCheatsheet — tasks.yaml の現状から resume-cheatsheet.md の machine-derivable
 * セクションを書き換える。Manager が手書きで足したナラティブ節は保持するため、
 * `<!-- runner-managed:begin -->` 〜 `<!-- runner-managed:end -->` のマーカ内のみ差し替える。
 */
export function regenerateCheatsheet(tasksFile: string, cheatsheetFile: string): { updated: boolean } {
  const entries = readTasks(tasksFile);
  const phase = entries.find((e) => e.status !== "done" && e.status !== "failed")?.phase ?? entries[entries.length - 1]?.phase ?? 0;
  const next = pickNextTask(tasksFile);
  const byStatus: Record<string, number> = {};
  for (const e of entries) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;

  const block = [
    "<!-- runner-managed:begin -->",
    `<!-- auto-generated by workflow_runner at ${new Date().toISOString()} -->`,
    "",
    `- Phase: ${phase}`,
    `- Next task: ${next ? `\`${next.id}\` (${next.verb} ${next.target}) [status=${next.status}]` : "(none — E1 Phase gate candidate)"}`,
    `- Task status breakdown: ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(", ")}`,
    `- Total tasks: ${entries.length}`,
    "",
    "<!-- runner-managed:end -->",
  ].join("\n");

  let existing = "";
  try { existing = fs.readFileSync(cheatsheetFile, "utf8"); } catch { /* new file */ }

  let newContent: string;
  if (existing.includes("<!-- runner-managed:begin -->") && existing.includes("<!-- runner-managed:end -->")) {
    newContent = existing.replace(
      /<!-- runner-managed:begin -->[\s\S]*?<!-- runner-managed:end -->/,
      block,
    );
  } else if (existing) {
    // prepend if markers absent
    newContent = block + "\n\n" + existing;
  } else {
    newContent = `# Resume Cheatsheet (runner-managed)\n\n${block}\n`;
  }

  if (newContent === existing) return { updated: false };
  fs.writeFileSync(cheatsheetFile, newContent, "utf8");
  return { updated: true };
}

// ---------------------------------------------------------------------------
// High-level run
// ---------------------------------------------------------------------------

export interface RunOneStepInput {
  taskId: string;
  signal: StepSignal;
}

export interface RunOneStepOutput {
  taskId: string;
  fromState: WorkflowState;
  edge: WorkflowEdge | null;
  nextState: WorkflowState | null;
  rejected: boolean;
  rejectionReason: string | null;
  writeback: { updated: boolean; hits: string[] } | null;
}

/**
 * runOneStep — 指定 task に signal を 1 つ適用し、state を進めて tasks.yaml を更新する。
 *
 * idempotency: 同じ current state に同じ signal を与えても、writeback 後に
 * 再度呼ぶと fromState が更新されているため、edge が変わるか null を返す。
 * （checkpoint は tasks.yaml の status がそのまま正本）
 */
export function runOneStep(ctx: RunContext, input: RunOneStepInput): RunOneStepOutput {
  const entries = readTasks(ctx.tasksFile);
  const entry = entries.find((e) => e.id === input.taskId);
  if (!entry) {
    throw new Error(`task not found: ${input.taskId}`);
  }
  const cp = entryToCheckpoint(entry);
  const { edge, nextState, rejected, rejectionReason } = stepOnce(cp.state, input.signal);

  let writeback: { updated: boolean; hits: string[] } | null = null;
  if (!rejected && nextState) {
    const patch: WritebackPatch = {
      taskId: entry.id,
      status: nextState.kind,
      round: nextState.round,
      lastFeedback: nextState.lastFeedback,
      blocker: nextState.blocker,
    };
    const wb = applyWriteback(ctx.tasksFile, patch, { dryRun: ctx.dryRun });
    writeback = { updated: wb.updated, hits: wb.hits };
    if (!ctx.dryRun && wb.updated && ctx.cheatsheetFile) {
      regenerateCheatsheet(ctx.tasksFile, ctx.cheatsheetFile);
    }
  }

  return {
    taskId: input.taskId,
    fromState: cp.state,
    edge,
    nextState,
    rejected,
    rejectionReason,
    writeback,
  };
}

// ---------------------------------------------------------------------------
// Resume helpers (T-1-5)
// ---------------------------------------------------------------------------

/**
 * suggestNextSignal — 現 state から次に受領すべき signal 種別を示唆する。
 * resume 時に Manager / operator が迷わないための hint。enforcement ではない。
 */
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
// Cycle driver (T-1-4): evaluator loop + round enforcement
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
  initial: WorkflowState;
  final: WorkflowState;
  trace: CycleTraceStep[];
  terminated: "done" | "failed" | "blocked" | "escalated" | "sleeping" | "rejected";
}

/**
 * driveCycle — 指定 signals を順に適用する in-memory シミュレータ。副作用なし。
 *
 * terminal / blocked / sleeping / escalated / reject のいずれかで停止。
 * Generator / Evaluator の role 区別はシグナル種 (generator_done / evaluator_verdict) で表現される。
 */
export function driveCycle(initial: WorkflowState, signals: StepSignal[]): CycleResult {
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
    if (r.rejected || !r.nextState) {
      terminated = "rejected";
      break;
    }
    cur = r.nextState;
    if (cur.kind === "done") { terminated = "done"; break; }
    if (cur.kind === "failed") { terminated = "failed"; break; }
    if (cur.kind === "blocked") { terminated = "blocked"; break; }
    if (cur.kind === "escalated") { terminated = "escalated"; break; }
    if (cur.kind === "sleeping") { terminated = "sleeping"; break; }
  }

  return {
    initial,
    final: cur,
    trace,
    terminated: terminated ?? "rejected",
  };
}

/**
 * freshState — synthetic task の初期 state（pending / round=0）。
 */
export function freshState(roundMax: number): WorkflowState {
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

/**
 * runSyntheticDemo — T-1-4 契約のフルサイクル実演。
 *
 * シナリオ A (eval pass 成功系):
 *   pending -> ready -> in_progress -> eval_pending -> done
 *
 * シナリオ B (evaluator fail で round_max breach → blocked):
 *   pending -> ready -> in_progress -> eval_pending -> in_progress(round++) -> eval_pending -> blocked
 *   (roundMax=1 で 2 回目の fail が breach)
 */
export function runSyntheticDemo(): { scenarioA: CycleResult; scenarioB: CycleResult } {
  const sA = driveCycle(freshState(3), [
    { kind: "dependencies_done" },
    { kind: "dispatch_generator" },
    { kind: "generator_done", evalRequired: true, objectiveCheckPass: true },
    { kind: "evaluator_verdict", pass: true, feedback: "all criteria met" },
  ]);

  // E06 は in_progress に直接戻る（再 dispatch は不要。Generator が再起動した扱い）。
  const sB = driveCycle(freshState(1), [
    { kind: "dependencies_done" },
    { kind: "dispatch_generator" },
    { kind: "generator_done", evalRequired: true, objectiveCheckPass: true },
    { kind: "evaluator_verdict", pass: false, feedback: "criterion X missing" },
    { kind: "generator_done", evalRequired: true, objectiveCheckPass: true },
    { kind: "evaluator_verdict", pass: false, feedback: "criterion X still missing" },
  ]);

  return { scenarioA: sA, scenarioB: sB };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  tasksFile: string;
  cheatsheetFile: string;
  taskId: string | null;
  signal: string | null;
  dryRun: boolean;
  resume: boolean;
  inspect: boolean;
  demo: boolean;
} {
  const out = {
    tasksFile: "",
    cheatsheetFile: "",
    taskId: null as string | null,
    signal: null as string | null,
    dryRun: false,
    resume: false,
    inspect: false,
    demo: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tasks") out.tasksFile = argv[++i];
    else if (a === "--cheatsheet") out.cheatsheetFile = argv[++i];
    else if (a === "--task") out.taskId = argv[++i];
    else if (a === "--signal") out.signal = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--resume") out.resume = true;
    else if (a === "--inspect") out.inspect = true;
    else if (a === "--demo") out.demo = true;
  }
  return out;
}

function buildSignal(name: string): StepSignal {
  switch (name) {
    case "dependencies_done":
      return { kind: "dependencies_done" };
    case "dispatch_generator":
      return { kind: "dispatch_generator" };
    case "generator_done_eval":
      return { kind: "generator_done", evalRequired: true, objectiveCheckPass: true };
    case "generator_done_noeval":
      return { kind: "generator_done", evalRequired: false, objectiveCheckPass: true };
    case "evaluator_pass":
      return { kind: "evaluator_verdict", pass: true };
    case "evaluator_fail":
      return { kind: "evaluator_verdict", pass: false };
    case "blocker_cleared":
      return { kind: "blocker_cleared" };
    default:
      throw new Error(`unknown signal: ${name}`);
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.demo) {
    const { scenarioA, scenarioB } = runSyntheticDemo();
    console.log("=== scenario A (eval pass) ===");
    for (const t of scenarioA.trace) {
      console.log(`  ${t.signalKind.padEnd(20)} ${t.from.padEnd(14)} -${t.edge ?? "∅"}-> ${t.to ?? "∅"}  round=${t.round}${t.rejected ? "  REJECTED" : ""}`);
    }
    console.log(`  final=${scenarioA.final.kind} (terminated=${scenarioA.terminated}, round=${scenarioA.final.round}, feedback=${JSON.stringify(scenarioA.final.lastFeedback)})`);
    console.log("");
    console.log("=== scenario B (evaluator fail × round_max=1 → blocked) ===");
    for (const t of scenarioB.trace) {
      console.log(`  ${t.signalKind.padEnd(20)} ${t.from.padEnd(14)} -${t.edge ?? "∅"}-> ${t.to ?? "∅"}  round=${t.round}${t.rejected ? "  REJECTED" : ""}`);
    }
    console.log(`  final=${scenarioB.final.kind} (terminated=${scenarioB.terminated}, round=${scenarioB.final.round}, blocker=${JSON.stringify(scenarioB.final.blocker)})`);
    return;
  }

  if (!args.tasksFile) {
    console.error("usage: workflow_runner --tasks <path> [--cheatsheet <path>] [--task <id> --signal <name>] [--dry-run] [--inspect] [--demo]");
    process.exit(2);
  }

  if (args.inspect) {
    const cps = readCheckpoints(args.tasksFile);
    for (const cp of cps) {
      console.log(`${cp.taskId.padEnd(8)} ${cp.state.kind.padEnd(14)} round=${cp.state.round}/${cp.state.roundMax}`);
    }
    return;
  }

  if (args.resume) {
    const next = pickNextTask(args.tasksFile);
    if (!next) {
      console.log("RESUME: no next task (all terminal or blocked). E1 Phase gate candidate.");
      return;
    }
    const cp = loadCheckpoint(args.tasksFile, next.id);
    const expected = suggestNextSignal(cp.state.kind);
    console.log(`RESUME: ${cp.taskId} status=${cp.state.kind} round=${cp.state.round}/${cp.state.roundMax}`);
    console.log(`  last_feedback: ${cp.state.lastFeedback ?? "(none)"}`);
    console.log(`  blocker: ${cp.state.blocker ?? "(none)"}`);
    console.log(`  expected next signal class: ${expected}`);
    return;
  }

  if (!args.taskId || !args.signal) {
    console.error("require --task and --signal (or --inspect)");
    process.exit(2);
  }

  const ctx: RunContext = {
    tasksFile: path.resolve(args.tasksFile),
    cheatsheetFile: args.cheatsheetFile ? path.resolve(args.cheatsheetFile) : "",
    dryRun: args.dryRun,
    resume: args.resume,
    startedAt: new Date().toISOString(),
    stopReason: null,
  };
  const out = runOneStep(ctx, { taskId: args.taskId, signal: buildSignal(args.signal) });

  if (out.rejected) {
    console.error(`REJECTED: ${out.rejectionReason}`);
    process.exit(1);
  }
  console.log(`${out.taskId}: ${out.fromState.kind} -> ${out.nextState?.kind} (edge=${out.edge?.id}, dryRun=${ctx.dryRun})`);
  if (out.writeback) {
    console.log(`  writeback: updated=${out.writeback.updated}, fields=[${out.writeback.hits.join(",")}]`);
  }
}

if (require.main === module) {
  main();
}
