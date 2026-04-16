---
to: akaghef
from: Codex
date: 2026-04-16
topic: AlgLibMove — Hopf/HD 初期実装の設計整合性レビュー（plan.md / julia_skeleton.md 照合）
repo: c:/Users/Akaghef/dev/M3E-prj-alglibmove
branch: prj/AlgLibMove
related:
  - backlog/codex_review_request_hopf_hd.md    # Codex 宛 (数学的正しさ主体)
  - dev-docs/projects/AlgLibMove/design/julia_skeleton.md
  - dev-docs/projects/AlgLibMove/decisions/scalar_type_decision.md
  - dev-docs/projects/AlgLibMove/migration_strategy.md
---

# 設計整合性レビュー: Hopf 3例 + Heisenberg double

Codex には数学的正しさを依頼したが、本書では **設計成果物（plan.md / julia_skeleton.md / scalar_type_decision.md）と実装との整合** を主軸にレビューする。数学は簡易確認のみ。

対象コミット境界: working tree（未コミット）。レビュー後にローカルで `julia --project=. -e "using Pkg; Pkg.test()"` を再走し、**209/209 green** を確認した。

## 要約

| # | 問題 | 深刻度 | 状態 |
|---|---|---|---|
| 1 | `Hopf/` サブツリーが設計の module 階層に存在しない | **高** | 未解消（方針決定が必要） |
| 2 | `@calcTE` を HopfCore 内に自前定義、`TensorDSL.CalcTE` 計画と衝突 | 中 | 本コミットで削除 |
| 3 | Taft の antipode 導出コメントに符号間違いが複数（最終式は正しい） | 中 | 本コミットで修正 |
| 4 | `hd_pairing_nondeg` がトートロジーでテストとして空だった | 中 | 本コミットで実質化 |
| 5 | `verifyHopf` が単位律 (μ∘(η⊗id)=id) を直接検査していなかった | 中 | 本コミットで修正 |
| 6 | `scalar_type_decision.md`（Symbolics 採用）と実装（ComplexF64 強制）の不整合 | 中 | debt 登録相当、未解消 |
| 7 | `verifyHopf` の tol 式が非浮動型（Rational/Symbolic）で破綻していた | 低 | 本コミットで修正 |
| 8 | `verify_HD_associativity` の `atol=1e-9` がハードコードだった | 低 | 本コミットで修正 |
| 9 | `dualHopf(H)` 自身の Hopf 公理を verify するテストがなかった | 低 | 本コミットで追加 |
| 10 | `Examples/` 計画と具体代数の置き場が不一致 | 低 | 未解消 |

---

## 詳細

### 1. module 階層が設計に従っていない 【高】

[julia_skeleton.md §3.1](../dev-docs/projects/AlgLibMove/design/julia_skeleton.md) の階層:

```
AkaghefAlgebra
├── Core
├── Polynomial
├── Sparse
├── Vector
│   ├── VectAlg
│   ├── VHD          # ← HeisenbergDouble はここ
│   ├── CGA          # ← CyclicGroupAlg はここ
│   ├── DualAlg
│   ├── TensorBases
│   └── VectQuasiHopfAlg
├── String
├── TensorDSL
├── Conversions
└── Examples         # ← Sweedler/Taft などの具体インスタンス
```

実装は [julia/src/Hopf/](../julia/src/Hopf/) に `HopfCore / Sweedler / CyclicGroupAlg / TaftAlg / HeisenbergDouble` を平置き。`Vector.*` / `Examples` の下ではない。

**問題ありの判定**。Stage C.4 着手時に必ず再配置が要る（VHD/CGA が Vector 下に入る前提の gate が migration §5 にある）。

**推奨**: 現段階は実験なので実装は動かさない。ただし：
- debt_register に `hopf_subtree_relocation` エントリを追加
- 設計 §3.1 の表に `Hopf/` 暫定ブランチを記載して「Stage C.4 完了時に Vector 下へ吸収」と明示
- `AkaghefAlgebra.jl` の `include` 行に `# TEMP: pending Stage C.4 rehoming` コメント

