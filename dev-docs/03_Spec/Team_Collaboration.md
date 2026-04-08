# Team Collaboration

最終更新: 2026-04-08

## 目的

M3E の同一ドキュメントに対して、複数の人間ユーザーと AI エージェントが同時に読み書きできるようにする。

## 前提と制約

- エンティティ数: 最大 100（人間 + AI ワーカー混在）
- サーバー: 既存の Node.js HTTP サーバー (`start_viewer.ts`)
- scope はツリー構造から実行時に導出される（`folder` ノード = scope 境界）
- 既存の Cloud Sync (file-mirror) を拡張する形で実装
- 高度な CRDT / OT は採用しない（Cloud_Sync.md の方針を踏襲）

## エンティティモデル

### 登録

`POST /api/collab/register` で参加する。

```json
{
  "displayName": "codex1",
  "role": "ai",
  "capabilities": ["read", "write"]
}
```

レスポンス:

```json
{
  "ok": true,
  "entityId": "e_uuid",
  "token": "tok_uuid",
  "priority": 10
}
```

### ロールと優先度

| role | priority | 説明 |
|------|----------|------|
| `owner` | 1000 | ドキュメントオーナー（人間） |
| `human` | 100 | 人間ユーザー |
| `ai-supervised` | 50 | 人間が監視している AI |
| `ai` | 10 | 自律 AI ワーカー |
| `ai-readonly` | 1 | 読み取り専用 AI |

priority が高いほど競合時に優先される。同一 priority の場合は先着順。

### 認証

全リクエストに `Authorization: Bearer {token}` ヘッダーを付与する。
トークンは登録時に発行され、サーバーのインメモリ Map に保持する。

## Scope 所有権

### 定義

scope 所有権はツリー構造から動的に導出される。

- scope = `folder` ノードの subtree（ルートスコープはドキュメント全体）
- scope owner = その scope 内で最も priority が高いアクティブエンティティ
- アクティブ = 直近の heartbeat が有効期間内

### Scope ロック

scope への書き込み権を管理する軽量ロック。

```
POST /api/collab/scope/{scopeId}/lock
Authorization: Bearer {token}
```

```json
{
  "ok": true,
  "lockId": "lock_uuid",
  "expiresAt": "2026-04-08T12:05:00Z",
  "leaseDuration": 30
}
```

- ロックの有効期間: 30秒（heartbeat で延長可能）
- scope が未ロックなら誰でも取得可能
- 既にロックされている場合:
  - リクエスト者の priority > 現ロック保持者 → **奪取**（preemption）
  - リクエスト者の priority <= 現ロック保持者 → 拒否 (409)
- ロック奪取時、旧保持者に通知を送る

### Heartbeat

```
POST /api/collab/heartbeat
Authorization: Bearer {token}
Body: { "lockIds": ["lock_uuid"] }
```

- 10秒ごとに送信
- 30秒間 heartbeat なし → エンティティを inactive 化、ロックを解放

## 同期フロー

### 書き込みフロー

```
1. scope lock 取得
2. 最新 state を pull（GET /api/docs/{docId}）
3. ローカルで編集
4. scope 単位で push（POST /api/collab/push）
5. サーバーが scope マージ + 変更通知
6. lock 解放（または保持して連続編集）
```

### Scope 単位 Push

```
POST /api/collab/push/{docId}
Authorization: Bearer {token}

{
  "scopeId": "folder_node_id",
  "lockId": "lock_uuid",
  "baseVersion": 42,
  "changes": {
    "nodes": {
      "n_123": { ... },
      "n_456": null
    }
  }
}
```

- `changes.nodes`: 変更・追加されたノード（値が `null` なら削除）
- scope 外のノードへの変更は拒否
- `baseVersion` が不一致 → 競合判定へ

### 競合解決

scope 内で競合が発生した場合:

1. 変更対象ノードが重複しない → **自動マージ**（両方採用）
2. 変更対象ノードが重複する → **priority 勝ち**
   - 高 priority のエンティティの変更を採用
   - 不採用側の変更は `conflict_backup` に退避
3. 構造変更（reparent / delete）が衝突 → **priority 勝ち + 検証**
   - マージ後に tree 整合性を検証
   - 整合性エラー → マージ拒否、人間にエスカレーション

### バージョニング

- ドキュメント全体に単調増加の `version` を持つ
- 各 push が成功するたびに version がインクリメント
- クライアントは `baseVersion` を送り、サーバーは `currentVersion` と比較

## 変更通知

### SSE (Server-Sent Events)

```
GET /api/collab/events/{docId}
Authorization: Bearer {token}
```

サーバーからクライアントへの片方向ストリーム:

