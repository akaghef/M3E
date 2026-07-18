# 数学オントロジーが Neo4j 採用の真の駆動因である

日付: 2026-07-19
出所: akaghef（S16 define セッションでの明言。重要思想として stow 指示）
関連: `S16` / `V1` `V3` / [../01_Vision/Axes.md](../01_Vision/Axes.md) / [260420_math_transition_vision.md](260420_math_transition_vision.md) / [260420_math_transition_vision2.md](260420_math_transition_vision2.md)

## 核文

> M3E dogfooding 程度のデータ量なら Neo4j は不要。しかし最終目標は**数学オントロジー**であり、その規模と構造では graph database が絶対に必要になる。数学という vertical 領域に graph DB のメソッドを適用できる人材は極めて少なく、これ自体が戦略的優位である。

## 展開

### 1. Demand Gate との整合

S16 の Demand Gate（実需 cross-source query 3 件まで Neo4j shadow を開始しない）は正しい。ただしその実需は M3E 開発 dogfooding からではなく、**数学オントロジー構築から生じる**見込みが高い。つまり:

- 近距離の anchor use case: UC-A（repo-local semantic source、file read、dogfooding）— Neo4j 不要
- 遠距離の本命 use case: UC-B の具体形 = **数学オントロジーの大域 traversal** — Neo4j（または同等 graph substrate）必須

Demand Gate に投入される最初の実需 query は、数学領域から書かれる可能性が高い（例: 定義→定理→証明の依存網、一般化・双対・類比 edge の多段探索、複数文献を跨ぐ概念 identity 解決）。

### 2. データ精錬度軸（D0〜D3）との対応

数学オントロジーは **D3（法則・主張・定義）が支配的な graph** である。生データ搬入問題（D0/D1）がほぼ存在せず、typed relation の質と traversal 能力が全てを決める。つまり「大規模データだから DB が要る」のではなく、**「D3 層の assertion 数と関係密度が大きいから graph substrate が要る」**。この区別を混同しない。

### 3. 既存 Vision との接続

- Axes.md の Deep 外部類似（nLab / Wikidata / mathlib4 依存網 / Stacks Project）は最初からこの方向を指していた
- mathlib4 Blueprint は edge 1 種（uses）の「やせた Deep」。M3E は多種 edge（一般化・双対・類比・…）を持つ数学 semantic graph でこれを超える
- V3（世界モデルから射影）: 数学オントロジーが世界モデルの具体形。射影出力 = 論文・申請書・講義ノート

### 4. 戦略的優位の論拠

- graph DB 人材は多いが、数学の内容に踏み込める人材は希少
- 数学者は多いが、graph DB / ontology エンジニアリングを回せる人材は希少
- 交差集合はほぼ空集合 → **vertical ontology × graph method の実践者としての先行者利益**
- 汎用 knowledge graph（Wikidata 等）は数学の型付き関係（双対・随伴・一般化の向き）を表現しきれていない。ここが M3E の差別化面

## 帰結（設計への影響）

1. Neo4j（graph substrate）は「いつか使う可能性がある」ではなく「**本命 use case が確定している遅延採用**」として扱う。撤退条件・adapter 中立性は維持するが、Deep 側の設計（typed edge 語彙、entity binding、identity）は数学オントロジーを想定して検証する
2. Demand Gate の実需 query 採取は、dogfooding だけでなく数学コンテンツ（論文読解・体系化）の初期運用からも行う
3. relationType 語彙の設計（現在保留中）は、数学の関係型（一般化 / 特殊化 / 双対 / 類比 / uses / 反例）を第一検証対象にする
