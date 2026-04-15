---
project: AlgLibMove
topic: IAdditive / ICompare interface の Julia 契約設計
status: 設計草案 (Phase C.1-b、実装前)
date: 2026-04-15
related:
  - debt_register.md #3
  - investigations/three_system_inquiry.md
  - investigations/simplification_api_inquiry.md
  - decisions/scalar_type_decision.md
---

# 1. 概要

MATLAB の `IAdditive` / `ICompare` は mixin interface で、契約が
**コメントと `methods(Abstract)` 列挙にしか無い**。`IAdditive` は
`plus/uminus` を abstract 宣言し `minus/uplus/sum` をデフォルト実装、
`ICompare` は `ge/eq` を abstract にして `gt/le/lt/ne` を派生する。
**公理 (結合律、可換律、反射律等) は一切記述されていない**。Julia 側で
これをどう表すかの 3 案:

| 案 | 実体 | 長所 | 短所 |
|---|---|---|---|
| A. 抽象型継承 `<: AbstractAdditive` | 1:1 の MATLAB 翻訳 | 馴染む | 単一継承、第三者型に後付け不可 |
| B. Holy traits (`additive_trait(::Type) = IsAdditive()`) | 型と契約を分離 | 第三者型に後付け可、多重契約可 | やや記法が冗長 |
| C. duck typing (`+`, `zero` が生えていれば OK) | 記述ゼロ | Julia idiom | 契約が型で検知できない |

**推奨は B (Holy traits)**。理由は (1) `Symbolics.Num` や `SparseArrays`
等の第三者型に後付けで準拠宣言できる、(2) `AdditiveTrait` と別軸の
`CompareTrait` を独立に付けられる、(3) scalar_type_decision の
`Alg{S<:Number}` 系と直交する。contract test をマクロで自動生成し、
docstring に公理を書く。

# 2. 設計原則

1. **契約は型で表現**。duck typing の「動いたら OK」を避け、CI で契約
   違反を検出できる状態にする。
2. **第三者型に後付け可能**。`additive_trait(::Type{MyType}) = IsAdditive()`
   を別モジュールから書けば外挿できる。
3. **docstring + contract test の二本立て**。数学的公理は docstring で
   宣言し、property-based test で機械検査する (verify_separation Q2)。
4. **抽象型は強制しない**。`AbstractAlgElement` は任意装飾として提供し、
   共通 utility (`show`, `display`) の dispatch だけに使う。

# 3. IAdditive 契約

## 3.1 意味

**加法アーベル群の公理**を満たす型:

- `(a+b)+c == a+(b+c)` (結合律)
- `a+b == b+a` (可換律、MATLAB `IAdditive` には明記されてないが
  全実装が可換 → 本プロジェクトでは可換性を契約に含める)
- `a + zero(T) == a` (単位元)
- `a + (-a) == zero(T)` (逆元)
- `iszero(zero(T)) == true`

## 3.2 trait 定義 (概念イメージ、実装は Phase C.1 で)

```julia
abstract type AdditiveTrait end
struct IsAdditive    <: AdditiveTrait end
struct NotAdditive   <: AdditiveTrait end

additive_trait(::Type)   = NotAdditive()
additive_trait(x)        = additive_trait(typeof(x))
```

## 3.3 必須メソッド

| メソッド | MATLAB 対応 | 備考 |
|---|---|---|
| `Base.:+(a, b)`   | `plus`   | 結合律・可換律 |
| `Base.:-(a)`      | `uminus` | 逆元 |
| `Base.:-(a, b)`   | `minus`  | `a + (-b)` (デフォルト実装で OK) |
| `Base.zero(::Type{T})` | (暗黙) | 単位元、`T` の構造に依存 |
| `Base.iszero(a)`  | (なし)   | 構造判定 (§4.2 参照) |

`sum`, `uplus` は Julia 標準で自動供給 (`Base.sum(::Any)` の fallback)。

## 3.4 既知の準拠型

