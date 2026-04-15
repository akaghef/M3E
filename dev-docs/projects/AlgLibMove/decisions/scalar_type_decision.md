---
project: AlgLibMove
topic: Julia 版における「スカラー型」の設計方針
status: decided (2026-04-15)
created: 2026-04-15
decided: 2026-04-15
related:
  - debt_register.md #2 (`sym` double dispatch)
  - debt_register.md #16 (sym 計算の二重化)
  - debt_register.md #21 (handle vs value)
  - phaseB (世界モデル — algebra element × scalar の乗法契約)
---

# 決定 (2026-04-15 確定)

本文書は akaghef との 2026-04-15 セッションで **最善案として確定**。以下の推奨サマリを正式決定とする:

- **Q1 = D** (パラメトリック `Alg{S<:Number}`)
- **Q2 = A** (Symbolics.jl)
- **Q3** = `Alg{promote_type(A,B)}` を返す / 記号に寄せる昇格を自動化
- **Q4** = `zero/one` は `S` 委譲、`iszero` は構造判定、厳密判定は簡約化 API に委譲
- **Q5 = A** (`*(c::S, a::Alg{S})` を代数側に定義)
- **Q6** = Q1=D で型パラメータによる数値/記号パス自動分離

debt #2, #16 は Julia 側で**構造的に非問題**として閉じる。後続の実装フェーズでは本決定に従うこと。

# 問題設定

VectAlgebra / StrAlgebra / PolAlg 等の代数要素 `a` に対する **スカラー倍 `c * a`** の `c` の型をどう設計するか。単一セッションで即決せず、前提・制約・選択肢を整理しておく。

# 背景 (MATLAB 側の事情 — 参考情報、設計の根拠にはしない)

MATLAB で `sym` を採用した理由は純粋に言語機能の制約:

1. **primitive (double 等) なら演算子オーバーロードが classdef 側で自然に効く**。しかし定数 `1/3`, `√2`, 記号パラメータ `q` 等を正確に扱いたい場面で primitive では不十分。
2. **`sym` を使うと symbolic scalar としての乗法が形式上成り立つ** が、double dispatch が MATLAB では弱く、`InferiorClasses=?sym` を classdef 属性に書いて演算優先順位を強制する必要があった。
3. **`InferiorClasses=` が「爆発」する潜在リスク**: 新しい代数クラスを追加するたびに全代数側で `InferiorClasses` を更新しないと演算順が崩壊しうる構造。型が N 個あれば O(N) の宣言メンテ。

→ これは **MATLAB の設計上のバグを回避するためのワークアラウンド**であり、Julia に持ち込むべきものではない。**Julia 側ではゼロベースで「あるべき」を決める**。

# Julia 版での決定事項 (本セッションでは決めない、別セッションの論点として提示)

## Q1. スカラーのベース型は何か

スコアは 5 段階 (★5 = 強く推奨、★1 = 非推奨)。

### ★★☆☆☆ A. `Number` 抽象 (standard Julia)

`c::Number` を受ける。`Int, Rational, Float64, Complex, Irrational, BigInt` を一括受容。`Symbolics.Num <: Real <: Number` なので **sym も技術的には通る** が、保証はしない。

- **メリット**
  - シグネチャが最小、学習コストなし
  - 記号が「たまたま通る」のでプロトタイプ段階では気楽
- **デメリット**
  - 代数要素が scalar 型を型パラメータで持たないと `eltype(coeffs)` が実行時確定 → **型不安定、ホットパスで SIMD/インライン消失**
  - 数値パスと記号パスの境界が型で表現されない (Q6 の分離が実現できない)
  - 「保証するかしないか」が曖昧なまま記号が紛れ込み、後で contract 破壊が起きる

### ★★☆☆☆ B. `Union{Number, Symbolics.Num}`

記号数を第一級スカラーに明示的に入れる。

- **メリット**
  - 記号サポートの意図がシグネチャに現れる
  - CI で記号パスを回す動機づけになる
- **デメリット**
  - `Symbolics.Num <: Number` なので **Union が冗長** (型集合として A と同じ)
  - Union 型は要素数が増えると Julia の small-union 最適化から外れる
  - A と同じく型不安定問題を解決しない

### ★☆☆☆☆ C. 自前 `AbstractScalar` 抽象

prj 独自抽象 (Number を包含) を導入、代数側 API を `AbstractScalar` で書く。

