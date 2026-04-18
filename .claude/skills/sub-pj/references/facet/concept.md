# facet レイアウト: 概念モデル

ドメインの概念と関係（オントロジー、世界モデル）を扱う facet のスコープ粒度ルール。

## スコープ粒度

| 単位 | スコープ化 | 条件 |
|------|-----------|------|
| 概念カテゴリ（大分類） | **1 カテゴリ = 1 scope** | 内部に 5+ 概念がある場合 |
| 個別概念 | **unscope** | 常に（scope 内のノードとして配置） |
| 概念の詳細（定義・性質・例） | **unscope** | 概念ノードの子として配置 |

## 具体例

```
world_model/                         ← scope: 概念モデル全体
├── algebraic_structures/            ← scope: 代数構造カテゴリ
│   ├── Hopf_algebra                 ← 概念ノード
│   │   ├── definition              ← 詳細（子ノード）
│   │   ├── axioms
│   │   └── examples
│   ├── quasi_Hopf_algebra
│   └── group_algebra
├── operations/                      ← scope: 演算カテゴリ
│   ├── tensor_product
│   ├── dual
│   └── cocycle_twist
└── theorems/
    ├── Drinfeld_double_theorem
    └── cocycle_associativity
```

## ノード属性

| attribute | 必須 | 例 |
|-----------|------|-----|
| label | Yes | `Hopf algebra` |
| summary | Yes | `積・余積・対蹠を持つ双代数。5 組 (μ,η,Δ,ε,S) + 公理` |
| kind | Yes | `category` / `concept` / `definition` / `theorem` / `example` |
| formality | No | `informal` / `semi-formal` / `formal` |
| source | No | `Majid Ch.2`（文献参照） |

## link と alias

- 同一カテゴリ内の概念間関係 → **link**（`generalizes`, `requires`, `dual_of` 等）
- 異なるカテゴリの概念への参照 → **alias** で配置
- 概念⇔実装のマッピング → 別の「マッピング facet」で扱え。概念モデル内に実装ノードを混ぜるな

## PJ01 からの教訓

- 概念ノードは summary が命。数学的定義を 1〜2 文で書け
- 概念間の関係が多い場合、link が密になりすぎる。重要な関係だけ link し、残りは details に記述
- 教科書の章構成をそのまま scope にするな。PJ の目的に沿った分類にしろ