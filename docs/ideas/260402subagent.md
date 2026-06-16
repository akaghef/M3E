# AI Subagent 連携仕様（DeepSeek 含む）

最終更新: 2026-04-02

---

## 1. 目的

- map 内操作の補助を、AI の subagent として段階導入する。
- 外部 provider（DeepSeek など）を差し替え可能にする。
- Core Principles の「AI は提案、人間が確定」を厳守する。

---

## 2. 結論（MCP を使うか）

結論は以下。

- **短期（Beta）: MCP は採用しない**
  - M3E Node サーバ内の `Subagent Gateway` で直接 provider API を呼ぶ。
- **中期（拡張）: MCP は任意採用**
  - 外部ツール群（検索、社内ナレッジ、RAG、監査基盤）接続時に導入する。

理由:

- Beta の主目的は map 編集補助の品質と安全性の確立であり、接続層を増やすとデバッグ軸が増える。
- まずは最短経路で提案品質・承認フロー・差分表示を固めるべき。
- MCP の価値は「複数ツール統合」であり、単一 provider 呼び出しだけなら過剰。

---

## 3. 方式比較

| 観点 | 直接連携（Subagent Gateway） | MCP 連携 |
|---|---|---|
| 実装初速 | 速い | 中〜遅い |
| 障害切り分け | 単純 | 複雑（MCP 層を含む） |
| Provider 切替 | Adapter で対応可能 | しやすい |
| 外部ツール統合 | 弱い | 強い |
| セキュリティ境界 | M3E 内で閉じやすい | 境界設計が増える |
| Beta 適合性 | 高い | 中 |

---

## 4. アーキテクチャ方針

### 4.1 Beta 採用構成

```text
Browser UI
  -> M3E Local API (Node)
  -> Subagent Gateway
  -> Provider Adapter (deepseek | claude | local)
  -> External LLM API
```

### 4.2 将来の MCP 拡張構成

```text
Browser UI
  -> M3E Local API (Node)
  -> Subagent Gateway
  -> MCP Bridge (optional)
  -> MCP Server(s)
  -> Tools / Provider APIs
```

`MCP Bridge` は optional にし、無効時は従来経路で動作する。

---

## 5. Subagent スコープ

初期導入は以下 4 種。

1. `title-rewrite`
- 入力: 対象ノード text/details
- 出力: タイトル候補（複数）
- 反映: ユーザー採用時のみ

2. `duplicate-check`
- 入力: 対象ノード + 近傍ノード集合
- 出力: 重複候補と理由
- 反映: 自動反映なし（警告表示のみ）

3. `suggest-parent`
- 入力: 対象ノード + 候補親集合
- 出力: 親候補ランキング
- 反映: ユーザー採用時のみ

4. `outline-expand`
- 入力: scope 下位構造
- 出力: 子ノード差分案
- 反映: 差分採用時のみ

---

## 6. API 契約（案）

### 6.1 Endpoint

- `POST /api/ai/subagent/:name`

### 6.2 Request

```json
{
  "documentId": "rapid-main",
  "scopeId": "node-123",
  "provider": "deepseek",
  "input": {},
  "constraints": {
    "maxTokens": 1200,
    "timeoutMs": 12000,
    "temperature": 0.2
  }
}
```

### 6.3 Response（成功）

```json
{
  "ok": true,
  "subagent": "title-rewrite",
  "provider": "deepseek",
  "proposal": {},
  "requiresApproval": true
}
```

### 6.4 Response（失敗）

```json
{
  "ok": false,
  "code": "AI_PROVIDER_TIMEOUT",
  "error": "provider timeout",
  "subagent": "title-rewrite",
  "provider": "deepseek"
}
```

---

## 7. DeepSeek 設定（案）

- `M3E_AI_PROVIDER=deepseek`
- `M3E_DEEPSEEK_API_KEY`
- `M3E_DEEPSEEK_BASE_URL`（省略時は provider default）
- `M3E_DEEPSEEK_MODEL`

規則:

- キー未設定時は fail-closed（機能無効 + UI 通知）。
- Browser 側へ API キーを渡さない。

---

## 8. セキュリティ要件

Command Language の Security Model と整合させる。

