/**
 * PJ03 SelfDrive — workflow orchestrator shell (T-2-2)
 *
 * 責務:
 *   - pickNextTask の結果を見て、state に応じて Generator / Evaluator を spawn する
 *   - subagent の verdict を受けて reducer.runOneStep に signal を注入する
 *   - Hermes 的な feedback chain の差し込み hook を露出
 *
 * 非責務:
 *   - state 遷移そのもの (reducer)
 *   - checkpoint JSON の直接書き換え (reducer 経由)
 *   - Clock / wakeup (clock_daemon T-2-1)
 *   - 実際の Anthropic API 呼び出し (SubagentAdapter を caller が供給)
 *
 * テスト容易性:
 *   - SubagentAdapter を interface として abstract 化
 *   - test では MockSubagentAdapter で Generator/Evaluator を stub
 *   - orchestrator loop は purely functional: adapter を input に取り、
 *     reducer API を呼ぶだけ。副作用は reducer の persistence adapter 経由のみ
 */

import { Clock, SystemClock } from "../shared/clock";
import {
  ReducerContext,
  RunOneStepDeps,
  StepSignal,
  TasksFileDependencyResolver,
  TaskView,
  loadAllTaskViews,
  loadCheckpointState,
  pickNextTask,
  runOneStep,
} from "./workflow_reducer";
import { ReviewResolver } from "../shared/resolvers";

// ---------------------------------------------------------------------------
// SubagentAdapter — Generator / Evaluator の起動を抽象化
// ---------------------------------------------------------------------------

export interface GeneratorRequest {
  taskId: string;
  contractVerb: string;
  contractTarget: string;
  doneWhen: string[];
  priorFeedback: string | null;
  round: number;
}

export interface GeneratorResult {
  kind: "done" | "schedule_wakeup" | "escalation" | "fatal";
  summary: string;
  wakeupAt?: string;
  wakeupMechanism?: "one-shot" | "cron";
  escalation?: "E1" | "E2" | "E3";
  failureReason?: string;
}

export interface EvaluatorRequest {
  taskId: string;
  doneWhen: string[];
  evalCriteria: string[];
  generatorSummary: string;
  round: number;
}

export interface EvaluatorResult {
  pass: boolean;
  feedback: string;
}

export interface SubagentAdapter {
  runGenerator(req: GeneratorRequest): GeneratorResult;
  runEvaluator(req: EvaluatorRequest): EvaluatorResult;
}

// ---------------------------------------------------------------------------
// Hermes-style feedback hook — 次 round の Generator に feedback を渡す
// ---------------------------------------------------------------------------

export interface FeedbackHook {
  /**
   * 前 round の evaluator fail feedback を次 round の generator prompt に
   * どう組み込むかを caller 側で差し替えられる拡張点。Phase 2 では実装不要、
   * interface だけ露出して Phase 2 以降の Hermes ループ実装時に差し込む。
   */
  transformPriorFeedback?(rawFeedback: string): string;
}

// ---------------------------------------------------------------------------
// orchestrate() — 1 task を 1 step 進める
// ---------------------------------------------------------------------------

export interface OrchestrateDeps {
  adapter: SubagentAdapter;
  clock?: Clock;
  reviewResolver?: ReviewResolver;
  feedbackHook?: FeedbackHook;
}

export interface OrchestrateStepResult {
  taskId: string | null;
  action:
    | "no_task"
    | "generator_dispatched"
    | "evaluator_dispatched"
    | "advanced"
    | "rejected";
  signal?: StepSignal;
  fromKind?: string;
  toKind?: string;
  edge?: string;
  rejectionReason?: string;
}

/**
 * orchestrateOnce — pickNextTask で 1 task を選び、state に応じて
 * Generator or Evaluator を呼び、verdict を signal として reducer に渡す。
 */
