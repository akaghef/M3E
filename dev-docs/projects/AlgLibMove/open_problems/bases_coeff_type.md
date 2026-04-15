---
project: AlgLibMove
topic: Bases クラスの係数型パラメトリック化の具体化 (scalar_type_decision の具現化)
status: open problem (別セッションで決定)
created: 2026-04-15
related:
  - ../decisions/scalar_type_decision.md
  - ../debt_register.md
---

# 問題設定

MATLAB 側 `bases.m` は係数型を切り替える設計が苦しく、全て `sym` にするとパフォーマンス悪化、
整数/複素数/symbolic を混在させる手段が貧弱 (debt #16)。
Julia 移植時に **`Bases{S}` として係数型をパラメトリック化する具体的設計**を決める。

**注意**: scalar_type_decision.md で **Q1=D (パラメトリック `Alg{S<:Number}`)** / **Q2=A (Symbolics.jl)**
は決定済。本ファイルはその**具体化**として位置づけ、scalar_type_decision と矛盾しないこと。

# 背景

- debt #16 (score 4.0)、phase C、方針済。
- ユーザーコメント (debt_register.md #16):
  > **全部 sym だとパフォ悪化**する。ときに、整数、複素数、symbolic と係数は色々変わる可能性がある。
  > 基底のクラス `bases.m` はそこの部分の設計が苦しい。**インスタンス宣言時に係数型を決める設計**が
  > いいかも。デフォの係数型も決めて、入力インターフェースがすっきりすることを心がける。
- scalar_type_decision.md 推奨: `Alg{S<:Number}`、`promote_type(Float64, Num) = Num` で
  記号昇格自動。

# 個別 Question

## Q1. `Bases{S}` の型シグネチャとデフォルト S

- **論点**: `S` に課す制約 (`<:Number` か `<:Any` か)、デフォルト型。
  候補: `Int / Float64 / Rational{Int} / ComplexF64 / Num`。
- **現状の仮説**: `Bases{S<:Number}`、**デフォルト `S = Rational{Int}`** (整数係数の
  厳密計算がユーザーのユースケースに合う、Float の丸め誤差なし)。記号が必要なときは `Num` を明示。
- **決定に必要な情報**: Examples 配下での係数型の実頻度、パフォーマンス要件 (Rational は
  Float64 より遅い)、ユーザーの「デフォがどうあるべきか」の好み。

## Q2. 入力 API (コンストラクタ) を型推論で簡潔にする戦略

- **論点**: `Bases([1, 2, 3])` でデフォ型使用か、`Bases{Float64}([1, 2, 3])` で明示か、両方か。
- **現状の仮説**: **両方サポート**:
  - `Bases(data)` は `eltype(data)` から S を推論 (`Bases{eltype(data)}(data)`)。
  - `Bases{S}(data)` は明示指定、必要なら `convert(S, x)` で変換。
  - ユーザーが「すっきり」を求めたので、`Bases([1,2,3])` が `Bases{Int}` になるのが自然。
  デフォは推論なし時のみ適用 (例: `Bases()` 空構築、`Bases{}(data)` のような空パラ)。
- **決定に必要な情報**: 既存 MATLAB 側の Bases コンストラクタ呼び出しパターン、空構築の頻度。

## Q3. `bases.m` の「設計が苦しい」箇所の具体化

- **論点**: ユーザー曰く「設計が苦しい」。具体的に MATLAB `bases.m` のどこか。
- **現状の仮説**: 推測 — 以下が苦しさの候補:
  - (a) 係数型が runtime flag (`ctype::NumericType`) で管理、method dispatch できない。
  - (b) sym 係数と数値係数で storage が分かれず、常に sym cast で性能劣化。
  - (c) 異種係数間の演算で `InferiorClasses=?sym` 宣言が必要。
  - (d) コンストラクタで「型を先に決めて data を入れる」API が書きにくい。
- **決定に必要な情報**: `bases.m` 実コード読解 (未実施)、苦しかった記憶の具体例をユーザーに確認。

## Q4. 異種係数型間の変換 API

- **論点**: `convert(Bases{ComplexF64}, bases_int)` 的な明示変換をどう提供するか。
- **現状の仮説**: Julia 標準 `Base.convert` と `Base.promote_rule` を extend:
  ```julia
  Base.convert(::Type{Bases{T}}, b::Bases{S}) where {T,S} = Bases{T}(convert.(T, b.data))
  Base.promote_rule(::Type{Bases{A}}, ::Type{Bases{B}}) where {A,B} = Bases{promote_type(A,B)}
  ```
  異種 `+`/`*` は自動 promote。
- **決定に必要な情報**: 代数演算で異種型が混ざる典型シナリオ (記号 × 数値)、promote 先の慣習。

## Q5. scalar_type_decision との整合

- **論点**: Q1=D (`Alg{S<:Number}`) / Q2=A (Symbolics.jl) / Q3 (promote 昇格) が Bases でどう具現化するか。
- **現状の仮説**:
  - `Bases{S}` は `Alg{S}` の sub-component。`Alg{S}` の構築時に `Bases{S}` を要求。
  - 記号 × 数値: `Bases{Num}` と `Bases{Float64}` の演算は `promote_type(Float64, Num) = Num` で
    `Bases{Num}` へ自動昇格。
  - `iszero(b::Bases{S})` は `all(iszero, b.data)` で構造判定 (Q4 契約)。
- **決定に必要な情報**: `Alg{S}` ↔ `Bases{S}` の型パラメータ伝播ルール、ネスト型 (`Bases{Bases{S}}`?) の
  可否。

# 決定に影響する制約

- scalar_type_decision.md Q1=D/Q2=A と矛盾しないこと (本ファイルはその具現化)。
- sparse_ex_design.md の `SparseEx{S}` と係数型パラメータを揃えること。
- behavioral parity (#25): 既存 Bases 使用箇所が Julia でも動くこと。
- 「入力インターフェースがすっきり」(ユーザー要望) — 型注釈の冗長さを避ける。
- ネスト代数 (`Alg{Bases{S}}` のような) を誤って作らない — `S<:Number` 制約で排除。

# 非ゴール

- 非 Number 係数型 (群環の group element 係数等) — 範囲外、trait で将来対応。
- `StaticArrays.SVector` 採用の判断 — 別論点。
- 構造定数計算 (debt #5) — sparse_ex_design と別案件。

# アウトプット期待形式

決定後、以下に反映:

- `decisions/bases_coeff_decision.md` (新規、scalar_type_decision の appendix 扱い)
- `debt_register.md` #16 を「方針決定」に更新
- Phase C 冒頭で `Bases{S}` struct 定義 + コンストラクタ + convert/promote を実装
- `scalar_type_decision.md` に本決定へのリンクを追記 (相互参照)
