# PolAlg.jl — 可換多項式代数 (Phase D-4)
#
# MATLAB `Core/PolAlgs/PolAlg.m` からの移植。設計は
# `dev-docs/projects/AlgLibMove/design/polalg_island.md` 参照。
#
# 依存:
#   - Core/SpaceSpec.jl (module SpaceSpecs)
#   - Core/Interfaces.jl (additive_trait, IsAdditive, @test_additive_contract)
#
# 本ファイルは親モジュール (AkaghefAlgebra) の submodule として include される。

module PolAlgs

using ..SpaceSpecs: SpaceSpec, dim, basis_labels
import ..AkaghefAlgebra: additive_trait, IsAdditive

export PolAlg, polalg,
       coefficients, monomials, nterms, nvars, space,
       simplify, iscanonical, calc, evaluate

# ---------------------------------------------------------------------------
# 型定義
# ---------------------------------------------------------------------------

"""
    PolAlg{S<:Number}

可換多項式代数の要素。`exps` は `(nvars × nterms)` の指数行列 (column-major、
各列が 1 モノミアル)、`coeffs` は対応する係数ベクトル。
"""
struct PolAlg{S<:Number}
    exps::Matrix{Int}
    coeffs::Vector{S}
    space::SpaceSpec

    function PolAlg{S}(exps::Matrix{Int}, coeffs::Vector{S}, space::SpaceSpec) where {S<:Number}
        size(exps, 2) == length(coeffs) ||
            throw(ArgumentError("PolAlg: exps columns ($(size(exps,2))) must match coeffs length ($(length(coeffs)))"))
        size(exps, 1) == dim(space) ||
            throw(ArgumentError("PolAlg: exps rows ($(size(exps,1))) must match space dim ($(dim(space)))"))
        all(>=(0), exps) ||
            throw(ArgumentError("PolAlg: exponents must be non-negative"))
        return new{S}(exps, coeffs, space)
    end
end

PolAlg(exps::Matrix{Int}, coeffs::Vector{S}, space::SpaceSpec) where {S<:Number} =
    PolAlg{S}(exps, coeffs, space)

"""
    polalg(space, pairs...)

`Vector{Int} => coeff` 形式のペアから PolAlg を構築 (simplify 済)。
"""
function polalg(space::SpaceSpec, pairs::Pair{Vector{Int},S}...) where {S<:Number}
    n = dim(space)
    if isempty(pairs)
        return PolAlg{S}(Matrix{Int}(undef, n, 0), S[], space)
    end
    exps = Matrix{Int}(undef, n, length(pairs))
    cs = Vector{S}(undef, length(pairs))
    for (i, p) in enumerate(pairs)
        length(p.first) == n ||
            throw(ArgumentError("polalg: exponent length must equal dim=$n"))
        exps[:, i] = p.first
        cs[i] = p.second
    end
    return simplify(PolAlg{S}(exps, cs, space))
end

# ---------------------------------------------------------------------------
# trait
# ---------------------------------------------------------------------------

additive_trait(::Type{<:PolAlg}) = IsAdditive()

# ---------------------------------------------------------------------------
# accessors
# ---------------------------------------------------------------------------

coefficients(p::PolAlg) = p.coeffs
monomials(p::PolAlg) = p.exps
nterms(p::PolAlg) = length(p.coeffs)
nvars(p::PolAlg) = size(p.exps, 1)
space(p::PolAlg) = p.space

# ---------------------------------------------------------------------------
# zero / one / iszero / isone
# ---------------------------------------------------------------------------

Base.zero(p::PolAlg{S}) where {S} =
    PolAlg{S}(Matrix{Int}(undef, nvars(p), 0), S[], p.space)

function Base.one(p::PolAlg{S}) where {S}
    n = nvars(p)
    exps = zeros(Int, n, 1)
    return PolAlg{S}(exps, S[one(S)], p.space)
end

Base.iszero(p::PolAlg) = nterms(p) == 0 || all(iszero, p.coeffs)

function Base.isone(p::PolAlg)
    q = simplify(p)
    nterms(q) == 1 || return false
    all(iszero, @view q.exps[:, 1]) || return false
    return isone(q.coeffs[1])
end

# ---------------------------------------------------------------------------
# simplify
# ---------------------------------------------------------------------------

"""
    simplify(p::PolAlg) -> PolAlg

同類項を集約し、零係数項を除去。冪等 (idempotent)。
"""
function simplify(p::PolAlg{S}) where {S}
    nt = nterms(p)
    n = nvars(p)
    nt == 0 && return p

    keys = [ntuple(v -> p.exps[v, i], n) for i in 1:nt]
    order = sortperm(keys)
    out_keys = NTuple{n,Int}[]
    out_coeffs = S[]
    for idx in order
        k = keys[idx]
        c = p.coeffs[idx]
        if !isempty(out_keys) && out_keys[end] == k
            out_coeffs[end] += c
        else
            push!(out_keys, k)
            push!(out_coeffs, c)
        end
    end

    # zero 除去
    mask = .!iszero.(out_coeffs)
    if !all(mask)
        out_keys = out_keys[mask]
        out_coeffs = out_coeffs[mask]
    end

    if isempty(out_keys)
        return PolAlg{S}(Matrix{Int}(undef, n, 0), S[], p.space)
    end
    new_exps = Matrix{Int}(undef, n, length(out_keys))
    for (j, k) in enumerate(out_keys)
        for v in 1:n
            new_exps[v, j] = k[v]
        end
    end
    return PolAlg{S}(new_exps, out_coeffs, p.space)