- `Bases{S}`, `VectAlg{S}`, `StrAlg{S}`, `PolAlg{S}`, `SparseEx{S}`
- 第三者: `Number` 全般 (`Float64`, `Rational`, `Symbolics.Num`, ...)

## 3.5 contract (property) 不変条件

```julia
@test_contract IsAdditive Bases{Int} begin
    @property (a+b)+c == a+(b+c)
    @property a+b == b+a
    @property a + zero(T) == a
    @property a + (-a) == zero(T)
end
```

# 4. ICompare 契約

## 4.1 意味

MATLAB 版は `ge/eq` abstract + `gt/le/lt/ne` 派生。代数要素の
「等しさ」と「零判定」のためのインタフェース。実コードで
`ICompare` を継承するのは `SparseEx` のみで、そこでは `removeZero` の
`isZero::Function` 述語経由で **ユーザ供給の数値許容判定**を注入
している (simplification_api_inquiry § 1.1 SparseEx:248)。

## 4.2 Julia での分離: 構造判定 vs 意味判定

simplification_api Q5 の発見: `removeZero` の述語が
「構造零 (data 上の零)」と「意味零 (数値/記号許容判定)」を
**1 つの関数で混在して扱っている**。Julia では分離する:

| 判定種別 | API | 典型呼出 | 意味 |
|---|---|---|---|
| 構造判定 | `Base.iszero(x)` | `iszero(SparseEx{Int}(...))` | data が零元かを型メソッドで即答 |
| 意味判定 | `isapproxzero(x; atol)` | `isapproxzero(cf; atol=1e-10)` | 数値誤差許容 |
| 意味判定 (記号) | `issymbolically_zero(x)` | `simplify(x) == 0` | Symbolics の簡約経由 |
| 等価判定 | `Base.:==(a,b)` | 構造的 `==` | 構造判定 |
| 意味等価   | `isequiv(a, b; predicate)` | ユーザ供給述語 | SparseEx の `isZero::Function` に相当 |

この分離で SparseEx の `removeZero(obj, isZero)` は
`dropzeros(x; iszero=isapproxzero)` の形で Julia 慣用にそのまま乗る。

## 4.3 trait 定義

```julia
abstract type CompareTrait end
struct IsComparable    <: CompareTrait end
struct NotComparable   <: CompareTrait end
compare_trait(::Type) = NotComparable()
```

## 4.4 必須メソッド

- `Base.:(==)`, `Base.isequal`
- `Base.iszero`
- 任意: `Base.isless` (半順序を持つ型、`Bases` の index 比較等)

`ge/gt/le/lt/ne` は Julia の `Base.isless` + `==` から自動導出され、
MATLAB 側の「`gt = ge & ~eq` 手書き」は**不要**。

## 4.5 開いた前提条件

**Q (開)**: `removeZero` の戻り値型統一
(simplification_api_inquiry Q1) が本契約の前提。VectAlg 版は logical
mask を返すが、Julia では `dropzeros` が `T → T` を返すよう統一する。

# 5. trait と抽象型の選択

| 要素 | 採用 | 理由 |
|---|---|---|
| `AdditiveTrait` | Holy trait | 拡張性、第三者型への後付け |
| `CompareTrait`  | Holy trait | 同上 |
| `Bases/SparseEx/VectAlg/StrAlg/PolAlg` | 独立 `struct`、抽象型継承しない | 表現の独立性 (three_system_inquiry § 7) |
| `AbstractAlgElement` | 任意装飾、強制しない | `show`/`display` 共通化のみ |

scalar_type_decision で `Alg{S<:Number}` としたので、`S` 側の additive 性
(trait) と代数側の additive 性 (trait) は独立に宣言できる。

# 6. contract test framework

## 6.1 マクロ概念

```julia
@test_contract IsAdditive Bases{Int}
@test_contract IsAdditive SparseEx{Rational{Int}}
@test_contract IsComparable VectAlg{Float64}
```

マクロは trait 名から property set を引いて、`Random` で生成した
サンプル 3 点を使い結合律/可換律/単位元/逆元を `@test` で検査する。

