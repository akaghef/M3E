# Interfaces.jl — Holy traits for AlgLibMove Core
#
# Phase D-3: AdditiveTrait / CompareTrait と意味判定ユーティリティ。
# 契約テスト用マクロ `@test_additive_contract` も提供する。

# ---------------------------------------------------------------------------
# AdditiveTrait
# ---------------------------------------------------------------------------

abstract type AdditiveTrait end
struct IsAdditive  <: AdditiveTrait end
struct NotAdditive <: AdditiveTrait end

"""
    additive_trait(T) -> AdditiveTrait

型 `T` が加法構造 (`+`, `-`, `zero`, `iszero`) を持つかを表す Holy trait。
デフォルトは `NotAdditive()`。ユーザーは以下のように宣言する:

    additive_trait(::Type{MyType}) = IsAdditive()

具体型の側で `+`, `-`, `zero`, `iszero` を実装する責務を負う
(このファイルではデフォルト実装を提供しない)。
"""
additive_trait(::Type) = NotAdditive()
additive_trait(x)      = additive_trait(typeof(x))

# ---------------------------------------------------------------------------
# CompareTrait
# ---------------------------------------------------------------------------

abstract type CompareTrait end
struct IsEquatable  <: CompareTrait end  # ==, hash
struct IsComparable <: CompareTrait end  # 上記 + isless

"""
    compare_trait(T) -> CompareTrait

Julia の全型は `==` を持つため、デフォルトは `IsEquatable()`。
全順序を持つ型は `compare_trait(::Type{MyType}) = IsComparable()` を宣言する。
"""
compare_trait(::Type) = IsEquatable()
compare_trait(x)      = compare_trait(typeof(x))

# ---------------------------------------------------------------------------
# 意味判定 utility (removeZero の 3 分割に対応)
# ---------------------------------------------------------------------------

"""
    isapproxzero(x; atol=0, rtol=...) -> Bool

`x` が数値的にゼロに近いかを判定 (`iszero` より緩い)。
デフォルト `rtol` は `sqrt(eps(float(real(one(x)))))`。
"""
isapproxzero(x; atol=sqrt(eps(float(real(one(x))))),
             rtol=0) =
    isapprox(x, zero(x); atol=atol, rtol=rtol)

"""
    isequiv(x, y; predicate=isequal) -> Bool

任意の等価判定。デフォルトは `isequal` (NaN, -0.0 を厳密に扱う)。
用途に応じて `predicate===` や独自関数を差し込む。
"""
isequiv(x, y; predicate=isequal) = predicate(x, y)

# ---------------------------------------------------------------------------
# Contract test macro
# ---------------------------------------------------------------------------

"""
    @test_additive_contract T sample_elements

`additive_trait(T) == IsAdditive()`、加法単位元、逆元、可換律、結合律を
`sample_elements` (Vector) に対して検証する。呼び出し側で `using Test` 済み
であることを前提とする。
"""
macro test_additive_contract(T, samples)
    esc(quote
        @testset "AdditiveContract: $($T)" begin
            @test AkaghefAlgebra.additive_trait($T) == AkaghefAlgebra.IsAdditive()
            local elems = $samples
            local z = zero(typeof(first(elems)))
            for a in elems
                @test a + z == a
                @test z + a == a
                @test iszero(a - a)
            end
            for a in elems, b in elems
                @test (a + b) == (b + a)
            end
            for a in elems, b in elems, c in elems
                @test (a + b) + c == a + (b + c)
            end
        end
    end)
end
