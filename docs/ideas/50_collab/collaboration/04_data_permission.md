# 04. データモデル / 権限モデル / ACL / プロビナンス

協調を支えるデータと権限の設計選択肢。
既存 `collab.ts` / `presence.ts` / `cloud_sync.ts` / `conflict_backup.ts` / `audit_log.ts` と
整合する形で並べる。採否は決めない。

## P1. ロール定義

既存 collab.ts は以下のロールを持つ:

```ts
export type CollabRole = "owner" | "human" | "ai-supervised" | "ai" | "ai-readonly";
```

これに対する案:

| 案 | ロール集合 | 良い点 | 悪い点 | 推し度 |
|----|----|----|----|----|
| P1-A | 既存5ロールそのまま | 既存資産活用 | 「コメント専用ゲスト」がない | ○ |
| P1-B | + "guest-comment", "guest-read" | 査読/プレゼン招待に対応 | ロール数増 | ◎ |
| P1-C | 完全自由 RBAC（ロール定義可） | 拡張性高 | 設定地獄 | △ |
| P1-D | "owner" + "editor" + "viewer" 3層に縮約 | シンプル | AI 区別が消える | × |

推し: P1-B（既存5 + guest 系2 = 7ロール）。

## P2. ノード単位 ACL の粒度

| 案 | 粒度 | 良い点 | 悪い点 | 推し度 |
|----|----|----|----|----|
| P2-A | マップ全体に1つの権限 | シンプル | 細かい共有不能 | △ |
| P2-B | subtree 単位 ACL | 「この章だけ共有」可能 | 継承ルール設計 | ◎ |
| P2-C | ノード単位 ACL | 完全制御 | 管理コスト爆発 | ○ |
| P2-D | 属性単位 ACL（text は見えるが note は見えない） | 機微情報マスキング | 複雑 | △ |
| P2-E | scope（既存 collab.ts ScopeLock）と同一概念で揃える | 整合 | scope の再設計が要 | ○ |

推し: P2-B 主軸 + P2-D オプション（policy_privacy 整合）。

## P3. workspace 単位の権限分離

複数 workspace（vault）がある前提:

| 案 | 仕様 | 推し度 |
|----|----|----|
| P3-A | workspace ごとに独立招待 | ◎ |
| P3-B | account 単位で全 workspace 共有 | × |
| P3-C | workspace ごと「公開/非公開」フラグ | ○ |

## P4. 共有リンク

| 案 | リンク種類 | 良い点 | 悪い点 | 推し度 |
|----|----|----|----|----|
| P4-A | read-only リンク | 査読配布に最適 | 編集不可 | ◎ |
| P4-B | comment-only リンク | フィードバック収集 | スパム懸念 | ◎ |
| P4-C | edit リンク | 共著者用 | 流出リスク | ○ |
| P4-D | リンク失効期限あり | 安全 | 管理 UX | ◎ |
| P4-E | パスワード付きリンク | 安全 | 共有摩擦 | ○ |

## P5. 招待モデル

| 案 | 仕様 | 良い点 | 悪い点 |
|----|----|----|----|
| P5-A | メール招待 | 標準的 | メールアドレス管理 |
| P5-B | トークン直配り | 軽量 | 管理しにくい |
| P5-C | 知ってる人のみ（公開鍵交換） | 安全 | 学習コスト |
| P5-D | OAuth（Google/GitHub） | 既存 ID | 依存増 |
| P5-E | ローカル LAN 内のみ自動発見 | 研究室向け | 範囲限定 |

推し: P5-A + P5-B のハイブリッド（メール送信は別系、トークンは手動配布も可）。

## P6. 権限変更ログ

audit_log.ts に統合する案 vs 別系統。

| 案 | 統合度 | 推し度 |
|----|----|----|
| P6-A | audit_log に統合 | ◎ |
| P6-B | 専用 permission_log | ○ |
| P6-C | ログなし（小規模運用） | △ |

## P7. 観覧専用ゲスト

プレゼン・査読向け。一時的アクセス。

| 案 | 仕様 |
|----|----|
| P7-A | 招待リンクのみ、登録不要 |
| P7-B | ゲスト専用 entity 自動生成 |
| P7-C | 期限付き、自動失効 |

## P8. AI エージェントの権限昇降格

| 案 | 仕様 | 推し度 |
|----|----|----|
| P8-A | 起動時にロール固定 | ◎（既存実装） |
| P8-B | 動的に "ai" ↔ "ai-supervised" を切替 | ○ |
| P8-C | 信頼度（過去の精度）でロール自動決定 | △ |
| P8-D | ノードごとに AI 権限を変える | △ |

## P9. 機微ノードの強制マスキング

policy_privacy 整合。

| 案 | 仕様 | 推し度 |
|----|----|----|
| P9-A | 「private」属性付きノードは共有時に title だけ表示 | ◎ |
| P9-B | 暗号化対象ノードは復号鍵を持つ entity だけ見える | ◎ |
| P9-C | 共有エクスポート時に正規表現マスキング | ○ |
| P9-D | AI 送信時の自動検閲（既存 L5 と同方向） | ◎ |

## P10. プロビナンス

「誰がいつ何を作ったか／変更したか／コメントしたか」を必ず残す。

