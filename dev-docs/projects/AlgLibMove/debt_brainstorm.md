---
project: AlgLibMove
date: 2026-04-15
topic: MATLAB → Julia 移植で整理すべき負債 — ブレインストーミング
status: draft (未検証, 広く浅く列挙)
---

# 概要

TypeParam（静的プロパティ欠如の回避策, 別ファイル [matlab_static_property_debt.md](matlab_static_property_debt.md) で既に記録）
以外に、Julia 移植で整理可能な負債の方向性を列挙する。

本ドキュメントは**未検証のブレスト**で、個々の項目が実際にコードに
存在するか、どの程度深刻かは再実装フェーズで検証する。

---

# A. 型システム・表現力系

1. **1-based index と MATLAB 独自添字規約**
   - `make(1,2)` で「basis index 1 = 群の identity e_0」のような暗黙のズレ（CyclicGroupAlg）
   - Julia も 1-based だが `OffsetArrays` / 型レベル index で明示化できる

2. **`sym` との double dispatch 問題**
   - `InferiorClasses=?sym` で演算優先度を細工（VectAlg）
   - Julia の `promote_rule` / multiple dispatch で素直に書ける

3. **`IAdditive` のような mixin interface の曖昧さ**
   - MATLAB では interface の契約がコメントにしか無い
   - Julia の抽象型 + 期待メソッドを docstring に明記、あるいは Traits.jl 形式化

4. **`Dependent` プロパティ（get 計算）の散在**
   - VectAlg の `dim, dims, rank` など
   - Julia では単なる関数で十分

# B. データ構造・パフォーマンス系

5. **構造定数を毎回 setConst で再計算**
   - HeisenbergDouble, CyclicGroup 共通
   - メモ化 / 型レベル生成で済む（TypeParam 廃止とセット）

6. **SparseEx の独自実装**
   - MATLAB の疎行列に機能追加したラッパー？
   - Julia には `SparseArrays` + `StaticArrays` で代替可能か検討

7. **`calcTensorExpression('C{5,1,7}C{2,9,8}M{7,9,3}M{8,4,6}', 1:6)` の文字列 DSL**
   - Einstein notation を文字列でパース
   - Julia なら `@tensor` マクロ（TensorOperations.jl）で型安全に
   - **改善インパクト大**

8. **`reshape` 地獄**
   - `MH = reshape(MH2, [D^2, D^2, D^2])` 類
   - Julia の多次元配列 + 型で次元ミスを減らせる

9. **`dictionary`（MATLAB R2022b+ の新型）への依存**
   - TypeParam の dict, その他
   - Julia の Dict は標準で十分強力

# B'. 簡約化 API の設計負債（追加, 重要）

> ⚠ **注意**: この節は「**命名・API 表層の負債**」に留める。
> 「いつ簡約すべきか」という戦略問題は本質的に計算時間とのトレードオフであり、
> 言語を変えても消えない。詳細は別ファイル
> [simplification_strategy.md](simplification_strategy.md) に切り出し済み。
> 移植範囲では命名整理と経験則の明文化に留め、戦略再設計には踏み込まない。


### B'-1. `calc()` — 信頼できない仮想簡約化フック

- VectAlg（基底）: **空スタブ**（全行コメントアウト, L317）
- StrAlg: `replace(arg,30) + combineTerm + removeZero`（30回 replace）
- StrEndV: `removeZero` のみ
- 実装がクラスごとにバラバラ、Liskov 的契約が曖昧
- 決定的な悪臭: **`calcComplete`** という「10回までリトライして simplify を繰り返す」版が
  存在し `warning("simplify not completed")` を出す
  → 「`calc` を呼んでも簡約されているとは限らない」ことが API に刻まれている
- Julia 側では:
  - 「簡約化」は **trait + 明示的パス**（`normalize`, `simplify`, `canonicalize` を別関数に分離）
  - 収束判定は型で保証できる範囲（normal form を型で表現）を増やす
  - リトライループは**停止性を型/関数契約で担保**、あるいは不動点計算として明示

### B'-2. `C()` — 1文字名のオーバーロード地獄

- PolAlg.m:198  `function obj=C(obj)` — `combineTerm + removeZero`
- SparseEx.m:248 `function obj=C(obj,arg)` — `arg.level ∈ {low, medium, high}`,
  `isZero`, `simplify_func`, `DEBUG verify` 付きの**全く別の重装備**
- **名前衝突**: `calcTensorExpression('C{5,1,7}...')` の `C` は **coproduct（Δ）の
  テンソル添字記号**。同一コードベースで `C()` メソッドと `C{...}` DSL が併存し、
  読み手の mental model を破壊する
