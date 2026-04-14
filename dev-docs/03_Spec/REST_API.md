# REST API 仕様

最終更新: 2026-04-07

## 目的

この文書は、M3E の HTTP サーバー (`start_viewer.ts`) が公開する全 REST API エンドポイントを定義する。
AI 関連 API の詳細は [./AI_Common_API.md](./AI_Common_API.md) を参照。

## 基盤情報

- ベース URL: `http://localhost:{M3E_PORT}` （既定: `38482`）
- Content-Type: `application/json; charset=utf-8`
- 認証: なし（ローカル専用）
- 設定ファイル: `m3e.conf`

```
M3E_DATA_DIR=C:\Users\chiec\AppData\Local\M3E
M3E_PORT=38482
M3E_ROOT=C:\Users\chiec\dev\M3E
```

## エンドポイント一覧

| メソッド | パス | 概要 | 参照先 |
|----------|------|------|--------|
| `GET` | `/api/docs` | ドキュメント一覧（HOME） | 本文書 |
| `POST` | `/api/docs/new` | ドキュメント新規作成 | 本文書 |
| `POST` | `/api/docs/{docId}/duplicate` | ドキュメント複製 | 本文書 |
| `POST` | `/api/docs/{docId}/rename` | ルートラベル変更 | 本文書 |
| `POST` | `/api/docs/{docId}/archive` | ゴミ箱へ移動 | 本文書 |
| `POST` | `/api/docs/{docId}/restore` | ゴミ箱から復元 | 本文書 |
| `POST` | `/api/docs/{docId}/tags` | タグ更新 | 本文書 |
| `DELETE` | `/api/docs/{docId}` | 物理削除（archived のみ） | 本文書 |
| `GET` | `/api/docs/{docId}` | ドキュメント読み込み | 本文書 |
| `POST` | `/api/docs/{docId}` | ドキュメント保存 | 本文書 |
| `GET` | `/api/docs/{docId}/linear/{scopeId}` | リニアノート取得 | 本文書 |
| `PUT` | `/api/docs/{docId}/linear/{scopeId}` | リニアノート保存 | 本文書 |
| `DELETE` | `/api/docs/{docId}/linear/{scopeId}` | リニアノート削除 | 本文書 |
| `GET` | `/api/sync/status/{docId}` | クラウド同期ステータス | 本文書 |
| `POST` | `/api/sync/push/{docId}` | クラウドへ push | 本文書 |
| `POST` | `/api/sync/pull/{docId}` | クラウドから pull | 本文書 |
| `GET` | `/api/ai/status` | AI 基盤ステータス | AI_Common_API.md |
| `POST` | `/api/ai/subagent/{name}` | AI subagent 実行 | AI_Common_API.md |
| `GET` | `/api/linear-transform/status` | Linear transform ステータス | AI_Common_API.md |
| `POST` | `/api/linear-transform/convert` | Linear transform 実行 | AI_Common_API.md |
| `GET` | `/api/docs/{docId}/audit` | 操作監査ログ取得 | 本文書 |
| `GET` | `/api/docs/{docId}/presence` | 接続ユーザー一覧取得 | 本文書 |
| `POST` | `/api/flash/ingest` | Flash 入力パイプライン開始 | 本文書 |
| `GET` | `/api/flash/drafts` | Flash ドラフト一覧取得 | 本文書 |
| `GET` | `/api/flash/draft/{id}` | Flash ドラフト詳細取得 | 本文書 |
| `POST` | `/api/flash/draft/{id}/approve` | Flash ドラフト承認 | 本文書 |
| `DELETE` | `/api/flash/draft/{id}` | Flash ドラフト破棄 | 本文書 |
| `GET` | `/{path}` | 静的ファイル配信 | — |

---

## Document Management API (HOME)

HOME ページ（一覧 / 新規 / 複製 / 改名 / タグ / アーカイブ / 削除）を支えるドキュメント単位の管理 API。
個々のドキュメント本文（state）の読み書きは下の Document API を引き続き使う。

DTO 定義は `beta/src/shared/home_types.ts` にある。所有者は data ロール、visual はインポート専用。

### エラー契約

すべての本セクション API は失敗時に下記の構造化エラーを返す（HTTP ステータスコードは 400/404/409/500 のいずれか）。

