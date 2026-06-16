# 04. 記述語彙・オントロジー標準（L3）

数学表現（式・構造・概念）を **機械可読な共通フォーマット** として交換するための語彙・標準・ツール群。
「ロゼッタストーン」側の話で、具体コンテンツより **構文とスキーマ** がテーマ。

## 分類軸

- **Ft.** フォーマット種別（XML / S式 / RDF / TeX 拡張 / JSON）
- **Lv.** 抽象度（Presentation 表示 / Content 意味 / メタ）
- **Ad.** 採用度（広範 / 学術限定 / 実験的）
- **Ps.** 主な支持体（W3C / OMS / KWARC / 学会）

## F1. MathML — Mathematical Markup Language
- **運営**: W3C
- **バージョン**: MathML 4（2023 勧告）
- **種別**: Presentation（見た目）+ Content（意味）の 2 系統
- **採用**: HTML/EPUB 標準、KaTeX/MathJax 経由で広範
- **M3E 用途**: 数式ノードの保存フォーマット候補
- **注意**: Content MathML は書く人少、Presentation が実態

## F2. OpenMath
- **本質**: 数式の意味表現 + 共有辞書（CD = Content Dictionary）
- **運営**: OpenMath Society
- **構造**: `OMS` (symbol), `OMA` (application), `OMV` (variable), `OMBIND` (binder) 等で木構造
- **CD**: `arith1`, `calculus1`, `set1`, `fns1` など数十の辞書
- **状態**: 活動ピークは 2000 年代、現在も維持
- **M3E 供給**: 式の意味レベル保存、CAS 相互運用
- **関連**: https://openmath.org/

## F3. OMDoc — Open Mathematical Documents
- **本質**: OpenMath + 文書構造 + 依存関係
- **要素**: `theory`, `definition`, `axiom`, `theorem`, `proof`, `symbol`, `imports`
- **特徴**: 「数学ドキュメントのオントロジー」、Kohlhase の博士研究起源
- **現代版**: MMT (Meta Meta Theory) が後継
- **M3E 供給**: theory ブロック単位でのノード化の参考モデル

## F4. MMT — Meta Meta Theory
- **運営**: KWARC / Florian Rabe
- **本質**: OMDoc を一般化、異なる論理系を同じ枠組みで記述
- **実装**: Scala、MMT JEdit IDE
- **用途**: Lean/Coq/Isabelle/Mizar を MMT で抽象化して名寄せ
- **状態**: 研究プロジェクト中心、2015〜継続
- **M3E 供給**: メタ論理層の橋渡し、B17 Dedukti と競合

## F5. sTeX
- **本質**: LaTeX 拡張で OMDoc 的意味情報を埋め込む
- **採用**: MathHub, SMGloM
- **特徴**: 論文を書きながらオントロジーを付けていける
- **M3E 供給**: 論文執筆時にメタ情報を埋め込む作法

## F6. LaTeXML
- **本質**: LaTeX → XML / HTML + MathML 変換
- **運営**: NIST
- **用途**: arXiv の論文を構造化 HTML に（ar5iv）
- **M3E 供給**: 既存論文の機械可読化パイプライン

## F7. ar5iv / arxiv-vanity
- **本質**: LaTeXML 応用で arXiv 論文を HTML 化
- **アクセス**: https://ar5iv.labs.arxiv.org/
- **M3E 供給**: 論文 → 構造化テキストの既製サービス

## F8. CMathML と Content Dictionary 系
- **本質**: MathML の Content 部は CD を参照する設計
- **状況**: 理論は綺麗だが実装普及せず
- **M3E 関連**: 参考、実装採用は慎重に

## F9. TPTP / THF — Thousands of Problems for Theorem Provers
- **本質**: 一階論理/高階論理の問題交換フォーマット
- **用途**: ATP（自動定理証明）コンテスト標準
- **M3E 関連**: ATP 連携時の素材

## F10. SMT-LIB
- **本質**: SMT ソルバ間の入力フォーマット
- **用途**: 決定手続き問題
- **M3E 関連**: 低だが参考

## F11. DKL / Dedukti 形式（再掲, L1 側）
- **本質**: λΠ計算を使った証明の中間表現
- **L3 的側面**: 異証明系の翻訳言語として

## F12. GF — Grammatical Framework
- **本質**: 多言語文法記述、数学文書の自然言語化に応用
- **応用**: MathBook プロジェクトなど
- **M3E 供給**: 形式 → 多言語自然文の生成器候補

## F13. ASCIIMath / AsciiDoc math
- **本質**: 軽量数式記法
- **M3E 関連**: 入力補助用途

## F14. CellML / MathModelica（分野特化）
- **本質**: 生物学/工学モデル、数式を含むがオントロジー側面弱
- **M3E 関連**: 低

## F15. JSON-LD + Schema.org
- **本質**: 一般ウェブ構造化データ
- **数学側**: `MathSolver`, `Question` など一部、数学専用 vocab は限定的
- **M3E 供給**: サイト公開時の SEO 連携

