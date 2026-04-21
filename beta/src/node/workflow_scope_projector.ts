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
import {
  TaskView,
  loadAllTaskViews,
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
