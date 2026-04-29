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

正式 sub-PJ 採番は増やさず、`PJ03_SelfDrive` 内の experiment として扱う。

## Vision

### 問題

active PJ の状況、daily、task、review、agent 状態が分散し、週次レビュー時に人間が毎回集約している。これは MDD / self-driving 化の前段で大きな律速になる。

### 完了像

M3E のオーケストレーション層が、active PJ の構造化コンテキストを読み、mock provider または DeepSeek provider を通して週次レビュー案を生成し、結果を review-ready な proposal として残せる。

### In Scope

- active PJ の週次レビューを模擬入力から生成する。
- LLM 呼び出しは `LLMClient` 抽象越しに行う。
- secret は repo / settings / log に出さない。
- mock provider で鍵なし end-to-end を通す。
- DeepSeek provider は Node 側境界からのみ呼ぶ。
- 失敗は停止ではなく Result / reviews/Qn に変換する。

### Out of Scope

- ブラウザ JS からの provider 直接呼び出し。
- AI 生成結果の正本自動反映。
- LangGraph / CrewAI / Hermes の本格導入。
- 全 active PJ の実データ自動巡回。
- 週次レビュー UI の完成。

## 主成果物

1. PJv34 weekly review の scope/facet/task 契約。
2. mock provider で回る最小 orchestration loop。
3. DeepSeek を安全に差し込むための gap list と実装順序。

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
| secret / provider 方針 | ◎ 最終判断 | 安全設計 | 実装 | 検査 |
| orchestration loop | judge | 設計・統合 | 実装 | mock E2E 検証 |
| 週次レビュー文面 | judge | 仕様化 | 生成 | 評価 |
| Phase 遷移判定 | ◎ 必ず人間 | × 勝手に進めない | - | - |

## 運用ルール（要点）

- human outer loop / autonomous inner loop を分ける。
- AI は proposal を作るだけで、正本を書き換えない。
- secret は Bitwarden / env から実行時注入し、ファイルへ書かない。
- browser は provider を直接呼ばない。
- task から runtime view / workspace へ traceability を持たせる。
- Phase 遷移は人間 gate。

## Future Work

- active PJ の実 map / daily / git log から context package を自動生成する。
- weekly review proposal を M3E map の Review scope に書き戻す。
- provider fallback と rate budget を UI から見えるようにする。
- PJv34 を正式 sub-PJ として採番するか判断する。

## 進捗ログ

- 2026-04-29: PJv34 を PJ03_SelfDrive 内の模擬 PJ として詳細化開始。
