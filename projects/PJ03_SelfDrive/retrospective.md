---
pj_id: PJ03
project: SelfDrive
date: 2026-04-21
status: final-retrospective
owner: akaghef
---

# PJ03 SelfDrive — Retrospective

## 1 行サマリ

**状態機械 + checkpoint 分離 + Clock/Resolver injection + scope projection を揃え、「M3E が動的 workflow を 1 scope 内で扱える方向」の最小実装に到達**。Gate 2 差戻を 1 回経験して設計の穴を埋めた経緯が本 PJ の主要学習。

## Phase 別振り返り

### Phase 0 — 設計分岐の確定

良かった:
- plan.md の reframe (friction-harness → workflow engine dogfood) 直後に 4 成果物を独立 docs/*.md として固定、SSOT 方針を早期に打ち立てた
- Evaluator subagent 4/4 pass で迅速に Gate 1 readiness に到達

反省:
- plan.md に `§基本遷移` / `§S3` セクションが未存在のまま tasks.yaml が cross-reference を立てていた（forward ref）。T-0-5 で逆参照を張る方式で救ったが、contract と plan.md の「何が先か」を最初に合わせるべきだった

### Phase 1 — 最小 workflow engine

良かった:
- T-1-1 型、T-1-3 fail-closed runner、T-1-4 evaluator loop、T-1-5 checkpoint を短く通した
- dogfood_run_01 で T-1-2..T-1-5 自身を runner 経由で pending→done に動かして成立を示した

反省（Gate 2 差戻の主因）:
- tasks.yaml を SSOT と呼びつつ、WorkflowState に宣言した escalationKind / wakeupAt / wakeupMechanism / failureReason を永続化していなかった（**persistence gap**）
- runner を engine と呼んでいたが実体は signal reducer（**過大評価**）
- pickNextTask が FIFO で依存/sleeping/escalated を見なかった
- sleeping に時間ソースが無い、escalated が flag 化、node graph が未使用、round 定義が曖昧
- "code-reachable だから OK" を Gate 根拠にしたのは甘かった

### Phase 1.5 — Gate 2 rework

良かった:
- akaghef 指摘 8 点を Qn3 に pool、P1-P4 の方針指示を受けてから rework に入った（手戻り最小化）
- rework 完了条件を「宣言 state の resume 情報欠落なし」と akaghef が明示、checkpoint_restore_test 9/9 で直接検査
- tasks.yaml ↔ checkpoint JSON 分離、reducer rename、Clock interface injection、workflow_example.json 降格の 4 変更を 1 セッションで連続適用

反省:
- migrate_checkpoints.ts を T-1-8 以降も残していた結果、Phase 2 kickoff で legacy schema のまま実行し全 checkpoint の state.kind を undefined に潰した（**Qn4**）。git で復旧できたが、schema breaking change 直後に関連 migration script を削除する運用を徹底すべき

### Phase 2 — 実行基盤の仮接続

良かった:
- akaghef の 4 着手条件（Clock daemon / orchestrator / hook 配線 / 実稼働観察）に 1:1 で T-2-1..T-2-4 を起票
- dogfood_run_02 で sleeping / escalated / failed を実 runtime 観察、Gate 2 soft flag を閉じた
- SubagentAdapter + FeedbackHook の interface だけ露出し、実 Anthropic API 実装は PJ 外に切り分けた

反省:
- pickNextTask が eval_pending を返さないバグが T-2-2 test で初露出。reducer で eval_pending を orchestrator-driven 状態として扱うべき点は Phase 1 で気付けた

### Phase 3 — M3E 1 scope 統合

良かった:
- projection を一方向・read-only に限定、map → reducer 逆流を禁止した設計
- workflow.* namespace で M3E 既存 facet と分離
- 本 PJ 自身を実データで投影し、snapshot JSON が AppState shape に準拠することを確認

反省:
- 実 M3E viewer 側で workflow scope を描画する UI は本 PJ の非目標としたので、dogfood_run_03 のデータ投影で成立判定したが、実描画まで進めれば "動的 workflow を scope 内で扱える" がより強く言える。後続 PJ で起票可能

## Evaluator が見逃したバグ（harness 改善案の素）

1. **Phase 1 Gate 2 時点で Evaluator が persistence gap を検出できなかった**: 個別タスクの done_when/eval_criteria には invariant の round-trip チェックが無く、各 Evaluator は narrow 契約のみ確認した。PJ 全体を跨ぐ整合 check を独立した Evaluator role（"architecture integrity evaluator"）として分離する案が Phase 2+ の改善候補
2. **Qn4 regression（migrate script の再実行）を事前に止めるガードが無かった**: schema_version check を migration script 側で強制すべきだった。legacy 対応の一般策として「script 先頭で前提 schema を assert する pattern」を harness rule 化候補

## 次 PJ へ持ち越す harness 改善

- "architecture integrity evaluator": narrow 契約とは別に、PJ 跨ぎの不変性（SSOT 整合・責務境界・naming ↔ 実体）を Gate 前に確認する Evaluator role
- schema_version assertion pattern: migration script は想定前提の schema_version を冒頭で assert し、違えば明示エラーで終了
- Gate readiness template: 「code-reachable」を根拠に使う前に「実稼働観察の有無」「遅延理由」を明記させる template 強制
- tick auto-promotion の可視化: tick が自動発火した遷移は dogfood log に明示的に記録する運用

## 一般化できる教訓（`projects/retrospective_general.md` 候補）

1. **SSOT は宣言 + 機械検査で保証する**: 宣言した invariant field は save/load round-trip test で欠落ゼロを強制する
2. **名前と実体の一致**: engine / runner / reducer / orchestrator のどれを目指すか plan.md に明記し、実装がずれたら名前を先に直す
3. **Schema breaking change 後は migration script を即削除**: 一度役目を終えた migration は再実行で壊す
4. **Gate 根拠に "code-reachable" は弱い**: 実稼働観察まで持っていくか、観察未達を明示的に defer する
5. **akaghef 指示の項目数に tasks を 1:1 で合わせる**: rework task の粒度を指示に合わせると責務分担が自然に決まる
6. **projection は一方向**: SSOT を持つレイヤから下位の表示レイヤには write-only

## M3E 本体への機能要求候補（`backlog/app-feature-gaps.md` 候補）

- workflow.* namespace の attribute を map viewer で可視化する facet（color / badge / status indicator）
- 複数 scope に跨る workflow summary の集約
- checkpoint JSON の schema versioning を M3E Resource として統合
- reviews/Qn frontmatter を watch して自動 E15/E12 発火する review_bridge

## Evaluator 結果（統計）

| Phase | Evaluator pass |
|---|---|
| 0 | 4/4 (T-0-1..T-0-4) |
| 1 | 6/6 (T-1-1..T-1-6) |
| 1.5 | 4/4 (T-1-8..T-1-11) |
| 2 | 4/4 (T-2-1..T-2-4) |
| 3 | 3/3 (T-3-1..T-3-3) |
| **合計** | **21/21 Evaluator round 1 pass** |

Gate 1 通過、Gate 2 差戻 → rework → Gate 2 v2 通過、Gate 3 akaghef 承認待ち。

## Cross-reference

- [plan.md §Phase 3 結論](plan.md)
- [artifacts/dogfood_run_01.md](artifacts/dogfood_run_01.md) — Phase 1 初成立
- [artifacts/dogfood_run_02.md](artifacts/dogfood_run_02.md) — sleeping/escalated/failed 実稼働
- [artifacts/dogfood_run_03.md](artifacts/dogfood_run_03.md) — scope projection
- [artifacts/workflow_scope_snapshot.json](artifacts/workflow_scope_snapshot.json)
- [reviews/Qn3_gate2_rework.md](reviews/Qn3_gate2_rework.md)
- [reviews/Qn4_migrate_script_regression.md](reviews/Qn4_migrate_script_regression.md)
