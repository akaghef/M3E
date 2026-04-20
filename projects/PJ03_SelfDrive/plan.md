---
pj_id: PJ03
project: SelfDrive
status: exploring
date: 2026-04-20
---

# PJ03 SelfDrive — Plan

## TL;DR

定義済みの sub-pj protocol を agent が無人で履行する harness を作る。Phase 0 で摩擦を実測・分類、Phase 1 で MVP harness を 1 PJ 上で稼働、Phase 2 で inner loop 自律化（Generator/Evaluator）、Phase 3 でエスカレーション境界を機械化。

## ゴールと成功基準

### ゴール

akaghef が介入しない時間帯に、agent が PJ を前進させている状態を作る。

### 成功基準

1. 1 つの PJ（候補: 新規 dummy PJ or PJ02 の残タスク）を、人間指示 0 回で 1 task 以上進められる
2. inner loop が round_max まで自律で回り、blocked / done のどちらかに到達する
3. エスカレーション境界（env collapse / scope / phase gate）を Claude 側が機械判定し、該当時のみ人間に報告

## スコープ

- **In**: harness の設計・実装・dogfood 検証、摩擦分類、エスカレーション判定
- **Out**: 可視化、M3E 本体改修、並列 PJ、モデル選定

## 作業者向け必須情報

### 対象

自走ハーネス = **ルール + ファイル規約 + トリガー** の集合。触るのは以下のみ:

