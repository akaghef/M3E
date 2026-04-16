# SparseEx.jl — Julia port of MATLAB AkaghefAlgebra/Core/tensor/SparseEx.m.
#
# Faithful key–value sparse-tensor representation. The MATLAB original stores:
#   - size::Vector{Int}     ([] = scalar, [n] = column vector, [m,n,…] = tensor)
#   - key::Matrix{Int}      (Nelem × rank, 1-based subscripts)
#   - val::Vector{T}        (Nelem values)
# and uses **column-major** linear indexing via sub2ind / ind2sub.  Julia arrays
# are natively column-major, so `LinearIndices(Tuple(size))` reproduces the
# MATLAB `sub2ind(size, …)` output verbatim — this is the reason the port
# behaves identically to the original without an explicit index permutation.
#
# Scope of the port (parity checklist; ☑ = implemented, ☐ = TBD):
#   ☑ convert (from Array)       ☑ to_matrix / to_array
#   ☑ Nelem / rank                ☑ permute
#   ☑ reshape (NaN inference)     ☑ transpose / ctranspose
#   ☑ plus / uminus / minus       ☑ elementwise-mul-by-scalar
#   ☑ matmul (rank ≤ 2)           ☑ matpow (integer, incl. negative)
#   ☑ tensorprod (outer & contracted)
#   ☑ combine_terms / remove_zero / canonicalize (C)
#   ☑ ==, isapprox (with tol)
#   ☐ plot / disp (UI; intentionally dropped)
#   ☐ ge / eq-as-boolean-mask / not / abs / max (trivially re-expressible; add when needed)
#   ☐ AlgebraConfig.simplify_func_Sparse hook  (Symbolics layer; TBD_scalar_backends)

module Sparse

using LinearAlgebra

export SparseEx, from_array, to_array, nelem, rank_of,
       canonicalize, combine_terms, remove_zero,
       matmul, matpow, tensorprod,
       sparse_isapprox, sparse_permute, sparse_reshape,
       sparse_transpose, sparse_ctranspose

# ---------------------------------------------------------------------------
# Struct
# ---------------------------------------------------------------------------

"""
    SparseEx{T}

Key–value sparse tensor.  `size == Int[]` means scalar.  For vectors, `size` has
length 1 and `key` is an `Nelem × 1` matrix of 1-based indices.
"""
mutable struct SparseEx{T}
    size::Vector{Int}
    key::Matrix{Int}
    val::Vector{T}
    function SparseEx{T}(sz::Vector{Int}, key::Matrix{Int}, val::Vector{T}) where {T}
        # Structural invariants — match MATLAB `verify`.
        if isempty(sz)
            @assert size(key, 1) == 0 && length(val) == 1 "scalar: key must be 0-row, val must be 1-element"
        else
            r = length(sz)
            @assert size(key, 2) == r "key column count must equal rank"
            @assert size(key, 1) == length(val) "key rows must equal nnz"
            if size(key, 1) > 0
                for row in 1:size(key, 1), d in 1:r
                    @assert 1 <= key[row, d] <= sz[d] "key[$row,$d]=$(key[row,d]) out of [1,$(sz[d])]"
                end
            end
        end
        new{T}(sz, key, val)
    end
end

SparseEx(sz::Vector{Int}, key::Matrix{Int}, val::Vector{T}) where {T} =
    SparseEx{T}(sz, key, val)

"Scalar constructor."
SparseEx(x::T) where {T<:Number} =
    SparseEx{T}(Int[], Matrix{Int}(undef, 0, 0), T[x])

# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

nelem(A::SparseEx)   = length(A.val)
rank_of(A::SparseEx) = length(A.size)
is_scalar(A::SparseEx) = isempty(A.size)

# ---------------------------------------------------------------------------
# Conversions
# ---------------------------------------------------------------------------

