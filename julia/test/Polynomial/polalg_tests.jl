# PolAlg tests — Phase D-4
using Test
using Random
using AkaghefAlgebra
using AkaghefAlgebra.SpaceSpecs: SpaceSpec
using AkaghefAlgebra.PolAlgs: PolAlg, polalg, simplify, iscanonical, evaluate,
                              nterms, nvars, coefficients, monomials

# 2 変数 x, y 用 SpaceSpec
const SP2 = SpaceSpec(2; basis_labels = ["x", "y"])
x(c=1)  = polalg(SP2, [1, 0] => c)
y(c=1)  = polalg(SP2, [0, 1] => c)

"ランダム PolAlg (最大 n 項、指数 0..2、係数 -3..3、0 除外)"
function random_polalg(rng; maxterms = 5)
    nt = rand(rng, 1:maxterms)
    pairs = Pair{Vector{Int},Int}[]
    for _ in 1:nt
        e = [rand(rng, 0:2), rand(rng, 0:2)]
        c = rand(rng, vcat(-3:-1, 1:3))
        push!(pairs, e => c)
    end
    return polalg(SP2, pairs...)
end

@testset "PolAlg" begin

    @testset "constructor invariants" begin
        p = polalg(SP2, [2, 0] => 1, [0, 2] => 1)
        @test nterms(p) == 2
        @test nvars(p) == 2

        # exps 列数 ≠ coeffs 長
        @test_throws ArgumentError PolAlg{Int}(zeros(Int, 2, 3), [1, 2], SP2)
        # exps 行数 ≠ dim
        @test_throws ArgumentError PolAlg{Int}(zeros(Int, 3, 1), [1], SP2)
        # 負の指数
        @test_throws ArgumentError PolAlg{Int}(reshape([-1, 0], 2, 1), [1], SP2)
        # polalg 経由でのペア長不一致
        @test_throws ArgumentError polalg(SP2, [1, 0, 0] => 1)
    end

    @testset "factory and accessors" begin
        # x^2 + 2xy + y^2 = (x+y)^2
        p = polalg(SP2, [2, 0] => 1, [1, 1] => 2, [0, 2] => 1)
        @test nterms(p) == 3
        @test iscanonical(p)
        q = (x() + y())^2
        @test p == q
    end

    @testset "addition / subtraction / unary minus" begin
        @test (x() + y()) + (x() - y()) == polalg(SP2, [1, 0] => 2)
        @test x() - x() == zero(x())
        @test iszero(x() - x())
        p = x() + y()
        @test -p == polalg(SP2, [1, 0] => -1, [0, 1] => -1)
        @test +p == p
    end

    @testset "scalar multiplication" begin
        @test 3 * (x() + y()) == polalg(SP2, [1, 0] => 3, [0, 1] => 3)
        @test (x() + y()) * 3 == 3 * (x() + y())
        @test 0 * (x() + y()) == zero(x())
    end

    @testset "polynomial multiplication" begin
        # (x+y)(x-y) = x^2 - y^2
        @test (x() + y()) * (x() - y()) == polalg(SP2, [2, 0] => 1, [0, 2] => -1)
        # zero 吸収
        @test x() * zero(x()) == zero(x())
    end

    @testset "power" begin
        @test x()^0 == one(x())
        @test x()^3 == polalg(SP2, [3, 0] => 1)
        p = x() + y()
        @test p^2 == p * p
        @test p^3 == p * p * p
        @test_throws ArgumentError x()^(-1)
    end

    @testset "property: commutative / associative / distributive" begin
        rng = MersenneTwister(42)
        for _ in 1:10
            p = random_polalg(rng)
            q = random_polalg(rng)
            r = random_polalg(rng)
            @test p * q == q * p              # 可換律
            @test (p * q) * r == p * (q * r)  # 結合律
            @test p * (q + r) == p * q + p * r  # 分配律
            @test p + q == q + p              # 加法可換
        end
    end

    @testset "simplify idempotence and iscanonical" begin
        p = polalg(SP2, [1, 0] => 1, [1, 0] => 2, [0, 1] => -1, [0, 1] => 1)
        s = simplify(p)
        @test s == simplify(s)
        @test iscanonical(s)
        @test nterms(s) == 1  # x 項のみ残る
        @test coefficients(s) == [3]
    end

    @testset "zero / iszero" begin
        z = zero(x())
        @test iszero(z)
        @test nterms(z) == 0
        @test x() + z == x()
    end

    @testset "evaluate" begin
        # x^2 + y at (2, 3) = 4 + 3 = 7
        p = polalg(SP2, [2, 0] => 1, [0, 1] => 1)
        @test evaluate(p, [2, 3]) == 7
        @test evaluate(zero(x()), [1, 1]) == 0
        @test_throws DimensionMismatch evaluate(p, [1])
    end

    @testset "additive contract" begin
        samples = [x(), y(), x() + y(), 2 * x() - y(), zero(x())]
        @test AkaghefAlgebra.additive_trait(PolAlg{Int}) == AkaghefAlgebra.IsAdditive()
        z = zero(samples[1])
        for a in samples
            @test a + z == a
            @test iszero(a - a)
        end
    end
end