| 案 | データ保持 | 推し度 |
|----|----|----|
| P10-A | ノードに createdBy / lastEditedBy を必須 | ◎ |
| P10-B | 全変更を audit_log に積む | ◎（既存実装） |
| P10-C | コメント・レビュー・ハンドオフは別 trail | ○ |
| P10-D | 匿名化オプション（共有時に作者を伏せる） | △ |

## D. データスキーマ案

### D1. コメントスキーマ案

```jsonc
// 例（仕様確定ではない）
{
  "id": "cm_xxx",
  "nodeId": "n_yyy",
  "authorEntityId": "e_aaa",
  "createdAt": "ISO 8601",
  "text": "...",
  "state": "open" | "resolved",
  "threadParent": "cm_zzz" | null,
  "reactions": { "+1": 2, "?": 1 }
}
```

| 案 | 保管場所 | 推し度 |
|----|----|----|
| D1-A | ノード attribute に inline | △（肥大化） |
| D1-B | 別ファイル（comments.json） | ○ |
| D1-C | サーバ側 SQLite | ○ |
| D1-D | ノードと別の独立コレクション、API 経由 | ◎ |

### D2. レビュー依頼スキーマ案

```jsonc
{
  "id": "rv_xxx",
  "nodeId": "n_yyy",
  "requesterEntityId": "e_aaa",
  "assigneeEntityId": "e_bbb",
  "purpose": "critique" | "approval" | "elaborate",
  "deadline": "ISO 8601" | null,
  "state": "pending" | "in_progress" | "done" | "rejected",
  "result": { "summary": "...", "linkedCommentIds": [...] }
}
```

### D3. ハンドオフ trail スキーマ案

```jsonc
{
  "id": "ho_xxx",
  "nodeId": "n_yyy",
  "fromEntityId": "e_aaa",
  "toEntityId": "e_bbb",
  "createdAt": "ISO 8601",
  "intent": "implement" | "review" | "decide" | ...,
  "note": "...",
  "state": "open" | "accepted" | "completed" | "returned",
  "replyTrail": [ { /* 受領後のやり取り */ } ]
}
```

D3 は **3軸（人↔人/人↔AI/AI↔AI）すべてに同じスキーマ** で足りる可能性が高い。

### D4. プレゼンスデータ

既存 `presence.ts` は揮発（in-memory Map）。

| 案 | 永続度 | 良い点 | 悪い点 |
|----|----|----|----|
| D4-A | 完全揮発 | プライバシー◎ | サーバ再起動で消える |
| D4-B | アクティブ期間中だけ TTL 永続 | バランス | 設計コスト |
| D4-C | 永続ログ化 | 履歴になる | プライバシー懸念 |

### D5. ロックの保存

既存 ScopeLock は in-memory。
- D5-A. 揮発のまま（再起動で全解放）
- D5-B. 永続化（孤立ロックリスク）
- D5-C. 揮発 + リース期限で自動解放（推し）

### D6. 通知キュー

| 案 | 保管 | 推し度 |
|----|----|----|
| D6-A | サーバ side メモリのみ | △ |
| D6-B | 永続キュー（SQLite or JSON） | ◎ |
| D6-C | 受信側ローカル保存 | ○ |

### D7. 監査ログ統合

`audit_log.ts` の OperationType を拡張して以下を含める案:
- `comment.create` / `comment.resolve`
- `review.request` / `review.complete`
- `handoff.create` / `handoff.accept` / `handoff.return`
- `permission.change`

### D8. コンフリクト時のバックアップ

`conflict_backup.ts` は既に MAX_BACKUPS_PER_DOC=10 で動作。
協調機能で発生する競合もこの仕組みに統合可能。

| 案 | 仕様 |
|----|----|
| D8-A | 同期競合時に自動バックアップ → 通知 |
| D8-B | UI で「触れる」ように差分閲覧 |
| D8-C | 復元・部分マージ操作 |

## 既存実装との整合チェック

| 機能 | 既存 | 必要追加 |
|----|----|----|
| Entity / Role | `collab.ts` 既存 | guest 系ロール |
| Token 認証 | `collab.ts` 既存 | リンク生成 UI |
| ScopeLock | `collab.ts` 既存 | UI 可視化 |
| SSE | `collab.ts` 既存 | コメント・通知イベント |
| Presence | `presence.ts` 既存 | UI 表示 |
| 招待・共有 | `cloud_sync.ts` 部分 | リンク種類拡張 |
| 競合 | `conflict_backup.ts` 既存 | UI |
| 監査 | `audit_log.ts` 既存 | OperationType 拡張 |
| コメント | なし | 全部 |
| レビュー | なし | 全部 |
| ハンドオフ trail | なし | 全部 |
| 通知 | なし | キュー + UI |

## 横断論点

- Dx1. コメント・レビュー・ハンドオフを **同じ thread モデル** で統合するか別々にするか
- Dx2. AI entity に対する権限を「人と同じ」扱いにするか「ツール」扱いにするか
- Dx3. プロビナンスを「常時表示」か「必要時オンデマンド」か
- Dx4. 監査ログは誰が読めるか（owner のみ？ 全員？）
- Dx5. プライバシー観点でプレゼンスを「常に opt-in」にするか
- Dx6. ローカル運用と SaaS 運用でどこまで同じ機構を使い回すか
