# SparseEx parity & property tests.
# Every group states its MATLAB source-of-truth (method name and semantics)
# and the math invariant being checked.

using Test
using LinearAlgebra
using AkaghefAlgebra

const Sp = AkaghefAlgebra.Sparse

# Helper: materialise both, compare.
dense_eq(A, B; tol=0) = tol == 0 ? to_array(A) == B : isapprox(to_array(A), B; atol=tol)

@testset "SparseEx: construction & round-trip (convert / toMatrix)" begin
    # 1D vector, 2D matrix, 3D tensor, scalar, zero array, empty-support array
    @testset "scalar" begin
        s = from_array(7.0)
        @test nelem(s) == 1
        @test rank_of(s) == 0
        @test to_array(s) == 7.0
        @test Sp.is_scalar(s)
    end

    @testset "vector round-trip" begin
        v = [1.0, 0.0, 2.0, 0.0, 3.0]
        S = from_array(v)
        @test rank_of(S) == 1
        @test S.size == [5]
        @test nelem(S) == 3
        @test to_array(S) == v
    end

    @testset "matrix round-trip" begin
        A = [1.0 0.0 2.0;
             0.0 3.0 0.0;
             4.0 0.0 5.0]
        S = from_array(A)
        @test rank_of(S) == 2
        @test S.size == [3, 3]
        @test nelem(S) == 5
        @test to_array(S) == A
    end

    @testset "rank-3 tensor round-trip" begin
        T = zeros(2, 3, 4)
        T[1, 2, 3] = 5.0
        T[2, 1, 1] = -1.5
        T[2, 3, 4] = 7.0
        S = from_array(T)
        @test S.size == [2, 3, 4]
        @test nelem(S) == 3
        @test to_array(S) == T
    end

    @testset "zero / empty support" begin
        A = zeros(3, 3)
        S = from_array(A)
        @test nelem(S) == 0
        @test to_array(S) == A
    end

    @testset "integer and complex element types" begin
        Ai = [0 1; 2 0]
        Si = from_array(Ai)
        @test eltype(Si.val) == Int
        @test to_array(Si) == Ai

        Ac = [1.0+0im 0; 0 2-im]
        Sc = from_array(Ac)
        @test eltype(Sc.val) == ComplexF64
        @test to_array(Sc) == Ac
    end

    @testset "column-major key layout (MATLAB parity)" begin
        # Single entry at (2,3) in a 3×4 matrix — MATLAB sub2ind([3,4],2,3) = 8.
        # Julia LinearIndices is also column-major: lin[2,3] should be 8.
        A = zeros(3, 4); A[2, 3] = 9.0
        S = from_array(A)
        @test S.key == [2 3]
        @test S.val == [9.0]
        @test LinearIndices(A)[2, 3] == 8
    end
end

@testset "SparseEx: canonicalize / combine_terms / remove_zero" begin
    # Hand-built SparseEx with duplicate keys.
    key = [1 1; 1 1; 2 2; 1 2; 2 2]
    val = [1.0, 2.0, 3.0, 0.0, -3.0]
    A = SparseEx([3, 3], key, val)

    B = combine_terms(A)
    # (1,1) collapses 1+2=3; (2,2) collapses 3+(-3)=0; (1,2) stays at 0
    @test to_array(B) == [3.0 0.0 0.0;
                          0.0 0.0 0.0;
                          0.0 0.0 0.0]

    C = canonicalize(A)
    @test nelem(C) == 1         # only (1,1)=3 survives
    @test to_array(C) == to_array(B)

    # remove_zero with custom predicate (approximate)
    approx_zero = x -> abs(x) < 1e-8
    key2 = [1 1; 2 2]
    val2 = [1.0, 1e-10]
    D = SparseEx([2, 2], key2, val2)
    D2 = remove_zero(D; iszero=approx_zero)
    @test nelem(D2) == 1
    @test to_array(D2)[1, 1] == 1.0
end

