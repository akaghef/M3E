# 06. 統合方式の共通パターン — 横断インフラ・プライバシー・コスト

H1〜H7 を個別に積むのではなく、**統合インフラとして共通化** できる部分を抽出。
プライバシー（policy_privacy）と運用コストもここで横断的に扱う。

## 6.1 統合方式の4基本パターン

| ID | パターン | 例 | 難度 | 信頼性 |
|----|---------|---|------|-------|
| P1 | 一方向 import（pull）| Zotero → M3E | 低 | 高 |
| P2 | 一方向 export（push）| M3E → LaTeX | 中 | 高 |
| P3 | 双方向同期 | M3E ⇔ Notion | 高 | 中 |
| P4 | イベント駆動 | git hook → M3E | 中 | 中 |

実際の統合は P1〜P4 の組み合わせ:
- H1 Git: P1（commit pull）+ P2（マップを repo commit）+ P4（git hook）
- H4 Zotero: P1 中心
- H5 LaTeX: P2 中心、戻しに P3 部分採用
- H7 Notion: P3 主軸

## 6.2 ID 戦略の統一

複数統合先で **ID 管理パターン** を統一すると保守性が上がる:

### 6.2.1 ノード attribute スキーマ案

```json
"attributes": {
  "external": {
    "github": { "issue": 123, "url": "https://..." },
    "zotero":  { "key": "ABC123", "bibtex": "smith2024foo" },
    "notion":  { "page_id": "xxx-yyy" },
    "calendar": { "event_id": "..." }
  }
}
```

- 6.2.1.a すべての外部 ID を `external.<service>` 名前空間に
- 6.2.1.b URL も併記して human-readable
- 6.2.1.c 同じノードが複数サービスに同時所属可能

### 6.2.2 mapping table 方式

別ファイル（`integrations.json`）で M3E ノード ID ↔ 外部 ID 対応を持つ:
- 6.2.2.a ノードを汚さない
- 6.2.2.b ノード単独では情報不足
- 6.2.2.c 同期インデックスとして高速

→ どちらが良いかはブレスト保留。両方併用可能性も。

## 6.3 同期エンジンの共通化

### 6.3.1 抽象同期パイプライン

```
[外部] → fetch → normalize → diff → apply → [M3E]
[M3E] → diff → normalize → push → [外部]
```

各統合先は `fetch` `normalize` `push` だけ実装、`diff` `apply` は共通。

### 6.3.2 共通の diff 戦略

- 6.3.2.a タイトル変更 → ノード text 更新
- 6.3.2.b ステータス変更 → ノード status 更新
- 6.3.2.c 削除 → ノードに `deleted` フラグ（物理削除しない）
- 6.3.2.d 追加 → 新ノード生成、外部 ID 紐付け
- 6.3.2.e merge → 衝突時 conflict_backup 連動

### 6.3.3 同期スケジューラ

- 起動時 fetch 全 enabled 統合
- バックグラウンド poll
- イベント駆動 hook
- ユーザ手動 trigger

## 6.4 プライバシー境界（policy_privacy 連動）

### 6.4.1 何を外部に流さないか

| ID | ルール |
|----|-------|
| 6.4.1.a | 暗号化対象ノード（L1）は絶対に外部送信しない |
| 6.4.1.b | private workspace は同期対象外（L3）|
| 6.4.1.c | 機微情報フラグ付きノードは export 時 mask（L2）|
| 6.4.1.d | LLM 経由統合（要約等）は別途検閲（L5）|
| 6.4.1.e | サービス別の許可リスト（GitHub OK, Notion 制限） |

### 6.4.2 統合先別プライバシー特性

| 統合先 | データ送信先 | プライバシー難度 |
|-------|------------|----------------|
| H1 Git ローカル | 自分のディスク | 低 |
| H1 GitHub | GitHub クラウド | 中 |
| H2 Google Calendar | Google クラウド | 高 |
| H3 Obsidian ローカル | 自分のディスク | 低 |
| H4 Zotero ローカル | 自分のディスク | 低 |
| H4 Zotero Web | Zotero クラウド | 中 |
| H5 LaTeX ローカル | 自分のディスク | 低 |
| H5 Overleaf | Overleaf クラウド | 中 |
| H6 VSCode | ローカル拡張内 | 低 |
| H7 Notion | Notion クラウド | 高 |
| H7 Linear | Linear クラウド | 中 |
| H7 Jira | Atlassian クラウド | 高 |

→ ローカル統合 (H1ローカル / H3 / H4ローカル / H5ローカル / H6) を **第一波** に置く。

### 6.4.3 マスキング戦略

export 時に機微情報を伏せる:
- 6.4.3.a 自動 regex マスキング（メアド・電話番号）
- 6.4.3.b ユーザ定義の mask 辞書
- 6.4.3.c LLM による検閲（L5 強化版）
- 6.4.3.d ノード単位の `public_safe: true/false` フラグ
- 6.4.3.e dry-run プレビュー（送信前に必ず確認）

## 6.5 認証・トークン管理

### 6.5.1 トークン保管戦略

| ID | 場所 | 安全性 | 利便性 |
|----|------|-------|-------|
| 6.5.1.a | OS keychain（macOS Keychain / Win Credential Manager） | 高 | 中 |
| 6.5.1.b | 暗号化ファイル（M3E 内）| 中 | 高 |
| 6.5.1.c | env var | 低 | 高 |
| 6.5.1.d | 平文 config（NG）| 低 | 高 |
| 6.5.1.e | OAuth ブラウザ毎回ログイン | 高 | 低 |