| 要素 | パス | 優先度 | 触れ方 |
|---|---|---|---|
| sub-pj-do skill | `.claude/skills/sub-pj-do/` | P0 | 本文補強（loop 明確化、stop 判定厳密化） |
| sub-pj phase docs | `.claude/skills/sub-pj/phase/*.md` | P0 | escalation.md / 2_session.md を中心に整備 |
| Stop hook | `scripts/hooks/stop-check.sh`（存在未確認） | P0 | E1/E2/E3 以外の停止を検知・block or warn |
| PostCompact hook | `.claude/settings.json` or hook dir | P1 | resume-cheatsheet 再読込を注入 |
| SessionStart hook | 既存稼働中 | P1 | prj/* guard 注入（既に動いている） |
| tasks.yaml / resume-cheatsheet | `projects/PJ{NN}/` | P0 | 規約を壊さず運用で読み書き |
| reviews/Qn_*.md | `projects/PJ{NN}/reviews/` | P1 | ambiguity pool の定着 |

**非対象**: M3E 本体（beta/, final/）、viewer.ts、map サーバ、可視化 UI。

### ドメイン固有の注意点

- **prj/* ブランチでは止まるな**: UserPromptSubmit hook が guard 注入する。E1/E2/E3 以外で停止は protocol 違反
- **cache window (5 分)**: ScheduleWakeup は 60-270s か 1200s+ の二択。中間（300s）は最悪
- **compact は不可避**: 長時間自走するほど起きる。PostCompact で resume-cheatsheet を読み直す導線を切らすな
- **tasks.yaml は実装後に動かすな**: sprint contract は実行前に固定。drift 禁止
- **reviews pool の粒度**: 1 論点 = 1 file。まとめると batch review が機能しない
- **dogfood の循環**: harness が壊れると harness を直す session も止まる。escape hatch を必ず残す（env var や手動 skill 起動）

### 前提知識

- sub-pj protocol の全体（`.claude/skills/sub-pj/protocol.md`）
- Claude Code の hooks 仕組み（SessionStart / UserPromptSubmit / Stop / PostCompact）
- ScheduleWakeup tool の cache window 規則
- subagent 委任（Task tool, generator.md / evaluator.md）
- tasks.yaml の state machine（pending / in_progress / done / blocked + round）

### 関連スキル

- `sub-pj-plan`（Phase 0-1 計画）
- `sub-pj-do`（Phase 2 セッション実行）— 強化対象
- `sub-pj`（メタ。gate / retro の窓口）
- `update-config`（hook 追加・変更時）
- `setrole`（dogfood 対象 PJ セッション開始）

### 作業環境注意事項

- Windows bash（Unix syntax 使用、`/dev/null` / forward slash）
- Claude Code は VSCode 拡張として稼働中
- 既存の hook が設定済みかは未確認（Phase 0 の T-0-3 で棚卸し）
- `scripts/hooks/` ディレクトリの有無も未確認（なければ新設）

## 探索ログ

### 2026-04-20 — kickoff

- 既存の自走要素の棚卸し対象:
  - `ScheduleWakeup` tool（dynamic /loop のペース制御）
  - `CronCreate` / `/loop` skill（固定周期トリガー）
  - hooks（SessionStart / PostCompact / Stop）
  - `resume-cheatsheet.md` / `tasks.yaml` 正本構造
  - `sub-pj-do` skill（Generator/Evaluator round loop 記述あり）
- 既知の摩擦候補（仮説、Phase 0 で実測検証）:
  - task 間遷移で「次どれ？」と人間に聞く
  - round_max 到達時に即停止して報告
  - compact 後に context を失って作業停止
  - ambiguity で pool せず止まる
  - error 発生時に root cause 追わず止まる

### 2026-04-20 — hooks inventory (既存調査)

実地確認の結果、`scripts/hooks/` に 4 ファイル全部存在し稼働中:

| hook | 現状挙動 | Phase 0 で埋めるべきギャップ |
|---|---|---|
| `session-start.sh` | prj/* なら resume.md + resume-cheatsheet + tasks.yaml + 2_session.md loop へ誘導する context を注入 | ほぼ十分 |
| `prompt-prj-check.sh` | prj/* で E1/E2/E3 以外で止めるなという guard を毎 prompt 注入 | ほぼ十分 |
| `post-compact.sh` | prj/* で resume.md 再読 + plan.md 更新 + resume-cheatsheet 再生成 + tasks.yaml から続行 | ほぼ十分 |
| `stop-check.sh` | prj/* かつ worktree dirty かつ tasks.yaml/resume-cheatsheet が HEAD から変更されてない時のみ writeback リマインダー | **弱い**。E1/E2/E3 以外の停止を検知しない。停止理由のタグ付けが無い |

**影響**: 想定より infra は揃っている。Phase 0 の焦点は「hook を新設」ではなく「**既存 hook の穴を特定**」にシフト。

真の未整備領域（仮説）:
- **自動 re-wake**: stop 後に次 prompt を待つ構造。ScheduleWakeup を skill 本文で起動する導線が未確立
- **stop 理由タグ**: 「何故止まったか」が log に残らない。violation 検知不能
- **Generator/Evaluator の自動起動**: subagent 委任のトリガーが skill 本文頼み。tasks.yaml の `eval_required: true` を確実に拾う機構が未検証
- **reviews pool の定着**: pool の書式はあるが、実運用で積まれているか未観察

### 2026-04-20 — strategy

**自走の分解**: "self-drive" はプロダクトではなく挙動。harness = **ルール + ファイル規約 + トリガー** の組で、ルール追従を default にする装置。

構成要素 4 軸:

| 軸 | 役割 | 既存要素 |
|---|---|---|
| **Trigger** | 誰が Claude を起こすか | ScheduleWakeup (dynamic), CronCreate, user prompt |
| **State** | 「次に何をやるか」の正本 | tasks.yaml, resume-cheatsheet.md, reviews/Qn_*.md |
| **Loop controller** | 次アクションを選ぶ規則 | sub-pj-do skill, escalation.md |
| **Recovery** | compact / resume 越しの文脈生存 | PostCompact hook, Stop hook, resume-cheatsheet |

**摩擦 = 4 軸のどこかの不足/断絶** と仮説立て。Phase 0 で実測検証。

### 戦略案の比較

**メインプラン A**: ルールベース harness（既存ツール合成）
- 新しい実行基盤を作らず、ScheduleWakeup + hooks + tasks.yaml + resume-cheatsheet + sub-pj-do skill を合成して「規律で自走する」形にする
- 不足があれば skill 本文 / hook 内容 / file 規約を強化して埋める
- pros: 新 infra ゼロ、即 dogfood、rollback が容易（skill/hook を戻すだけ）
- cons: Claude の規律依存。drift 発生時の検出が弱い

**サブプラン B**: 外部コントローラ（Node/bash script）
- tasks.yaml を読んで Claude CLI を headless で叩くコントローラを書く
- Claude は worker、controller は外に置く
- pros: 決定論的、テスト可能、drift に強い
- cons: headless CLI orchestration 必須、工数大、interactive flow と並立しづらい

**サブプラン C**: ハイブリッド（段階移行）
- Phase 0-2 は A、Phase 3 で A が drift したら B の要素を追加
- pros: データ駆動で infra 投下、overshoot しにくい
- cons: A のルール群を後で script 化する手戻りが少量発生

**推奨: メインプラン A**（採用時に C へ自然移行可能）

根拠:
1. **Phase 0 の観察結果次第で投資量を決める**のが合理的。今 B を選ぶと「摩擦が実はルール不足だった」場合に過剰投資
2. **PJ03 自体が dogfood**。agent が sub-pj protocol を履行する挙動を強化する = PJ のゴールそのもの
3. **rollback コストが最小**。skill / hook は git 管理、revert で即元通り
4. drift 検出は Phase 3 のエスカレーション境界機械化で別途扱う

### 技術選定

| 要素 | 採用 | 理由 |
|---|---|---|
| Trigger (inner) | **ScheduleWakeup dynamic** | cache window 内でループ、stop 時は次 /loop で続き |
| Trigger (outer) | **CronCreate は deferred** | inner loop が止まらない限り不要。Phase 2 以降に必要性を再評価 |
| State 正本 | **tasks.yaml + resume-cheatsheet.md** | 既存規約。新規 DB/json 不要 |
| Ambiguity pool | **reviews/Qn_{slug}.md** | escalation.md §A の書式踏襲 |
| Loop controller | **sub-pj-do skill の強化** | state machine は既にあるので不足部分を補筆 |
| Stop guard | **Stop hook（scripts/hooks/stop-check.sh）** | E1/E2/E3 以外で止めたら block する形に |
| Context recovery | **PostCompact hook** | resume-cheatsheet 再読込を強制注入 |
| SessionStart | **既存 SessionStart hook** | prj/* 判定 + guard 注入（既に稼働中） |
| Generator/Evaluator | **subagent 委任（Task tool）** | 既存 generator.md / evaluator.md に従う |

### 却下した技術選定

- **外部 orchestrator（Node script + Claude CLI headless）**: 投資量が Phase 0 前に見合わない。Phase 3 で A が drift した場合のみ再検討
- **専用 DB / sqlite**: tasks.yaml で足りる。追加依存はノイズ
- **独自 UI（可視化 board）**: Out of Scope（ユーザー指示）

### 未決（reviews/ に pool 予定）

- `Qn_initial`: inner/outer trigger 配分 → tentative: ScheduleWakeup のみで Phase 0-1、CronCreate は deferred
- `Qn_dogfood_target`: Phase 1 MVP の dogfood 対象 → tentative: PJ03 自身の Phase 0 を回す（自己参照）
- `Qn_stop_hook_strictness`: Stop hook は block するか warn のみか → tentative: Phase 1 までは warn、Phase 2 で block に昇格

## 確定事項

- **PJ 名**: SelfDrive（ユーザー指示で確定、2026-04-20）
- **可視化は後回し**: 現状 poor のままでよい（ユーザー指示で確定、2026-04-20）
- **dogfood 前提**: この PJ 自体が harness の最初の実稼働対象になる
- **戦略方針**: ルールベース harness（メインプラン A）を採用。既存 ScheduleWakeup + hooks + tasks.yaml + resume-cheatsheet + sub-pj-do skill を合成し、新 infra は作らない（2026-04-20 tentative、Gate 1 でユーザー最終承認予定）
- **自走の 4 軸分解**: Trigger / State / Loop controller / Recovery（2026-04-20）
- **dogfood 対象**: 自己参照。PJ03 の Phase 0 を harness で回す（2026-04-20 tentative）
- **既存 hooks がベースライン**: `scripts/hooks/` の 4 hook は稼働済み。新設ではなく穴埋めが作業の中心（2026-04-20）

### 却下した代替案

- 「可視化 UI から先に作る」— ユーザー指示で明示的に後回し。理由: 可視化は自走実現の必要条件ではない
- 「並列マルチ PJ 実行を含める」— Out of Scope。理由: まず単一 PJ を自走させる
- 「外部 orchestrator（Node script + Claude CLI headless）」— Phase 0 観察前の過剰投資。ルールベースで drift が出てから再検討（2026-04-20）
- 「専用 DB / sqlite で状態管理」— tasks.yaml で足りる。追加依存はノイズ（2026-04-20）
- 「CronCreate を最初から導入」— inner loop が止まらない限り不要。Phase 2 以降で必要性を再評価（2026-04-20）

## Phase 設計

### Phase 0 — 摩擦インベントリと穴特定（〜1 週間）

目的: 既存 hook ベースラインの上で、実際に自走を阻む穴を特定する。

- PJ01/PJ02 の進行履歴から人間介入点を抽出（T-0-1）
- 摩擦の分類と hook カバー率の対応付け（T-0-2）
- 既存 4 hook の挙動 vs 必要挙動の差分棚卸し（T-0-3 改訂）
- エスカレーション境界候補の列挙（T-0-4）
- Gate 1 readiness まとめ（T-0-5）

Gate 1 条件: 摩擦分類・hook ギャップ表・MVP 要件が 1 文書に整理され、akaghef が確認

### Phase 1 — 穴埋め harness MVP（〜1 週間）

目的: Phase 0 で特定した穴を最小構成で埋め、1 PJ を半日以上無人進行させる。

典型的に想定される実装（Phase 0 で確定する）:
- `stop-check.sh` に停止理由タグ付け（E1/E2/E3/other の自己申告）を追加
- `sub-pj-do` skill 本文に ScheduleWakeup 起動導線を明記（各 task 完了時に次 wake を schedule）
- tasks.yaml の `eval_required: true` 自動検知の skill 側補強

Gate 2 条件: dogfood で無人 1 task 完走ログ、stop 理由が観察可能

### Phase 2 — inner loop 自律化（〜1-2 週間）

目的: Generator / Evaluator の round loop を harness に組み込む。

- Evaluator verdict に基づく round 遷移
- `eval_required: true` task の自動 Evaluator 起動
- round_max 到達時の blocked 遷移と reviews/ 起票

### Phase 3 — エスカレーション境界の機械化（〜1 週間）

目的: 人間を呼ぶ条件を明文化し、機械判定可能にする。

- Phase gate readiness の自動検知
- env collapse の検知パターン（tool error / service down / build fail 連続）
- scope 逸脱の検知（plan.md の Out of Scope への抵触）

## 実行計画

最初の具体 task は [tasks.yaml](tasks.yaml) を参照。

## 進捗ログ

- 2026-04-20: kickoff。README / plan.md / tasks.yaml / runtime/README.md / resume-cheatsheet.md 生成
- 2026-04-20: 戦略策定。4 軸分解（Trigger/State/Loop/Recovery）、メインプラン A（ルールベース harness）採用、サブプラン B (外部 orchestrator) 却下。技術選定: ScheduleWakeup + Stop hook + PostCompact hook + tasks.yaml + sub-pj-do skill。作業者向け必須情報セクション追加。Gate 1 readiness 到達
