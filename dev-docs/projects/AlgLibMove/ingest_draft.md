---
project: AlgLibMove
date: 2026-04-15
topic: Step 2 Rapid 投入用ノード構造ドラフト
status: draft
---

# 投入順序

1. ROOT + port_log（facet 0, 9）— manager 同期作成
2. facet 1 配下に 3 クラスを **直列** 投入（VectAlg → VectHeisenbergDouble → CyclicGroupAlg）
3. facet 2（inherits）/ facet 4（uses_class）link batch
4. facet 5（Deep concept）3 個

## 共通 attribute スキーマ

```
class node:
  path, lines, inherits, summary
method/property node:
  path, lines, signature, matlab_doc, group
```

---

## ROOT スケルトン

```
AlgLibMove (root)
├── phase_marker: "Phase A.1"
├── quick_access/
├── scopes/
│   ├── 0_root (self)
│   ├── 1_class_impl
│   ├── 2_class_hier
│   ├── 4_dependency
│   ├── 5_concept (Deep)
│   └── 9_port_log
└── port_log/
    ├── scope_pain/
    ├── format_gap/
    ├── open_question/
    ├── decision/
    ├── tool_wish/
    └── ai_handoff/
```

---

## facet 1 / VectAlg (Core/common/VectAlg.m, 828 lines)

```
class: VectAlg
  inherits: IAdditive, matlab.mixin.indexing.RedefinesBrace
  modifier: InferiorClasses=?sym
  file: Core/common/VectAlg.m
  properties/
    cf              — coefficient (L6)
    bs              — Bases (L9)
    ZERO            — zero element (L11)
    spec            — SpaceSpec (L12)
    sparse          — SparseEx (L14)
    [Dependent]
    dim             — L17
    dims            — L18
    rank            — L19
  methods/
    group:accessors/
      set.cf (L24), get.cf (L27), set.ZERO (L30), get.ZERO (L33)
      get.dim (L785), get.dims (L782), get.rank (L788)
    group:construction/
      VectAlg ctor (L340), setBase (L37), make (L325)
      setSC (L346), setIntegrals (L381), set_c (L548)
    group:operators/
      plus (L130), uminus (L154), eq (L158), mtimes (L167)
      times (L185), lb (L188), mrdivide (L192), mpower (L197)
      or (L225), and (L241), not (L245)
    group:hopf_structure/
      unit (L203), Delta (L249), counit (L256), S (L266)
      algID (L307), algfun (L309)
    group:query/
      getSC (L46), getMor (L59), identifier (L125)
    group:conversion/
      casttype (L109), castCtype (L119), alignNum (L85)
    group:math_helpers/
      lfun (L281), lfun_ (L285), calc (L317)
      ones (L754), zeros (L757), Czeros (L764)
      tensorMor [Static] (L802)
    group:display/
      disp (L581), disp_ (L590), disp0 (L598), disp1 (L603)
      disp2 (L656), disp3 (L675)
      string (L659), latex (L668), removeZero (L652)
      sym (L720), convertTermToSym (L679), pol (L571)
    group:verification/
      verify (L393), verifyHopf (L401), verifyInt (L510), dispInt (L539)
    group:indexing [Access=protected]/
      braceReference (L732), braceAssign (L743), braceListLength (L747)
    group:test/
      testFunc (L561)
```

**⚠ 全 method 列挙すると ~50 ノード。plan.md は「全 method/property を列挙」指示。省略しない。**

---

## facet 1 / VectHeisenbergDouble (Core/VectAlgebra/VectHeisenbergDouble.m, 158 lines)

```
class: VectHeisenbergDouble
  inherits: VectAlg
  doc: "heisenberg double of Hopf algebra H1#H2"
  properties/
    rdim            — dimension of H1 (L4)
    H1              — 1st Hopf algebra (L5)
    H2              — 2nd Hopf algebra (L6)
  methods/static/
    getGenerator (L9)     — H(H2)=H1#H2 smashproduct
    getGenerator1 (L27)   — H(H1)=H1#(H1^*)
    getGenerator2 (L36)   — H(H2)=(H2^*)#H2
  methods/instance/
    split (L47)           — reshape sparse
    setMerge (L52)
    setConst (L57)        ★主要: MH/etaH 計算、quasi 分岐あり
    getGW (L97)           — (G, W, Wi) 返却
    castype (L113)        — H1.bs / H2.bs で cast
    rep (L124)            — matrix 表現
    act (L132)            — H^*=H1 への作用
```

