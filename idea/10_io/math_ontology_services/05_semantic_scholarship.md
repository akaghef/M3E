# 05. 書誌・分類・論文意味付け（L4）

論文・著者・分野コードを **構造化データ** として扱う層。
数学の「内容」には踏み込まないが、**引用・分類・誰が何を書いたか** をオントロジー的に持つ。
科研費・論文執筆への実用接続で最短距離。

## 分類軸

- **Sc.** 扱う対象（論文 / 著者 / 分野コード / 研究データ / 引用関係）
- **Ap.** アクセス（API / SPARQL / Web のみ / 有料購読）
- **Au.** 権威（学会 / 公共 / 企業 / コミュニティ）
- **Jp.** 日本の利用状況

## S1. MSC — Mathematics Subject Classification
- **運営**: 合同（AMS + zbMATH）
- **版**: MSC2020（2020 改訂）
- **構造**: 2 桁主分野（例 14 Algebraic Geometry）→ 3 桁中分野 → 2 文字詳細コード（14A05）
- **規模**: 約 5,000 リーフコード
- **フォーマット**: テキスト、SKOS 版あり
- **M3E 供給**: 分野ノードの既製分類軸、ノード属性として使える

## S2. zbMATH Open
- **運営**: FIZ Karlsruhe / EMS
- **本質**: 数学文献データベース（旧 Zentralblatt）、2021 年 Open 化
- **規模**: 420 万件以上の書誌
- **機能**: MSC タグ付き、著者 ID、レビュー、数式検索 (MathWebSearch 連動)
- **API**: zbMATH Open API（REST）
- **M3E 供給**: 文献検索 + MSC 引き + 関連論文

## S3. MathSciNet (AMS)
- **運営**: American Mathematical Society
- **規模**: zbMATH 相当
- **状態**: 有料購読
- **M3E 関連**: 機関購読あるなら有用、無ければ S2 に

## S4. MaRDI — Mathematical Research Data Initiative
- **本質**: 独 NFDI 数学研究データ基盤プロジェクト
- **構成**: MaRDI Portal（ポータル）, MaRDI Knowledge Graph, MaRDMO（Research Data Management Organiser）
- **対象**: 論文に留まらず、データ・モデル・アルゴリズム・ベンチマーク
- **特徴**: **数学版の研究データ FAIR 化プロジェクト** の本命
- **M3E 供給**: 数学研究データ全体のオントロジー化先駆例、参照源

## S5. MaRDI Knowledge Graph
- **本質**: 論文 × 定理 × モデル × 数学者 × アルゴリズム の RDF グラフ
- **状態**: 2026 時点発展途上、Wikidata ベース拡張
- **M3E 供給**: **最も M3E に近い発想の外部サービス**。相互運用価値高

## S6. Wikidata（数学サブグラフ、再掲 L2 視点 → L4 視点）
- **L4 的側面**: 数学者エンティティ（Q5 人物の中）、論文エンティティ（Q13442814 学術論文）、定理（Q65943）
- **構造**: `main subject (P921)` で論文 ↔ 定理 を結ぶ
- **M3E 供給**: 書誌と概念の同一グラフ上接続

## S7. ORCID
- **本質**: 研究者 ID（1600 万人以上）
- **数学側**: 数学者の ORCID は広く普及
- **M3E 供給**: 著者ノードのカノニカル ID

## S8. OpenAlex
- **運営**: 非営利、CrossRef / Unpaywall 後継的位置
- **規模**: 2 億+ 著作、著者・機関・分野
- **API**: REST + Snapshot dump
- **ライセンス**: CC0
- **M3E 供給**: 論文グラフのオープンソース、引用関係の取込

## S9. Semantic Scholar
- **運営**: Allen Institute for AI
- **機能**: 意味ベース検索、TLDR 要約、引用インテント
- **API**: REST
- **M3E 供給**: 論文 → 要約 → 関連論文、LLM 連携型取込

## S10. CrossRef
- **本質**: DOI 登録機関 + 引用グラフ
- **M3E 関連**: 論文メタの基盤、直接よりも S8 経由

## S11. arXiv (math section)
- **本質**: プレプリントサーバ
- **機能**: 分類コード（arXiv 独自：math.AG, math.AT...）, REST API, OAI-PMH
- **M3E 供給**: 最新論文の自動取込源、S1 MSC との対応表あり

## S12. HAL (hal.science 数学)
- **本質**: フランス中心のオープンアーカイブ
- **M3E 関連**: 欧州数学者の論文入手

## S13. J-STAGE（日本）
- **本質**: 日本の学術誌プラットフォーム
- **数学側**: 日本数学会関連誌
- **M3E 供給**: 日本語論文の取込口

## S14. CiNii Research（日本）
- **本質**: NII の学術検索
- **M3E 供給**: 日本語文献と著者 ID（researchmap 連携）

## S15. researchmap（日本）
- **本質**: 日本の研究者業績データベース
- **M3E 供給**: 日本人数学者の業績リスト取込、科研費連携の鍵

## S16. 科研費データベース（KAKEN）
- **運営**: NII
- **機能**: 採択課題・報告書の検索
- **M3E 供給**: project_projection_vision の直接接続先、過去採択分析
- **ライセンス**: 閲覧無料、API は限定

