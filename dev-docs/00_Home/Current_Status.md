# Current Status
最終更新: 2026-04-08

## 現在の状態（スナップショット）

- 開発の主対象: `beta/`
- MVP Phase 1〜4: 完了（読み取り・編集・描画・保存が動作中）
- MVP Phase 5: 操作性の最終調整に着手
- 運用方針:
  - UpdateLog は `dev-docs/daily/YYMMDD.md` に追記
  - 本ファイルは「現在状態」だけを保持
  - 粗い TODO は `dev-docs/06_Operations/Todo_Pool.md` へ集約
- 役割分担:
  - 部下（codex1 / codex2）: 実装と daily 追記。`Current_Status.md` は read-only
  - 上司（claude）: 部下 daily を参照して `Current_Status.md` の status 更新と統合管理

## 統合フロー（強制）

1. 部下は担当ブランチ（`dev-beta-visual` / `dev-beta-data`）へ push
2. 上司が `dev-beta` へ merge
3. 部下は次サイクル開始前に `origin/dev-beta` へ rebase
4. rebase 未実施の stale ブランチでは作業再開しない

## 最近の成果（260403〜260408）

- **Graph link 機能**: ノード間の非階層リンクを作成・描画する機能を追加（L / Shift+L キー、ツールバー）
- **可変高さレイアウト**: multiline label 対応、LaTeX ノードのサイジング改善
- **パフォーマンス**: scheduleRender / scheduleApplyZoom による rAF バッチ化
- **クロスブラウザ修正**: wheel deltaMode 正規化（pan/zoom）
- **開発 skill 整備**: devM3E オーケストレーター、pr-beta / pr-review、m3e-shortcuts skill を追加
- AI インフラ: マルチモデル alias / gateway 方針 / Gemma ローカル導入 / topic-suggest subagent
- クラウド同期仕様の初期整理（Cloud_Sync.md）
- REST API 仕様書の新規作成（03_Spec/REST_API.md）

## In Progress

- REST API ドキュメントの整備と LLM 連携の運用検証
- Todo Pool 運用の定着

## Blocked / Risk

- role 違反を機械的に止める CI チェックは未導入
- M3E 起動中に SQLite がロックされる（LLM の直接 DB アクセスは不可 → API 経由で解決済み）

## Next 5

1. CI 検証の導入（branch-role ゲート + Stage A テスト）
2. Linear↔Tree L1 最小実装と round-trip テスト
3. MCP サーバーの実運用テストと改善
4. beta の操作性改善（MVP は凍結、beta 側で進める）
5. spec 文書の更新（scope/alias Beta 実装粒度への拡張）

## 参照

- 運用ルール: `dev-docs/06_Operations/Documentation_Rules.md`
- worktree 運用: `dev-docs/00_Home/Worktree_Separation_Rules.md`
- rough task pool: `dev-docs/06_Operations/Todo_Pool.md`
- 収集済み TODO: `dev-docs/06_Operations/Todo_Collected_260407.md`
- REST API 仕様: `dev-docs/03_Spec/REST_API.md`
- 直近ログ: `dev-docs/daily/260408.md`
