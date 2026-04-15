using Test
using AkaghefAlgebra

@testset "SpaceSpec" begin
    @testset "constructor success" begin
        s = SpaceSpec(3; basis_labels = ["x", "y", "z"])
        @test dim(s) == 3
        @test basis_labels(s) == ["x", "y", "z"]
        @test grading(s) == zeros(Int, 3)

        s2 = SpaceSpec(2)
        @test dim(s2) == 2

        s3 = SpaceSpec(3; grading = [1, 0, 1])
        @test grading(s3) == [1, 0, 1]
    end

    @testset "invariant violations" begin
        @test_throws ArgumentError SpaceSpec(0)
        @test_throws ArgumentError SpaceSpec(-1)
        @test_throws ArgumentError SpaceSpec(3; basis_labels = ["x", "y"])
        @test_throws ArgumentError SpaceSpec(3; grading = [1, 0])
    end

    @testset "equality and hash" begin
        a = SpaceSpec(3; basis_labels = ["x", "y", "z"], grading = [1, 1, 0])
        b = SpaceSpec(3; basis_labels = ["x", "y", "z"], grading = [1, 1, 0])
        c = SpaceSpec(3; basis_labels = ["a", "b", "c"], grading = [1, 1, 0])
        @test a == b
        @test hash(a) == hash(b)
        @test a != c
    end

    @testset "default basis_labels" begin
        s = SpaceSpec(3)
        @test basis_labels(s) == ["e1", "e2", "e3"]
    end

    @testset "default grading" begin
        s = SpaceSpec(3)
        @test grading(s) == zeros(Int, 3)
        @test length(grading(s)) == 3
    end
end
