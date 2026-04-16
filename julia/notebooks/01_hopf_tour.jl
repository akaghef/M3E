# 01 — FiniteHopf の全体ツアー
#
# このノートで分かること:
#   * FiniteHopf{T} がどんな field を持つか
#   * M / Δ / ε / S の shape と意味
#   * verifyHopf が返す NamedTuple の読み方
#
# 前提: `] activate julia/` 済。初回 `using AkaghefAlgebra` は 10 秒ほどかかる。
#
# つまずきポイント:
#   * M[i,j,k] の index 順は「M[i,j,k] = e_i * e_j の e_k 成分」
#   * Δ[i,j,k] は逆向き。「Δ(e_k) の e_i⊗e_j 成分」
#   * S は列が入力: S[:, k] が S(e_k) の座標

## セットアップ
using AkaghefAlgebra
using LinearAlgebra

## 1. Sweedler を一個作って field を眺める
H = Sweedler()
typeof(H)               # FiniteHopf{ComplexF64}
H.n                     # 4
H.labels                # ["1","g","x","gx"]

## 2. 乗算テーブル M を slice で見る
# e_2 (=g) * e_j の結果を列で並べる
[H.M[2, j, :] for j in 1:4]
# 期待: g*1=g, g*g=1, g*x=gx, g*gx=x

## 3. 余積 Δ を見る
# Δ(x) = x⊗1 + g⊗x の座標
H.Δ[:, :, 3]            # Δ(e_3)=Δ(x)
# (3,1) と (2,3) が 1、他は 0

## 4. 反対偶 ε
H.ε                     # [1,1,0,0]: ε(1)=1, ε(g)=1, ε(x)=0, ε(gx)=0

## 5. antipode 行列 S
H.S                     # 4×4。S[:,3] = S(x) の座標

## 6. 公理検査
r = verifyHopf(H)
# assoc, unit_mul, coassoc, alghom, counit, unit, antipode, all
r.all                   # true
r                       # NamedTuple 全体

## 7. 高レベル関数で演算する
x = zeros(ComplexF64, 4); x[3] = 1     # x
g = zeros(ComplexF64, 4); g[2] = 1     # g

AkaghefAlgebra.HopfCore.mul(H, g, x)   # g*x = gx → [0,0,0,1]
AkaghefAlgebra.HopfCore.mul(H, x, g)   # x*g = -gx → [0,0,0,-1]

## 8. 余積を行列として取る
AkaghefAlgebra.HopfCore.comul(H, x)    # Δ(x) を 4×4 行列で

## 9. 反対偶を適用
AkaghefAlgebra.HopfCore.antipode(H, x) # S(x) = -gx

## 10. 双対 Hopf
Hstar = dualHopf(H)
Hstar.labels            # ["f_1","f_g","f_x","f_gx"]
verifyHopf(Hstar).all   # true — dual も Hopf 公理を満たす

## 次のノート
# → 02_sweedler_by_hand.jl で紙と突き合わせる