"""
    from_array(A)

MATLAB `SparseEx.convert(arg)` clone.  Handles scalar, vector (stored as N×1 in
MATLAB), and arbitrary-rank tensors.  Column-major linear index order is
preserved.
"""
function from_array(A::AbstractArray{T}) where {T}
    sz = collect(Int, size(A))
    # MATLAB treats a column vector (size = [n, 1]) as a rank-1 tensor.
    if length(sz) == 2 && sz[2] == 1
        if sz[1] == 1
            return SparseEx(A[1])   # scalar
        else
            sz = [sz[1]]            # vector — drop the trailing 1
            idx = findall(!iszero, vec(A))
            key = reshape(idx, length(idx), 1)
            val = [A[i] for i in idx]
            return SparseEx{T}(sz, key, val)
        end
    end
    lin = LinearIndices(A)                # column-major, matches MATLAB
    cart = CartesianIndices(A)
    idx  = findall(!iszero, A)
    key  = Matrix{Int}(undef, length(idx), length(sz))
    val  = Vector{T}(undef, length(idx))
    for (row, I) in enumerate(idx)
        c = cart[lin[I]]
        for d in 1:length(sz)
            key[row, d] = c[d]
        end
        val[row] = A[I]
    end
    SparseEx{T}(sz, key, val)
end

from_array(x::Number) = SparseEx(x)

"MATLAB `toMatrix` — materialise dense array (or scalar)."
function to_array(A::SparseEx{T}) where {T}
    if is_scalar(A)
        return A.val[1]
    end
    dims = Tuple(A.size)
    out = zeros(T, dims)
    for row in 1:nelem(A)
        out[CartesianIndex(Tuple(A.key[row, :]))] += A.val[row]
    end
    out
end

# ---------------------------------------------------------------------------
# Canonicalisation: combine duplicate keys, drop zeros
# ---------------------------------------------------------------------------

function combine_terms(A::SparseEx{T}) where {T}
    if is_scalar(A)
        return SparseEx(sum(A.val))
    end
    n = nelem(A)
    n == 0 && return A
    # Sort rows lexicographically.  `sortperm` on keys-as-rows.
    perm = sortperm([Tuple(A.key[i, :]) for i in 1:n])
    sk = A.key[perm, :]
    sv = A.val[perm]
    # Group consecutive equal rows.
    out_keys = Vector{Vector{Int}}()
    out_vals = T[]
    i = 1
    while i <= n
        j = i
        while j < n && @views sk[j+1, :] == sk[i, :]
            j += 1
        end
        push!(out_keys, collect(sk[i, :]))
        push!(out_vals, sum(sv[i:j]))
        i = j + 1
    end
    key = isempty(out_keys) ? Matrix{Int}(undef, 0, rank_of(A)) :
                              permutedims(hcat(out_keys...))
    SparseEx{T}(copy(A.size), key, out_vals)
end

"""
    remove_zero(A; iszero=iszero)

Drop entries whose value is zero (under the supplied predicate).  For empty
result MATLAB keeps one placeholder row of ones — we keep an honest zero-row
tensor instead, which is legal for both Julia and for the downstream code that
only reads `key` shape-wise.
"""
function remove_zero(A::SparseEx{T}; iszero = Base.iszero) where {T}
    if is_scalar(A) || nelem(A) == 0
        return A
    end
    keep = findall(!iszero, A.val)
    SparseEx{T}(copy(A.size), A.key[keep, :], A.val[keep])
end

"""
    canonicalize(A; iszero=iszero, simplify=identity)

MATLAB `C`: combine duplicate keys, apply `simplify` to values, drop zeros.
"""
function canonicalize(A::SparseEx{T}; iszero = Base.iszero,
                      simplify = identity) where {T}
    B = combine_terms(A)
    B.val .= simplify.(B.val)
    remove_zero(B; iszero=iszero)
end

# ---------------------------------------------------------------------------
# Arithmetic
# ---------------------------------------------------------------------------

Base.:+(A::SparseEx{T1}, B::SparseEx{T2}) where {T1, T2} = _plus(A, B)

function _plus(A::SparseEx{T1}, B::SparseEx{T2}) where {T1, T2}
    T = promote_type(T1, T2)
    if is_scalar(A) && is_scalar(B)
        return SparseEx(T(A.val[1]) + T(B.val[1]))
    end
    @assert !is_scalar(A) && !is_scalar(B) "mixed scalar/tensor add not supported — lift scalar first"
    @assert A.size == B.size "size mismatch"
    key = vcat(A.key, B.key)
    val = vcat(T.(A.val), T.(B.val))
    out = SparseEx{T}(copy(A.size), key, val)
    combine_terms(out)    # matches MATLAB C(level='low') — no value simplify
