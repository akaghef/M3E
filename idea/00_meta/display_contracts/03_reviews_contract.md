# reviews facet の具体契約

ここでは `facet type = reviews` を具体契約として固定する。

対象は:

- 判断待ちの問い
- 選択肢
- 根拠
- デメリット
- 条件付き判断
- レビュー用の決定キュー

## 第一規約

**人間が大量の問いを高速にトリアージできることを第一目的にする。**

そのため、`reviews` では semantic purity よりも reviewability を優先する。

## 具体契約

| 項目 | 契約 |
|---|---|
| `parent-child` | `問い -> 選択肢 -> 根拠/デメリット/条件` |
| `depth` | 判断の粒度。問いから具体理由へ降りる |
| `row / breadth` | 同じ問いに対する選択肢比較 |
| `GraphLink` | 問い間依存、衝突、前提共有、参照 |
| `anchor` | 原則 on。文脈クラスタごとに束ねる |
| `scope` | `unscoped` を既定にする |
| `fill` | まず重要度、その次に確信度 |
| `border` | 緊急度またはリスク |
| `collapse` | anchor と Q は open、根拠/デメリットは folded 可 |

## 基本形

```text
[anchor] API設計
  Q: エンドポイント粒度は?
    選択肢A: 粗粒度REST
      根拠
      デメリット
    選択肢B: GraphQL
      根拠
      デメリット
```

この構造を既定とする。

## unscoped の理由

reviews では、

- anchor 間の比較
- 似た問いの横断レビュー
- 一括承認と熟考対象のトリアージ

が重要なので、まず `unscoped` を既定にする。

scope を切ると文脈比較がしづらくなるので、isolated review が必要な特殊ケースだけ scope を使う。

## anchor の既定

`reviews` では anchor を **強く推奨** する。

理由:

- 100 問を flat に見るのはレビューしづらい
- 文脈クラスタがそのまま review batch になる
- anchor が意味構造を濁しにくい

### anchor の単位

基本は:

- API設計
- 型システム
- DB / 永続化
- UI
- 運用

のような文脈クラスタ。

### anchor を避ける場面

- 問いが少なく、flat でも十分見える
- クラスタを切るとかえって依存関係が見えなくなる

## color の既定

### Q ノード

| 視覚チャネル | 意味 |
|---|---|
| `fill` | 重要度 |
| `border` | 緊急度 |

### 選択肢ノード

| 視覚チャネル | 意味 |
|---|---|
| `fill` | 確信度 |
| `border` | リスク or 留保条件 |

### anchor

- neutral
- 目立たせすぎない
- 文脈ラベルとして機能すればよい

## breadth の既定

`breadth` は **比較** に使う。

つまり、

- 同一 Q 配下の選択肢
- 同一 anchor 配下の Q 群

を横に比較できることが重要。

## link の既定

| link 種別 | 使いどころ |
|---|---|
| `blocks` | ある問いの解決が別の問いの前提 |
| `conflicts` | 選択肢同士が両立しない |
| `depends-on` | Q が別 Q を参照している |
| `references` | 補足参照 |

問いや選択肢の主構造まで link にしない。主構造は tree で見せる。

## Claude の導線

1. これは `reviews` facet だと認識する
2. まず `unscoped` を既定に置く
3. 問いを文脈 anchor に分類する
4. 各 Q の下に選択肢を置く
5. 各選択肢の下に根拠/デメリットを置く
6. Q は重要度/緊急度、選択肢は確信度で色をつける
7. cross-question の依存だけ link にする

## ひとことで言うと

reviews facet では、**問いを文脈で束ね、選択肢を比較可能にし、色でレビュー優先度を即読できること** が契約の中心である。
