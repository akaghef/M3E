module AkaghefAlgebra

# Core (Phase D-2, D-3)
include("Core/NumericType.jl")
include("Core/SpaceSpec.jl")
include("Core/Interfaces.jl")

# Polynomial island (Phase D-4)
include("Polynomial/PolAlg.jl")
using .PolAlgs: PolAlg, polalg, coefficients, monomials, nterms, nvars, space,
                simplify, iscanonical, calc, evaluate
export PolAlg, polalg, coefficients, monomials, nterms, nvars, space,
       simplify, iscanonical, calc, evaluate

# SpaceSpec 再輸出 (tests で直接使うため)
using .SpaceSpecs: SpaceSpec, dim, basis_labels, grading
export SpaceSpec, dim, basis_labels, grading

# Interfaces (flat, no submodule) — 既に AkaghefAlgebra top-level にある
export additive_trait, IsAdditive, NotAdditive,
       compare_trait, IsEquatable, IsComparable,
       isapproxzero, isequiv, @test_additive_contract

# TODO: 以下は後続 Phase D wave で追加
# include("Sparse/SparseEx.jl")
# include("Vector/VectAlg.jl")
# include("String/StrAlg.jl")
# include("TensorDSL/CalcTE.jl")

end # module
