# Workflow Edges — PJ03 SelfDrive 許容遷移表

- **status**: authoritative (T-0-2)
- **phase**: 0
- **depends on**: workflow_state_set.md (9 states)
- **referenced by**: T-1-1 (`WorkflowEdge` type), T-1-3 (runner 遷移判定), T-1-6 (dogfood 観察遷移)

## 設計原則

- **fail-closed**: 表にない (source, target) ペアは拒否（runner は invalid edge reject）
- **trigger の区別**: `machine` / `human` / `timer` を明示。人間承認 edge と自動 edge を混ぜない
- **terminal の不可逆**: `done` / `failed` から outgoing edge は無し
- **全 state 到達可能**: `failed` を除く全 state は incoming・outgoing を最低 1 本持つ

## 許容 edge 一覧

| edge_id | source | target | condition | trigger |
|---|---|---|---|---|
| E01 | `pending` | `ready` | 依存 task がすべて `done` | machine (runner polling) |
| E02 | `ready` | `in_progress` | Generator 起動成功 | machine (runner dispatch) |
| E03 | `in_progress` | `eval_pending` | Generator DONE 報告 かつ `eval_required: true` | machine (runner receive) |
| E04 | `in_progress` | `done` | Generator DONE 報告 かつ `eval_required: false` かつ Manager の objective check pass | machine (runner receive + check) |
| E05 | `eval_pending` | `done` | Evaluator verdict = pass | machine (evaluator result) |
| E06 | `eval_pending` | `in_progress` | Evaluator verdict = fail かつ `round + 1 <= round_max`（retry） | machine (evaluator result + round guard) |
| E07 | `eval_pending` | `blocked` | Evaluator verdict = fail かつ `round + 1 > round_max` | machine (round_max breach) |
| E08 | `in_progress` | `sleeping` | ScheduleWakeup / CronCreate 発行 | timer (schedule registered) |
| E09 | `sleeping` | `ready` | wakeup 時刻到達 | timer (wakeup fired) |
| E10 | `in_progress` | `escalated` | E1/E2/E3 条件一致 | machine (escalation detect) |
| E11 | `eval_pending` | `escalated` | E1/E2/E3 条件一致（評価中に検知） | machine (escalation detect) |
| E12 | `escalated` | `ready` | 人間が承認して再開指示 | human (akaghef approve) |
| E13 | `escalated` | `blocked` | 人間が却下・差戻 | human (akaghef reject) |
| E14 | `escalated` | `failed` | 人間が中断決定 | human (akaghef abort) |
| E15 | `blocked` | `ready` | blocker 解消（外部資源復旧、Qn resolved 等） | machine (blocker re-check) or human |
| E16 | `blocked` | `failed` | 復旧見込みなしと人間が判断 | human (akaghef abort) |
| E17 | `in_progress` | `failed` | 実行中の致命例外（プロセス崩壊・env 破壊） | machine (runtime error) |

## plan.md §基本遷移 対応

plan.md §D4 に state 候補はあったが §基本遷移 セクションは未存在。本表が authoritative。T-0-5 で plan.md 確定事項に逆参照を追加する。

「10 edges」は plan.md の想定値だが、人間承認・外部 timer・失敗分岐を網羅すると 17 本が最小。粒度整合は T-0-5 Gate 1 check で確認。

## 明示的 reject（unreachable 組合せ）

| rejected | 理由 |
|---|---|
| `done` → * | terminal |
| `failed` → * | terminal |
| `pending` → `in_progress` | 依存未解決で Generator を直接起動させない（必ず `ready` 経由） |
| `ready` → `eval_pending` | Generator を経由せず評価に入ることは許さない |
| `sleeping` → `in_progress` | wakeup 後は `ready` に戻して runner の選択を経る |
| `blocked` → `in_progress` | blocker 解消は `ready` 経由で再スケジュール |
| `pending` → `escalated` | 着手前 escalation は reviews/Qn に吸収する（state を使わない） |

## State 到達性サマリ

| state | incoming | outgoing |
|---|---|---|
| `pending` | (初期) | E01 |
| `ready` | E01, E09, E12, E15 | E02 |
| `in_progress` | E02, E06 | E03, E04, E08, E10, E17 |
| `eval_pending` | E03 | E05, E06, E07, E11 |
| `blocked` | E07, E13, E15 (exit) | E15, E16 |
| `sleeping` | E08 | E09 |
| `escalated` | E10, E11 | E12, E13, E14 |
| `done` | E04, E05 | (terminal) |
| `failed` | E14, E16, E17 | (terminal) |

全 state（`failed` も incoming を E14/E16/E17 の 3 経路で保持）が孤立していない。

## Cross-reference

- workflow_state_set.md: source/target は同じ 9 state
- T-1-1 `beta/src/shared/workflow_types.ts`: `WorkflowEdge = { id, source, target, condition, trigger }` 型を同形で定義
- T-1-3 runner: この表の外の遷移は fail-closed で拒否
- T-1-6 dogfood run: `artifacts/dogfood_run_01.md` に観察 edge を記録、この表と照合
