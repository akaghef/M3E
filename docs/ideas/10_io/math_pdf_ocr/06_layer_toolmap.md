# 06. 5 層パイプライン設計 × ツールマップ (2026-04 実調査)

`pdf→ontology_pipeline_design.md` で定義された L0〜L4 の 5 層設計に対して、**各層で使える library / software / app / repo** を 2026-04 時点の WebSearch/WebFetch 調査結果からマップする。

> 注: 02〜04 ファイルはツール「カテゴリ」軸、この 06 は**層**軸。同じツールが複数の視点で登場する。02〜04 と合わせて読むと立体的になる。

## 設計対応表

| 層 | 位置付け | M3E 帯域軸 | 主タスク |
|---|---|---|---|
| L0 | Data Source | （入力） | raw 保存、メタ、ハッシュ、dedup |
| L1 | Physical Extraction | Flash/Syntax | bbox, reading_order, 数式OCR, 図版 |
| L2 | Normalized Document | Rapid/Syntax | AST (Book/Ch/Sec/Thm/Proof/Fig) |
| L3 | Syntax Tree | **Rapid/Syntax** | 厳格な構文ノード、親子順序 |
| L4 | Semantic Tree | **Deep/Semantic** | Concept/Statement/Assumption、defines/uses/proves |
| 横断 | provenance / orchestrate / validate / approve | — | derived_from 保持、人間承認 |

## L0 — Data Source Layer

raw PDF/epub/HTML/画像の保持 + メタデータ。意味解析しない。

