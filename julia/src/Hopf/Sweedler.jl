# Sweedler.jl — Sweedler's 4-dimensional Hopf algebra H_4.
# Convention: Kassel §VIII.2. Generators 1, g, x, gx with g²=1, x²=0, xg = -gx.
# Δ(g)=g⊗g, Δ(x)=x⊗1+g⊗x, ε(g)=1, ε(x)=0, S(g)=g, S(x)=-gx.

module SweedlerMod

using ..HopfCore
export Sweedler

function Sweedler(::Type{T}=ComplexF64) where {T<:Number}
    n = 4
    # basis order: 1=e1, g=e2, x=e3, gx=e4
    labels = ["1","g","x","gx"]

    M = zeros(T, n, n, n)
    # products as coord vectors
    one_v = T[1,0,0,0]; g = T[0,1,0,0]; x = T[0,0,1,0]; gx = T[0,0,0,1]
    function setprod!(i,j, out)
        for k in 1:n; M[i,j,k] = out[k]; end
    end
    # 1 * anything, anything * 1
    for (idx,v) in ((1,one_v),(2,g),(3,x),(4,gx))
        setprod!(1, idx, v)
        setprod!(idx, 1, v)
    end
    # g * g = 1
    setprod!(2,2, one_v)
    # g * x = gx
    setprod!(2,3, gx)
    # g * gx = g*(gx) = (g*g)*x = x
    setprod!(2,4, x)
    # x * g = -gx  (xg = -gx)
    setprod!(3,2, -gx)
    # x * x = 0
    # already zero
    # x * gx = x*(g*x) = (xg)*x = -gx*x = -g*(x*x) = 0
    # gx * 1 done; gx * g = (gx)g = g*(xg) = g*(-gx) = -g*g*x = -x
    setprod!(4,2, -x)
    # gx * x = g*(x*x)=0
    # gx * gx = g*x*g*x = g*(-gx)*x = -g*g*x*x = 0

    η = T[1,0,0,0]

    # Δ(1)=1⊗1
    Δ = zeros(T, n, n, n)
    Δ[1,1,1] = 1
    # Δ(g)=g⊗g
    Δ[2,2,2] = 1
    # Δ(x)=x⊗1 + g⊗x
    Δ[3,1,3] = 1
    Δ[2,3,3] = 1
    # Δ(gx)=Δ(g)Δ(x) = (g⊗g)(x⊗1 + g⊗x) = gx⊗g + g²⊗gx = gx⊗g + 1⊗gx
    Δ[4,2,4] = 1
    Δ[1,4,4] = 1

    ε = T[1,1,0,0]

    S = zeros(T, n, n)
    S[1,1] = 1         # S(1)=1
    S[2,2] = 1         # S(g)=g
    S[4,3] = -1        # S(x) = -gx  (coord on gx is -1)
    # S(gx) = S(x)S(g) = (-gx)(g) = -gxg = -g*(xg) = -g*(-gx) = g*gx = (g*g)*x = x
    # Wait careful: using the mult defined: gx*g = -x (see M). So (-gx)*g = x.
    # So S(gx) = x. Coord on x is +1:
    S[3,4] = 1

    HopfCore.FiniteHopf{T}(n, labels, M, η, Δ, ε, S)
end

end # module
