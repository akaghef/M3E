/**
 * T-5-3 dogfood_run_04 — 3-node G→E→R graph を runGraph で 1 本回す
 *
 * scenarios:
 *  1. happy path: pass で END
 *  2. retry path: fail 1 回 → retry → pass で END
 *
 * 各 scenario で trace を dump し、router node が graph edge の custom condition で
 * 次 node を決めることを示す。checkpoint JSON / tasks.yaml の invariant は維持される。
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { FixedClock } from "../shared/clock";
import type { GraphEdge, GraphInstance, GraphRunResult } from "../shared/graph_types";
import { GRAPH_END_NODE_ID } from "../shared/graph_types";
import type { WorkflowNode } from "../shared/workflow_types";
import {
  ReducerContext,
  saveCheckpointState,
} from "./workflow_reducer";
import { runGraph } from "./graph_runtime";
import type { SubagentAdapter } from "./workflow_orchestrator";
import type { WorkflowStateCamel } from "../shared/checkpoint_types";
import type { WorkflowStateKind } from "../shared/workflow_types";

function setup(taskId: string): ReducerContext {
  const root = path.join(os.tmpdir(), `pj03-dogfood-04-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(path.join(root, "runtime", "checkpoints"), { recursive: true });
  const tasks = path.join(root, "tasks.yaml");
  fs.writeFileSync(tasks, [
    `- id: ${taskId}`, `  phase: 5`, `  verb: dogfood`, `  target: "graph runtime"`,
    `  done_when: ["graph end"]`, `  eval_required: true`, `  round_max: 3`,
    `  dependencies: []`, `  linked_review: null`, ``,
  ].join("\n"), "utf8");
  return { tasksFile: tasks, runtimeDir: path.join(root, "runtime"), cheatsheetFile: "", dryRun: false };
}

function state(kind: WorkflowStateKind, overrides: Partial<WorkflowStateCamel> = {}): WorkflowStateCamel {
  return {
    kind, round: 0, roundMax: 3,
    lastFeedback: null, blocker: null,
    escalationKind: null, wakeupAt: null, wakeupMechanism: null, failureReason: null,
    graphPosition: null,
    ...overrides,
  };
}

function buildGERGraph(taskId: string): GraphInstance {
  const nodes: WorkflowNode[] = [
    { id: "gen", taskId, role: "generator", description: "Generator: produce artifact for the task" },
    { id: "eval", taskId, role: "evaluator", description: "Evaluator: verify done_when + eval_criteria" },
    { id: "router", taskId, role: "router", description: "Router: branch on post-eval state" },
  ];
  const edges: GraphEdge[] = [
    // gen → eval, always, via E03 in_progress → eval_pending
    { id: "E-gen-eval", sourceNodeId: "gen", targetNodeId: "eval", reducerEdgeId: "E03", condition: { kind: "always" } },
    // eval → router, conditional on verdict. reducer edge E05 (pass) or E06 (fail)
    { id: "E-eval-router-pass", sourceNodeId: "eval", targetNodeId: "router", reducerEdgeId: "E05", condition: { kind: "evaluator_pass" } },
    { id: "E-eval-router-fail", sourceNodeId: "eval", targetNodeId: "router", reducerEdgeId: "E06", condition: { kind: "evaluator_fail" } },
    // router → END (when state is done) or → gen (when back to in_progress after retry)
    { id: "E-router-end", sourceNodeId: "router", targetNodeId: GRAPH_END_NODE_ID, condition: { kind: "custom", label: "state.kind === done", predicate: (s) => s.kind === "done" } },
    { id: "E-router-gen", sourceNodeId: "router", targetNodeId: "gen", condition: { kind: "custom", label: "state.kind === in_progress", predicate: (s) => s.kind === "in_progress" } },
  ];
  return { taskId, startNodeId: "gen", nodes, edges };
}

function mockAdapter(evalResults: Array<"pass" | "fail">): SubagentAdapter {
  let genCount = 0, evalIdx = 0;
  return {
    runGenerator: () => ({ kind: "done", summary: `gen output #${++genCount}` }),
    runEvaluator: () => {
      const r = evalResults[evalIdx++] ?? "pass";
      return r === "pass" ? { pass: true, feedback: "all criteria met" } : { pass: false, feedback: "criterion X missing" };
    },
  };
}

function dump(label: string, r: GraphRunResult): void {
  console.log(`=== ${label} ===`);
  console.log(`  terminated: ${r.terminated}`);
  console.log(`  final: ${r.finalNodeId}`);
  if (r.error) console.log(`  error: ${r.error}`);
  console.log(`  trace (${r.trace.length} steps):`);
  for (const t of r.trace) {
    const res = t.callableResult ? t.callableResult.kind : "-";
    console.log(`    [${t.iteration}] ${t.nodeId.padEnd(8)} role=${t.nodeRole.padEnd(10)} result=${res.padEnd(16)} edge=${t.reducerEdgeId ?? "-"} → ${t.nextNodeId}`);
  }
  console.log();
}

function scenarioHappyPath(): void {
  const taskId = "T-GER-HAPPY";
  const ctx = setup(taskId);
  saveCheckpointState(ctx.runtimeDir, taskId, state("in_progress"));
  const r = runGraph(buildGERGraph(taskId), ctx, { adapter: mockAdapter(["pass"]), clock: new FixedClock(new Date()) });
  dump("SCENARIO 1: G→E→R happy path", r);
}

function scenarioRetryThenPass(): void {
  const taskId = "T-GER-RETRY";
  const ctx = setup(taskId);
  saveCheckpointState(ctx.runtimeDir, taskId, state("in_progress", { round: 0, roundMax: 3 }));
  const r = runGraph(buildGERGraph(taskId), ctx, { adapter: mockAdapter(["fail", "pass"]), clock: new FixedClock(new Date()) });
  dump("SCENARIO 2: G→E→R fail → retry → pass", r);
}

function main(): void {
  scenarioHappyPath();
  scenarioRetryThenPass();
  console.log("=== dogfood_run_04 complete ===");
}

main();