| ツール | GitHub / URL | License | 役割 |
|---|---|---|---|
| **BLAKE3-py** | [BLAKE3-team/BLAKE3](https://github.com/BLAKE3-team/BLAKE3) | CC0/Apache-2.0 | ファイル指紋（SHA-256 の 5-10 倍速） |
| **arxiv.py** | [lukasschwab/arxiv.py](https://github.com/lukasschwab/arxiv.py) | MIT | arXiv ID → PDF + abstract |
| **habanero** | [sckott/habanero](https://github.com/sckott/habanero) | MIT | Crossref REST、DOI → CSL-JSON |
| **pyalex** | [J535D165/pyalex](https://github.com/J535D165/pyalex) | MIT | OpenAlex (200M+ work) 引用グラフ |
| **Crossref 2026 data file** | [crossref.org/blog](https://www.crossref.org/blog/2026-public-data-file-now-available/) | CC0 | 180M JSONL、オフライン DOI 辞書 |
| **citeproc-py / pybtex** | inveniosoftware | BSD | CSL-JSON ↔ BibTeX 変換 |
| **datasketch** | [ekzhu/datasketch](https://github.com/ekzhu/datasketch) | MIT | MinHash-LSH で near-dup |
| **text-dedup** | [ChenghaoMou/text-dedup](https://github.com/ChenghaoMou/text-dedup) | Apache-2.0 | MinHash/SimHash 統合 |
| **MinIO** | [minio/minio](https://github.com/minio/minio) | AGPLv3 | S3 互換 raw PDF ストア（自己ホスト） |

**推し**: BLAKE3 + habanero + arxiv.py + pyalex + datasketch。保存は FS または MinIO。

## L1 — Physical Extraction Layer

ページ単位 block: bbox / reading_order / type / text / latex / svg_ref / confidence。

### L1a. 統合レイアウト + OCR + 数式

| ツール | GitHub | License | 2026 状況 |
|---|---|---|---|
| **Docling + Granite-Docling-258M** | [docling-project/docling](https://github.com/docling-project/docling) | MIT / Apache-2.0 (model) | **2026-01 リリース、LF AI 傘下**、式/表/コード/脚注を DocTags で 1 パス出力 |
| **MinerU 2.5-Pro** | [opendatalab/MinerU](https://github.com/opendatalab/MinerU) | Apache 派生 (2.5 で緩和) | **CJK + 混在式 SOTA**、VLM ベース、`MINERU_FORMULA_CH_SUPPORT=1` で中英混在数式 |
| **Marker (datalab)** | [datalab-to/marker](https://github.com/datalab-to/marker) | GPL + 商用 | `--redo_inline_math` `--use_llm` (Gemini Flash 併用)、H100 で 122 pages/s、90+ 言語 |
| **Surya** | [datalab-to/surya](https://github.com/datalab-to/surya) | GPL | Marker の内部エンジン、layout/reading_order/table/math 単体呼び出し可 |
| **Mistral OCR 3 (API)** | [mistral.ai/news/mistral-ocr](https://mistral.ai/news/mistral-ocr) | 商用 | 2026-01 `mistral-ocr-2512`、$2/1k pages、2000 pages/min、手書き式 OK |
| **Nougat** | [facebookresearch/nougat](https://github.com/facebookresearch/nougat) | MIT/CC-BY-NC | 2024 以降停滞、**新規採用非推奨** |

### L1b. PDF 低レベル

| ツール | License | 役割 |
|---|---|---|
| **PyMuPDF (fitz)** | AGPL/商用 | bbox/text/image/SVG、最速・最安定 |
| **pdfplumber** | MIT | 表の罫線抽出・bbox 可視化 |
| **pypdfium2** | Apache-2.0 | ~0.003s/page でラスタライズ |

### L1c. 数式単独 OCR (fallback / 再処理)

| ツール | GitHub | License | 備考 |
|---|---|---|---|
| **UniMERNet 2501** | [opendatalab/UniMERNet](https://github.com/opendatalab/UniMERNet) | Apache-2.0 相当 | **MinerU 内蔵**、CPE BLEU +0.201、CVPR2025 の CDM 指標 |
| **PP-FormulaNet-L / -S** | [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) / [HF](https://huggingface.co/PaddlePaddle/PP-FormulaNet-L) | Apache-2.0 | UniMERNet +6%（-L）or 16x 速（-S）、arXiv:2503.18382 |
| **Texify** | [datalab-to/texify](https://github.com/datalab-to/texify) | GPL | Marker 内蔵、rendering 95% |
| **TexTeller v3** | [OleehyO/TexTeller](https://github.com/OleehyO/TexTeller) | MIT | 80M pair 学習、中英混在/手書き/スキャン |
| **pix2tex / LaTeX-OCR** | [lukas-blecher/LaTeX-OCR](https://github.com/lukas-blecher/LaTeX-OCR) | MIT | 手軽、現在は UniMERNet/Texify に劣る |
| **Pix2Text (pix2text-mfr)** | [breezedeus/Pix2Text](https://github.com/breezedeus/Pix2Text) | MIT | YOLO-MFD 内蔵、80+ 言語 |
| **MixTeX** | [RQLuo/MixTeX-Latex-OCR](https://github.com/RQLuo/MixTeX-Latex-OCR) | MIT | CPU オフライン Windows |
| **Uni-MuMER (2025)** | [arXiv:2505.23566](https://arxiv.org/abs/2505.23566) | 論文 | **手書き SOTA**、CROHME 79.74% |
| **Mathpix Snip / PDF API** | [mathpix.com](https://mathpix.com/pricing/api) | 商用 | $0.002/snip, $0.0035/PDF page |
| **InftyReader (Personal 2026-02)** | [sciaccess.net](https://www.sciaccess.net/en/InftyReader/) | 商用 | 日本発、**スキャン和書・行列特化** |

### L1d. 図版ベクター抽出 (SVG)

| ツール | License | 備考 |
|---|---|---|
| **dvisvgm** | GPLv3 | **TeX 由来なら第一選択**、MathML 埋込可能 |
| **mutool (MuPDF)** | AGPL/商用 | `mutool draw -F svg`、高速 |
| **pdf2svg** | GPLv2 | シンプル、2023 以降停滞 |
| **Inkscape CLI** | GPLv2 | 個別調整用 |

### L1e. 表・図

| ツール | License | 用途 |
|---|---|---|
| **Microsoft Table Transformer** | MIT | PubTables-1M 参照実装 |
| **Camelot / Tabula-py** | MIT | 古典、二次整形 |
| **PDFFigures2** | Apache-2.0 | figure+caption、ただし停滞気味 |
| **GROBID** | Apache-2.0 | **書誌抽出は依然最強**、v0.8+ |

## L2 — Normalized Document Layer

Book/Chapter/Section/Paragraph/Definition/Theorem/Proof/Figure の AST。Markdown はビュー。

### 正本 AST 候補

| 形式 | URL | License | 定理環境 | 数式 | 推奨度 |
|---|---|---|---|---|---|
| **MyST Markdown (mystmd)** | [mystmd.org](https://mystmd.org/spec) / [jupyter-book/mystmd](https://github.com/jupyter-book/mystmd) | MIT | `:::{prf:theorem}` 完全対応 | LaTeX + MathJax/KaTeX | **★★★★★** (Jupyter Book v2 基盤) |
| **Pandoc AST** | [jgm/pandoc](https://github.com/jgm/pandoc) | GPL-2.0 | `Div {class="theorem"}` + filter | `Math InlineMath/DisplayMath` | **★★★★★** 変換ハブ |
| **JATS v1.4** | [jats.nlm.nih.gov](https://jats.nlm.nih.gov/) | Public Domain | `<statement>` 公式対応 | MathML + `<tex-math>` | ★★★★☆ (学術標準) |
| **TEI P5 v4.11** | [tei-c.org](https://tei-c.org/) | CC BY | `<figure type="theorem">` 流用 | MathML | ★★★☆☆ |
| **LaTeXML** | [brucemiller/LaTeXML](https://github.com/brucemiller/LaTeXML) | Public Domain (NIST) | **amsthm/thmtools 完備** | MathML + TeX 注釈 | **★★★★★** (arXiv HTML 基盤、LaTeX 入口) |
| **plasTeX v3.1** | [plastex/plastex](https://github.com/plastex/plastex) | MIT | amsthm 対応 | MathML/MathJax | ★★★☆☆ |
| **tralics** | [tralics/tralics](https://github.com/tralics/tralics) | CeCILL | amsthm 対応 | MathML | ★★☆☆☆ (停滞) |
| **Quarto** | [quarto.org](https://quarto.org/) | MIT | `#thm-` `#lem-` `#prf-` | Pandoc-math + amsthm | ★★★★☆ |
| **Typst** | [typst.app](https://typst.app/) | Apache-2.0 | `theorion` / `great-theorems` (2026-04) | ネイティブ数式 | ★★★★☆ |
| **Docling DocTags** | [docling-project/docling](https://github.com/docling-project/docling) | MIT | 汎用 (数学書特化なし) | 式分離 + LaTeX | ★★★★☆ |
| **unified/remark (mdast)** | [unifiedjs.com](https://unifiedjs.com/) | MIT | `remark-directive` で自作 | `remark-math` | ★★★☆☆ |

**推し**: L2 正本 = **MyST AST** か **Pandoc AST**、LaTeX 入口は **LaTeXML**、PDF からの直接構造化は **Docling DocTags** 補助。

## L3 — Syntax Tree Layer (Rapid/Syntax)

L2 AST → 厳格な構文ノード（DefinitionNode / TheoremNode / ProofNode）。親子関係と順序を保持。M3E 帯域軸の **Rapid/Syntax** に対応。

### LaTeX/数式構文パーサー

| ツール | License | 用途 |
|---|---|---|
| **LaTeXML** (再掲) | Public Domain | LaTeX 全体を XML ツリーに |
| **tree-sitter-latex** | [latex-lsp/tree-sitter-latex](https://github.com/latex-lsp/tree-sitter-latex) | MIT | 構文上の識別 |
| **tree-sitter-markdown** | [tree-sitter-grammars](https://github.com/tree-sitter-grammars/tree-sitter-markdown) | MIT | エディタ用途 |
| **lark-parser** | [lark-parser/lark](https://github.com/lark-parser/lark) | MIT | 独自 grammar |
| **plasTeX** (再掲) | MIT | LaTeX → DOM |

### 標準化スキーマ (Content MathML / OMDoc 系)

| 標準 | URL | 規模 | 用途 |
|---|---|---|---|
| **MathML 3 Content / OpenMath** | W3C / [openmath.org](https://www.openmath.org/) | 標準 | 数式の意味表現 |
| **OMDoc / MMT (KWARC)** | [kwarc.info/systems/omdoc](https://kwarc.info/systems/omdoc/) | GPL | 理論グラフ形式、定理・定義スキーマ |
| **sTeX3** | [github.com/slatex/sTeX](https://github.com/slatex/sTeX) | LPPL | LaTeX 拡張、意味層と接続 |

**推し**: L3 正本は JSON/dataclass (Pydantic v2) で自前スキーマ、**LaTeXML を LaTeX 入口**、OMDoc は対応付けの参照。

## L4 — Semantic Tree Layer (Deep/Semantic)

Concept / Statement / Assumption / Conclusion + defines / uses / depends_on / proves / illustrated_by 関係。文書境界を越える。

### 4-1. 形式化プロジェクト（外部リンク先 [L]・取り込みソース [I]）

| 名称 | URL | License | 規模 | 用途 |
|---|---|---|---|---|
| **Lean mathlib4** | [leanprover-community/mathlib4](https://github.com/leanprover-community/mathlib4) | Apache-2.0 | ~180k 定理 | **[I/L] 正本情報源** |
| **Coq MathComp** | math-comp.github.io | CECILL-B | 代数中心 | [I/L] |
| **Isabelle AFP** | isa-afp.org | BSD/LGPL | 800+ エントリ | [L] |
| **Mizar MML** | mizar.org | 独自 | ~60k 定理 | [L] |
| **Metamath** | us.metamath.org | CC0 | 100 定理中 74 達成 | [L] |

### 4-2. 数学 KB / オントロジー

| 名称 | License | 用途 |
|---|---|---|
| **zbMATH Open** | CC-BY-SA | [L/I] 400万+論文、DLMF/OEIS 参照、OAI-PMH+REST API |
| **DLMF** | Public Domain | [L] 特殊関数 |
| **OEIS** | CC-BY-NC 3.0 | [L/I] 370k 数列 |
| **nLab / ProofWiki / MathWorld** | CC-BY-SA / Wolfram | [L] |
| **Wikidata 数学** | CC0 | [L/I] 75k+ 数学 QID |
| **MSC2020** | CC-BY-NC-SA | [I] 分類体系 |
| **SMGloM** | CC-BY-SA | [L] ~1500 多言語定義 |

### 4-3. KG / RDF ストレージ基盤 [S]

| 名称 | License | 状況 |
|---|---|---|
| **Neo4j** | GPLv3 / 商用 | Cypher 標準 |
| **KuzuDB** | MIT | **2025-10 archived** (Apple 買収) — 後継 LadybugDB ウォッチ |
| **Memgraph** | BSL 1.1 | in-memory |
| **TerminusDB** | Apache-2.0 | git-like RDF |
| **Oxigraph (Rust)** | MIT | SPARQL、embed 可 |
| **Apache Jena Fuseki** | Apache-2.0 | SPARQL、2026 に 120ms federated |
| **Dgraph / ArangoDB** | — | 代替候補 |

### 4-4. Graph / OWL ライブラリ

| ライブラリ | License | 用途 |
|---|---|---|
| NetworkX / rustworkx / igraph / graph-tool | BSD/Apache/GPL | in-memory 解析 |
| owlready2 / rdflib / Protégé | LGPL/BSD | OWL 操作 |

### 4-5. 概念抽出 / 関係抽出

| ツール | URL | License | 備考 |
|---|---|---|---|
| **GLiNER / GLiNER2** | [urchade/GLiNER](https://github.com/urchade/GLiNER) | Apache-2.0 | zero-shot NER+RE、BERT 軽量 |
| **GLiNER-Relex (2026)** | — | Apache-2.0 | LLM より速く deterministic |
| **REBEL** | — | MIT | end-to-end triple |
| **scispaCy** | — | MIT | 科学テキスト |

### 4-6. Embedding / Vector DB [S]

| 名称 | License | 備考 |
|---|---|---|
| **MathBERT / MathBERTa / SciBERT** | Apache-2.0 系 | 数式 embedding |
| **Qdrant** | Apache-2.0 | 定番 |
| **LanceDB** | Apache-2.0 | SQL+DuckDB、2026-Q1 に 1.5M IOPS |
| **Turbopuffer** | — | S3 back、安価 |
| **Chroma / Weaviate / pgvector / Milvus** | 各種 | 選択肢 |

### 4-7. 数学 KG 自動構築（参考論文）

| 名称 | URL | 備考 |
|---|---|---|
| **AutoMathKG (2025)** | [arXiv:2505.13406](https://arxiv.org/pdf/2505.13406) | **Definition/Theorem/Problem 3 entity 型 + reference edge → L4 設計に直接援用可能** |
| **MathGloss** | [MathGloss](https://github.com/MathGloss/MathGloss) | 用語辞書 |
| **SciKGTeX** | [arXiv:2304.05327](https://arxiv.org/pdf/2304.05327) | LaTeX 埋込 KG |
| **NaturalProofs / ProofNet / miniF2F / PutnamBench / FormalMATH** | — | ベンチ |

## L3 → L4 変換（ゲート）

LLM で構文ノードから意味ノードを生成。人間承認前提。

### 構造化抽出フレームワーク（最重要）

| ツール | URL | License | 推奨度 |
|---|---|---|---|
| **Instructor** | [567-labs/instructor](https://github.com/567-labs/instructor) | MIT | **★★★★★** Pydantic + validation + 15+ provider |
| **BAML** | [BoundaryML/baml](https://github.com/BoundaryML/baml) | Apache-2.0 | ★★★★☆ DSL + Day-1 新モデル対応 |
| **Outlines** | [dottxt-ai/outlines](https://github.com/dottxt-ai/outlines) | Apache-2.0 | ★★★☆☆ OSS モデル向け |
| **DSPy 3.1** | [stanfordnlp/dspy](https://github.com/stanfordnlp/dspy) | MIT | ★★★★☆ プロンプト最適化 |
| **PydanticAI** | pydantic.dev | MIT | ★★★★☆ エージェント志向 |

### 数学 LLM (evaluator 側で有用)

| モデル | 備考 |
|---|---|
| **DeepSeekMath-V2** ([arXiv:2511.22570](https://arxiv.org/html/2511.22570v1)) | **generator-verifier** アーキ、IMO 2025 gold、Putnam 118/120。**M3E の evaluator 構想と相性良** |
| Qwen/QwQ-32B | 33K context |
| Mathstral 7B | 軽量 |
| NuminaMath-1.5 | 900k CoT dataset |

### 論文 RAG / 自動 KG 構築

| 名前 | URL | 備考 |
|---|---|---|
| **PaperQA2** | [Future-House/paper-qa](https://github.com/Future-House/paper-qa) | Apache-2.0、in-text citation = provenance 直結 |
| **LightRAG** | HKUDS/LightRAG | GraphRAG の 1/100 コスト |
| **nano-graphrag** | gusye1234 | ~1,100行、hackable |
| **LLMGraphTransformer** | [neo4j-labs/llm-graph-builder](https://github.com/neo4j-labs/llm-graph-builder) | allowedNodes/Relationships でスキーマ制約 |
| **Microsoft GraphRAG** | microsoft/graphrag | 大規模 community summarization |
| **RAGFlow** | infiniflow/ragflow | deep doc + KG |

### Claude 運用テク

- **PDF 直入力**: Claude 全モデル対応（vision ベース、図版も）
- **Prompt caching**: 反復抽出で最大 **90% 削減**
- **Batch + Cache**: 合わせて最大 **95% 削減**

## 横断関心事

### X-1. DAG オーケストレーション

| ツール | License | 個人適合度 |
|---|---|---|
| **Snakemake** | MIT | ★★★★★ 増分再実行（`--rerun-incomplete`）、科学計算定番 |
| **Prefect** | Apache-2.0 + Cloud Hobby | ★★★★★ `@flow` デコレータ、動的 DAG |
| **Dagster** | Apache-2.0 | ★★★★☆ Asset-centric、lineage 標準（Solo が 2026-05 有償化注意） |
| **DVC stages** | Apache-2.0 | ★★★★☆ データ版管理兼用 |
| **Taskfile / Make** | MIT | ★★★★☆ 最軽量、足場に |
| **Kedro / Ploomber / Nextflow** | Apache-2.0 | ★★★☆☆ |
| **Airflow / Metaflow** | Apache-2.0 | ★★☆☆☆ 個人には重い |

### X-2. Provenance / Lineage（derived_from 設計と直結）

| ツール | License | 推奨度 |
|---|---|---|
| **W3C PROV-O/JSON/N** | W3C 標準 | ★★★★★ **5層設計と完全一致** |
| **prov (trungdong)** | MIT | ★★★★★ Python 実装 |
| **OpenLineage** | Apache-2.0 | ★★★★☆ Dagster/Airflow 統合 |
| **MLflow** | Apache-2.0 | ★★★☆☆ 実験ログ軽量 |
| Marquez / DataHub / OpenMetadata | Apache-2.0 | ★★☆☆☆ 企業向け過剰 |

### X-3. Validation / Schema

| ツール | License | 推奨度 |
|---|---|---|
| **Pydantic v2** | MIT | ★★★★★ ノード単位、Rust コアで 5-50x |
| **JSON Schema** | 標準 | ★★★★★ 境界契約 |
| **Pandera** | MIT | ★★★★☆ 表形式 |
| Great Expectations | Apache-2.0 | ★★☆☆☆ 過剰 |

### X-4. Diff / Versioning

| ツール | License | 推奨度 |
|---|---|---|
| **DVC** | Apache-2.0 | ★★★★★ **2025-11 lakeFS 傘下、OSS 継続** |
| **DeepDiff** | MIT | ★★★★★ L3/L4 JSON 差分 |
| **difftastic** | MIT | ★★★★☆ tree-sitter syntax diff、LaTeX/AST 比較 |
| **jsondiff** | MIT | ★★★★☆ RFC 6902 patch |
| lakeFS / Dolt / Quilt / git-lfs | 各種 | ★★★☆☆ |

### X-5. Human-in-the-loop 承認 UI

| ツール | License | 推奨度 |
|---|---|---|
| **Streamlit** | Apache-2.0 | ★★★★★ 数十行で承認 UI、個人研究第一選択 |
| **LangGraph interrupt** | MIT | ★★★★★ **gate 設計に直接マッピング可能** |
| **Gradio** | Apache-2.0 | ★★★★☆ LLM と相性 |
| **Label Studio** | Apache-2.0 | ★★★★☆ 本格アノテーション |
| **Argilla** | Apache-2.0 | ★★★☆☆ NLP feedback loop |
| Doccano / Panel / Prodigy | MIT / BSD / 商用 | ★★★☆☆ |

## M3E 推奨ミニマルスタック (2026-04 時点)

```
L0  : BLAKE3 + habanero/arxiv.py/pyalex + datasketch       [+ MinIO 任意]
L1  : Docling (既定) / MinerU 2.5-Pro (CJK) / Marker (LLM)
      + UniMERNet or PP-FormulaNet-L (数式 fallback)
      + dvisvgm or mutool (SVG 図版)
      + GROBID (書誌別レーン)
      + PyMuPDF (低レベル補助)
L2  : MyST AST (正本) + LaTeXML (LaTeX 入口) + Pandoc (変換ハブ)
L3  : Pydantic v2 の自前スキーマ + tree-sitter-latex
      + OMDoc を対応付けリファレンス
L3→L4 ゲート:
      Instructor + Pydantic + Claude Opus 4.7 (PDF 直入力 + prompt caching)
      schema は AutoMathKG の 3 entity 型を参考
L4  : Oxigraph (RDF embed) + LanceDB (vector) の二層
      + mathlib4 / zbMATH / Wikidata / MSC2020 を L 層で参照
      + GLiNER-Relex を定型関係の高速前段
横断:
      DAG       = Snakemake (or Prefect)
      Provenance= W3C PROV-O + trungdong/prov
      Validate  = Pydantic v2 + JSON Schema
      Diff/Ver  = Git + DVC + DeepDiff + difftastic
      HITL UI   = Streamlit (MVP) / LangGraph interrupt (ゲート)
      Evaluator = DeepSeekMath-V2 (将来、論理整合チェック)
```

## 5 層設計との直接対応チェック

| 設計原則 | 対応ツール |
|---|---|
| 各層は単一責務 | Snakemake/Dagster の stage 分離 |
| 上位は下位依存、逆は禁止 | DVC `dvc.yaml` の dependency 定義 |
| 正本は各層で一意 | MyST AST (L2)、Pydantic schema (L3/L4) |
| 全ノード provenance 保持 | W3C PROV-O + derived_from フィールド |
| 意味統合は人間承認 | LangGraph interrupt + Streamlit UI |

## 2026 時点の要注意トレンド

- **Nougat, layoutparser, pdffigures2, tralics** は **メンテ停滞** — 新規採用非推奨
- **KuzuDB は 2025-10 archived** — KG store に使う場合は Oxigraph / Jena Fuseki へ
- **DVC は 2025-11 lakeFS 傘下** だが OSS 継続
- **Dagster Solo は 2026-05 から従量課金** — 自己ホストか Prefect 移行検討
- **Docling / MinerU / Marker の 2026 版** は 2024 以前の OSS ランドスケープを塗り替えた
- **Claude PDF vision + prompt caching** は L3→L4 ゲートのコストを激減させる

## 関連既存ブレスト

- [02_oss_tools.md](02_oss_tools.md) — OSS 候補 12 件（カテゴリ軸の深掘り）
- [03_commercial_tools.md](03_commercial_tools.md) — 商用候補 13 件
- [04_specialized_and_helpers.md](04_specialized_and_helpers.md) — 数式特化 / 補助
- [05_strategy.md](05_strategy.md) — 1-4 段パイプライン案、MVP ロードマップ
- [../math_ontology_services/](../math_ontology_services/) — L4 の外部オントロジー接続先詳細
- [../capture_ingest/](../capture_ingest/) — L0 汎用化（Web/音声含む）
