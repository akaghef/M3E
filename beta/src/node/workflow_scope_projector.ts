/**
 * PJ03 SelfDrive — workflow scope projector (T-3-2)
 *
 * checkpoint JSON + tasks.yaml を M3E AppState shape に one-way projection する。
 *
 * 責務 (T-3-1 docs/m3e_scope_integration.md 確定):
 *   - read-only: 入力を書き換えない、副作用なし
 *   - deterministic: 同じ入力は同じ出力（タイムスタンプは caller が差し込む）
 *   - workflow.* namespace で attribute を isolate
 *   - existing AppState / TreeNode shape に完全準拠（beta/src/shared/types.ts）
 *
 * 非責務:
 *   - map server への書き込み (caller)
 *   - state 遷移 (reducer)
 *   - subagent dispatch (orchestrator)
 */

import type { AppState, TreeNode } from "../shared/types";
import type { GraphInstance, GraphRunResult } from "../shared/graph_types";
import { GRAPH_END_NODE_ID } from "../shared/graph_types";
import type { WorkflowStateCamel } from "../shared/checkpoint_types";
import {
  TaskView,
  loadAllTaskViews,
  loadCheckpointState,
  suggestNextSignal,
} from "./workflow_reducer";

// ---------------------------------------------------------------------------
// Projection helpers
// ---------------------------------------------------------------------------

function toAttrValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function buildTaskNode(view: TaskView, parentId: string): TreeNode {
  const taskId = view.contract.id;
  const id = `task:${taskId}`;
  const attrs: Record<string, string> = {
    "workflow.kind": view.state.kind,
    "workflow.round": toAttrValue(view.state.round),
    "workflow.round_max": toAttrValue(view.state.roundMax),
    "workflow.phase": toAttrValue(view.contract.phase),
    "workflow.blocker": toAttrValue(view.state.blocker),
    "workflow.escalation_kind": toAttrValue(view.state.escalationKind),
    "workflow.wakeup_at": toAttrValue(view.state.wakeupAt),
    "workflow.wakeup_mechanism": toAttrValue(view.state.wakeupMechanism),
    "workflow.failure_reason": toAttrValue(view.state.failureReason),
    "workflow.last_feedback": toAttrValue(view.state.lastFeedback),
    "workflow.next_signal": suggestNextSignal(view.state.kind),
    "workflow.dependencies": (view.contract.dependencies ?? []).join(","),
    "workflow.linked_review": toAttrValue(view.contract.linked_review),
    "workflow.eval_required": toAttrValue(view.contract.eval_required),
  };

  const details = (view.contract.done_when ?? []).map((d) => `- ${d}`).join("\n");
  const noteParts: string[] = [];
  if (view.state.blocker) noteParts.push(`BLOCKER: ${view.state.blocker}`);
  if (view.state.escalationKind) noteParts.push(`ESCALATION: ${view.state.escalationKind}`);
  if (view.state.wakeupAt) noteParts.push(`WAKEUP: ${view.state.wakeupAt} (${view.state.wakeupMechanism ?? "one-shot"})`);
  if (view.state.failureReason) noteParts.push(`FAILURE: ${view.state.failureReason}`);
  if (view.state.lastFeedback) noteParts.push(`FEEDBACK: ${view.state.lastFeedback}`);

  return {
    id,
    parentId,
    children: [],
    nodeType: "text",
    text: `${view.contract.verb} ${view.contract.target}`,
    collapsed: false,
    details,
    note: noteParts.join("\n"),
    attributes: attrs,
    link: "",
  };
}

