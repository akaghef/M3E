# M3E の帯域軸（粒度・構造・操作の連動進化）

M3E は同じ基礎データを **単位（粒度）と構造の性質が連動して変化する帯域** で扱う。
帯域は Flash / Rapid / Deep の 3 段階。これは独立した複数軸ではなく、**単一の進化軸**。

## 帯域の定義

### Flash
- **単位**: 断片・素材（構造化前）
- **性質**: マルチモーダル（テキスト・画像・音声・貼付）、日常との連結、突発的アイデア、散発的メモ
- **外部類似**: inbox / clipboard / quick capture
- **操作**: キャプチャして貯める

### Rapid
- **単位**: **文書 1 つ**
- **構造**: **syntax tree**（親子、章立て、節、説明順序あり、線形化可能）
- **性質**: 1 本の文書として閉じた論理構造、自然言語の説明として流し読める
- **外部類似**: Freeplane mindmap / LaTeX 章立て / Markdown アウトライン
- **操作**: 親子編集、折り畳み、再配置、順序付け

### Deep
- **単位**: **文書群・知識体系**
- **構造**: **semantic graph**（tree ではない、多種エッジ、説明順序とは独立）
- **性質**: 複数文書を横断する概念網、同じノードが複数経路に現れる、体系として読む
- **外部類似**: nLab / Wikidata / mathlib4 依存網 / Stacks Project / 研究者の頭の中
- **操作**: 概念関係付け、横断参照、世界モデル構築

## 帯域間の操作（3 つの向き）

| 操作 | 方向 | 意味 |
|---|---|---|
| **昇格 (promote)** | Flash → Rapid | 素材を文書構造に取り込む |
| **体系化** | Rapid → Deep | 複数文書を束ね、概念網に編み上げる |
| **射影 (projection)** | Deep → Rapid | 体系から特定目的の説明順序を持つ 1 文書を切り出す |

日常運用は **Rapid ⇄ Deep の往復**:
- 書いた文書を **体系化** → 体系に取り込む
- 体系から新しい文書を **射影** → 新しい Rapid が生まれる

## 帯域対比表

| | Flash | Rapid | Deep |
|---|---|---|---|
| 単位 | 断片 | 文書 1 | 文書群・体系 |
| 構造 | マルチモーダル素材 | syntax tree | semantic graph |
| 順序 | 未決 | 説明順序あり | 説明順序非依存 |
| エッジ種別 | - | 1 種（親子） | 多種（一般化・双対・類比 …） |
| 入口 | 日常・モバイル | エディタ | 体系ビュー |
| ユースケース中心 | 種を逃さない | 草稿・論文 | 世界モデル |

## 射影法（project_projection_vision との接続）

**射影法** = Deep（semantic 網）→ Rapid（syntax tree）の変換。
同じ Deep 世界モデルから複数の Rapid を別々の射影として生成する:

- 科研費申請書用の Rapid（採択向け説明順序）
- 学振用の Rapid（研究計画向け説明順序）
- JST 用の Rapid（別目的の説明順序）

世界モデル（Deep）は **資産**、射影された出力（Rapid）は **使い捨て**。
これが半年で実用化するべき「射影スキル」の本質。

## 体系化（射影の逆方向）

**体系化** = Rapid → Deep の変換。
論文・ノート・章立ての syntax tree を複数束ね、共通概念で繋ぎ直して semantic graph に編み上げる。

体系化で既存の Deep 世界モデルが成長し、その Deep から新しい射影が可能になる — この往復が M3E の中心ループ。

## 外部サービスとの接続（帯域別）

- **Flash**: 音声入力、画像取込、clipboard、モバイル共有シート
- **Rapid**: Freeplane (.mm), LaTeX, Markdown, Obsidian vault, mindmap 系
- **Deep**: nLab, Wikidata, mathlib4 dep graph, Stacks Project, MaRDI KG, OpenMath CD

Blueprint（mathlib4）は Deep の **一形態だが、エッジが 1 種（uses）に限定** されている。
M3E の Deep は多種エッジを許容する semantic graph なので、Blueprint より広い表現力を持つ。
Blueprint を Deep に取込む場合、uses エッジのみの「やせた Deep」として受け入れ、意味エッジは後から付与する。

## 非目標

- 帯域を 4 つ以上に増やさない
- 帯域を独立複数軸に分解しない（粒度軸と構造軸を切り離さない）
- 帯域ごとに別アプリに分けない（同じ M3E で切替）
- Flash を「ただの Rapid 素材置き場」に縮退させない（マルチモーダル・日常連結の性質を維持）

## 関連文書

- [Core_Principles.md](Core_Principles.md) — 中核原則（原則 7 に帯域進化を記載）
- [Band_Spec.md](../03_Spec/Band_Spec.md) — 帯域の実装仕様
- [Glossary.md](../00_Home/Glossary.md) — 射影 / 体系化 / syntax tree / semantic graph の用語登録
- `memory/project_projection_vision.md` — 射影法の半年実用化目標
- `memory/project_axes.md` — 帯域軸の恒久メモリ
- [idea/10_io/math_ontology_services/](../../idea/10_io/math_ontology_services/) — 外部 Deep 源の分析