end

Base.:-(A::SparseEx) = SparseEx{eltype(A.val)}(copy(A.size), copy(A.key), -A.val)
Base.:-(A::SparseEx, B::SparseEx) = A + (-B)

Base.:*(c::Number, A::SparseEx{T}) where {T} =
    is_scalar(A) ? SparseEx(c * A.val[1]) :
                   SparseEx{promote_type(typeof(c), T)}(copy(A.size), copy(A.key), c .* A.val)
Base.:*(A::SparseEx, c::Number) = c * A

# Matrix product (MATLAB `mtimes` for rank ≤ 2).  Dense round-trip is the
# reference path in MATLAB too (i1.toMatrix()*i2.toMatrix()).
function matmul(A::SparseEx, B::SparseEx)
    if is_scalar(A) && is_scalar(B)
        return SparseEx(A.val[1] * B.val[1])
    end
    is_scalar(A) && return A.val[1] * B
    is_scalar(B) && return B.val[1] * A
    @assert rank_of(A) <= 2 && rank_of(B) <= 2 "matmul needs rank ≤ 2"
    from_array(to_array(A) * to_array(B))
end

"""
    matpow(A, k)

Fast-exp integer power on rank-2 SparseEx.  MATLAB `mpower`.  `k == 0` returns
the identity of size `[A.size[1], A.size[1]]`.  Negative `k` inverts via dense.
"""
function matpow(A::SparseEx, k::Integer)
    if is_scalar(A)
        return SparseEx(A.val[1] ^ k)
    end
    @assert rank_of(A) == 2 "matpow needs rank 2"
    if k == 0
        n = A.size[1]
        T = eltype(A.val)
        return from_array(Matrix{T}(I, n, n))
    end
    if k < 0
        A = from_array(inv(to_array(A)))
        k = -k
    end
    result = A
    base = A
    exp_ = k - 1
    while exp_ > 0
        if mod(exp_, 2) == 1
            result = matmul(result, base)
        end
        base = matmul(base, base)
        exp_ = exp_ >> 1
    end
    result
end

# Fractional / non-integer → dense fallback (MATLAB uses M^arg for non-integer arg).
matpow(A::SparseEx, k::Real) = from_array(to_array(A) ^ k)

# ---------------------------------------------------------------------------
# Shape manipulations
# ---------------------------------------------------------------------------

function sparse_permute(A::SparseEx{T}, dimorder::AbstractVector{<:Integer}) where {T}
    is_scalar(A) && return A
    @assert length(dimorder) == rank_of(A) "rank mismatch"
    @assert sort(collect(dimorder)) == collect(1:rank_of(A)) "invalid permutation"
    newkey = A.key[:, dimorder]
    newsize = A.size[dimorder]
    SparseEx{T}(collect(newsize), newkey, copy(A.val))
end

function sparse_transpose(A::SparseEx{T}) where {T}
    r = rank_of(A)
    if r == 0
        return A
    elseif r == 1
        # vector → column transpose becomes 1×n
        newsize = [1, A.size[1]]
        newkey  = hcat(ones(Int, nelem(A)), A.key[:, 1])
        return SparseEx{T}(newsize, newkey, copy(A.val))
    elseif r == 2
        return sparse_permute(A, [2, 1])
    else
        error("transpose requires rank ≤ 2")
    end
end

sparse_ctranspose(A::SparseEx) = (B = sparse_transpose(A); B.val .= conj.(B.val); B)

"""
    reshape(A, newsize)

MATLAB-parity reshape.  One dimension may be marked as `:` (or negative) for
inference (instead of MATLAB's `NaN`).
"""
function sparse_reshape(A::SparseEx{T}, newsize::AbstractVector{<:Integer}) where {T}
    newsize = collect(Int, newsize)
    inferred = findall(x -> x < 0, newsize)
    if !isempty(inferred)
        @assert length(inferred) == 1 "only one dim can be inferred"
        known = prod(newsize[setdiff(1:end, inferred)])
        newsize[inferred[1]] = prod(A.size) ÷ known
    end
    @assert prod(newsize) == prod(A.size) "element count mismatch"
    if is_scalar(A) || nelem(A) == 0
        return SparseEx{T}(newsize, zeros(Int, 0, length(newsize)), copy(A.val))
    end
    # column-major round-trip: keys → linear → new keys
    old_lin = LinearIndices(Tuple(A.size))
    new_cart = CartesianIndices(Tuple(newsize))
    newkey = Matrix{Int}(undef, nelem(A), length(newsize))
    for row in 1:nelem(A)
        lin = old_lin[CartesianIndex(Tuple(A.key[row, :]))]
        c = new_cart[lin]
        for d in 1:length(newsize)
            newkey[row, d] = c[d]
        end
    end
    SparseEx{T}(newsize, newkey, copy(A.val))
