---
project: AlgLibMove
topic: PolAlg island (可換多項式代数) Julia 設計
status: 設計草案 (Phase C.2、実装前)
date: 2026-04-15
related:
  - investigations/three_system_inquiry.md
  - decisions/scalar_type_decision.md
  - design/shared_core.md
  - design/interface_contracts.md
---

# 1. スコープ宣言

PolAlg island は可換多項式代数を担う独立 module。`three_system_inquiry.md` §2/§5/§6 で確認済の通り、StrAlg / VectAlg / SparseEx を **一切参照しない完全 independent island**。依存先は以下の Shared core のみ:

- `Bases` (変数ラベル列)
- `SpaceSpec` (空間仕様 — PolAlg での依存意図は open_problems Q3 で未決、暫定「依存あり」)
- `NumericType` (係数/冪の型タグ、Julia 側では型パラメータ `S<:Number` に吸収)
- `IAdditive` trait (interface_contracts.md、並行作成中)

ユーザー発言 (debt #12):「VectAlg と PolAlg という大分類。計算手法が違う (テンソル vs 文字列代数)。両者の抽象化は必要だが、実装は全然別」。本 island は **VectAlg と API 表層だけ揃え、内部は完全別実装** を貫く。Phase C.2 の早期成功体験 Stage として、C.1 (Shared core) 完了直後に並列投入可能。

非ゴール (§10 参照) は冒頭で切り捨てて範囲を固定する。

---

# 2. MATLAB 側の現状

## 2.1 classdef 概観 (`Core/PolAlgs/PolAlg.m`, 544 行)

```matlab
classdef (InferiorClasses={?sym}) PolAlg
    properties(SetAccess=protected,Dependent)
        term   % モノミアル数
        dim    % 変数数
    end
    properties
        cf   (:,1)           % 係数ベクトル
        pw                   % 冪行列 (term × dim)、行=モノミアル、列=変数
        base (1,:) Bases
        spec (1,1) SpaceSpec
        ctype NumericType = "D"   % 係数型タグ
        ptype NumericType = "D"   % 冪型タグ
    end
```

`cf` と `pw` の行数が `term` を与え、`pw` の列数が `dim` を与える。これは **COO 様の稠密モノミアル列挙** で、SparseEx のような汎用 COO とは別物 (冪行列という「意味」が入っている点が異なる)。

## 2.2 主要メソッド シグネチャ (実コードは読まない、行番号のみ)

| カテゴリ | メソッド | 行 | 役割 |
|---|---|---|---|
| コンストラクタ | `PolAlg(i1,i2)` | 20 | コピー / scalar / (cf,pw) 3 形態 |
| 型揃え | `alignNum`, `casttype` | 49, 59 | 数値 ↔ PolAlg の昇格 |
| 加減 | `plus`, `plus_`, `minus`, `uminus`, `uplus` | 69–110 | base の一致 assert + 縦積み |
| 等号 | `eq` | 112 | canonical 化後に比較 |
| 乗除冪 | `mtimes`, `mrdivide`, `mpower` | 117, 133, 138 | Cauchy product / 多項式除算 / 反復乗算 |
| 構造 | `unit`, `or`, `and`, `not`, `prodeval`, `lfun`, `split` | 149–227 | モノミアル単位の作用 |
| **正規化** | **`C`**, `removeZero` | **198**, 204 | 同類項括り + 零係数除去 |
| set | `set_cp`, `set.base` | 231, 85 | 内部 mutator |
| 表示 | `disp`, `disp0`–`disp3`, `string`, `getSym`, `convertTermToSym` | 259– | 記号化経由 |
| 変換 | `sym`, `matrix`, `subs`, `getB` | 348, 360, 363, 376 | sym 経由の評価 |

`C()` (198 行) = `combineTerm` → `removeZero` の 2 段パイプラインで canonical を確立。コンストラクタ末尾 (45 行) で `obj=obj.C()` を常に走らせている。

## 2.3 SpaceSpec 依存 (open_problems Q3 未決)

PolAlg は可換多項式なのに `spec SpaceSpec` を保持する。`three_system_inquiry.md` §8 未解決 Q3 で指摘済。暫定扱い:

- Julia 側でも `space::SpaceSpec` field を持つ
- PolAlg が spec を参照する具体的箇所は移植中に確認、不要なら後で落とす (debt 化)

---

# 3. Julia 側の型シグネチャ

## 3.1 コア struct

```julia
struct PolAlg{S<:Number}
    exps   :: Matrix{Int}     # size = (nvars, nterms)、各列が 1 モノミアル
    coeffs :: Vector{S}       # length = nterms
    space  :: SpaceSpec
end
```

MATLAB の `pw` は (term × dim)、Julia では **(nvars × nterms) に転置** して保持する。Julia は column-major なので、モノミアル単位の slice (`exps[:, k]`) が連続メモリに載る方が Cauchy product / sortperm のホットパスに効く。

## 3.2 不変条件 (invariants)

- `size(exps, 1) == nvars(space)`
- `size(exps, 2) == length(coeffs)`
- 指数は **非負整数** (Laurent は別 struct — §10)
- canonical 形では以下を追加で保証:
  - 同じ列 (指数) が 2 回現れない
  - すべての `coeffs[k] != zero(S)` (構造的 iszero 判定)
  - 列が `sortperm` 基準で辞書順ソート済

内部コンストラクタで上 3 つをチェック、canonical 保証はファクトリ関数側 (§4.3) で確立する。

## 3.3 型パラメータ方針

`scalar_type_decision.md` Q1=D に従い `S<:Number` でパラメトリック。MATLAB の `ctype/ptype NumericType` は:

- `ctype` → `S` (型パラメータ)
- `ptype` → `Int` 固定 (指数は整数に限定、sym 指数は非ゴール)

`S = Float64`, `S = Rational{Int}`, `S = Symbolics.Num` を想定。`promote_type` で自動昇格。

---

# 4. API 契約

B' クラスタの `calc` 共通インターフェース (simplify 委譲) と `IAdditive` trait への適合を満たすこと。

## 4.1 算術

| 演算 | シグネチャ | 戻り型 |
|---|---|---|
| 加算 | `+(p::PolAlg{A}, q::PolAlg{B})` | `PolAlg{promote_type(A,B)}` |
| 減算 | `-(p::PolAlg{A}, q::PolAlg{B})` | 同上 |
| 単項 | `-(p::PolAlg{S})`, `+(p::PolAlg{S})` | `PolAlg{S}` |
| 乗算 | `*(p::PolAlg{A}, q::PolAlg{B})` | `PolAlg{promote_type(A,B)}` (Cauchy product) |
| 冪 | `^(p::PolAlg{S}, n::Integer)` | `PolAlg{S}` (非負整数のみ) |

加算は `space` 一致 assert、`hcat` で指数行列を並べ、`simplify` で同類項集約。

## 4.2 スカラー倍 (scalar_type_decision Q5=A)

```julia
*(c::Number, p::PolAlg{S}) where {S}  -> PolAlg{promote_type(typeof(c),S)}
*(p::PolAlg, c::Number) = c * p
```

`c == zero(...)` の場合は空 `PolAlg` を返す (canonical 形)。

## 4.3 係数アクセス / ファクトリ

| API | 役割 |
|---|---|
| `coefficients(p)` | `Vector{S}` を返す (canonical 順) |
| `monomials(p)` | 各列を `Vector{Int}` として iterate |
| `nterms(p)`, `nvars(p)` | 個数系 |
| `polalg(space; coeffs, exps)` | canonical 化込みファクトリ (非公開コンストラクタの薄包み) |
| `zero(::Type{PolAlg{S}})` / `zero(p)` | 零多項式 |
| `one(::Type{PolAlg{S}})` / `one(p)` | 単位元 (全指数 0 のモノミアル、係数 `one(S)`) |

## 4.4 正規化

- `simplify(p)` — §6 参照。同類項集約 + 零除去。Idempotent。
- `iscanonical(p)::Bool` — invariant 検査 (テスト用)

MATLAB の `C()` は Julia `simplify` に 1:1 対応。`removeZero` は `simplify` の内部ステップで露出させない (プライベート `_remove_zero`)。

## 4.5 評価

```julia
evaluate(p::PolAlg{S}, values::AbstractVector) -> <:Number
```

`length(values) == nvars(p)` assert。戻り型は `promote_type(S, eltype(values))`。Horner 化は後回し (Phase D)、初版は naive に `sum(c * prod(v .^ e))`。

## 4.6 比較

| API | セマンティクス |
|---|---|
| `==(p, q)` | canonical 化した上で struct 一致 |
| `iszero(p)` | `nterms(p) == 0` (canonical 前提の構造判定) |
| `isone(p)` | canonical で 1 term + 全指数 0 + 係数 `isone` |

記号係数の厳密判定は scalar_type_decision Q4 に従い **簡約化 API (B' クラスタ) に委譲**。`iszero` は構造判定のみで軽量に保つ。

## 4.7 変換

```julia
convert(::Type{PolAlg{T}}, p::PolAlg{S}) where {T,S}
    = polalg(p.space; coeffs = convert.(T, p.coeffs), exps = p.exps)
```

open_problems `bases_coeff_type.md` Q4 のパターンを踏襲 (convert は scalar 型のみ触り、構造は保存)。

---

# 5. trait 宣言 (interface_contracts.md 参照)

```julia
additive_trait(::Type{<:PolAlg}) = IsAdditive()
```

追加で (契約レベルの提案、interface_contracts.md での採否待ち):

- `commutative_trait(::Type{<:PolAlg}) = IsCommutative()`
  StrAlg の多項式環は非可換、VectAlg も一般に非可換。PolAlg だけが `IsCommutative` を返せる位置にある。
- `ring_trait(::Type{<:PolAlg}) = IsRing()` — 加法群 + 可換乗法で環構造。

trait ディスパッチ経由で「可換性を前提にしたアルゴリズム (例: Cauchy product の並列化)」を PolAlg 側で特殊化できる。

---

# 6. simplify 戦略

## 6.1 同類項検出

同じ指数列 (= `exps` の列) を持つ項を集約する。`exps[:, i] == exps[:, j]` が同類条件。

実装候補:

- **A. sortperm ベース (推奨、初版)**
  1. `perm = sortperm(collect(eachcol(exps)))` で辞書順ソート
  2. 隣接列を比較して group boundary 検出
  3. 各 group の係数を `sum`
  4. `_remove_zero` で最後に零係数除去
  - pros: アロケーション予測可能、型安定、Julia 標準ライブラリのみ
  - cons: `eachcol` の `SubArray` 比較コストを見る必要あり (マイクロベンチマーク対象)

- **B. Dict ベース**
  `Dict{NTuple{nvars,Int}, S}` に累積。
  - pros: 実装が短い
  - cons: `nvars` が型パラメータでないので tuple 化に reinterpret が必要、hash コストが嵩む

- **C. groupreduce パターン** (DataFrames 風)
  外部依存増える、却下。

→ **初版は A**。`sortperm` の stable 性は Julia 標準で保証。B は Benchmark 差分が大きければ代替として検討。

## 6.2 `_remove_zero`

```
keep = findall(!iszero, coeffs_new)
```

`iszero` は §4.6 の構造判定。記号係数の「構造的には 0 ではないが数学的に 0」はここでは落とさない (B' クラスタの責務)。

## 6.3 B' クラスタ `calc` 共通インターフェースとの関係

B' クラスタは `calc(::Algebra)` を共通 API として提案中 (開放中)。PolAlg では `calc(p::PolAlg) = simplify(p)` と内部委譲で十分。level 引数については §7 参照。

## 6.4 Idempotence

`simplify(simplify(p)) === simplify(p)` (value 一致) をテストで保証。sortperm + 隣接集約は 1 回で fixed point に達する。

---

# 7. open_problems との接続

| open_problem | 項目 | PolAlg 側の立場 |
|---|---|---|
| `three_system_integration.md` Q3 | PolAlg の SpaceSpec 依存意図 | **未決**。暫定「依存あり」で `space::SpaceSpec` を持つ。移植中に参照箇所 0 なら落とす (debt 化 TBD-1) |
| `bases_coeff_type.md` Q4 | convert API の形 | §4.7 のパターンを踏襲 (scalar 型のみ touch) |
| `simplification_api.md` Q6 | `simplify(p; level=...)` の level 引数 | PolAlg では **level 不要** と主張。同類項集約は 1 段階のみ。記号係数の数学的 0 判定が必要な場合のみ level 導入、それは B' クラスタ側の決定待ち (TBD-2) |
| `simplification_api.md` Q9 | 正規形型 `CanonicalPolAlg{S}` を別型にするか | **否**。`iscanonical::Bool` 述語 + invariant 保証で十分。型分岐させると convert が煩雑化 (TBD-3、B' 決定次第で再検討) |

---

# 8. test 戦略

## 8.1 Property-based tests (`Test` + 手書き quickcheck)

- **可換律**: `p * q == q * p`
- **結合律**: `(p * q) * r == p * (q * r)`
- **分配律**: `p * (q + r) == p * q + p * r`
- **加法群**: `p + zero(p) == p`, `p + (-p) == zero(p)`
- **冪**: `p^0 == one(p)`, `p^(m+n) == p^m * p^n`
- **simplify idempotence**: §6.4

係数型 `S` は `{Int, Rational{Int}, Float64, Symbolics.Num}` でパラメータ化してテスト行列化。

## 8.2 MATLAB parity (golden data)

既存 `Core/PolAlgs/PolAlg.m` のテストケース (Examples/PolAlg 配下) を golden 化:

1. MATLAB 側で代表的な多項式 (1変数/2変数/3変数、係数は double と sym 両方) を生成
2. `(cf, pw)` を JSON / CSV で export
3. Julia 側で同じ入力を構築し、`+, *, ^, simplify, evaluate` の結果を比較

parity 比較は `==` (canonical 化後) を使う。係数の浮動小数誤差は `≈` (atol) に緩和。

## 8.3 Stage C.2 完了 gate

- 全 property test pass
- 全 MATLAB parity test pass (golden data 100% 一致)
- `iscanonical(p) == true` がすべての public API 出力で成立

---

# 9. 移植順序内訳 (Stage C.2 内の細分並列)

| sub-stage | 内容 | 依存 | 並列性 |
|---|---|---|---|
| C.2.1 | struct 定義 + 内部コンストラクタ + `zero`/`one`/accessors | Shared core (C.1) | — |
| C.2.2 | 加減算 + スカラー倍 + `-` (単項) | C.2.1 | **C.2.1 と並列可** (struct 確定後すぐ分岐) |
| C.2.3 | 乗算 (Cauchy product) + `^` | C.2.1, C.2.2 | 逐次 |
| C.2.4 | `simplify` + `_remove_zero` + `iscanonical` | C.2.1 | 逐次 (ただし C.2.2 と論理独立) |
| C.2.5 | `evaluate` + `==` + `iszero`/`isone` + `convert` | C.2.1–C.2.4 | 逐次 |
| C.2.test | property + parity test | 全上位 | 各 sub-stage 完了時に incremental |

**並列チャンス**: C.2.1 と C.2.2 の骨格 + C.2.4 の `simplify` アルゴリズム検討は同時着手可。C.2.3 (Cauchy product) は C.2.2 と C.2.4 の両方が揃ってから (乗算結果の正規化で `simplify` を呼ぶ)。

---

# 10. 非ゴール

本 island では扱わない:

- **非可換多項式** — StrAlg cluster (Cluster C) の責務。`pw cell` の自由語表現で別実装。
- **Laurent 多項式 / 負冪** — 必要になれば `struct LaurentAlg{S}` を別 struct として提案のみ (本ドキュメントでは設計しない)。指数を `Int` から `Int` 負許容に変えるだけでは不変条件が壊れるため分離が正しい。
- **Groebner 基底** — 本 PJ スコープ外 (AbstractAlgebra.jl / Singular.jl に任せる判断)。
- **多項式除算 `mrdivide`** — MATLAB 側では `helpdiv` で実装されているが (PolAlg.m 133 行)、初版 Julia では pend (TBD-4、C.2 完了後に検討)。
- **`disp0`–`disp3` の多段表示** — Julia 側は `show(io, ::MIME, p)` 1 本化、MATLAB の多段 disp は移植しない。
- **`subs` / `sym` / `matrix`** — Symbolics.jl 経由で自然に得られるため個別 API 不要、`evaluate` に集約。

---

# TBD 一覧

- **TBD-1**: PolAlg の `SpaceSpec` 依存は本当に必要か (open_problems Q3 待ち)
- **TBD-2**: `simplify(; level)` の level 引数を導入するか (B' クラスタ決定待ち)
- **TBD-3**: `CanonicalPolAlg{S}` 別型化 (open_problems Q9 待ち、現状は述語方式を推奨)
- **TBD-4**: 多項式除算 `mrdivide` 相当の Julia 実装方針 (Phase C.2 完了後)