1. 送信境界
- `scopeId` 配下のみ送信可。
- ノード数・文字数上限を超えた場合は送信拒否。

2. 実行境界
- subagent 返答でモデルを直接更新しない。
- 返答は差分候補として保持し、採用操作でのみ反映。

3. スキーマ検証
- provider 返答は strict JSON schema で検証。
- 不正フィールドは破棄、必須不足は reject。

4. 失敗動作
- timeout/error/invalid response は fail-closed。
- 既存手動フローへ即時フォールバック。

---

## 9. 監査ログ

最小記録項目:

- timestamp
- documentId
- scopeId
- subagent
- provider
- requestHash
- resultCode
- latencyMs
- tokenUsage
- userDecision（accept/reject/partial）

既定では本文そのものは保存しない（必要時のみ opt-in）。

---

## 10. 段階導入

Phase A（Beta）

1. Subagent Gateway + Provider Adapter 実装
2. `title-rewrite` / `duplicate-check` 先行導入
3. 承認 UI と差分適用を固定
4. 単体テスト + API 統合テスト

Phase B（Beta 後半〜）

1. `suggest-parent` / `outline-expand` 導入
2. 監査ログ可視化
3. provider 切替 UI（deepseek/claude/local）

Phase C（必要時）

1. MCP Bridge を optional 実装
2. MCP 経由ツールを段階追加
3. 無効化可能な feature flag で運用

---

## 11. 初期決定値（2026-04-02 時点）

以下は Beta 実装を進めるための暫定決定値。

### 11.1 モデル選定基準

- 既定方針: **速度優先**（UI 補助は待ち時間の短さを優先）
- 目標レイテンシ: p95 で 8 秒以内
- 品質優先モデルは `outline-expand` のみ opt-in で許可

### 11.2 token 上限（初期値）

| subagent | maxTokens |
|---|---:|
| `title-rewrite` | 300 |
| `duplicate-check` | 500 |
| `suggest-parent` | 700 |
| `outline-expand` | 1200 |

注記:

- `scopeId` 配下の入力サイズが上限を超える場合は、送信前にサマリ化または reject する。

### 11.3 proposal JSON schema 最小必須

全 subagent で共通必須:

- `proposalId: string`
- `subagent: string`
- `items: array`
- `rationale: string`

`items[]` の共通必須:

- `type: string`
- `targetNodeId: string`
- `patch: object`
- `confidence: number`（0.0 から 1.0）

### 11.4 partial accept 粒度

- Beta は **ノード単位**で採用/棄却する。
- 属性単位 partial accept は Beta 後半の検討事項とする。

### 11.5 保留事項（継続検討）

- provider 障害時の自動フェイルオーバー（deepseek -> local）
- 同一 scope の連続呼び出しに対するキャッシュ戦略

---

## 12. 実装タスク分解（P1/P2/P3）

### P1（最優先: API 基盤と安全境界）

1. `POST /api/ai/subagent/:name` の骨格実装
2. Provider Adapter（`deepseek` / `local`）の interface 定義
3. request 入力検証（scope 境界、ノード数、文字数）
4. response schema 検証（strict JSON）
5. fail-closed の統一エラーコード設計
6. unit test（validator, adapter, error mapping）

Done 条件:

- API 単体で `title-rewrite` の成功/失敗パスが再現できる
- 無効応答がすべて reject される

### P2（次優先: UI 承認フロー）

1. Subagent 呼び出し UI（toolbar / context menu）
2. 提案パネル（候補表示、根拠表示、採用/棄却）
3. ノード単位 partial accept（ノード選択で適用）
4. 適用は Command 経由で実行し undo/redo 整合を維持
5. E2E テスト（提案取得 -> 採用 -> undo）

Done 条件:

- AI 提案が正本へ自動適用されない
- 承認操作なしで状態変更が起きない

### P3（拡張: 監査と provider 運用）

1. 監査ログ保存（requestHash/resultCode/decision）
2. provider 切替 UI（deepseek/claude/local）
3. レート制限と timeout 設定 UI
4. MCP Bridge の feature flag 追加（実体は optional）
5. 運用ドキュメント（障害時切替、鍵ローテーション）

Done 条件:

- ログから「何を提案し、何を採用したか」を追跡可能
- provider 切替時に既存フローが壊れない
