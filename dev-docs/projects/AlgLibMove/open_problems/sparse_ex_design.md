---
project: AlgLibMove
topic: SparseEx (疎テンソル COO 構造) の Julia 側再実装方針
status: open problem (別セッションで決定)
created: 2026-04-15
related:
  - ../debt_register.md
  - ../investigations/three_system_inquiry.md
  - ../decisions/scalar_type_decision.md
---

# 問題設定

MATLAB `SparseEx` (`Core/tensor/SparseEx.m`, 410 行) は `key (N,R) / val (N,1) / size / zero`
の COO 形式疎テンソルに `Elem2NonzeroIndices` 関数フック・`convert/set_vkd`・VectAlg からの
透過委譲を載せた独自実装。Julia 移植時に
**`SparseArrays.SparseMatrixCSC` で足りるか、薄いラッパ struct が必要か、独自実装を残すか**を決める。

# 背景

- debt #6 (score 5.0)、波及 5/5。VectAlg cluster 全体の storage 層。
- ユーザーコメント (debt_register.md #6):
  > 6 は慎重さを要する。しかし、安定度高い部分なので、**メソッドパターンはそのまま流用できそうな気がする (反論くれ)**
- three_system_inquiry.md § 3: VectAlg/VectHomAlg/DualAlg/VectQuasiHopfAlg が SparseEx を
  composition で保持。`set.cf/get.cf` で透過委譲。
- MATLAB 版は rank R 任意 (2 次元でない一般テンソル)。`SparseMatrixCSC` は 2 次元のみ。

# 個別 Question

## Q1. メソッドパターンそのまま流用できるか

- **論点**: ユーザー主張「安定度高いのでメソッドパターン流用可」。反論の余地は。
- **現状の仮説**: **流用可能、ただし Julia idiom への写像は必要**。契約は保つが実装は
  Julia 標準 (`Base.getindex/setindex!`, `iterate`, `iszero`) に寄せる。
- **決定に必要な情報**: MATLAB 側メソッド 20+ の一覧と呼び出し頻度、流用 vs 書き換えの工数比較。

## Q2. `key/val/size/Nelem` フィールド構造の Julia 側対応

- **論点**: 選択肢 — (a) COO struct 自作、(b) `SparseArrays.SparseMatrixCSC` (2D 限定)、
  (c) `Dict{NTuple{R,Int}, S}`、(d) `NamedTuple` で裸データ、(e) `SparseArraysKit.jl` 類。
- **現状の仮説**: **(a) 薄い COO struct**。`struct SparseEx{S,R}; keys::Matrix{Int}; vals::Vector{S}; dims::NTuple{R,Int}; end`。
  rank R を型パラメータに持たせて型安定化。combineTerm は `sortperm + 重複検出`。
- **決定に必要な情報**: 既存呼び出しで必要な操作 (contraction, 外積, 同形変換) を Julia で
  どう表現するか、`TensorOperations.jl` との相互運用可否。

## Q3. `Elem2NonzeroIndices` 関数フックの Julia 表現

- **論点**: MATLAB では関数ハンドルを field に持つ。Julia では — traits? callable field? closure?
- **現状の仮説**: **callable field** (struct に関数を field として持ち、`(s::SparseEx)(i...)` で呼ぶ)
  または **type parameter + singleton dispatch**。どちらも zero-cost。
- **決定に必要な情報**: フックが実際に差し替えられる箇所の数 (多ければ trait、1 種なら callable)。

## Q4. 反論の観点 — メソッドパターン流用で問題が出そうな箇所

ユーザー「反論くれ」への応答として列挙:

- **scalar_type との関係**: scalar_type_decision.md Q1=D で `Alg{S<:Number}` パラメトリック化決定。
  SparseEx も `SparseEx{S}` にする必要があり、`val::Vector{Any}` 相当の MATLAB パターンは
  型不安定化する。→ パターンではなく「パラメトリック化した写し」が必要。
- **`iszero` 契約との関係**: MATLAB `removeZero(obj, isZero)` は関数ハンドルを受ける設計。
  Julia では `iszero(x)` (構造) と `isapprox(x, 0; atol)` (意味) を分離すべき
  (simplification_api.md Q5 で decided elsewhere)。API 形が変わる。
- **simplify パスでの再帰**: `combineTerm` が `sortrows + cumsum` で動くが Julia では
  `sortperm + groupby` idiom。構造は同じだが性能特性が違う可能性。
- **handle vs value 境界 (#21)**: MATLAB は value だが `set.cf` 副作用あり。Julia では
  `mutable struct` か `struct` + copy のどちらかを明示的に選ぶ必要。

→ 結論: **契約の流用は可、実装パターンは Julia 化で書き直し必須**。「そのまま」ではない。

## Q5. VectAlg からの透過委譲 API (`obj.cf`) の Julia 再現

- **論点**: MATLAB `set.cf/get.cf` で SparseEx ↔ dense 配列変換を隠蔽。Julia では?
- **現状の仮説**: **`Base.getproperty` / `Base.setproperty!` overload**。
  `getproperty(v::VectAlg, ::Val{:cf}) = tomatrix(v.sparse)`。
  `PropertyDicts.jl` 等は依存増えるので不採用。
- **決定に必要な情報**: `obj.cf` を in-place 書き換えする箇所があるか (あれば view 返す必要)。

# 決定に影響する制約

- scalar_type_decision.md Q1=D: `SparseEx{S}` パラメトリック化必須。
- simplification_api.md Q5 (decided elsewhere): `iszero` 構造/意味分離。
- three_system_inquiry.md § 3: VectAlg/VectHomAlg/DualAlg/VectQuasiHopfAlg 全てで使用。API 変更の波及大。
- calcTE (debt #7) のバックエンドとして `TensorOperations.jl` を使う場合、その array 型と整合。
- behavioral parity (#25): MATLAB 側テストが通ること。

# 非ゴール

- calcTE DSL パーサ (→ calc_te_test_suite.md)。
- VectAlg 本体の移植 (→ three_system_integration.md 後)。
- `SparseArrays.jl` エコシステム全般の調査。

# アウトプット期待形式

決定後、以下に反映:

- `decisions/sparse_ex_decision.md` (新規)
- `debt_register.md` #6 を「方針決定」に更新
- Phase C で `SparseEx{S,R}` struct 定義 + method set を docstring 付きで実装
- 流用したメソッドパターンと Julia 化で変えた箇所の対応表を debt_register に追記
