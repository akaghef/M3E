# 02. 形式証明ライブラリ（L1）

定理と証明そのものを形式化し、証明検証機でコンパイルできる形で保持するサービス・ライブラリ群。
**数学をオントロジーとして扱う究極形** — 宣言名が URI、依存関係が関係、型がスキーマ。

## 分類軸（このファイル内）

- **Kn.** 論理基盤（ZFC / 依存型 / HOL / Mizar TDA / メタロジック）
- **Sz.** ライブラリ規模（宣言数）
- **Cv.** カバー分野（代数中心 / 解析中心 / 汎用）
- **Ai.** AI 連携状況
- **Ac.** アクセス方式（git / archive / web browser）

## B1. Lean 4 / mathlib4
- **本質**: 依存型ベース定理証明器 + コミュニティ数学ライブラリ
- **規模**: mathlib4 で 2026 時点約 18 万宣言（日次成長）
- **特徴**: AI 連携エコシステム最大（LeanDojo, Lean Copilot, miniF2F）
- **アクセス**: GitHub (leanprover-community/mathlib4), Mathlib4 web docs, Loogle 検索
- **M3E 供給**: 定理名 → 依存 DAG, docstring, source URL

## B2. Lean 3 / mathlib3
- **本質**: Lean 4 の前世代、2023 年にフリーズ
- **意義**: AI 訓練データとして未だ主流（LeanDojo 初期版、PACT, HTPS 等）
- **扱い**: レガシー参照源、M3E 取込は履歴素材として

## B3. Coq / Rocq
- **本質**: 依存型 + Curry-Howard
- **ライブラリ**: MathComp (Mathematical Components), Coq stdlib, Coq Platform
- **大物証明**: 4 色定理, Feit-Thompson 定理, 奇数定理
- **名称変更**: 2024 末に "Rocq" へリブランド進行中
- **特徴**: SSReflect tactic 言語、MathComp は代数寄り
- **アクセス**: Coq Package Index, opam, GitHub

## B4. Isabelle / HOL
- **本質**: HOL ベース、Isar 可読証明スクリプト
- **アーカイブ**: Archive of Formal Proofs (AFP, 900+ エントリ, 300 万行超)
- **強み**: 可読性高、証明自動化（Sledgehammer）強力
- **アクセス**: https://www.isa-afp.org/, Isabelle 本体配布
- **M3E 供給**: AFP 各論文単位でトピック化しやすい

## B5. Mizar / MML
- **本質**: ZFC ベース、自然言語風記法
- **ライブラリ**: Mizar Mathematical Library (MML), 1973 から継続、58,000+ 定理
- **特徴**: 老舗、歴史的価値、Fundamenta Informaticae に論文で追加
- **アクセス**: MML Query, mizar.uwb.edu.pl
- **M3E 供給**: 最古のオントロジー化数学、コード体系 MSC 的役割

## B6. Metamath
- **本質**: ZFC / 集合論を極限まで小さい axiomatic で
- **ライブラリ**: set.mm (40,000+ 定理), iset.mm (直観主義)
- **特徴**: 証明が完全に展開された形で保存される（ゼロ知識証明的）
- **アクセス**: us.metamath.org, GitHub (metamath/set.mm)
- **M3E 供給**: 各定理の依存木がクリーン、小さい単位でノード化可

## B7. HOL Light / HOL4
- **本質**: HOL 系の軽量実装
- **ライブラリ**: Harrison のライブラリ, Flyspeck (ケプラー予想)
- **特徴**: Flyspeck 証明の実績
- **M3E 供給**: 単体でなく Flyspeck 等大規模プロジェクトの素材源

## B8. Agda
- **本質**: 依存型言語寄り、証明アシスタントとしても使用
- **ライブラリ**: agda-stdlib, agda-categories, cubical library
- **特徴**: Homotopy Type Theory 寄り、圏論ライブラリ強い
- **M3E 供給**: HoTT・圏論の形式化素材

## B9. Cubical Agda / HoTT 系
- **本質**: Homotopy Type Theory の形式化
- **資源**: HoTT book 形式化 (Coq), Cubical Agda library, UniMath (Coq)
- **分野特化**: ∞-圏, univalence

## B10. Mizar-like / その他 ZFC
- **Naproche/SAD**: ForTheL 自然言語風 + 自動証明
- **Lurch**: 教育向け証明チェッカ
- **Epic**: 経験的形式化プロジェクト（主に教育）

