# AI Integration Architecture -- Claude API 直接利用方式

作成日: 2026-04-10
作成者: data agent

---

## 1. 大域的方針

### 1.1 現状の整理

M3E の AI 基盤は既に以下が実装済みである。

| 項目 | 状態 | ファイル |
|------|------|----------|
| AI Provider Config（env ベース） | 実装済み | `ai_infra.ts` |
| Subagent Gateway | 実装済み | `ai_subagent.ts` |
| `GET /api/ai/status` | 実装済み | `start_viewer.ts` |
| `POST /api/ai/subagent/linear-transform` | 実装済み | `ai_subagent.ts` → `linear_agent.ts` |
| `POST /api/ai/subagent/topic-suggest` | 実装済み | `ai_subagent.ts` |
| OpenAI-compatible transport | 実装済み | `ai_infra.ts` |
| MCP transport | 未実装 | — |
| `title-rewrite` / `duplicate-check` | 未実装 | — |
| `suggest-parent` / `outline-expand` | 未実装 | — |

現行の transport は `openai-compatible`（DeepSeek 向け）。
Claude API も OpenAI-compatible endpoint を持たないため、
**Anthropic SDK を直接利用する transport を新設する必要がある**。

### 1.2 方針決定: Claude API 直接利用

以下の 3 方式を比較し、**方式 B を採用**する。

| 方式 | 概要 | 長所 | 短所 |
|------|------|------|------|
| A. Claude Code CLI 呼び出し | Node.js から `claude` CLI を exec | 設定不要 | レイテンシ大、出力パース不安定、CLI 依存 |
| B. Anthropic SDK 直接利用 | `@anthropic-ai/sdk` で Messages API を呼ぶ | 型安全、streaming 対応、structured output | API キー管理が必要 |
| C. MCP Server として M3E を公開 | Claude Code → M3E の MCP Server | Claude Code ワークフロー統合 | subagent の呼び出し元が逆転、UI 連携が複雑 |

**方式 B を採用する理由:**

1. M3E の既存アーキテクチャ（Browser → Node API → Provider）と整合する
2. `ai_infra.ts` の Provider Adapter パターンに Claude を追加するだけで済む
3. Structured output（JSON mode / tool use）で proposal の正規化が容易
4. Streaming 対応で UI のレスポンシブ性を確保できる
5. レート制限・エラーハンドリングを SDK レベルで制御可能

**方式 C（MCP）は補助的に併用する:**

- 既存の `m3e-map` skill は Claude Code からマップを読み書きする用途で有用
- しかし subagent の呼び出し方向は「M3E → Claude API」が主体
- MCP は「Claude Code → M3E」方向であり、開発ワークフロー統合に限定

### 1.3 transport 追加設計

`ai_infra.ts` の `LinearTransformTransport` 型を拡張する。

```
現行: "openai-compatible" | "mcp"
拡張: "openai-compatible" | "anthropic" | "mcp"
```

環境変数:

```
M3E_AI_TRANSPORT=anthropic
M3E_AI_PROVIDER=claude
M3E_AI_API_KEY=sk-ant-...
M3E_AI_MODEL=claude-sonnet-4-20250514
```

Provider Adapter の分岐:

```text
transport === "openai-compatible"
  → 既存の fetch ベース OpenAI-compatible 呼び出し

transport === "anthropic"
  → @anthropic-ai/sdk の Anthropic クライアントで Messages API を呼ぶ

transport === "mcp"
  → 未実装（将来）
```

---

## 2. ユースケース優先順位

既存の `AI_Use_Cases.md` と `AI_Integration.md` の分析に基づき、
Claude API 直接利用で最も価値が出る順に並べる。

### Tier 1 — 即時価値（既存基盤の拡張）

| # | ユースケース | subagent 名 | 理由 |
|---|-------------|-------------|------|
| 1 | linear-to-tree | `linear-transform` | **実装済み**。Claude provider を追加するだけ |
| 2 | tree-to-linear | `linear-transform` | **実装済み**。同上 |
| 3 | title-rewrite | `title-rewrite` | 最も軽量な提案機能。入出力が単純 |

### Tier 2 — 中期価値（新 subagent 実装）

