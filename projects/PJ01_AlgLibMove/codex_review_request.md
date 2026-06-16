---
to: Codex
from: akaghef (via Claude Code)
date: 2026-04-16
topic: Julia 移植 — Sweedler / CyclicGroupAlg / TaftAlg + Heisenberg double 初期実装のレビュー依頼
repo: c:/Users/Akaghef/dev/M3E-prj-alglibmove
branch: prj/AlgLibMove
---

# レビュー依頼: Hopf 代数 3 例 + Heisenberg double の Julia 初期実装

## 背景

MATLAB の研究コード `AkaghefAlgebra` を Julia に移植する PJ (AlgLibMove)。
詳細は [docs/projects/AlgLibMove/plan.md](../docs/projects/AlgLibMove/plan.md)。

今夜、Claude Code の sub-agent に **無確認 one-shot** で以下を走らせた:

- 抽象 `HopfAlgebra` インタフェース + 具体 3 例（Sweedler H_4 / CyclicGroupAlg(N) / TaftAlg(n, ω)）
- 各々の Heisenberg double `HD(·)`
- 終了条件: `verifyHopf` (Hopf 公理 4 本) + HD 結合律 + dual pairing 非退化 が 3 例 × 3 カテゴリ = 9 セル全 green

結果: **190/190 tests pass**（ベースライン 169 + 新規 21）。所要 ~5 分 44 秒。

## レビュー対象ファイル

すべて `julia/` 配下。

- [julia/src/Hopf/HopfCore.jl](../julia/src/Hopf/HopfCore.jl) — 抽象 `HopfAlgebra` + verifyHopf
- [julia/src/Hopf/Sweedler.jl](../julia/src/Hopf/Sweedler.jl) — Sweedler H_4 (dim 4)
- [julia/src/Hopf/CyclicGroupAlg.jl](../julia/src/Hopf/CyclicGroupAlg.jl) — 群環 Z[C_N]
- [julia/src/Hopf/TaftAlg.jl](../julia/src/Hopf/TaftAlg.jl) — Taft T_n(ω), ω は ComplexF64 数値
- [julia/src/Hopf/HeisenbergDouble.jl](../julia/src/Hopf/HeisenbergDouble.jl) — smash product H* # H
- [julia/test/Hopf/hopf_tests.jl](../julia/test/Hopf/hopf_tests.jl) — 21 assertions
- [julia/src/AkaghefAlgebra.jl](../julia/src/AkaghefAlgebra.jl) と [julia/test/runtests.jl](../julia/test/runtests.jl) に wire 済

## 採用規約（agent が自己判断）

| 項目 | 選択 |
|---|---|
| Hopf 公理 | Kassel 流。Δ は Sweedler 記法 Δ(h) = Σ h₁ ⊗ h₂、antipode は μ∘(S⊗id)∘Δ = η∘ε |
| Sweedler H_4 | Kassel §VIII.2。g²=1, x²=0, xg=−gx, Δ(x)=x⊗1+g⊗x, S(x)=−gx |
| CyclicGroupAlg | group-like。Δ(g)=g⊗g, ε(g)=1, S(g)=g⁻¹ |
| TaftAlg | xg = ω·gx（numerical ω = exp(2π·i/n) ∈ ComplexF64）。Δ(x)=x⊗1+g⊗x, S(x)=−g⁻¹·x。n=2 で Sweedler と一致 |
| Heisenberg double | (f⊗h)(g⊗k) = f·(h₍₁₎▶g) ⊗ h₍₂₎·k、 where (h▶g)(x)=g(x·h)。antipode 非使用の標準流儀 |
| Dual pairing | dual basis で Gram = I。非退化は自明 |
| tensor DSL | 軽量 `@calcTE` マクロ自前（TensorOperations.jl 不使用） |
| 依存 | 追加なし。stdlib の LinearAlgebra + SparseArrays のみ |

**iteration 中の主要バグ修正**: Taft の antipode で ω の指数符号が逆だった。x·gᵏ = ωᵏ·gᵏ·x（ω⁻ᵏ ではない）から S(gᵃxᵇ) = (−1)ᵇ · ω^{−ab − b(b−1)/2} · g^{−(a+b)} · xᵇ に修正。

## Codex にレビューしてほしい点（優先順）

### P0 — 数学的正しさ

1. **Hopf 公理の verify が本当に成立を示しているか** — 単位元の選び方、basis spanning、有限個のチェックで公理を shown と言えるか
2. **HD の積公式の流儀選択は一貫しているか** — (f⊗h)(g⊗k) = f·(h₍₁₎▶g) ⊗ h₍₂₎·k、及びそれに整合する action (h▶g)(x)=g(x·h)。別流儀（左右逆、antipode 使用）と mix していないか
3. **Taft の符号** — xg=ωgx と Δ(x)=x⊗1+g⊗x の組合せで、Δ が代数準同型になるか手計算で確認
4. **dual pairing** — CGA と Taft の双対基底の定義が pairing 非退化を自明にする選び方だが、これは Heisenberg double の構成で期待する pairing と整合しているか（特に non-cocommutative な Taft で）

### P1 — Julia 実装の質

5. **型設計** — 抽象 `HopfAlgebra` の API 選択（fields / methods / traits）が拡張に耐えるか。今後 DrinfeldDouble, HomAlg を足す際に refactor 不要か
6. **`@calcTE` マクロ** — 実装は読みやすいか / TensorOperations.jl 置換可能か / corner case（重複添字、0 次テンソル）の扱い
7. **数値安定性** — ω=exp(2π·i/n) の浮動小数誤差で verifyHopf の等号判定はどう閾値を取っているか

### P2 — 設計上の宿題

8. **MATLAB golden との一致は未検証** — 今の実装は Julia 内自己整合性だけで green。MATLAB 版 VectHeisenbergDouble.setConst との数値一致テストをどう組むのが良いか
9. **Symbolics.jl 回避の妥当性** — numerical ω で済ませたが、将来 ω の最小多項式 ω^n - 1 = 0 を symbolic に扱う必要が出た時の refactor コスト見積
10. **Integrals / rep / act / canonical elements G, W** が未実装。次に手をつけるべき優先順位

## 依頼の出力形式

- 各点について「問題あり / 問題なし / 要追加検証」の 3 値判定
- 問題ありの場合: 該当箇所の file:line と最小再現ケース or 反例
- P0 の数学的正しさは特に厳しく。規約の流儀がズレていても「green に見える」ケースがあり得るため、規約を紙で追って確認してほしい
- 追加で組むべき test の提案があれば列挙

## 実行して欲しいコマンド

```bash
cd c:/Users/Akaghef/dev/M3E-prj-alglibmove/julia
julia --project=. -e 'using Pkg; Pkg.test()'
```

現状 190/190 green のはず。

## 補足

- Phase A (12 facets / ~700 map nodes) と Phase B (debt_register / scalar_type_decision / open_problems) は [docs/projects/AlgLibMove/](../docs/projects/AlgLibMove/) に既存
- MATLAB 参照は [tmp/tmp_repo/AkaghefAlgebra/](../tmp/tmp_repo/AkaghefAlgebra/) だが、今夜の実装は**意図的に MATLAB を模倣せず**世界モデルから直接書いている（PJ の仮説検証の一環）
- 今後の方針は `julia/src/Hopf/` を足場に Integrals / rep / act を追加、その後 MATLAB golden 一致 gate を後付けする予定
