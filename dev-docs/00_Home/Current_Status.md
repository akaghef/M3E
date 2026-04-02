# Current Status

最終更新: 2026-04-02

## 現在の状態（スナップショット）

- 開発の主対象: `beta/`
- 運用方針:
  - UpdateLog は `dev-docs/daily/YYMMDD.md` に追記
  - 本ファイルは「現在状態」だけを保持
  - 粗い TODO は `dev-docs/06_Operations/Todo_Pool.md` へ集約
- 役割分担:
  - 部下（codex1 / codex2）: 実装と daily 追記
  - 上司（claude）: `Current_Status.md` の status 更新と統合管理

## 統合フロー（強制）

1. 部下は担当ブランチ（`dev-beta-visual` / `dev-beta-data`）へ push
2. 上司が `dev-beta` へ merge
3. 部下は次サイクル開始前に `origin/dev-beta` へ rebase
4. rebase 未実施の stale ブランチでは作業再開しない

## In Progress

- ドキュメント運用を「daily + current snapshot + todo pool」に移行
- セッション開始ゲート（1回のみ強制）を全体ルールへ反映済み
- worktree 分離運用とブランチ責務の整合を強化中

## Blocked / Risk

- `dev-docs/daily/260402.md` に競合解消の最終確認が必要
- role 違反を機械的に止める CI チェックは未導入

## Next 3

1. `dev-docs/daily/260402.md` の内容整合を最終確認
2. branch-role と変更ファイル範囲の CI 検証を追加
3. `Todo_Pool.md` を実運用し、正式タスク化の流れを固定

## 参照

- 運用ルール: `dev-docs/06_Operations/Documentation_Rules.md`
- worktree 運用: `dev-docs/00_Home/Worktree_Separation_Rules.md`
- rough task pool: `dev-docs/06_Operations/Todo_Pool.md`
- 直近ログ: `dev-docs/daily/260402.md`