| # | ユースケース | subagent 名 | 理由 |
|---|-------------|-------------|------|
| 4 | duplicate-check | `duplicate-check` | scope 内の近傍ノード比較で完結。embedding 不要 |
| 5 | suggest-parent | `suggest-parent` | 候補親集合の生成が必要だが、scope 内で閉じる |
| 6 | outline-expand | `outline-expand` | 差分 UI が前提。品質次第で体験価値が高い |

### Tier 3 — 長期価値（UI・インフラ依存）

| # | ユースケース | subagent 名 | 理由 |
|---|-------------|-------------|------|
| 7 | TCL 変換 | `tcl-transform` | TCL 仕様の安定が前提。edge type の正規化が必要 |
| 8 | confidence scoring | `confidence-eval` | Deep バンドの信頼度設計が前提 |
| 9 | context package | `context-package` | Phase 1（AI_Integration.md）。双方向化は Phase 4 |

---

## 3. アーキテクチャ

### 3.1 全体構成

```text
┌─────────────┐
│  Browser UI  │
│  (viewer.ts) │
└──────┬───────┘
       │ HTTP (localhost)
       ▼
┌──────────────────────────────────┐
│  M3E Node Server                 │
│  (start_viewer.ts)               │
│                                  │
│  ┌────────────────────────────┐  │
│  │  Subagent Gateway          │  │
│  │  (ai_subagent.ts)          │  │
│  │                            │  │
│  │  ┌──────────────────────┐  │  │
│  │  │  Request Queue       │  │  │
│  │  │  (rate limit + FIFO) │  │  │
│  │  └──────────┬───────────┘  │  │
│  │             │              │  │
│  │  ┌──────────▼───────────┐  │  │
│  │  │  Provider Adapter    │  │  │
│  │  │  ┌────────────────┐  │  │  │
│  │  │  │ anthropic      │  │  │  │
│  │  │  │ openai-compat  │  │  │  │
│  │  │  │ local (future) │  │  │  │
│  │  │  └────────────────┘  │  │  │
│  │  └──────────┬───────────┘  │  │
│  │             │              │  │
│  │  ┌──────────▼───────────┐  │  │
│  │  │  Response Normalizer │  │  │
│  │  │  (proposal/result)   │  │  │
│  │  └──────────────────────┘  │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │  Usage Tracker / Cache     │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
       │
       ▼ HTTPS
┌──────────────┐
│ Claude API   │
│ (Anthropic)  │
└──────────────┘
```

### 3.2 Request Queue（レート制限対策）

Claude API のレート制限に対応するため、サーバー内にリクエストキューを設ける。

設計:

- FIFO キュー（in-memory）
- 同時実行数上限: `M3E_AI_MAX_CONCURRENT` (既定: 2)
- キュー最大長: `M3E_AI_MAX_QUEUE` (既定: 10)
- キュー溢れ時は 429 を即返し
- タイムアウト: リクエスト単位で `constraints.timeoutMs`（既定 15000ms）

実装場所: `ai_queue.ts`（新規）

```typescript
// 概念コード
export class AiRequestQueue {
  private running = 0;
  private queue: QueueEntry[] = [];
  private maxConcurrent: number;
  private maxQueue: number;

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    if (this.queue.length >= this.maxQueue) {
      throw new Error("AI_QUEUE_FULL");
    }
    // ... FIFO 実行
  }
}
```

### 3.3 コスト管理（API 使用量追跡）

Claude API は token 課金であるため、使用量を追跡する。

設計:

- 各 subagent 呼び出しの `usage` を記録
- 日次・月次の累計を SQLite に保存
- 月次上限: `M3E_AI_MONTHLY_TOKEN_LIMIT`（既定: なし）
- 上限到達時は新規リクエストを拒否（`AI_BUDGET_EXCEEDED`）

保存先: `{M3E_DATA_DIR}/ai_usage.sqlite`（または既存 DB に table 追加）

```sql
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  subagent TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  document_id TEXT,
  scope_id TEXT,
  status TEXT NOT NULL DEFAULT 'success'
);
```

### 3.4 キャッシュ

同一入力に対する重複呼び出しを避ける。

設計:

- キャッシュキー: `sha256(subagent + JSON.stringify(input))`
- TTL: `M3E_AI_CACHE_TTL_MS`（既定: 300000 = 5分）
- ストレージ: in-memory Map（プロセス再起動でクリア）
- キャッシュヒット時は `meta.cached: true` を付与