@testset "SparseEx: arithmetic (+ / - / uminus / scalar *)" begin
    A = [1.0 0; 0 2.0]
    B = [0.0 3; 4 0]
    SA, SB = from_array(A), from_array(B)

    @test to_array(SA + SB) == A + B
    @test to_array(SA - SB) == A - B
    @test to_array(-SA) == -A
    @test to_array(2.5 * SA) == 2.5 * A
    @test to_array(SA * 2) == 2 * A

    # Associativity, commutativity
    C = from_array([5.0 0; 0 -1])
    @test to_array((SA + SB) + C) == to_array(SA + (SB + C))
    @test to_array(SA + SB) == to_array(SB + SA)

    # Distributivity over scalar
    @test to_array(3 * (SA + SB)) == 3 * (A + B)

    # Additive identity
    Z = from_array(zeros(2, 2))
    @test to_array(SA + Z) == A

    # Additive inverse
    @test to_array(SA + (-SA)) == zeros(2, 2)
end

@testset "SparseEx: matmul / matpow" begin
    A = [1.0 2; 3 4]
    B = [0.0 1; -1 2]
    SA, SB = from_array(A), from_array(B)
    @test to_array(matmul(SA, SB)) ≈ A * B
    @test to_array(matmul(SB, SA)) ≈ B * A      # non-commuting

    # scalar × tensor via matmul
    s = from_array(3.0)
    @test to_array(matmul(s, SA)) ≈ 3.0 * A
    @test to_array(matmul(SA, s)) ≈ A * 3.0

    # matpow: 0, 1, positive, negative, large
    I2 = from_array(Matrix{Float64}(I, 2, 2))
    @test to_array(matpow(SA, 0)) ≈ I(2)
    @test to_array(matpow(SA, 1)) ≈ A
    @test to_array(matpow(SA, 2)) ≈ A^2
    @test to_array(matpow(SA, 5)) ≈ A^5
    @test to_array(matpow(SA, -1)) ≈ inv(A)
    @test to_array(matpow(SA, -2)) ≈ inv(A)^2

    # scalar matpow
    @test to_array(matpow(from_array(3.0), 4)) ≈ 81.0

    # Non-integer fractional power (dense fallback)
    P = [4.0 0; 0 9.0]
    @test to_array(matpow(from_array(P), 0.5)) ≈ sqrt(P)
end

@testset "SparseEx: permute" begin
    T = reshape(collect(1.0:24.0), 2, 3, 4)
    S = from_array(T)
    Sp_perm = sparse_permute(S, [3, 1, 2])
    @test to_array(Sp_perm) == permutedims(T, [3, 1, 2])

    # Round-trip identity permutation
    @test to_array(sparse_permute(S, [1, 2, 3])) == T

    # Inverse permutation property: permute(permute(S, σ), σ⁻¹) == S
    σ = [2, 3, 1]
    σ_inv = invperm(σ)
    @test to_array(sparse_permute(sparse_permute(S, σ), σ_inv)) == T

    # Scalar is invariant
    @test to_array(sparse_permute(from_array(5.0), Int[])) == 5.0
end

@testset "SparseEx: transpose / ctranspose" begin
    A = [1.0 2 3; 4 5 6]
    SA = from_array(A)
    @test to_array(sparse_transpose(SA)) == A'

    # Vector → row matrix (MATLAB convention)
    v = [1.0, 0.0, 2.0]
    Sv = from_array(v)
    Svt = sparse_transpose(Sv)
    @test Svt.size == [1, 3]
    @test to_array(Svt) == reshape(v, 1, 3)

    # Complex conjugate transpose
    Ac = [1.0+im  2.0;
          3.0   4-2im]
    SAc = from_array(Ac)
    @test to_array(sparse_ctranspose(SAc)) == Ac'

    # Involutivity: (A')' == A
    @test to_array(sparse_transpose(sparse_transpose(SA))) == A
end

