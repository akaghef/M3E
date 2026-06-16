# 03. 数学知識ベース・百科事典（L2）

形式度は低いが、**ID 付き・構造化・相互リンク** がある程度整備された数学知識リポジトリ。
人間可読性が高く、M3E ノードへの取込・参照が最も現実的なレイヤ。

## 分類軸

- **Kd.** 対象種別（数列 / 関数 / 定理 / 概念 / 問題 / 証明）
- **Ed.** 編集主体（専門家編集 / 学会運営 / コミュニティ wiki / 企業）
- **Sz.** 規模（項目数）
- **Ap.** API 有無
- **Lc.** ライセンス

## K1. OEIS — Online Encyclopedia of Integer Sequences
- **対象**: 整数数列
- **規模**: 380,000+ 数列（A000001 〜）
- **ID**: `Axxxxxx`（7 桁）
- **API**: https://oeis.org/search?q=...&fmt=json
- **構造**: 各エントリに formula, examples, programs (Mathematica/Maple/PARI), cross-refs, comments
- **M3E 供給**: 数列 ID → 関連定理・プログラム・他数列へのリンク
- **ライセンス**: CC-BY-NC-3.0（注意: 非商用）

## K2. DLMF — Digital Library of Mathematical Functions
- **対象**: 特殊関数（Bessel, Riemann Zeta, 超幾何級数 …）
- **運営**: NIST（米国立標準技術研究所）
- **規模**: 36 章構成、数千の公式
- **ID**: 節単位の URI + 公式番号（DLMF:5.4.1 など）
- **特徴**: MathML で数式提供、高品質グラフィクス
- **M3E 供給**: 関数ごとのメタノード、公式引用

## K3. MathWorld (Wolfram)
- **対象**: 一般数学百科（13,000+ 項目）
- **運営**: Wolfram Research
- **特徴**: Weisstein 編集、横断リンク多数、Mathematica 例
- **ID**: URL 単位
- **API**: 公式 API なし（スクレイピング禁止気味）
- **注意**: 商用運営、引用として可、取込はグレー

## K4. PlanetMath
- **対象**: 数学百科 wiki（数千項目）
- **編集**: コミュニティ wiki、各項目にメンテナー
- **特徴**: LaTeX 直書き、ライセンス CC-BY-SA
- **ID**: URL + 数値 ID
- **状態**: 2020 年代は更新ペース低下
- **M3E 供給**: 取込可能な CC-BY-SA 百科項目

## K5. nLab
- **対象**: 圏論・ホモトピー論中心、n-圏 系
- **編集**: nForum コミュニティ（John Baez, Urs Schreiber 周辺）
- **規模**: 2 万項目超
- **特徴**: 圏論視点で他分野も再記述、独特なオントロジー
- **ID**: slug URL（https://ncatlab.org/nlab/show/<slug>）
- **ライセンス**: 項目ごと、多くは CC-BY-SA
- **M3E 供給**: 圏論的オントロジー、概念的上位関係

## K6. ProofWiki
- **対象**: 定理と証明
- **規模**: 35,000+ 定理、数万証明
- **編集**: コミュニティ wiki（MediaWiki）
- **特徴**: 各定理にページ、証明を自然言語で詳細化
- **ID**: URL（ページ名）
- **ライセンス**: CC-BY-SA
- **M3E 供給**: 「定理 → 証明ステップ」の半形式構造

## K7. Encyclopedia of Mathematics (Springer)
- **対象**: 数学百科、元 Kluwer / Soviet 数学百科の後継
- **運営**: European Mathematical Society 管理
- **規模**: 数千項目
- **ライセンス**: CC-BY-SA 3.0
- **M3E 供給**: 権威ある記述、用語定義の参照源

## K8. Wikipedia 数学カテゴリ
- **対象**: Wikipedia 内の Mathematics カテゴリ
- **規模**: 英版で 30,000+ 項目
- **特徴**: アクセス容易、MathJax/KaTeX 描画
- **ライセンス**: CC-BY-SA
- **M3E 供給**: 広さ重視の参照源

## K9. Wikidata 数学サブグラフ
- **本質**: 構造化版 Wikipedia、RDF/SPARQL でクエリ可
- **数学側**: Q-ID で定理・数学者・概念を表現（Q170754 = 定理 etc.）
- **特徴**: 定理同士・定理 ↔ 発見者などの関係を property で
- **アクセス**: SPARQL endpoint https://query.wikidata.org/
- **M3E 供給**: 多言語ラベル、同一対象を多レイヤで検索する起点

## K10. Polymath Wiki
- **対象**: Polymath 協働研究の記録
- **特徴**: Tim Gowers / Terence Tao 発、集団証明の歴史
- **M3E 供給**: 研究過程のオープンドキュメントとして参考

## K11. Art of Problem Solving (AoPS) Wiki
- **対象**: 競技数学中心
- **規模**: 大規模（Olympiad 問題・手法）
- **M3E 関連度**: 教育寄り、研究者には副次的

## K12. Polylogues / ProofTopia / その他ミニ百科
- **状態**: 活発度低、参考程度

