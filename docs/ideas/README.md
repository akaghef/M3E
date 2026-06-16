# Ideas Folder

このフォルダは、実装前のアイデアを自由に追記するための場所です。

## 使い方

- 新しいアイデアごとに1ファイル作る
- ファイル名は `YYMMDD_topic.md` 形式（日付プレフィックス必須）
- まずは短くメモし、必要になったら仕様文書 (`03_Spec/`) や ADR (`09_Decisions/`) へ昇格する
- 同方向の idea が溜まって Strategy 粒度になったら、`../01_Vision/Strategy.md` の `Deferred Strategy` へ持ち上げる準備をする

## Deferred Strategy へ持ち上げる目安

- 同じ方向の idea / memo が複数ある
- どの `V*` に効くかを説明できる
- 具体 task ではなく、中期の攻略方針として語れる
- まだ active ではないが、名前を付けて保留する価値がある

この条件を満たしたら、idea を直接 `Current Strategy` にせず、まず `Deferred Strategy` 候補として束ねる。

## 昇格先

- 仕様化 → `../03_Spec/`
- 判断記録 → `../09_Decisions/ADR_NNN_*.md`
- Strategy 化（保留） → `../01_Vision/Strategy.md` の `Deferred Strategy`
- Strategy 化（主戦場） → `../01_Vision/Strategy.md` の `Current Strategy`
- 不採用確定 → `../legacy/` or 削除

## 推奨テンプレート

- Title
- Why
- Idea
- Open Questions
- Next Action
- Related `V*` / `S*` / `DS*`（分かる範囲で）
