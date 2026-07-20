# tasks/

**役割**: 具体 task と handoff の置き場。ロール間・セッション間の引き継ぎ場所。

## 読むタイミング

- セッション開始時（自分のロールの未着手タスク確認）
- 他ロールから handoff を受けた時
- `Current_Status.md` で active な `S*` を見たあと、具体 task を確認したい時

## 収録物

- `todo_by_role.md` — ロール別タスク一覧
- `handoff_*.md` — 個別 handoff（テンプレは `handoff_template.md`）
- 具体 task を表す文書群（必要に応じて追加）

## 書き方

- handoff: `handoff_<topic>.md` でテンプレに沿って
- 具体 task は task 単位で文書化してよい
- 完了 handoff は削除 or `legacy/` ではなく、この場で completed マークして履歴保持

## 置かないもの

- 永続ログ → `daily/`
- 数日スパンの Strategy 状態 → `00_Home/Current_Status.md`
- 運用ルール → `06_Operations/`