本質的には `Hopf/HopfCore` は **抽象インターフェース** なので、最終形では `Core.Interfaces` に `IHopf` trait を置き、VectAlg のひとつの分類として扱うのが整合的。

### 2. `@calcTE` 自前マクロ 【中】

HopfCore.jl 40-132 で einsum 風 `@calcTE` を自前で定義。しかし：

- `julia_skeleton.md §3.1` は `TensorDSL.CalcTE` を独立モジュールで計画
- Project.toml 方針は TensorOperations.jl を backend に採用（§2）
- **実装中で `@calcTE` は一度も使われていない**（grep 済、refs 0）

つまり dead code、かつ将来の正式版と symbol 衝突する。

**本コミットで対応**:
- export/re-export 除外に続き、未使用の `@calcTE` マクロ本体を削除
- 現在の Hopf 実装は明示ループだけで完結
- `TensorDSL.CalcTE` は Stage C.6 で正式に導入すればよい

### 3. TaftAlg antipode 導出コメントの符号 【中】

旧コメントは次を主張していた：

```
x^b g^c = ω^{-bc} g^c x^b      (※誤り)
S(g^a x^b) = (-1)^b ω^{ab - b(b-1)/2} g^{-(a+b)} x^b   (※誤り)
```

正しい導出（`xg = ω gx` から）：

- `g x = ω^{-1} x g`（左から g を xg=ωgx に作用させて整理）
- `x g^c = ω^c g^c x`（c 帰納）
- `x^b g^c = ω^{bc} g^c x^b`（b 帰納）
- `(g^{-1} x)^b = ω^{-b(b-1)/2} g^{-b} x^b`
- `S(g^a x^b) = (-1)^b · ω^{-ab - b(b-1)/2} · g^{-(a+b) mod n} x^b`

コード（`exp_ω = -a*b - div(b*(b-1), 2)`）は **結果としては正しい**。n=2, ω=-1 で Sweedler の S(x)=-gx, S(g)=g, S(gx)=x に一致することも手計算で確認した。

ただし旧コメントは「途中で 2 回符号を間違えて打ち消し合った」痕跡で、将来の読者が信用して変更すると壊す。**本コミットで導出を書き直した**。

### 4. `hd_pairing_nondeg` がトートロジーだった 【中 → 修正済】

```julia
function hd_pairing_nondeg(HD)
    G = HopfCore.pairing_matrix(HD.H)    # ← 常に Matrix{T}(I, n, n) を返す
    abs(det(G)) > 1e-12
end
```

- `pairing_matrix` の本体は無条件に単位行列（HopfCore.jl:319）
- test `@test hd_pairing_nondeg(HD)` は「1 ≠ 0」を確認しているに等しい

Codex レビュー依頼 P0-#4 と直結する。HD 構成に期待する pairing は `⟨f_i, e_j⟩ = δ_{ij}` だが、**それを非退化と確認したいのではなく**、HD の左右 regular action が faithful であることや、HD が `End(H)` と同型になる isomorphism を確認したい（Montgomery §9 / Kadison-Stolin）。

**本コミットで対応**:
- `hd_pairing_nondeg` を「`HD(H)` の `H*` への canonical action が faithful か」を見る検査へ置換
- 具体的には `n²` 個の basis element の作用行列を並べ、`rank == n²` を確認
- あわせて `hd_unit_ok` をテストに入れ、`1_{H*} ⊗ 1_H` の二側単位性も別軸で検証

### 5. `verifyHopf` が単位律を未検査だった 【中 → 修正済】

現 `verifyHopf` は assoc, coassoc, alghom, counit identity, ε∘η=1, antipode を検査。
しかし **μ∘(η⊗id) = id = μ∘(id⊗η)**（unit axiom）を basis で検査していない。

今回の 3 実装は全て `η = e_1` かつ `M[1,j,k] = δ_{jk}` を明示的に設定しているので green だが、将来の Hopf 代数（とくに非標準基底）で見逃す。

