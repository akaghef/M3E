# Lane view と GraphLink の関係の実体化

最終更新: 2026-10-17  
status: idea（akaghef の構想。データ構造の設計が先に要るため、すぐには着手しない）

## 構想

Lane view は、システムを構成する孫 node を一覧し、孫 node 同士が GraphLink でつながっているかを軽く見せるための View である。GraphLink が多く描かれること自体が、そのシステムがどれだけ複雑かを一目でつかむ手がかりになる。そのため、線が多いことは Lane view の問題として扱わない。

各 GraphLink の詳細は Lane view には持ち込まない。詳細は別の facet で、その GraphLink を node として表したもの（relationship reification、関係の実体化）に置く。GraphLink の性質（`attributes` などの property）は、その node を起点に子 node として話題を分岐させる。

見方を変えると、Lane view 上の GraphLink は、別の facet にある実体化 node への参照窓である。alias が node を参照するのと同じように、GraphLink を node に置き換えて参照する形になる。

## 既存の検討との関係

- [Neo4j-backed Team Collaboration と GraphLink 参照](./260824_neo4j_team_collaboration_graphlink.md) は、GraphLink を alias の target として参照し、関係自体を別 scope で詳細化する案を、販売と返品分析の例で検討している。本メモは、その案を Lane view の閲覧体験から求めるもの。
- Lane view の正本は [Surface View 仕様](../03_Spec/map_layout_modes.md)。`GraphLink.attributes` は [Data Model](../03_Spec/Data_Model.md) で仕様のみ定義済み（未実装）。

## 設計が要る点（未決）

- alias の target に GraphLink を取れるか。現行の alias は node だけを参照する。
- 実体化 node と GraphLink の同一性と更新の伝わり方。`scope bind` で扱うか、別の契約にするか。
- `GraphLink.attributes` と実体化 node の子孫のどちらを正本とするか。両方に同じ情報を持たない規則が要る。
- GraphLink や端点の node を削除・移動したときの実体化 node の扱い。
- Lane view で選んだ GraphLink から実体化 node へ移る導線。これは GUI の部品と配置の段階で決める。

## 当面の扱い

Lane view の最初の実装範囲には入れない。最初の範囲では、`GraphLink.attributes` を保存・読込で失わないことだけを満たし、上の設計の余地を残す。
