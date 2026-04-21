---
pj_id: PJ03
doc_type: idea
status: warning
date: 2026-04-21
updated: 2026-04-21
---

# Non-Tree Graph Runtime Warning

## このメモの目的

PJ03 では一時期、`tree-like M3E` の内部論理を system diagram にまで持ち込みすぎた。
その結果、**本来は tree ではない graph runtime を取り込む試み**が、
`tree への projection` や `scope への投影` に読み替えられてしまった。

このメモは、その誤読を今後繰り返さないための強い警告である。

## はっきり言うべきこと

**system diagram は知識ベース tree と根本的に性質が違う。**

- 知識ベース tree は説明順序、階層、包含を主に扱う
- system diagram / graph runtime は実行関係、制約、分岐、循環、外部接続を主に扱う

この 2 つは相補的ではありうるが、**同じ構造原理ではない**。
したがって、system diagram を tree に従属させてはいけない。

## PJ03 で起きた誤読

本来の意図:

- tree-like M3E を補完するために
- **まったく tree でない graph runtime**
- できれば LangGraph そのもの、少なくとも LangGraph 的 graph-first runtime

実際に進んだ方向:

- reducer / checkpoint / projection の groundwork
- tree に workflow を投影する実装
- scope projection を「graph 統合」に近いものとして扱う評価

このずれにより、
**non-tree runtime を取り込む**話が
**tree-first な workflow 表示**に置き換わった。

## 今後の禁止事項

以下の読み替えを禁止する。

1. 「graph runtime を入れたい」→「tree に workflow 情報を載せたい」
2. 「LangGraph を取り込みたい」→「LangGraph 風の図を map で描きたい」
3. 「system diagram を作りたい」→「tree + link の説明図を作りたい」
4. 「tree と相補的な graph が欲しい」→「tree に従属した projection でよい」

## 今後の基準

LangGraph 的なものを目指すなら、最低限次を満たすこと。

1. **graph-first**
2. node / edge が一次データ
3. loop / retry / route / conditional branch を graph 側で持つ
4. tree は必要なら projection 先であって、正本ではない
5. system diagram は knowledge tree の見た目規則に縛られない

## Plan 3 の位置づけ

Plan 3 の timed replay demo は、
**viewer 上で system picture を育てる demonstration**
としては価値がある。

しかしこれは、

- LangGraph の導入
- graph runtime の実装
- non-tree structure の統合

の代わりにはならない。

Plan 3 はあくまで demo / projection 系であり、
**graph runtime の本題ではない**。

## 一言でいうと

**tree の都合を system diagram に持ち込むな。**
PJ03 で欲しかったのは tree の派生物ではなく、tree と並立する non-tree graph runtime である。