## B11. Formal Abstracts (FABSTRACTS)
- **本質**: Thomas Hales 主導、定理の「要約」を形式言語 Naproche で書く
- **目的**: 既存数学を全て形式化する前段として、主要定理の statement だけを形式化
- **アクセス**: formalabstracts.org
- **M3E 供給**: 各論文 ↔ 形式 statement の対応表。L4 との接続点

## B12. UniMath
- **本質**: Voevodsky 発 univalent foundations の Coq ライブラリ
- **特徴**: Foundations 層の再構築

## B13. HoTT-Coq
- **本質**: Coq 上 HoTT ライブラリ

## B14. ACL2
- **本質**: Lisp ベース、一階論理 + 再帰
- **用途**: 主にハードウェア検証、数学的には整数論・組合せ部分
- **M3E 関連度**: 低だが参考

## B15. PVS
- **本質**: SRI International 製 高階論理
- **用途**: 航空宇宙中心、数学純粋用途は副次的
- **M3E 関連度**: 低

## B16. Naproche-SAD
- **本質**: ForTheL（自然言語風）を Lean/Vampire で裏検証
- **特徴**: "controlled natural language"、人間可読性と形式性の中間
- **M3E 関連度**: 中〜高、ユーザ手書きと形式系の橋

## B17. Dedukti / Logipedia
- **本質**: 証明の共通中間言語、複数証明系間で翻訳
- **ビジョン**: Lean↔Coq↔HOL Light↔Matita の相互翻訳
- **M3E 供給**: レイヤ間の名寄せ辞書

## B18. Matita
- **本質**: Coq 派生、軽量 IDE
- **状態**: 活発度低下

## B19. Lean 3 Community Archive
- **背景**: Lean 3 時代の広範なプロジェクト（perfectoid, liquid tensor experiment 等）
- **意義**: 歴史的素材、LTE 等は研究的価値大

## B20. Liquid Tensor Experiment (LTE)
- **本質**: Scholze の凝縮数学を Lean で形式化した実証プロジェクト
- **完遂**: 2022、証明可能性の象徴
- **M3E 供給**: 「現代数学を形式化するとこうなる」のケーススタディ

## 比較表

| ID | システム | 論理 | ライブラリ規模 | AI 連携 | 日本研究者コミュ | 推し度 |
|---|---|---|---|---|---|---|
| B1 | Lean4 | DTT | 18万宣言 | 最強 | 拡大中 | ⭐⭐⭐ |
| B3 | Coq | DTT | 数万 | 中 | 古参あり | ⭐⭐ |
| B4 | Isabelle | HOL | AFP 300万行 | 中 | 中 | ⭐⭐ |
| B5 | Mizar | ZFC | 5.8万定理 | 弱 | 低 | ⭐ |
| B6 | Metamath | ZFC | 4万定理 | 弱 | 極低 | ⭐ |
| B8 | Agda | DTT | 中 | 弱〜中 | 圏論勢 | ⭐ |
| B17 | Dedukti | 中間言語 | - | - | - | ⭐（橋渡しとして） |

## 論点（L1 レベル）

- **Sy. システム選択** — どの系を優先取込するか。Lean4 はデファクト、だが Mizar は古典厚い
- **Lk. リンク戦略** — 同一定理の Lean / Mizar / Isabelle 版をどう対応付ける（B17 Dedukti が希望）
- **Im. 取込粒度** — 定理単体 / モジュール単位 / プロジェクト単位
- **Ve. バージョン** — mathlib は流動的、固定版で取込 vs 追従
- **Do. ドキュメント** — 証明項だけか、docstring・コメントも取込むか
- **Ch. 日本語化** — 名前・説明の日本語ラベル付け、誰が維持するか
- **Pr. 前提** — Lean4 環境構築が必要になる場面で、研究者のセットアップ負担
- **Hb. ハブ化** — M3E が Lean4 の「閲覧インタフェース」になれるか（mathlib4_docs 代替）

## 既存の閲覧・検索インタフェース（参考）

- **mathlib4 docs** — https://leanprover-community.github.io/mathlib4_docs/
- **Moogle** — 自然言語 → mathlib 検索
- **Loogle** — パターン検索
- **LeanSearch** — 意味検索
- **Mizar Query** — MML 検索
- **AFP Browser** — Isabelle AFP 閲覧
- **SearchOnMath** — 式検索横断（L3 的）

M3E が独自の閲覧 UI を出すよりも、これらへの **リンクアウト + ローカルノート付与** がリアル。
