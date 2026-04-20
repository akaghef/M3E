# Stop Reason Taxonomy — 停止理由 → state 分類

- **status**: authoritative (T-0-4)
- **phase**: 0
- **source**: `.claude/skills/sub-pj/phase/escalation.md` (E1/E2/E3) + workflow_state_set.md の非 done 終着 state
- **referenced by**: T-1-3 runner の停止判定、T-1-6 dogfood run の停止分類

## 設計原則

- **相互排他**: 1 停止理由は `blocked` / `sleeping` / `escalated` / `failed` の **exactly one** に分類される
- **E1/E2/E3 は必ず `escalated`**: sub-pj-guard 契約を保存
- **recovery path 明記**: `failed` 以外は必ず再入経路を持つ
- **新規停止理由の決定 rubric**: 末尾の判断フローで扱う

## 分類表

| stop reason | 出所 | target state | 理由 | recovery path |
|---|---|---|---|---|
| **E1 Phase gate 到達** | escalation.md §E1（全 task done） | `escalated` | 人間専権の Phase 遷移判定 | 人間承認 → 次 Phase tasks.yaml 具体化 → `ready` |
| **E2 環境崩壊** | escalation.md §E2（tool 不在 / 依存停止 / branch 破壊） | `escalated` | 回避策が大幅な遠回り。人間支援が必要 | 人間が環境復旧 → `ready` |
| **E3 スコープ逸脱** | escalation.md §E3（plan.md Vision 超過判断） | `escalated` | plan 改訂を含む人間判断が必要 | 人間が scope 判定 → plan.md 更新 → `ready` |
| **round_max breach** | `round > round_max`（Evaluator fail 連続） | `blocked` | 自動 retry 枯渇。新しい観点や人間 review が必要 | reviews/Qn に pool → 人間 review → blocker 解消 → `ready` (E15) |
| **依存 task の failed** | 前提 task が `failed` | `blocked` | 上流回復待ち | 上流 task 再実行 or scope 切り直し → `ready` |
| **blocker 記述あり** | plan.md / reviews で明示的 blocker | `blocked` | 外部資源・判断待ち | blocker 解消 → `ready` |
| **時刻ベース待機** | ScheduleWakeup / CronCreate 発行 | `sleeping` | wakeup 時刻が未来。作業なし状態 | timer 発火 → `ready` (E09) |
| **long-running external 待機** | build / CI / 外部 API の 5 分超 wait | `sleeping` | cache TTL 境界。context を保たず wakeup で拾う | timer or 手動 nudge → `ready` |
| **実行中 fatal exception** | runner 内部で回復不能な例外 | `failed` | プロセス崩壊・ファイル破壊・invariant 破綻 | （terminal。人間が task 再生成） |
| **人間による abort 決定** | akaghef が明示的に中断 | `failed` | scope / priority 判断で実行中止 | （terminal。必要なら新 task ID で再起票） |
| **重複 task 検出** | 同一 target が別 task で done 済 | `failed` | idempotency 違反 | （terminal。統合 task に置換） |

## 既存 9 state との対応

- `pending` / `ready` / `in_progress` / `eval_pending` / `done`: 停止理由の target ではない（在線状態 or 成功終着）
- `blocked`: round_max breach / 依存 failed / 明示 blocker
- `sleeping`: 時刻ベース待機
- `escalated`: E1 / E2 / E3
- `failed`: fatal exception / 明示的 abort / idempotency 違反

## 新規停止理由の決定 rubric

新しい停止理由に遭遇したら、以下のフローで target state を決める。

```
Q1: 時刻経過だけで解消するか？
    yes → sleeping
    no  → Q2

Q2: sub-pj-guard E1/E2/E3 のいずれかに一致するか？
    yes → escalated
    no  → Q3

Q3: 自動再試行 or 既知の機械的回復で解消可能か？
    yes → blocked（reviews/Qn に pool、解消後 ready）
    no  → Q4

Q4: 人間判断 or 外部資源で回復可能か？
    yes → blocked（blocker 記述必須）
    no  → failed（terminal）
```

### 補助ルール

- **迷ったら `blocked`**: `failed` は不可逆なので、回復経路が見えない確信が無い限り `blocked` を選ぶ
- **E1/E2/E3 は必ず `escalated`**: sub-pj-guard 契約。誤って `blocked` にすると自動再開が走って違反
- **`sleeping` の上限**: wakeup 時刻が 24h 以上 → `blocked` に昇格（wakeup 前提が崩れるリスク）

## 具体例

| 観察された停止 | Q1 | Q2 | Q3 | Q4 | 結果 |
|---|---|---|---|---|---|
| build が 10 分かかる | yes | — | — | — | `sleeping` (ScheduleWakeup 270s × 3) |
| Evaluator が 3 round 連続 fail | no | no | yes (review で観点追加) | — | `blocked` + Qn pool |
| map サーバが落ちて復旧不能 | no | yes (E2) | — | — | `escalated` |
| Phase 全 task done | no | yes (E1) | — | — | `escalated` |
| 実装中に TypeScript tsc が segfault | no | yes (E2, tool 不在級) | — | — | `escalated` |
| tasks.yaml が壊れて parse 不能 | no | yes (E2) | — | — | `escalated` |
| 外部 API rate limit、24h 待ち | no | no | no | yes | `blocked` (sleeping 不採用) |
| 依存 task T-X-Y が failed | no | no | no | yes | `blocked` |
| 誤って同じ task を 2 回生成 | no | no | no | no | `failed`（片方を terminal 化） |

## Cross-reference

- `.claude/skills/sub-pj/phase/escalation.md`: E1/E2/E3 の原典。本表で `escalated` に写像
- workflow_state_set.md §Terminal vs 非 Terminal: `blocked`/`sleeping`/`escalated` は非 terminal、`failed` のみ terminal
- workflow_edges.md: 本表の各停止理由が trigger する edge は E07/E10/E11/E14/E16/E17 などに対応
- T-1-3 runner: 本表の rubric を runner の停止分類関数として実装
- T-1-6 dogfood run: 実観察された停止を本表と照合、未分類があれば rubric 更新