function buildRootNode(rootId: string, views: readonly TaskView[], childIds: readonly string[]): TreeNode {
  const breakdown: Record<string, number> = {};
  for (const v of views) {
    breakdown[v.state.kind] = (breakdown[v.state.kind] ?? 0) + 1;
  }
  const attrs: Record<string, string> = {
    "workflow.total": String(views.length),
  };
  for (const [k, n] of Object.entries(breakdown)) {
    attrs[`workflow.count.${k}`] = String(n);
  }
  const summary = Object.entries(breakdown)
    .map(([k, n]) => `${k}=${n}`)
    .join(", ");
  return {
    id: rootId,
    parentId: null,
    children: [...childIds],
    nodeType: "folder",
    text: `PJ03 Workflow Snapshot — ${summary} (total ${views.length})`,
    collapsed: false,
    details: "",
    note: "",
    attributes: attrs,
    link: "",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ProjectOptions {
  rootId?: string;
}

/**
 * projectTasks — checkpoint JSON + tasks.yaml を AppState に投影する。
 * read-only、deterministic、副作用なし。
 */
export function projectTasks(tasksFile: string, runtimeDir: string, opts: ProjectOptions = {}): AppState {
  const rootId = opts.rootId ?? "root";
  const views = loadAllTaskViews(tasksFile, runtimeDir);
  const nodes: Record<string, TreeNode> = {};
  const childIds: string[] = [];
  for (const v of views) {
    const node = buildTaskNode(v, rootId);
    nodes[node.id] = node;
    childIds.push(node.id);
  }
  nodes[rootId] = buildRootNode(rootId, views, childIds);
  return { rootId, nodes };
}

// ---------------------------------------------------------------------------
// Graph projection (T-7-1)
// ---------------------------------------------------------------------------

export interface ProjectGraphOptions {
  rootId?: string;
  /** graph 実行後の trace があれば current node / next edge を特定する */
  result?: GraphRunResult;
}

/**
 * projectGraph — GraphInstance + current state (optional trace) を AppState に投影。
 *
 * 読み取り専用、deterministic。attribute namespace は `workflow.graph.*` と
 * `workflow.graph.node.*` で既存 `workflow.*` (task) と衝突しない。
 *
 * 4 表示要件 (T-3-1 の graph 版):
 *   - graph summary: root.text + root.attributes.workflow.graph.*
 *   - current node: gnode の attributes.workflow.graph.node.is_current + root.workflow.graph.current_node_id
 *   - next edge: 各 gnode の attributes.workflow.graph.node.outgoing
 *   - blocked reason: root.attributes.workflow.graph.blocker (state.kind===blocked 時)
 */
export function projectGraph(
  graph: GraphInstance,
  runtimeDir: string,
  opts: ProjectGraphOptions = {},
): AppState {
  const rootId = opts.rootId ?? "graph-root";
  const state = loadCheckpointState(runtimeDir, graph.taskId);

  const currentNodeId = deriveCurrentNodeId(graph, opts.result);

  const nodes: Record<string, TreeNode> = {};
  const childIds: string[] = [];
  for (const n of graph.nodes) {
    const gnodeId = `gnode:${n.id}`;
    const outgoing = graph.edges.filter((e) => e.sourceNodeId === n.id);
    const outgoingSummary = outgoing.map((e) => {
      const tgt = e.targetNodeId === GRAPH_END_NODE_ID ? "END" : e.targetNodeId;
      const cond = e.condition.kind === "custom" ? `custom(${e.condition.label})` : e.condition.kind;
      const red = e.reducerEdgeId ? ` via ${e.reducerEdgeId}` : "";
      return `${e.id}:${cond}->${tgt}${red}`;
    }).join("; ");

    nodes[gnodeId] = {
      id: gnodeId,
      parentId: rootId,
      children: [],
      nodeType: "text",
      text: `${n.role}: ${n.description || n.id}`,
      collapsed: false,
      details: outgoing.map((e) => `- ${e.id}: ${e.condition.kind}${e.reducerEdgeId ? ` (reducer ${e.reducerEdgeId})` : ""} → ${e.targetNodeId === GRAPH_END_NODE_ID ? "END" : e.targetNodeId}`).join("\n"),
      note: n.id === currentNodeId ? `CURRENT NODE` : "",
      attributes: {
        "workflow.graph.node.id": n.id,
        "workflow.graph.node.role": n.role,
        "workflow.graph.node.description": n.description,
        "workflow.graph.node.is_current": String(n.id === currentNodeId),
        "workflow.graph.node.outgoing": outgoingSummary,
        "workflow.graph.node.outgoing_count": String(outgoing.length),
      },
      link: "",
    };
    childIds.push(gnodeId);
  }

  nodes[rootId] = buildGraphRootNode(rootId, graph, state, childIds, currentNodeId, opts.result);

  return { rootId, nodes };
}

function deriveCurrentNodeId(graph: GraphInstance, result?: GraphRunResult): string {
  if (!result) return graph.startNodeId;
  if (result.finalNodeId && result.finalNodeId !== GRAPH_END_NODE_ID) return result.finalNodeId;
  // finalNodeId が END なら最後の trace step の nodeId を current とみなす
  const last = result.trace[result.trace.length - 1];
  if (last) return last.nodeId;
  return graph.startNodeId;
}

function buildGraphRootNode(
  rootId: string,
  graph: GraphInstance,
  state: WorkflowStateCamel,
  childIds: readonly string[],
  currentNodeId: string,
  result?: GraphRunResult,
): TreeNode {
  const endEdges = graph.edges.filter((e) => e.targetNodeId === GRAPH_END_NODE_ID);

  const attrs: Record<string, string> = {
    "workflow.graph.task_id": graph.taskId,
    "workflow.graph.start_node_id": graph.startNodeId,
    "workflow.graph.node_count": String(graph.nodes.length),
    "workflow.graph.edge_count": String(graph.edges.length),
    "workflow.graph.current_node_id": currentNodeId,
    "workflow.graph.current_state_kind": state.kind,
    "workflow.graph.current_round": String(state.round),
    "workflow.graph.round_max": String(state.roundMax),
    "workflow.graph.blocker": state.blocker ?? "",
    "workflow.graph.escalation_kind": state.escalationKind ?? "",
    "workflow.graph.failure_reason": state.failureReason ?? "",
    "workflow.graph.next_signal": suggestNextSignal(state.kind),
    "workflow.graph.end_edges_count": String(endEdges.length),
  };
  if (result) {
    attrs["workflow.graph.last_run.terminated"] = result.terminated;
    attrs["workflow.graph.last_run.step_count"] = String(result.trace.length);
    attrs["workflow.graph.last_run.error"] = result.error ?? "";
  }

  const nextEdgeSummaries = graph.edges
    .filter((e) => e.sourceNodeId === currentNodeId)
    .map((e) => `${e.id} → ${e.targetNodeId === GRAPH_END_NODE_ID ? "END" : e.targetNodeId}`)
    .join("; ");
  attrs["workflow.graph.next_edges_from_current"] = nextEdgeSummaries || "(none)";

  const notes: string[] = [];
  if (state.blocker) notes.push(`BLOCKER: ${state.blocker}`);
  if (state.escalationKind) notes.push(`ESCALATION: ${state.escalationKind}`);
  if (state.failureReason) notes.push(`FAILURE: ${state.failureReason}`);

  return {
    id: rootId,
    parentId: null,
    children: [...childIds],
    nodeType: "folder",
    text: `Graph for ${graph.taskId} — current=${currentNodeId} state=${state.kind} round=${state.round}/${state.roundMax}`,
    collapsed: false,
    details: "",
    note: notes.join("\n"),
    attributes: attrs,
    link: "",
  };
}