実装場所: `ai_cache.ts`（新規）

注意:

- `outline-expand` など非決定的な subagent はキャッシュしない（opt-out）
- `title-rewrite` / `duplicate-check` は入力が同じなら結果も同じと期待できるためキャッシュ対象

### 3.5 エラーハンドリング

既存の `AI_Common_API.md` のエラーコード体系を踏襲し、以下を追加する。

| コード | HTTP | 説明 |
|--------|------|------|
| `AI_QUEUE_FULL` | 429 | リクエストキューが満杯 |
| `AI_BUDGET_EXCEEDED` | 429 | 月次 token 上限に到達 |
| `AI_PROVIDER_AUTH_FAILED` | 401 | API キーが無効 |
| `AI_CACHED` | — | キャッシュヒット（エラーではないが区別用） |

フォールバック戦略:

1. Claude API 障害時 → DeepSeek へフォールバック（`fallbackChain` 設定時）
2. 全 provider 障害時 → `AI_PROVIDER_UNAVAILABLE` を返し、手動操作へ
3. AI 機能全体が無効 → UI で「AI 機能は利用できません」を表示、基本操作は正常動作

### 3.6 「AI は提案、人間が確定」の実装

M3E の設計思想を API レベルで強制する。

1. 全 subagent は `requiresApproval: true` を既定で返す
2. proposal は正本に直接書き込まない
3. 適用は別の `POST /api/ai/apply` endpoint で行う（将来実装）
4. 適用操作は Command 経由で undo/redo に統合する

---

## 4. API 設計

### 4.1 既存 endpoint（変更なし）

| メソッド | パス | 状態 |
|----------|------|------|
| `GET` | `/api/ai/status` | 実装済み。`transport: "anthropic"` の表示を追加 |
| `POST` | `/api/ai/subagent/linear-transform` | 実装済み。Anthropic transport を追加 |
| `POST` | `/api/ai/subagent/topic-suggest` | 実装済み。Anthropic transport を追加 |

### 4.2 新規 endpoint

#### `POST /api/ai/subagent/title-rewrite`

入力:

```json
{
  "documentId": "rapid-main",
  "scopeId": "n_root",
  "input": {
    "nodeId": "n123",
    "text": "これは長すぎるラベルで何を言いたいのかわからない感じの文章",
    "details": "補足テキスト",
    "siblingTexts": ["兄弟ノード1", "兄弟ノード2"]
  }
}
```

出力 proposal:

```json
{
  "kind": "title-candidates",
  "summary": "Generated 3 title candidates.",
  "result": {
    "candidates": [
      { "text": "ラベル改善案A", "rationale": "簡潔さを優先" },
      { "text": "ラベル改善案B", "rationale": "専門用語を統一" },
      { "text": "ラベル改善案C", "rationale": "親子関係を反映" }
    ]
  }
}
```

#### `POST /api/ai/subagent/duplicate-check`

入力:

```json
{
  "documentId": "rapid-main",
  "scopeId": "n_root",
  "input": {
    "targetNodeId": "n123",
    "targetText": "仮説A",
    "neighborNodes": [
      { "nodeId": "n9", "text": "仮説A改" },
      { "nodeId": "n15", "text": "仮説B" }
    ]
  }
}
```

出力 proposal:

```json
{
  "kind": "duplicate-report",
  "summary": "Found 1 potential duplicate.",
  "result": {
    "duplicates": [
      {
        "targetNodeId": "n123",
        "matchNodeId": "n9",
        "similarity": 0.92,
        "rationale": "同一仮説の言い換え",
        "suggestedAction": "merge"
      }
    ]
  }
}
```

#### `POST /api/ai/subagent/suggest-parent`

入力:

```json
{
  "documentId": "rapid-main",
  "scopeId": "n_root",
  "input": {
    "nodeId": "n123",
    "nodeText": "温度上昇が収穫に与える影響",
    "candidateParents": [
      { "nodeId": "n5", "text": "環境要因", "depth": 1 },
      { "nodeId": "n8", "text": "仮説群", "depth": 1 },
      { "nodeId": "n12", "text": "観測データ", "depth": 2 }
    ]
  }
}
```

出力 proposal:

