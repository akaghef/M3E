# HeisenbergDouble.jl — Heisenberg double HD(H) = H* # H as vector space,
# with multiplication  (f ⊗ h)(g ⊗ k) = Σ  f·(h_{(1)} ▶ g)  ⊗  h_{(2)} · k
# where (h ▶ g)(x) := g(x h),   x,h ∈ H,  g ∈ H*.
# In dual-basis coordinates: (h ▶ g) has coefficient on f_p equal to
#    Σ_q g_q · ⟨f_p, e_q · h⟩_{H}  = Σ_q g_q · M_H[p, h_index_expanded, q]  … but h is a vector.
# Simpler: (h ▶ g)(e_x) = g(e_x * h) = Σ_{y} M[x,h_idx,y] g_y   (if h=e_{h_idx}).
# So in dual basis, (e_h ▶ f_q) has f_p coefficient = M[p, h, q].
#
# We provide:
#  - build_HD(H): returns (mul_HD, basis_dim) where mul_HD(i_f,i_h, j_f,j_h) -> matrix coords
#  - verify_HD_associativity
#  - pairing / faithfulness checks induced by the chosen dual basis

module HeisenbergDoubleMod

using ..HopfCore
using LinearAlgebra
export HeisenbergDouble, hd_mul, verify_HD_associativity, hd_pairing_nondeg, hd_unit_ok

struct HeisenbergDouble{T<:Number}
    H::HopfCore.FiniteHopf{T}
    Hstar::HopfCore.FiniteHopf{T}
end

function HeisenbergDouble(H::HopfCore.FiniteHopf{T}) where {T}
    HeisenbergDouble{T}(H, HopfCore.dualHopf(H))
end

# Multiplication on HD for pure basis pairs (f_{p} ⊗ e_{a}) * (f_{q} ⊗ e_{b}).
# Result: a vector of coefficients over the (dim²)-dim basis ordered as
#   index (r, s) -> (r-1)*n + s   for f_r ⊗ e_s.
function hd_mul(HD::HeisenbergDouble{T}, p::Int, a::Int, q::Int, b::Int) where {T}
    H = HD.H
    n = H.n
    out = zeros(T, n*n)
    # Sweedler of e_a: Δ(e_a)[i,j] = H.Δ[i,j,a]   (e_a = Σ e_i ⊗ e_j part (1)(2))
    # Step: for each (i,j) with coef c = H.Δ[i,j,a]
    #   h_{(1)}=e_i, h_{(2)}=e_j
    #   (e_i ▶ f_q): dual-basis coefficient on f_r is M[r, i, q]
    #   then f_p * (that in H*): in H*, mult(f_p, f_r) has coef on f_s = Δ[p,r,s]
    #   Left H* part: sum over r : M[r,i,q] · (f_p * f_r) = sum_s [Σ_r M[r,i,q] Δ[p,r,s]] f_s
    # Right H part: e_j * e_b = Σ_t M[j, b, t] e_t
    @inbounds for i in 1:n, j in 1:n
        c = H.Δ[i,j,a]
        iszero(c) && continue
        for r in 1:n
            mri_q = H.M[r, i, q]
            iszero(mri_q) && continue
            for s in 1:n
                dprs = H.Δ[p, r, s]
                iszero(dprs) && continue
                left_coef = c * mri_q * dprs
                for t in 1:n
                    mjb = H.M[j, b, t]
                    iszero(mjb) && continue
                    out[(s-1)*n + t] += left_coef * mjb
                end
            end
        end
    end
    out
end

_hd_atol(::Type{<:Integer}) = 0.0
_hd_atol(::Type{<:Rational}) = 0.0
_hd_atol(::Type{T}) where {T<:AbstractFloat} = sqrt(eps(T))
_hd_atol(::Type{Complex{T}}) where {T<:AbstractFloat} = sqrt(eps(T))
_hd_atol(::Type{<:Number}) = 0.0

