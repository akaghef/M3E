# LangGraph Gap Memo — PJ03 現状との差分

- **status**: authoritative (T-4-2)
- **phase**: 4 (Plan 2 Phase A)
- **source**: Qn5_premature_done_declaration の再評価 + runtime/langgraph_sandbox/ smoke test
- **referenced by**: T-5-1 graph runtime spec、T-5-3 自前 dogfood、T-6-1 採用確定

## 目的

Plan 1 で PJ03 は「workflow runtime の基礎工事」までしか成立していなかった。
LangGraph が提供する graph executor 機能に対して、現状 PJ03 が何を持ち / 何を持たないかを
機能単位で表にし、Plan 2 で埋める範囲と先送りする範囲を明確にする。

## 検証環境

- `runtime/langgraph_sandbox/` に Python venv + langgraph==1.1.8 + smoke_test.py（install 済）
- smoke_test: StateGraph（node: gen/eval, conditional edge による loop, START→END）が compile + invoke で pass（docs/install_langgraph.md 記録）
- 本 memo の「あり/なし」判定は smoke_test + LangGraph 公式 docs の基礎 API を基準にする

## 機能 × 現状対応表

| LangGraph 機能 | PJ03 現状 | 判定 | 備考 |
|---|---|---|---|
| **StateGraph 型 state** | TypedDict ベースの graph state | 類似あり | PJ03 の `PersistedState` / `WorkflowStateCamel` が state schema を担うが graph runtime が読む仕組みではない |
| **add_node (callable)** | 概念定義のみ（`WorkflowNode.role`）| なし | 現 reducer は signal 駆動、node callable は受けない |
| **add_edge (static)** | `ALLOWED_EDGES` 表（17 edges） | 類似あり | reducer 内テーブル固定、graph 入力から受けていない |
| **add_conditional_edges (dynamic router)** | `selectEdge` 内の signal → edge_id 写像 | 類似あり | graph 上の動的 router が条件判定する形ではない |
| **checkpoint (persistence)** | `runtime/checkpoints/{taskId}.json` | 類似あり | 役割は同じ（state 永続化 + resume）だが粒度が異なる: LangGraph は thread_id × node-level、PJ03 は task-level 1 JSON。node 粒度 checkpoint は未対応（T-6-1 採用確定時に G1-G3 とあわせて拡張候補） |
| **interrupt / resume** | `--resume` + hook 配線 | 類似あり | task 単位 resume のみ。graph 中断の再開（node 粒度）は未対応 |
| **loop / retry** | E06 retry、round_max enforcement | 類似あり | reducer 内で loop。graph 表現として外に出ていない |
| **START / END sentinel** | `pending` / `done / failed` state | 類似あり | state kind として表現、graph 上の START/END ノードとしては未実装 |
| **subgraph / 入れ子** | なし | **なし** | Plan 2 の非目標（後続 PJ 候補） |
| **multi-agent / supervisor** | SubagentAdapter interface のみ | 基盤のみ | orchestrator は 1 subagent/1 signal、supervisor pattern 未対応 |
| **human-in-the-loop (interrupt)** | escalated state + linked_review | 類似あり | 粒度は task。graph node での interrupt は未 |
| **streaming / token streaming** | なし | なし | Plan 2 非目標 |
| **state merger (reducer 合成)** | reducer が `{...current, kind: edge.target}` で state を作る | 類似あり | LangGraph の state key 単位 reducer に比べ粒度粗い |
| **Python runtime** | TypeScript 側 | mismatch | Plan 2 で採用するなら Python/TS 境界設計が T-6-1 論点 |

## 主要ギャップ（Plan 2 で埋める対象）

### G1. Graph を実行入力として読む runtime

**症状**: `WorkflowNode` / `WorkflowEdge` 型は export されているが、reducer は ALLOWED_EDGES + signal のみで動く。
node graph instance を読んで辿る executor が存在しない。

**埋める task**: T-5-1 spec + T-5-2 graph_runtime.ts 実装 + T-5-3 dogfood。

### G2. add_node callable 相当が無い

**症状**: 現 SubagentAdapter は 1 発の generator/evaluator 呼び出しだが、node graph の
各 node に callable を bind する仕組みが orchestrator 側に無い。

**埋める task**: T-5-2 内で `WorkflowNode.role` に対応する callable を graph runtime から呼ぶ設計。

### G3. conditional edge の graph ネイティブ表現

**症状**: conditional branching は reducer の signal 種別で表現されており、
「edge に条件関数を bind する」LangGraph パターンに変換できていない。

**埋める task**: T-5-1 spec で graph edge の condition 表現方式を決定、T-5-2 で実装。

### G4. LangGraph 採用可否の決定

**症状**: T-4-1 で Plan 1 claim を弱めたが、Plan 2 が A (LangGraph 採用) / B (自前 runtime) のどちらに倒すかは未確定。

**埋める task**: T-5-3 の自前 dogfood 結果 + T-4-2 memo を根拠に T-6-1 で確定。

## 非目標（Plan 2 で埋めないギャップ）

以下は PJ03 Plan 2 の scope 外。backlog or 後続 PJ 候補:

- subgraph / 入れ子 graph
- streaming（token-level）
- multi-agent supervisor pattern
- Python/TS cross-runtime 設計（T-6-1 で LangGraph 採用時に着手）
- 実 Anthropic API SubagentAdapter 実装

## Plan 2 で埋める範囲まとめ

| Plan 2 Phase | 埋める gap |
|---|---|
| Phase A (T-4-*) | claim 整理 + 本 memo |
| Phase B (T-5-*) | G1 / G2 / G3 を自前 runtime で試作 |
| Phase C (T-6-1) | G4（LangGraph 採用 or 自前継続の確定） |
| Phase D (T-7-*) | 採用した graph runtime の scope projection 拡張 |

## 自前 runtime で進める場合の下位互換性主張候補

LangGraph を非採用とするなら、以下を本 memo + T-5-3 dogfood + T-6-1 決定 memo で示す必要がある:

1. node / edge 表現が LangGraph 相当（TypedDict state / callable node / conditional edge）で書ける
2. loop / retry / interrupt が graph 粒度で表現できる
3. checkpoint の粒度（task 単位でなく node 単位）まで後から拡張可能
4. Python/TS 境界コストを避ける価値がある

これらを示せなければ T-6-1 は LangGraph 採用に倒す。

## Cross-reference

- `projects/PJ03_SelfDrive/runtime/langgraph_sandbox/smoke_test.py`
- `projects/PJ03_SelfDrive/docs/install_langgraph.md`（smoke test 結果）
- `projects/PJ03_SelfDrive/docs/external_tools_review.md`（Gate 1 時点の初期 review、本 memo で rework）
- `beta/src/shared/workflow_types.ts`（`WorkflowNode` / `WorkflowEdge` 型）
- `beta/src/node/workflow_reducer.ts`（`ALLOWED_EDGES` / `selectEdge`）
- `beta/src/node/workflow_orchestrator.ts`（`SubagentAdapter`）
