# 数学 × オントロジー サービス大量収集ブレスト

「数学的知識を **機械可読 / 意味付き / 構造化** された形で扱うサービス・プロジェクト・標準」を
M3E の外部参照・統合候補として網羅的に並べる。

> メタフォルダ: `idea/10_io/` — 外部の知識サービス群を M3E に取り込む／接続する可能性を俯瞰するため。
> （`20_ai/` も候補だが、AI からの利用より「知識源としての存在」が本質なので 10_io を推し。）

## 方針

- 採用判断はしない（M3E とどう繋ぐかは別議論）
- 実装は考えない（最後 `07_m3e_connection.md` で接続パターンだけ触れる）
- **「数学 × オントロジー」= 数学の概念・定理・証明・対象を構造化して扱う** ことに直接寄与するもの
- 周辺（純粋な CAS、教育コンテンツのみ、PDF 束）は参考として軽く触れる程度
- 重複あっても OK。分類軸が違えば同じサービスが複数箇所に出現してよい
- 日本語で書く。固有名はそのまま英語

## ファイル構成

- [01_landscape.md](01_landscape.md) — 全体地図・分類軸・"math × ontology" とは何か
- [02_proof_libraries.md](02_proof_libraries.md) — 形式証明系ライブラリ（Lean / Coq / Mizar / Isabelle / Metamath …）
- [03_knowledge_bases.md](03_knowledge_bases.md) — 数学知識 DB・百科事典（OEIS / DLMF / nLab / PlanetMath …）
- [04_ontology_formats.md](04_ontology_formats.md) — 記述語彙・オントロジー標準（OpenMath / OMDoc / MathML / sTeX / SKOS …）
- [05_semantic_scholarship.md](05_semantic_scholarship.md) — 書誌・論文意味付け（zbMATH / MSC / MathSciNet / MaRDI / Wikidata …）
- [06_ai_math_bridges.md](06_ai_math_bridges.md) — AI × 数学 × オントロジー（LeanDojo / AlphaProof / ProofNet / Formal Abstracts …）
- [07_m3e_connection.md](07_m3e_connection.md) — M3E との接続候補・組み合わせパターン・未決質問
- [08_implementation_feasibility.md](08_implementation_feasibility.md) — P8 二層エッジモデルの実装コスト試算（4 段階、〜950 行）
- [09_blueprint_facets.md](09_blueprint_facets.md) — Blueprint の色分け、design/implementation facet、scope+alias による相互参照
- [10_anchoring.md](10_anchoring.md) — synthetic node による表示整理（anchoring）の用語整理

## 全体俯瞰（5 レイヤ）

| レイヤ | 目的 | 代表 | 機械可読度 | 人間可読度 |
|---|---|---|---|---|
| L1 形式証明 | 定理・証明そのものを形式化 | Lean4 / Coq / Mizar / Isabelle / Metamath | ★★★ | ★ |
| L2 知識ベース | 数学対象の事典化 | OEIS / DLMF / nLab / PlanetMath / MathWorld | ★★ | ★★★ |
| L3 記述語彙 | 数学表現の共通語彙・構文 | OpenMath / OMDoc / MathML / sTeX | ★★★ | ★ |
| L4 書誌・分類 | 論文・著者・分野の意味付け | MSC / zbMATH / MathSciNet / MaRDI / Wikidata | ★★ | ★★ |
| L5 AI 橋渡し | LLM × 形式数学 | LeanDojo / miniF2F / NaturalProofs / ProofNet | ★★ | ★★ |

この 5 レイヤは「同じ定理」を違う角度から触るので、**どのレイヤ同士を接続するか** が面白いところ。

## 論点一覧（後で ID 単位で選ぶ）

横断的に効く論点を ID 化。

- **Sc. スコープ** — 全数学 / 特定分野（代数/位相/解析/組合せ/圏論…）/ 教育範囲のみ
- **Lc. ライセンス** — 公共利用可 / 研究用限定 / 商用不可 / クローズド
- **Ap. API/アクセス** — REST / SPARQL / Git / CLI ダウンロード / Web のみ
- **Fm. フォーマット** — XML 系（MathML/OMDoc）/ Lean 構文 / TeX / RDF / JSON / 独自
- **Sz. 規模** — 百〜千ノード / 万ノード / 十万ノード / 数百万ノード
- **Mt. メンテ状況** — 活発 / 枯れた安定 / 凍結・アーカイブ
- **Ed. 編集主体** — 中央編集 / コミュニティ wiki / 形式証明コミット駆動 / 学会管理
- **Id. ID 体系** — URI / DOI / OEIS ID / nLab slug / Lean 宣言名 / MSC コード
- **Cr. 相互運用** — OpenMath CD 相互リンク / Wikidata QID / クロス参照の有無
- **Li. 既存 LLM 学習素材か** — 既に GPT/Claude/Gemini が学習している / マイナーで学習薄
- **M3. M3E 側ユースケース** — import 源 / 外部参照 / AI 補助ナレッジ / 用語辞書 / 論文執筆時引用
- **Qu. クエリ可能性** — 自然言語検索 / 構造検索 / 部分式検索 / SPARQL
- **Fo. 形式度** — 完全形式（検証機にかかる）/ 半形式 / 非形式（自然言語のみ）
- **Dp. 依存性** — 他サービスに依存 / 独立 / 相互依存

## 関連ブレスト

- [idea/10_io/tool_integration/](../tool_integration/) — 一般的な既存ツール統合
- [idea/10_io/capture_ingest/](../capture_ingest/) — A3 PDF 取り込み、A8 AI 対話取り込みと接続
- [idea/10_io/export_publish/](../export_publish/) — B1 論文ドラフト自動生成、B8 知識グラフ標準形式
- [idea/20_ai/ai_agent_deep/](../../20_ai/ai_agent_deep/) — C6 research assistant フロー

## キーメッセージ（事前仮説）

- 数学 × オントロジー領域は **既に大量のサービスがあり、大半は学術・公共プロジェクト**
- ただし **互いの相互運用性は不十分**（OEIS と Lean と zbMATH を繋ぐものはほぼ無い）
- M3E は「個人研究者の手元」で **この分断を超える橋** を作れる余地がある
- 科研費・論文執筆（project_projection_vision）の観点では L4 書誌系 が最短接続
- 世界モデル側（思考・概念ネットワーク）は L2 知識ベース、L3 オントロジー語彙が素材
- AI 連携は L5 が発展中だが、学習素材としての質と鮮度が論点
