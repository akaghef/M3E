---
project: AlgLibMove
topic: 小さい例と大きい例の共存戦略 (FSL2Borel/FSL2Full/FSL3Borel vs FSLnBorel)
status: open problem (別セッションで決定)
created: 2026-04-15
related:
  - ../debt_register.md
---

# 問題設定

MATLAB 側で FSL2Borel / FSL2Full / FSL3Borel のような
「**基底をハードコードした小さい例**」と FSLnBorel のような「**n 一般の大きい例**」が
classdef レベルで別物として共存している (debt #11)。Julia 移植時に
**両方を残すか、一般版のみにして specialization で小例を表現するか**を決める。

# 背景

- debt #11 (score 3.0)、波及 3/5、phase C。
- ユーザーコメント (debt_register.md #11):
  > 具体実験が小さい実験から進むことが多いので、**小さい例と大きい例は包含関係があっても
  > 両方残す**方針をとる。たとえば sl2 と sl_n だと、n=2 で包含だが、E,F,H と基底をハードコードできる。
- 包含関係: n=2 のとき FSLnBorel ⊃ FSL2Borel だが、小例は基底名 (E, F, H) がハードコードされており
  テスト・デバッグがしやすい。

# 個別 Question

## Q1. 小例と大例の共存戦略

- **論点**: Julia で
  (a) type parameter で小例を specialization (`Alg{Val{:sl2}}` vs `Alg{Val{:sln},N}`)、
  (b) 完全に別モジュール (`Examples.FSL2Borel` と `Examples.FSLnBorel`)、
  (c) 大例のみ残して小例は `const FSL2Borel = FSLnBorel{2}` の alias、
  (d) 小例は独自 struct、大例も独自 struct (並立)。
- **現状の仮説**: **(d) 並立** (ユーザー方針に忠実)。小例は `struct FSL2Borel <: AbstractAlg`
  で基底 `const E, F, H` をハードコード。大例は `FSLnBorel{N}` で generate。
  両方のテストを回して parity 検証。
- **決定に必要な情報**: 既存 Examples/ 配下の classdef 数、小例・大例の対応表、
  ユーザーが追加したい未来の小例の予測 (Uq(sl2), Heisenberg, etc.)。

## Q2. ハードコードされた基底 (E, F, H 等) の Julia 側表現

- **論点**: (a) `const E = ...` モジュール定数、(b) `StaticArrays.SVector`、
  (c) `@generated` 関数で型パラメータから導出、(d) `NamedTuple` で `(E=..., F=..., H=...)`。
- **現状の仮説**: **(d) NamedTuple** を struct field で保持。
  `struct FSL2Borel; generators::NamedTuple{(:E,:F,:H),...}; end`。
  名前アクセス (`alg.generators.E`) が可読、型安定。
- **決定に必要な情報**: 基底に対する典型操作 (iterate、getindex、pattern match)、
  StaticArrays が欲しい性能臨界箇所があるか。

## Q3. 包含関係 (n=2 なら小例) の冗長性をどう扱うか

- **論点**: DRY 優先で大例から小例を自動導出するか、両方独立に書いて両方テストするか。
- **現状の仮説**: **両方独立 + 両方テスト** (ユーザー方針)。`@test FSL2Borel() == FSLnBorel{2}()`
  の parity テストを 1 本入れるが、実装は独立。DRY 違反だが意図的 (デバッグ時の isolation)。
- **決定に必要な情報**: 小例・大例のコード重複量の実測、テスト工数。

## Q4. 新しい「小例 = ハードコード版」を追加する規約

- **論点**: 命名・配置・テスト対応・ドキュメントの一貫性。
- **現状の仮説**:
  - 命名: `F<algname><Size><Subset>` (例: `FSL2Borel`, `FUqSL2Full`)。大例は `F<algname>n<Subset>`。
  - 配置: `src/Examples/<family>/` 配下、1 family 1 dir。
  - テスト: `test/Examples/<family>/test_<example>.jl`、parity テスト必須。
  - ドキュメント: 各 struct に docstring で「対応する大例」「ハードコードされた基底」「出典文献」。
- **決定に必要な情報**: 既存 Examples/ 命名の実態調査、families の分類 (Borel/Full、sl/sp/so、group/Hopf)。

# 決定に影響する制約

- scalar_type_decision.md Q1=D: 小例・大例とも `Alg{S}` パラメトリック化を継承。
- three_system_integration.md: 例は StrAlg 系/VectAlg 系の両方に出現 (FSL2Borel は StrAlg、
  FSL3Borel は VectAlg 系の可能性) — 分類軸が交差する。
- behavioral parity (#25): MATLAB 側 Execution/ スクリプトが動くこと。
- 小例を追加しやすい API を保つ (ユーザーの実験スタイルに合わせる)。

# 非ゴール

- Group Algebra 共通化 (ユーザー曰く「PJ 圏外」, debt #10)。
- 未来の代数族 (未実装の Uq(sln) 等) の設計先取り。
- 大例の高速化・generated function 化。

# アウトプット期待形式

決定後、以下に反映:

- `decisions/example_size_decision.md` (新規)
- `src/Examples/CONTRIBUTING.md` (新例追加規約、Q4 の合意形)
- `debt_register.md` #11 を「方針決定」に更新
- 既存 FSL2Borel/FSL3Borel/FSLnBorel 相当の Julia struct スケルトンを Phase C 中盤で配置
