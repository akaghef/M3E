/**
 * PJ03 SelfDrive — graph runtime 型 (T-5-2)
 *
 * 既存 WorkflowNode / WorkflowEdge / ALLOWED_EDGES は変更せず、graph runtime 用に
 * GraphEdge / GraphEdgeCondition / GraphInstance を追加する。
 *
 * 正本: projects/PJ03_SelfDrive/docs/graph_runtime_spec.md
 */

import type { EdgeId, WorkflowNode } from "./workflow_types";
import type { WorkflowStateCamel } from "./checkpoint_types";

export const GRAPH_END_NODE_ID = "__END__" as const;

export type GraphEdgeCondition =
  | { kind: "always" }
  | { kind: "evaluator_pass" }
  | { kind: "evaluator_fail" }
  | { kind: "round_lt_max" }
  | { kind: "round_ge_max" }
  | { kind: "custom"; predicate: (state: WorkflowStateCamel) => boolean; label: string };

export interface GraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;                // GRAPH_END_NODE_ID で END
  reducerEdgeId?: EdgeId;              // 実遷移する reducer edge (なければ state 変更なし)
  condition: GraphEdgeCondition;
}

export interface GraphInstance {
  taskId: string;
  startNodeId: string;
  nodes: WorkflowNode[];
  edges: GraphEdge[];
}

/**
 * GraphCallableResult — node callable の返り値。graph runtime が deriveSignal で
 * StepSignal に写像する。
 */
export type GraphCallableResult =
  | { kind: "generator_done"; summary: string }
  | { kind: "evaluator_pass"; feedback: string }
  | { kind: "evaluator_fail"; feedback: string }
  | { kind: "route_only"; hint?: string };

export interface GraphTraceStep {
  iteration: number;
  nodeId: string;
  nodeRole: string;
  callableResult: GraphCallableResult | null;
  reducerEdgeId: EdgeId | null;
  toState: string;
  nextNodeId: string;
  rejected: boolean;
  rejectionReason: string | null;
}

export interface GraphRunResult {
  taskId: string;
  trace: GraphTraceStep[];
  terminated: "end" | "reject" | "max_iter" | "error";
  finalNodeId: string;
  error: string | null;
}
