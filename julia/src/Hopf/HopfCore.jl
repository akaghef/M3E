# HopfCore.jl — Finite-dim Hopf algebra over a field via structure constants.
# Convention: Kassel-style. μ(a⊗b) = a*b; Δ uses Sweedler Δ(h) = Σ h₁⊗h₂;
# antipode satisfies μ∘(S⊗id)∘Δ = η∘ε = μ∘(id⊗S)∘Δ.

module HopfCore

using LinearAlgebra

export HopfAlgebra, FiniteHopf, mul, unit, comul, counit, antipode,
       basis_dim, verifyHopf, dualHopf, pairing_matrix

# ---------------------------------------------------------------------------
# Abstract type
# ---------------------------------------------------------------------------

abstract type HopfAlgebra end

"""
    FiniteHopf{T}

Concrete finite-dim Hopf algebra over field of eltype T (Complex, Rational, …).
- `n` : dimension
- `labels` : basis labels for display
- `M[i,j,k]` : structure constants s.t. e_i * e_j = Σ_k M[i,j,k] e_k
- `η` : unit as coordinate vector (so 1 = Σ η[i] e_i)
- `Δ[i,j,k]` : e_k ↦ Σ_{i,j} Δ[i,j,k] e_i ⊗ e_j  (comult coeffs of Δ(e_k))
- `ε` : counit row vector ε(e_k) = ε[k]
- `S[i,k]` : antipode matrix S(e_k) = Σ_i S[i,k] e_i
"""
struct FiniteHopf{T<:Number} <: HopfAlgebra
    n::Int
    labels::Vector{String}
    M::Array{T,3}      # (i,j,k) -> coef of e_k in e_i * e_j
    η::Vector{T}       # unit coords
    Δ::Array{T,3}      # (i,j,k) -> coef of e_i⊗e_j in Δ(e_k)
    ε::Vector{T}       # counit values on basis
    S::Matrix{T}       # antipode matrix (columns = S of basis element)
end

basis_dim(H::FiniteHopf) = H.n

@inline _default_atol(::Type{<:Integer}) = 0.0
@inline _default_atol(::Type{<:Rational}) = 0.0
@inline _default_atol(::Type{T}) where {T<:AbstractFloat} = sqrt(eps(T))
@inline _default_atol(::Type{Complex{T}}) where {T<:AbstractFloat} = sqrt(eps(T))
@inline _default_atol(::Type{<:Number}) = 0.0

# ---------------------------------------------------------------------------
# Minimal tensor-expression helper (readable wrapper). Kept locally for the
# current Hopf experiments; Stage C.6 may still replace this with TensorDSL.
# ---------------------------------------------------------------------------

"""
    @calcTE out[idx...] = expr

Tiny einsum: any index appearing on the RHS but not on the LHS is summed.
Shapes are inferred from the RHS tensors' axes. Output is allocated fresh.
Example:
    @calcTE C[i,k] = A[i,j] * B[j,k]
"""
macro calcTE(assign)
    @assert assign.head === :(=) "Usage: @calcTE out[...] = expr"
    lhs, rhs = assign.args[1], assign.args[2]
    @assert lhs.head === :ref
    out_sym = lhs.args[1]
    out_idx = lhs.args[2:end]

    refs = Expr[]
    function collect!(e)
        if e isa Expr && e.head === :ref
            push!(refs, e)
        elseif e isa Expr && e.head === :call && e.args[1] === :*
            for a in e.args[2:end]
                collect!(a)
            end
        else
            error("Unsupported @calcTE RHS form: $e")
        end
    end
    collect!(rhs)

    idx_source = Dict{Symbol,Tuple{Symbol,Int}}()
    all_idx = Symbol[]
    for r in refs
        tname = r.args[1]
        for (k, ix) in enumerate(r.args[2:end])
            if !(ix in all_idx)
                push!(all_idx, ix)
            end
            if !haskey(idx_source, ix)
                idx_source[ix] = (tname, k)
            end
        end
    end
    inner_idx = setdiff(all_idx, out_idx)

    size_expr(ix) = let (t, k) = idx_source[ix]
        :(size($t, $k))
    end
    out_sizes = [size_expr(ix) for ix in out_idx]

    acc = gensym(:acc)
    inner_loop = quote
        $acc += $rhs
    end
    for ix in reverse(inner_idx)
        inner_loop = quote
            for $ix in 1:$(size_expr(ix))
                $inner_loop
            end
        end
    end
    outer_loop = quote
        $acc = zero(promote_type($(map(r -> :(eltype($(r.args[1]))), refs)...)))
        $inner_loop
        $out_sym[$(out_idx...)] = $acc
    end
    for ix in reverse(out_idx)
        outer_loop = quote
            for $ix in 1:$(size_expr(ix))
                $outer_loop
            end
        end
    end

    alloc = :($out_sym = Array{promote_type($(map(r -> :(eltype($(r.args[1]))), refs)...))}(undef, $(out_sizes...)))
    return esc(quote
        $alloc
        $outer_loop
        $out_sym
    end)
