# Workflow State Set — PJ03 SelfDrive 最小 9 状態

- **status**: authoritative (T-0-1)
- **phase**: 0
- **source**: plan.md §D4 (state candidates) を確定
- **referenced by**: T-0-2 (edges), T-1-1 (`WorkflowState.kind` union), tasks.yaml `status` field

## 設計原則

- **相互排他**: 1 task は常に 1 state だけを取る
- **網羅性**: どの停止理由も 9 state のいずれかに吸収される（T-0-4 で検証）
- **可観測性**: entry/exit 条件と invariant は機械チェック可能な述語として書く
- **SSOT**: `tasks.yaml` の `status` フィールドがこの state set の永続化正本

## State 一覧

| # | kind | meaning | entry condition | exit condition | invariant |
|---|---|---|---|---|---|
| 1 | `pending` | 未着手。依存 task が未完了、または runner がまだ拾っていない | task 作成時の初期値 | 依存 task すべて done、かつ runner が選択 | `round == 0` かつ `last_feedback == null` |
| 2 | `ready` | 依存解決済みで即時着手可能。runner の起動待ち | 依存 task すべて done | Generator 起動 | `round == 0` かつ blocker なし |
| 3 | `in_progress` | Generator が実装/詳細化を実行中 | Generator 起動 | Generator DONE 報告を受領 | exactly 1 Generator が紐づく |
| 4 | `eval_pending` | Generator 完了、Evaluator の verdict 待ち | `eval_required: true` かつ Generator DONE | Evaluator verdict 受領 | Generator artifact が書き込み済み |
| 5 | `blocked` | 進行不能。人間の介入または外部変化が必要 | `round > round_max` または依存崩壊 | blocker 解消が確認 | `blocker != null` が記述済み |
| 6 | `sleeping` | 時刻ベースで再開待ち（ScheduleWakeup / CronCreate） | 明示的 sleep 発行 | wakeup 時刻到達 | `wakeup_at` が未来時刻 |
| 7 | `escalated` | E1/E2/E3 検知、人間判断待ち | escalation.md の E1/E2/E3 条件一致 | 人間が承認/却下/差戻 | `escalation_kind ∈ {E1,E2,E3}` |
| 8 | `done` | 成功完了、不可逆 | verdict pass、または `eval_required: false` の objective check pass | （terminal） | `round <= round_max` かつ failed でない |
| 9 | `failed` | 回復不能な失敗、不可逆 | 実行中の致命的例外、または人間が明示的に中断決定 | （terminal） | `failure_reason != null` |

## Terminal vs 非 Terminal

- **terminal**: `done`, `failed`（再入不可）
- **非 terminal**: `pending`, `ready`, `in_progress`, `eval_pending`, `blocked`, `sleeping`, `escalated`

`blocked` は非 terminal — 外部事象で `pending` or `ready` に戻れる。  
`escalated` も非 terminal — 人間承認で `in_progress` or `blocked` に遷移。

## invariant の機械チェック観点

| 観点 | チェック内容 |
|---|---|
| 単一状態 | `status` は enum 値 1 つ |
| round 整合 | `round >= 0`, `round <= round_max` |
| blocker 記述 | `status == blocked` ⇒ `blocker` フィールド非 null |
| escalation 記述 | `status == escalated` ⇒ `escalation_kind` が E1/E2/E3 |
| wakeup 時刻 | `status == sleeping` ⇒ `wakeup_at` が未来 |
| feedback 整合 | `round > 0` ⇒ `last_feedback` 非 null |

## 非採用の候補

- **`paused`**: 人間が明示的に一時停止する状態 → `blocked` に吸収（停止理由が外部要因でも内部判断でも blocker として記述する）
- **`queued`**: runner キューに入った状態 → `ready` と区別する必要性が現時点ない
- **`reviewing`**: 人間 review 中 → `escalated` に吸収（reviews/Qn は別トラック、state には出さない）

## Cross-reference

- plan.md §D4（state candidates 9 種）: この表の `kind` 列と一致
- T-0-2 `workflow_edges.md`: この 9 state 間の遷移を列挙
- T-1-1 `beta/src/shared/workflow_types.ts`: `WorkflowState.kind` union literal として同じ 9 値
