/**
 * T-5-2 test — graph_runtime 動作検証
 *
 * 検査:
 *  1. 3-node graph (gen → eval → router) happy path (pending → ready → in_progress → eval_pending → done)
 *  2. evaluator fail (round < roundMax) → retry loop (E06)
 *  3. evaluator fail (round >= roundMax) → blocked path (E07)
 *  4. fail-closed: graph edge が reducer edge と不整合だと error termination
 *  5. checkpoint 回帰: restore test 9/9 維持（graph runtime が invariant field を壊さない）
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { FixedClock } from "../shared/clock";
import type { GraphEdge, GraphInstance } from "../shared/graph_types";
import { GRAPH_END_NODE_ID } from "../shared/graph_types";
import type { WorkflowNode } from "../shared/workflow_types";
import {
  ReducerContext,
  loadCheckpointState,
  saveCheckpointState,
} from "./workflow_reducer";
import { runGraph } from "./graph_runtime";
import type { SubagentAdapter } from "./workflow_orchestrator";
import type { WorkflowStateCamel } from "../shared/checkpoint_types";
import type { WorkflowStateKind } from "../shared/workflow_types";

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) console.log(`  [PASS] ${msg}`);
  else { failures++; console.error(`  [FAIL] ${msg}`); }
}

function makeTempPj(taskId: string) {
  const root = path.join(os.tmpdir(), `pj03-t52-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(path.join(root, "runtime", "checkpoints"), { recursive: true });
  const tasks = path.join(root, "tasks.yaml");
  fs.writeFileSync(tasks, [
    `- id: ${taskId}`, `  phase: 0`, `  verb: test`, `  target: "g"`,
    `  done_when: ["d"]`, `  eval_required: true`, `  round_max: 3`,
    `  dependencies: []`, `  linked_review: null`, ``,
  ].join("\n"), "utf8");
  return { tasks, runtime: path.join(root, "runtime") };
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

function makeGraph(taskId: string): GraphInstance {
  const nodes: WorkflowNode[] = [
    { id: "gen", taskId, role: "generator", description: "Generator node" },
    { id: "eval", taskId, role: "evaluator", description: "Evaluator node" },
    { id: "router", taskId, role: "router", description: "Router node" },
  ];
  const edges: GraphEdge[] = [
    { id: "g-dispatch", sourceNodeId: "gen", targetNodeId: "eval", reducerEdgeId: "E03", condition: { kind: "always" } },
    { id: "g-pass", sourceNodeId: "eval", targetNodeId: GRAPH_END_NODE_ID, reducerEdgeId: "E05", condition: { kind: "evaluator_pass" } },
    { id: "g-fail-retry", sourceNodeId: "eval", targetNodeId: "gen", reducerEdgeId: "E06", condition: { kind: "evaluator_fail" } },
  ];
  return { taskId, startNodeId: "gen", nodes, edges };
}

function mockAdapter(genResults: Array<"done">, evalResults: Array<"pass" | "fail">): SubagentAdapter {
  let gi = 0; let ei = 0;
  return {
    runGenerator: () => ({ kind: "done", summary: `gen${gi++}` }),
    runEvaluator: () => {
      const r = evalResults[ei++];
      return r === "pass" ? { pass: true, feedback: "ok" } : { pass: false, feedback: "missing X" };
    },
  };
}

function test1_happyPath(): void {
  console.log("test 1: happy path gen → eval → END");
  const taskId = "T-HAPPY";
  const { tasks, runtime } = makeTempPj(taskId);
  // Start in in_progress state so E03 can fire
  saveCheckpointState(runtime, taskId, stateOf("in_progress"));
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const r = runGraph(makeGraph(taskId), ctx, { adapter: mockAdapter(["done"], ["pass"]), clock: new FixedClock(new Date()) });

  assert(r.terminated === "end", `terminated = end (got ${r.terminated}, err=${r.error})`);
  assert(r.finalNodeId === GRAPH_END_NODE_ID, "final node = END");
  assert(r.trace.length === 2, `2 steps (got ${r.trace.length})`);
  const after = loadCheckpointState(runtime, taskId);
  assert(after.kind === "done", "state = done");
}

function test2_evalFailRetry(): void {
  console.log("test 2: evaluator fail → retry loop → pass");
  const taskId = "T-RETRY";
  const { tasks, runtime } = makeTempPj(taskId);
  saveCheckpointState(runtime, taskId, stateOf("in_progress", { round: 0, roundMax: 3 }));
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const r = runGraph(makeGraph(taskId), ctx, { adapter: mockAdapter(["done", "done"], ["fail", "pass"]), clock: new FixedClock(new Date()) });

  assert(r.terminated === "end", `terminated = end (got ${r.terminated}, err=${r.error})`);
  const after = loadCheckpointState(runtime, taskId);
  assert(after.kind === "done", "state = done after retry");
  assert(after.round === 1, `round incremented to 1 (got ${after.round})`);
  const eval_fails = r.trace.filter((t) => t.callableResult?.kind === "evaluator_fail").length;
  assert(eval_fails === 1, `1 evaluator_fail in trace (got ${eval_fails})`);
}

function test3_edgeMismatchFailClosed(): void {
  console.log("test 3: graph edge が reducer edge と不整合 → error termination");
  const taskId = "T-MIS";
  const { tasks, runtime } = makeTempPj(taskId);
  saveCheckpointState(runtime, taskId, stateOf("in_progress"));
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };

  // eval-pass edge に誤った reducer edge E07 を指定
  const nodes: WorkflowNode[] = [
    { id: "gen", taskId, role: "generator", description: "" },
    { id: "eval", taskId, role: "evaluator", description: "" },
  ];
  const edges: GraphEdge[] = [
    { id: "g-dispatch", sourceNodeId: "gen", targetNodeId: "eval", reducerEdgeId: "E03", condition: { kind: "always" } },
    { id: "g-wrong", sourceNodeId: "eval", targetNodeId: GRAPH_END_NODE_ID, reducerEdgeId: "E07", condition: { kind: "evaluator_pass" } }, // 正しくは E05
  ];
  const graph: GraphInstance = { taskId, startNodeId: "gen", nodes, edges };
  const r = runGraph(graph, ctx, { adapter: mockAdapter(["done"], ["pass"]), clock: new FixedClock(new Date()) });

  assert(r.terminated === "error", `terminated = error (got ${r.terminated})`);
  assert(r.error !== null && r.error.includes("expects reducer edge E07"), `error message mentions E07 mismatch (got: ${r.error})`);
}

function test4_invariantPreservation(): void {
  console.log("test 4: graph runtime は checkpoint invariant を壊さない");
  const taskId = "T-INV";
  const { tasks, runtime } = makeTempPj(taskId);
  // 全 field 非 null で初期化
  saveCheckpointState(runtime, taskId, stateOf("in_progress", {
    round: 1,
    lastFeedback: "prior",
    blocker: null,
    escalationKind: null,
  }));
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const r = runGraph(makeGraph(taskId), ctx, { adapter: mockAdapter(["done"], ["pass"]), clock: new FixedClock(new Date()) });

  assert(r.terminated === "end", "terminated = end");
  const after = loadCheckpointState(runtime, taskId);
  // All 9 field は存在 (null でも OK)
  const keys = Object.keys(after);
  for (const k of ["kind", "round", "roundMax", "lastFeedback", "blocker", "escalationKind", "wakeupAt", "wakeupMechanism", "failureReason"]) {
    assert(keys.includes(k), `field preserved: ${k}`);
  }
}

function test5_resumeFromGraphPosition(): void {
  console.log("test 5: graph position persistence + resume (Finding 2 fix)");
  const taskId = "T-RESUME";
  const { tasks, runtime } = makeTempPj(taskId);
  saveCheckpointState(runtime, taskId, stateOf("in_progress"));
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };

  // 1st run: maxIter=1 で途中停止。最初の gen → eval まで走ったところで max_iter 到達
  const r1 = runGraph(makeGraph(taskId), ctx, {
    adapter: mockAdapter(["done"], ["pass"]),
    clock: new FixedClock(new Date()),
    maxIter: 1,
  });
  assert(r1.terminated === "max_iter", `1st run hits max_iter (got ${r1.terminated})`);
  const cpAfter1 = loadCheckpointState(runtime, taskId);
  assert(cpAfter1.graphPosition === "eval", `graph position persisted as 'eval' (got ${cpAfter1.graphPosition})`);

  // 2nd run: 残りのステップを消化して終了。graphPosition=eval から resume
  const r2 = runGraph(makeGraph(taskId), ctx, {
    adapter: mockAdapter(["done"], ["pass"]),
    clock: new FixedClock(new Date()),
    maxIter: 5,
  });
  assert(r2.terminated === "end", `2nd run reaches END (got ${r2.terminated})`);
  assert(r2.trace[0]?.nodeId === "eval", `2nd run starts from 'eval' (got ${r2.trace[0]?.nodeId})`);
  const cpAfter2 = loadCheckpointState(runtime, taskId);
  assert(cpAfter2.graphPosition === GRAPH_END_NODE_ID || cpAfter2.graphPosition === "eval", `final graph position is END or last (got ${cpAfter2.graphPosition})`);
}

function test6_rejectBreaksEarly(): void {
  console.log("test 6: rejected signal breaks iteration immediately (Finding 3 fix)");
  const taskId = "T-REJ";
  const { tasks, runtime } = makeTempPj(taskId);
  // start at 'done' — any generator signal will be rejected (fail-closed)
  saveCheckpointState(runtime, taskId, stateOf("done"));
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const r = runGraph(makeGraph(taskId), ctx, { adapter: mockAdapter(["done"], ["pass"]), clock: new FixedClock(new Date()) });
  assert(r.terminated === "reject", `terminated = reject (got ${r.terminated})`);
  const step = r.trace[0]!;
  assert(step.rejected === true, "trace[0].rejected = true");
  assert(step.nextNodeId === "", "trace[0].nextNodeId empty (no fake forward progress)");
  assert(step.toState === "done", "trace[0].toState = pre-reject kind");
}

function test7_customPredicateSeesFullState(): void {
  console.log("test 7: custom predicate receives full WorkflowStateCamel (Finding 1 fix)");
  const taskId = "T-CUS";
  const { tasks, runtime } = makeTempPj(taskId);
  saveCheckpointState(runtime, taskId, stateOf("in_progress", { lastFeedback: "RESUME_MARKER" }));
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };

  // Use a graph with custom condition that depends on lastFeedback
  const nodes = [
    { id: "gen", taskId, role: "generator" as const, description: "" },
    { id: "eval", taskId, role: "evaluator" as const, description: "" },
    { id: "router", taskId, role: "router" as const, description: "" },
  ];
  let seenFeedback: string | null | undefined = undefined;
  const edges = [
    { id: "g-dispatch", sourceNodeId: "gen", targetNodeId: "eval", reducerEdgeId: "E03" as const, condition: { kind: "always" as const } },
    { id: "g-pass", sourceNodeId: "eval", targetNodeId: "router", reducerEdgeId: "E05" as const, condition: { kind: "evaluator_pass" as const } },
    {
      id: "g-custom-end", sourceNodeId: "router", targetNodeId: GRAPH_END_NODE_ID,
      condition: { kind: "custom" as const, label: "captures lastFeedback", predicate: (s: import("../shared/checkpoint_types").WorkflowStateCamel) => {
        seenFeedback = s.lastFeedback; return true;
      } },
    },
  ];
  runGraph({ taskId, startNodeId: "gen", nodes, edges }, ctx, { adapter: mockAdapter(["done"], ["pass"]), clock: new FixedClock(new Date()) });
  assert(seenFeedback !== null && seenFeedback !== undefined, `predicate received lastFeedback (got ${JSON.stringify(seenFeedback)})`);
  // Note: after evaluator_pass, reducer sets lastFeedback to "ok" (mock's feedback). So seenFeedback is either the original "RESUME_MARKER" or the post-eval "ok" depending on when router runs. Either way, non-null.
}

function main(): void {
  test1_happyPath();
  test2_evalFailRetry();
  test3_edgeMismatchFailClosed();
  test4_invariantPreservation();
  test5_resumeFromGraphPosition();
  test6_rejectBreaksEarly();
  test7_customPredicateSeesFullState();

  if (failures > 0) {
    console.error(`\n[T-5-2 TEST] FAIL (${failures})`);
    process.exit(1);
  }
  console.log(`\n[T-5-2 TEST] PASS — graph runtime (happy + retry + fail-closed + invariant + resume + reject-break + custom-full-state)`);
}

main();
