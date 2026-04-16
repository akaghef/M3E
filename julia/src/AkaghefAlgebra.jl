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

# Sparse tensor (Phase: AlgLibMove, port of MATLAB Core/tensor/SparseEx.m)
include("Sparse/SparseEx.jl")
using .Sparse: SparseEx, from_array, to_array, nelem, rank_of,
               canonicalize, combine_terms, remove_zero,
               matmul, matpow, tensorprod, sparse_isapprox,
               sparse_permute, sparse_reshape, sparse_transpose, sparse_ctranspose
export SparseEx, from_array, to_array, nelem, rank_of,
       canonicalize, combine_terms, remove_zero,
       matmul, matpow, tensorprod, sparse_isapprox,
       sparse_permute, sparse_reshape, sparse_transpose, sparse_ctranspose

# Hopf algebras (Phase: AlgLibMove)
# TEMP: pending Stage C.4 rehoming into Vector/* and Examples/* per julia_skeleton.md.
include("Hopf/HopfCore.jl")
using .HopfCore: HopfAlgebra, FiniteHopf, mul, unit, comul, counit, antipode,
                 basis_dim, verifyHopf, dualHopf, pairing_matrix
export HopfAlgebra, FiniteHopf, verifyHopf, dualHopf, pairing_matrix, basis_dim

include("Hopf/Sweedler.jl")
using .SweedlerMod: Sweedler
export Sweedler

include("Hopf/CyclicGroupAlg.jl")
using .CyclicGroupAlgMod: CyclicGroupAlg
export CyclicGroupAlg

include("Hopf/TaftAlg.jl")
using .TaftAlgMod: TaftAlg
export TaftAlg

include("Hopf/HeisenbergDouble.jl")
using .HeisenbergDoubleMod: HeisenbergDouble, hd_mul,
                            verify_HD_associativity, hd_pairing_nondeg, hd_unit_ok
export HeisenbergDouble, hd_mul, verify_HD_associativity, hd_pairing_nondeg, hd_unit_ok

# TODO: 以下は後続 Phase D wave で追加
# include("Sparse/SparseEx.jl")
# include("Vector/VectAlg.jl")
# include("String/StrAlg.jl")
# include("TensorDSL/CalcTE.jl")

end # module
