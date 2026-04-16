using Test
using AkaghefAlgebra

@testset "Hopf: Sweedler H_4" begin
    H = Sweedler(ComplexF64)
    r = verifyHopf(H)
    @test r.assoc
    @test r.coassoc
    @test r.alghom
    @test r.counit
    @test r.unit
    @test r.unit_scalar
    @test r.antipode
    @test r.all

    HD = HeisenbergDouble(H)
    @test verify_HD_associativity(HD)
    @test hd_pairing_nondeg(HD)
    @test hd_unit_ok(HD)
    @test verifyHopf(dualHopf(H)).all
end

@testset "Hopf: CyclicGroupAlg N=3, N=5" begin
    for N in (3, 5)
        H = CyclicGroupAlg(N, ComplexF64)
        r = verifyHopf(H)
        @test r.all
        @test r.unit
        @test r.unit_scalar
        HD = HeisenbergDouble(H)
        @test verify_HD_associativity(HD)
        @test hd_pairing_nondeg(HD)
        @test hd_unit_ok(HD)
        @test verifyHopf(dualHopf(H)).all
    end
end

@testset "Hopf: TaftAlg n=2, n=3" begin
    for n in (2, 3)
        H = TaftAlg(n)
        r = verifyHopf(H)
        @test r.all
        @test r.unit
        @test r.unit_scalar
        HD = HeisenbergDouble(H)
        @test verify_HD_associativity(HD)
        @test hd_pairing_nondeg(HD)
        @test hd_unit_ok(HD)
        @test verifyHopf(dualHopf(H)).all
    end
end