- **メリット**
  - prj 固有のスカラー契約 (例: 必須 `simplify` メソッド) を型階層で強制できる
- **デメリット**
  - **`Number` の再発明**。Julia エコシステム (LinearAlgebra, ForwardDiff, Symbolics) と断絶
  - 既存型を `AbstractScalar` に載せるラッパが必要 → debt 増殖
  - MATLAB 時代の「型階層で殴る」発想の残滓。Julia では trait/duck typing が標準

### ★★★★★ D. パラメトリック `VectAlg{S<:Number}` 【推奨】

代数型が scalar 型をパラメータに持つ。`VectAlg{Float64}` と `VectAlg{Num}` は別型として共存。

- **メリット**
  - **型安定**: `eltype` がコンパイル時確定、SIMD/インライン化が効く (Q6 要件を型レベルで達成)
  - **数値パスと記号パスが自動分離**: 異なる `S` は別型なので記号コードが数値コードを汚染しない
  - Julia 標準インタフェース (`promote_type`, `zero(T)`, `one(T)`, `eltype`, broadcasting) に無料で乗る
  - **AD 対応が無料**: `ForwardDiff.Dual <: Number` なので微分も通る
  - `promote_type(Float64, Num) = Num` が Symbolics 側で定義済 → Q3 の「記号に寄せる昇格」が自動実現
  - MATLAB の `InferiorClasses=` 問題が**構造的に発生しない** (多重ディスパッチ + パラメトリック)
