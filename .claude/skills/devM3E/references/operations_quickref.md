# Operations Quick Reference

M3E開発の運用ルール早見表。詳細は各原典を参照。

## 更新完了の3条件

1. コミット済み
2. `dev-docs/daily/YYMMDD.md` 追記済み
3. `Current_Status.md` 更新済み（統合ロールのみ）

→ 原典: `dev-docs/06_Operations/Documentation_Rules.md`

## ブランチ運用

| ロール | ブランチ | 操作権限 |
|-------|---------|---------|
| manage（統合） | dev-beta | フル（merge含む） |
| visual | dev-visual | push/commit。merge不可 |
| data | dev-data | push/commit。merge不可 |
| data2 | dev-data2 | push/commit。merge不可 |
| team | dev-team | push/commit。merge不可 |

確認不要: dev-* でのbranch作成/切替, add, commit, push
確認必要: force push, reset --hard, main/release操作

→ 原典: `dev-docs/00_Home/Worktree_Separation_Rules.md`

## 統合フロー

1. 部下 → 担当ブランチにpush
2. 部下 → base dev-beta のPR作成
3. 上司 → レビュー & merge
4. 部下 → origin/dev-beta からrebase
5. stale ブランチで作業再開しない

## 文書言語ルール

- 会話: 英語基本
- 設計文書本文: 日本語
- 技術トークン: 英語のまま

## Decision Pool の使い方

1. 会話中の判断 → まず Decision_Pool.md に書く
2. 確定した内容だけ Spec/Architecture/ADR に昇格
3. 昇格したら Promoted フィールドに反映先を記録

→ 原典: `dev-docs/06_Operations/Decision_Pool.md`

## Todo Pool のState遷移

`pooled` → `ready` → `doing` → `done`
                            → `blocked`