## S17. DBLP
- **本質**: CS 寄り書誌、一部数学（logic, combinatorics 等）
- **M3E 関連**: 計算機寄り数学の補助

## S18. INSPIRE-HEP
- **本質**: 高エネルギー物理書誌、数理物理側
- **M3E 関連**: 数理物理分野での補助

## S19. ADS (Astrophysics Data System)
- **本質**: 天体物理、一部数値解析・応用数学
- **M3E 関連**: 低

## S20. NASA/ADS-Math（参考）
- 同上

## S21. Polymath Blog + 書誌
- **本質**: 協同研究記録
- **M3E 関連**: 中（研究過程の可視化事例）

## S22. Overlay Journal 群
- **例**: Discrete Analysis, Advances in Combinatorics
- **本質**: arXiv 上に査読層を載せる雑誌モデル
- **M3E 供給**: 意味付き査読プロセスの参考

## S23. EuDML — European Digital Mathematics Library
- **本質**: 欧州古典数学文献アーカイブ
- **M3E 供給**: 歴史文献の取込

## S24. Numdam (フランス)
- **本質**: フランス数学古典誌のデジタルアーカイブ
- **M3E 関連**: 歴史寄り、L4 の補助

## S25. CEDRAM
- **本質**: 査読付き数学誌プラットフォーム
- **M3E 関連**: 低

## S26. MR Lookup / Zbmath Cited
- **本質**: 引用関係検索ツール
- **M3E 関連**: 中

## S27. Scopus / Web of Science 数学側
- **本質**: 商用書誌 DB
- **M3E 関連**: 機関契約次第

## S28. OpenCitations
- **本質**: オープン引用データ
- **規模**: 大
- **M3E 供給**: CC0 引用グラフ、OpenAlex と併用

## S29. COCI - Crossref Open Citation Index
- **本質**: OpenCitations の一部
- **M3E 供給**: 引用 RDF

## S30. ResearcherID / Publons
- **本質**: 査読歴含む研究者 ID
- **M3E 関連**: ORCID に吸収傾向

## S31. DOI / Handle System
- **本質**: 永続識別子基盤
- **M3E 供給**: 文献ノードのカノニカル ID

## S32. Dimensions.ai
- **本質**: 商用書誌（Digital Science）
- **M3E 関連**: 機関契約次第

## S33. Lens.org
- **本質**: 無料書誌+特許
- **M3E 関連**: 中

## 比較表

| ID | サービス | 対象 | 規模 | API | コスト | 日本 | 推し度 |
|---|---|---|---|---|---|---|---|
| S1 | MSC | 分野コード | 5,000 | テキスト | 無料 | 中 | ⭐⭐⭐ |
| S2 | zbMATH Open | 書誌 | 420万 | REST | 無料 | 中 | ⭐⭐⭐ |
| S4 | MaRDI | 研究データ | 拡大中 | SPARQL | 無料 | 低 | ⭐⭐ |
| S5 | MaRDI KG | 知識グラフ | 拡大中 | SPARQL | 無料 | 低 | ⭐⭐ |
| S6 | Wikidata math | 横断 | 大 | SPARQL | CC0 | 中 | ⭐⭐⭐ |
| S7 | ORCID | 研究者 | 1600万 | REST | 無料 | 高 | ⭐⭐ |
| S8 | OpenAlex | 書誌+引用 | 2億 | REST+dump | CC0 | 中 | ⭐⭐⭐ |
| S9 | Semantic Scholar | 書誌+要約 | 2億 | REST | 無料 | 中 | ⭐⭐ |
| S11 | arXiv | プレプリント | 250万 | REST+OAI | 無料 | 高 | ⭐⭐⭐ |
| S15 | researchmap | 日本研究者 | 数十万 | 一部 API | 無料 | 最高 | ⭐⭐⭐ |
| S16 | KAKEN | 科研費 | 80万課題 | 制限付 | 無料 | 最高 | ⭐⭐⭐ |

## 論点

- **Hu. ハブ候補** — OpenAlex / Wikidata / MaRDI KG のどれを引用グラフのハブにするか
- **Jp. 日本接続** — researchmap + KAKEN + J-STAGE の組み合わせで日本研究者 M3E を作る構想
- **Ci. 引用取込** — 過去論文の引用グラフを M3E に丸ごと載せるか、On demand 参照のみか
- **Ms. MSC 活用** — M3E ノードに MSC 属性を付与 → 自動的に分野マップ生成
- **Sp. 深さ** — 書誌だけ / 要約 / 本文 / 図表まで、どこまで取込むか
- **Vr. バージョン管理** — プレプリント v1, v2 の差分をどう扱うか
- **Kk. 科研費接続** — project_projection_vision の本丸。採択済み課題 → M3E マップ自動生成構想

## 横断的観察

- **L4 は既存ワークフロー接続** が最も効くレイヤ（Zotero, Obsidian, 論文執筆）
- **S15 + S16 + S2** の組み合わせで「日本の数学者・科研費・国際論文」を一つのグラフに
- **S5 MaRDI KG が最も M3E 思想と近い** → コラボ余地 / 参考実装
- 書誌レイヤはクローズド（S3 MathSciNet, S27 Scopus）と CC0（S6, S8）が併存、CC0 側に寄せて構築するのが筋
