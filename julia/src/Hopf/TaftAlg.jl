# TaftAlg.jl — Taft algebra T_n(ω). Generators g, x with g^n=1, x^n=0, xg = ω gx.
# Dim = n², basis {g^a x^b : 0≤a,b<n}.
# Convention: Δ(g)=g⊗g, Δ(x)=x⊗1 + g⊗x, ε(g)=1, ε(x)=0.
# Antipode: S(g)=g^{-1}, S(x)= -g^{-1} x.
# For n=2, ω=-1 reproduces Sweedler.
# ω is numerical: exp(2πi/n) in ComplexF64 (Symbolics would add friction).

module TaftAlgMod

using ..HopfCore
export TaftAlg

# index map (a,b) -> 1-based: idx(a,b) = a*n + b + 1  with 0≤a,b<n
@inline _idx(a::Int, b::Int, n::Int) = a*n + b + 1

function TaftAlg(n::Int, ω::T = exp(2π*im/n)) where {T<:Number}
    dim = n*n
    labels = ["g^$a x^$b" for a in 0:n-1 for b in 0:n-1]

    # Build multiplication: (g^a x^b) * (g^c x^d)
    # Use xg = ω gx  =>  x^b g^c = ω^{b·c} g^c x^b
    # Hence (g^a x^b)(g^c x^d) = ω^{b c} g^{a+c mod n} x^{b+d}  if b+d < n else 0.
    M = zeros(promote_type(T,ComplexF64), dim, dim, dim)
    CT = eltype(M)
    for a in 0:n-1, b in 0:n-1, c in 0:n-1, d in 0:n-1
        if b+d >= n
            continue   # x^{b+d}=0
        end
        coef = ω^(b*c)
        ai = _idx(a,b,n); aj = _idx(c,d,n)
        ak = _idx(mod(a+c,n), b+d, n)
        M[ai, aj, ak] = CT(coef)
    end

    η = zeros(CT, dim); η[_idx(0,0,n)] = one(CT)

    # Δ(g^a x^b) = Δ(g)^a Δ(x)^b = (g⊗g)^a * (x⊗1 + g⊗x)^b
    # (g⊗g)^a = g^a ⊗ g^a
    # For (x⊗1+g⊗x)^b expand using q-binomial with q=ω:
    #   (x⊗1+g⊗x)^b = Σ_{k=0}^b [b choose k]_ω  g^k x^{b-k} ⊗ x^k
    # where [b choose k]_q is the Gaussian binomial at q=ω.
    Δ = zeros(CT, dim, dim, dim)
    # precompute Gaussian binomials
    qbinom = fill(zero(CT), n+1, n+1)
    qbinom[1,1] = one(CT)   # C(0,0)=1
    for bb in 1:n
        qbinom[bb+1, 1] = one(CT)
        qbinom[bb+1, bb+1] = one(CT)
        for kk in 1:bb-1
            # [b choose k]_q = [b-1 choose k-1]_q + q^k [b-1 choose k]_q
            qbinom[bb+1, kk+1] =
                qbinom[bb, kk] + ω^kk * qbinom[bb, kk+1]
        end
    end

    for a in 0:n-1, b in 0:n-1
        src = _idx(a,b,n)
        # Δ(x)^b expansion
        for k in 0:b
            coef = qbinom[b+1, k+1]
            # left tensor leg: g^a * g^k x^{b-k} = g^{a+k mod n} x^{b-k}  (since g commutes-with-g)
            # Wait — g^a * (g^k x^{b-k}) = g^{a+k} x^{b-k}
            left_a = mod(a+k, n); left_b = b - k
            right_a = a; right_b = k   # right: g^a * x^k = g^a x^k  (no reorder needed)
            li = _idx(left_a, left_b, n)
            ri = _idx(right_a, right_b, n)
            Δ[li, ri, src] += coef
        end
    end

    # counit: ε(g^a x^b) = δ_{b,0}  (ε(g)=1, ε(x)=0; since it's an algebra hom on g^a x^b, and ε(x)=0 kills any b>0 term)
    ε = zeros(CT, dim)
    for a in 0:n-1
        ε[_idx(a,0,n)] = one(CT)
    end

    # Antipode: S is an anti-algebra hom. S(g)=g^{-1}, S(x)=-g^{-1}x.
    # S(g^a x^b) = S(x)^b S(g)^a = (-g^{-1}x)^b g^{-a}
    # Expand (-g^{-1}x)^b step by step using xg = ω gx i.e. g^{-1}x = ω x g^{-1}? Check:
    #   xg = ω gx  =>  g^{-1} x g = ω x  =>  g^{-1} x = ω x g^{-1}.
    # So (-g^{-1}x)^b = (-1)^b * (g^{-1}x)^b.
    # (g^{-1}x)^2 = g^{-1}x g^{-1}x = g^{-1}(xg^{-1})x = g^{-1}(ω^{-1} g^{-1} x) x = ω^{-1} g^{-2} x^2
    # In general (g^{-1}x)^b = ω^{-(0+1+…+(b-1))} g^{-b} x^b = ω^{-b(b-1)/2} g^{-b} x^b.
    # Then S(g^a x^b) = (-1)^b ω^{-b(b-1)/2} g^{-b} x^b g^{-a}
    #                = (-1)^b ω^{-b(b-1)/2} g^{-b} (ω^{-b a} g^{-a} x^b)  [using x^b g^c = ω^{b c}? careful: x g = ω^{-1}... no]
    # Original relation xg = ω gx, so g x = ω^{-1} x g. Then x g^{-1} = ω^{-1} g^{-1} x is above.
    # x^b g^c: move g^c leftward through b x's: each swap x g = ω^{-1} g x, so x^b g^c = ω^{-b c} g^c x^b.
    # Hence g^{-b} x^b g^{-a} = g^{-b} ω^{-b(-a)} g^{-a} x^b = ω^{a b} g^{-(a+b)} x^b
    # So S(g^a x^b) = (-1)^b ω^{-b(b-1)/2} ω^{a b} g^{-(a+b)} x^b
    #              = (-1)^b ω^{ab - b(b-1)/2} g^{-(a+b) mod n} x^b
    S = zeros(CT, dim, dim)
    for a in 0:n-1, b in 0:n-1
        src = _idx(a,b,n)
        exp_ω = a*b - div(b*(b-1), 2)  # Note: b(b-1)/2 integer
        coef = ((-1)^b) * ω^exp_ω
        tgt_a = mod(-(a+b), n)
        tgt_b = b
        tgt = _idx(tgt_a, tgt_b, n)
        S[tgt, src] = CT(coef)
    end

    HopfCore.FiniteHopf{CT}(dim, labels, M, η, Δ, ε, S)
end

end # module
