# 01. 領域全体の地図と分類軸

「数学 × オントロジー」が何を指すか、まず定義的に押さえる。
その上で全体を 5 レイヤに分け、各レイヤの代表サービスを速引きできるようにする。

## "数学 × オントロジー" とは何か

ここでは以下のいずれかを満たすものを対象にする。

- **Def1.** 数学的対象（定理・定義・例・反例・証明）を **URI / ID 付きエンティティ** として扱う
- **Def2.** 数学表現（式・構造）を **機械可読な構文（MathML / OMDoc / Lean / TeX 以上）** で持つ
- **Def3.** 数学分野・用語を **階層的語彙（MSC / SKOS / Wikidata サブグラフ）** として公開
- **Def4.** 数学コンテンツ間に **形式化された関係**（「〜を前提とする」「〜の一般化」「〜の双対」）を張る
- **Def5.** **形式検証可能**（proof checker が通る）な定理・証明を保有

逆に **対象外寄り** とするもの（完全除外はせず、参考として触れる）:
- ただの PDF アーカイブ（arXiv 本体、zenodo 等）← L4 で軽く触れる
- CAS（Mathematica / SymPy / Maple）← 計算エンジンとしては強いがオントロジー性薄。06 で軽く
- 教育動画（3Blue1Brown / Khan）← コンテンツ扱い、今回スコープ外
- 一般百科事典（Wikipedia の数学記事）← ただし **Wikidata の数学サブグラフ** はスコープ内

## 5 レイヤ構造

各レイヤは「同じ定理」を違う角度から触る。

### L1. 形式証明レイヤ（証明として形式化）
- **本質**: 定理と証明がコンパイル可能な証明項
- **代表**: Lean4 / mathlib4, Coq / MathComp, Isabelle/HOL, Mizar, Metamath, HOL Light, Agda
- **強み**: 究極の正確性、AI 学習素材として価値高
- **弱み**: 人間可読性低、カバー率 < 数学全体の 5%
- **詳細**: [02_proof_libraries.md](02_proof_libraries.md)

### L2. 知識ベースレイヤ（事典として蓄積）
- **本質**: 対象（数列・関数・定理・概念）を ID 付きで事典化
- **代表**: OEIS, DLMF, nLab, PlanetMath, MathWorld, ProofWiki, zbMATH Open
- **強み**: 人間可読性高、網羅範囲広
- **弱み**: 形式度低、互いに繋がっていない
- **詳細**: [03_knowledge_bases.md](03_knowledge_bases.md)

### L3. 記述語彙レイヤ（表現の共通文法）
- **本質**: 数学表現そのものの交換フォーマット
- **代表**: MathML (Presentation / Content), OpenMath + CD, OMDoc, sTeX, LaTeXML, TIPTOP
- **強み**: 異システム間の橋になる
- **弱み**: 採用率低、書き手負担大
- **詳細**: [04_ontology_formats.md](04_ontology_formats.md)

### L4. 書誌・分類レイヤ（論文・著者・分野の意味付け）
- **本質**: 論文・著者・分野コードを RDF/LOD として扱う
- **代表**: MSC 2020, zbMATH, MathSciNet, MaRDI, Wikidata (Q 系列), ORCID, OpenAlex, Semantic Scholar
- **強み**: 既存ワークフロー（引用管理）に近い
- **弱み**: 中身の「数学」には踏み込まない
- **詳細**: [05_semantic_scholarship.md](05_semantic_scholarship.md)

### L5. AI 橋渡しレイヤ（LLM × 形式数学）
- **本質**: LLM が形式系と対話するためのデータ・プロトコル
- **代表**: LeanDojo, miniF2F, ProofNet, NaturalProofs, FIMO, Formal Abstracts, PutnamBench, AlphaGeometry / AlphaProof
- **強み**: 研究開発活発、2023〜2026 で急伸
- **弱み**: 移り変わり激しい、標準化未熟
- **詳細**: [06_ai_math_bridges.md](06_ai_math_bridges.md)

## 分類軸（縦串）

| 軸 | 区分例 | 意義 |
|---|---|---|
| **形式度** | 完全形式 / 半形式 / 自然言語 | AI/検証機にそのまま乗るか |
| **粒度** | 分野単位 / 定理単位 / 式単位 | M3E ノードとの対応取りやすさ |
| **権威性** | 学会運営 / 企業 / コミュニティ / 個人 | 引用時の信頼 |
| **コスト** | 無料公開 / 登録無料 / 有料購読 | 研究室予算依存 |
| **更新頻度** | 日次 / 月次 / 年次 / 凍結 | 最新研究追随可能か |
| **アクセス** | REST / SPARQL / Git / ダウンロード / Web のみ | 自動取込可能性 |
| **ライセンス** | CC-BY / CC-BY-SA / 独自 / 非公開 | 二次利用可否 |
| **日本語対応** | 日本語 UI / 日本語コンテンツあり / 英語のみ | 研究者がアクセスしやすいか |

## クロスレイヤ現象

「同じ定理」を複数レイヤが別々に持っている現象を押さえる。これが統合の価値になる。

