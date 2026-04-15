---
project: AlgLibMove
topic: verify 系メソッド (verifyHopf/verifyInt 等) を Test.jl に分離するかの設計
status: open problem (別セッションで決定)
created: 2026-04-15
related:
  - ../debt_register.md
---

# 問題設定

MATLAB 側で `verify / verifyHopf / verifyInt` 等の検証メソッドが classdef 内部に混在している
(debt #13)。Julia 移植時に
**これらを `Test.jl` モジュールに分離するか、classdef 近接で残すか**を決める。
分離による「ロジック乖離」のリスクをどう抑えるかが核心。

# 背景

- debt #13 (score 6.0)、検証済・低難度、phase D。
- ユーザーコメント (debt_register.md #13):
  > 分離できるなら分離しておこうか。しかし、**ロジックが分離してしまわないかが心配**。
- M3E facet 10 で既に整理済 (「verify 系混在」として記録)。
- verify 系の役割は両義的: (a) 公理検証テスト (Hopf axiom 等)、(b) contract 検証 (入力妥当性)。

# 個別 Question

## Q1. 分離した場合の乖離リスクをどう抑えるか

- **論点**: `src/Alg.jl` と `test/verify_Alg.jl` に分かれると、classdef 側の実装が変わっても
  test 側が追従しない可能性。
- **現状の仮説**: 以下 3 策の組合せ:
  - (a) 共通 utility (`contracts/hopf_axioms.jl`) に検証ロジックを抽出し、`Test.jl` と
    classdef 内部 (assertion mode) の両方から呼ぶ。
  - (b) Julia の `doctest` を docstring に埋め込み、docstring の実行例として公理検証を書く。
  - (c) `@invariant` マクロで classdef に inline 宣言 → 自動 test 生成。
- **決定に必要な情報**: 既存 verify メソッドの数と内部ロジックの類似度、共通化可能範囲。

## Q2. verify は「テスト」か「契約」か

- **論点**: Hopf axiom は数学的真理 (契約)、`verifyInt` は入力検証 (ガード)。性質が違うため
  扱いを分けるべきか。
- **現状の仮説**: **分けて扱う**:
  - 数学的公理 (Hopf axiom、結合律、余結合律) → `Test.@testset` (実行時ではなく CI)。
  - 入力検証 (dim 一致、型整合) → 構造体コンストラクタ内 `@assert` or `check_args`。
    契約に昇格、`Alg(args...) = check_args(args...); new(args...)`。
  - ボーダーケース (記号係数の `iszero`) は simplify API 経由に委譲。
- **決定に必要な情報**: 既存 `verify*` の分類 (axiom vs input guard vs structural consistency)。

## Q3. 分離後もソース近接性を保つ仕組み

- **論点**: `src/` と `test/` に分かれると物理的に遠くなる。Julia エコシステムの慣例。
- **現状の仮説**: Julia 標準の `test/runtests.jl` + モジュールごとに `test/test_<module>.jl`。
  ただし axiom テストは `test/axioms/test_<alg>_hopf.jl` として **代数ごとに 1 ファイル**、
  classdef ファイル名と 1:1 対応させて grep/navigation で容易に辿れるようにする。
  `src/` 内 `@testset` (Revise 時の自動実行) は採用しない (本番コードの膨張回避)。
- **決定に必要な情報**: 代数クラス数 (移植予定の classdef 数)、test ファイル分割の粒度。

## Q4. MATLAB の `verifyHopf/verifyInt` と Julia Test の表現力ギャップ

- **論点**: MATLAB verify* は戻り値 bool で手動 `assert`。Julia `@test` はマクロで rich な
  エラー表示。表現力ギャップの具体は。
- **現状の仮説**: 大きな不足なし。MATLAB 側の `if ~ok; error('...'); end` パターンは
  `@test ok` にほぼ 1:1 変換可能。記号等価性 (`Symbolics.isequal` vs `==`) だけ注意。
- **決定に必要な情報**: MATLAB verify* の具体的 assertion パターン一覧、記号等価性判定の頻度。

# 決定に影響する制約

- scalar_type_decision.md Q4: 記号係数の `iszero` 判定は simplify 委譲 → verify で同判定する
  場合も同 API を使うこと。
- simplification_api.md: verify 内で simplify を呼ぶ場合の戦略整合。
- behavioral parity (#25): MATLAB 側 verify 呼び出しが Julia 側でも成功すること。
- Revise.jl ワークフロー (src と test の同期編集容易性)。

# 非ゴール

- Test framework の選定 (Julia 標準 Test.jl で確定)。
- CI 設定 (別案件)。
- Property-based testing (QuickCheck.jl) の導入 — 将来検討。

# アウトプット期待形式

決定後、以下に反映:

- `decisions/verify_separation_decision.md` (新規)
- `test/` ディレクトリ構成の合意文書
- `debt_register.md` #13 を「方針決定」に更新
- Phase D で verify 系を順次分離、axiom test は代数移植と同時に作成
