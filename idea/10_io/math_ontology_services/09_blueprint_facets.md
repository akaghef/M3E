# 09. Blueprint の facet 分離と相互参照

Blueprint を M3E に取り込むとき、単なる dependency DAG として扱うだけでは情報を落とす。
少なくとも **設計 facet** と **実装 facet** を分け、その間を相互参照できる形にした方が自然である。

この文書は採用判断をしない。Blueprint の見え方をどう分解して捉えるか、その候補を整理する。

## まず何が混ざっているか

Blueprint の 1 ノードには、少なくとも次の情報が同居している。

- **D1. 設計 facet**
  - 自然言語の statement / proof
  - 人間が読むための定理文、補題文、証明スケッチ
  - `\uses` による設計上の依存
- **D2. 実装 facet**
  - `\lean{...}` で指す Lean 宣言
  - `\leanok` による formalized 状態
  - mathlib 済みか、project ローカルか
- **D3. 文書 facet**
  - chapter / section / 並び順
  - blueprint という文書としての章立て
- **D4. 進捗 facet**
  - 「statement だけ formalized」「proof まで formalized」などの状態
  - dependency graph 上の色分け

つまり Blueprint は「依存グラフ」だけではなく、
**設計書 + 実装参照 + 文書構造 + 進捗可視化** の複合体になっている。

## 色分けは何を表しているか

leanblueprint / PFR の dependency graph の色分けは、主に **formalization status** を表す。

- **青枠**: statement は formalize 可能
- **オレンジ枠**: statement はまだ blueprint 側の整備不足
- **青背景**: proof は formalize 可能
- **緑枠**: statement は formalized
- **緑背景**: proof も formalized
- **濃緑**: proof と祖先まで formalized
- **濃緑枠**: mathlib 済み

重要なのは、これは「数学的意味の分類」ではなく **進捗 facet の可視化** だという点。
M3E にそのまま入れるなら、意味エッジの色と混ぜず、facet を分けて保持した方が混乱が少ない。

## 自然言語 LaTeX の立ち位置

Blueprint に書かれている自然言語の statement / proof は、
Lean から自動生成されたものではなく、**人間が blueprint に書く設計文書** である。

- 定理本文 = 何を示したいか
- proof 本文 = どう示すかの設計
- `\lean` = 実装上の着地点へのポインタ
- `\leanok` = 着地済みの印

したがって、Blueprint を取り込むときの自然な理解は:

- 自然言語本文 = **design facet**
- Lean 宣言 = **implementation facet**

であり、両者は同じノードの属性ではなく、
**別 facet のノード同士が参照し合う** 形でもよい。

## M3E での分け方の候補

### A1. 混在ノード型

1 ノードに
`details = 自然言語`,
`attributes.lean4_decl = ...`,
`attributes.progress = ...`
を全部載せる。

- 良い点: 単純
- 悪い点: facet が混ざり、表示切替が難しい

### A2. 同一 map / 別 scope 型

同じ map の中に scope を分ける。

- `Dependency` scope
  - 実ノードと `uses` DAG
- `By Chapter` scope
  - chapter ごとの並び替え
  - alias で実ノードを参照
- `Implementation` scope
  - Lean 宣言ごとの実装側ノード
- `Progress` scope
  - formalization status を俯瞰する view

これは M3E 的にかなり自然。
facet を分けながら、同じ map の中で往復できる。

### A3. 別 map / 相互リンク型

- design map
- implementation map
- progress map

を分ける。

- 良い点: 純粋
- 悪い点: 行き来が重い

Blueprint のように「同じ対象を複数視点で見る」用途では、少し分かれすぎる可能性がある。

## scope + alias が便利な理由

同じ map の中で facet を分けるなら、
**本体は 1 箇所、他 facet は alias 参照** が基本パターンになる。

例:

- `Dependency` scope に theorem / lemma / definition の実ノードを置く
- `By Chapter` scope では chapter folder の中に alias だけ置く
- 将来 `Implementation` scope を作るなら、Lean 宣言ノードを本体にして
  design 側から alias 参照する逆構成もあり得る

この方式の利点:

- ノード内容の正本が 1 箇所に定まる
- facet ごとに並び替え・絞り込みができる
- cross-facet reference が安い

## 相互参照の最小プロトコル

Blueprint 由来のノードで最低限ほしい cross-facet reference は次の 3 種。

- **R1. design -> implementation**
  - `formalizes`
  - 自然言語 statement がどの Lean 宣言に対応するか
- **R2. implementation -> design**
  - `designed_as`
  - Lean 宣言から元の blueprint 説明へ戻る
- **R3. progress -> {design, implementation}**
  - `status_of`
  - formalization status がどの対象に掛かっているか

Blueprint では `\lean` / `\leanok` がその萌芽に当たる。
M3E 側ではこれを relation と scope の両方で育てるイメージ。

## M3E に持ち込む時の色分け方針候補

Blueprint の色は進捗 facet を表すので、そのまま dependency 色と混ぜない方がよい。

### C1. 進捗色を node fill に寄せる

- ノード背景色 = progress
- link 色 = relation kind

最も素直。意味と進捗の軸が衝突しにくい。

### C2. 進捗色を chapter / implementation scope のみで有効化

- `Dependency` scope では relation kind を優先
- `Progress` / `Implementation` scope では formalization status を優先

facet ごとに配色規則を変える案。

### C3. 進捗は色ではなく badge / note 化

- `status: formalized / can_prove / not_ready`
- 色には使わない

M3E 側の既存 difficulty coloring と競合しにくい。

## 今の見立て

現時点の見立てとしては、次が一番筋がよい。

1. **design facet** を主正本に置く
2. `Dependency` scope に実ノードと `uses` DAG を置く
3. `By Chapter` scope は alias facet にする
4. 将来的に `Implementation` scope を追加し、Lean 宣言ノードとの往復を作る
5. 色分けは dependency 色と formalization 色を混ぜず、facet ごとに分ける

## 未決質問

- **Q1.** design facet と implementation facet のどちらを正本に置くか
- **Q2.** `\lean` が複数ある時、1 statement : N implementation をどう表すか
- **Q3.** proof の自然言語本文は statement ノードに含めるか、proof ノードとして分けるか
- **Q4.** progress facet は node 属性で十分か、独立 scope を持つべきか
- **Q5.** Blueprint 由来の色分けを M3E の既存 coloring とどう共存させるか
- **Q6.** alias だけで十分か、それとも `formalizes` のような cross-facet relation type を別途張るべきか
