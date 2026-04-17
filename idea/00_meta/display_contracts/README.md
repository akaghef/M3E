# Display Contracts

M3E の map 書き込みで、AI が **人間にレビューしやすい表示** を作るための
`facet contract` / `display intent` / 具体契約を整理する。

> メタフォルダ: `idea/00_meta/` — 数学固有ではなく、M3E 全体の表示・書き込み導線に効くメタ設計だから。

## 方針

- まず `facet type` ごとの決め打ち契約を表で揃える
- 次に `flow` のような重要 facet から具体契約を書く
- `layout` ではなく `display` を主語にする
- 色、row/breadth、anchor、scope、collapse まで契約に含める
- PJ 固有 facet はこの `facet type` を継承して具体化する

## ファイル構成

- [01_facet_type_contract_table.md](01_facet_type_contract_table.md) — facet type ごとの display 契約表
- [02_flow_contract.md](02_flow_contract.md) — 処理フロー / 時間軸 facet の具体契約
- [03_reviews_contract.md](03_reviews_contract.md) — reviews facet の具体契約
- [04_dependency_contract.md](04_dependency_contract.md) — dependency facet の具体契約

## キーメッセージ

- `facet` 自体は PJ 固有だが、`facet type` の契約は先に固定できる
- 人間向けの reviewability を主目的にすると、色や anchor も表示契約に含めるべき
- `flow` / `timeseries` 系では「主時間軸は depth」が最初の強い規約になる
- `reviews` では unscoped + context anchoring + triage coloring が基本になる
- `dependency` では spanning tree + GraphLink が基本になる