## K13. Bourbaki Online (参考)
- **背景**: N. Bourbaki の Éléments de mathématique の電子化（非公式/一部）
- **意義**: 20 世紀の「公理化オントロジー」
- **M3E 供給**: 階層的定義の古典モデル

## K14. Stacks Project
- **対象**: 代数幾何（スキーム論、スタック）
- **運営**: Aise Johan de Jong 主導、コミュニティ
- **規模**: 7,000+ タグ付き補題・定理・定義
- **特徴**: 各補題に永続 tag（`02AK` 等）、相互依存グラフ公開
- **アクセス**: https://stacks.math.columbia.edu/, LaTeX ソース GitHub
- **M3E 供給**: 代数幾何の **真の意味で DAG 化された定理集**、Xref の宝庫

## K15. Kerodon
- **対象**: ∞-圏論、Jacob Lurie 主導
- **構造**: Stacks Project 同型の tag 体系
- **M3E 供給**: Stacks + ∞-category のセット参照

## K16. MathOverflow / Math StackExchange
- **対象**: Q&A、研究者向け (MO) と一般 (MSE)
- **規模**: MO 10 万 Q、MSE 数百万 Q
- **特徴**: タグ、リンク、Votes
- **ライセンス**: CC-BY-SA
- **M3E 供給**: 「誰かが困った具体的問題」のデータベース、論文化前のアイデア

## K17. HELM (Hypertextual Electronic Library of Mathematics)
- **背景**: Coq 証明を XML 化して公開する 2000 年代の試み
- **状態**: 活発度低、歴史的資料

## K18. MathHub
- **運営**: Michael Kohlhase (KWARC) 周辺
- **機能**: OMDoc/sTeX 形式の数学ライブラリをホスト + 検索
- **特徴**: L3 レイヤと密接
- **M3E 供給**: L2 と L3 の橋

## K19. SMGloM — Semantic Multilingual Glossary of Mathematics
- **本質**: 多言語数学用語集、sTeX/OMDoc ベース
- **M3E 供給**: 日本語ラベル整備の参考

## K20. MathGloss
- **本質**: mathlib4 宣言 ↔ 自然言語用語の対応辞書
- **状態**: 実験的
- **M3E 供給**: L1 ↔ L2 の一対一橋

## K21. Formal Abstracts (再掲, L2 側視点)
- **L2 的側面**: 人が読める "abstract" としての数学概要
- 詳細は [02_proof_libraries.md](02_proof_libraries.md) B11

## K22. LiveJournal/Blogsphere（非正規）
- **本質**: Terence Tao blog, Gowers's Weblog, What's New in Mathematics 等
- **特徴**: 構造化されていないが重要な一次資料
- **M3E 関連度**: 低（取込対象外寄り）だが参照先として

## K23. OeisWiki
- **本質**: OEIS の wiki 側、数列以外の周辺文書
- **関連度**: 中

## K24. Polyadic Wiki / mathIM / Cambridge Math Repository (参考)
- 規模小、参考程度

## K25. 日本国内の数学辞典系
- **岩波数学辞典** — 紙媒体中心、デジタル化限定
- **数学事典（朝倉書店）** — 紙
- **nippon.com 数学解説** — 一般向け
- **意義**: 日本語権威は紙主導、オントロジー化は未開拓 → **M3E が日本語化する価値** がある領域

## 比較表

| ID | サービス | 対象 | 規模 | API | ライセンス | 推し度 |
|---|---|---|---|---|---|---|
| K1 | OEIS | 数列 | 38万 | JSON | CC-BY-NC | ⭐⭐⭐ |
| K2 | DLMF | 特殊関数 | 36章 | HTML/MathML | 米政府著作（自由寄り） | ⭐⭐ |
| K5 | nLab | 圏論中心 | 2万+ | 無（wiki） | CC-BY-SA | ⭐⭐ |
| K6 | ProofWiki | 定理+証明 | 3.5万 | 無（wiki） | CC-BY-SA | ⭐⭐ |
| K9 | Wikidata math | 横断メタ | 10万+ 概念 | SPARQL | CC0 | ⭐⭐⭐ |
| K14 | Stacks | 代数幾何 | 7千+ | Git/LaTeX | GFDL | ⭐⭐⭐ |
| K15 | Kerodon | ∞-圏 | 拡大中 | Git/LaTeX | GFDL | ⭐⭐ |
| K16 | MathOverflow | Q&A | 10万Q | API | CC-BY-SA | ⭐⭐ |

## 論点

- **Ta. 取込優先度** — どれから M3E 側に素材として取込むか
- **Na. 名寄せ** — OEIS A-ID, nLab slug, Wikidata QID を同一概念に紐付ける手段
- **Jp. 日本語化** — 日本語ラベル不足、どう整備するか（AI 翻訳 or 人手）
- **Cc. クロス引用** — 各ベースが互いを引用している表 / していない箇所の両方
- **Li. ライセンス境界** — CC-BY-SA 取込時の M3E 側伝播、CC-BY-NC の扱い
- **Wd. Wikidata 中心戦略** — Wikidata をハブに他全てをリンクで繋ぐ方針 vs 独自ハブ
- **St. Stacks 特化** — 代数幾何だけなら Stacks + Kerodon の組み合わせが最強、専門特化型 M3E の入口にも