end

# ---------------------------------------------------------------------------
# Operations on coordinate vectors
# ---------------------------------------------------------------------------

"""mul(H, a, b) — multiply coord vectors a, b in H."""
function mul(H::FiniteHopf{T}, a::AbstractVector, b::AbstractVector) where {T}
    n = H.n
    out = zeros(T, n)
    @inbounds for i in 1:n, j in 1:n
        aibj = a[i]*b[j]
        iszero(aibj) && continue
        for k in 1:n
            out[k] += aibj * H.M[i,j,k]
        end
    end
    out
end

unit(H::FiniteHopf) = copy(H.η)

"""comul(H, a) — returns (n×n) matrix C with C[i,j] = coef of e_i⊗e_j in Δ(a)."""
function comul(H::FiniteHopf{T}, a::AbstractVector) where {T}
    n = H.n
    C = zeros(T, n, n)
    @inbounds for k in 1:n
        ak = a[k]; iszero(ak) && continue
        for i in 1:n, j in 1:n
            C[i,j] += ak * H.Δ[i,j,k]
        end
    end
    C
end

counit(H::FiniteHopf{T}, a::AbstractVector) where {T} =
    sum(a[k]*H.ε[k] for k in 1:H.n)

antipode(H::FiniteHopf{T}, a::AbstractVector) where {T} = H.S * collect(a)

# ---------------------------------------------------------------------------
# verifyHopf: checks the 4 Hopf axioms
# ---------------------------------------------------------------------------

"""
    verifyHopf(H; atol=1e-10) -> NamedTuple of Bools

1. assoc       : (e_i*e_j)*e_k == e_i*(e_j*e_k)
2. unit        : μ(η⊗id)=id=μ(id⊗η)
3. coassoc     : (Δ⊗id)∘Δ == (id⊗Δ)∘Δ on basis
4. Δ_algHom    : Δ(e_i*e_j) == Δ(e_i) · Δ(e_j)  (tensor product of algebras)
5. counit      : (ε⊗id)Δ=id=(id⊗ε)Δ
6. unit_scalar : ε∘η = 1
7. antipode    : μ∘(S⊗id)∘Δ(x) = η·ε(x) = μ∘(id⊗S)∘Δ(x)

Because the structure maps are linear or bilinear, checking them on a basis is
sufficient for a finite-dimensional presentation by structure constants.
"""
function verifyHopf(H::FiniteHopf{T}; atol=_default_atol(T)) where {T}
    n = H.n
    tol = atol
    ok(a, b) = iszero(tol) ? a == b : isapprox(a, b; atol=tol)

    basis = [begin v = zeros(T,n); v[k]=one(T); v end for k in 1:n]

    # 1. associativity
    assoc = true
    for i in 1:n, j in 1:n, k in 1:n
        lhs = mul(H, mul(H, basis[i], basis[j]), basis[k])
        rhs = mul(H, basis[i], mul(H, basis[j], basis[k]))
        ok(lhs, rhs) || (assoc = false; break)
    end

    # 2. coassociativity. (Δ⊗id)Δ(x) and (id⊗Δ)Δ(x) are order-3 tensors.
    coassoc = true
    for k in 1:n
        # Δ(e_k)[i,j] = H.Δ[i,j,k]; then expand leg i via Δ or leg j via Δ.
        L = zeros(T,n,n,n); R = zeros(T,n,n,n)
        for i in 1:n, j in 1:n
            c = H.Δ[i,j,k]; iszero(c) && continue
            # (Δ⊗id): expand leg i
            for a in 1:n, b in 1:n
                L[a,b,j] += c * H.Δ[a,b,i]
            end
            # (id⊗Δ): expand leg j
            for a in 1:n, b in 1:n
                R[i,a,b] += c * H.Δ[a,b,j]
            end
        end
        ok(L, R) || (coassoc = false; break)
    end

    # 3. Δ is algebra hom: Δ(x*y) = Δ(x)·Δ(y) in H⊗H (componentwise mul).
    alghom = true
    for i in 1:n, j in 1:n
        # LHS: Δ(e_i * e_j)
        prod_ij = mul(H, basis[i], basis[j])
        LHS = comul(H, prod_ij)
        # RHS: Δ(e_i)·Δ(e_j), where (A·B)[p,q] = Σ_{a,b,c,d} A[a,b]B[c,d] mul(H,e_a,e_c)[p] mul(H,e_b,e_d)[q]
        Δi = @view H.Δ[:,:,i]
        Δj = @view H.Δ[:,:,j]
        RHS = zeros(T,n,n)
        for a in 1:n, b in 1:n
            Ai = Δi[a,b]; iszero(Ai) && continue
            for c in 1:n, d in 1:n
                Bj = Δj[c,d]; iszero(Bj) && continue
                coef = Ai*Bj
                # mul(e_a, e_c) and mul(e_b, e_d)
                for p in 1:n
                    mac = H.M[a,c,p]; iszero(mac) && continue
                    for q in 1:n
                        RHS[p,q] += coef * mac * H.M[b,d,q]
                    end
                end
            end
        end
        ok(LHS, RHS) || (alghom = false; break)
    end

    # unit/counit
    unit_ok = true
    for k in 1:n
        (ok(mul(H, H.η, basis[k]), basis[k]) &&
         ok(mul(H, basis[k], H.η), basis[k])) || (unit_ok = false; break)
    end
    unit_scalar_ok = ok(counit(H, H.η), one(T))
    # (ε⊗id)Δ(x) = x  and (id⊗ε)Δ(x) = x
    counit_id = true
    for k in 1:n
        v1 = zeros(T,n); v2 = zeros(T,n)
        for i in 1:n, j in 1:n
            c = H.Δ[i,j,k]; iszero(c) && continue
            v1[j] += c * H.ε[i]
            v2[i] += c * H.ε[j]
        end
        (ok(v1, basis[k]) && ok(v2, basis[k])) || (counit_id = false; break)
    end

    # 4. antipode: μ∘(S⊗id)∘Δ(x) = η·ε(x)
    antip = true
    for k in 1:n
        lhs1 = zeros(T,n); lhs2 = zeros(T,n)
        for i in 1:n, j in 1:n
            c = H.Δ[i,j,k]; iszero(c) && continue
            Sei = H.S[:,i]
            Sej = H.S[:,j]
            lhs1 .+= c .* mul(H, Sei, basis[j])
            lhs2 .+= c .* mul(H, basis[i], Sej)
        end
        target = H.ε[k] .* H.η
        (ok(lhs1, target) && ok(lhs2, target)) || (antip = false; break)
    end

    (assoc=assoc, unit=unit_ok, coassoc=coassoc, alghom=alghom,
     counit=counit_id, unit_scalar=unit_scalar_ok, antipode=antip,
     all = assoc && unit_ok && coassoc && alghom && counit_id &&
           unit_scalar_ok && antip)
