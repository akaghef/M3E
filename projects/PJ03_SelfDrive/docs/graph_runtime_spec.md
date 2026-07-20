# Graph Runtime Spec — node graph を実行入力として辿る最小 executor

- **status**: authoritative (T-5-1)
- **phase**: 5 (Plan 2 Phase B)
- **source**: langgraph_gap_memo.md G1-G3（graph を実行入力、callable node、conditional edge の graph ネイティブ表現）
- **referenced by**: T-5-2 graph_runtime.ts 実装、T-5-3 dogfood_run_04

## 設計原則

1. **reducer を破壊しない**: 既存 `workflow_reducer.ts` の `ALLOWED_EDGES` / `stepOnce` / `selectEdge` / checkpoint adapter はそのまま再利用。graph runtime は reducer の上位層に位置し、内部部品として reducer を呼ぶ
2. **graph は実行入力**: `WorkflowNode` / `WorkflowEdge` instance を受け取り、graph を辿る。`ALLOWED_EDGES` 表外遷移は拒否 (fail-closed) を継承
3. **checkpoint 整合**: 現行 checkpoint JSON shape (invariant 9 field) を壊さない。graph 実行単位の追加 metadata が必要なら別 field で
4. **1 task = 1 graph** をまず固定。multi-task graph は後続 PJ 候補
5. **adapter として追加**: 既存 reducer / orchestrator / scope_projector に retrospective 変更を加えない。`graph_runtime.ts` を新設し、orchestrator から呼ぶ選択肢を増やすだけ

## Graph 構造の粒度（1 task = 1 graph 確定）

- 1 `TaskContract` に対して 1 `GraphInstance` が bind する
- `GraphInstance.nodes` = `WorkflowNode[]` (既存型再利用、role ごとに callable を graph runtime が束ねる)
- `GraphInstance.edges` = `GraphEdge[]` (本 spec で新設、後述)
- graph START → generator node → evaluator node → router node → END の 3-node 最小形で T-5-3 dogfood

subgraph / 入れ子 graph は langgraph_gap_memo.md §非目標 の通り Plan 2 scope 外。

## 型拡張方針

`WorkflowNode` / `WorkflowEdge` は既存型をそのまま利用。追加する最小型:

```ts
// beta/src/shared/graph_types.ts (T-5-2 で新設予定)
export interface GraphEdge {
  id: string;                    // "G01" 等、graph 内部 id
  sourceNodeId: string;          // WorkflowNode.id を指す
  targetNodeId: string;          // "__END__" で END sentinel
  reducerEdgeId?: EdgeId;        // 実遷移する reducer edge (E02/E03/E05/E06/E07 など)、なければ state 変更なし
  condition?: GraphEdgeCondition; // 条件付き branching 用
}

export type GraphEdgeCondition =
  | { kind: "always" }
  | { kind: "evaluator_pass" }
  | { kind: "evaluator_fail" }
  | { kind: "round_lt_max" }
  | { kind: "custom"; predicate: (state: WorkflowStateCamel) => boolean };

export interface GraphInstance {
  taskId: string;
  startNodeId: string;
  nodes: WorkflowNode[];
  edges: GraphEdge[];
}
```

`WorkflowEdge` (既存、reducer 用) と `GraphEdge` (本 spec、graph runtime 用) は役割が別:
- `WorkflowEdge` = state 遷移の仕様（source kind / target kind）
- `GraphEdge` = graph 上の node-to-node 遷移（source callable / target callable + reducer edge の紐付け）

graph runtime は `GraphEdge.reducerEdgeId` を使って reducer の `ALLOWED_EDGES` に沿った state 遷移を発火する。graph 表現で書かれた遷移が reducer 表と一致しない場合は **fail-closed** で拒否（reducer の整合性を graph が優先することはない）。

## 実行ループ

