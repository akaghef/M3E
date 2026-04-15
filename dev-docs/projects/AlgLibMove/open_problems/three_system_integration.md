---
project: AlgLibMove
topic: StrAlg/VectAlg/PolAlg 3 系統の相互変換と共通抽象の Julia 側設計
status: open problem (別セッションで決定)
created: 2026-04-15
related:
  - ../investigations/three_system_inquiry.md
  - ../debt_register.md
---

# 問題設定

MATLAB 側で StrAlg (自由代数)・VectAlg (有限次元 Hopf)・PolAlg (可換多項式) の 3 系統が
並立しているが、3 系統間の相互変換 API は未整備、共通抽象 (`IAlg`, `HopfAlg`) の位置付けも
曖昧。Julia 移植時にこれらをどう整理するかを決める。

# 背景

- three_system_inquiry.md § 1-7 で実コード調査済。結論: 並立ではなく「表現粒度で分担」。
- 同 § 3 で VectAlg ⊃ SparseEx は composition で十分と判明 (#23 クローズ見込み)。
- 同 § 4 で相互変換 API は未整備、ユーザーコード (`C250814Uqsl2BorelSmallStr2Vec.m`) で手書き。
- debt #12 (3 系統並立) は最大負債候補、依存 DAG で最上位ピボット。

# 個別 Question

## Q1. HopfAlg の StrAlgebra 版と VectAlgebra 版は同抽象か別物か

- **論点**: `Core/StrAlgebra/HopfAlg.m` と `Core/VectAlgebra/HopfAlg.m` が同名別物。設計ミス疑い。
- **現状の仮説**: 数学的には同抽象 (Hopf 代数公理は表現非依存)。Julia では `AbstractHopfAlg` 1 本化、
  StrAlg/VectAlg はそれを別 implementation として持つ。
- **決定に必要な情報**: 両 HopfAlg の抽象メソッド一覧比較、共通化可能な公理契約の範囲。

## Q2. `IAlg` (Core/common/IAlg.m) の位置付け

- **論点**: Abstract 定義はあるが実継承が確認できない。dead code か未活用 contract か。
- **現状の仮説**: 未活用 contract。Julia 側では `AbstractAlgebra` trait に昇格 or 削除。
- **決定に必要な情報**: grep で IAlg 参照箇所確認、MATLAB 版作者 (ユーザー) への意図確認。

## Q3. PolAlg が SpaceSpec/Bases に依存する意味

- **論点**: PolAlg は可換多項式なのに SpaceSpec を持つ。代入/特殊化の context 保持か。
- **現状の仮説**: 変数命名・order・係数環の context を SpaceSpec に委譲。Julia でも同構造で良い。
- **決定に必要な情報**: PolAlg で SpaceSpec が実際に参照される箇所 (getter/setter 以外で)。

## Q4. calcTE の VectAlg 結合度

- **論点**: `calcTensorExpression` が VectAlg の `bs/cf/sparse` にどれだけ深く結合しているか。
  VectAlg cluster 移植の実難度を決める支配要因。
- **現状の仮説**: `SparseEx` 層で完結、VectAlg とは storage interface 経由で疎結合。
  → sparse_ex_design.md と calc_te_test_suite.md を先行決着すれば VectAlg 本体は並行移植可。
- **決定に必要な情報**: calcTE の呼び出し引数型、戻り値型、VectAlg method 参照箇所の grep。

## Q5. 相互変換 API を Julia 側で新設する場合の設計主体

- **論点**: `StrAlg → VectAlg` は「関係式で商を取って有限次元表現へ評価」という非自明手続き。
  誰が spec を持つか (SpaceSpec 拡張? 別 struct `Representation{S,V}`? trait?)。
- **現状の仮説**: `Representation{S,V}` 別 struct (基底対応表 + 関係式集合) を新設し
  `convert(::Type{VectAlg}, x::StrAlg, rep::Representation)` で変換。SpaceSpec は拡張せず。
- **決定に必要な情報**: 既存ユーザーコードで頻出する変換パターンの列挙、representation を
  再利用したい場面の頻度。

# 決定に影響する制約

- 移植順序 (debt #26): three_system_inquiry.md § 6 で PolAlg → SparseEx → VectAlg cluster →
  StrAlg cluster → 相互変換 が推奨。相互変換 (Q5) は最後。
- behavioral parity (#25): 既存ユーザーコード (`C250814*.m` 等) が動くこと。
- scalar_type_decision.md (Q1=D) との整合 — 相互変換時の係数型 promote ルール。
- AbstractAlgebra.jl 互換を採るか捨てるか (debt #12 決定とも連動)。

# 非ゴール

- SparseEx 内部設計 (→ sparse_ex_design.md)。
- calcTE DSL のパーサ実装 (→ calc_te_test_suite.md)。
- 簡約化 API の命名 (→ simplification_api.md)。
- 具体的な移植スケジュール (→ plan.md)。

# アウトプット期待形式

決定後、以下に反映:

- `decisions/three_system_decision.md` (新規、本ファイル + three_system_inquiry.md を supersede)
- `debt_register.md` #12, #23, #26 を「方針決定」に更新
- Phase C 前に `AbstractHopfAlg` 抽象型の Julia signature を docstring で明記
- 相互変換 API は Phase C 後半の独立マイルストーンとして切り出す
