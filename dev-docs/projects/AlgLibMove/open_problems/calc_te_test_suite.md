---
project: AlgLibMove
topic: calcTE (Tensor Expression DSL) のテストスイート生成とパーサ実装
status: open problem (別セッションで決定)
created: 2026-04-15
related:
  - ../debt_register.md
  - ../investigations/three_system_inquiry.md
  - ../open_problems/sparse_ex_design.md
---

# 問題設定

MATLAB `calcTensorExpression` は Einstein notation を文字列 DSL でパースして
テンソル演算を実行する。Julia 移植時に
**(a) テストケースを大量生成して golden data を作り、(b) Julia 側パーサを実装し、
(c) 移植の正当性を検証する**独立案件として進める。本ファイルはその設計論点を列挙する。

# 背景

- debt #7 (score 3.0、波及 3/5)、Phase B 深掘り済
  ([phaseB_calcTE_design.mjs](../../../../tmp/phaseB_calcTE_design.mjs) 参照)。
- 推奨実装: hand-rolled `@calcTE` マクロ + `TensorOperations.jl` バックエンド、
  DataFrames.jl 関係結合を CI シャドー併走。
- ユーザーコメント (debt_register.md #7):
  > テストケースを大量生成して、パーサーも実装して、**検証したい**。
  > calcTE 単体の問題なので独立案件として進めやすいはず。テストケースの数式をいくつか考える。
- calcTE DSL の記号: `C{...}` (coproduct、`Δ` に改名予定、simplification_api.md Q9)、
  `M{...}` (multiplication)、単段/多段 contraction、識別子添字。

# 個別 Question

## Q1. テストケース生成の網羅戦略

- **論点**: 何をどう組み合わせれば DSL 機能を網羅できるか。
- **現状の仮説**: 以下 6 カテゴリを cross product:
  1. 単純テンソル積 `a^i b^j`
  2. contraction 単段 `a^i b_i`
  3. contraction 多段 `a^{ij} b_i c_j`
  4. coproduct `Δ{a,b}` (= `C{...}`) の左右分岐
  5. multiplication `M{a,b}` と coproduct の混合
  6. 識別子添字のシャドー・再利用 (`a^i b^i` の意図違いパターン)
- **決定に必要な情報**: MATLAB 側の実際の使用例頻度 (Examples/ の grep 結果)、
  エッジケース (空添字、0-rank、自己収縮) の網羅必要性。

## Q2. Golden data 生成の MATLAB スクリプト

- **論点**: 既存 MATLAB `calcTensorExpression` を走らせて (入力文字列, 引数配列, 期待 SparseEx)
  を JSON/CSV にシリアライズする方法。
- **現状の仮説**: `Execution/` 配下に `generate_calcTE_golden.m` を作成し、Q1 の組合せを回して
  `SparseEx.key/val/size` を `jsonencode` でダンプ。
- **決定に必要な情報**: MATLAB 側 `jsonencode` の `sym` 対応、記号係数を含む場合のシリアライズ方式
  (string 化 + Julia 側 `Symbolics.parse_expr_from_string`)。

## Q3. Parser 実装方針

- **論点**: (a) 手書き descent parser、(b) Julia `Meta.parse` 流用 (中置記法のみ)、
  (c) `TensorOperations.jl` の既存パーサ流用、(d) `ParserCombinator.jl` 等。
- **現状の仮説**: **(a) 手書き descent + マクロ `@calcTE`**。DSL が小さく (10 種程度の構文)、
  エラーメッセージを制御したい。`TensorOperations.jl` の `@tensor` とは構文が違うので流用不可。
- **決定に必要な情報**: DSL の正式 BNF (未整備、Phase B 資料から抽出)、`Meta.parse` で
  `C{a,b}` (curly brace) が通るかの確認。

## Q4. テスト表現の DSL / 記録フォーマット

- **論点**: `(元文字列, 引数 1:6, 期待 SparseEx)` をどう記録するか。
- **現状の仮説**: TOML または JSONL で
  ```
  {"expr": "a^i b_i", "args": [...SparseEx serialization...], "expected": {...}}
  ```
  1 ケース 1 行、`test/calcTE/golden/*.jsonl`。Julia 側 `Test.@testset` でロードしてループ。
- **決定に必要な情報**: SparseEx のシリアライズ形式 (sparse_ex_design.md Q2 と連動)、
  記号係数の往復可能性。

## Q5. ユーザー記入スロット (具体数式例)

ユーザーが思いつくテスト対象数式をここに追記する。**agent は埋めない**。

### 記入スロット (空)

- 例: Uq(sl2+) の `K^i E^j` (N × N = N² 個の生成元、N²×N² reshape パターン)
- 追加例 1: _TBD (ユーザー記入)_
- 追加例 2: _TBD_
- 追加例 3: _TBD_
- 追加例 4: _TBD_
- 追加例 5: _TBD_

記入 template:
```
- 名前: <代数名・例名>
- 入力文字列: <DSL 文字列>
- 引数型: <VectAlg / SparseEx / その他>
- 期待出力の概形: <rank / 次元 / 非零パターン>
- 目的: <この例が testing する論点>
```

# 決定に影響する制約

- sparse_ex_design.md の SparseEx 内部表現が先に固まっていること (golden data の形が依存)。
- scalar_type_decision.md Q1=D: 記号係数 (`Num`) を含むテストが primary。
- `@calcTE` マクロは Phase C 中盤以降の実装 (shared core + SparseEx 後)。
- MATLAB 側 `calcTensorExpression.m` の safety (意図しない副作用がないこと)。

# 非ゴール

- calcTE の高速化 (TensorOperations.jl バックエンド最適化は Phase D 以降)。
- VectAlg/StrAlg 本体の変換 (→ three_system_integration.md)。
- DSL の拡張 (新記法の追加) — 既存挙動のみ再現。

# アウトプット期待形式

決定後、以下に反映:

- `decisions/calc_te_decision.md` (新規)
- `test/calcTE/golden/*.jsonl` (MATLAB スクリプト生成)
- `src/calcTE/parser.jl` (Julia 手書きパーサ)
- `debt_register.md` #7 を「方針決定」に更新
- calcTE 単体独立案件として Phase C 内のサブマイルストーンに昇格
