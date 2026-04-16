# 05 — 演習
#
# 手を動かして Hopf 代数の API に慣れる。解答セルは `## ANSWER` で区切る。
# 答を見ずに自分で書いてから下に進むこと。
#
# 必要なら `01_..04_` ノートを参照する。

## セットアップ
using AkaghefAlgebra
using LinearAlgebra
const HC = AkaghefAlgebra.HopfCore

# ===========================================================================
# Q1. Sweedler で (1+g)*(1-g) = 0 を座標ベクトル計算で確認せよ
# ===========================================================================
## Q1
H = Sweedler()
# ヒント: e_1 = 1, e_2 = g。座標は a = [1, 1, 0, 0], b = [1, -1, 0, 0]
# HC.mul(H, a, b) が zero になるか確認

## ANSWER Q1
a = ComplexF64[1, 1, 0, 0]
b = ComplexF64[1, -1, 0, 0]
HC.mul(H, a, b)           # [0,0,0,0]

# ===========================================================================
# Q2. CyclicGroupAlg(5) の冪等元 e = (1/5)·Σ_{k=0}^{4} g^k を作り、e² = e を確認
# ===========================================================================
## Q2
C5 = CyclicGroupAlg(5)
# e_ 座標を作って自己積を取る

## ANSWER Q2
e = fill(1/5 + 0im, 5)
HC.mul(C5, e, e) ≈ e

# ===========================================================================
# Q3. Taft(3) で反対偶の 2 乗 S² を行列として計算し、S²(x) を読め
# ===========================================================================
## Q3
T3 = TaftAlg(3)
# T3.S が行列。S² = T3.S * T3.S

## ANSWER Q3
S2 = T3.S * T3.S
x_idx = 2                 # (a=0, b=1)
S2[:, x_idx]              # 対角に ω² などが出る — Taft では S² ≠ id（非可換双対性）

# Taft は involutive ではない: S² = (conjugation by g) × phase
# 一般に ω^{2ab} 等の位相が残る

# ===========================================================================
# Q4. Sweedler で Δ(gx) = Δ(g)·Δ(x) を座標レベルで確認
# ===========================================================================
## Q4
# Δ(g)·Δ(x) とは (H⊗H) での積。これは 4×4 行列同士の「テンソル構造を持つ」積。
# verifyHopf の alghom テストがまさにこれをやっている — 手で再現してみよう。

## ANSWER Q4
H = Sweedler()
Δg = HC.comul(H, ComplexF64[0,1,0,0])   # g
Δx = HC.comul(H, ComplexF64[0,0,1,0])   # x
# (Δg · Δx)[p, q] = Σ_{a,b,c,d} Δg[a,b] Δx[c,d] mul(e_a, e_c)[p] mul(e_b, e_d)[q]
RHS = zeros(ComplexF64, 4, 4)
for a in 1:4, b in 1:4, c in 1:4, d in 1:4
    coef = Δg[a,b] * Δx[c,d]
    iszero(coef) && continue
    p_vec = HC.mul(H, ComplexF64[i==a for i in 1:4], ComplexF64[i==c for i in 1:4])
    q_vec = HC.mul(H, ComplexF64[i==b for i in 1:4], ComplexF64[i==d for i in 1:4])
    for p in 1:4, q in 1:4
        RHS[p, q] += coef * p_vec[p] * q_vec[q]
    end
end
Δgx = HC.comul(H, ComplexF64[0,0,0,1])
isapprox(RHS, Δgx; atol=1e-10)

# ===========================================================================
# Q5. HD(Sweedler) で (f_1 ⊗ x)·(f_3 ⊗ 1) を計算し、結果を (f_s ⊗ e_t) 成分の
#    形で表示せよ
# ===========================================================================
## Q5
H = Sweedler()
HD = HeisenbergDouble(H)
# p=1 (f_1), a=3 (x), q=3 (f_3), b=1 (1)
v = hd_mul(HD, 1, 3, 3, 1)

## ANSWER Q5
reshape(v, 4, 4)          # (s, t) 行列で非零成分を見る

# ===========================================================================
# Q6. CyclicGroupAlg(N) の N を変えて dim HD(N) = N² を確認
# ===========================================================================
## Q6
for N in 2:6
    HD = HeisenbergDouble(CyclicGroupAlg(N))
    println("N=$N: HD dim = ", HD.H.n^2, "  assoc=", verify_HD_associativity(HD),
            "  unit=", hd_unit_ok(HD))
end

# ===========================================================================
# Q7. Taft(4) を作って verifyHopf の全項目を print しろ
# ===========================================================================
## Q7
T4 = TaftAlg(4)
r = verifyHopf(T4)
for f in propertynames(r)
    println(rpad(string(f), 14), " = ", getfield(r, f))
end

# ===========================================================================
# おまけ: dualHopf(dualHopf(H)) ≅ H （反射性）
# ===========================================================================
## extra
H = Sweedler()
HH = dualHopf(dualHopf(H))
# M, Δ, η, ε, S が一致するはず（labels のみ "f_f_1" と二重に付く）
HH.M == H.M, HH.Δ == H.Δ, HH.η == H.η, HH.ε == H.ε, HH.S == H.S