```json
{
  "ok": false,
  "error": {
    "code": "DOC_NOT_FOUND",
    "message": "Document not found: foo",
    "details": null
  }
}
```

主な `code`:

- `DOC_NOT_FOUND` (404): 指定 `docId` の行が存在しない
- `DOC_ALREADY_EXISTS` (409): 新規/複製先 id が既存
- `INVALID_LABEL` (400): label が空または空白のみ
- `INVALID_TAGS` (400): tags が string[] でない
- `INVALID_BODY` (400): JSON パース失敗
- `NOT_ARCHIVED` (409): 物理削除を archived=0 の doc に対して呼んだ
- `METHOD_NOT_ALLOWED` (405)
- `INTERNAL_ERROR` (500)

### `GET /api/docs`

ドキュメント一覧を返す。

クエリパラメータ:

- `includeArchived` (boolean, 任意): `true` でゴミ箱（archived=1）も含む。既定は `false`

成功レスポンス (200):

```json
{
  "docs": [
    {
      "id": "doc_1234_abcdef",
      "label": "Research notes",
      "savedAt": "2026-04-14T11:29:23.052Z",
      "nodeCount": 42,
      "charCount": 1830,
      "tags": ["work", "draft"],
      "archived": false
    }
  ]
}
```

`label` はルートノードの text、`nodeCount` / `charCount` は state_json をパースして集計する。

### `POST /api/docs/new`

新規ドキュメントを作成する。

リクエストボディ（任意）:

```json
{ "label": "新規メモ" }
```

`label` を省略すると `"Untitled"` が使われる。

成功レスポンス (200):

```json
{ "ok": true, "id": "doc_1234_abcdef" }
```

### `POST /api/docs/{docId}/duplicate`

`docId` のドキュメントを複製し、新しい id を返す。state と tags はコピー、archived は 0、savedAt は現在時刻。

成功レスポンス (200):

```json
{ "ok": true, "id": "doc_5678_xyz123" }
```

### `POST /api/docs/{docId}/rename`

ドキュメントのルートノード text を更新する（HOME 一覧上のラベルと一致）。

リクエストボディ:

```json
{ "label": "新しい名前" }
```

成功レスポンス (200): `{ "ok": true }`

### `POST /api/docs/{docId}/archive`

ドキュメントをゴミ箱に移動（archived=1）。一覧の既定からは消えるが state は保持される。

成功レスポンス (200): `{ "ok": true }`

### `POST /api/docs/{docId}/restore`

ゴミ箱から復元（archived=0）。

成功レスポンス (200): `{ "ok": true }`

### `POST /api/docs/{docId}/tags`

タグを完全置換する。重複・空白文字列は除去。

リクエストボディ:

```json
{ "tags": ["work", "draft"] }
```

成功レスポンス (200): `{ "ok": true }`

### `DELETE /api/docs/{docId}`

物理削除。**archived=1 のドキュメントに対してのみ許可**。それ以外は `409 NOT_ARCHIVED` を返す。

成功レスポンス (200): `{ "ok": true }`

---

## Document API

M3E の正本操作を行う中核エンドポイント。
永続化先は SQLite (`{M3E_DATA_DIR}/rapid-mvp.sqlite`) だが、
外部からは必ずこの API を経由する。

### `GET /api/docs/{docId}`

ドキュメントの現在 state を取得する。

#### リクエスト

パスパラメータ:

- `docId` (string, 必須): ドキュメント識別子。現在の既定は `rapid-main`

#### 成功レスポンス (200)

```json
{
  "version": 1,
  "savedAt": "2026-04-07T11:29:23.052Z",
  "state": {
    "rootId": "n_1775547979694_t8k38i",
    "nodes": {
      "n_1775547979694_t8k38i": {
        "id": "n_1775547979694_t8k38i",
        "parentId": null,
        "children": ["n_..."],
        "nodeType": "text",
        "text": "Root Mom",
        "collapsed": false,
        "details": "",
        "note": "",
        "attributes": {},
        "link": ""
      }
    },
    "links": {}
  }
}
```

#### エラーレスポンス

| status | 条件 |
|--------|------|
| 400 | `docId` が空 |
| 404 | ドキュメントが存在しない |
| 400 | フォーマット不正またはバリデーション失敗 |
| 500 | 内部エラー |

