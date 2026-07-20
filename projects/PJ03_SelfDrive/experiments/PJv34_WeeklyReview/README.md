---
pj_id: PJv34
project: WeeklyReview
date: 2026-04-29
status: exploring
owner: akaghef
related: plan.md
parent_pj: PJ03_SelfDrive
source: backlog/pj-vision-100.md#34
---

# PJv34 WeeklyReview

PJv34 は `backlog/pj-vision-100.md` の 34「週次レビュー自動化」を、M3E self-driving loop の模擬 PJ として詳細化する実験スコープである。

2026-04-29 時点では、PJ04 で作る最小ループの模擬対象として扱う。入力はローカル `projects/` フォルダ、出力は `tmp/` 配下のレポートファイルに限定する。

正式 sub-PJ 採番は増やさず、`PJ03_SelfDrive` 内の experiment として扱う。

## Vision

### 問題

ローカル `projects/` フォルダ内に sub-PJ の README / plan / tasks / reviews / sessions が分散しており、週次レビュー時に人間が毎回状況を読み直している。これは MDD / self-driving 化の前段で大きな律速になる。

### 完了像

M3E のオーケストレーション層が、ローカル `projects/` フォルダを読み、PJごとの状態を粗く集約し、週次レビュー案を `tmp/` に出力できる。まずは LLM なし / mock provider で deterministic に動く最小ループを成立させる。

### In Scope

- ローカル `projects/` フォルダを入力にする。
- `projects/PJ*/README.md`, `plan.md`, `tasks.yaml`, `reviews/` を読む。
- 週次レビュー案を `tmp/weekly-review-*.md` と `tmp/weekly-review-*.json` に出す。
- LLM なし / mock provider で鍵なし end-to-end を通す。
- 失敗は停止ではなく Result / Qn-like item に変換する。

### Out of Scope

- ブラウザ JS からの provider 直接呼び出し。
- AI 生成結果の正本自動反映。
- DeepSeek 実API呼び出し。
- Bitwarden secret 実取得。
- map 正本への自動反映。
- `projects/` 外の local telemetry / private history 読み取り。
- LangGraph 本体の本格導入。

## 主成果物

1. `projects/` 入力、`tmp/` 出力の週次レビュー最小ループ。
2. PJv34 weekly review の scope/facet/task 契約。
3. DeepSeek / LangGraph を後続で差し込むための境界メモ。

## メタ情報

| 項目 | 値 |
|---|---|
| PJ | PJv34 WeeklyReview |
| 位置付け | PJ03_SelfDrive 内の模擬 PJ |
| 作業場所 | `projects/PJ03_SelfDrive/experiments/PJv34_WeeklyReview/` |
| 原典 | `backlog/pj-vision-100.md` 34 |
| 関連 Vision | V2, V5 |
| 関連 Strategy | S3, S10, S11, S12 |
| runtime | 4-view runtime を使う |

## ドキュメント構成

| ファイル | 役割 |
|---|---|
| `plan.md` | 探索、方針、Phase、facet、実行計画 |
| `tasks.yaml` | sprint contract 正本 |
| `resume-cheatsheet.md` | 再開用 1 画面メモ |
| `runtime/README.md` | Progress / Evaluation / Review / Workspace の使い分け |
| `reviews/Qn_initial.md` | 初期判断負債 |

## 役割分担

| 領域 | 人間（akaghef） | Claude/Codex Manager | Generator | Evaluator |
|---|---|---|---|---|
| Vision / scope 確定 | ◎ | 候補整理 | - | - |
| input / output 方針 | ◎ 最終判断 | 安全設計 | 実装 | 検査 |
| orchestration loop | judge | 設計・統合 | 実装 | local E2E 検証 |
| 週次レビュー文面 | judge | 仕様化 | 生成 | 評価 |
| Phase 遷移判定 | ◎ 必ず人間 | × 勝手に進めない | - | - |

## 運用ルール（要点）

- human outer loop / autonomous inner loop を分ける。
- AI は proposal を作るだけで、正本を書き換えない。
- Phase 0 では secret を使わない。
- 出力は一旦 `tmp/` に限定し、map / docs 正本へは自動反映しない。
- 後続でDeepSeekを使う場合も browser は provider を直接呼ばない。
- task から runtime view / workspace へ traceability を持たせる。
- Phase 遷移は人間 gate。

## Future Work

- active PJ の実 map / daily / git log から context package を自動生成する。
- weekly review proposal を M3E map の Review scope に書き戻す。
- provider fallback と rate budget を UI から見えるようにする。
- PJv34 を正式 sub-PJ として採番するか判断する。

## 進捗ログ

- 2026-04-29: PJv34 を PJ03_SelfDrive 内の模擬 PJ として詳細化開始。
- 2026-04-29: 目標を「ローカル `projects/` 入力から週次レポートを `tmp/` に出す最小ループ」へ修正。
