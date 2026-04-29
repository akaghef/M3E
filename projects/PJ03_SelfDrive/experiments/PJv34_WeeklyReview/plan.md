---
status: exploring
date: 2026-04-29
runtime: 4-view
---

# PJv34 WeeklyReview Plan

## TL;DR

PJv34 は、週次レビュー自動化を題材にして、M3E の self-driving 最小ループを検証する模擬 PJである。最初のゴールは、DeepSeek をいきなり使うことではなく、ローカル `projects/` フォルダを入力にして、週次レポートを `tmp/` に出す deterministic loop を 1 周させること。

## ゴールと成功基準

### ゴール

PJ04 で作る self-driving 最小ループの前段として、`projects/` 内の sub-PJ 状態を読み、週次レビュー案を `tmp/` に出力するローカル完結のオーケストレーションを作る。

### 成功基準

- `projects/` 配下の PJ候補を列挙できる。
- PJごとの README / plan / tasks.yaml / reviews を可能な範囲で読む。
- 週次レビューの中間JSONとMarkdownを `tmp/` に出力できる。
- 鍵なし / networkなしで end-to-end が通る。
- 読めないPJや壊れたYAMLがあっても loop 全体は停止せず、Result / Qn-like item に落ちる。
- 後続で `LLMClient` / DeepSeek / LangGraph に差し替えられる境界が残っている。

## スコープ

### In

- Node 側 orchestration boundary。
- `projects/` folder scanner。
- PJ summary extractor。
- Weekly review context package builder。
- `tmp/` artifact writer。
- mock / deterministic summarizer。

### Out

- browser UI 統合。
- DeepSeek 実API呼び出し。
- Bitwarden secret 実取得。
- map 正本への自動反映。
- `projects/` 外の local telemetry / private history 読み取り。
- LangGraph 本体導入。

## 作業者向け必須情報

P0:
- `projects/` 配下の sub-PJ ディレクトリ。
- `projects/PJ*/README.md`, `plan.md`, `tasks.yaml`, `reviews/`
- `tmp/` 出力ディレクトリ。

P1:
- `projects/PJ03_SelfDrive/experiments/PJv34_WeeklyReview/`
- `docs/04_Architecture/AI_Infrastructure.md`
- `docs/03_Spec/AI_Integration.md`

P2:
- M3E map API への review/Qn 書き戻し。
- DeepSeek provider。

### ドメイン固有の注意点

- AI は提案のみ。正本更新は人間承認後。
- Phase 0 は secret を使わない。
- 出力先は `tmp/` に限定し、docs / map 正本へ自動反映しない。
- 後続でLLMを使う場合も browser に provider key を渡さない。
- 失敗時は fail-closed だが、orchestration graph 全体は停止させない。

### 前提知識

- `map / scope / node / facet / sub-agent / Manager / reviews/Qn`
- sub-PJ protocol の `README / plan / tasks.yaml / reviews / runtime`。
- OpenAI-compatible chat completions は Phase 2 以降。
- Bitwarden CLI は Phase 2 以降の secret source。

## 方針

### メインプラン: Local folder loop first

Node/TS 側にローカル `projects/` scanner、summary extractor、artifact writer を作る。LLM と secret は使わず、deterministic summarizer で `tmp/` に weekly report を出す。

推奨理由:
- 鍵・ネットワーク・map書き戻しを外して、loop 自体を最短で検証できる。
- `projects/` は既にsub-PJ運用の正本に近い。
- 後続でLangGraph/DeepSeekを差し込む境界を保てる。

### サブプラン: LLMClient first

`LLMClient` と DeepSeek provider を先に切る。

保留理由:
- 今日の目的はPJ04のloop成立であり、provider連携は依存を増やす。

## Facet 設計

### F1. Progress Board

- 役割: PJv34 の phase、task、blocker、次 gate を示す。
- 構造: `Phase -> Task -> Evidence alias`
- 属性: `status`, `owner`, `done_when`, `blocker`
- 例: `T-0-2 local weekly schema` with `status=pending`
- 使う瞬間: 全 task の進行管理。

### F2. Active Workspace

- 役割: 実装対象・設計対象の現物を置く。
- 構造: `Boundary -> Interface -> Extractor -> Writer`
- 属性: `kind`, `risk`, `data_policy`
- 例: `ProjectsScanner` with `input=projects/`
- 使う瞬間: T-0-2 以降の実装設計。

