---
status: exploring
date: 2026-04-29
runtime: 4-view
---

# PJv34 WeeklyReview Plan

## TL;DR

PJv34 は、週次レビュー自動化を題材にして、M3E の self-driving 最小ループを検証する模擬 PJ である。最初のゴールは、DeepSeek をいきなり使うことではなく、mock provider で `scope -> task -> LLMClient -> review proposal -> trace log` が 1 周すること。

## ゴールと成功基準

### ゴール

M3E の langgraph 相当オーケストレーション層から、DeepSeek API を安全に使える最小構造を作る。その検証対象として、active PJ の週次レビュー案を生成する。

### 成功基準

- `LLMClient` 抽象で mock provider と DeepSeek provider を差し替えられる。
- API key が repo、settings、ログ、browser JS に出ない。
- Bitwarden CLI または env から実行時に secret を解決できる設計になっている。
- mock provider で鍵なし end-to-end が通る。
- DeepSeek smoke test のログに key が出ず、latency / model / token / error だけ残る。
- API失敗時に orchestrator が停止せず、review/Qn 相当の Result を返す。

## スコープ

### In

- Node 側 orchestration boundary。
- `LLMClient` / `SecretProvider` / `TraceLogger` の最小契約。
- Weekly review 用 context package の模擬入力。
- mock provider E2E。
- DeepSeek provider smoke のための最小実装計画。

### Out

- browser UI 統合。
- 実 active PJ の全自動クロール。
- DeepSeek 以外の provider 本格実装。
- map 正本への自動反映。
- LangGraph 本体導入。

## 作業者向け必須情報

### 対象

P0:
- `beta/src/node/llm/` または同等の Node 側 LLM 基盤。
- `docs/04_Architecture/AI_Infrastructure.md`
- `docs/03_Spec/AI_Integration.md`

P1:
- `projects/PJ03_SelfDrive/experiments/PJv34_WeeklyReview/`
- daily / Current_Status からの weekly context 生成。

P2:
- M3E map API への review/Qn 書き戻し。

### ドメイン固有の注意点

- AI は提案のみ。正本更新は人間承認後。
- secret はアプリ内部で永続化しない。
- browser に provider key を渡さない。
- 失敗時は fail-closed だが、orchestration graph 全体は停止させない。

### 前提知識

- `map / scope / node / facet / sub-agent / Manager / reviews/Qn`
- OpenAI-compatible chat completions。
- Bitwarden CLI は secret source であり、feature 設定 source ではない。

### 関連スキル

- devM3E
- m3e-map（map 書き戻し段階）
- codex-impl / codex-review（実装・検証段階）

## 方針

### メインプラン: Node module first

Node 側に `LLMClient` と `SecretProvider` を作り、browser から provider を直接呼ばない。local proxy は必要になるまで作らず、まず orchestration layer 内の module として閉じる。

推奨理由:
- secret を Node process 内に閉じ込めやすい。
- mock provider でテストしやすい。
- 既存 `AI_Infrastructure.md` の「Node サーバー経由」と整合する。

### サブプラン: local proxy

provider 呼び出しを localhost proxy に分離する。複数 runtime から共通利用する段階で採用する。

保留理由:
- 今日の最小ループにはプロセス管理と CORS 設計が過剰。

## Facet 設計

### F1. Progress Board

- 役割: PJv34 の phase、task、blocker、次 gate を示す。
- 構造: `Phase -> Task -> Evidence alias`
- 属性: `status`, `owner`, `done_when`, `blocker`
- 例: `T-0-2 LLMClient interface` with `status=pending`
- 使う瞬間: 全 task の進行管理。

### F2. Active Workspace

- 役割: 実装対象・設計対象の現物を置く。
- 構造: `Boundary -> Interface -> Provider -> Trace`
- 属性: `kind`, `risk`, `data_policy`
- 例: `SecretProvider(Bitwarden/env)` with `data_policy=secret_in_memory_only`
- 使う瞬間: T-0-2 以降の実装設計。

