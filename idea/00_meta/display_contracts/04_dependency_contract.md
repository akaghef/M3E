# dependency facet の具体契約

ここでは `facet type = dependency` を具体契約として固定する。

対象は:

- 定理の依存関係
- prerequisite graph
- import / reference dependency
- 影響範囲の骨格

## 第一規約

**依存関係の主方向は `depth` に沿わせ、tree には骨格だけを置き、残りは `GraphLink` に逃がす。**

これは M3E では `spanning tree + links` として実装する。

## 具体契約

| 項目 | 契約 |
|---|---|
| `parent-child` | dependency の骨格（spanning tree） |
| `depth` | 前提 -> 帰結 の主方向 |
| `row / breadth` | 同深度の独立前提、同段の派生 |
| `GraphLink` | 非 tree 依存、補助依存 |
| `anchor` | 原則 off、fan-out / source 密集時のみ on |
| `scope` | `unscoped` を既定にする |
| `fill` | importance / centrality |
| `border` | maturity / confidence / proof status |
| `collapse` | source 近傍は open、末端群は folded 可 |

## 基本形

```text
root
  A
    B
      D
    C

link:
  C -> D
```

ここで tree は骨格、`C -> D` は非 tree 依存。

## spanning tree の既定

各 node は依存元のうち **1 本だけ** を structural parent に選ぶ。

残りの依存は `GraphLink` にする。

### 親選定の既定

1. 最も主線に近い依存
2. もっとも深さ整合が良い依存
3. 同点なら局所性（同 chapter / 同 module / 同 cluster）

## breadth の既定

`breadth` は、

- 同じ深さにある独立前提
- 同じ深さで比較したい sibling

を横並びにする。

主方向は depth に任せるので、breadth は比較と分散に使う。

## anchor の既定

dependency では anchor は補助的。

### anchor を使う

- source node が root 直下に多すぎる
- 同種の leaf 群を軽く束ねたい
- 元構造が薄く、fan-out が大きすぎる

### anchor を使わない

- 骨格そのものが十分読みやすい
- anchor が dependency の意味を濁す

つまり anchor は dependency の意味構造ではなく、display の圧縮手段。

## color の既定

| ノード種別 | `fill` | `border` |
|---|---|---|
| 主ノード | importance / centrality | maturity / confidence |
| source / leaf | low-emphasis importance | same rule |
| synthetic anchor | neutral | none |

色は dependency の向きではなく、重要度や成熟度を補助するために使う。

## link の既定

| link 種別 | 意味 |
|---|---|
| `uses` | 非 tree 前提 |
| `uses_in_proof` | proof 内補助依存 |
| `references` | 弱い参照 |

原則:

- `sourceNodeId = 前提`
- `targetNodeId = 帰結`
- `direction = "forward"`

## unscoped の理由

dependency は横断依存を見ること自体が目的なので、まず `unscoped` を既定にする。

別 facet のための chapter / module 整理が必要なら、alias scope を別に作る。

## Claude の導線

1. これは `dependency` facet だと認識する
2. 主依存方向を depth に置く
3. spanning tree を 1 本選ぶ
4. 残り依存を link にする
5. source fan-out が大きすぎるときだけ anchor を検討する
6. 重要度と成熟度を色で補助する

## ひとことで言うと

dependency facet では、**tree は骨格、link は残余依存、depth は依存方向** である。