### `POST /api/docs/{docId}`

ドキュメントの state を保存する。
サーバー側で `RapidMvpModel.fromJSON()` → `validate()` を実行し、
バリデーション通過後のみ SQLite に永続化する。

#### リクエスト

パスパラメータ:

- `docId` (string, 必須): ドキュメント識別子

Body:

```json
{
  "state": {
    "rootId": "...",
    "nodes": { ... },
    "links": { ... }
  }
}
```

`state` を直接トップレベルに置いた形式も受け付ける（`{ "rootId": ..., "nodes": ... }`）。

#### 成功レスポンス (200)

```json
{
  "ok": true,
  "savedAt": "2026-04-07T12:00:00.000Z",
  "documentId": "rapid-main"
}
```

#### エラーレスポンス

| status | 条件 |
|--------|------|
| 400 | JSON パース失敗 / state が空 / バリデーションエラー |
| 405 | GET/POST 以外のメソッド |

#### バリデーション内容

`RapidMvpModel.validate()` が検査する項目:

- root ノードの存在
- 全ノードの `parentId` → 実在ノード参照
- `children` ↔ `parentId` の双方向整合
- alias 制約（子なし、target は実体ノードのみ、参照連鎖禁止）
- alias の `access` 値（`read` | `write`）
- 破損フラグの整合（`isBroken` と target 存在）
- GraphLink の endpoint 存在、self link 禁止、alias endpoint 禁止
- Link の `direction` / `style` の値域
- ツリーの循環検出（DFS）
- 孤立ノードの検出

---

## Linear Notes API

リニアテキストボックス（スコープ単位の自由記述エリア）を全体ドキュメントの POST ラウンドトリップ無しで編集するための API。
`AppState.linearNotesByScope: Record<string, string>` を scopeId（= nodeId）単位で読み書きする。

書き込みは in-place で反映され、他のミューテーションと同様に `docVersion` をインクリメントし、
`/api/docs/{docId}/watch` SSE サブスクライバーに `doc_updated` を通知する。

### `GET /api/docs/{docId}/linear/{scopeId}`

指定スコープのリニアテキストを取得する。未設定なら空文字を返す。

#### 成功レスポンス (200)

```json
{ "ok": true, "scopeId": "n_xxx", "text": "problem: ..." }
```

#### エラーレスポンス

| status | 条件 |
|--------|------|
| 404 | ドキュメント不在 / scopeId がノードとして存在しない |

### `PUT /api/docs/{docId}/linear/{scopeId}`

指定スコープのリニアテキストを**完全置換**で保存する（追記は client 側の責務）。

#### リクエスト Body

```json
{ "text": "任意の UTF-8 文字列" }
```

#### 成功レスポンス (200)

```json
{ "ok": true, "scopeId": "n_xxx", "savedAt": "2026-04-14T10:00:00.000Z" }
```

#### エラーレスポンス

| status | 条件 |
|--------|------|
| 400 | JSON パース失敗 / `text` が文字列でない / validate エラー |
| 404 | ドキュメント不在 / scopeId がノードとして存在しない |

### `DELETE /api/docs/{docId}/linear/{scopeId}`

指定スコープのエントリをマップから削除する（キーごと除去）。存在しなかった場合も 200 で返す（冪等）。

#### 成功レスポンス (200)

```json
{ "ok": true, "scopeId": "n_xxx", "savedAt": "...", "removed": true }
```

`removed` は実際にキーが存在して削除された場合のみ `true`。

---

## Audit Log API

操作監査ログを取得する。ユーザーのノード操作（追加/編集/削除/移動）をタイムスタンプ付きで記録し、直近 N 件をメモリ上のリングバッファに保持する。ファイル永続化は JSON Lines 形式で `{M3E_DATA_DIR}/audit/{docId}.jsonl` に出力される。

### `GET /api/docs/{docId}/audit`

直近の操作監査ログを取得する。

#### リクエスト

パスパラメータ:

- `docId` (string, 必須): ドキュメント識別子

クエリパラメータ:

- `limit` (number, 任意): 取得件数の上限（1-1000、既定: 100）

#### 成功レスポンス (200)

