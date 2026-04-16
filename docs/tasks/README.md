# tasks/

**役割**: タスク管理・handoff 文書。ロール間・セッション間の引き継ぎ場所。

## 読むタイミング

- セッション開始時（自分のロールの未着手タスク確認）
- 他ロールから handoff を受けた時

## 収録物

- `todo_by_role.md` — ロール別タスク一覧
- `handoff_*.md` — 個別 handoff（テンプレは `handoff_template.md`）

## 書き方

- handoff: `handoff_<topic>.md` でテンプレに沿って
- 完了 handoff は削除 or `legacy/` ではなく、この場で completed マークして履歴保持

## 置かないもの

- 永続ログ → `daily/`
- 運用ルール → `06_Operations/`