```json
{
  "kind": "parent-candidates",
  "summary": "Ranked 3 parent candidates.",
  "result": {
    "candidates": [
      { "parentNodeId": "n5", "confidence": 0.85, "rationale": "内容的に環境要因の下位概念" },
      { "parentNodeId": "n8", "confidence": 0.60, "rationale": "仮説として分類可能" },
      { "parentNodeId": "n12", "confidence": 0.30, "rationale": "関連するが直接の親子ではない" }
    ]
  }
}
```

#### `GET /api/ai/usage`（新規）

API 使用量の取得。

```json
{
  "ok": true,
  "today": {
    "totalTokens": 15230,
    "requestCount": 12,
    "providers": {
      "claude": { "totalTokens": 10230, "requestCount": 8 },
      "deepseek": { "totalTokens": 5000, "requestCount": 4 }
    }
  },
  "thisMonth": {
    "totalTokens": 234500,
    "requestCount": 180
  },
  "limit": null
}
```

---

## 5. Anthropic SDK 統合の実装詳細

### 5.1 依存追加

```bash
cd beta && npm install @anthropic-ai/sdk
```

### 5.2 新規ファイル: `ai_transport_anthropic.ts`

責務:

- `@anthropic-ai/sdk` の `Anthropic` クライアントを初期化
- `Messages.create()` で各 subagent のプロンプトを実行
- レスポンスを既存の `AiSubagentSuccessResponse` 形式に正規化

```typescript
// 概念コード
import Anthropic from "@anthropic-ai/sdk";
import type { AiProviderConfig, ResolvedAiModelConfig } from "./ai_infra";

export async function callAnthropicProvider(
  config: AiProviderConfig,
  resolved: ResolvedAiModelConfig,
  systemPrompt: string,
  userPrompt: string,
  constraints: { maxTokens?: number; temperature?: number },
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  const client = new Anthropic({ apiKey: config.apiKey! });
  const response = await client.messages.create({
    model: resolved.model || "claude-sonnet-4-20250514",
    max_tokens: constraints.maxTokens || 1024,
    temperature: constraints.temperature ?? 0.2,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return {
    text: textBlock?.text || "",
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
```

### 5.3 `ai_subagent.ts` への統合

既存の `runTopicSuggestSubagent` の fetch ベース呼び出しを、
transport に応じて分岐させる。

```typescript
// ai_subagent.ts 内の変更イメージ
const ai = loadAiProviderConfigFromEnv();

if (ai.transport === "anthropic") {
  const result = await callAnthropicProvider(ai, resolved, systemPrompt, userPrompt, constraints);
  // ... 正規化
} else {
  // 既存の openai-compatible fetch
}
```

---

## 6. 実装 Phase

### Phase 1: Anthropic transport 追加（1-2 日）

目標: 既存の `linear-transform` と `topic-suggest` が Claude API で動作する

タスク:

1. `@anthropic-ai/sdk` を `beta/package.json` に追加
2. `ai_transport_anthropic.ts` を新規作成
3. `LinearTransformTransport` 型に `"anthropic"` を追加（`types.ts`）
4. `ai_infra.ts` の `loadAiProviderConfigFromEnv()` で `anthropic` transport を認識
5. `ai_subagent.ts` の provider 呼び出し部分を transport で分岐
6. テスト: `M3E_AI_TRANSPORT=anthropic` で既存 subagent が動作確認

### Phase 2: title-rewrite / duplicate-check 実装（2-3 日）

目標: 新 subagent 2 種が Claude API 経由で動作する

タスク:

1. `title-rewrite` の system prompt 作成（prompt ファイルまたは定数）
2. `duplicate-check` の system prompt 作成
3. `ai_subagent.ts` の `SupportedSubagent` 型と `runAiSubagent()` に追加
4. 入力検証（nodeId 必須、text 長制限）
5. 出力の JSON パース・正規化（既存の `parseTopicsFromModelText` パターンを踏襲）
6. 単体テスト

### Phase 3: Request Queue + Usage Tracker（1-2 日）

目標: レート制限対策とコスト可視化

タスク:

1. `ai_queue.ts` 新規作成
2. `ai_usage.ts` 新規作成（SQLite テーブル + 記録関数）
3. `GET /api/ai/usage` endpoint を `start_viewer.ts` に追加
4. `ai_subagent.ts` の `runAiSubagent()` をキュー経由に変更
5. REST API spec (`REST_API.md`) を更新

