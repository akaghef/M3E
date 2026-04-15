---
project: AlgLibMove
date: 2026-04-15
topic: 負債レジスタ — 移植時に整理する debt 26 項目 + 評価 7 軸
status: 初版（検証状態は M3E facet 9 port_log と class ingest を参照して部分検証化済）
supersedes: debt_brainstorm.md
related:
  - matlab_static_property_debt.md (TypeParam 専用, 別扱い)
  - simplification_strategy.md (B' 簡約化戦略の深掘り)
  - plan.md (工程)
---

# 概要

MATLAB AkaghefAlgebra → Julia 移植で整理対象となる債務を 26 項目 + B' 群 3 項目でカタログ化し、7 軸で評価する。TypeParam（静的プロパティ欠如）は別ファイルで先行処理済のため本レジスタでは扱わない。

### レビューについて

レビューをつけました。何も書いてない部分はベストエフォートで問題ないという認識です。

# 評価軸

| 軸 | 値 | 意味 |
|---|---|---|
| 重大 | 1-5 | 放置時の correctness / perf / 可読性リスク |
| 難度 | 1-5 | 設計思考量 + 実装コード量 |
| 波及 | 1-5 | 影響クラス/facet 数（1=局所, 5=全域） |
| port自 | A/B/C | A=Julia 言語機能で自然解決 / B=小再設計 / C=大再設計 |
| 検証 | 未/部分/済 | 実コードで確認済か（M3E port_log / class ingest 参照） |
| deps | id | 先に解決すべき項目 |
| phase | A2/B/C/D/Meta | 推奨着手フェーズ |
| score | `重大×波及/難度` | 機械ソート用目安 |

---

# A. 型システム・表現力

| # | 項目 | 重大 | 難度 | 波及 | port自 | 検証 | deps | phase | score |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1-based index と暗黙添字規約 | 3 | 2 | 2 | A | 部分 | — | C | 3.0 |
| 2 | `sym` double dispatch | 2 | 2 | 2 | A | 方針済 | — | C | 2.0 |
| 3 | IAdditive mixin 契約曖昧 | 2 | 3 | 3 | B | 部分 | — | C | 2.0 |
| 4 | Dependent プロパティ散在 | 1 | 1 | 2 | A | 済 | — | C | 2.0 |

- **1**: `make(1,2)` で「basis index 1 = 群の identity e_0」のような暗黙ズレ (CyclicGroupAlg)。Julia も 1-based だが `OffsetArrays` / 型レベル index で明示化可能。
- **2**: `InferiorClasses=?sym` で演算優先度を細工 (VectAlg)。MATLAB の言語制約回避のワークアラウンドであり、Julia 側ではゼロベースで「あるべきスカラー型設計」を決める。→ [decisions/scalar_type_decision.md](decisions/scalar_type_decision.md) に問題設定を切り出し（別セッションで決定）。
- **3**: IAdditive の契約がコメントにしか無い。Julia では抽象型 + docstring、または Traits.jl 形式化。
- **4**: VectAlg の `dim, dims, rank`。Julia では単なる関数で十分。

レビュー

２：これもMATLABは使いずらすぎる機能だった。これはMATLABからルールを読み解くのではなく、どうあるべきかを前提として考えてほしい。なぜsymを使用したかというと、symbolic倍するとき、スカラー倍として適切にふるまうために必要だった（primitiveならオーバーロードできていたが）　Inferior Class＝が爆増する可能性がＭＡＴＬＡＢにあった。あ、スカラー型をどうするべきかもちゃんと議論して決定するべきだ。（別セッションで決めるので、問題設定を書き出したファイルを出力）

３これも絶対あったほうがよい。

---

# B. データ構造・パフォーマンス

| # | 項目 | 重大 | 難度 | 波及 | port自 | 検証 | deps | phase | score |
|---|---|---|---|---|---|---|---|---|---|
| 5 | 構造定数を毎回 setConst で再計算 | 3 | 3 | 4 | B | 部分 | 21 | C | 4.0 |
| 6 | SparseEx 独自実装 | 4 | 4 | 5 | B | 部分 | — | C | 5.0 |
| 7 | calcTE 文字列 DSL | 4 | 4 | 3 | B | 済 | 6 | C | 3.0 |
| 8 | reshape 地獄 | 2 | 2 | 3 | A | 部分 | — | C | 3.0 |
| 9 | `dictionary`(R2022b+) 依存 | 1 | 1 | 2 | A | 部分 | — | B | 2.0 |

- **5**: HeisenbergDouble / CyclicGroup 共通。メモ化 / 型レベル生成で吸収（TypeParam 廃止とセット）。
- **6**: MATLAB 疎行列の独自ラッパー。`.key/.val/.size/.Nelem` を持つ COO 的構造で `Elem2NonzeroIndices` 関数フックあり。Julia `SparseArrays` + 薄い struct で代替可能か検証必要。
- **7**: Einstein notation を文字列でパース。Phase B 深掘り済（[phaseB_calcTE_design.mjs](../../../tmp/phaseB_calcTE_design.mjs) および M3E `6_concept_impl_map/Tensor_contraction_DSL_map/julia_port_options/`）。推奨: hand-rolled `@calcTE` マクロ + TensorOperations.jl バックエンド、DataFrames.jl 関係結合を CI シャドー併走。
- **8**: `MH = reshape(MH2, [D^2, D^2, D^2])` 類。Julia の多次元配列 + 型で次元ミス低減。
- **9**: TypeParam 周辺。Julia 標準 Dict で十分。

レビュー

6は慎重さを要する。しかし、安定度高い部分なので、メソッドパターンはそのまま流用できそうな気がする（反論くれ）

７テストケースを大量生成して、パーサーも実装して、検証したい。これもcalcTE単体の問題なので、独立案件として実装すすめやすいはず。テストケースの数式をいくつか考える。

reshapeはそういうものだ。負債ではなく、当然の結果。Uq(sl2+)であれば(q=/zeta_N)、生成元はK^iE^jというN^2個ある。先にN*N行列として用意して、N^2にreshapeするほうが感覚として自然。Heisenberg doubleでもそう。

9Typeparam排除で大丈夫という認識だ。

---

# B'. 簡約化 API（詳細は [simplification_strategy.md](simplification_strategy.md)）

| # | 項目 | 重大 | 難度 | 波及 | port自 | 検証 | deps | phase | score |
|---|---|---|---|---|---|---|---|---|---|
| B'-1 | `calc()` 空スタブ & calcComplete リトライ | 4 | 3 | 4 | B | 済 | — | B/C | 5.3 |
| B'-2 | `C()` 1 文字名オーバーロード & DSL 衝突 | 3 | 2 | 3 | A | 済 | — | C | 4.5 |
| B'-3 | 簡約プリミティブ散在 | 3 | 4 | 4 | C | 部分 | B'-1 | C | 3.0 |

⚠ **注意**: この節は「命名・API 表層の負債」に留める。「いつ簡約すべきか」の戦略問題は言語非依存のため [simplification_strategy.md](simplification_strategy.md) に切り出し済。

- **B'-1**: VectAlg.calc は空スタブ (L317 全行コメントアウト)。StrAlg は `replace(arg,30) + combineTerm + removeZero`、StrEndV は `removeZero` のみ。`calcComplete` が `warning("simplify not completed")` を出す時点で API の信頼性崩壊。Julia では `normalize/simplify/canonicalize` を明示関数で分離、正規形を型で表現。
- **B'-2**: PolAlg.m:198 `function obj=C(obj)` = combineTerm+removeZero、SparseEx.m:248 `function obj=C(obj,arg)` = `arg.level ∈ {low,medium,high}` の重装備。同時に calcTensorExpression の `C{...}` は coproduct 添字記号。読み手の mental model 崩壊。Julia 側では `simplify(x; level=:high)` と `Δ`/`coproduct` の改名で解決。
- **B'-3**: `removeZero, combineTerm, replace, simplify, calc, calcComplete, C` が classdef ごとに重複。どれが正規形を返すか契約不明。正規形型表現 + 明示的前後条件を持つ関数群へ再設計。

なぜＣ（）かというと、手動で呼び出す回数が多かったため。ただ、戦略依存、具体例依存の部分が多いため、あまり厳格に決める必要もないと思う。"calc"は共通のインターフェースとしておくほうが良いな。

---

# C. アーキテクチャ

| # | 項目 | 重大 | 難度 | 波及 | port自 | 検証 | deps | phase | score |
|---|---|---|---|---|---|---|---|---|---|
| 10 | Examples/Core 境界曖昧 | 2 | 1 | 2 | A | 部分 | — | C | 4.0 |
| 11 | FSL2Borel/FSL2Full/FSL3Borel 3 分割 | 3 | 3 | 3 | B | 未 | — | C | 3.0 |
| 12 | **StrAlg/VectAlg/PolAlg 3 系統並立** | 5 | 5 | 5 | C | 未 | — | B(調査) | 5.0 |
| 13 | verify 系混在 | 2 | 1 | 3 | A | 済 | — | D | 6.0 |

- **10**: CyclicGroupAlg は Examples 配下だが実質 Core 機能。Julia モジュール境界で整理。
- **11**: 2 軸型パラメータで 3 classdef → 1 struct。早期成功体験向き。
- **12**: ⚠ **アーキテクチャ最大負債候補**。同じ代数を異なる表現で実装している可能性、共通インタフェース弱。Julia では `AbstractAlgebra.jl` 流儀で抽象化。Phase B で実コード調査先行。
- **13**: `verify/verifyHopf/verifyInt` が classdef 混在。M3E facet 10 で既に整理済。Julia では `Test` モジュール分離。

レビュー

１０：これはexampleでいいよ。本当はGroup ALgebraとして共通化したいが、ＰＪ圏外

１１：具体実験が小さい実験から進むことが多いので、小さい例と大きい例は包含関係があっても両方残す方針をとる。たとえばsl2とsl_nだと、n=2で包含だが、E,F,Hと基底をハードコードできる。

12: VectAlgとPolAlgという大分類がある。計算手法が違う（テンソルか文字列の代数か）という違いがある。両者の抽象化は必要。だが、実装は全然別であることを意識。

１３：分離できるなら分離しておこうか。しかし、ロジックが分離してしまわないかが心配

---

# D. ビルド・ツールチェーン

| # | 項目 | 重大 | 難度 | 波及 | port自 | 検証 | deps | phase | score |
|---|---|---|---|---|---|---|---|---|---|
| 14 | MATLAB バージョン依存 | 2 | 1 | 3 | A | 未 | — | A2 | 6.0 |
| 15 | テスト欠如 | 4 | 3 | 5 | B | 済 | — | D | 6.7 |
| 16 | sym 計算の二重化 | 3 | 3 | 4 | B | 方針済 | — | C | 4.0 |

- **14**: `dictionary` は R2022b+、classdef 細部も版依存。Julia の `Project.toml` で依存明示化。
- **15**: testFunc stub のみ。Julia では `Test.jl` で体系化。
- **16**: `sym` 依存箇所と純数値箇所が classdef 内で混在。`Symbolics.jl` で一元化、または明確に分離。



１６全部symだとパフォ悪化する。ときに、整数、複素数、symbolicと係数は色々変わる可能性がある。基底のクラス"bases.m"はそこの部分の設計が苦しい。インスタンス宣言時に係数型を決める設計がいいかも。デフォの係数型も決めて、入力インターフェースがすっきりすることを心がける。

---

# E. ドキュメント・可読性

| # | 項目 | 重大 | 難度 | 波及 | port自 | 検証 | deps | phase | score |
|---|---|---|---|---|---|---|---|---|---|
| 17 | コピペ痕跡（Sweedler 残骸） | 1 | 1 | 2 | A | 済 | — | B | 2.0 |
| 18 | 命名番号付けブレ (getGenerator/1/2) | 1 | 1 | 2 | A | 済 | — | C | 2.0 |
| 19 | Access=protected 意図不明 | 1 | 2 | 3 | A | 未 | — | C | 1.5 |
| 20 | MATLAB `%` → Julia docstring ルール未定 | 1 | 2 | 5 | A | 未 | — | D | 2.5 |
| 27 | **MATLAB indexing イディオムによる可読性負債** | 4 | 2 | 5 | B | 未 | — | B(前処理) | 10.0 |

- **17**: CGA header "SWEEDLERALG"、setConst L29 コメント残存。ingest 時に観測済。
- **18**: HeisenbergDouble の番号付き名。Julia では dispatch で分岐。
- **19**: MATLAB protected は限定的。Julia では module export 粒度で吸収。
- **20**: 自動変換スクリプト化が現実的。
- **27**: MATLAB の表現力トリック（linear indexing `A(:)`, logical indexing `A(A>0)`, `end` キーワード, `sub2ind`/`ind2sub`, colon 省略 `A(:,k)`, broadcasting 暗黙拡張, `cellfun`/`arrayfun` + 匿名関数の多段ネスト）でロジックを詰めた箇所は、**実装は美しいが意図が読み取れない**。従来の「1:1 忠実移植」原則は人間翻訳前提で、LLM 翻訳では**読みにくいコード = 誤訳リスクが増幅される**。すなわち LLM 翻訳を挟む前提では、**翻訳前に idiom を展開して明示コードにする前処理**が事故抑制に直結する。例: `A(idx)=[]` → 明示 loop or `deleteat!`、`cellfun(@(x)...,C)` → `map` + 名前付き関数、`reshape(x,[a,b,c])` は意味的形状を明記するコメント追加。なお「式は触らない」原則は magic expression にのみ適用し、idiom 展開は対象外として扱う（展開は意味保存、式改変は意味破壊の可能性がある）。



２７単発のA(:,k)とかは美しいのでできれば残してほしい。匿名関数多段ネストはやりすぎだし、誤訳リスクあるので、任せる。

あとはベストエフォート

---

# F. 実行モデル

| # | 項目 | 重大 | 難度 | 波及 | port自 | 検証 | deps | phase | score |
|---|---|---|---|---|---|---|---|---|---|
| 21 | handle vs value 混在 | 3 | 4 | 4 | C | 部分 | — | C | 3.0 |
| 22 | 副作用 setter (set.cf 等) | 2 | 2 | 3 | A | 部分 | — | C | 3.0 |
| 23 | コンストラクタ重さ | 3 | 3 | 3 | B | 部分 | 5 | C | 3.0 |

- **21**: TypeParam は handle（キャッシュ）、VectAlg は value。Julia では `mutable struct` vs `struct` で明示分岐。
- **22**: `set.cf` 等に検証・データ変換を仕込むパターン。Julia では constructor 検証、または `setproperty!` overload。
- **23**: `getGenerator` → `setConst` → tensor 計算連鎖。Julia では軽い struct 構築 + 重い計算を関数化 + メモ化。

23 : VectAlgはSparseExを継承するべきだったか？と迷いがある。しかし、Juliaの特性を考えると、`vectalg.sparseex.primitivenum`という入れ子になりそうだな。



---

# G. メタ・プロセス

| # | 項目 | 重大 | 難度 | 波及 | port自 | 検証 | deps | phase | score |
|---|---|---|---|---|---|---|---|---|---|
| 24 | port 中 refactor 誘惑の境界線 | 3 | 3 | 5 | — | 未 | — | Meta | 5.0 |
| 25 | behavioral parity 移植 | 4 | 3 | 5 | — | 未 | 15 | D | 6.7 |
| 26 | 段階移植 vs 一気移植 | 3 | 3 | 5 | — | 未 | 12 | Meta | 5.0 |

- **24**: ポートは 1:1 が原則だが TypeParam 削除のような明白な改善は採用。線引きルールを先に文書化すべき（例: 「言語機能で自然に書けるものは新設計、振る舞いは一致」）。**LLM 翻訳前提の補正**: 従来の「1:1 忠実移植」は人間翻訳のコストモデル。LLM を介す場合、cryptic な MATLAB idiom は誤読リスクを増幅するため、**翻訳前の可読性改善（#27）は安全性向上策として正当化される**。一方 magic expression（構造的導出式）は意味保存が最優先なので触らない。線引きは「idiom 展開 = 可、式改変 = 不可」。
- **25**: MATLAB テストを Julia にも移植して動作同値を担保。#15 完成後。
- **26**: VectAlg ファミリから始めるか全並列か。#12 調査結果に依存。



24: 単発のA(:,k)とかは美しいのでできれば残してほしい。匿名関数多段ネストはやりすぎだし、誤訳リスクあるので、任せる。
２６：　依存パス(delegation chain)から決定。独立性高いものは独立で。

27:MATLABの謎ロジックの部分はマークを付けて、一括管理(集約)することにしよう。テスト通ったら、問題無しと見なす判断で。



---

# スコア降順トップ 8

| rank | # | score | 項目 |
|---|---|---|---|
| 0 | 27 | 10.0 | **MATLAB indexing イディオム可読性負債**（LLM 翻訳前提で重大） |
| 1 | 15 | 6.7 | テスト欠如 |
| 2 | 25 | 6.7 | behavioral parity 移植 |
| 3 | 13 | 6.0 | verify 系混在（検証済・低難度） |
| 4 | 14 | 6.0 | MATLAB バージョン依存 |
| 5 | B'-1 | 5.3 | calc() 空スタブ & calcComplete |
| 6 | 6  | 5.0 | SparseEx 独自実装 |
| 7 | 12 | 5.0 | **3 系統並立（最大負債候補）** |
| 8 | 24 | 5.0 | refactor 誘惑の境界線 |

# 観察

- **score 上位に「port の前提整備」が集中**（13/14/15/24/25）。Phase C 着手前にこれらの線引きを片付けないと個別負債の評価が定まらない。
- **#12 は score 5.0 だが依存 DAG で最上位** — 解くとモデル全体が簡素化する「ピボット項目」。単体スコアより先行調査。
- **B 群は相互依存が強い**（6→7、21→5、B'-1→B'-3）。cluster で扱う。
- **port 自然度 A の 11 項目**（1,2,4,8,9,10,13,17-20,22）は Julia へ移すだけで自然消滅する「悩む前に書く」カテゴリ。

# 次の一手候補

1. **#12 の実コード調査を Phase B で開始**（Core/StrAlgebra, Core/VectAlgebra, Core/PolAlg* 横断）→ 段階移植戦略 (#26) の根拠を作る
2. **B' クラスタを一括深掘り**（calcTE と同フォーマットで open_question 生成）
3. **#24 の refactor 境界線ポリシーを文書化**（プロジェクト運用規約化）

# TODO

- [ ] #12 実コード調査
- [ ] B' クラスタを Phase B 深掘り対象に追加
- [ ] 検証状態「未」の項目を 1 pass で「部分」以上に昇格
- [ ] M3E `port_log/decision/` に本レジスタ採用を 1 行記録
