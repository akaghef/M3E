# CyclicGroupAlg.jl — Group Hopf algebra k[Z/N].
# Convention: group-like — Δ(g)=g⊗g, ε(g)=1, S(g)=g^{-1}.

module CyclicGroupAlgMod

using ..HopfCore
export CyclicGroupAlg

function CyclicGroupAlg(N::Int, ::Type{T}=ComplexF64) where {T<:Number}
    n = N
    labels = ["g^$(k-1)" for k in 1:n]

    M = zeros(T, n, n, n)
    for i in 1:n, j in 1:n
        k = mod(i-1 + j-1, N) + 1
        M[i,j,k] = one(T)
    end

    η = zeros(T, n); η[1] = one(T)

    Δ = zeros(T, n, n, n)
    for k in 1:n
        Δ[k,k,k] = one(T)
    end

    ε = ones(T, n)

    S = zeros(T, n, n)
    for k in 1:n
        # S(g^{k-1}) = g^{-(k-1)} = g^{N-(k-1) mod N}
        inv_exp = mod(-(k-1), N)
        S[inv_exp+1, k] = one(T)
    end

    HopfCore.FiniteHopf{T}(n, labels, M, η, Δ, ε, S)
end

end # module