```
event: state_update
data: {"version": 43, "scopeId": "folder_123", "changedBy": "e_uuid", "changedNodes": ["n_123"]}

event: lock_acquired
data: {"scopeId": "folder_123", "entityId": "e_uuid", "priority": 100}

event: lock_released
data: {"scopeId": "folder_123", "entityId": "e_uuid"}

event: lock_preempted
data: {"scopeId": "folder_123", "oldEntity": "e_uuid", "newEntity": "e_uuid2"}

event: entity_joined
data: {"entityId": "e_uuid", "displayName": "codex1", "role": "ai"}

event: entity_left
data: {"entityId": "e_uuid"}
```

### SSE を選択する理由

- 実装がシンプル（Node.js の `res.write()` で十分）
- HTTP/2 multiplexing との相性がよい
- AI エージェントは curl / fetch で簡単に購読可能
- 100 エンティティなら SSE のコネクション数は問題にならない
- 将来 WebSocket が必要になったら、SSE の上位互換として追加可能

### BroadcastChannel との共存

- 同一ブラウザ内のタブ同期は既存の BroadcastChannel を継続使用
- SSE は異なるデバイス / プロセス間の通知を担当
- SSE で `state_update` を受信 → 最新 state を pull → BroadcastChannel で同一ブラウザ内に伝播

## API エンドポイント一覧

| メソッド | パス | 概要 |
|----------|------|------|
| `POST` | `/api/collab/register` | エンティティ登録 |
| `POST` | `/api/collab/heartbeat` | 生存通知 + ロック延長 |
| `DELETE` | `/api/collab/unregister` | 登録解除 |
| `GET` | `/api/collab/entities/{docId}` | アクティブエンティティ一覧 |
| `POST` | `/api/collab/scope/{scopeId}/lock` | Scope ロック取得 |
| `DELETE` | `/api/collab/scope/{scopeId}/lock` | Scope ロック解放 |
| `POST` | `/api/collab/push/{docId}` | Scope 単位の変更 push |
| `GET` | `/api/collab/events/{docId}` | SSE 変更通知ストリーム |

## 既存 API との関係

| 既存 API | 変更 |
|----------|------|
| `GET /api/docs/{docId}` | 変更なし（全 state 取得） |
| `POST /api/docs/{docId}` | Collab 有効時は非推奨（collab/push を使う） |
| `GET /api/sync/status/{docId}` | Collab 有効時は collab 情報も含める |
| `POST /api/sync/push/{docId}` | Collab 有効時はリダイレクトまたは拒否 |
| `POST /api/sync/pull/{docId}` | 変更なし |

## 有効化

環境変数 `M3E_COLLAB=1` で有効化。無効時は collab API は 404 を返す。
Cloud Sync (`M3E_CLOUD_SYNC=1`) とは独立に設定可能。

## 実装フェーズ

### Phase 1: 基盤（今回）

- エンティティ登録 / heartbeat / unregister
- Scope ロック（priority-based preemption）
- Scope 単位 push + 非重複自動マージ
- SSE 変更通知
- 優先度ベース競合解決（同一ノード → 高 priority 勝ち）

### Phase 2: 堅牢化

- conflict backup と復元 UI
- ロック奪取時の graceful handoff（旧保持者に save 猶予）
- エンティティ一覧 UI（誰がどの scope にいるか）
- 監査ログ

### Phase 3: スケール

- scope 単位の差分転送（全 state ではなく変更ノードのみ）
- 操作ログベースの細粒度マージ
- WebSocket への移行（必要に応じて）

## セキュリティ検討事項

> **注意**: 以下は実装時に判断が必要な項目。決定は Todo Pool に blocked で管理する。

| 項目 | リスク | 暫定方針 | 要検討 |
|------|--------|---------|--------|
| CSRF | ブラウザから localhost への cross-origin POST | カスタムヘッダー `X-M3E-Token` を必須にする | ヘッダーチェックで十分か |
| LAN 露出 | ポートが LAN に公開される可能性 | `127.0.0.1` にバインド（現状維持） | LAN 共有が必要になった場合の対策 |
| エージェント偽装 | 他プロセスがトークンを盗用 | トークンは登録時のみ発行、メモリ保持 | プロセス間のトークン漏洩対策 |
| 入力バリデーション | 不正な state で DB 破壊 | 既存の `RapidMvpModel.validate()` を push 時にも実行 | scope 単位の部分 validate が必要 |
| DoS | 100 エンティティが同時に push | scope lock で直列化される | lock 待ちキューの上限 |
| トークン有効期限 | 無期限トークンの累積 | heartbeat 失効で自動削除 | 明示的な revocation API |

## 関連文書

- [./Cloud_Sync.md](./Cloud_Sync.md) — 既存の同期仕様（file-mirror）
- [./Scope_and_Alias.md](./Scope_and_Alias.md) — scope モデル
- [./REST_API.md](./REST_API.md) — 既存 API
- [./Data_Model.md](./Data_Model.md) — データモデル
