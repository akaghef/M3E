---
project: AlgLibMove
topic: B' クラスタ (簡約化 API 表層) Julia 設計深掘り
status: 初版 (別セッションで決定)
date: 2026-04-15
scope_note: 命名・API 表層と Julia 型/契約のみ。戦略 (when to simplify) は simplification_strategy.md へ。
related:
  - debt_register.md B'-1/B'-2/B'-3
  - simplification_strategy.md
  - decisions/scalar_type_decision.md
  - debt_register.md #5 #6 #21
---

# 0. スコープ

B' クラスタ (`calc/calcComplete/C/simplify/removeZero/combineTerm/replace`) の**命名・シグネチャ・契約**と **Julia 型設計**のみを扱う。「いつ呼ぶべきか」「eager vs lazy」「項数爆発制御」等の戦略判断は [simplification_strategy.md](../simplification_strategy.md) 参照。

---

# 1. MATLAB 実装の現状

## 1.1 メソッドシグネチャと契約 (実コード確認済)

| クラス | メソッド | 行 | シグネチャ | 実体 | 推測契約 |
|---|---|---|---|---|---|
| VectAlg | `calc` | 317 | `arg=calc(arg)` | **空スタブ** (3 行とも `%` コメント) | 未定義 (呼んでも no-op)。best effort でも無い |
| VectAlg | `removeZero` | 652 | `ret=removeZero(arg)` | **論理配列を返す** (`abs(arg.cf)>1e-10`)。他の removeZero と戻り値型が違う | 述語。VectAlg の簡約は `SparseEx.C` 側で実施 |
| StrAlg | `calc` | 372 | `arg=calc(arg)` | `replace(arg,30); combineTerm; removeZero` | 「30 回関係式適用 + 結合 + 零除去」best effort |
| StrAlg | `calcComplete` | 377 | `arg=calcComplete(arg)` | `while true: replace(30); if sorted break; iter>10 warning` → 最後に `calc()` | 推測: 不動点到達を試みるが **10 外側 × 30 内側 = 300 回**で諦め、warning |
| StrAlg | `replace` | 391 | `replace(obj,Ntimes)` | 関係式適用ループ。`sortedFlag` で収束判定。逆元相殺 | 内部 pass。Ntimes 回で打ち切り |
| StrAlg | `removeZero` | 501 | `obj=removeZero(obj)` | `ctype==S` なら `isAlways(cf==0)` + `simplify(sym(...))` ; 数値なら `eps` ベース | 正規化。型分岐 |
| StrEndV | `calc` | 90 | `arg=calc(arg)` | `removeZero` のみ (replace/combineTerm **なし**) | 継承関係 (StrEndV < StrAlg) を override 、親の calc を **弱く** 上書き。意図不明 |
| StrEndV | `removeZero` | 115 | (コメントアウト) | 無実装 (親 StrAlg のを継承) | — |
| StrEndV | `replace` | 129 | `obj=replace(obj,~)` | **空本体**。Ntimes 引数無視 | override で関係式適用を抑止 |
| PolAlg | `C` | 198 | `obj=C(obj)` | `combineTerm; removeZero` | 可換なので replace 不要。これが事実上の `calc` |
| PolAlg | `removeZero` | 204 | `obj=removeZero(obj)` | `try isAlways+simplify(sym) / catch eps 判定` | 例外で型分岐 |
| SparseEx | `C` | 248 | `obj=C(obj, arg)` name-value: `isZero`, `simplify_func`, `level ∈ {'','low','medium','high'}` | `combineTerm; simplify_func(val); removeZero(isZero)` | **重装備**。level で `simplify_func` を差し替え可 |
| SparseEx | `removeZero` | 264 | `removeZero(obj, isZero)` | 述語 `isZero` を受けて key/val から削除 | strategy pattern |
| SparseEx | `combineTerm` | 275 | `combineTerm(obj)` | `sortrows(key)` + `cumsum` で group by | 同類項結合、決定的 |

## 1.2 観察された非一貫性