```json
{
  "ok": true,
  "documentId": "rapid-main",
  "count": 3,
  "entries": [
    {
      "timestamp": "2026-04-10T12:00:00.000Z",
      "userId": "e_abc123",
      "operationType": "add",
      "targetNodeId": "n_1234567890_abc123",
      "details": { "docId": "rapid-main", "version": 5, "scopeId": "n_root" }
    }
  ]
}
```

#### AuditEntry フィールド

| フィールド | 型 | 説明 |
|------------|------|------|
| `timestamp` | string (ISO 8601) | 操作日時 |
| `userId` | string | 操作者の entityId |
| `operationType` | `"add"` \| `"edit"` \| `"delete"` \| `"move"` | 操作種別 |
| `targetNodeId` | string | 対象ノード ID |
| `details` | object | 操作の追加情報 |

---

## Presence API

接続中ユーザーの一覧とアクティブ/非アクティブ状態を取得する。Collab API の register/heartbeat/push 操作に連動して自動更新される。60 秒以上操作がないユーザーは `inactive` 状態となる。

### `GET /api/docs/{docId}/presence`

指定ドキュメントの接続ユーザー一覧を取得する。

#### リクエスト

パスパラメータ:

- `docId` (string, 必須): ドキュメント識別子

#### 成功レスポンス (200)

```json
{
  "ok": true,
  "documentId": "rapid-main",
  "count": 2,
  "users": [
    {
      "entityId": "e_abc123",
      "displayName": "Alice",
      "role": "human",
      "status": "active",
      "lastOperationAt": "2026-04-10T12:00:00.000Z",
      "connectedAt": "2026-04-10T11:50:00.000Z"
    }
  ]
}
```

#### PresenceEntry フィールド

| フィールド | 型 | 説明 |
|------------|------|------|
| `entityId` | string | ユーザー識別子 |
| `displayName` | string | 表示名 |
| `role` | string | ロール（owner, human, ai 等） |
| `status` | `"active"` \| `"inactive"` | 状態（60 秒で inactive に遷移） |
| `lastOperationAt` | string (ISO 8601) | 最終操作日時 |
| `connectedAt` | string (ISO 8601) | 接続開始日時 |

---

## Cloud Sync API

クラウド同期はファイルミラー方式で実装される。
`M3E_CLOUD_SYNC=1` の場合のみ有効。無効時は `{ "ok": true, "enabled": false, "mode": "disabled" }` を返す。

### `GET /api/sync/status/{docId}`

同期先ファイルの存在・最終同期日時を返す。

#### 成功レスポンス (200)

```json
{
  "ok": true,
  "enabled": true,
  "mode": "file-mirror",
  "documentId": "rapid-main",
  "exists": true,
  "cloudSavedAt": "2026-04-07T10:00:00.000Z",
  "lastSyncedAt": "2026-04-07T10:00:01.000Z"
}
```

### `POST /api/sync/push/{docId}`

ローカル state をクラウドへ push する。

#### リクエスト Body

```json
{
  "state": { ... },
  "savedAt": "2026-04-07T12:00:00.000Z",
  "baseSavedAt": "2026-04-07T10:00:00.000Z",
  "baseDocVersion": 5,
  "force": false
}
```

- `baseSavedAt`: 楽観的競合検出の基準時刻（null 可、`baseDocVersion` がある場合はフォールバック）
- `baseDocVersion`: 楽観的競合検出の基準バージョン（単調増加整数、推奨）
- `force`: `true` で競合を無視して上書き

成功レスポンスには `docVersion`（push 後のバージョン番号）が含まれる。
Conflict (409) レスポンスには `cloudDocVersion`、`cloudSavedAt`、`remoteState` が含まれ、
ローカル state は自動的に conflict-backup に保存される。

#### エラーコード

| status | code | 条件 |
|--------|------|------|
| 400 | `SYNC_DOC_ID_REQUIRED` | docId が空 |
| 400 | `SYNC_INVALID_JSON_FORMAT` | state が空 |
| 400 | `SYNC_PUSH_INVALID_MODEL` | バリデーション失敗 |
| 409 | `CLOUD_CONFLICT` | 楽観的競合検出 |
| 500 | `SYNC_PUSH_FAILED` | ファイル書き込み失敗 |