## F16. SKOS — Simple Knowledge Organization System
- **本質**: W3C、概念階層記述
- **数学応用**: MSC を SKOS 化した取り組みあり (zbMATH)
- **M3E 供給**: 分野コード階層の表現に便利

## F17. OWL — Web Ontology Language
- **本質**: 形式オントロジー言語
- **数学応用**: MathOnto, OntoMathPRO, GeoSciML 数学部分
- **M3E 供給**: 概念間関係の記述

## F18. OntoMathPRO
- **本質**: ロシア系研究グループによる数学オントロジー
- **規模**: 数千概念、OWL
- **M3E 供給**: 既製の数学概念オントロジーの参考

## F19. OntoMath 系（その他）
- **OntoMathEdu** — 教育用数学オントロジー
- **MathOnto** — 初期試作

## F20. MathLingua
- **本質**: 自然言語と形式の中間を狙う独自記法
- **開発**: Dominic Pollari
- **状態**: プロトタイプ段階
- **意義**: UX 観点で参考になる

## F21. CNXML（旧 Connexions / OpenStax）
- **本質**: 教科書の構造化
- **M3E 関連**: 数学教材で部分的に

## F22. JEL / LeAn4 抽象構文 (Lean)
- **本質**: Lean4 側の AST を JSON 形式で取り出す機構
- **M3E 供給**: Lean4 取込の実装経路

## F23. IsaXML
- **本質**: Isabelle の中間 XML 出力
- **M3E 関連**: 中、取込経路候補

## F24. Coq Glob / SerAPI
- **本質**: Coq の構造化出力、SerAPI は S式 IPC
- **M3E 供給**: Coq 取込用

## F25. RDF + custom vocab
- **本質**: 独自に RDF で数学概念を表現する DIY 路線
- **採用**: Wikidata 方式、ResearchSpace、個別プロジェクト
- **M3E 供給**: 柔軟、ただし語彙設計が論点

## F26. Turtle / N-Triples
- **本質**: RDF の書き方
- **M3E 関連**: 公開フォーマットとして

## F27. YAML/JSON の自家製 schema
- **現実**: 多くの現代プロジェクトは独自 YAML/JSON で始める
- **例**: mathlib metadata, Stacks tags, Kerodon tags
- **M3E 供給**: 実装時の最速解候補

## F28. MathTools (Python) / py-mathml / MathMLSiunitx
- **本質**: MathML を Python で扱うライブラリ群
- **M3E 供給**: 実装時のユーティリティ

## F29. Doctrine: 数学文書交換 XML （提案段階）
- **本質**: 特定プロジェクトによる提案
- **M3E 関連**: 低

## F30. 汎用 JATS XML / BITS XML
- **本質**: 学術出版用マークアップ
- **数学側**: JATS 内 MathML 利用
- **M3E 供給**: 論文流通層の理解に必要

## 比較表

| ID | フォーマット | 抽象度 | 採用度 | 入手容易 | M3E 適合 |
|---|---|---|---|---|---|
| F1 | MathML (Pres) | 低 | 高 | 容易 | ⭐⭐ |
| F1 | MathML (Cont) | 中 | 低 | 中 | ⭐ |
| F2 | OpenMath | 中 | 中 | 容易 | ⭐⭐ |
| F3 | OMDoc | 高 | 中 | 中 | ⭐⭐ |
| F4 | MMT | 最高 | 研究限定 | 中 | ⭐ |
| F16 | SKOS | 中 | 高 | 容易 | ⭐⭐⭐ |
| F17 | OWL | 高 | 中 | 容易 | ⭐ |
| F25 | 独自 RDF | 可変 | 可変 | 可変 | ⭐⭐ |
| F27 | 独自 JSON | 可変 | 高 | 容易 | ⭐⭐⭐ |

## 論点

- **Fc. フォーマット選択** — M3E 内部表現を MathML / OMDoc / 独自 JSON / RDF のどれに寄せるか
- **Lv. 粒度** — 式 1 つ / 段落 / 節 / 論文 / ライブラリ
- **Ex. 拡張性** — 将来の新ジャンル（物理、CS 寄り数学）に耐える語彙設計
- **Ad. 既存採用** — 研究者が既に使っている MathJax/KaTeX との整合
- **Bd. バインディング** — Presentation MathML → Content MathML の自動昇格可能か
- **Kw. KWARC 系依存** — OMDoc/MMT/sTeX を採用すると KWARC エコシステムに乗る
- **Ja. 日本語ラベル付与** — SKOS altLabel @ja を誰がどこで付けるか

## 横断的観察

- **F1 + F16 + F27** の組み合わせが最も実用的: 式は MathML、分類は SKOS、その他は独自 JSON
- OMDoc / MMT は理論的に正しいが、書き手を見つけるのが困難 → 取込は自動化前提
- L3 は L2 とセットで機能する（K5 nLab, K14 Stacks は構造化された L2 = L3 の中間）
