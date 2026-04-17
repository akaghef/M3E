# 処理フロー facet の具体契約

ここでは `facet type = 処理フロー` を最初の具体契約として固定する。

## 前提

対象は:

- プログラムの処理手順
- 呼び出しチェーン
- 操作手順
- 時系列の主線を持つ pipeline

## 第一規約

**主時間軸 / 主処理順が決まっているなら、それを `depth` に置く。**

これを最優先ルールとする。

## 具体契約

| 項目 | 契約 |
|---|---|
| `parent-child` | 主処理骨格を表す |
| `depth` | 処理順・時間順 |
| `row / breadth` | 同じ stage に属する並列処理、同列比較 |
| `GraphLink` | 補助依存、戻り、例外経路、横断参照 |
| `anchor` | 原則 off。必要なときだけ on |
| `scope` | `unscoped` を既定にする |
| `fill` | criticality / step importance |
| `border` | runtime risk |
| `collapse` | 主線は open、補助枝は folded 可 |

## 典型例

```text
入力1 -> 検証 -> 実行1, 実行2 -> 保存
```

このときの読みは:

| 要素 | 解釈 |
|---|---|
| `入力1 -> 検証 -> ... -> 保存` | depth に沿う主線 |
| `実行1, 実行2` | 同 stage の sibling |
| `実行1` と `実行2` | breadth に横並び |

つまり:

- `入力1`
- `検証`
- `実行1, 実行2`
- `保存`

の 4 段が depth の基本単位になる。

## anchor 発火の既定

### anchor を入れない

- `実行1 ... 実行10` のような系列
- anchor が新しい処理段に見える場合
- 主線がすでに十分読みやすい場合

### anchor を入れる

- 低凝集な分岐が大量にあって flat だと読みにくい
- ただし anchor が「新しい処理段」ではなく「表示用 grouping」と読める場合

## color の既定

| ノード種別 | `fill` | `border` |
|---|---|---|
| 主処理 step | criticality | runtime risk |
| 補助 step | low-emphasis criticality | runtime risk |
| synthetic anchor | neutral | none |

原則として:

- 色は処理順そのものには使わない
- 処理順は depth で読ませる
- 色は「どこに注意すべきか」を補助する

## link の既定

| link 種別 | 使う場面 |
|---|---|
| `dependency` | 同 stage 外の前提関係 |
| `exception` | 例外経路 |
| `return` | 戻りや feedback |
| `reference` | 補足参照 |

主線まで link にしない。主線は tree で見せる。

## unscoped の理由

処理フローは通常、

- 主線の連続性
- 分岐と合流の比較
- 補助経路の見比べ

が重要なので、まずは `unscoped` を既定にする。

scope を切るのは:

- subsystem ごとの独立読解が必要
- phase ごとに完全に隔離したい

といった特別な場合だけでよい。

## Claude の導線

処理フローとして書けと言われたら、Claude は次の順で判断する。

1. 主時間軸があるかを見る
2. あればそれを depth に置く
3. 同段並列を breadth に置く
4. anchor が処理段に誤読されるなら使わない
5. 色は criticality / runtime risk に使う
6. 主線は tree、補助関係だけ link にする

## ひとことで言うと

処理フロー facet では、**時間軸が主軸なら depth、並列は breadth、anchor は例外的** である。
