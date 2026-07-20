/**
 * T-2-2 test — Orchestrator shell 動作検証
 *
 * 検査:
 *  1. MockSubagentAdapter で Generator/Evaluator を stub し、
 *     orchestrateOnce が state に応じて正しい signal を発行
 *  2. ready → in_progress → eval_pending → done の 3 step 駆動
 *  3. Evaluator fail → round インクリメント → retry が signal ベースで成立
 *  4. FeedbackHook が Hermes 的に feedback を変換
 *  5. initCheckpointFor が新 task の checkpoint を生成（idempotent）
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { FixedClock } from "../shared/clock";
import { ReviewResolver } from "../shared/resolvers";
import {
  SubagentAdapter,
  GeneratorRequest,
  GeneratorResult,
  EvaluatorRequest,
  EvaluatorResult,
  initCheckpointFor,
  orchestrateOnce,
  orchestrateLoop,
} from "./workflow_orchestrator";
import {
  ReducerContext,
  loadCheckpointState,
  saveCheckpointState,
} from "./workflow_reducer";
import type { WorkflowStateCamel } from "../shared/checkpoint_types";
import type { WorkflowStateKind } from "../shared/workflow_types";

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) console.log(`  [PASS] ${msg}`);
  else { failures++; console.error(`  [FAIL] ${msg}`); }
}

function makeTempPj() {
  const root = path.join(os.tmpdir(), `pj03-t22-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(path.join(root, "runtime", "checkpoints"), { recursive: true });
  return { root, tasks: path.join(root, "tasks.yaml"), runtime: path.join(root, "runtime") };
}

function writeTasks(tasksFile: string, entries: Array<{ id: string; deps?: string[]; eval_required?: boolean }>): void {
  const lines: string[] = [];
  for (const e of entries) {
    lines.push(`- id: ${e.id}`);
    lines.push(`  phase: 0`);
    lines.push(`  verb: test`);
    lines.push(`  target: "${e.id}-target"`);
    lines.push(`  done_when: ["d1", "d2"]`);
    lines.push(`  eval_required: ${e.eval_required ?? true}`);
    lines.push(`  eval_criteria: ["c1"]`);
    lines.push(`  round_max: 3`);
    lines.push(`  dependencies: ${JSON.stringify(e.deps ?? [])}`);
    lines.push(`  linked_review: null`);
    lines.push("");
  }
  fs.writeFileSync(tasksFile, lines.join("\n"), "utf8");
}

function stateOf(kind: WorkflowStateKind, overrides: Partial<WorkflowStateCamel> = {}): WorkflowStateCamel {
  return {
    kind, round: 0, roundMax: 3,
    lastFeedback: null, blocker: null,
    escalationKind: null, wakeupAt: null, wakeupMechanism: null, failureReason: null,
    graphPosition: null,
    ...overrides,
  };
}

class MockAdapter implements SubagentAdapter {
  public genCalls: GeneratorRequest[] = [];
  public evalCalls: EvaluatorRequest[] = [];
  constructor(
    private readonly genResult: (r: GeneratorRequest) => GeneratorResult,
    private readonly evalResult: (r: EvaluatorRequest) => EvaluatorResult,
  ) {}
  runGenerator(req: GeneratorRequest): GeneratorResult { this.genCalls.push(req); return this.genResult(req); }
  runEvaluator(req: EvaluatorRequest): EvaluatorResult { this.evalCalls.push(req); return this.evalResult(req); }
}

const nullReviewResolver: ReviewResolver = { resolve: () => "unknown" };

function test1_fullCycleHappyPath(): void {
  console.log("test 1: ready → in_progress → eval_pending → done (happy path)");
  const { tasks, runtime } = makeTempPj();
  writeTasks(tasks, [{ id: "T-HP", eval_required: true }]);
  saveCheckpointState(runtime, "T-HP", stateOf("ready"));
  const adapter = new MockAdapter(
    () => ({ kind: "done", summary: "generator produced artifact" }),
    () => ({ pass: true, feedback: "all criteria met" }),
  );
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const deps = { adapter, clock: new FixedClock(new Date()), reviewResolver: nullReviewResolver };

  const s1 = orchestrateOnce(ctx, deps);
  assert(s1.action === "generator_dispatched", "step1: generator_dispatched");
  assert(s1.toKind === "in_progress", "step1: ready → in_progress");
  const s2 = orchestrateOnce(ctx, deps);
  assert(s2.action === "advanced", "step2: advanced via generator result");
  assert(s2.toKind === "eval_pending", "step2: in_progress → eval_pending");
  assert(adapter.genCalls.length === 1, "Generator called once");
  const s3 = orchestrateOnce(ctx, deps);
  assert(s3.action === "evaluator_dispatched", "step3: evaluator");
  assert(s3.toKind === "done", "step3: eval_pending → done");
  assert(adapter.evalCalls.length === 1, "Evaluator called once");
  const cp = loadCheckpointState(runtime, "T-HP");
  assert(cp.kind === "done", "final state = done");
  assert(cp.lastFeedback === "all criteria met", "feedback persisted");
}

function test2_evaluatorFailRetry(): void {
  console.log("test 2: Evaluator fail → round++ → retry");
  const { tasks, runtime } = makeTempPj();
  writeTasks(tasks, [{ id: "T-RT", eval_required: true }]);
  saveCheckpointState(runtime, "T-RT", stateOf("eval_pending", { round: 0, roundMax: 3, lastFeedback: "gen output" }));
  let evalPassCount = 0;
  const adapter = new MockAdapter(
    () => ({ kind: "done", summary: "re-gen" }),
    () => {
      evalPassCount++;
      return evalPassCount === 1
        ? { pass: false, feedback: "missing X" }
        : { pass: true, feedback: "added X" };
    },
  );
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const deps = { adapter, clock: new FixedClock(new Date()), reviewResolver: nullReviewResolver };

  const s1 = orchestrateOnce(ctx, deps);
  assert(s1.toKind === "in_progress", "fail → in_progress retry");
  const cp1 = loadCheckpointState(runtime, "T-RT");
  assert(cp1.round === 1, "round incremented to 1");
  assert(cp1.lastFeedback === "missing X", "fail feedback persisted");

  const s2 = orchestrateOnce(ctx, deps);
  assert(s2.toKind === "eval_pending", "retry generator_done → eval_pending");
  const s3 = orchestrateOnce(ctx, deps);
  assert(s3.toKind === "done", "pass on round 1 → done");
}

function test3_feedbackHookTransforms(): void {
  console.log("test 3: FeedbackHook が prior feedback を変換");
  const { tasks, runtime } = makeTempPj();
  writeTasks(tasks, [{ id: "T-FB", eval_required: true }]);
  saveCheckpointState(runtime, "T-FB", stateOf("in_progress", { round: 1, lastFeedback: "criterion X missing" }));
  let seenFeedback: string | null = null;
  const adapter = new MockAdapter(
    (req: GeneratorRequest) => { seenFeedback = req.priorFeedback; return { kind: "done", summary: "gen" }; },
    () => ({ pass: true, feedback: "ok" }),
  );
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const deps = {
    adapter,
    clock: new FixedClock(new Date()),
    reviewResolver: nullReviewResolver,
    feedbackHook: { transformPriorFeedback: (s: string) => `[hermes-wrapped] ${s}` },
  };

  orchestrateOnce(ctx, deps);
  assert(seenFeedback === "[hermes-wrapped] criterion X missing", "feedback transformed by hook");
}

function test4_initCheckpointIdempotent(): void {
  console.log("test 4: initCheckpointFor は既存ファイルを上書きしない");
  const { runtime } = makeTempPj();
  const r1 = initCheckpointFor(runtime, "T-NEW", 3);
  assert(r1.created === true, "1回目: created=true");
  const cp = loadCheckpointState(runtime, "T-NEW");
  assert(cp.kind === "pending", "初期 state = pending");
  assert(cp.roundMax === 3, "roundMax 保存");

  // 書き換えてから再 initCheckpointFor
  saveCheckpointState(runtime, "T-NEW", stateOf("done"));
  const r2 = initCheckpointFor(runtime, "T-NEW", 3);
  assert(r2.created === false, "2回目: created=false (既存保護)");
  const cp2 = loadCheckpointState(runtime, "T-NEW");
  assert(cp2.kind === "done", "上書きされない");
}

function test5_loopTerminatesOnNoTask(): void {
  console.log("test 5: orchestrateLoop は no_task で停止");
  const { tasks, runtime } = makeTempPj();
  writeTasks(tasks, [{ id: "T-D", eval_required: false }]);
  saveCheckpointState(runtime, "T-D", stateOf("done"));
  const adapter = new MockAdapter(
    () => ({ kind: "done", summary: "" }),
    () => ({ pass: true, feedback: "" }),
  );
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const results = orchestrateLoop(ctx, { adapter, clock: new FixedClock(new Date()), reviewResolver: nullReviewResolver }, { maxIterations: 10 });
  assert(results.length === 1 && results[0]?.action === "no_task", "no_task で 1 iter 後停止");
}

function main(): void {
  test1_fullCycleHappyPath();
  test2_evaluatorFailRetry();
  test3_feedbackHookTransforms();
  test4_initCheckpointIdempotent();
  test5_loopTerminatesOnNoTask();

  if (failures > 0) {
    console.error(`\n[T-2-2 TEST] FAIL (${failures})`);
    process.exit(1);
  }
  console.log(`\n[T-2-2 TEST] PASS — orchestrator shell + adapter + initCheckpoint validated`);
}

main();
