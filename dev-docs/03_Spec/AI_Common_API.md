# AI 共通 API 仕様

最終更新: 2026-04-02

## 目的

この文書は、M3E の AI 機能が共有する
Node ローカル API の共通契約を定義する。

対象は feature 個別の payload ではなく、
provider 非依存で共通化される request / response / error / approval の枠組みである。

## 適用範囲

本仕様は次の feature に適用する。

- linear transform
- title rewrite
- duplicate check
- suggest-parent
- structure proposal
- context package generation

feature 固有の入出力は本仕様の `input` / `proposal` / `result` に内包する。

## 基本方針

1. browser は外部 provider を直接呼ばない。
2. browser は localhost の Node API のみを呼ぶ。
3. provider 差分は server 側で吸収する。
4. AI の返答はそのまま正本に適用せず、提案または明示 result として返す。
5. 不正 payload や不完全 response は fail-closed で reject する。

## エンドポイント

### 共通 status

- `GET /api/ai/status`

用途:

- AI 基盤が有効か
- provider / transport / model が何か
- feature 実行可能性の前提が揃っているか

### 共通 subagent 実行

- `POST /api/ai/subagent/:name`

用途:

- feature ごとの subagent 実行
- 例:
  - `/api/ai/subagent/linear-transform`
  - `/api/ai/subagent/title-rewrite`
  - `/api/ai/subagent/duplicate-check`

### feature alias endpoint

feature ごとに専用 endpoint を持ってもよい。
ただし内部的には共通 subagent 契約へ正規化する。

例:

- `POST /api/linear-transform/convert`
  - 内部的には `POST /api/ai/subagent/linear-transform`

## 実装状況（2026-04-02）

| 項目 | 状態 |
|------|------|
| `GET /api/ai/status` | 実装済み |
| `POST /api/ai/subagent/linear-transform` | 実装済み |
| `POST /api/ai/subagent/topic-suggest` | 実装済み |
| `openai-compatible` transport | 実装済み |
| `mcp` transport | 未実装 |
| `title-rewrite` | 未実装 |
| `duplicate-check` | 未実装 |

## 共通 status response

```json
{
  "ok": true,
  "enabled": true,
  "configured": true,
  "provider": "deepseek",
  "gateway": "litellm",
  "transport": "openai-compatible",
  "model": "deepseek-chat",
  "activeModelAlias": "chat.fast",
  "availableModelAliases": ["chat.fast", "chat.local"],
  "endpoint": "https://api.deepseek.com",
  "message": "AI infrastructure is configured.",
  "features": {
    "linear-transform": {
      "available": true,
      "promptConfigured": true
    },
    "topic-suggest": {
      "available": true,
      "promptConfigured": true
    },
    "title-rewrite": {
      "available": false,
      "promptConfigured": false
    }
  }
}
```

### フィールド

- `ok`
  - status endpoint 自体が成功したことを示す
- `enabled`
  - AI 基盤が全体として有効か
- `configured`
  - provider 接続に必要な設定が揃っているか
- `provider`
  - `deepseek` など
- `gateway`
  - `none` または `litellm`
- `transport`
  - `openai-compatible` または `mcp`
- `model`
  - 現在の既定モデル
- `activeModelAlias`
  - alias ベース解決時の既定 alias
- `availableModelAliases`
  - 基盤に登録された alias 一覧
- `endpoint`
  - provider endpoint または transport endpoint
- `message`
  - UI 表示用の短い説明
- `features`
  - feature ごとの可用性

## 共通 request

`POST /api/ai/subagent/:name`

```json
{
  "documentId": "rapid-main",
  "scopeId": "n_root",
  "provider": "default",
  "modelAlias": "chat.fast",
  "mode": "proposal",
  "input": {},
  "constraints": {
    "timeoutMs": 15000,
    "maxTokens": 1200,
    "temperature": 0.2
  },
  "clientContext": {
    "selectionNodeId": "n_child_1",
    "requestId": "req-123"
  }
}
```

### 必須フィールド

- `documentId: string`
- `scopeId: string`
- `input: object`

### 任意フィールド

- `provider: "default" | string`
  - `default` の場合は `M3E_AI_*` の現在設定を使う
- `modelAlias?: string`
  - alias registry を使う場合の明示指定
- `mode: "proposal" | "direct-result"`
  - `proposal`
    - 承認前提の提案を返す
  - `direct-result`
    - 即利用可能な result を返す
    - ただし正本自動更新を意味しない
- `constraints`
  - provider 呼び出しに対する上限制約
- `clientContext`
  - ログ相関や UI 復元用の補助情報

## `input` の原則

`input` は feature ごとの payload を入れる。

例:

### linear-transform

```json
{
  "direction": "tree-to-linear",
  "sourceText": "...",
  "scopeLabel": "Root"
}
```

### title-rewrite

```json
{
  "nodeId": "n123",
  "text": "長いラベル",
  "details": "補足"
}
```

### duplicate-check

```json
{
  "targetNodeId": "n123",
  "targetText": "仮説A",
  "neighborNodes": [
    { "nodeId": "n9", "text": "仮説A改" }
  ]
}
```

