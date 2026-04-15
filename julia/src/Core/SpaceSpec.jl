"""
SpaceSpec — 代数要素が属する空間の仕様 (dim + basis labels + grading)。

`dev-docs/projects/AlgLibMove/design/shared_core.md` §3 参照。
Bases 命名衝突が未解決のため、本ファイルでは Bases に依存せず
最小の値オブジェクト (immutable struct) として定義する。
"""
module SpaceSpecs

export SpaceSpec, dim, basis_labels, grading

struct SpaceSpec
    dim::Int
    basis_labels::Vector{String}
    grading::Union{Nothing, Vector{Int}}

    function SpaceSpec(dim::Int,
                       basis_labels::Vector{String},
                       grading::Union{Nothing, Vector{Int}})
        dim > 0 || throw(ArgumentError("SpaceSpec: dim must be positive, got $dim"))
        nlabels = length(basis_labels)
        (nlabels == 0 || nlabels == dim) ||
            throw(ArgumentError(
                "SpaceSpec: length(basis_labels) must be 0 or dim=$dim, got $nlabels"))
        if grading !== nothing && length(grading) != dim
            throw(ArgumentError(
                "SpaceSpec: length(grading) must equal dim=$dim, got $(length(grading))"))
        end
        return new(dim, basis_labels, grading)
    end
end

# 外部コンストラクタ
function SpaceSpec(dim::Int;
                   basis_labels::Vector{String} = String[],
                   grading::Union{Nothing, Vector{Int}} = nothing)
    return SpaceSpec(dim, basis_labels, grading)
end

# アクセサ
dim(s::SpaceSpec) = s.dim

function basis_labels(s::SpaceSpec)
    if isempty(s.basis_labels)
        return ["e$(i)" for i in 1:s.dim]
    else
        return s.basis_labels
    end
end

grading(s::SpaceSpec) = s.grading === nothing ? zeros(Int, s.dim) : s.grading

# 等価性とハッシュ (全フィールド比較)
function Base.:(==)(a::SpaceSpec, b::SpaceSpec)
    return a.dim == b.dim &&
           a.basis_labels == b.basis_labels &&
           a.grading == b.grading
end

function Base.hash(s::SpaceSpec, h::UInt)
    h = hash(s.dim, h)
    h = hash(s.basis_labels, h)
    h = hash(s.grading, h)
    return hash(:SpaceSpec, h)
end

function Base.show(io::IO, s::SpaceSpec)
    print(io, "SpaceSpec(dim=", s.dim)
    if !isempty(s.basis_labels)
        print(io, ", labels=", s.basis_labels)
    end
    if s.grading !== nothing
        print(io, ", grading=", s.grading)
    end
    print(io, ")")
end

end # module
