# 07. 業務フォルダを Scatter 作業面 + spine 正本として扱う

## 問題意識

業務フォルダの中身は、実際にはきれいな単一ツリーではない。

- 施策、担当、期限、成果物、判断、メモが空間的に散る
- ノード間には参照、依存、補助線、因果、チェック項目が混ざる
- それでも人間が読み返す時には「この業務は何を主線として進んでいるか」が必要になる

このため、業務フォルダは Tree だけで扱うより、Scatter で作業しながら spine を保存する形が自然。

## 用語整理

| 用語 | 役割 |
|---|---|
| 業務フォルダ | scope/root。業務単位の入れ物 |
| Scatter | 自由配置の作業面。ノードを空間的に並べ、参照関係を見ながら編集する |
| spine | 業務フォルダ内の主骨格。木または DAG として読み直すための正本 |
| edge | M3E 正規語では親子関係。spine の保存実体 |
| GraphLink | spine ではない参照、依存、補助接続 |

重要なのは、Scatter に見えている線をすべて spine と見なさないこと。
spine は「この業務を構造として読むなら、この順序・階層・責任分解で把握する」という主線だけを指す。

## 基本モデル

```
業務フォルダ(scope)
├── spine(TreeNode.parentId / children)
│   ├── 目的
│   ├── 主要施策
│   ├── タスク群
│   └── 成果物
└── Scatter surface
    ├── 自由座標
    ├── GraphLink
    └── 補助的な表示状態
```

Scatter は作業面であり、spine は構造正本。
Tree と Scatter は対立するビューではなく、同じ業務フォルダを別の役割で見る surface として扱う。

## 操作イメージ

- 業務フォルダを開くと、既定 surface は Scatter でもよい
- 親子 edge は spine として保存される
- Scatter 上では spine を薄いガイド線として表示できる
- GraphLink は緑点線などで、参照・依存・補助接続として表示する
- 「この link を spine に昇格」「この親子を link に降格」操作を用意する
- spine をもとに Tree / Linear / Outline へ戻せる

## DAG への考え方

現行 TreeNode は単一 parent を持つため、保存実体としては木が基本になる。
ただし業務上は DAG 的な読み方が必要になる。

当面は次の形で扱う。

- spine の主経路は TreeNode.parentId / children で表現
- 複数親に見える関係は GraphLink または alias で表現
- DAG としての読み出しは「spine tree + GraphLink/alias」から派生する

これにより、分散した Scatter データでも spine が決まれば木/DAG へ戻せる。

## 未決

- spine ガイド線を常時表示するか、toggle にするか
- GraphLink を spine に昇格する UI をどう置くか
- 業務フォルダの既定 surface を Scatter にする条件
- Linear 表示に戻した時、GraphLink/alias をどこまで注釈化するか
