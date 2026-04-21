/**
 * T-7-1 test — projectGraph 動作検証
 *
 * 検査:
 *  1. projectGraph は read-only (checkpoint / tasks.yaml 不変)
 *  2. 出力 AppState shape が beta/src/shared/types.ts に準拠
 *  3. workflow.graph.* namespace のみで workflow.kind 等 task 側と衝突しない
 *  4. current_node_id が start (trace なし) / finalNodeId (trace あり、non-END) / trace.last.nodeId (END時) で正しく決まる
 *  5. blocker state のとき root.attributes.workflow.graph.blocker に値が入る
 *  6. deterministic
 *  7. projectTasks と projectGraph が独立に動く（後方互換）
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import type { GraphEdge, GraphInstance, GraphRunResult } from "../shared/graph_types";
import { GRAPH_END_NODE_ID } from "../shared/graph_types";
import type { WorkflowNode } from "../shared/workflow_types";
import { projectGraph, projectTasks } from "./workflow_scope_projector";
import { saveCheckpointState } from "./workflow_reducer";
import type { WorkflowStateCamel } from "../shared/checkpoint_types";
import type { WorkflowStateKind } from "../shared/workflow_types";

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) console.log(`  [PASS] ${msg}`);
  else { failures++; console.error(`  [FAIL] ${msg}`); }
}

function setup(taskId: string): string {
  const root = path.join(os.tmpdir(), `pj03-t71-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(path.join(root, "runtime", "checkpoints"), { recursive: true });
  const tasksFile = path.join(root, "tasks.yaml");
  fs.writeFileSync(tasksFile, [
    `- id: ${taskId}`, `  phase: 5`, `  verb: test`, `  target: "g"`,
    `  done_when: ["d"]`, `  eval_required: true`, `  round_max: 3`,
    `  dependencies: []`, `  linked_review: null`, ``,
  ].join("\n"), "utf8");
  return path.join(root, "runtime");
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

function makeGraph(taskId: string): GraphInstance {
  const nodes: WorkflowNode[] = [
    { id: "gen", taskId, role: "generator", description: "gen node" },
    { id: "eval", taskId, role: "evaluator", description: "eval node" },
    { id: "router", taskId, role: "router", description: "router node" },
  ];
  const edges: GraphEdge[] = [
    { id: "E1", sourceNodeId: "gen", targetNodeId: "eval", reducerEdgeId: "E03", condition: { kind: "always" } },
    { id: "E2", sourceNodeId: "eval", targetNodeId: "router", reducerEdgeId: "E05", condition: { kind: "evaluator_pass" } },
    { id: "E3", sourceNodeId: "router", targetNodeId: GRAPH_END_NODE_ID, condition: { kind: "custom", label: "done", predicate: (s) => s.kind === "done" } },
  ];
  return { taskId, startNodeId: "gen", nodes, edges };
}

function test1_readOnly(): void {
  console.log("test 1: projectGraph は read-only");
  const runtime = setup("T-A");
  saveCheckpointState(runtime, "T-A", state("in_progress"));
  const cpBefore = fs.readFileSync(path.join(runtime, "checkpoints", "T-A.json"), "utf8");
  projectGraph(makeGraph("T-A"), runtime);
  const cpAfter = fs.readFileSync(path.join(runtime, "checkpoints", "T-A.json"), "utf8");
  assert(cpBefore === cpAfter, "checkpoint JSON unchanged");
}

function test2_shape(): void {
  console.log("test 2: AppState / TreeNode shape");
  const runtime = setup("T-B");
  saveCheckpointState(runtime, "T-B", state("ready"));
  const app = projectGraph(makeGraph("T-B"), runtime);
  assert(app.rootId === "graph-root", "rootId");
  const root = app.nodes["graph-root"];
  assert(!!root && root.nodeType === "folder", "root exists as folder");
  assert(!!app.nodes["gnode:gen"], "gnode:gen exists");
  assert(!!app.nodes["gnode:eval"], "gnode:eval");
  assert(!!app.nodes["gnode:router"], "gnode:router");
  const gen = app.nodes["gnode:gen"]!;
  assert(gen.parentId === "graph-root", "parentId");
  assert(gen.nodeType === "text", "gnode type = text");
  assert(Array.isArray(gen.children), "children is array");
  assert(typeof gen.link === "string", "link is string");
}

function test3_namespace(): void {
  console.log("test 3: workflow.graph.* namespace, 衝突なし");
  const runtime = setup("T-C");
  saveCheckpointState(runtime, "T-C", state("in_progress", { round: 1 }));
  const app = projectGraph(makeGraph("T-C"), runtime);
  const root = app.nodes["graph-root"]!;
  assert(!("workflow.kind" in root.attributes), "root has NO workflow.kind (that's for task projection)");
  assert(root.attributes["workflow.graph.task_id"] === "T-C", "workflow.graph.task_id");
  assert(root.attributes["workflow.graph.node_count"] === "3", "node_count=3");
  assert(root.attributes["workflow.graph.edge_count"] === "3", "edge_count=3");
  assert(root.attributes["workflow.graph.current_state_kind"] === "in_progress", "current state kind");
  const gnode = app.nodes["gnode:gen"]!;
  assert(!("workflow.kind" in gnode.attributes), "gnode has NO workflow.kind");
  assert(gnode.attributes["workflow.graph.node.role"] === "generator", "node.role");
}

function test4_currentNodeDerivation(): void {
  console.log("test 4: current_node_id 判定");
  const runtime = setup("T-D");
  saveCheckpointState(runtime, "T-D", state("ready"));

  // trace なし → startNodeId
  const a1 = projectGraph(makeGraph("T-D"), runtime);
  assert(a1.nodes["graph-root"]!.attributes["workflow.graph.current_node_id"] === "gen", "no trace → start node");
  assert(a1.nodes["gnode:gen"]!.attributes["workflow.graph.node.is_current"] === "true", "gen is current");
  assert(a1.nodes["gnode:eval"]!.attributes["workflow.graph.node.is_current"] === "false", "eval NOT current");

  // trace あり、finalNodeId=END → trace.last.nodeId
  const result: GraphRunResult = {
    taskId: "T-D", terminated: "end", finalNodeId: GRAPH_END_NODE_ID, error: null,
    trace: [
      { iteration: 0, nodeId: "gen", nodeRole: "generator", callableResult: null, reducerEdgeId: null, toState: "ready", nextNodeId: "eval", rejected: false, rejectionReason: null },
      { iteration: 1, nodeId: "eval", nodeRole: "evaluator", callableResult: null, reducerEdgeId: null, toState: "ready", nextNodeId: "router", rejected: false, rejectionReason: null },
      { iteration: 2, nodeId: "router", nodeRole: "router", callableResult: null, reducerEdgeId: null, toState: "done", nextNodeId: GRAPH_END_NODE_ID, rejected: false, rejectionReason: null },
    ],
  };
  const a2 = projectGraph(makeGraph("T-D"), runtime, { result });
  assert(a2.nodes["graph-root"]!.attributes["workflow.graph.current_node_id"] === "router", "END trace → last step.nodeId (router)");
  assert(a2.nodes["graph-root"]!.attributes["workflow.graph.last_run.terminated"] === "end", "last_run.terminated");
  assert(a2.nodes["graph-root"]!.attributes["workflow.graph.last_run.step_count"] === "3", "step_count=3");
}

function test5_blockerState(): void {
  console.log("test 5: blocked state で blocker attribute 入る");
  const runtime = setup("T-E");
  saveCheckpointState(runtime, "T-E", state("blocked", { blocker: "stuck for X" }));
  const app = projectGraph(makeGraph("T-E"), runtime);
  const root = app.nodes["graph-root"]!;
  assert(root.attributes["workflow.graph.blocker"] === "stuck for X", "blocker attribute");
  assert(root.note.includes("BLOCKER: stuck for X"), "note has BLOCKER");
}

function test6_deterministic(): void {
  console.log("test 6: deterministic");
  const runtime = setup("T-F");
  saveCheckpointState(runtime, "T-F", state("ready"));
  const a1 = projectGraph(makeGraph("T-F"), runtime);
  const a2 = projectGraph(makeGraph("T-F"), runtime);
  assert(JSON.stringify(a1) === JSON.stringify(a2), "same input → same output");
}

function test7_backwardCompatProjectTasks(): void {
  console.log("test 7: projectTasks は T-7-1 で壊れていない");
  const runtime = setup("T-G");
  saveCheckpointState(runtime, "T-G", state("done"));
  const tasksFile = path.join(path.dirname(runtime), "tasks.yaml");
  const app = projectTasks(tasksFile, runtime);
  assert(app.rootId === "root", "projectTasks rootId still 'root'");
  assert(!!app.nodes["task:T-G"], "task node exists");
  assert(app.nodes["task:T-G"]!.attributes["workflow.kind"] === "done", "workflow.kind preserved");
}

function main(): void {
  test1_readOnly();
  test2_shape();
  test3_namespace();
  test4_currentNodeDerivation();
  test5_blockerState();
  test6_deterministic();
  test7_backwardCompatProjectTasks();
  if (failures > 0) {
    console.error(`\n[T-7-1 TEST] FAIL (${failures})`);
    process.exit(1);
  }
  console.log(`\n[T-7-1 TEST] PASS — projectGraph (namespace + current + blocker + deterministic + backwardCompat)`);
}

main();