- **同名異契約**: `removeZero` は StrAlg/PolAlg では `obj→obj`、VectAlg では `obj→logical`、SparseEx では `obj, isZero→obj`。三通り。
- **`calc` の 3 バリエーション**: VectAlg=空、StrAlg=3 段、StrEndV=1 段。共通インタフェース名だが中身がバラバラ。
- **`C` の 3 用途**: PolAlg (軽量)、SparseEx (level 付き重装備)、calcTE 内の `C{...}` (coproduct 添字 — これはメソッドではなく DSL 記号)。
- **`simplify` 自体はクラスメソッドには無い**。Symbolic Math Toolbox の `simplify(sym)` を `removeZero` 内で呼ぶのみ。
- **リトライ停止性**: `calcComplete` は `iter>10` で警告して打ち切り。不動点保証なし → [simplification_strategy.md](../simplification_strategy.md) 領域。本 doc では「停止性を契約で記述する」方法のみ議論。

## 1.3 呼び出しパターン (grep 観察、8 ファイル 15 箇所)

- `plus_` の末尾で `.calc()` / `.C()` 呼び出しが多い → **和の直後に eager 簡約**が慣習。
- ユーザーコード (Execution/) でも明示的に `.calc()` を呼ぶ箇所あり → **規約は無い**、書き手の裁量。

---

# 2. Decisions (本セッションで固めた方針)

1. **`calc` を共通インタフェース名として維持** (ユーザー明言: 「"calc" は共通のインターフェースとしておくほうが良い」)。Julia 側では `simplify!` / `simplify` とエイリアスして、**呼び出し側のコードは改名でほぼ壊れない**。
2. **`C` は廃止**。PolAlg の `C` は `simplify`、SparseEx の `C(level=...)` は `simplify(x; level=:high)`、calcTE DSL の `C{...}` は `coproduct`/`Δ` に分離改名。3 用途の名前衝突を解消。
3. **`removeZero` の戻り値型を統一**。VectAlg 版 (logical を返す) は `iszero_mask` に改名、StrAlg/PolAlg/SparseEx 版は `dropzeros` (Julia 慣用) または `remove_zero_terms` に統一。
4. **strategy 問題に踏み込まない**: 正規形型 `Normalized{T}` の導入は保留。経験則的呼び出し位置は忠実再現。→ [simplification_strategy.md](../simplification_strategy.md)。
5. **`calcComplete` の `warning` は保持**。停止性は保証せず、原理的困難への pragmatic 対応であることを docstring に明記。[simplification_strategy.md](../simplification_strategy.md) の § 書き換え系参照。

---

# 3. Open Questions (次セッション議題、10 件)