"""Verify associativity of HD multiplication on all basis pair triples."""
function verify_HD_associativity(HD::HeisenbergDouble{T}; atol=_hd_atol(T)) where {T}
    H = HD.H
    n = H.n
    tol = atol
    # (A*B)*C  vs  A*(B*C)  where each is a basis pair (p,a).
    # We need mul on arbitrary vectors:
    function mulvec(U::Vector{T}, V::Vector{T})
        out = zeros(T, n*n)
        for i1 in 1:length(U)
            u = U[i1]; iszero(u) && continue
            p = div(i1-1, n) + 1; a = mod(i1-1, n) + 1
            for j1 in 1:length(V)
                v = V[j1]; iszero(v) && continue
                q = div(j1-1, n) + 1; b = mod(j1-1, n) + 1
                out .+= (u*v) .* hd_mul(HD, p, a, q, b)
            end
        end
        out
    end
    for p in 1:n, a in 1:n, q in 1:n, b in 1:n, r in 1:n, c in 1:n
        A = zeros(T, n*n); A[(p-1)*n + a] = one(T)
        B = zeros(T, n*n); B[(q-1)*n + b] = one(T)
        C = zeros(T, n*n); C[(r-1)*n + c] = one(T)
        AB = mulvec(A, B); BC = mulvec(B, C)
        L = mulvec(AB, C); R = mulvec(A, BC)
        if !isapprox(L, R; atol=tol)
            return false
        end
    end
    true
end

"""
    hd_unit_ok(HD; atol) -> Bool

Check that 1_HD := 1_{H*} ⊗ 1_H  acts as a two-sided unit for hd_mul.
In dual-basis coords 1_{H*} = Σ_p H.ε[p]·f_p  and  1_H = Σ_a H.η[a]·e_a.

This is the honest Hopf-pairing-compatible axiom to check; the old
`hd_pairing_nondeg` was tautological (identity-Gram non-singular).
"""
function hd_unit_ok(HD::HeisenbergDouble{T}; atol=_hd_atol(T)) where {T}
    H = HD.H
    n = H.n
    ok(a, b) = iszero(atol) ? a == b : isapprox(a, b; atol=atol)
    # multiply (basis vector U) by 1_HD and check we get U back (both sides).
    for p0 in 1:n, a0 in 1:n
        left  = zeros(T, n*n)  # 1_HD · (f_{p0} ⊗ e_{a0})
        right = zeros(T, n*n)  # (f_{p0} ⊗ e_{a0}) · 1_HD
        for p in 1:n, a in 1:n
            w = H.ε[p] * H.η[a]; iszero(w) && continue
            left  .+= w .* hd_mul(HD, p,  a,  p0, a0)
            right .+= w .* hd_mul(HD, p0, a0, p,  a)
        end
        target = zeros(T, n*n); target[(p0-1)*n + a0] = one(T)
        (ok(left, target) && ok(right, target)) || return false
    end
    true
end

function _hd_action_matrix(HD::HeisenbergDouble{T}, p::Int, a::Int) where {T}
    H = HD.H
    n = H.n
    A = zeros(T, n, n)
    # Canonical action of H* # H on H*: (f_p # e_a) · f_q = f_p * (e_a ▶ f_q).
    for q in 1:n
        for r in 1:n
            action_coef = H.M[r, a, q]
            iszero(action_coef) && continue
            for s in 1:n
                prod_coef = HD.Hstar.M[p, r, s]
                iszero(prod_coef) && continue
                A[s, q] += action_coef * prod_coef
            end
        end
    end
    A
end

"""
    hd_pairing_nondeg(HD; atol) -> Bool

Checks that the canonical action of `HD(H)` on `H*`, induced by the chosen dual
pairing, is faithful: the basis of `H* # H` acts as `n^2` linearly independent
endomorphisms of `H*`.
"""
function hd_pairing_nondeg(HD::HeisenbergDouble{T}; atol=_hd_atol(T)) where {T}
    n = HD.H.n
    cols = Vector{Vector{ComplexF64}}()
    sizehint!(cols, n * n)
    for p in 1:n, a in 1:n
        push!(cols, vec(ComplexF64.(_hd_action_matrix(HD, p, a))))
    end
    action_basis = hcat(cols...)
    rank(action_basis; atol=atol) == n * n
end

end # module