→ **6.5.1.a OS keychain** が現実解。

### 6.5.2 トークン期限切れ対応

- リフレッシュトークン自動更新
- 期限切れ時に通知 + 再認証フロー
- 失敗時は同期停止（壊さない）

## 6.6 オフライン耐性（Ot）

### 6.6.1 失敗時の挙動

- 6.6.1.a 同期失敗を queue に積み、再接続時に処理
- 6.6.1.b 即エラー表示、ユーザに対処させる
- 6.6.1.c silent fail、次回同期で再試行
- 6.6.1.d 失敗ログをノードに残す（debug用）

### 6.6.2 ローカル先行モード

- ネット切れでも M3E は動く（既存挙動）
- 統合先への push は queue に積む
- 接続回復時に自動 push
- 既存 conflict_backup 機構と統合

## 6.7 統合の有効化 UX

### 6.7.1 設定 UI

- 6.7.1.a ON/OFF トグル
- 6.7.1.b スコープ選択（workspace/map/subtree）
- 6.7.1.c 同期方向選択
- 6.7.1.d 同期頻度選択
- 6.7.1.e 認証情報入力
- 6.7.1.f dry-run / プレビュー
- 6.7.1.g 過去同期ログ表示

### 6.7.2 視覚的識別

- 統合先別アイコン（Git icon, Zotero icon 等）
- ノードに「外部由来」マーク
- 「同期中」ローディング表示
- 「同期失敗」エラー表示

## 6.8 拡張性 / プラグイン化（Pl）

### 6.8.1 内蔵 vs 拡張

| ID | パターン | 良い点 | 悪い点 |
|----|---------|-------|-------|
| 6.8.1.a | 全部 M3E コアに内蔵 | UX 統一、配布楽 | コア肥大化 |
| 6.8.1.b | プラグイン式（外部 npm モジュール）| コア軽量 | 配布複雑 |
| 6.8.1.c | コア + 公式プラグイン + サードパーティ | バランス | 設計コスト |
| 6.8.1.d | CLI 別バイナリ（m3e-sync-git 等）| 言語自由 | 統合 UX 弱 |

### 6.8.2 プラグイン API 案

```ts
interface IntegrationPlugin {
  id: string
  name: string
  fetch?(scope): Promise<ExternalNode[]>
  push?(nodes): Promise<PushResult>
  webhook?(payload): Promise<void>
  schema: AttributeSchema
}
```

→ ブレスト保留。設計するなら別途。

## 6.9 マルチアカウント（Mu）

| ID | 戦略 |
|----|------|
| 6.9.1 | 統合先別に1アカウント固定 |
| 6.9.2 | 複数アカウント、ノードに account ID 紐付け |
| 6.9.3 | workspace ごとに別アカウント |
| 6.9.4 | 個人 / 組織を別 workspace 推奨 |

GitHub の個人 / 組織 の同居は実用上必須に近い。

## 6.10 統合の運用コスト（Co）

### 6.10.1 継続コスト

- API 仕様変更追従
- 認証期限切れ対応
- レート制限対応
- バージョン互換維持

### 6.10.2 統合先別コスト見積（主観）

| 統合先 | 初期実装 | 継続コスト | 価値 |
|-------|---------|----------|------|
| H1 Git ローカル | 小 | 小 | 高 |
| H1 GitHub | 中 | 中 | 高 |
| H2 Calendar | 中 | 中 | 中 |
| H3 Obsidian | 小 | 小 | 中 |
| H4 Zotero | 中 | 小 | 高 |
| H5 LaTeX | 中 | 小 | 高 |
| H5 Overleaf | 中 | 中 | 高 |
| H6 VSCode | 大 | 中 | 高 |
| H7 Notion | 大 | 大 | 中 |
| H7 Linear | 中 | 中 | 中 |
| H7 Jira | 大 | 大 | 中 |

### 6.10.3 コスト最適化戦略

- ローカルファイル統合を最優先
- OAuth 系は最小限（1〜2個まで）
- プラグイン化で M3E コアにコストを乗せない

## 6.11 統合先ビュー（Vw）

統合先別フィルタビューを map_views に追加:

- 6.11.a 「Git ノードだけ表示」
- 6.11.b 「Zotero 文献ノードだけ」
- 6.11.c 「Calendar 紐付きノードだけ」
- 6.11.d 「外部由来 vs 自分の思考」分離表示
- 6.11.e 統合先別カラーリング

## 6.12 横断パターンまとめ

| 観察 | 内容 |
|------|------|
| ローカル優先 | OAuth より圧倒的に楽、初期 5 統合はローカルのみで設計可能 |
| ID 名前空間統一 | `external.<service>.<id>` の attribute 構造で全統合先カバー |
| diff/apply 共通化 | 各統合先実装は fetch/normalize/push のみ |
| 段階導入 | P1 import → P2 export → P4 イベント → P3 双方向 の順 |
| プライバシー第一 | 統合先別の許可リスト + ノード単位 mask + dry-run プレビュー |
| プラグイン化は後回し | 最初は内蔵、3〜4個実装してから抽出 |
