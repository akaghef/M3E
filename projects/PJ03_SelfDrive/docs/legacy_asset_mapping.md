# Legacy Asset Mapping — 現行資産 → workflow element

- **status**: authoritative (T-0-3)
- **phase**: 0
- **source**: plan.md §流用方針 §2 手元資産 + reviews/Qn_initial（runtime host 候補）
- **referenced by**: T-1-3 reducer 実装（writeback 先の決定）、T-1-5 checkpoint 実装

## 目的

現行資産を workflow state / edge / checkpoint のどの役割として流用するかを固定する。
新規資産（engine 本体）との境界を明確にする。

## マッピング表

| asset | 実ファイル / 機能 | writes state(s) | triggers edge(s) | checkpoint role |
|---|---|---|---|---|
| `tasks.yaml` | `projects/PJ03_SelfDrive/tasks.yaml` の sprint contract（id / phase / verb / target / done_when / eval_required / eval_criteria / round_max / dependencies / linked_review） | — (T-1-8 以降 machine state は含まない) | 直接は triggerしない。reducer が contract として読む | **human contract**: 何をやるかの宣言。machine state は checkpoint JSON に分離 |
| `runtime/checkpoints/{id}.json` | T-1-8 で新設。state (kind / round / last_feedback / blocker / escalation_kind / wakeup_at / wakeup_mechanism / failure_reason) を保持 | 9 state すべて（永続化先） | 直接は triggerしない。reducer が atomic tmp+rename で書き込み | **machine SSOT**: 1 task の最新 state はここで確定 |
| `resume-cheatsheet.md` | `projects/PJ03_SelfDrive/resume-cheatsheet.md` | — (state は書かない、human summary) | — | **human-facing checkpoint**: 次 task ID / open reviews / 直近コミットの要約 |
| `reviews/Qn_*.md` | `projects/PJ03_SelfDrive/reviews/Qn{n}_{slug}.md` | `blocked` の blocker field 参照先 | E07 (round_max breach → blocked), E15 (blocker 解消 → ready) の実根拠 | （checkpoint ではない、判断負債プール） |
| `ScheduleWakeup` | `.claude/skills/` 経由の native API | `sleeping` | E08 (in_progress → sleeping), E09 (sleeping → ready) | 時間ベース checkpoint（次回起動時に reducer が拾う） |
| `CronCreate` | 同上、scheduled trigger | `sleeping`（長周期 or 繰返し） | E08, E09 | ScheduleWakeup と相補（ScheduleWakeup は one-shot / Cron は繰返し） |
| `SessionStart` hook | `.claude/scripts/hooks/session-start.sh` 相当 | — (read-only、reducer 復元) | 起動時に in_progress task を検出して resume へ誘導 | **resume entry point**: resume-cheatsheet.md + tasks.yaml を読む強制 |
| `PostCompact` hook | compaction 後の context 再構築 | — | compaction で失われた state を resume-cheatsheet.md から復元 | **cache-miss recovery**: compaction 耐性の第 1 線 |
| `Stop` hook | `.claude/scripts/hooks/stop-check.sh` 相当 | `escalated`（E1/E2/E3 以外の停止を検知） | E10/E11（escalation detect） | 停止条件の最終ガード。誤停止を block |
| `sub-pj-do` skill | `.claude/skills/sub-pj-do/` | 決定論的ループの指示文字列 | 現状は指示文字列経由で全 edge を trigger（engine 化で reducer に移譲） | （skill 自体は checkpoint ではない、reducer のラッパー） |

## Qn_initial 対応

`reviews/Qn_initial.md` の tentative default（ScheduleWakeup + CronCreate 併用）を本表に反映済み:

- **ScheduleWakeup**: one-shot な sleeping（例: 5 分後に build 結果確認）
- **CronCreate**: 繰返し sleeping（例: daily retrospective、1 時間毎の progress board refresh）

両者を `sleeping` state の内部 tag（`wakeup_mechanism: one-shot | cron`）で区別する案が T-1-1 型定義候補。

## Gap — 未マッピング資産

| asset | 現状 | 必要性 |
|---|---|---|
| `Progress Board` (map scope) | 人間 read-only、reducer 未接続 | Phase 3 で engine ↔ map の writeback を設計 |
| `Evaluation Board` (map scope) | 未構築 | Phase 1 で round feedback の露出先として必要 |
| Generator subagent の prompt 正本 | `sub-pj-do/phase/generator.md` | engine 化で `WorkflowNode.role = generator` の payload に格納 |
| Evaluator subagent の prompt 正本 | `sub-pj-do/phase/evaluator.md` | 同上、`role = evaluator` |
| `plan.md 進捗ログ` | 人間記述 + Claude 追記 | done 時に reducer が自動追記する導線は Phase 2 以降 |

## engine に移管する責務

現状 `sub-pj-do` の指示文字列に埋まっている次の責務を、engine が取る:

1. **task 選定ロジック**: in_progress 優先 → pending 昇順 → 全 done で E1
2. **round 判定**: `round < round_max` の分岐（E06 vs E07）
3. **eval_required 分岐**: E03 vs E04
4. **writeback 手順**: status / round / last_feedback → `tasks.yaml`
5. **resume-cheatsheet 再生成**: task 完了ごと

`sub-pj-do` skill は engine の thin wrapper になる（長期方針、Phase 2〜3）。

## Cross-reference

- plan.md §流用方針（外部ツール / 手元資産 / 独自実装の 3 層）: 本表は「手元資産」層を網羅
- reviews/Qn_initial.md: tentative default を本表で採用
- T-1-3 reducer: writeback 対象は `tasks.yaml`（primary）+ `resume-cheatsheet.md`（human summary）
- T-1-5 checkpoint: primary = tasks.yaml、human-facing = resume-cheatsheet.md
