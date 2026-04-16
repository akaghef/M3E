# 03 — 群環 k[Z/N] と Taft T_n(ω)
#
# このノートで分かること:
#   * 群 Hopf 代数の定義 (group-like: Δ(g)=g⊗g)
#   * Taft の積関係 xg = ω·gx と q-binomial による Δ(x^b)
#   * n=2, ω=-1 で Taft ≅ Sweedler（基底順は違う）
#
# つまずきポイント:
#   * CyclicGroupAlg の基底は g^0, g^1, …, g^{N-1}
#   * Taft の基底順は (a,b) → a*n + b + 1（row-major g^a x^b）
#   * ω は数値 (ComplexF64)。現状 Symbolics 非対応（debt_register ext-3）

## セットアップ
using AkaghefAlgebra
const HC = AkaghefAlgebra.HopfCore

## 1. CyclicGroupAlg(3) を作る
C3 = CyclicGroupAlg(3)
C3.labels            # ["g^0", "g^1", "g^2"]
C3.M[:,:,1]          # e_i*e_j が e_1 に入る係数行列。e_1=g^0 なので対角(1,1),(2,3),(3,2)に1

## 2. 群環は cocommutative: Δ(g)=g⊗g。Δ 行列は 1 がどこに立つ？
[findall(!iszero, C3.Δ[:,:,k]) for k in 1:3]
# 各 k で [(k,k)] のみ → Δ(e_k) = e_k⊗e_k ✓

## 3. ε は全部 1（group-like）
C3.ε

## 4. 反対偶 S(g^k) = g^{-k}
C3.S                 # N=3 で (1→1), (2→3), (3→2) の置換

## 5. verifyHopf
verifyHopf(C3).all

## 6. Taft T_2(-1) — Sweedler と同じか？
T2 = TaftAlg(2)      # ω = exp(πi) ≈ -1 (浮動誤差込み)
T2.labels            # ["g^0 x^0", "g^0 x^1", "g^1 x^0", "g^1 x^1"]
# Sweedler の基底順は {1, g, x, gx} = {(0,0), (1,0), (0,1), (1,1)}
# Taft の基底順は           {(0,0), (0,1), (1,0), (1,1)}
# → 2, 3 の基底番号が swap している

## 7. 手で基底を並び替えて一致確認
# 並び替え置換: Taft 1,2,3,4 ↔ Sweedler 1,3,2,4
σ = [1, 3, 2, 4]
H = Sweedler()
# Sweedler の M を Taft の基底順に並び替え
M_reordered = [H.M[σ[i], σ[j], σ[k]] for i in 1:4, j in 1:4, k in 1:4]
all(isapprox.(M_reordered, T2.M; atol=1e-10))    # true

## 8. Taft T_3(ω), ω=primitive 3rd root
T3 = TaftAlg(3)
size(T3.M)           # (9, 9, 9) — dim² = 9
# 積関係 xg = ω gx を確認: x*g = ω·gx
ω = exp(2π*im/3)
x_idx = 2            # (a=0, b=1) → 0*3+1+1 = 2
g_idx = 4            # (a=1, b=0) → 1*3+0+1 = 4
xg = T3.M[x_idx, g_idx, :]
gx = T3.M[g_idx, x_idx, :]
xg ≈ ω .* gx

## 9. q-binomial 展開の確認: Δ(x^2) を手で
# Δ(x)=x⊗1+g⊗x。ω q-commute の公式で
# Δ(x)² = x²⊗1 + [2]_ω g x ⊗ x + g²⊗x²
# ただし [2]_ω = 1+ω
x2_idx = 3           # (a=0, b=2) → 0*3+2+1 = 3
Δx2 = T3.Δ[:, :, x2_idx]
# [2]_ω 係数が立つ位置: g^1 x^1 (src position (1,1) → idx = 5) ⊗ x (idx=2)
one_plus_ω = 1 + ω
Δx2[5, 2] ≈ one_plus_ω

## 10. verifyHopf は Taft でも通る
verifyHopf(T3).all

## 次のノート
# → 04_dual_and_hd.jl で H* と HD を触る
