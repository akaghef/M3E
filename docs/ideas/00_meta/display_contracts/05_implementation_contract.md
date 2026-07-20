# implementation facet の具体契約

ここでは `facet type = 実装構造` を、PJ02 の Lean declaration / Blueprint 連携にも使える具体契約として固定する。

対象は:

- Lean declaration
- module / namespace / file
- theorem / lemma / definition / instance
- 自然言語 design node から到達する実装側の着地点
- formalization status を持つ実装単位

## 第一規約

**実装 facet の `parent-child` は所有・内包・構成を表し、依存関係や証明順序を主軸にしない。**

依存は dependency facet、進行順は flow / timeseries facet に逃がす。

## 具体契約

| 項目 | 契約 |
|---|---|
| `parent-child` | file / namespace / declaration の所有・内包 |
| `depth` | 外側から内側へ。project -> module -> namespace -> declaration |
| `row / breadth` | 同じ module / namespace 配下の sibling 比較 |
| `GraphLink` | `formalizes`, `designed_as`, `uses`, `imports` などの横断参照 |
| `anchor` | module / prefix / declaration kind の fan-out が大きいときだけ使う |
| `scope` | `scoped` 寄り。Implementation scope を独立表示する |
| `fill` | implementation status / completion |
| `border` | risk / instability / proof fragility |
| `collapse` | module は open、deep namespace / declaration 群は folded 可 |

## 基本形

```text
Implementation
└── PFR
    ├── PFR.EntropyPFR
    │   ├── theorem entropy_pfr
    │   └── lemma entropy_increment
    └── PFR.ForMathlib.Entropy
        └── definition entropy
```

この tree は「実装上どこに属するか」を読むための骨格であり、
「何に依存するか」や「どの順に証明するか」は直接表さない。

## depth の既定

`depth` は外側から内側へ進む。

1. project / package
2. file / module
3. namespace / section
4. declaration
5. declaration detail（必要時のみ）

Lean declaration を扱う場合、基本の leaf は declaration とする。
proof step まで分解するのは、実装 facet ではなく flow / timeseries 側に回す。

## breadth の既定

`breadth` は同じ所有者の下にある sibling 比較に使う。

- 同一 file 内の declaration 群
- 同一 namespace 内の theorem / lemma / definition
- 同一 prefix を持つ補助 declaration 群

同じ証明段階・同じ時系列という意味は持たせない。

## anchor の既定

implementation facet では anchor は有効だが、意味構造を増やさないこと。

### anchor を使う

- 同一 module に declaration が多すぎる
- prefix ごとに見る方がレビューしやすい
- theorem / lemma / definition / instance の kind 別 grouping が有効
- `ForMathlib` と project local を分けたい

### anchor を使わない

- namespace / file 構造だけで十分読める
- anchor が新しい module や namespace に見える
- dependency や proof order の意味を混ぜてしまう

anchor は `m3e:synthetic = "anchor"` とし、実体 declaration と区別する。

## color の既定

| ノード種別 | `fill` | `border` |
|---|---|---|
| declaration | implementation status / completion | proof fragility / risk |
| module / namespace | child rollup status | instability |
| synthetic anchor | neutral | none |

status の例:

- `not_started`
- `statement_ready`
- `proof_in_progress`
- `formalized`
- `mathlib`
- `blocked`

## link の既定

| link 種別 | 意味 |
|---|---|
| `formalizes` | design node -> implementation declaration |
| `designed_as` | implementation declaration -> design node |
| `uses` | 実装上の参照・依存 |
| `imports` | module import |
| `status_of` | progress facet から実装対象への参照 |

原則:

- design / dependency / progress を tree に混ぜない
- cross-facet relation は GraphLink または alias で表す
- `uses` が主役になる場合は dependency facet に移す

## PJ02 での適用

Blueprint では:

- 自然言語 statement / proof = design facet
- `\lean{...}` の宣言 = implementation facet
- `\leanok` / Blueprint 色 = progress facet

Implementation scope では Lean declaration を実体ノードとして置き、
design 側 statement からは `formalizes` link または alias で参照する。

1 statement が複数 declaration に対応する場合は:

```text
Design statement
  -> formalizes -> declaration A
  -> formalizes -> declaration B
```

とし、implementation tree 側では declaration の所有構造を維持する。

## Claude の導線

implementation facet として書けと言われたら、Claude は次の順で判断する。

1. 実装上の所有構造を探す
2. project -> module -> namespace -> declaration を depth に置く
3. sibling declaration を breadth に並べる
4. dependency / proof order は tree に入れず link へ逃がす
5. fan-out が大きいときだけ module / prefix / kind anchor を入れる
6. status を fill、fragility を border に使う

## ひとことで言うと

implementation facet では、**tree は所有構造、link は横断関係、色は実装状態**である。