end

# ---------------------------------------------------------------------------
# Linear dual Hopf algebra  H* (for f.d. H)
#   mult on H*  = transpose of Δ
#   unit on H*  = ε  (as element of H*, i.e. ε ∈ H* is the unit because 1_{H*}(x)=ε(x))
#   comult on H*= transpose of μ
#   counit on H*= evaluation at 1_H (i.e. η)
#   antipode   = transpose of S
# Basis of H* is the dual basis {f_i} with f_i(e_j)=δ_{ij}.
# ---------------------------------------------------------------------------

function dualHopf(H::FiniteHopf{T}) where {T}
    n = H.n
    # In dual basis: multiplication coming from Δ:
    # f_i * f_j (e_k) = (f_i⊗f_j)(Δ(e_k)) = Δ[i,j,k]
    # So M_dual[i,j,k] = Δ[i,j,k]
    M_d = copy(H.Δ)

    # unit 1_{H*} = ε: expressed in dual basis, coef on f_k is ε(e_k) = H.ε[k]
    η_d = copy(H.ε)

    # comult Δ_dual(f_k)[i,j] = f_k(e_i*e_j) = M[i,j,k]
    Δ_d = copy(H.M)

    # counit ε_{H*}(f_k) = f_k(1_H) = η[k]
    ε_d = copy(H.η)

    # antipode S_dual = transpose of S (acts on dual basis):
    # S*(f_k)(e_j) = f_k(S(e_j)) = S[k, j]  -> coef of f_i in S*(f_k) is S[k,i]
    # so S_dual[i, k] = S[k, i]
    S_d = Matrix(transpose(H.S))

    FiniteHopf{T}(n, ["f_"*l for l in H.labels], M_d, η_d, Δ_d, ε_d, S_d)
end

"""pairing_matrix(H) — Gram matrix of pairing H* ⊗ H → k in dual / primal basis.
For the dual basis this is the identity; but for a *chosen* basis of H*, we may
represent it differently. Here we return the identity of size n — trivially
non-degenerate — and rely on `dualHopf` giving the dual basis.
"""
pairing_matrix(H::FiniteHopf{T}) where {T} = Matrix{T}(I, H.n, H.n)

end # module
