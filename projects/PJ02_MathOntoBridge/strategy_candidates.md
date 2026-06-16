# PJ02 Strategy 候補 10 案

採否は決めない。比較用。

---

## S1. edgeType-first（親子 edge から攻める）

`TreeNode.edgeType?: string` を追加し、親子 edge に意味を載せることから始める。GraphLink はそのまま。

- **着手**: types.ts に edgeType 追加 → viewer で表示 → 手動で自分のマップに付与
- **利点**: prior_art の案 C（ハイブリッド）そのまま。既存コード影響最小。Rapid 骨格に直接意味が乗る
- **欠点**: GraphLink 側（関係線）が後回し。Deep の横断リンクは別途対応が必要
- **Codex 投入**: 不要（まだ Blueprint は関係しない段階）
- **検証**: 自分の AlgLibMove マップで is-a / part-of を付けて、意味が伝わるか体感する

---

## S2. GraphLink kind-first（関係線から攻める）

plan.md Phase 0-1 そのまま。`GraphLink.relationType` を kind 語彙で正式運用し、kind 別描画を入れる。

- **着手**: relation_kinds.ts 新設 → viewer.tuning に色マップ → 既存関係線に手動で kind 付与
- **利点**: 08_implementation_feasibility.md の見積り済み。影響範囲が明確。既存 GraphLink の拡張
- **欠点**: 親子 edge には手を付けない。ツリー構造自体の意味は未解決
- **Codex 投入**: Phase 3 で Blueprint dep_graph を GraphLink として取り込む時に投入
- **検証**: kind 別の色で関係線を見分けられるか

---

## S3. Dual-edge 同時（親子 + GraphLink を同時に型付け）

S1 と S2 を同時にやる。edgeType（親子）と relationType kind（GraphLink）の両方にプロトコルを定める。

- **着手**: types.ts に edgeType 追加 + relation_kinds.ts 新設 + getAllEdges() ユーティリティ
- **利点**: 統一ビュー（全 edge が意味を持つ）が最速で実現。prior_art 案 C の完全形
- **欠点**: 変更面が広い。viewer の親子線描画 + 関係線描画の両方に手を入れる
- **Codex 投入**: getAllEdges() 完成後に Blueprint 取込を投入
- **検証**: 親子 edge と GraphLink が同じ統一ビューで見えるか

---

## S4. Dogfood-driven（自分の数学研究で使いながら育てる）

AlgLibMove マップ（1027 ノード既存）を素材に、edge protocol を dogfood で育てる。コードより運用が先。

- **着手**: AlgLibMove マップの既存ノード 30 個に手動で edgeType / relationType を付けてみる → 痛みを記録 → それに合わせて実装
- **利点**: 実需駆動。不要な抽象化を避けられる。PJ01 との相乗効果
- **欠点**: AlgLibMove の構造に引っ張られて一般性を失うリスク
- **Codex 投入**: dogfood で必要性が確認されてから
- **検証**: 「Hopf 代数の世界モデル」で edge 型が自然に使えるか

---

## S5. Blueprint-first（syntax tree 取込から攻める）

Codex に先行して Blueprint dep_graph の取込を委任し、実データが入った状態で semantic 側を設計する。

- **着手**: Codex に PFR Blueprint dep_graph.json → M3E GraphLink 変換を委任 → 取込結果を見てから kind 語彙を決める
- **利点**: 実データ（数百ノードの数学 DAG）が手元にある状態で設計できる。机上の空論を避ける
- **欠点**: syntax tree（uses のみ）が先に入るので、semantic 側の設計が uses に引きずられるリスク
- **Codex 投入**: 最初期から
- **検証**: PFR の dep_graph が M3E viewer で見えるか

---

## S6. Vocabulary-first（語彙体系を先に固める）

実装の前に edge protocol の語彙（kind 一覧 + 定義 + 制約）を文書として確定する。

- **着手**: prior_art の SKOS / OWL / M3E 独自案を比較 → 語彙ファイル（YAML or JSON）を書く → Glossary に登録 → 実装はその後
- **利点**: 語彙が不安定なまま実装すると手戻りが大きい。研究としても語彙設計が本質
- **欠点**: 語彙を使ってみないと良し悪しがわからない。決めすぎると柔軟性を失う
- **Codex 投入**: 語彙確定後
- **検証**: 語彙で AlgLibMove の 10 関係を記述してみて、表現力を確認

