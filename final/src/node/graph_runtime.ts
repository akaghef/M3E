/**
 * PJ03 SelfDrive — graph runtime (T-5-2)
 *
 * node graph を実行入力として辿り、各 node callable の結果を reducer に流し込む。
 * reducer (workflow_reducer.ts) の fail-closed / ALLOWED_EDGES / checkpoint adapter を継承。
 *
 * 正本: projects/PJ03_SelfDrive/docs/graph_runtime_spec.md
 */

import type { Clock } from "../shared/clock";
import { SystemClock } from "../shared/clock";
import type {
  GraphCallableResult,
  GraphEdge,
  GraphInstance,
  GraphRunResult,
  GraphTraceStep,
} from "../shared/graph_types";
import { GRAPH_END_NODE_ID } from "../shared/graph_types";
import type { EdgeId, NodeRole, WorkflowStateKind } from "../shared/workflow_types";
import {
  ReducerContext,
  RunOneStepDeps,
  StepSignal,
  loadCheckpointState,
  runOneStep,
} from "./workflow_reducer";
import type {
  EvaluatorRequest,
  GeneratorRequest,
  SubagentAdapter,
} from "./workflow_orchestrator";

const DEFAULT_MAX_ITER = 32;

// ---------------------------------------------------------------------------
// Signal derivation
// ---------------------------------------------------------------------------

export function deriveSignal(role: NodeRole, result: GraphCallableResult, evalRequired: boolean): StepSignal | null {
  if (result.kind === "generator_done" && role === "generator") {
    return { kind: "generator_done", evalRequired, objectiveCheckPass: true };
  }
  if (result.kind === "evaluator_pass" && role === "evaluator") {
    return { kind: "evaluator_verdict", pass: true, feedback: result.feedback };
  }
  if (result.kind === "evaluator_fail" && role === "evaluator") {
    return { kind: "evaluator_verdict", pass: false, feedback: result.feedback };
  }
  if (result.kind === "route_only") {
    return null; // router は signal を発行しない、graph edge の condition で分岐するのみ
  }
  return null;
}

// ---------------------------------------------------------------------------
// Callable resolution
// ---------------------------------------------------------------------------

export function resolveCallable(
  role: NodeRole,
  adapter: SubagentAdapter,
  contract: {
    taskId: string;
    contractVerb: string;
    contractTarget: string;
    doneWhen: string[];
    evalCriteria: string[];
    priorFeedback: string | null;
  },
): (round: number) => GraphCallableResult {
  return (round) => {
    if (role === "generator") {
      const req: GeneratorRequest = {
        taskId: contract.taskId,
        contractVerb: contract.contractVerb,
        contractTarget: contract.contractTarget,
        doneWhen: contract.doneWhen,
        priorFeedback: contract.priorFeedback,
        round,
      };
      const r = adapter.runGenerator(req);
      if (r.kind === "done") return { kind: "generator_done", summary: r.summary };
      // generator が done 以外を返した場合は graph runtime でカバー外（T-5-2 scope 外）
      return { kind: "generator_done", summary: r.summary };
    }
    if (role === "evaluator") {
      const req: EvaluatorRequest = {
        taskId: contract.taskId,
        doneWhen: contract.doneWhen,
        evalCriteria: contract.evalCriteria,
        generatorSummary: contract.priorFeedback ?? "",
        round,
      };
      const r = adapter.runEvaluator(req);
      return r.pass
        ? { kind: "evaluator_pass", feedback: r.feedback }
        : { kind: "evaluator_fail", feedback: r.feedback };
    }
    // router role は graph edge の condition で next を決めるので、callable は no-op
    return { kind: "route_only" };
  };
}

// ---------------------------------------------------------------------------
// Edge selection
// ---------------------------------------------------------------------------

function evalCondition(cond: GraphEdge["condition"], state: import("../shared/checkpoint_types").WorkflowStateCamel, result: GraphCallableResult | null): boolean {
  switch (cond.kind) {
    case "always": return true;
    case "evaluator_pass": return result?.kind === "evaluator_pass";
    case "evaluator_fail": return result?.kind === "evaluator_fail";
    case "round_lt_max": return state.round + 1 <= state.roundMax;
    case "round_ge_max": return state.round + 1 > state.roundMax;
    case "custom":
      // Finding 1 fix: full WorkflowStateCamel を predicate に渡す (null 潰し禁止)
      return cond.predicate(state);
  }
}

