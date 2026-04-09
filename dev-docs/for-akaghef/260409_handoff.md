# セッション引き継ぎ書 — 2026-04-09

次のセッション（クラウド選定の議論等）に必要な文脈をまとめる。

---

## 本日のコミット（dev-beta ブランチ）

```
b3568d5 feat(sync): abstract CloudSyncTransport, add launch-full scripts
91d166a test: add Playwright shortcut test infrastructure (27 tests)
eb14fad feat(sync): add conflict backup save/restore module
2500cc8 feat: add Freeplane .mm export and SQLite auto-backup
952e711 docs: add import/export design, map layout modes, ontology NTT Data insights
7a4c81a docs: add ontology research, home screen design, edge typing ideas
baf6909 feat(viewer): add Home screen with scope navigator (Phase 1)
```

## 主要な成果物

### 実装（コミット済み）
| 機能 | ファイル |
|------|---------|
| Home 画面 Phase 1 | viewer.html/css/ts — Alt+H トグル、スコープ一覧 |
| Freeplane .mm export | shared/mm_exporter.ts + Export メニュー |
| SQLite 自動バックアップ | node/backup.ts — 起動時+1h毎、10世代 |
| Cloud Sync conflict backup | node/conflict_backup.ts — 競合時自動保存 + REST API |
| CloudSyncTransport 抽象化 | shared/types.ts + node/cloud_sync.ts — FileTransport + Http/Supabase スタブ |
| ショートカットテスト基盤 | tests/visual/shortcuts.spec.js — 27 E2E テスト |
| launch-full.bat/.sh | Cloud Sync + Collab + AI 全有効起動 |

### 設計ドキュメント
| ファイル | 内容 |
|---------|------|
| dev-docs/design/home_scope_navigator.md | Home画面 + F/R/D ビジョン + 境界決定 + 設計判断18項目 |
| dev-docs/design/map_layout_modes.md | 8レイアウトモード + テスト方針 + doc保存設計 |
| dev-docs/design/data_import_export.md | Linear round-trip, Markdown, Obsidian, Freeplane, SQLite backup |
| dev-docs/design/cloud_automation_strategy.md | Akaghef の手動作業最小化戦略 |
| dev-docs/research/ontology_scientific_research.md | 競合調査（Web検索補完済み）+ F/R/D 軸分類 |
| dev-docs/research/ontology_data_structure.md | NTT Data 知見 + edgeType 設計 + Graph RAG 接続 |
| dev-docs/ideas/260409_typed_edges.md | 親子エッジ型付け案（案2: edgeLabel + edgeAttributes） |
| dev-docs/ideas/260409_edge_typed_attributes.md | 案C: edgeType + getAllEdges（推奨） |
| dev-docs/for-akaghef/260409_claude_managed_agents.md | Claude Managed Agents 調査 |
| dev-docs/for-akaghef/260409_cloud_strategy.md | Cloud 自動化 — Akaghef がやること3つだけ |

## クラウド選定に必要な文脈

### 現状
- `CloudSyncTransport` インターフェースが完成（push/pull/status）
- `FileTransport` で file-mirror が動作中
- `HttpTransport` / `SupabaseTransport` はスタブのみ（インターフェース実装済み、中身未実装）
- 環境変数 `M3E_CLOUD_TRANSPORT=file|http|supabase` で切替

### 選定で決めること
1. **どのサービスを使うか**: Supabase / Cloudflare R2 / Firebase / 自前VPS
2. **認証方式**: API キー / OAuth / JWT
3. **データ保存形式**: JSON blob / テーブル分割 / S3 オブジェクト
4. **リアルタイム通知**: SSE / WebSocket / Supabase Realtime

### 候補の比較（dev-docs/for-akaghef/260409_cloud_strategy.md より）
| サービス | コスト | 特徴 |
|---------|--------|------|
| Supabase | 無料枠〜$25/月 | Postgres + Auth + Realtime。最もフルスタック |
| Cloudflare R2 | 無料10GB | S3互換。安い。Auth 別途 |
| Firebase | 無料枠あり | Realtime DB + Auth。Google 依存 |
| 自前VPS | $5/月〜 | 完全制御。運用コスト |

### 実装に必要なこと
HttpTransport / SupabaseTransport の中身を埋める。インターフェースは確定済みなので、選定されたサービスの SDK を使って push/pull/status を実装するだけ。

## 確定済みの設計判断（次セッションでも有効）

- モード = ビュー属性（データ属性ではない）
- Flash は別型（マルチモーダル）、Rapid/Deep は同じ TreeNode
- ツリーが主軸、循環グラフは GraphLink で補完
- 昇格はグラデーション（明示的操作なし）
- Linear panel は全モード表示（Deep の TCL が核心）
- edgeType の導入を推奨（案C: edgeType + getAllEdges）

## 未着手の priority タスク（strategy board）

| Priority | Task | Agent |
|----------|------|-------|
| P1 | Collab Phase 2: entity UI | visual |
| P1 | Cloud Sync conflict UI | visual |
| P1 | entity list UI | visual |
| — | Scope-based cloud sync (diff転送) | data (途中) |
| P3 | MCP: alias/GraphLink ops | data |
| P3 | Claude Desktop integration test | manage |

## 新スキル
- `/map-update` — strategy board + Agent Status の一括更新。進捗ルール: 完了=削除, 未着手=単体, 途中=子ノート
