# Anchoring という用語の整理

`anchoring` を、知識グラフや facet 表示において **leaf を見やすくするために synthetic node を挿入して束ねる操作** として使う案を整理する。

ここでいう anchor は ontology 上の本質ノードではなく、**表示・探索・fan-out 制御のための補助構造** である。

## 最小定義

- `leaf`
  - 本体ノード
  - 宣言、定理、定義、文書片、実装 artifact など
- `anchor`
  - leaf 群を束ねる synthetic node
  - 表示整理のために置く
- `anchoring`
  - anchor を挿入してレイアウトを整える操作
- `anchored layout`
  - anchoring 後の表示構造
- `re-anchoring`
  - anchor 配置を後から作り直すこと

## 何が嬉しいか

- root や上位ノードの fan-out を抑えられる
- leaf を消さずに局所構造だけ作れる
- 厳密な ontology を決める前でも見やすい表示が作れる
- facet ごとに別の束ね方を適用できる
- anchor を捨てても leaf の identity と link を壊さずに済む

## 何ではないか

- 概念的な親子関係そのものではない
- 真理値のある分類ではない
- 永続的に固定される設計判断ではない
- alias や cross-facet reference の代替ではない

つまり anchor は **内容そのもの** ではなく、**内容の見せ方** に属する。

## 使いどころ

### 1. Dependency facet

- source node が多すぎるときに束ねる
- 補助 lemma 群を main line から軽く分離する
- definition / support / main theorem のような表示整理を作る

### 2. Document facet

- chapter / section / notebook 単位の自然な束ねをそのまま使う
- これは元構造を anchor として流用するケース

### 3. Implementation facet

- namespace / module / prefix ごとに宣言を束ねる
- 元データに章立てがない場合の fan-out 制御として有効

### 4. Progress facet

- formalized / partial / unresolved のような状態別に束ねる
- 内容の意味というより進捗軸のビューを作る

## anchor の作り方の種類

### A. 原構造 anchoring

元データにすでにある章立て・階層をそのまま利用する。

- chapter
- section
- namespace
- module

一番安全で、説明責任も持ちやすい。

### B. 表示 heuristic anchoring

fan-out 制御だけを目的に、雑なルールで束ねる。

- prefix が同じ leaf をまとめる
- 件数がしきい値を超えたときだけ 1 段 anchor を足す
- 補助ノードを `support` に寄せる

厳密性は弱いが、実用上かなり効く。

### C. 意味推論 anchoring

内容の意味に基づいてクラスタを作る。

- entropy 系
- Ruzsa 系
- PFR 系

これは魅力的だが、もっとも不安定で、分類器を別に持ちたくなりやすい。

## 安全な運用原則

- leaf の ID は anchor 導入で変えない
- alias の target は常に leaf を指す
- link の source/target は leaf を基準に保つ
- anchor は synthetic であると明示する
- anchor は後で作り直せる前提にする

要するに、anchor は **可逆で、非本質で、facet 局所的** であるべき。

## 命名候補

- `anchoring`
  - もっとも短く自然
- `display anchoring`
  - 表示用であることを強調する
- `layout anchoring`
  - レイアウト目的を強調する
- `facet anchoring`
  - facet ごとの処理であることを強調する

普段使いは `anchoring` で十分だが、仕様文書では `display anchoring` と書くと誤解が減る。

## M3E / PJ02 文脈での含意

- `tree edge` や `GraphLink` の protocol とは別レイヤの話として扱える
- facet が複数ある場合、各 facet に別の anchoring をかけられる
- `Implementation` facet のように原構造が薄い場所ほど anchoring の価値が高い
- `By Chapter` のように原構造が強い facet では anchoring はほぼ自明になる

この用語を採用すると、「構造の意味」と「表示の束ね方」を分離して議論しやすくなる。

## まだ未決な点

- anchor を node type で区別するか、attribute で区別するか
- scope をまたぐ anchor を許すか
- anchored layout を保存するか、その場で再生成するか
- 色分けを anchor にも適用するか

## ひとことで言うと

`anchoring` は、**leaf を本体のまま保ちつつ、表示のためだけに人工的な足場を差し込むこと** である。