end

# ---------------------------------------------------------------------------
# Tensor product with optional contraction
# ---------------------------------------------------------------------------

"""
    tensorprod(A, B; contract_a=Int[], contract_b=Int[])

Outer product when `contract_a` / `contract_b` are empty; otherwise pairs the
given axes and sums over matching indices.  Mirrors MATLAB
`tensorprod(A,B,arg1,arg2)` (internally delegated there to `calcTensorExpression`
— we implement the contraction directly).
"""
function tensorprod(A::SparseEx{T1}, B::SparseEx{T2};
                    contract_a::AbstractVector{<:Integer}=Int[],
                    contract_b::AbstractVector{<:Integer}=Int[]) where {T1, T2}
    @assert length(contract_a) == length(contract_b) "contraction axes must pair"
    T = promote_type(T1, T2)
    # Scalar short-circuits.
    if is_scalar(A) && is_scalar(B)
        return SparseEx(T(A.val[1]) * T(B.val[1]))
    end
    is_scalar(A) && return T(A.val[1]) * SparseEx{T}(copy(B.size), copy(B.key), T.(B.val))
    is_scalar(B) && return T(B.val[1]) * SparseEx{T}(copy(A.size), copy(A.key), T.(A.val))
    # Axis bookkeeping.
    keep_a = setdiff(1:rank_of(A), contract_a)
    keep_b = setdiff(1:rank_of(B), contract_b)
    # Result size = [size_A[keep_a]..., size_B[keep_b]...]
    newsize = vcat(A.size[keep_a], B.size[keep_b])
    # Validate contracted dimensions agree.
    for (d1, d2) in zip(contract_a, contract_b)
        @assert A.size[d1] == B.size[d2] "contracted dim size mismatch: $(A.size[d1]) vs $(B.size[d2])"
    end
    out_keys = Vector{Vector{Int}}()
    out_vals = T[]
    for i in 1:nelem(A), j in 1:nelem(B)
        # check contracted indices match
        matches = true
        for (d1, d2) in zip(contract_a, contract_b)
            if A.key[i, d1] != B.key[j, d2]; matches = false; break; end
        end
        matches || continue
        outkey = Int[A.key[i, d] for d in keep_a]
        append!(outkey, (B.key[j, d] for d in keep_b))
        push!(out_keys, outkey)
        push!(out_vals, T(A.val[i]) * T(B.val[j]))
    end
    if isempty(newsize)
        # Fully contracted → scalar
        return SparseEx(isempty(out_vals) ? zero(T) : sum(out_vals))
    end
    keymat = isempty(out_keys) ? Matrix{Int}(undef, 0, length(newsize)) :
                                 permutedims(hcat(out_keys...))
    combine_terms(SparseEx{T}(newsize, keymat, out_vals))
end

# ---------------------------------------------------------------------------
# Comparisons
# ---------------------------------------------------------------------------

Base.:(==)(A::SparseEx, B::SparseEx) =
    A.size == B.size && to_array(canonicalize(A)) == to_array(canonicalize(B))

"""
    sparse_isapprox(A, B; atol=0, rtol=…)

Dense-equivalent `isapprox` after canonicalisation.  Mirrors MATLAB `isapprox(.,.,tol)`.
"""
function sparse_isapprox(A::SparseEx, B::SparseEx;
                         atol::Real=0,
                         rtol::Real=atol>0 ? 0 : sqrt(eps(Float64)))
    A.size == B.size || return false
    isapprox(to_array(canonicalize(A)), to_array(canonicalize(B)); atol=atol, rtol=rtol)
end

end # module
