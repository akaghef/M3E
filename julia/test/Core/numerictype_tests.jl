using Test

include(joinpath(@__DIR__, "..", "..", "src", "Core", "NumericType.jl"))
using .NumericTypes

@testset "NumericType" begin
    @test numerictype(Int)           == INT
    @test numerictype(Int64)         == INT
    @test numerictype(Rational{Int}) == RATIONAL
    @test numerictype(Float64)       == FLOAT
    @test numerictype(Float32)       == FLOAT
    @test numerictype(ComplexF64)    == COMPLEX
    @test numerictype(Complex{Int})  == COMPLEX
    @test numerictype(String)        == UNKNOWN

    # 値経由
    @test numerictype(3)    == INT
    @test numerictype(1.5)  == FLOAT
    @test numerictype(1//2) == RATIONAL
end