| # | 問 | 焦点 | 関連 |
|---|---|---|---|
| Q1 | `simplify` の名前を Julia 標準にそろえるか (`simplify` vs `normalize` vs `canonicalize`)。`Base.simplify` は無い、`LinearAlgebra.normalize` は別意味 (ノルム正規化) で衝突。 | 名前衝突回避 | Decision 1 |
| Q2 | `level` 引数を値で渡すか (`simplify(x; level=:high)`) 型で渡すか (`simplify(x, Val(:high))`)。後者は method dispatch で分岐でき、zero-cost。 | 型 vs 値 | SparseEx.C |
| Q3 | StrEndV の `calc` が親 StrAlg の `calc` を**縮退** override している理由は意図的か (endomorphism では関係式適用不要) か、バグか。移植時に同じ振る舞いを維持するか。 | 継承の意味保存 | StrEndV:90 |
| Q4 | VectAlg の `calc` が空スタブなのは「VectAlg は既に正規形」という暗黙前提か、未実装か。Julia 側で `simplify(::VectAlg) = identity` を書くか `error` を書くか。 | 契約の明示 | VectAlg:317 |
| Q5 | `removeZero` の述語 `isZero::Function` を SparseEx が受けるが、StrAlg/PolAlg は内部で `ctype` 分岐している。Julia では「zero 判定を型メソッド `iszero` に委譲 (構造判定)」と「ユーザ供給の `isapprox(_, 0)` 述語 (意味判定)」を **別 API** として分離すべきか。 | 構造/意味判定分離 | #16 scalar_type |
| Q6 | `calcComplete` の retry 上限 10 はどこから来た経験則か (ユーザー問合せ項目)。Julia では `maxiter::Int = 10; on_nonconvergence::Symbol = :warn (\|:error\|:silent)` のように明示パラメタ化するか。 | 契約の明示パラメタ化 | StrAlg:377 |
| Q7 | `replace(obj, Ntimes=30)` の 30 も経験値。**不動点 combinator** `fixpoint(f, x; maxiter, tol)` として共通化するか、それとも各代数ごとに個別判定を残すか。 | 抽象化レベル | StrAlg:391 |
| Q8 | `plus_` の末尾で慣習的に `.calc()` を呼ぶパターンを **Julia では演算子オーバーロードに埋め込む** か、**明示呼び出しのみ**にするか。埋め込むと lazy 拡張の余地が消える。 | eager の境界 | [simplification_strategy.md](../simplification_strategy.md) |
| Q9 | `C` の calcTE DSL 用途 (coproduct 添字 `C{a,b}`) を `Δ` にするか `coproduct` にするか。Hopf 代数文献慣例は `Δ`、ASCII 互換は `coproduct`。マクロ内でどちらも許すか。 | 表層命名 | debt #7 calcTE |
| Q10 | `ctype == NumericType.S` (symbolic 分岐) を Julia では `eltype(cf) <: Symbolics.Num` の多重ディスパッチに全面委譲するか、あるいは値フラグを残すか。 | 型 vs 値フラグ | scalar_type_decision |

---

# 4. Julia Port Options (比較 matrix、★5 段階)

評価軸: **安全** (正規形の嘘を作らない) / **性能** (簡約コストを払う頻度) / **忠実** (MATLAB 経験則を壊さない) / **実装** (移植コスト低いほど ★多) / **拡張** (将来 lazy 化の余地)。

## 4.1 正規形の型表現 (Decision 4 で保留だが選択肢は列挙)

| 案 | 安全 | 性能 | 忠実 | 実装 | 拡張 | コメント |
|---|---|---|---|---|---|---|
| **A. 型なし (現 MATLAB と同等)** | ★★ | ★★★★★ | ★★★★★ | ★★★★★ | ★★ | Decision 4 の推奨。`simplify(x)` を値のまま返す。嘘型ゼロ。 |
| B. `Normalized{T}` 二値 | ★★★★ | ★★★ | ★★ | ★★★ | ★★★ | 「正規形とは何か」定義必要。部分簡約が表現できない |
| C. `PartiallyNormalized{Stage, T}` 段階型 | ★★★★★ | ★★★ | ★★★ | ★★ | ★★★★ | Stage ∈ {ZeroRemoved, TermsCombined, FixedPoint}。MATLAB の 3 プリミティブを型で表現できる |
| D. Lazy tree (`SymbolicUtils` 流) | ★★★ | ★ (積で爆発) / ★★★★ (簡約 1 回) | ★ | ★ | ★★★★★ | 別プロジェクト (AlgLibMove 2.0) 案件 |

## 4.2 `simplify` のレベル引数

| 案 | 安全 | 性能 | 忠実 | 実装 | 拡張 |
|---|---|---|---|---|---|
| **A. keyword 値** `simplify(x; level=:high)` | ★★★ | ★★★★ | ★★★★★ | ★★★★★ | ★★★ |
| B. `Val` 型パラ `simplify(x, Val(:high))` | ★★★★ | ★★★★★ | ★★★ | ★★★ | ★★★★ |
| C. trait 分岐 `simplify(HighLevel(), x)` | ★★★★★ | ★★★★★ | ★★ | ★★ | ★★★★★ |

推奨: **A** (忠実・実装重視)。ボトルネック判明したら B/C にリファクタ可能。

## 4.3 `iszero` 構造/意味判定の分離 (Q5)

