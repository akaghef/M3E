# Ideas

このフォルダは M3E repo 内の idea の唯一の正規配置。旧 root `idea/` は使用しない。

## 使い方

- 短い単発メモは、直下へ `YYMMDD_topic.md` 形式で1ファイル作る
- 継続的に展開するテーマは `<group>/<topic>/` にまとめ、`README.md` を入口にする
- 未分類の入力はまず root `backlog/` へ置いてよい。idea と判断した時点でここへ移す
- まずは短くメモし、必要になったら仕様文書 (`03_Spec/`) や ADR (`09_Decisions/`) へ昇格する
- 同方向の idea が溜まって Strategy 粒度になったら、`../01_Vision/Strategy.md` の `Deferred Strategy` へ持ち上げる準備をする
- 同じ内容を root `idea/` や `backlog/` に複製せず、正本を一つにする

## 試作成果物

- [M3E Ultimate Graphics](./260704_graphics_showcase.html) — 4種類のアニメーションテーマを比較する自己完結型HTML。

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

## Evidence bundles

- [260720 Runtime Board 動画再現](./260720_runtime_board_video_repro/README.md) — 動画から再現した実行監視UIの画面、検証、実装差分