```
function runGraph(graph: GraphInstance, ctx: ReducerContext, deps):
  currentNodeId = graph.startNodeId
  iterations = 0
  while iterations < MAX_ITER and currentNodeId !== END:
    node = findNode(graph, currentNodeId)
    callable = resolveCallable(node.role, deps.adapter)  // generator / evaluator / router
    result = callable(taskId, state)

    # reducer を内部部品として呼ぶ
    signal = deriveSignal(node.role, result)
    step = runOneStep(ctx, {taskId, signal}, deps)
    if step.rejected: break
    state = step.nextState

    # graph 上の次 node を決める
    outgoing = graph.edges.filter(e => e.sourceNodeId === currentNodeId)
    currentNodeId = selectNextNode(outgoing, state, result)
    iterations++
  return trace
```

### conditional edge の評価順

graph edge の `condition` と reducer の `ALLOWED_EDGES` は **両方満たさなければならない** (AND):

1. 先に graph edge condition を評価（`evaluator_pass` / `evaluator_fail` / `round_lt_max` / custom）
2. 次に `reducerEdgeId` が reducer `ALLOWED_EDGES` に存在するか `selectEdge` で確認
3. どちらか falsy なら fail-closed（graph runtime が reject）

これにより「graph edge 上は書けるが reducer が許さない遷移」は運用上発火しない。逆も同じ。

### START / END

- START: graph.startNodeId が指す最初の node
- END: `targetNodeId === "__END__"` の edge を踏んだら graph 実行終了
- END 到達は必ずしも task state が `done` を意味しない: `blocked` / `failed` / `sleeping` でも END 扱い（terminal or 外部待ち）

## callable の bind 方式

```ts
function resolveCallable(role: NodeRole, adapter: SubagentAdapter): Callable {
  switch (role) {
    case "generator": return (taskId, state) => adapter.runGenerator(...)
    case "evaluator": return (taskId, state) => adapter.runEvaluator(...)
    case "router": return (taskId, state) => ({ kind: "route", nextNodeId: ... })
  }
}
```

既存 `SubagentAdapter` を再利用。graph runtime は新しい adapter を要求しない。router role は graph runtime 自身が `selectNextNode` で解決するので、明示的 callable は空実装でも可。

## checkpoint 更新

1 step ごとに `runOneStep` 経由で checkpoint JSON が更新される。graph runtime は checkpoint を直接書かない（reducer adapter に委ねる、rule #3）。

graph 実行単位の trace（どの node を何 iteration で踏んだか）を追加したい場合は、artifacts/ に別 file として dump（checkpoint JSON は汚さない）。

## fail-closed 継承

reducer の fail-closed は graph runtime にも引き継ぐ:

- graph edge が reducer allowed でない → graph runtime が拒否
- graph loop が MAX_ITER を超えた → `failed` state に遷移（E17 fatal_exception）
- node callable が throw → 同じく E17

## spec で決めないこと（先送り）

- subgraph / 入れ子
- multi-task graph
- streaming
- LangGraph 採用時の Python adapter 詳細（T-6-1 で決定）
- graph visualization（Plan 2 非目標、後続 PJ 候補）

## T-5-2 実装の着手順

1. `beta/src/shared/graph_types.ts` で `GraphEdge` / `GraphEdgeCondition` / `GraphInstance` を新設
2. `beta/src/node/graph_runtime.ts` に `runGraph` / `selectNextNode` / `resolveCallable` / `deriveSignal` を実装
3. test file `graph_runtime_test.ts`:
   - 3-node graph (gen → eval → router) を fixture で作成
   - MockSubagentAdapter + FixedClock で 1 cycle 回す
   - eval_pass / eval_fail (round < max) / eval_fail (round >= max) の 3 path を確認
   - fail-closed: graph edge 上にあるが reducer table に無い遷移を入れたら reject
4. build + test pass
5. T-5-3 で PJ03 自身の task 1 本を graph instance に encode して dogfood

## Cross-reference

- beta/src/shared/workflow_types.ts: `WorkflowNode` / `WorkflowEdge` / `ALLOWED_EDGES`
- beta/src/node/workflow_reducer.ts: `runOneStep` / `stepOnce` / `selectEdge`
- beta/src/node/workflow_orchestrator.ts: `SubagentAdapter` / MockAdapter pattern
- projects/PJ03_SelfDrive/docs/langgraph_gap_memo.md: G1-G3
- projects/PJ03_SelfDrive/runtime/langgraph_sandbox/smoke_test.py: StateGraph 3-node 参考実装