### Phase 4: suggest-parent / outline-expand（2-3 日）

目標: 構造提案系 subagent の実装

タスク:

1. `suggest-parent` の system prompt + 入力正規化
2. `outline-expand` の system prompt + 差分出力形式
3. `ai_subagent.ts` に追加
4. scope 配下のノード集合を入力として渡すヘルパー関数
5. テスト

### Phase 5: キャッシュ + フォールバック（1 日）

目標: 運用品質の向上

タスク:

1. `ai_cache.ts` 新規作成
2. `ai_infra.ts` の `fallbackChain` を実際に動作させる
3. キャッシュ TTL の設定
4. テスト

### Phase 6（将来）: TCL 変換 / confidence scoring / context package 双方向化

- TCL 仕様の安定化待ち
- Deep バンドの実装待ち
- Phase 4 の AI_Integration.md 参照

---

## 7. ローカル LLM（将来の拡張点）

現時点ではローカル LLM は対象外だが、以下の拡張点を確保する。

- `M3E_AI_TRANSPORT=openai-compatible` + `M3E_AI_BASE_URL=http://localhost:11434/v1` で Ollama が既に動作可能
- `ai_infra.ts` の `isLocalBaseUrl()` で API キー不要の判定が実装済み
- `AiModelProfile.privacy: "local"` でデータポリシーを区別可能
- 将来的に `M3E_AI_TRANSPORT=local` を追加し、より最適化された呼び出しを実装する余地がある

---

## 8. セキュリティ考慮事項

1. **API キー管理**: `M3E_AI_API_KEY` はサーバーサイドのみ。ブラウザに漏出しない
2. **送信範囲制御**: `scopeId` 配下のみ送信。scope 外データは含めない
3. **入力サイズ制限**: ノード数・文字数の上限を超えた場合は送信前に拒否
4. **出力検証**: provider 返答は strict JSON schema で検証。不正フィールドは破棄
5. **ログ**: request hash のみ記録（本文は既定で保存しない）
6. **AI 除外マーク**: 特定スコープを `AI 送信対象外` にマークする機能（将来）

---

## 9. 関連文書

- `docs/03_Spec/AI_Integration.md` — AI 連携フェーズ定義
- `docs/03_Spec/AI_Common_API.md` — 共通 API 契約
- `docs/03_Spec/AI_Use_Cases.md` — ユースケースシナリオ集
- `docs/ideas/260402subagent.md` — MCP vs 直接連携の比較
- `docs/ideas/tree_compatible_language.md` — TCL 仕様
- `docs/ideas/260410_scalable_knowledge_base_vision.md` — M3E ビジョン
- `beta/src/node/ai_infra.ts` — Provider Config 実装
- `beta/src/node/ai_subagent.ts` — Subagent Gateway 実装

---

## 設計判断メモ（manager への共有事項）

### 判断 1: Claude API 直接利用（方式 B）を推奨

- CLI 呼び出し（方式 A）はレイテンシとパース不安定性で不適
- MCP（方式 C）は開発ワークフロー統合には有用だが、subagent の主経路としては過剰
- 既存の Provider Adapter パターンに `anthropic` transport を追加するのが最小変更

### 判断 2: 既存アーキテクチャを壊さない

- `ai_infra.ts` / `ai_subagent.ts` の構造はそのまま維持
- 新規ファイル追加（`ai_transport_anthropic.ts`, `ai_queue.ts`, `ai_cache.ts`, `ai_usage.ts`）で拡張
- `types.ts` の型拡張は最小限（`LinearTransformTransport` に `"anthropic"` 追加）

### 判断 3: Phase 1 で即着手可能

- `@anthropic-ai/sdk` を追加し、`ai_transport_anthropic.ts` を作成するだけで既存 subagent が Claude 対応になる
- 新 subagent の実装は Phase 2 以降

### 確認が必要な事項

- Anthropic API キーの取得・管理方針（Akaghef に確認）
- Claude のモデル選定: `claude-sonnet-4-20250514`（速度優先）vs `claude-opus-4-20250514`（品質優先）
- 月次 token 予算の上限設定
