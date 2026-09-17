# PJ08 retrospective

> 随時追記する。PJ 完了時にまとめる。

## 何がうまくいったか

- **9月会話と Hermes packet を先に読んだこと。** Fugu の失敗の実体
  （contract が数量条件だった）は、akaghef の口からではなく Hermes packet
  `001_20260914_082443_a71149` の clipping 6 から出た。過去ログを読まなければ
  「Fugu が下手だった」で終わっていた。
- **視覚トークンを逐語採取したこと。** `ot-component-seam-labs` に OT の `dashboard.css` が
  既に入っていたため、色・書体・CRT 処理を推測せずに済んだ。M3E 側も
  `body.scatter-surface-active` が既に暗色だったので合成が自然に閉じた。
- **akaghef が挙げた劣化点2件（edge→mail 履歴 / node hover）をそのまま実装したこと。**
  比較評価は合格条件に直接使える。

## 何が詰まったか

- **Director が解を1回外した。** 「M3E性の受入条件を先に書き下す」を提案したが、
  akaghef の不満は「dashboard に似ている」ではなく「完成図を1枚も見ていない」だった。
  → 教訓は `plan.md`「DC1–DC2 に至った経緯」に記録。
- **散在。** OT 関連の作業が6本の worktree に散り、うち2本は未 commit 差分を持ち、
  1本は空で、spec は `requirements.md` だけで停止していた。器が無いと判断が集積しない。

## Evaluator が見逃したバグ

（Phase 2 以降で記入）

## 次 PJ へ持ち越す harness 改善

- **`farthest_goal.md` の RK4（dashboard への縮退）は散文の注意書きであってゲートではなかった。**
  事前に名指しされていた最有力の失敗形が、そのまま起きた。リスク登録簿の項目を
  「handoff の受入契約に写す」手続きが無い。→ Director Playbook への反映候補。
- **GUI handoff に数量条件を書かせない仕組み**が要る。「N個ある」は契約にならない。
