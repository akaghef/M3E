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

## 確定事項

- **PJ 名**: SelfDrive（ユーザー指示で確定）
- **可視化は後回し**: 現状 poor のままでよい（ユーザー指示で確定）
- **dogfood 前提**: この PJ 自体が harness の最初の実稼働対象になる

### 却下した代替案

- 「可視化 UI から先に作る」— ユーザー指示で明示的に後回し。理由: 可視化は自走実現の必要条件ではない
- 「並列マルチ PJ 実行を含める」— Out of Scope。理由: まず単一 PJ を自走させる

## Phase 設計

### Phase 0 — 摩擦インベントリと harness 設計（〜1 週間）

目的: 何を自動化すれば自走するかを、実観察に基づいて確定する。

- PJ01/PJ02 の進行履歴（sessions / git log / retrospective）から人間介入点を抽出
- 摩擦の分類軸を決定（task 遷移 / gate / resume / error / ambiguity / env）
- 各分類に対する既存 tool の適合度を評価
- harness MVP の機能要件と非機能要件を確定

Gate 1 条件: 摩擦インベントリ・分類・MVP 要件が 1 文書に整理され、akaghef が確認

### Phase 1 — harness MVP 実装（〜1 週間）

目的: 1 PJ を 1 日無人で前進させる最小構成を動かす。

- ScheduleWakeup + resume-cheatsheet + tasks.yaml の最小連携
- dummy PJ（または PJ02 残タスク）で dogfood
- 1 task 完走を記録

Gate 2 条件: 無人 1 task 完走ログ、エスカレーション 0 件 or 想定内のみ

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
