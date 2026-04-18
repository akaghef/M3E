# PFR Blueprint UI と M3E 具象軸の対応

## 観察
PFR Blueprint (teorth.github.io/pfr/blueprint/dep_graph_document.html) の DAG ビューで、ノードをタップすると数学的ステートメント（定理・補題の内容）がポップアップ表示される。

## M3E との対応
これはまさに M3E の **具象軸** の概念に沿っている：
- DAG のノード = 抽象（構造・依存関係）
- タップで開く数学的ステートメント = 具象（中身・意味）
- 抽象⇄具象の行き来が 1 タップでできる

## 含意
- Blueprint の UI 設計が M3E の設計思想を先行実証している
- M3E でも同じ体験を提供できるはず：ノードタップ → details/note に数学的内容を表示
- Blueprint importer で取り込む時、ステートメント本文を TreeNode.details に入れれば自然に再現できる
- syntax tree（DAG 構造）と semantic content（ステートメント）の二層がまさに Rapid/Deep の原型

*2026-04-17*