export function orchestrateOnce(ctx: ReducerContext, deps: OrchestrateDeps): OrchestrateStepResult {
  const clock = deps.clock ?? new SystemClock();
  const depResolver = new TasksFileDependencyResolver(ctx.tasksFile, ctx.runtimeDir);
  const next = pickNextTask(ctx.tasksFile, ctx.runtimeDir, depResolver);
  if (!next) return { taskId: null, action: "no_task" };

  const { contract, state } = next;

  switch (state.kind) {
    case "ready": {
      // Dispatch Generator: ready → in_progress
      const signal: StepSignal = { kind: "dispatch_generator" };
      const r = runStep(ctx, next, signal, deps);
      return {
        taskId: contract.id,
        action: "generator_dispatched",
        signal,
        fromKind: "ready",
        toKind: r.nextState?.kind,
        edge: r.edge?.id,
      };
    }

    case "in_progress": {
      // Generator を実行し結果を受けて signal を決める
      const priorFeedback = state.lastFeedback
        ? (deps.feedbackHook?.transformPriorFeedback?.(state.lastFeedback) ?? state.lastFeedback)
        : null;
      const gr = deps.adapter.runGenerator({
        taskId: contract.id,
        contractVerb: contract.verb,
        contractTarget: contract.target,
        doneWhen: contract.done_when,
        priorFeedback,
        round: state.round,
      });
      let signal: StepSignal;
      if (gr.kind === "done") {
        signal = {
          kind: "generator_done",
          evalRequired: contract.eval_required,
          objectiveCheckPass: true,
        };
      } else if (gr.kind === "schedule_wakeup") {
        signal = {
          kind: "schedule_wakeup",
          wakeupAt: gr.wakeupAt ?? clock.now().toISOString(),
          mechanism: gr.wakeupMechanism ?? "one-shot",
        };
      } else if (gr.kind === "escalation") {
        signal = { kind: "escalation_detected", escalation: gr.escalation ?? "E2" };
      } else {
        signal = { kind: "fatal_exception", reason: gr.failureReason ?? "unspecified" };
      }
      const r = runStep(ctx, next, signal, deps);
      return {
        taskId: contract.id,
        action: "advanced",
        signal,
        fromKind: "in_progress",
        toKind: r.nextState?.kind,
        edge: r.edge?.id,
      };
    }

    case "eval_pending": {
      const er = deps.adapter.runEvaluator({
        taskId: contract.id,
        doneWhen: contract.done_when,
        evalCriteria: contract.eval_criteria ?? [],
        generatorSummary: state.lastFeedback ?? "",
        round: state.round,
      });
      const signal: StepSignal = {
        kind: "evaluator_verdict",
        pass: er.pass,
        feedback: er.feedback,
      };
      const r = runStep(ctx, next, signal, deps);
      return {
        taskId: contract.id,
        action: "evaluator_dispatched",
        signal,
        fromKind: "eval_pending",
        toKind: r.nextState?.kind,
        edge: r.edge?.id,
      };
    }

    default:
      return {
        taskId: contract.id,
        action: "no_task",
        rejectionReason: `state '${state.kind}' is not orchestrator-driven (awaits tick or human signal)`,
      };
  }
}

function runStep(
  ctx: ReducerContext,
  view: TaskView,
  signal: StepSignal,
  deps: OrchestrateDeps,
): { edge?: { id: string } | null; nextState?: { kind: string } | null } {
  const runDeps: RunOneStepDeps = {
    clock: deps.clock,
    reviewResolver: deps.reviewResolver,
  };
  const out = runOneStep(ctx, { taskId: view.contract.id, signal }, runDeps);
  return { edge: out.edge, nextState: out.nextState };
}

// ---------------------------------------------------------------------------
// initCheckpoint — Qn4 対応: 新 task の checkpoint を生成する reducer helper
// ---------------------------------------------------------------------------

/**
 * initCheckpointFor — 新 task の checkpoint JSON を初期 pending で生成する。
 * 既存ファイルがある場合は上書きしない (idempotent)。
 *
 * Qn4_migrate_script_regression の対処: 旧 migrate script を廃止し、
 * 新 task の checkpoint 生成はここから呼ぶ運用にする。
 */
export function initCheckpointFor(
  runtimeDir: string,
  taskId: string,
  roundMax: number,
  clock: Clock = new SystemClock(),
): { created: boolean } {
  const path = require("path");
  const fs = require("fs");
  const cpPath = path.join(runtimeDir, "checkpoints", `${taskId}.json`);
  if (fs.existsSync(cpPath)) return { created: false };
  fs.mkdirSync(path.dirname(cpPath), { recursive: true });
  const file = {
    schema_version: 1,
    task_id: taskId,
    updated_at: clock.now().toISOString(),
    state: {
      kind: "pending" as const,
      round: 0,
      round_max: roundMax,
      last_feedback: null,
      blocker: null,
      escalation_kind: null,
      wakeup_at: null,
      wakeup_mechanism: null,
      failure_reason: null,
    },
  };
  fs.writeFileSync(cpPath, JSON.stringify(file, null, 2) + "\n", "utf8");
  return { created: true };
}

// ---------------------------------------------------------------------------
// orchestrator loop (optional) — run until no progress or N iterations
// ---------------------------------------------------------------------------

export interface LoopOptions {
  maxIterations: number;
}

export function orchestrateLoop(
  ctx: ReducerContext,
  deps: OrchestrateDeps,
  opts: LoopOptions,
): OrchestrateStepResult[] {
  const results: OrchestrateStepResult[] = [];
  for (let i = 0; i < opts.maxIterations; i++) {
    const r = orchestrateOnce(ctx, deps);
    results.push(r);
    if (r.action === "no_task") break;
    // detect stuck cycle: same task + no state change (edge is null)
    if (!r.edge) break;
  }
  return results;
}