### F3. Evaluation Board

- 役割: mock E2E、secret leak check、DeepSeek smoke の結果を置く。
- 構造: `Check -> Evidence -> Verdict`
- 属性: `verdict`, `latency_ms`, `token_usage`, `error_code`
- 例: `mock weekly review E2E` with `verdict=pending`
- 使う瞬間: T-0-5 以降。

### F4. Review

- 役割: 人間判断が必要な論点を Qn として溜める。
- 構造: `Qn -> Option -> Rationale`
- 属性: `status`, `selected`, `risk`
- 例: `Qn1 provider boundary` with `selected=Node module first`
- 使う瞬間: boundary / provider / map writeback の判断時。

## Link / Alias 規約

- 同一 scope 内 link のみ使う。
- scope をまたぐ関係は alias で示す。
- 最小 link type: `implements`, `verifies`, `depends_on`, `blocks`, `produces`
- secret や送信データ本文は link / node text に残さない。

## Phase 設計

### Phase 0: Mock Loop（今日の対象）

目的: 鍵なしで PJv34 weekly review orchestration が 1 周する。

完了条件:
- sprint contract が 3-6 件に切れている。
- mock provider で review proposal が生成される。
- failure Result が review/Qn 相当へ変換される。

### Phase 1: DeepSeek Secure Smoke

目的: Bitwarden/env secret 経由で DeepSeek を 1 回だけ安全に呼ぶ。

完了条件:
- key がログに出ない。
- request trace に req_id / latency / model / token / error が残る。
- provider failure が Result として扱われる。

### Phase 2: M3E Runtime Integration

目的: weekly review proposal を M3E map runtime に接続する。

完了条件:
- Review scope へ proposal / Qn を手動またはAPIで登録できる。
- Progress Board と Evaluation Board に結果が残る。

## Phase 0 着手手順

- [ ] Step 0: 既存 `beta/src/node/llm/` の有無と内容を確認する（10分）
- [ ] Step 1: `LLMClient` / `SecretProvider` / `TraceLogger` の現状 gap を列挙する（20分）
- [ ] Step 2: mock weekly review input/output schema を定義する（20分）
- [ ] Step 3: mock provider の end-to-end task を切る（20分）
- [ ] Step 4: DeepSeek smoke に必要な secret boundary を確認する（15分）
- [ ] Step 5: Gate 1/2 readiness を更新する（15分）

## 確定事項

- 2026-04-29: PJv34 は正式採番せず、PJ03_SelfDrive 内の模擬 PJ として進める。
- 2026-04-29: 初期境界は browser 直叩き禁止、Node 側 module first とする。
- 2026-04-29: Phase 0 は mock provider 優先。DeepSeek smoke は Phase 1。

## 判断負債

- Qn1: Bitwarden CLI をアプリ起動レイヤで env 注入するか、orchestration layer の SecretProvider から都度取得するか。
- Qn2: weekly review の入力を daily / git / map のどこまで含めるか。
- Qn3: review proposal の保存先を map reviews/Qn にするか、まず artifacts JSON にするか。

## 探索ログ

### 2026-04-29: 初期整理

- **調査結果**: 既存設計は `AI_Infrastructure.md` と `AI_Integration.md` で browser 直叩き禁止、Node 経由、共通 AI 設定、fail-closed を定めている。
- **判断**: PJv34 はこの設計を実装可能な orchestration loop に落とす模擬 PJ とする。
- **未決**: Bitwarden secret 解決を起動レイヤに寄せるか、SecretProvider interface 内に含めるか。

## 実行計画

Phase 0 ではコード実装へ入る前に、現状 gap を確定する。すでに `beta/src/node/llm/` が存在する可能性があるため、新規設計ではなく既存実装の棚卸しを優先する。

## 進捗ログ

- 2026-04-29: PJv34 詳細化 skeleton を作成。