end

"""
    iscanonical(p::PolAlg) -> Bool

不変条件 (同類項集約済、零係数なし、辞書順ソート) を満たしているか判定。
"""
function iscanonical(p::PolAlg)
    nt = nterms(p)
    n = nvars(p)
    nt == 0 && return true
    any(iszero, p.coeffs) && return false
    prev = ntuple(v -> p.exps[v, 1], n)
    for i in 2:nt
        cur = ntuple(v -> p.exps[v, i], n)
        cur > prev || return false
        prev = cur
    end
    return true
end

# B' クラスタ共通インターフェース
calc(p::PolAlg) = simplify(p)

# ---------------------------------------------------------------------------
# 比較
# ---------------------------------------------------------------------------

function Base.:(==)(p::PolAlg, q::PolAlg)
    p.space == q.space || return false
    p2 = simplify(p)
    q2 = simplify(q)
    nterms(p2) == nterms(q2) || return false
    p2.exps == q2.exps && p2.coeffs == q2.coeffs
end

# ---------------------------------------------------------------------------
# 算術
# ---------------------------------------------------------------------------

function Base.:+(p::PolAlg{A}, q::PolAlg{B}) where {A,B}
    p.space == q.space || throw(DimensionMismatch("PolAlg spaces differ"))
    R = promote_type(A, B)
    exps = hcat(p.exps, q.exps)
    coeffs = R[convert(R, c) for c in vcat(p.coeffs, q.coeffs)]
    return simplify(PolAlg{R}(exps, coeffs, p.space))
end

Base.:+(p::PolAlg) = p
Base.:-(p::PolAlg{S}) where {S} = PolAlg{S}(copy(p.exps), -p.coeffs, p.space)
Base.:-(p::PolAlg, q::PolAlg) = p + (-q)

# スカラー倍
function Base.:*(c::Number, p::PolAlg{S}) where {S}
    R = promote_type(typeof(c), S)
    new_coeffs = R[convert(R, c) * x for x in p.coeffs]
    return simplify(PolAlg{R}(copy(p.exps), new_coeffs, p.space))
end
Base.:*(p::PolAlg, c::Number) = c * p

# 多項式乗算 (Cauchy product)
function Base.:*(p::PolAlg{A}, q::PolAlg{B}) where {A,B}
    p.space == q.space || throw(DimensionMismatch("PolAlg spaces differ"))
    R = promote_type(A, B)
    np, nq = nterms(p), nterms(q)
    n = nvars(p)
    if np == 0 || nq == 0
        return PolAlg{R}(Matrix{Int}(undef, n, 0), R[], p.space)
    end
    total = np * nq
    exps = Matrix{Int}(undef, n, total)
    coeffs = Vector{R}(undef, total)
    k = 0
    @inbounds for i in 1:np, j in 1:nq
        k += 1
        for v in 1:n
            exps[v, k] = p.exps[v, i] + q.exps[v, j]
        end
        coeffs[k] = p.coeffs[i] * q.coeffs[j]
    end
    return simplify(PolAlg{R}(exps, coeffs, p.space))
end

Base.literal_pow(::typeof(^), p::PolAlg, ::Val{N}) where {N} = p ^ Int(N)

function Base.:^(p::PolAlg{S}, n::Integer) where {S}
    n < 0 && throw(ArgumentError("PolAlg: negative power not supported"))
    n == 0 && return one(p)
    n == 1 && return p
    result = p
    for _ in 2:n
        result = result * p
    end
    return result
end

# ---------------------------------------------------------------------------
# evaluate
# ---------------------------------------------------------------------------

function evaluate(p::PolAlg{S}, values::AbstractVector) where {S}
    length(values) == nvars(p) ||
        throw(DimensionMismatch("evaluate: length(values) must equal nvars=$(nvars(p))"))
    T = promote_type(S, eltype(values))
    result = zero(T)
    for i in 1:nterms(p)
        term = convert(T, p.coeffs[i])
        for v in 1:nvars(p)
            e = p.exps[v, i]
            if e > 0
                term *= values[v]^e
            end
        end
        result += term
    end
    return result
end

# ---------------------------------------------------------------------------
# show
# ---------------------------------------------------------------------------

function Base.show(io::IO, p::PolAlg)
    if iszero(p)
        print(io, "0")
        return
    end
    labels = basis_labels(p.space)
    for i in 1:nterms(p)
        c = p.coeffs[i]
        if i > 1
            print(io, " + ")
        end
        print(io, c)
        for v in 1:nvars(p)
            e = p.exps[v, i]
            if e > 0
                print(io, "*", labels[v])
                e > 1 && print(io, "^", e)
            end
        end
    end
end

end # module PolAlgs