## 6.2 サンプル生成ポリシー

- 数値パスは `rand(S, ...)`、記号パスは `Symbolics.@variables` で
  パラメータ化 (`@test` では `isequal(simplify(lhs - rhs), 0)`)
- **Kahan 和は使わない**。exact 型 (`Rational`, `Int`) で
  property を検査し、浮動小数点は `isapprox` で別テスト
- parity_framework.md (MATLAB 出力との数値一致 harness) と同じ
  サンプル生成器を共有し、contract test と parity test が
  同じ seed で走れるようにする

## 6.3 失敗時のレポート

反例 `(a, b, c)` を `show` で出力。trait 名 + 型名 + 破れた property 名
を 1 行目に出し、CI ログから grep できる形式に統一。

# 7. 違反時の診断

| 症状 | 検出点 | 挙動 |
|---|---|---|
| trait 宣言あり、メソッド未実装 | 最初の `+`/`zero` 呼び出し | `MethodError` (Julia 標準) |
| メソッド実装あり、trait 未宣言 | contract test が走らない | CI で「trait 宣言漏れ」警告を出すメタテストを用意 |
| 不変条件違反 (結合律破れ等) | `@test_contract` | `Test.@test` 失敗、CI で赤 |
| Q5 の iszero 二分法違反 | `dropzeros` の結果が非零を含む | contract test の property として追加 |

# 8. 関連 open_problems との連動

| 源泉 | 項 | 本契約での扱い |
|---|---|---|
| sparse_ex_design Q3 | `Elem2NonzeroIndices` フック | `nonzero_indices(x)` を `IsAdditive` の optional メソッドとして trait で宣言、`SparseEx` のみ実装 |
| simplification_api Q1 | `removeZero` 戻り値型統一 | 本契約の前提、`dropzeros(x)::T` に統一 (§4.5) |
| simplification_api Q5 | `iszero` 構造/意味分離 | §4.2 で採用、`Base.iszero` + `isapproxzero` |
| simplification_api Q4 | VectAlg.calc 空スタブ | `simplify(::VectAlg) = identity` を trait の "no-op 準拠" として許容 |
| verify_separation Q2 | 契約 vs テストの線引き | docstring = 不変条件宣言、contract test = 機械検査、parity test = 数値一致。本 doc で 3 者の責務表を固定 |
| three_system_inquiry § 7 | 3 系統共通基底 | `AdditiveTrait` が唯一の共通契約、抽象型継承は採らない |

# 9. Stage 対応

- **Phase C.1** (本 doc の次): `AdditiveTrait` / `CompareTrait` マクロ
  + `@test_contract` 骨格を `src/Common/Traits.jl` と
  `test/contract/` に実装
- **Phase C.2-**: 各 module (Bases, PolAlg, SparseEx, VectAlg, StrAlg)
  が module top で `additive_trait(::Type{T}) = IsAdditive()` を宣言し、
  `test/contract/<module>.jl` に `@test_contract` を追記
- **Phase C.3**: parity_framework と contract test の seed 共有
- **Phase C.4 以降**: Hopf/QuasiHopf 構造 trait を別ファイルで追加

# 10. 非ゴール

- **Traits.jl / SimpleTraits.jl の採否**: 本 doc では「Holy traits の
  概念」に留める。マクロ糖衣は実装段階で Traits.jl に乗せるか自前で
  書くか決める (実装コスト比較後)
- **`AdditiveTrait` 以外の代数構造 trait** (`HopfTrait`,
  `QuasiHopfTrait`, `BialgebraTrait` 等) は Phase C.4 で別 doc
- **`ISpaceSpec` / `IAlg` の trait 化**: 本 doc の対象外。
  three_system_inquiry open Q2 (IAlg の位置付け) が決着した後
- **記号零判定の完全性**: `issymbolically_zero` は
  `Symbolics.simplify` の能力に依存、完全判定不能な場合あり。
  contract には含めず best-effort とする