@testset "SparseEx: reshape" begin
    A = reshape(collect(1.0:12.0), 3, 4)
    S = from_array(A)

    # 3×4 → 2×6
    R = sparse_reshape(S, [2, 6])
    @test to_array(R) == reshape(A, 2, 6)

    # 3×4 → 12×1 (vector) — MATLAB stores as rank-2; here as rank-2 with trailing 1
    R2 = sparse_reshape(S, [12, 1])
    @test to_array(R2) == reshape(A, 12, 1)

    # Inferred dim (use -1 as placeholder for NaN)
    R3 = sparse_reshape(S, [-1, 3])
    @test size(to_array(R3)) == (4, 3)
    @test to_array(R3) == reshape(A, 4, 3)

    # Rank-3 → rank-2
    T = reshape(collect(1.0:24.0), 2, 3, 4)
    ST = from_array(T)
    R4 = sparse_reshape(ST, [6, 4])
    @test to_array(R4) == reshape(T, 6, 4)

    # Error on total-size mismatch
    @test_throws AssertionError sparse_reshape(S, [5, 5])
end

@testset "SparseEx: tensorprod (outer & contracted)" begin
    u = [1.0, 2.0]
    v = [3.0, 4.0, 5.0]
    Su, Sv = from_array(u), from_array(v)

    # Outer: no contraction → u[i] * v[j] matrix
    T = tensorprod(Su, Sv)
    @test T.size == [2, 3]
    @test to_array(T) == u * v'

    # Contract single axis — vector · vector → scalar
    v2 = [5.0, 6.0]
    Sv2 = from_array(v2)
    s = tensorprod(Su, Sv2; contract_a=[1], contract_b=[1])
    @test Sp.is_scalar(s)
    @test to_array(s) == dot(u, v2)

    # Matrix × matrix via tensorprod contraction == matmul
    A = [1.0 2; 3 4]; B = [5.0 6; 7 8]
    SA, SB = from_array(A), from_array(B)
    P = tensorprod(SA, SB; contract_a=[2], contract_b=[1])
    @test to_array(P) ≈ A * B

    # Rank-3 contraction
    T1 = reshape(collect(1.0:24.0), 2, 3, 4)
    T2 = reshape(collect(1.0:12.0), 4, 3)
    # contract T1's 3rd axis (dim 4) with T2's 1st axis (dim 4) →  output (2, 3, 3)
    ST1, ST2 = from_array(T1), from_array(T2)
    R = tensorprod(ST1, ST2; contract_a=[3], contract_b=[1])
    @test R.size == [2, 3, 3]
    # dense equivalent
    expected = zeros(2, 3, 3)
    for i in 1:2, j in 1:3, k in 1:3
        expected[i, j, k] = sum(T1[i, j, ℓ] * T2[ℓ, k] for ℓ in 1:4)
    end
    @test to_array(R) ≈ expected

    # Full contraction of rank-2 with rank-2 → scalar (trace-like)
    M = [1.0 2; 3 4]
    SM = from_array(M)
    trace_val = tensorprod(SM, from_array(Matrix{Float64}(I, 2, 2));
                           contract_a=[1,2], contract_b=[1,2])
    @test to_array(trace_val) ≈ tr(M)

    # Size mismatch on contracted dim — SA is 2×2, bad is 2×3: try to contract a dim of size 2 with a dim of size 3
    bad = from_array([1.0 2; 3 4; 5 6])     # 3×2, so contracted dims 2 and 3 mismatch
    @test_throws AssertionError tensorprod(SA, bad; contract_a=[1], contract_b=[1])

    # Scalar * tensor via tensorprod short-circuit
    ss = from_array(2.5)
    @test to_array(tensorprod(ss, SA)) ≈ 2.5 * A
    @test to_array(tensorprod(SA, ss)) ≈ 2.5 * A
end

