# 2026-04-09 セッション サマリ

## 本日やったこと

### 設計
- **Flash/Rapid/Deep の再定義** — Flash=日常キャプチャ, Rapid=業務グラフ, Deep=研究オントロジー
- **ホーム画面設計** — スコープをファイルエクスプローラー的に閲覧。Phase 1 実装済み
- **マップレイアウトモード設計** — 8種（right-tree, down-tree, balanced, outline, fishbone, timeline, force-directed, matrix）
- **エッジ型付け設計** — 親子エッジに is-a / part-of 等の意味を持たせる。案C（edgeType + getAllEdges）を推奨
- **Deep vs Rapid 境界** — 18項目中15確定。モード=ビュー属性、ツリーが主軸、昇格はグラデーション

### 実装（コミット済み）
- **ホーム画面 Phase 1** — Alt+H でトグル、スコープ一覧表示、クリックで進入
- **Freeplane .mm export** — Export メニューに追加。JSON に加えて .mm でダウンロード可能
- **SQLite 自動バックアップ** — 起動時+1時間ごと、10世代保持
- **Cloud Sync conflict backup** — 競合時にローカル状態を自動保存、リストア API

### リサーチ
- **競合調査**（Web検索補完済み）— Tana が $25M 調達で最大競合。AI 研究ツール（Elicit, NotebookLM）は検索特化で構造化は空白
- **NTT Data オントロジー解説** — Graph RAG との接続点。edgeType があれば M3E データが Graph RAG ソースになる

## あなたに判断してほしいこと

### 1. クラウドサービス選定（ブロッカー）
Cloud Sync の実装を進めるには、バックエンドのクラウドストレージが必要。
現在の cloud_sync.ts は競合検出ロジックのみで、実際の通信先はまだない。

選択肢:
| サービス | コスト | 特徴 |
|---------|--------|------|
| Supabase | 無料枠あり、$25/月〜 | Postgres + Auth + Realtime。最もフルスタック |
| Cloudflare R2 | 無料枠10GB | S3互換。安い。Auth は別途必要 |
| Firebase | 無料枠あり | Realtime DB + Auth。Google 依存 |
| 自前VPS | $5/月〜 | 完全制御。運用コスト |

**必要なアクション**: サービス選定 → アカウント作成 → API キー発行

### 2. edgeType の導入タイミング
TreeNode に `edgeType?: string` を追加する案。データモデル変更なので判断が必要。
→ 詳細: `docs/ideas/260409_edge_typed_attributes.md`

### 3. 未定の設計判断（3項目）
- A3: confidence/temperature の保存先（attributes 予約キー or 新フィールド）
- B3: モード切替時の状態遷移の詳細
- D2: Flash のレンダリング方式（SVG or HTML）

## 今動いているエージェント

| Agent | Task |
|-------|------|
| Plan | Cloud 自動化戦略（ユーザー手動作業の最小化） |
| data2 | ショートカット自動テスト基盤 |

## 次にやること（優先順）

1. **Collaboration P1 タスク** — entity list UI, conflict UI
2. **Cloud Sync** — サービス選定後に通信実装
3. **AI Integration** — MCP 拡張, subagents