| 案 | 内容 | 評価 |
|---|---|---|
| **A. 二関数分離** | `iszero(x)` = 構造 (零元 data)、`isapproxzero(x; atol)` = 意味 (数値/symbolic 判定) | ★★★★★ Julia 慣用と一致 |
| B. 一関数 + キーワード | `iszero(x; approx=true, atol=eps)` | ★★★ 呼び出し側で分岐見えにくい |
| C. trait | `ZeroTest` trait に `struct`/`numeric`/`symbolic` | ★★★ 過剰抽象 |

推奨: **A**。SparseEx の `isZero::Function` 引数は A に自然マップ (`dropzeros(x; iszero=my_pred)`)。

## 4.4 リトライループの停止性契約 (Q6, Q7)

| 案 | 内容 | 評価 |
|---|---|---|
| A. 現状忠実 (魔法数 30, 10) | StrAlg.calc/calcComplete をそのまま | 忠実 ★★★★★ / 安全 ★★ |
| **B. 不動点 combinator** | `fixpoint(step, x; maxiter, converged)` を共通化、各代数は `step/converged` を与える | ★★★★ 契約が署名に出る |
| C. 停止保証型 | `WellFounded{T}` + ordering で型レベル停止証明 | ★ Julia で過剰 |

推奨: **B**。`fixpoint(replace, x; maxiter=30, converged=all_sorted)` と書ける。`on_nonconvergence = :warn` で現状 warning 互換。

## 4.5 `C` 3 用途の分離 (Decision 2)

| 用途 | 現 MATLAB | Julia |
|---|---|---|
| PolAlg.C | `combineTerm + removeZero` | `simplify(x)` |
| SparseEx.C | level 付き重装備 | `simplify(x; level=:high, iszero=..., simplify_func=...)` |
| calcTE `C{...}` | coproduct 添字 DSL | `Δ` (Unicode) or `coproduct` (ASCII)、マクロで両対応 |

---

# 5. 関連 debt との連動

- **#5 構造定数 setConst 再計算**: メモ化戦略は正規形型 (4.1 C 案) と相性良いが、保留。戦略問題で一体検討。
- **#6 SparseEx 独自実装**: 4.3 (iszero 分離)、4.2 (level) の受け皿。`SparseArrays.jl` + 薄いラッパーで再実装する際、`simplify` API はラッパー側に来る。
- **#21 handle vs value**: `simplify!` (in-place) と `simplify` (pure) の両方を提供する際、mutable/immutable 選択と噛み合う。VectAlg は現 value だが内部 SparseEx を持つので mutate 可能 → `simplify!` 推奨。
- **scalar_type_decision.md**: Q5 (iszero 分離) と Q10 (ctype==S 分岐) は scalar 型設計に直接依存。両 doc で整合。
- **[simplification_strategy.md](../simplification_strategy.md)**: Q4/Q6/Q7/Q8 の戦略側 (「いつ」「どこまで」) はこちら。本 doc は「どう名付けるか」「型でどう表すか」のみ。

---

# 6. 次アクション

1. Q1, Q2, Q9 は **命名投票**で即決可能 (次セッション頭)。
2. Q3, Q4 は **MATLAB 版作者への問合せ**項目 (意図確認)。
3. Q5, Q10 は **scalar_type_decision.md** と同時決定。
4. Q6, Q7 は **不動点 combinator プロトタイプ実装**で評価 (phase C 実装前の小 spike)。
5. Q8 は [simplification_strategy.md](../simplification_strategy.md) と統合議論。

---

# 7. 推測マーク一覧

- 推測: StrAlg.calcComplete の `iter>10` は経験的試行回数 (要問合せ)。
- 推測: VectAlg.calc 空スタブは「cf が稠密テンソルなので `combineTerm` 不要、`removeZero` は SparseEx 層で吸収」という暗黙前提 (要問合せ、Q4)。
- 推測: StrEndV.replace 空本体は endomorphism 表現上、関係式適用が別経路 (`act`) で起きるため (要問合せ、Q3)。
- 推測: `plus_` 末尾の `.calc()` 慣習は MATLAB 実装者の試行錯誤成果で、壊すと性能退行の可能性が高い ([simplification_strategy.md](../simplification_strategy.md) § 「経験則は値を持っている」)。