### setConst の注意点（tensor 式）
- `calcTensorExpression('C{5,1,7}C{2,9,8}M{7,9,3}M{8,4,6}',1:6)` — non-quasi 版
- quasi 版は associator Psi を含む 8 因子式
- `MH = reshape(MH2, [D^2, D^2, D^2])`

---

## facet 1 / CyclicGroupAlg (Examples/VectAlgebra/CyclicGroupAlg.m, 74 lines)

```
class: CyclicGroupAlg
  inherits: VectAlg
  modifier: InferiorClasses=?sym
  doc: (コメント誤記 "SWEEDLERALG 4-dimensional Sweedler Hopf algebra")
  properties/
    bs0 [Constant]  — TypeParam(@makeBase) (L4)
    N               — cyclic order (L7)
  methods/static/
    getGenerator (L10)    — (Z,One) 返却
  methods/instance/
    casttype (L21)        — double scalar → set_c([arg;0;0;0])
    setConst (L28)        ★Z/NZ 構造: M(i,j,mod(i+j,N)), C diag, eps=1, eta=δ_0, S(i,mod(-i,N))
  helper_function/
    makeBase (L71)        — Bases(N, "e"+(0:N-1), "Z/NZ")
```

**注**: コメントは Sweedler を書き残したままのコピペ痕跡 → port_log/open_question 候補「setConst のコメントは Z/NZ の記述だが、元コメント Sweedler が残存。意図は Z/NZ で正しいか？」

---

## facet 2 link batch (manager 実行)

```
inherits:
  VectHeisenbergDouble → VectAlg
  CyclicGroupAlg       → VectAlg
  VectAlg              → IAdditive
  VectAlg              → matlab.mixin.indexing.RedefinesBrace
```

## facet 4 link batch (manager 実行)

```
uses_class:
  VectHeisenbergDouble → DualAlg            (placeholder 作成)
  VectHeisenbergDouble → TensorBases        (placeholder)
  VectHeisenbergDouble → calcTensorExpression (placeholder)
  VectHeisenbergDouble → VectQuasiHopfAlg   (isa 分岐, placeholder)
  CyclicGroupAlg       → TypeParam          (placeholder)
  CyclicGroupAlg       → Bases              (placeholder)
  VectAlg              → SparseEx, SpaceSpec, Bases  (各 placeholder)
```

---

## facet 5 Deep concept 3 個

```
concept: Hopf algebra
  formula: (μ, η, Δ, ε, S) 5-tuple + axioms
  axioms:
    - bialgebra (μ, η) algebra + (Δ, ε) coalgebra compatible
    - antipode: μ ∘ (S ⊗ id) ∘ Δ = η ∘ ε = μ ∘ (id ⊗ S) ∘ Δ
  references: [Kassel "Quantum Groups", Ch.III]
  realizes → VectAlg (via setSC / Delta / counit / S)

concept: smash product
  doc: H1 # H2 — crossed product of two Hopf algebras
  realizes → VectHeisenbergDouble.getGenerator

concept: Heisenberg double
  formula: H(H) = H # H^*
  doc: multiplication MH via (Δ ⊗ Δ) ∘ (... ∘ μ ⊗ μ) pattern, L77 tensor expression
  variants:
    - non-quasi: 4-factor tensor
    - quasi: 8-factor with associator Psi
  realizes → VectHeisenbergDouble.setConst
  realizes → VectHeisenbergDouble.getGenerator
```

---

## 予想痛点（port_log 先行仕込み）

1. **scope_pain**: method を全列挙すると VectAlg 一つで ~50 ノード。facet 1 のノード数爆発。ingestion tool 欲しい
2. **format_gap**: MATLAB の `methods(Static)` / `methods(Access=protected)` などの修飾子を M3E の node attribute でどう表現する？
3. **open_question**: `calcTensorExpression('C{5,1,7}...')` の index 規約（Einstein notation の添字割り当て）は世界モデルに落とすべき concept か実装詳細か？
4. **tool_wish**: MATLAB → node 一括化するパーサ（classdef の AST 抽出）
5. **decision**: group 3-cocycle は PJ 範囲外（plan.md 確定済、ここに記録）
6. **open_question**: CyclicGroupAlg のコメント "SWEEDLERALG" 残存 — 意図確認必要