- **デメリット**
  - 型シグネチャが冗長になる (`where S<:Number` を書く箇所が増える)
  - 異種 scalar 間の演算で `promote` が毎回挟まる (が、コンパイラが除去する)
  - `VectAlg{Num}` で Symbolics 式木が膨張する問題は残る → Q4 経由で簡約化 API (B' クラスタ) に責務委譲

## Q2. 記号スカラー (パラメータ q, ℏ 等) の扱い

### ★★★★★ A. Symbolics.jl 依存 【推奨】

- **メリット**
  - Julia ネイティブ、`Num <: Real <: Number` で型階層に自然に乗る
  - `promote_rule`, `zero`, `iszero` 等が定義済
  - ModelingToolkit 等エコシステムとの接続が無料
  - AD、数値評価との相互運用が自然
- **デメリット**
  - 式木が膨張しやすく、`simplify` の呼び出しポリシー設計が別途必要 (B' クラスタ)
  - コンパイル時間がやや長い

### ★★☆☆☆ B. SymPy.jl 依存

- **メリット**
  - SymPy の豊富な記号代数機能 (`solve`, `integrate` 等) が使える
  - Mathematica/Maple からの移植で馴染みのある API
- **デメリット**
  - **PyCall 越しで遅い**、Q6 の性能要件に反する
  - Python プロセス起動コスト、型境界のオーバーヘッド
  - `SymPy.Sym` は `Number` ではない → 型階層が分断

### ★☆☆☆☆ C. 自前記号代数

- **メリット**
  - 必要最小限の機能だけなので軽量・高速にできる可能性
  - 外部依存なし
- **デメリット**
  - **保守破綻の王道**。simplify, pattern matching, 有理関数体等を自作する羽目に
  - Symbolics.jl と機能が被るだけで競争力なし
  - バグの温床

### ★★★☆☆ D. 敢えて記号を入れない

代数の内部状態は純数値のみ、記号パラメータは trait で分離。

- **メリット**
  - 実装が単純、性能が最大化
  - テスト容易
- **デメリット**
  - quasi-Hopf の Φ 等、**構造定数に記号パラメータが必要な場面で詰む** (要事実確認、制約4)
  - 結局後から記号を入れる羽目になりがち
  - 「記号が必要か」の判断を先送りにできない

## Q3. promote / convert のルール

- `c::ScalarA * a::Alg{ScalarB}` の結果型は何か
- Julia `promote_rule(ScalarA, ScalarB)` に乗るか、それとも代数側が `Alg{promote_type(A,B)}` を返すか
- **記号と数値が混ざった場合**の昇格先は記号側に寄せるのが自然か

## Q4. ゼロ / 単位元の扱い

- `zero(::Type{Alg{S}})` / `one(...)` の契約 (Julia 標準インタフェース準拠)
- 記号スカラーの場合の `iszero` の判定コスト (Symbolics は `simplify` しないと判定不能)
- → 簡約化戦略 (B' クラスタ) と密結合する論点

## Q5. scalar-alg 乗法の定義位置

### ★★★★★ A. `*(c::Number, a::Alg) = ...` を代数側モジュールで定義 【推奨】

- **メリット**
  - **Julia の標準パターン**、誰が読んでも即座に理解できる
  - 多重ディスパッチに素直に乗る、異種 scalar は promote で自動解決
  - MATLAB の `InferiorClasses` 問題は Julia では構造的に存在しないので trait 不要
- **デメリット**
  - 代数型が増えるとメソッド定義の重複が出るが、マクロや抽象型で吸収可能

### ★★☆☆☆ B. Trait 経由 (`scalar_multiply(::IsScalar{T}, c, a)`)

- **メリット**
  - scalar として振る舞う非 `<:Number` 型を後付けで入れられる
- **デメリット**
  - **過剰設計**。Q1=D で `S<:Number` に縛っている以上、trait で拡張する動機がない
  - 呼び出し側の記述が冗長
  - Julia idiom から外れる

### ★★★☆☆ C. scalar を代数内部に埋め込む (`(coeff, basis)` 表現)

- **メリット**
  - スカラー倍が coeff 側で閉じる → 代数のコア実装が単純化
  - 線形結合として自然な表現、sparse 化と相性良い
- **デメリット**
  - Q5 (定義位置) というより **内部表現の選択**。A と直交する話で、A と併用すべき
  - 非線形な代数 (商代数等) では一般には成り立たない

## Q6. パフォーマンス要件

- `Symbolics.Num` はコスト高。**数値演算パスと記号パスを型で分離** すべきか
- `@generated` / `Val` / `static trait` で記号/数値ブランチを特殊化できるか
- メモ化・構造定数計算 (debt #5, #23) との兼ね合い

# 推奨案サマリ (たたき台、別セッションで確定)

- **Q1 = D** (パラメトリック `Alg{S<:Number}`)
- **Q2 = A** (Symbolics.jl)
- **Q3**: `Alg{promote_type(A,B)}` を返す。`promote_type(Float64, Num) = Num` で「記号に寄せる」が自動実現
- **Q4**: `zero/one` は `S` に委譲、`iszero` は構造判定のみ、厳密判定は簡約化 API (B' クラスタ) の責務
- **Q5 = A** (`*(c::S, a::Alg{S})` を代数側に定義、異種 scalar は promote 経由)
- **Q6**: Q1=D により型パラメータで数値/記号パスが自動分離。`@generated`/`Val` は不要

これにより debt #2 (`sym` double dispatch) と #16 (sym 計算二重化) は **Julia 側で構造的に非問題** として閉じる見込み。

# 決定に影響する制約

1. **既存 MATLAB 実装の乗法呼び出しパターンを壊さない** (behavioral parity, #25)
2. **`calcTensorExpression` の coeff 型** (現状は SparseEx の値欄) との整合
3. **`AbstractAlgebra.jl` エコシステムとの互換** は採るか捨てるか (debt #12 側の決定とも連動)
4. **記号パラメータが Hopf 構造定数に登場するか** (quasi-Hopf の Φ 等) — 事実確認必要

# 非ゴール (このファイルで決めないこと)

- 具体的なパッケージ選定 (Symbolics vs SymPy 等) — Q1/Q2 が固まってから
- 実装レベルの型シグネチャ — Phase C の範疇
- MATLAB の `InferiorClasses=` 問題の再現 — Julia では構造的に不要、議論しない

# 関連する負債項目 (debt_register.md)

| # | 関係 |
|---|---|
| #2 | `sym` double dispatch — MATLAB のワークアラウンド。本設計で解消 |
| #16 | sym 計算の二重化 — Q1/Q2 の結論で一元化可能 |
| #21 | handle vs value — 記号スカラーの mutability と関連 |
| #5, #23 | 構造定数・コンストラクタ重さ — Q6 の性能要件に直結 |
| B' クラスタ | 簡約化 API — Q4 (iszero 判定) と密結合 |

# アウトプット期待形式 (別セッション完了時)

- `scalar_type_decision.md` (本ファイルを supersedes)
  - Q1-Q6 への回答と根拠
  - 採用する型階層の UML 相当
  - promote/convert 表
  - 非採用案とその理由
- `debt_register.md` の #2, #16 を「検証済・方針決定」に更新
- facet 5 (concepts) / facet 11 (design_rules) に rule ノード追加