- Julia 側では:
  - **命名を分離**: `simplify(x)`, `simplify(x; level=:high)` など意味を露出
  - 1 文字名を公開 API にしない（演算子定義なら許容）
  - DSL 側の `C`（coproduct）は `Δ` / `coproduct` に素直に改名

### B'-3. 簡約化プリミティブの散在

- `removeZero`, `combineTerm`, `replace`, `simplify`, `calc`, `calcComplete`, `C`
  が各 classdef に重複実装されている
- どれが「正規形を返す」契約か、どれが「best effort」か不明
- Julia 側では **正規形の型表現** + **明確な前後条件を持つ関数群** に再設計すべき

---

# C. コード組織・アーキテクチャ系

10. **`Examples/` と `Core/` の境界曖昧**
    - `CyclicGroupAlg` は Examples にあるが実質 Core 機能
    - Julia モジュール境界で整理

11. **同じ概念の別クラス分割（FSL2Borel / FSL2Full / FSL3Borel）**
    - 既出。2軸型パラメータで統合 → 3 classdef が 1 struct に

12. **StrAlgebra vs VectAlgebra vs PolAlg の 3 系統並立**
    - 同じ代数を異なる表現で実装している可能性
    - 共通インタフェースが無い / 弱い可能性
    - Julia では `AbstractAlgebra.jl` 流儀で抽象化
    - **アーキテクチャ最大の負債候補 — 要調査**

13. **`verify`, `verifyHopf`, `verifyInt` 等のテスト兼用メソッド**
    - classdef に混在
    - Julia なら `Test` module に分離

# D. ビルド・ツールチェーン系

14. **MATLAB のバージョン依存**
    - `dictionary` は新しめ。`classdef` の細かい挙動も版依存
    - Julia の `Project.toml` で依存を明示化

15. **テストが無い / 弱い**
    - `testFunc` が VectAlg にメソッドとして存在する段階
    - Julia では `Test.jl` で体系化

16. **シンボリック計算の二重化**
    - `sym` 依存箇所と純数値箇所が classdef 内で混在
    - Julia なら `Symbolics.jl` で一元化、または明確に分離

# E. ドキュメント・可読性系

17. **コピペ痕跡**
    - CyclicGroupAlg のコメントに "SWEEDLERALG" が残存（既出）
    - 他にも潜在

18. **命名の番号付けブレ**
    - `getGenerator` / `getGenerator1` / `getGenerator2`（HeisenbergDouble）
    - Julia では dispatch で分岐 → 番号消滅

19. **`Access=protected` などアクセス修飾子の意図**
    - MATLAB の protected は限定的
    - Julia では module export で粒度が変わる

20. **MATLAB doc format（`%` コメント）から Julia docstring への変換ルール未定**

# F. 実行モデル系

21. **`handle` クラス vs value クラスの混在**
    - TypeParam は handle（キャッシュのため）。VectAlg は value?
    - Julia では `mutable struct` vs `struct` で明示的に分岐
    - **設計見直しの機会**

22. **副作用を持つ setter**
    - `set.cf` などで検証やデータ変換を仕込むパターン
    - Julia では constructor での検証、`getproperty` / `setproperty!` overload

23. **コンストラクタの重さ**
    - `getGenerator` が `setConst` を呼び、`setConst` が tensor 計算を走らせる
    - Julia では「軽い struct 構築 + 重い計算は関数化 + メモ化」に分離可能

# G. メタ・プロセス系

24. **移植と同時に refactor したい誘惑**
    - ポートは 1:1 が原則だが、TypeParam 削除のような明白な改善は取り込むべき
    - 線引きルールを決めておく（例: 「言語機能で自然に書けるものは新設計採用、振る舞いは一致」）

25. **MATLAB テストケースを Julia にも移植して behavioral parity を担保**

26. **段階移植 vs 一気移植**
    - VectAlg ファミリから始めるか、全部並列か

---

# 深掘り候補（優先度感覚, 未検証）

| # | 項目 | 理由 |
|---|---|---|
| 7  | tensor DSL                        | 安全性 & 読みやすさの劇的改善 |
| 11 | FSL* 統合                         | 型パラメータ化で 3→1、早期成功体験向き |
| 12 | 3 系統並立の整理                  | アーキテクチャ最大の負債候補 |
| 21 | handle/value 混在                 | Julia 化で mutability 設計を再決定 |
| 5  | 構造定数再計算                    | 性能 & TypeParam 廃止とセット |
| B' | 簡約化 API (calc / C / calcComplete) | 信頼性と可読性に直結、正規形の型表現で劇的改善 |

---

# 次ステップ

再実装着手時に：

1. 各項目を実コードで検証し、深刻度 / 影響範囲を見積もる
2. 12 番（3 系統並立）は先に調査。StrAlgebra / VectAlgebra / PolAlg の
   共通概念と差分を洗い出す
3. 段階移植計画を別ドキュメントで策定