---

## S7. Minimal viable ontology（最小 3 種で始める）

kind を `is-a` / `part-of` / `related` の 3 種だけに絞り、これだけで走る最小プロトコルを作る。

- **着手**: edgeType + relationType の両方を 3 種限定で実装 → viewer で色分け → 拡張は後
- **利点**: 決定コスト最小。SKOS の broader/narrower/related に近く、標準準拠の布石
- **欠点**: 数学では generalizes / dual / example_of 等が欲しくなるはず。3 種では表現力不足
- **Codex 投入**: Blueprint uses は `related` にマッピングして取込
- **検証**: 3 種で 80% のケースをカバーできるか

---

## S8. AI-assisted tagging（AI にエッジ型を提案させる）

既存マップのノード対を AI に見せて「この関係は is-a? part-of? generalizes?」を提案させ、人間が承認する。

- **着手**: edge protocol 最小実装 → AI subagent に「ノード A→B の関係種別を推定」tool を追加 → バッチで既存マップに適用
- **利点**: 手動タグ付けの苦痛を回避。大量の既存ノードに遡及適用できる
- **欠点**: AI の推定精度が不明。誤タグが蓄積するリスク。幻覚問題
- **Codex 投入**: AI tagging tool の実装を委任可能
- **検証**: AlgLibMove 50 ノード対で推定精度を測る

---

## S9. Export-driven（出力から逆算する）

科研費申請書のドラフトを M3E から生成するゴールから逆算して、必要な edge 情報を特定する。

- **着手**: 科研費テンプレート（背景→目的→方法→期待される成果）の各セクションに必要な edge 種別を列挙 → その種別だけ実装
- **利点**: project_projection_vision と直結。「何のための edge か」が明確。過剰設計を避けられる
- **欠点**: 科研費特化になり、汎用オントロジー基盤としての広がりを失うリスク。PJ-07 Projection との境界が曖昧
- **Codex 投入**: 射影テンプレ実装時
- **検証**: edge 付きマップから科研費 1 セクションの骨格が自動生成できるか

---

## S10. Two-track parallel（semantic と syntax を並行で走らせる）

Claude が semantic tree（edgeType + kind protocol）を実装する間に、Codex が syntax tree（Blueprint 取込）を並行実装。合流点で統一ビューを作る。

- **着手**: 同時キックオフ。Claude: edgeType + relation_kinds + viewer 描画。Codex: dep_graph parser + importer。合流: getAllEdges() で統一表示
- **利点**: 最速。2 トラックの独立性が高い（型定義だけ共有すれば並行可能）
- **欠点**: 合流時のインテグレーションリスク。Codex 側の品質管理が別途必要
- **Codex 投入**: Day 1 から
- **検証**: 合流後に semantic edge と syntax edge が同じ viewer で混在表示できるか

---

## 比較軸

| 案 | 最初に動くもの | Codex 投入時期 | リスク | 研究価値 | 実装規模 |
|---|---|---|---|---|---|
| S1 edgeType-first | 親子 edge | 後 | 低 | 中 | 小 |
| S2 GraphLink kind-first | 関係線 | 中 | 低 | 中 | 小 |
| S3 Dual-edge 同時 | 両方 | 中 | 中 | 高 | 中 |
| S4 Dogfood-driven | 運用 | 後 | 低 | 高 | 小 |
| S5 Blueprint-first | 実データ | 最初 | 中 | 中 | 中 |
| S6 Vocabulary-first | 文書 | 後 | 低 | 高 | 小 |
| S7 Minimal 3 種 | 最小実装 | 中 | 低 | 低 | 最小 |
| S8 AI-assisted | AI tool | 中 | 高 | 中 | 中 |
| S9 Export-driven | 出力逆算 | 後 | 中 | 低 | 中 |
| S10 Two-track | 並行 | 最初 | 高 | 高 | 大 |

*2026-04-17*