### `POST /api/sync/pull/{docId}`

クラウドから state を pull する。

#### 成功レスポンス (200)

```json
{
  "ok": true,
  "mode": "file-mirror",
  "version": 1,
  "savedAt": "2026-04-07T10:00:00.000Z",
  "state": { ... },
  "documentId": "rapid-main",
  "docVersion": 5
}
```

- `docVersion`: クラウド側の現在のドキュメントバージョン（単調増加整数）。次回 push 時に `baseDocVersion` として送信する。

#### エラーコード

| status | code | 条件 |
|--------|------|------|
| 404 | `SYNC_CLOUD_NOT_FOUND` | クラウドファイルが存在しない |
| 400 | `SYNC_CLOUD_UNSUPPORTED_FORMAT` | フォーマット不正 |
| 400 | `SYNC_CLOUD_INVALID_MODEL` | バリデーション失敗 |
| 500 | `SYNC_PULL_FAILED` | ファイル読み込み失敗 |

---

## Flash Ingest API

Flash バンドの入力パイプライン。テキストや Markdown を受け取り、ドラフトノードに変換する。
ドラフトは承認されるまで正本マップに書き込まれない（"AI は提案、人間が確定" 原則）。
Phase 1 ではテキストと Markdown のみ対応（AI なし）。

### `POST /api/flash/ingest`

入力コンテンツを受け取り、ドラフトを作成する。バッチ対応。

#### リクエスト Body (単一)