## 共通成功 response

```json
{
  "ok": true,
  "subagent": "linear-transform",
  "provider": "deepseek",
  "transport": "openai-compatible",
  "model": "deepseek-chat",
  "resolvedModelAlias": "chat.fast",
  "mode": "proposal",
  "requiresApproval": true,
  "proposal": {
    "kind": "text-transform",
    "summary": "Tree scope was converted to linear text.",
    "result": {
      "outputText": "..."
    }
  },
  "usage": {
    "inputTokens": 320,
    "outputTokens": 210,
    "totalTokens": 530
  },
  "meta": {
    "scopeId": "n_root",
    "documentId": "rapid-main",
    "latencyMs": 1240
  }
}
```

### フィールド

- `ok`
- `subagent`
- `provider`
- `transport`
- `model`
- `mode`
- `requiresApproval`
- `proposal`
- `usage`
- `meta`

## `proposal` の共通形

```json
{
  "kind": "text-transform",
  "summary": "short human-readable summary",
  "result": {},
  "warnings": [],
  "explanations": []
}
```

### 必須フィールド

- `kind`
- `result`

### 任意フィールド

- `summary`
- `warnings`
- `explanations`

### `kind` の例

- `text-transform`
- `title-candidates`
- `duplicate-report`
- `parent-candidates`
- `structure-diff`
- `context-package`

## `result` の原則

`result` は feature ごとの正規化済みデータとする。
自由文だけを返すことは禁止する。

許可される形:

- 構造化 object
- 構造化 array
- text を返す場合でも field 名を持つ object

禁止:

- schema を持たない文字列 1 本返し
- markdown 説明文のみ
- provider 生レスポンスの透過返し

## 共通失敗 response

```json
{
  "ok": false,
  "code": "AI_PROVIDER_UNAVAILABLE",
  "error": "Provider request failed.",
  "subagent": "linear-transform",
  "provider": "deepseek",
  "retryable": true,
  "details": {
    "transport": "openai-compatible"
  }
}
```

### 必須フィールド

- `ok: false`
- `code`
- `error`

### 任意フィールド

- `subagent`
- `provider`
- `retryable`
- `details`

## エラーコード

### client/request 系

- `AI_INVALID_REQUEST`
- `AI_DOCUMENT_ID_REQUIRED`
- `AI_SCOPE_ID_REQUIRED`
- `AI_INPUT_REQUIRED`
- `AI_UNSUPPORTED_SUBAGENT`
- `AI_UNSUPPORTED_MODE`
- `AI_INPUT_TOO_LARGE`

### config/infra 系

- `AI_DISABLED`
- `AI_NOT_CONFIGURED`
- `AI_TRANSPORT_NOT_IMPLEMENTED`
- `AI_PROVIDER_NOT_SUPPORTED`

### provider 実行系

- `AI_PROVIDER_UNAVAILABLE`
- `AI_PROVIDER_TIMEOUT`
- `AI_PROVIDER_RATE_LIMITED`
- `AI_PROVIDER_BAD_RESPONSE`
- `AI_PROVIDER_SCHEMA_MISMATCH`

### feature 正規化系

- `AI_PROPOSAL_INVALID`
- `AI_RESULT_INVALID`
- `AI_APPROVAL_REQUIRED`

## HTTP status の原則

- `200`
  - status 成功
  - subagent 実行成功
- `400`
  - request 不正
- `404`
  - subagent 不明
- `409`
  - feature 上の競合や approval 前提違反
- `429`
  - rate limit
- `500`
  - M3E 内部エラー
- `502`
  - provider 応答不正
- `503`
  - disabled / not configured / unavailable
- `504`
  - provider timeout

## 承認境界

### 原則

- AI の返答は既定で `requiresApproval: true`
- `mode: "direct-result"` でも正本自動適用はしない
- 正本への反映は別の command / apply endpoint で行う

### 例外

以下は `requiresApproval: false` を許してよい。

- context package text の生成
- linear text の一時プレビュー生成
- node metadata を変更しない読み取り専用提案

ただしこの場合も、
正本への write は別操作であることを保つ。

## 監査ログ前提

将来の監査ログのため、
少なくとも次を `meta` または内部ログで持てる構造にする。

- `documentId`
- `scopeId`
- `subagent`
- `provider`
- `requestId`
- `latencyMs`
- `usage`

## feature alias endpoint との整合

個別 endpoint は UI 実装を単純化するために許可する。
ただし内部的には次の正規化を行う。

```text
Feature endpoint request
  -> common subagent request
    -> provider transport
      -> normalized proposal/result
        -> feature endpoint response
```

つまり、個別 endpoint は共通 API 契約の sugar であり、
別インフラを持ってはならない。

## 初期導入順

1. `GET /api/ai/status`
2. `POST /api/ai/subagent/linear-transform`
3. `POST /api/ai/subagent/title-rewrite`
4. feature alias endpoint の整理
5. approval / audit log 連携

## 関連文書

- `./AI_Integration.md`
- `../04_Architecture/AI_Infrastructure.md`
- `./Linear_Tree_Conversion.md`
