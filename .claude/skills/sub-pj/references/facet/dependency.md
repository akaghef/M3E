# facet レイアウト: 依存グラフ

静的な依存関係（import、参照、前提条件）を扱う facet のスコープ粒度ルール。
M3E の DAG 表現（data-model.md §DAG Representation）を使う。

## スコープ粒度

| 単位 | スコープ化 | 条件 |
|------|-----------|------|
| モジュール/パッケージ | **1 モジュール = 1 scope** | 内部に 5+ 要素がある場合 |
| 個別要素（クラス、関数、ファイル） | **unscope** | 常に |

## DAG 構造

依存グラフは DAG になる。M3E の tree + link overlay で表現しろ:

1. **parentId/children** に spanning tree を構築（最も深い前提条件を親にする）
2. **state.links** に残りの依存辺を格納
3. `sourceNodeId = 前提条件`, `targetNodeId = 依存先`, `direction = "forward"`

DAG 全体を 1 scope 内に収めろ。scope をまたぐと scoped read/write で link が欠落する。

## 具体例

```
dependencies/                        ← scope: 依存グラフ全体
├── VectAlg                          ← 根（依存先なし）
│   ├── DualAlg                      ← VectAlg に依存（structural parent）
│   │   └── VectHeisenbergDouble     ← DualAlg + VectAlg に依存
│   │       link → VectAlg           ← 2 本目の依存は link で
│   └── HopfAlg
├── TensorBases
│   └── BaseConverter
└── CyclicGroupAlg
    link → VectAlg                   ← 非 tree 依存
```

## ノード属性

| attribute | 必須 | 例 |
|-----------|------|-----|
| label | Yes | `VectHeisenbergDouble` |
| summary | Yes | `Heisenberg double 実装。VectAlg と DualAlg に依存` |
| kind | Yes | `module` / `class` / `function` / `file` |
| dep_count | No | `3`（直接依存の数） |

## link と alias

- 同一 scope 内の依存関係 → **link**（`depends_on`, `imports` 等）
- 異なる scope のモジュールへの参照 → **alias** で配置
- 推移閉包は必要な場合のみ。直接依存だけで十分なことが多い