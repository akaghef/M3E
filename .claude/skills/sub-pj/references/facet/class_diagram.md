# facet レイアウト: クラス図

クラス実装・クラス階層を扱う facet のスコープ粒度ルール。

## スコープ粒度

| 単位 | スコープ化 | 条件 |
|------|-----------|------|
| クラス | **1 クラス = 1 scope** | 常に |
| メソッド | **1 メソッド = 1 scope**（クラス scope 内） | 常に |
| 単純メソッド（10 ステップ以下） | **unscope** | ステップ数 ≤ 10 |

## 具体例

```
ClassA/                          ← scope
├── properties                   ← unscope（属性一覧）
├── complexMethod/               ← scope（11+ ステップ）
│   ├── step1
│   ├── step2
│   └── ...
├── simpleMethod                 ← unscope（≤ 10 ステップ）
└── anotherSimpleMethod          ← unscope
```

## ノード属性

| attribute | 必須 | 例 |
|-----------|------|-----|
| label | Yes | `VectHeisenbergDouble` |
| summary | Yes | `Heisenberg double の Hopf 代数実装。setConst で構造定数を計算` |
| kind | Yes | `class` / `method` / `property` |
| line_count | No | `158` |
| visibility | No | `public` / `private` |

## link と alias

**scope をまたぐ link は張るな。** 異なる scope 間の関係は alias で示せ。

- 同一 scope 内の関係（例: メソッド間の呼び出し）→ **link**
- 異なる scope 間の関係（例: ClassA.method → ClassB.method）→ **alias** で ClassB 側にも配置
- 継承関係（ClassA inherits ClassB）→ 親 scope（クラス一覧レベル）に **link**。子 scope 内からは張るな

## PJ01 からの教訓

- ラベルだけのノードを作るな。必ず summary を付けろ
- 抽象クラスと具象クラスは kind で区別しろ（`abstract_class` / `class`）
- 継承関係は scope のネストで表現するな。同一レベルの link で表現しろ