export function selectNextNode(
  graph: GraphInstance,
  currentNodeId: string,
  state: import("../shared/checkpoint_types").WorkflowStateCamel,
  result: GraphCallableResult | null,
): GraphEdge | null {
  const outgoing = graph.edges.filter((e) => e.sourceNodeId === currentNodeId);
  for (const e of outgoing) {
    if (evalCondition(e.condition, state, result)) return e;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Run graph
// ---------------------------------------------------------------------------

export interface RunGraphDeps {
  adapter: SubagentAdapter;
  clock?: Clock;
  maxIter?: number;
}

export function runGraph(graph: GraphInstance, ctx: ReducerContext, deps: RunGraphDeps): GraphRunResult {
  const clock = deps.clock ?? new SystemClock();
  const maxIter = deps.maxIter ?? DEFAULT_MAX_ITER;
  const trace: GraphTraceStep[] = [];

  // Finding 2 fix: checkpoint に graph_position があれば resume、なければ startNodeId から
  const initialState = loadCheckpointState(ctx.runtimeDir, graph.taskId);
  const persistedPos = initialState.graphPosition;
  const isValidResumePos = persistedPos && persistedPos !== GRAPH_END_NODE_ID
    && graph.nodes.some((n) => n.id === persistedPos);
  let currentNodeId = isValidResumePos ? persistedPos! : graph.startNodeId;
  // 開始 position を永続化 (resume なら既存値、fresh run なら startNodeId)
  persistGraphPosition(ctx, graph.taskId, currentNodeId, clock);

  let iteration = 0;
  let terminated: GraphRunResult["terminated"] = "max_iter";
  let errorMsg: string | null = null;

  while (iteration < maxIter && currentNodeId !== GRAPH_END_NODE_ID) {
    const node = graph.nodes.find((n) => n.id === currentNodeId);
    if (!node) {
      errorMsg = `graph node not found: ${currentNodeId}`;
      terminated = "error";
      break;
    }

    const curState = loadCheckpointState(ctx.runtimeDir, graph.taskId);
    const callable = resolveCallable(node.role, deps.adapter, {
      taskId: graph.taskId,
      contractVerb: "graph",       // 本実装では contract まで見に行かない（T-5-3 dogfood でより詳細化）
      contractTarget: graph.taskId,
      doneWhen: [],
      evalCriteria: [],
      priorFeedback: curState.lastFeedback,
    });
    const result = callable(curState.round);

    const signal = deriveSignal(node.role, result, true);
    let reducerEdgeId: EdgeId | null = null;
    let nextKind: string = curState.kind;
    let rejected = false;
    let rejectionReason: string | null = null;

    if (signal) {
      const step = runOneStep(ctx, { taskId: graph.taskId, signal }, { clock });
      if (step.rejected) {
        rejected = true;
        rejectionReason = step.rejectionReason;
      } else if (step.edge) {
        reducerEdgeId = step.edge.id;
        nextKind = step.nextState?.kind ?? curState.kind;
      }
    }

    // Finding 3 fix: rejection 時は selectNextNode を呼ばず即 break、trace の nextNodeId は空に
    if (rejected) {
      trace.push({
        iteration, nodeId: currentNodeId, nodeRole: node.role,
        callableResult: result, reducerEdgeId: null,
        toState: curState.kind,  // curState (pre-reject) のまま、偽装しない
        nextNodeId: "",
        rejected: true, rejectionReason,
      });
      terminated = "reject";
      break;
    }

    const postState = loadCheckpointState(ctx.runtimeDir, graph.taskId);
    const nextEdge = selectNextNode(graph, currentNodeId, postState, result);

    if (!nextEdge) {
      errorMsg = `no graph edge matched from ${currentNodeId}`;
      terminated = "error";
      trace.push({ iteration, nodeId: currentNodeId, nodeRole: node.role, callableResult: result, reducerEdgeId, toState: nextKind, nextNodeId: "", rejected, rejectionReason });
      break;
    }

    // reducerEdgeId 一致チェック（graph edge で reducer edge を明示した場合）
    if (nextEdge.reducerEdgeId && reducerEdgeId && nextEdge.reducerEdgeId !== reducerEdgeId) {
      errorMsg = `graph edge ${nextEdge.id} expects reducer edge ${nextEdge.reducerEdgeId} but reducer took ${reducerEdgeId}`;
      terminated = "error";
      trace.push({ iteration, nodeId: currentNodeId, nodeRole: node.role, callableResult: result, reducerEdgeId, toState: nextKind, nextNodeId: nextEdge.targetNodeId, rejected, rejectionReason });
      break;
    }

    trace.push({
      iteration,
      nodeId: currentNodeId,
      nodeRole: node.role,
      callableResult: result,
      reducerEdgeId,
      toState: nextKind,
      nextNodeId: nextEdge.targetNodeId,
      rejected: false,
      rejectionReason: null,
    });

    currentNodeId = nextEdge.targetNodeId;
    iteration++;

    // Finding 2 fix: graph position を checkpoint に永続化
    persistGraphPosition(ctx, graph.taskId, currentNodeId, clock);
  }

  if (currentNodeId === GRAPH_END_NODE_ID && terminated === "max_iter") {
    terminated = "end";
  }

  // Finding 2 fix: 終端時は graph_position を END または最終 node に永続化
  persistGraphPosition(ctx, graph.taskId, currentNodeId, clock);

  return {
    taskId: graph.taskId,
    trace,
    terminated,
    finalNodeId: currentNodeId,
    error: errorMsg,
  };
}

/**
 * persistGraphPosition — checkpoint JSON の graphPosition を更新する。
 * reducer の saveCheckpointState を経由するので SSOT を侵さない。
 * 他 field は loadCheckpointState の読み戻し値をそのまま保持する。
 */
function persistGraphPosition(ctx: ReducerContext, taskId: string, nodeId: string, clock: Clock): void {
  const cur = loadCheckpointState(ctx.runtimeDir, taskId);
  if (cur.graphPosition === nodeId) return; // no-op
  const next = { ...cur, graphPosition: nodeId };
  // reducer の saveCheckpointState を import して使う (循環依存なし: reducer は graph_runtime を知らない)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { saveCheckpointState } = require("./workflow_reducer");
  saveCheckpointState(ctx.runtimeDir, taskId, next, clock);
}
