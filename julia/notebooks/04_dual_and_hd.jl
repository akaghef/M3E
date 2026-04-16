# 04 — 双対 Hopf と Heisenberg double
#
# このノートで分かること:
#   * dualHopf(H) が構造定数をどう入れ替えるか
#   * HD(H) = H* # H の基底 (f_p ⊗ e_a) と次元 n²
#   * hd_mul の意味（Sweedler の小さな例で手計算）
#   * 単位元 1_HD = ε ⊗ 1_H が両側単位として振る舞うこと
#   * 「pairing 非退化」を左正則表現 (H* への作用) の忠実性として検証する流儀
#
# 参考: Kassel §IX.4 (Heisenberg double), Montgomery §9

## セットアップ
using AkaghefAlgebra
using LinearAlgebra
const HC = AkaghefAlgebra.HopfCore

H = Sweedler()
n = H.n                   # 4

## 1. 双対 Hopf の構造定数の対応
Hstar = dualHopf(H)
# M_dual = Δ_H, Δ_dual = M_H, η_dual = ε_H, ε_dual = η_H, S_dual = transpose(S_H)
Hstar.M == H.Δ            # true
Hstar.Δ == H.M            # true
Hstar.η == H.ε            # true
Hstar.ε == H.η            # true
Hstar.S == transpose(H.S) # true

## 2. dual も Hopf 公理を満たす
verifyHopf(Hstar).all

## 3. HeisenbergDouble を作る
HD = HeisenbergDouble(H)
# HD.H と HD.Hstar を保持
HD.H === H ? "same H" : "different"

## 4. HD の積: (f_p ⊗ e_a) * (f_q ⊗ e_b) を 1 つ試す
# Sweedler で (f_1 ⊗ g) * (f_1 ⊗ 1) = ?
# 基底 index: f_1 ⊗ g は (p=1, a=2)、f_1 ⊗ 1 は (q=1, b=1)
out = hd_mul(HD, 1, 2, 1, 1)
# 結果ベクトルは長さ n² = 16。(s-1)*n + t で (f_s ⊗ e_t) を表す
reshape(out, n, n)        # (s, t) 行列で眺める

## 5. 結合律チェック（全 basis triple を回す）
verify_HD_associativity(HD)

## 6. 単位元チェック: 1_HD = ε ⊗ 1 は両側単位
hd_unit_ok(HD)

## 7. 左正則表現 H* への作用の忠実性
# HD の各基底元 (f_p ⊗ e_a) が End(H*) の元として n² 個線形独立
hd_pairing_nondeg(HD)

## 8. 小さな CGA で HD を眺める
C2 = CyclicGroupAlg(2)    # dim 2
HD2 = HeisenbergDouble(C2)
# hd_mul の全 (p,a,q,b) = 2⁴ = 16 パターンを表で
for p in 1:2, a in 1:2, q in 1:2, b in 1:2
    v = hd_mul(HD2, p, a, q, b)
    nz = findall(!iszero, v)
    println("($p,$a)*($q,$b) → nz at $nz, values = ", v[nz])
end

## 9. Taft(3) での HD の次元確認
T3 = TaftAlg(3)
HD3 = HeisenbergDouble(T3)
T3.n^2                    # 81 — HD3 の基底数

## 10. 結合律・単位律・忠実性を Taft でも
verify_HD_associativity(HD3), hd_unit_ok(HD3), hd_pairing_nondeg(HD3)

## 次のノート
# → 05_exercises.jl で手を動かす
