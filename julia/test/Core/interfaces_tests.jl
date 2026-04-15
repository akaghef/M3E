# interfaces_tests.jl — Phase D-3 contract tests for AdditiveTrait / CompareTrait

using Test
using AkaghefAlgebra

# テスト専用ダミー型
struct DummyInt
    x::Int
end

AkaghefAlgebra.additive_trait(::Type{DummyInt}) = IsAdditive()
Base.:+(a::DummyInt, b::DummyInt)  = DummyInt(a.x + b.x)
Base.:-(a::DummyInt, b::DummyInt)  = DummyInt(a.x - b.x)
Base.zero(::Type{DummyInt})        = DummyInt(0)
Base.iszero(a::DummyInt)           = a.x == 0
Base.:(==)(a::DummyInt, b::DummyInt) = a.x == b.x

@testset "Interfaces" begin
    @test additive_trait(DummyInt) === IsAdditive()
    @test additive_trait(String)   === NotAdditive()
    @test additive_trait(DummyInt(7)) === IsAdditive()

    @test compare_trait(Any)       === IsEquatable()
    @test compare_trait(DummyInt)  === IsEquatable()

    @test isapproxzero(1e-12)
    @test !isapproxzero(1.0)
    @test isapproxzero(0.0)

    @test isequiv(1, 1)
    @test !isequiv(1, 2)
    @test isequiv(NaN, NaN)                         # isequal default
    @test !isequiv(NaN, NaN; predicate=(==))        # == predicate

    AkaghefAlgebra.@test_additive_contract DummyInt [DummyInt(1), DummyInt(2), DummyInt(-3)]
end