@testset "SparseEx: equality and isapprox" begin
    A = [1.0 0; 0 2.0]
    @test from_array(A) == from_array(A)

    # Different representations of same tensor (duplicate keys)
    dup_key = [1 1; 1 1; 2 2]
    dup_val = [0.5, 0.5, 2.0]
    S_dup = SparseEx([2, 2], dup_key, dup_val)
    @test S_dup == from_array(A)

    # isapprox with tol
    Aδ = A .+ 1e-12
    @test sparse_isapprox(from_array(A), from_array(Aδ); atol=1e-10)
    @test !sparse_isapprox(from_array(A), from_array(A .+ 0.1); atol=1e-6)

    # Size mismatch → false
    @test !sparse_isapprox(from_array([1.0, 2.0]), from_array([1.0 2.0]); atol=1e-10)
end

@testset "SparseEx: algebraic properties (larger random patterns)" begin
    using Random
    rng = MersenneTwister(20260416)

    # For 10 random sparse pairs of 4×5 matrices, verify + / - / matmul / tensorprod
    for trial in 1:10
        A = zeros(4, 5); B = zeros(4, 5)
        for _ in 1:6
            A[rand(rng, 1:4), rand(rng, 1:5)] = randn(rng)
            B[rand(rng, 1:4), rand(rng, 1:5)] = randn(rng)
        end
        SA, SB = from_array(A), from_array(B)
        @test to_array(SA + SB) ≈ A + B
        @test to_array(SA - SB) ≈ A - B
        @test to_array(-SA) ≈ -A
        # outer product → 4×5×4×5
        T = tensorprod(SA, SB)
        @test T.size == [4, 5, 4, 5]
        # spot-check a few entries
        for (i, j, k, l) in ((1,1,1,1), (2,3,4,5), (4,5,2,2))
            @test to_array(T)[i, j, k, l] ≈ A[i, j] * B[k, l]
        end
    end

    # Square-matrix power law: A^(m+n) == A^m · A^n
    for trial in 1:5
        M = zeros(3, 3)
        for _ in 1:4
            M[rand(rng, 1:3), rand(rng, 1:3)] = randn(rng)
        end
        SM = from_array(M)
        for (m, n) in ((1,1),(2,3),(0,4),(3,0),(2,2))
            @test to_array(matpow(SM, m+n)) ≈
                  to_array(matmul(matpow(SM, m), matpow(SM, n))) atol=1e-8
        end
    end

    # tensorprod associativity (outer): (A ⊗ B) ⊗ C == A ⊗ (B ⊗ C)
    A = from_array([1.0, 2.0])
    B = from_array([3.0, 4.0, 5.0])
    C = from_array([6.0, 7.0])
    lhs = tensorprod(tensorprod(A, B), C)
    rhs = tensorprod(A, tensorprod(B, C))
    @test to_array(lhs) == to_array(rhs)
end

@testset "SparseEx: MATLAB convention spot-checks" begin
    # Column-major linear indexing example from MATLAB docs:
    #   A = [1 4 7; 2 5 8; 3 6 9];  A(5) == 5  (col-major).
    A = [1 4 7; 2 5 8; 3 6 9]
    @test A[5] == 5                             # Julia is col-major too
    S = from_array(A)
    # value at linear index 5 ↔ (row,col) = (2,2)
    row = findfirst(i -> S.key[i,:] == [2,2], 1:nelem(S))
    @test S.val[row] == 5

    # reshape column-major parity: reshape(1:12, [3,4]) columns are 1..3, 4..6, …
    R = reshape(collect(1:12), 3, 4)
    @test R[:, 1] == [1,2,3]
    SR = from_array(Float64.(R))
    SR2 = sparse_reshape(SR, [4, 3])
    @test to_array(SR2) == Float64.(reshape(R, 4, 3))

    # permute parity: permutedims with σ reorders size accordingly
    T3 = reshape(1.0:60.0, 3, 4, 5)
    ST3 = from_array(collect(T3))
    for σ in ([1,2,3], [2,1,3], [3,2,1], [2,3,1])
        @test to_array(sparse_permute(ST3, σ)) == permutedims(collect(T3), σ)
    end
end
