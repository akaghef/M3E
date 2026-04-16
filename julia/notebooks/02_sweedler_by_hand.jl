# 02 — Sweedler H_4 を紙と突き合わせる
#
# このノートで分かること:
#   * Sweedler 代数の定義公式が実装のどこに入っているか
#   * 基底順 {1, g, x, gx} で M[i,j,k] を一つ一つ確認
#   * 反対偶 S の anti-algebra hom 性を小さな例で verify
#
# Kassel §VIII.2: g²=1, x²=0, xg=-gx, Δ(x)=x⊗1+g⊗x, S(x)=-gx

## セットアップ
using AkaghefAlgebra
const HC = AkaghefAlgebra.HopfCore
H = Sweedler()

## 基底ベクトルを作るヘルパ
ev(k) = (v = zeros(ComplexF64, H.n); v[k] = 1; v)
one_, g, x, gx = ev(1), ev(2), ev(3), ev(4)

## 1. g² = 1 を確認
HC.mul(H, g, g) == one_

## 2. x² = 0
HC.mul(H, x, x) == zeros(ComplexF64, 4)

## 3. xg = -gx
HC.mul(H, x, g) == -HC.mul(H, g, x)

## 4. (gx)² = g·x·g·x = g·(-gx)·x = -g²·x² = 0
HC.mul(H, gx, gx) == zeros(ComplexF64, 4)

## 5. Δ(gx) を算数で — Δ が代数準同型なので Δ(g)Δ(x)
Δg = HC.comul(H, g)
Δx = HC.comul(H, x)
# Δ(g)=g⊗g: 成分(2,2)のみ1
Δg[2,2], sum(abs, Δg) - 1     # (1, 0)
# Δ(gx) は 4×4 matrix として
Δgx = HC.comul(H, gx)
# 期待: Δ(gx) = gx⊗g + 1⊗gx  成分 (4,2)=1, (1,4)=1
Δgx[4,2], Δgx[1,4]

## 6. 反対偶の anti-hom 性: S(x*g) = S(g)*S(x)
Sxg = HC.antipode(H, HC.mul(H, x, g))
rhs = HC.mul(H, HC.antipode(H, g), HC.antipode(H, x))
Sxg ≈ rhs              # true

## 7. antipode の左右逆性: μ∘(S⊗id)∘Δ(x) = ε(x)·1 = 0
# 手で展開: Δ(x)=x⊗1 + g⊗x
#   → S(x)*1 + S(g)*x = (-gx)*1 + g*x = -gx + gx = 0  ✓
sum_ = HC.mul(H, HC.antipode(H, x), one_) .+
       HC.mul(H, HC.antipode(H, g), x)
sum_ ≈ zeros(ComplexF64, 4)

## 8. 公理検査の結果を個別に見る
r = verifyHopf(H)
for field in propertynames(r)
    println(rpad(string(field), 12), " = ", getfield(r, field))
end

## 次のノート
# → 03_cga_and_taft.jl で群環と Taft、n=2 で Sweedler と一致する話
