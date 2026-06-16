# Workflow Example — description artifact (T-1-11 P4 降格後)

- **status**: description-only (not executable)
- **phase**: 1.5 rework
- **source**: 旧 `runtime/workflow_example.json`（T-1-2 成果物）
- **akaghef P4 確定**: 実行入力でない限り動かない spec は runtime/ から外す。復活は実 runtime fixture が必要になった時点で schema 付きで新設

## 背景

T-1-2 で 1-task workflow を `WorkflowNode` + `WorkflowEdge` の具体 instance として JSON に encode した。
しかし reducer は node graph を読まず、遷移は `ALLOWED_EDGES` + signal のみで決める。
二重表現（spec と実装が別々に存在し、互いに束縛しない）は Gate 2 差戻の 1 項目だったため、
本 md に description 化して `runtime/workflow_example.json` は削除した。

## 元 encode された task: T-1-3 (state transition runner 実装)

### Nodes

| id | role | description |
|---|---|---|
| `N-T-1-3-gen` | generator | beta/src/node/workflow_runner.ts を実装: tasks.yaml 読み込み → 現状 state 算出 → allowed edge 選択 → 次 state 返却 + yaml writeback。dry-run mode 対応。 |
| `N-T-1-3-eval` | evaluator | eval_required: true、eval_criteria (fail-closed edge 拒否、writeback YAML 構造保持、dry-run mode 存在) を独立検証。 |
| `N-T-1-3-router` | router | Evaluator verdict に基づき E05 (pass → done) / E06 (fail && round+1 <= roundMax → in_progress retry) / E07 (fail && round+1 > roundMax → blocked) / E11 (escalation → escalated) のいずれかに分岐。 |

### Edges

| id | source | target | condition | trigger |
|---|---|---|---|---|
| E01 | pending | ready | all dependencies done (T-1-1, T-1-2) | machine |
| E02 | ready | in_progress | Generator N-T-1-3-gen dispatched | machine |
| E03 | in_progress | eval_pending | Generator DONE && eval_required==true | machine |
| E05 | eval_pending | done | Evaluator N-T-1-3-eval pass | machine |
| E06 | eval_pending | in_progress | Evaluator fail && round+1 <= 3 | machine |
| E07 | eval_pending | blocked | Evaluator fail && round+1 > 3 | machine |
| E11 | eval_pending | escalated | E1/E2/E3 detected during eval | machine |
| E15 | blocked | ready | blocker cleared (reviews/Qn resolved) | machine |

## 降格理由（akaghef P4）

- runtime/ にあると「実行される」ように見える
- 実態は reducer/CLI/checkpoint コードから一切参照されない
- 実行入力でないなら artifact の場所が docs/ が適切
- 動かない spec をコード寄りに置くとノイズ

## 将来復活させる場合の方針

1. runtime が node graph を読む必要が出たとき（Phase 2 orchestrator 以降）
2. その時点で `runtime/fixtures/workflow_fixture.json` の schema を明示する
3. reducer/orchestrator 側に loader を追加し、schema validation を通す
4. 二重表現にならないよう、spec と実装が同じ node graph から派生するようにする

現在は復活不要。本 md が sole reference。

## Cross-reference

- [workflow_state_set.md](workflow_state_set.md): 9 state の意味
- [workflow_edges.md](workflow_edges.md): 17 edge の意味
- [reducer_responsibility.md](reducer_responsibility.md): reducer の責務境界（node graph を読まない理由）
- [../../beta/src/shared/workflow_types.ts](../../beta/src/shared/workflow_types.ts): 旧 JSON の型準拠先（現在は直接の binding はなし）
