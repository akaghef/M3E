---
project: AlgLibMove
topic: 簡約化 API (calc/C/simplify/removeZero/combineTerm/replace) の Julia 側命名・契約
status: open problem (別セッションで決定)
created: 2026-04-15
related:
  - ../investigations/simplification_api_inquiry.md
  - ../simplification_strategy.md
  - ../decisions/scalar_type_decision.md
  - ../debt_register.md
---

# 問題設定

MATLAB 側で `calc / calcComplete / C / simplify / removeZero / combineTerm / replace` が
クラスごとに同名異契約で散在している (VectAlg/StrAlg/StrEndV/PolAlg/SparseEx の 5 classdef)。
Julia 移植で**命名・シグネチャ・契約**を統一する方針を決める。

戦略問題 (いつ簡約するか、eager/lazy) は `simplification_strategy.md` 側で扱う。
本問題は**表層 API** のみに絞る。

# 背景

- simplification_api_inquiry.md § 1 に MATLAB 現状の全メソッドを実コード確認済。
- 同 § 2 で本セッション時点の仮決定 (`calc` を共通 IF 名として維持、`C` は 3 用途に分離改名、
  `removeZero` は戻り値型統一) あり。残る論点を本ファイルで個別 Q に展開。
- 前提決定: scalar_type_decision.md で **Q1=D (`Alg{S<:Number}`)**、**Q2=A (Symbolics.jl)** 確定。
  これに伴い iszero/記号分岐は型パラメータで自動分離済 → 下記 Q5, Q10 は decided elsewhere。

# 個別 Question

## Q1. `simplify` の命名を Julia 標準にそろえるか

- **論点**: `Base.simplify` は存在しない。`LinearAlgebra.normalize` は「ノルム正規化」で衝突。
  `canonicalize` はやや硬い。
- **現状の仮説**: `simplify` (Symbolics.jl と同じ名前) を採用。代数側で extend する。
- **決定に必要な情報**: Symbolics.jl の `simplify` シグネチャとの衝突可能性、ユーザー好み。

## Q2. `level` 引数を値で渡すか型で渡すか

- **論点**: SparseEx.C の `level ∈ {'','low','medium','high'}`。Julia では
  `simplify(x; level=:high)` (kw 値) vs `simplify(x, Val(:high))` (型分岐、zero-cost)。
- **現状の仮説**: 忠実性・実装コストで **A (kw 値)** 採用。ボトルネック検出時に B/C へリファクタ。
- **決定に必要な情報**: ホットパスで simplify が呼ばれる頻度 (Phase B/C の profile 結果)。

## Q3. StrEndV.calc が親 StrAlg.calc を縮退 override する理由

- **論点**: StrEndV の `calc` は `removeZero` のみ (replace/combineTerm 省略)。意図 or バグ。
- **現状の仮説**: 意図的。StrEndV は endomorphism 表現で、関係式適用は `act` 経由のため。
- **決定に必要な情報**: MATLAB 版作者 (ユーザー) への意図確認、`StrEndV.m:90` 周辺の履歴。

## Q4. VectAlg.calc 空スタブの扱い

- **論点**: `calc` が空 (317 行、全コメント)。Julia では `simplify(::VectAlg) = identity` か
  `error("not defined")` か。
- **現状の仮説**: 「VectAlg は storage (SparseEx) 層で簡約済」という暗黙前提。
  Julia では `simplify(x::VectAlg) = (simplify!(x.sparse); x)` として透過委譲。
- **決定に必要な情報**: `plus_` 末尾での `.calc()` 呼び出し時、実際に何が簡約されているか。

## Q5. `iszero` 構造判定 vs 意味判定の API 分離

**→ decided elsewhere**: scalar_type_decision.md Q4 で
「`iszero` は構造判定、厳密判定は簡約化 API に委譲」として確定。
具体形 (`dropzeros(x; iszero=pred)`) は Phase C 実装時に scalar_type 決定と整合して導出。

## Q6. `calcComplete` の retry 上限 10 は経験則か明示パラメータ化か

- **論点**: `iter>10` で warning 打ち切り。魔法数。
- **現状の仮説**: `maxiter::Int = 10; on_nonconvergence::Symbol = :warn` と明示パラメータ化。
  `on_nonconvergence ∈ {:warn, :error, :silent}`。
- **決定に必要な情報**: 10 の由来 (ユーザー問合せ項目)、実績で足りるか。

## Q7. `replace(obj, Ntimes=30)` を不動点 combinator で共通化するか

- **論点**: 30 も魔法数。`fixpoint(step, x; maxiter, converged)` として抽象化するか
  各代数ごとに個別関数を残すか。
- **現状の仮説**: **B (不動点 combinator)** 採用。`fixpoint(replace, x; maxiter=30, converged=all_sorted)`。
- **決定に必要な情報**: StrAlg 以外で不動点反復が必要な代数はあるか (StrEndV は空、PolAlg は 1 shot)。

## Q8. `plus_` 末尾の慣習 `.calc()` を演算子に埋め込むか

- **論点**: MATLAB では `plus_` 末尾で eager simplify する慣習。Julia で `+` に埋め込むと
  lazy 化の余地が消える。
- **現状の仮説**: **明示呼び出しのみ**。演算子は構造レベルの演算のみ、簡約は別呼び出し。
  忠実性のため derived API (`combine`) を用意して eager 版を提供。
- **決定に必要な情報**: simplification_strategy.md 側の eager/lazy 方針、ユーザーコードでの呼び出し頻度。

## Q9. calcTE の `C{...}` を `Δ` (Unicode) か `coproduct` (ASCII) か

- **論点**: Hopf 代数文献慣例は `Δ`、ASCII 互換は `coproduct`。
- **現状の仮説**: マクロ内で両対応。`@calcTE` のパーサが `Δ{a,b}` と `coproduct{a,b}` を
  同一 AST に正規化。デフォルト表示は `Δ`。
- **決定に必要な情報**: エディタでの Unicode 入力コスト、ユーザー好み。

## Q10. `ctype == NumericType.S` 分岐を多重ディスパッチに全面委譲するか

**→ decided elsewhere**: scalar_type_decision.md Q1=D で
**パラメトリック `Alg{S<:Number}` + 多重ディスパッチ**に決定済。
ctype 値フラグは廃止、型パラメータ `S` で自動分岐。

# 決定に影響する制約

- scalar_type_decision.md (Q1=D/Q2=A/Q4) と矛盾しないこと。
- simplification_strategy.md の戦略側結論 (eager/lazy、正規形型) と併せて Phase C 前に確定。
- behavioral parity (#25): MATLAB 側の warning 発生箇所と対応が取れること。
- `@calcTE` マクロ (debt #7) 側での `Δ` 表現と整合。

# 非ゴール

- 「いつ simplify を呼ぶか」の戦略判断 (→ simplification_strategy.md)。
- 正規形型 (`Normalized{T}`) の導入可否 (Decision 4 で保留済)。
- `SparseEx` の内部表現 (→ `sparse_ex_design.md`)。
- 項数爆発時の termination 保証。

# アウトプット期待形式

決定後、以下に反映:

- `decisions/simplification_api_decision.md` (新規作成、本ファイルを supersede)
- `debt_register.md` B'-1/B'-2/B'-3 を「方針決定」に更新
- Phase C 実装前に Julia 側 `simplify`/`dropzeros`/`fixpoint` のシグネチャ docstring に転記