| 例: フェルマーの小定理 |  |
|---|---|
| L1 Lean | `Nat.Prime.pow_totient` 近辺の mathlib 宣言 |
| L1 Mizar | 対応する MML 定理 |
| L2 ProofWiki | "Fermat's Little Theorem" 記事 |
| L2 nLab | Fermat quotient / 関連項目 |
| L3 OpenMath | CD `arith1` / `integer1` 経由で式表現 |
| L4 MSC | 11A07 (Congruences) |
| L4 Wikidata | Q190556 |
| L5 miniF2F | 問題集に含まれる |

**論点 Xref.** こういう「同一対象の別表現」を横断で引ける仕組みが欲しい ⇒ M3E がハブになれる可能性。

## M3E 帯域軸（Flash / Rapid / Deep）との対応

本ブレストで並べる外部サービスは、M3E の **帯域進化軸**（[docs/01_Vision/Axes.md](../../../docs/01_Vision/Axes.md)）のどこに接続するかで意味が変わる。
帯域は独立複数軸ではなく **粒度と構造が連動する単一進化軸**:

- **Flash** = 断片・素材。マルチモーダル、日常連結、構造化前
- **Rapid** = **文書 1 つ = syntax tree**（親子、章立て、説明順序あり、線形化可能）
- **Deep** = **文書群 = semantic graph**（多種エッジ、説明順序と独立、世界モデル）

| 本書のレイヤ | 外部側の内部構造 | M3E 側の受入帯域 | 備考 |
|---|---|---|---|
| L1 形式証明（Lean/Coq...） | **uses 1 種の痩せた DAG** | Deep（痩せた形）| 意味エッジは無い。M3E 側で注釈補強が要る |
| L2 知識ベース（nLab/Stacks...） | 多種関係を自然言語で記述 | Deep（主要流入源）| semantic graph の豊かな素材 |
| L3 記述語彙（OpenMath/SKOS）| 式・関係の共通スキーマ | Rapid/Deep 両方の表現層 | エッジ語彙として参照 |
| L4 書誌（zbMATH/KAKEN...） | 論文・著者・分野 DAG | Flash 取込 → Rapid 構造化 → Deep 統合 | 射影（Deep→Rapid）で科研費出力に直結 |
| L5 AI 橋渡し | 変換器・学習データ | 全帯域の操作を補助 | 昇格/体系化/射影の各操作で利用 |

**重要な帯域観の修正**:
- Blueprint（mathlib4）は「Deep の **エッジ 1 種に痩せた形**」であって Rapid ではない（Axes.md 明記）
- M3E の Deep は多種エッジを許容するので Blueprint より広い表現力を持つ
- 現 M3E は **Rapid 中心で実装**、Deep の semantic graph は既存 `GraphLink`（関係線）に芽がある状態

## 現 M3E データモデルに既に存在する二分（訂正）

Glossary（[docs/00_Home/Glossary.md](../../../docs/00_Home/Glossary.md)）の通り、M3E は既に帯域に応じた二つの関係種を持つ:

| 正規語 | 役割 | 対応帯域 |
|---|---|---|
| **edge** | 親子関係のみ（親 → 子） | **Rapid** の syntax tree 骨格 |
| **関係線（GraphLink）** | 親子以外の補助関係 | **Deep** の semantic graph の芽 |

つまり私が前ファイル（07 初版）で「P8 二層エッジ」と名付けた構想は、**実は既存の edge/GraphLink の二分を Deep 側で育てる話**。
外部 Blueprint / Stacks DAG は **GraphLink 側に流入** すべきもので、新しい層を発明する必要はない。

## Rapid ⇄ Deep 往復（本ブレストの中心ループ）

Axes.md の 3 操作は本ブレスト全体の接続原理:

- **体系化** Rapid → Deep: 論文・ノートの syntax tree 群を概念網に編み上げる。L2/L4 の外部構造を取込んで拡充
- **射影** Deep → Rapid: 世界モデルから科研費・学振等の Rapid を切り出す（project_projection_vision 本丸）
- **昇格** Flash → Rapid: マルチモーダル素材を文書化

math_ontology_services の価値は、**Deep 帯域の素材供給源**を M3E に接続することで、体系化と射影の両方を強化する点にある。

## このブレストの狙い

- **網羅が第一**（後から絞る）
- サービスごとに「何を持っているか・どう取れるか・M3E の **どの帯域に流入するか**」を 3 点セットで押さえる
- 02〜06 ファイルで **ジャンル別に列挙**、07 で **M3E 側の接続戦略**（帯域別）、08 で実装コスト見積もり

## 論点（01 レベル）

- **Dz. 対象定義** — Def1〜Def5 のどれを基準にサービスを拾うか
- **Lr. レイヤ境界** — L1〜L5 は重なる（例: nLab は L2 だが形式度部分的に L3 に寄る）
- **Gr. 粒度選択** — どのレイヤを M3E の「第一取込対象」にするか
- **Ov. オーバーラップ** — 同一定理の複数表現をどう名寄せするか（Xref 論点）
- **Jp. 日本語戦略** — 日本語化された窓口がない領域にどう関わるか