```json
{
  "docId": "rapid-main",
  "sourceType": "text",
  "content": "メモの内容",
  "options": {
    "maxDepth": 4,
    "targetNodeId": "n_existing_node_id"
  }
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `docId` | string | Yes | 対象ドキュメント ID |
| `sourceType` | string | Yes | `"text"` or `"markdown"` (Phase 1) |
| `content` | string | Yes | テキスト本文 |
| `options.maxDepth` | number | No | 構造化の最大階層数（既定: 4） |
| `options.targetNodeId` | string | No | 挿入先ノード ID |

#### リクエスト Body (バッチ)

```json
{
  "items": [
    { "docId": "rapid-main", "sourceType": "text", "content": "First" },
    { "docId": "rapid-main", "sourceType": "markdown", "content": "# Second" }
  ]
}
```

#### 成功レスポンス (202)

```json
{
  "ok": true,
  "draftId": "d_1712745600000_1",
  "status": "pending",
  "title": "メモの内容",
  "nodeCount": 1,
  "message": "Draft created."
}
```

### `GET /api/flash/drafts`

ドラフト一覧を取得する。

#### クエリパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `docId` | string | ドキュメント ID でフィルタ |
| `status` | string | ステータスでフィルタ（`pending`, `approved`, `partial`, `rejected`） |

#### 成功レスポンス (200)

```json
{
  "ok": true,
  "drafts": [
    {
      "id": "d_...",
      "docId": "rapid-main",
      "sourceType": "text",
      "sourceRef": "text:inline",
      "title": "...",
      "nodeCount": 3,
      "status": "pending",
      "createdAt": "2026-04-10T12:00:00Z"
    }
  ]
}
```

### `GET /api/flash/draft/{id}`

特定ドラフトの詳細（構造化ノード含む）を取得する。

#### 成功レスポンス (200)

```json
{
  "ok": true,
  "draft": {
    "id": "d_...",
    "docId": "rapid-main",
    "sourceType": "markdown",
    "sourceRef": "markdown:inline",
    "title": "...",
    "extractedText": "...",
    "structured": {
      "nodes": [
        {
          "tempId": "t_001",
          "parentTempId": null,
          "text": "Heading",
          "details": "",
          "note": "",
          "confidence": 0.7,
          "sourceRef": "markdown:inline",
          "attributes": {}
        }
      ],
      "suggestedParentId": null
    },
    "status": "pending",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### `POST /api/flash/draft/{id}/approve`

ドラフトを承認し、正本マップにノードを追加する。

#### リクエスト Body

```json
{
  "mode": "all",
  "targetParentId": "n_existing_node_id",
  "edits": {
    "t_001": { "text": "修正済みテキスト" }
  }
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `mode` | string | Yes | `"all"` (全承認) or `"partial"` (部分承認) |
| `selectedNodeIds` | string[] | `partial` 時 | 承認するノードの tempId リスト |
| `targetParentId` | string | No | 挿入先ノード ID |
| `edits` | object | No | 承認前のテキスト修正（キーは tempId） |

#### 成功レスポンス (200)

```json
{
  "ok": true,
  "committedNodeIds": ["n_...", "n_..."],
  "parentId": "n_inbox_id",
  "message": "3 nodes committed to rapid-main"
}
```

承認されたノードは `_inbox` ノード配下に配置され、以下の Flash attributes が設定される:

- `m3e:band` = `"flash"`
- `m3e:sourceType` = ソース種別
- `m3e:confidence` = `"0.7"` (手動入力) / `"0.8"` (編集済み)
- `m3e:capturedAt` = 承認日時
- `m3e:status` = `"draft"`

### `DELETE /api/flash/draft/{id}`

ドラフトを破棄する。

#### 成功レスポンス (200)

```json
{
  "ok": true,
  "message": "Draft d_... deleted"
}
```

---

## Node ID 体系

```
n_{timestamp_ms}_{random_6chars}
```

例: `n_1775547979694_t8k38i`

- `timestamp_ms`: `Date.now()` のミリ秒
- `random_6chars`: `Math.random().toString(36).slice(2, 8)`

---

## LLM 連携（MCP サーバー）

### 設計方針

LLM（Claude 等）がマップを直接操作するパイプラインとして、MCP サーバーを REST API のラッパーとして構築する。

安全性の観点から、以下を原則とする:

1. LLM は SQLite を直接操作しない
2. 全操作は `GET /api/docs/{docId}` → in-memory 操作 → `POST /api/docs/{docId}` のフローを通る
3. M3E 本体のバリデーションを必ず通過する
4. M3E が起動していない場合は操作を拒否する

### MCP ツール一覧

| ツール | 種別 | 概要 |
|--------|------|------|
| `get_tree()` | read | ツリー全体をインデント付きテキストで返す |
| `get_node(node_id)` | read | 指定ノードの全フィールドを JSON で返す |
| `search_nodes(query)` | read | text / details / note を部分一致検索 |
| `add_node(parent_id, text, details?, index?)` | write | 子ノードを追加 |
| `add_sibling(node_id, text, details?, after?)` | write | 兄弟ノードを追加 |
| `edit_node(node_id, text?, details?, note?)` | write | ノードのテキスト系フィールドを更新 |
| `delete_node(node_id)` | write | ノードと全子孫を削除 |
| `move_node(node_id, new_parent_id, index?)` | write | ノードを別親の下に移動 |

### セットアップ

前提: Python 3.10+, M3E 起動中

```powershell
pip install mcp requests
```

`claude_desktop_config.json` に追加:

```json
{
  "mcpServers": {
    "m3e": {
      "command": "python",
      "args": ["C:\\path\\to\\m3e_mcp_server.py"]
    }
  }
}
```

### 内部フロー

```
Claude → MCP tool呼び出し
  → GET /api/docs/rapid-main（現在 state 取得）
  → Python で in-memory ノード操作
  → POST /api/docs/rapid-main（バリデーション + 保存）
  → 結果を Claude に返却
```

write ツールは毎回 GET → 操作 → POST の完全サイクルを実行する。
read-modify-write の原子性は M3E 側の SQLite トランザクションに依存する。

### 制限事項（現時点）

- alias ノードの作成・編集は未対応（MCP ツール未実装）
- GraphLink の操作は未対応
- `nodeType` の変更（folder 化等）は未対応
- バルク操作（複数ノード同時変更）は個別の write ツール呼び出しで対応
- M3E 未起動時はエラーを返す（フォールバックなし）

---

## 関連文書

- AI API の詳細: [./AI_Common_API.md](./AI_Common_API.md)
- データモデル: [./Data_Model.md](./Data_Model.md)
- MVC と command: [../04_Architecture/MVC_and_Command.md](../04_Architecture/MVC_and_Command.md)
- クラウド同期: [./Cloud_Sync.md](./Cloud_Sync.md)
- コマンド操作リファレンス: [../06_Operations/Command_Reference.md](../06_Operations/Command_Reference.md)