### F3. Evaluation Board

- 役割: local loop E2E、broken file handling、artifact output の結果を置く。
- 構造: `Check -> Evidence -> Verdict`
- 属性: `verdict`, `output_path`, `error_code`
- 例: `projects folder weekly review E2E` with `verdict=pending`
- 使う瞬間: T-0-4 以降。

### F4. Review

- 役割: 人間判断が必要な論点を Qn として溜める。
- 構造: `Qn -> Option -> Rationale`
- 属性: `status`, `selected`, `risk`
- 例: `Qn1 input boundary` with `selected=projects/ only`
- 使う瞬間: input範囲 / 出力先 / provider導入の判断時。

## Phase 設計

### Phase 0: Local Projects Loop（今日の対象）

目的: ローカル `projects/` を読んで、`tmp/` に週次レビュー案を出す。

完了条件:
- `projects/` 配下のPJを列挙できる。
- PJごとの summary JSON を作れる。
- `tmp/weekly-review-latest.md` と `tmp/weekly-review-latest.json` を出力できる。
- 読み取り失敗が Qn-like item として出力に残る。

### Phase 1: LangGraph-shaped Orchestration

目的: Phase 0 の処理を LangGraph 風の node/edge/state 構造へ寄せる。

完了条件:
- state schema が定義されている。
- `load_projects -> build_context -> generate_report -> evaluate -> write_tmp` の構造で実行できる。
- 実装が `@langchain/langgraph` へ移し替え可能。

### Phase 2: DeepSeek Secure Smoke

目的: Bitwarden/env secret 経由で DeepSeek を 1 回だけ安全に呼ぶ。

完了条件:
- key がログに出ない。
- request trace に req_id / latency / model / token / error が残る。
- provider failure が Result として扱われる。

### Phase 3: M3E Runtime Integration

目的: weekly review proposal を M3E map runtime に接続する。

完了条件:
- Review scope へ proposal / Qn を手動またはAPIで登録できる。
- Progress Board と Evaluation Board に結果が残る。

## Phase 0 着手手順

- [ ] Step 0: `projects/` 配下のPJディレクトリ規約を確認する（10分）
- [ ] Step 1: 読むファイルを README / plan / tasks.yaml / reviews に絞る（10分）
- [ ] Step 2: weekly project summary JSON schema を定義する（20分）
- [ ] Step 3: `tmp/` 出力ファイル名とMarkdownフォーマットを決める（15分）
- [ ] Step 4: local loop の node/edge/state を疑似コード化する（20分）
- [ ] Step 5: 実装タスクを Phase 0 用に切り直す（15分）

## 確定事項

- 2026-04-29: PJv34 は正式採番せず、PJ03_SelfDrive 内の模擬 PJ として進める。
- 2026-04-29: 目標をローカル `projects/` 入力、`tmp/` 出力の週次レビュー最小ループへ変更。DeepSeek は後続 Phase に送る。

## 判断負債

- Qn1: Phase 0 で読む `projects/` 内ファイルをどこまで広げるか。
- Qn2: PJのactive/paused/done判定をREADME frontmatterだけで行うか、plan.mdも見るか。
- Qn3: `tmp/` の出力ファイルを毎回上書きにするか、timestamp付きにするか。
- Qn4: LangGraph実体をPhase 1で導入するか、当面は自前のGraph-shaped runnerに留めるか。

## 探索ログ

### 2026-04-29: 目標修正

- **調査結果**: PJ04 の目標は provider 連携そのものではなく、まず loop を作ること。
- **判断**: PJv34 Phase 0 は `projects/` folder を入力、`tmp/` を出力にするローカル完結ループへ変更する。
- **未決**: `@langchain/langgraph` をすぐ入れるか、自前のGraph-shaped runnerで形を固めてから導入するか。

## 実行計画

Phase 0 ではコード実装へ入る前に、`projects/` 入力と `tmp/` 出力の契約を確定する。LLM/DeepSeek/Bitwarden は loop が通った後の差し込み対象として扱う。

## 進捗ログ

- 2026-04-29: PJv34 詳細化 skeleton を作成。
- 2026-04-29: Phase 0 の目標を local projects loop に修正。
- 2026-04-29: `projects/` 入力から `tmp/weekly-review-latest.md` / `.json` を出す最小ループを実装し、3 projects を対象に1周成功。