**本コミットで対応**:
- `verifyHopf` の `unit` を「μ∘(η⊗id)=id=μ∘(id⊗η)」に変更
- `ε∘η=1` は `unit_scalar` として分離
- `all` は両方を要求するように更新

### 6. scalar_type_decision との不整合 【中】

`decisions/scalar_type_decision.md` は Symbolics.jl 採用を committed decision として記載。
Taft.jl は `promote_type(T, ComplexF64)` を強制（TaftAlg.jl:23）し、ω の最小多項式 `ω^n=1` を symbolic で扱う道を閉じている。

Codex レビュー依頼 P2-#9 で自覚されているが、この「逸脱」は現在 **どこにも記録されていない**。debt_register に:

```
id: taft_numerical_omega
status: tech_debt
decision_conflict: scalar_type_decision.md (Q2=A Symbolics)
trigger: Stage C.1 Core.Scalars 実装時
```

として登録すべき。

### 7. `atol` 式が非浮動型で破綻していた 【低 → 修正済】

```julia
atol=sqrt(eps(real(T <: Complex ? real(T) : float(real(T)))))
```

- T=Rational{Int}: `float(real(T)) = Float64` なので OK
- T=Symbolics.Num: `float` が未定義 / `eps` 未定義で MethodError
- T=ComplexF64: `real(T)=Float64`, OK

型別 dispatch で `_default_atol` を切り、exact type は `0.0`、浮動型だけ `sqrt(eps(T))` を使う形に修正した。
`ok(a,b)` も `atol == 0` のときは `==` に落とすよう変更。

修正後の形:
```julia
_default_atol(::Type{T}) where {T<:AbstractFloat} = sqrt(eps(T))
_default_atol(::Type{Complex{T}}) where {T<:AbstractFloat} = sqrt(eps(T))
_default_atol(::Type) = 0   # exact types
```

### 8. `verify_HD_associativity` の atol ハードコード 【低 → 修正済】

`_hd_atol(T)` を導入し、`verifyHopf` と同じ方針で型依存に修正した。

### 9. `dualHopf(H)` の verify がなかった 【低 → 修正済】

`verifyHopf(dualHopf(H)).all` を 3 例すべてのテストに追加した。

### 10. 具体例の置き場 【低】

設計では `Examples/CyclicGroupAlg_samples` のように **インスタンス** を Examples 下に集める構成（§3.1、§4「逆依存防止」）。現在は Sweedler/Taft/CGA が「型生成関数」の形で core 寄りに置かれている。VHD に参照される関係上、Vector.* 下で良いのか Examples に追い出すのかは TBD_example_size_hierarchy と要整合。

---

## 本コミットで触った修正

1. **TaftAlg.jl**: antipode 導出コメントを正しく書き直し（符号 2 箇所訂正、n=2 での sanity check を明記）
2. **HopfCore.jl**: 未使用の `@calcTE` マクロを削除
3. **AkaghefAlgebra.jl**: `@calcTE` の re-export を除外
4. **HopfCore.jl**: `verifyHopf` に真の unit law を追加し、`unit_scalar` を分離
5. **HopfCore.jl**: `_default_atol` と exact-type fallback を追加
6. **HeisenbergDouble.jl**: `hd_pairing_nondeg` を faithful action 判定へ置換、`hd_unit_ok` を整備
7. **hopf_tests.jl**: `unit_scalar`, `dualHopf(H)` 検証, `hd_unit_ok` を追加

## 触らなかった（方針判断が要る）事項

- `Hopf/` サブツリーの再配置 (#1)
- debt_register への taft_numerical_omega 登録 (#6)

これらは設計判断を伴うため、今回は触っていない。

## 次の手（提案）

1. Codex レビューを先に走らせる（数学 P0 の green 判定が前提）
2. 本書の #1, #6 を debt_register / 設計文書に反映
3. Stage C.1 着手前に #2 (マクロ削除) を片付ける
4. Stage C.4 着手時に #1 (再配置) を gate に含める
