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
| `GET` | `/api/docs/{docId}` | ドキュメント読み込み | 本文書 |
| `POST` | `/api/docs/{docId}` | ドキュメント保存 | 本文書 |
| `GET` | `/api/sync/status/{docId}` | クラウド同期ステータス | 本文書 |
| `POST` | `/api/sync/push/{docId}` | クラウドへ push | 本文書 |
| `POST` | `/api/sync/pull/{docId}` | クラウドから pull | 本文書 |
| `GET` | `/api/ai/status` | AI 基盤ステータス | AI_Common_API.md |
| `POST` | `/api/ai/subagent/{name}` | AI subagent 実行 | AI_Common_API.md |
| `GET` | `/api/linear-transform/status` | Linear transform ステータス | AI_Common_API.md |
| `POST` | `/api/linear-transform/convert` | Linear transform 実行 | AI_Common_API.md |
| `GET` | `/api/sync/backups/{docId}` | 競合バックアップ一覧 | 本文書 |
| `GET` | `/api/sync/backups/{docId}/{backupId}` | 競合バックアップ取得 | 本文書 |
| `DELETE` | `/api/sync/backups/{docId}/{backupId}` | 競合バックアップ削除 | 本文書 |
| `POST` | `/api/sync/backups/{docId}/restore/{backupId}` | 競合バックアップからリストア | 本文書 |
| `GET` | `/{path}` | 静的ファイル配信 | — |

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
  "force": false
}
```

- `baseSavedAt`: 楽観的競合検出の基準時刻（null 可）
- `force`: `true` で競合を無視して上書き

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
  "documentId": "rapid-main"
}
```

#### エラーコード

| status | code | 条件 |
|--------|------|------|
| 404 | `SYNC_CLOUD_NOT_FOUND` | クラウドファイルが存在しない |
| 400 | `SYNC_CLOUD_UNSUPPORTED_FORMAT` | フォーマット不正 |
| 400 | `SYNC_CLOUD_INVALID_MODEL` | バリデーション失敗 |
| 500 | `SYNC_PULL_FAILED` | ファイル読み込み失敗 |

---

## Conflict Backup API

クラウド同期で競合が発生した際に、ローカル state の自動バックアップを管理する。

### 自動バックアップの動作

以下の状況でローカル state が自動的にバックアップされる:

1. **push 時の競合 (409)**: `POST /api/sync/push/{docId}` で `CLOUD_CONFLICT` が検出された場合、push しようとした state が `cloud-conflict-push` の理由でバックアップされる。レスポンスの `backup` フィールドに `backupId` が含まれる。
2. **pull 時のローカル保護**: `POST /api/sync/pull/{docId}` のリクエスト body に `localState` を含めた場合、クラウドデータを返す前にローカル state が `cloud-sync-pull` の理由でバックアップされる。

バックアップはドキュメントごとに最大 10 件保持され、超過分は古い順に自動削除される。
保存先: `{M3E_DATA_DIR}/conflict-backups/`

### `GET /api/sync/backups/{docId}`

指定ドキュメントの競合バックアップ一覧を取得する（新しい順）。

#### 成功レスポンス (200)

```json
{
  "ok": true,
  "documentId": "rapid-main",
  "backups": [
    {
      "backupId": "2026-04-09_12-00-00-000Z_abc123",
      "documentId": "rapid-main",
      "reason": "cloud-sync-pull",
      "createdAt": "2026-04-09T12:00:00.000Z",
      "savedAt": "2026-04-09T12:00:00.000Z"
    }
  ]
}
```

### `GET /api/sync/backups/{docId}/{backupId}`

指定バックアップの全データ（state 含む）を取得する。

#### 成功レスポンス (200)

```json
{
  "ok": true,
  "backup": {
    "version": 1,
    "backupId": "...",
    "documentId": "rapid-main",
    "reason": "cloud-sync-pull",
    "createdAt": "2026-04-09T12:00:00.000Z",
    "savedAt": "2026-04-09T12:00:00.000Z",
    "state": { "rootId": "...", "nodes": { ... }, "links": { ... } }
  }
}
```

#### エラーレスポンス

| status | 条件 |
|--------|------|
| 404 | バックアップが存在しない |

### `DELETE /api/sync/backups/{docId}/{backupId}`

指定バックアップを削除する。

#### 成功レスポンス (200)

```json
{ "ok": true, "deleted": true }
```

#### エラーレスポンス

| status | 条件 |
|--------|------|
| 404 | バックアップが存在しない |

### `POST /api/sync/backups/{docId}/restore/{backupId}`

バックアップの state を SQLite に復元する。

#### 成功レスポンス (200)

```json
{
  "ok": true,
  "restored": true,
  "backupId": "...",
  "documentId": "rapid-main",
  "savedAt": "2026-04-09T12:01:00.000Z"
}
```

#### エラーレスポンス

| status | 条件 |
|--------|------|
| 400 | バックアップの state がバリデーション失敗 |
| 404 | バックアップが存在しない |
| 500 | SQLite 書き込み失敗 |

### `POST /api/sync/pull/{docId}` (拡張)

既存の pull エンドポイントに `localState` フィールドが追加された。

#### リクエスト Body（オプション）

```json
{
  "localState": { "rootId": "...", "nodes": { ... } }
}
```

`localState` を含む場合、pull レスポンスに `backup` フィールドが付加される:

```json
{
  "ok": true,
  "state": { ... },
  "backup": {
    "backupId": "...",
    "reason": "cloud-sync-pull"
  }
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
