# Current Status
最終更新: 2026-04-19

## 現在の状態（スナップショット）

- 開発の主対象: `beta/`
- MVP Phase 1〜4: 完了（読み取り・編集・描画・保存が動作中）
- **Team Collaboration Phase 1: 実装中**（エンティティ登録・scope lock・SSE 完了、scope push 実装中）
- 運用方針:
  - UpdateLog は `docs/daily/YYMMDD.md` に追記
  - 本ファイルは「現在状態」だけを保持
  - 粗い TODO は `docs/06_Operations/Todo_Pool.md` へ集約
- 役割分担:
  - 部下（codex1 / codex2）: 実装と daily 追記。`Current_Status.md` は read-only
  - 上司（claude）: 部下 daily を参照して `Current_Status.md` の status 更新と統合管理
- リリース: main ブランチ、タグ `v260419-2` が最新
- データバージョン: v1（schema version 1）

## 統合フロー（強制）

1. 部下は担当ブランチ（`dev-visual` / `dev-data`）へ push
2. 上司が `dev-beta` へ merge
3. 部下は次サイクル開始前に `origin/dev-beta` へ rebase
4. rebase 未実施の stale ブランチでは作業再開しない

## 最近の成果（260419）

- **Final cloud sync packaging**: 同一 `final` 製品で personal / team cloud を切り替えられる packaging を追加
- **Supabase team cloud 導線**: `configure-cloud-sync-mode.bat` により team cloud client 設定を永続化可能にした
- **Cloud sync diagnostics**: 起動時の cloud sync 解決値と `diagnose-cloud-sync.bat` を追加
- **Self-conflict 緩和**: `M3E_AUTO_SYNC=0` では保存時 cloud push を止め、同一タブ内 push を直列化

## 最近の成果（260403〜260408）

- **Team Collaboration**: scope-based priority merge の仕様策定 + Phase 1 実装（collab.ts, 10 tests pass）
- **launch-final 拡張**: vYYMMDD タグ規則の明文化、main マージ Step 追加
- **BroadcastChannel 堅牢化**: feature detection, message validation, cross-tab cloud pull notify
- **Graph link 機能**: ノード間の非階層リンクを作成・描画する機能を追加（L / Shift+L キー、ツールバー）
- **可変高さレイアウト**: multiline label 対応、LaTeX ノードのサイジング改善
- **パフォーマンス**: scheduleRender / scheduleApplyZoom による rAF バッチ化
- **クロスブラウザ修正**: wheel deltaMode 正規化（pan/zoom）
- **開発 skill 整備**: devM3E, pr-beta, pr-review, m3e-shortcuts
- AI インフラ: マルチモデル alias / gateway 方針 / Gemma ローカル導入 / topic-suggest subagent
- クラウド同期仕様の初期整理（Cloud_Sync.md）
- REST API 仕様書の新規作成（03_Spec/REST_API.md）
- 配布検証の VM テスト修正を反映し、`warm` / `cold` の両方で `Setup / Verify / Launch / Smoke` が PASS

## In Progress

- **Team Collaboration Phase 1**: scope-level push with auto-merge（サブエージェント実装中）
- Cloud Sync 競合 UI 改善（T4, codex1 にハンドオフ済み）
- Data runtime / distribution 経路の整理と文書反映
- legacy `mvp/` / `scripts/alpha` / `scripts/mvp` の削除と運用文書の beta/final 収束

## Blocked / Risk

- role 違反を機械的に止める CI チェックは未導入
- **セキュリティ検討 4 件** (CSRF, LAN 露出, エージェント偽装, 入力バリデーション) — Todo Pool に blocked で管理中
- M3E 起動中に SQLite がロックされる（LLM の直接 DB アクセスは不可 → API 経由で解決済み）

## Next 5

1. **Team Collaboration Phase 1 完了**（scope push + テスト → merge）
2. Team Collaboration Phase 2（conflict backup, エンティティ UI, 監査ログ）
3. CI 検証の導入（branch-role ゲート + Stage A テスト）
4. セキュリティ懸念の判断（CSRF, LAN, トークン管理, バリデーション）
5. Linear↔Tree L1 最小実装と round-trip テスト

## 参照

- 運用ルール: `docs/06_Operations/Documentation_Rules.md`
- worktree 運用: `docs/00_Home/Worktree_Separation_Rules.md`
- rough task pool: `docs/06_Operations/Todo_Pool.md`
- 収集済み TODO: `docs/06_Operations/Todo_Collected_260407.md`
- REST API 仕様: `docs/03_Spec/REST_API.md`
- **Team Collaboration 仕様: `docs/03_Spec/Team_Collaboration.md`**
- 直近ログ: `docs/daily/260408.md`
