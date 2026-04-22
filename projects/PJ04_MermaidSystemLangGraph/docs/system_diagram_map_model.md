---
title: System Diagram Map Model
pj: PJ04
status: draft
date: 2026-04-22
---

# System Diagram での Map Model

## 目的

本書は、PJ04 において system diagram を扱うときの **map model** を書き下す。
ここで言う map model は、永続化される正本の構造を指す。

重要なのは、tree と system diagram を別の正本に分けることではない。
**1 つの map model を持ち、その上に tree projection と system projection を載せる**
ことを前提にする。

## 先に固定する立場

1. 正本は `map model`
2. `tree` は projection
3. `system diagram` も projection
4. `window state` は正本に混ぜない

したがって、現行 M3E の tree-first な見え方は正本ではなく、
map model の 1 つの見方として扱う。

## 現行 M3E との差

現行 M3E は、実質的には次の前提で動いている。

- 親子が一次構造
- scope は部分木
- 位置は tree からかなり導かれる
- linear panel は tree の別表現

system diagram で必要なのは次である。

- `node + relation` を一次構造として扱う
- `scope` は subtree というより subsystem 境界として扱う
- 位置は tree ではなく diagram layout に従う
- detail level は構造ではなく window state に属する
- edge は補助ではなく一次情報である

したがって、既存 model の軽微修正ではなく、
**projection-aware な map model への整理** が必要になる。

## 構成要素

### 1. map

map は正本全体である。
複数 surface、node、relation を含みうる。

### 2. node

node は map 上の要素の総称である。
system diagram では次の 2 種に分かれる。

- `entity node`
- `scope node`

### 3. entity node

下位 scope を持たない通常 node。

例:

- action
- gate
- terminal
- reference

### 4. scope node

下位 scope を持つ node。
UI 上では subsystem の箱として描画され、入ると別 surface が見える。

補足:

- `portal` という別概念は立てない
- 必要だった意味は `scope node` に含める

### 5. scope

subsystem の内部図を表す構造単位。
tree の親子そのものとは同一視しない。

scope node は scope への入口を持つ。

### 6. relation

node 間の意味関係。
system diagram では relation が一次情報である。

例:

- `next`
- `approve`
- `reject`
- `blocked`
- `resolved`

### 7. surface

図面そのもの。
「どの scope の内部を、どの relation 群で見せるか」を決める内容面。

1 つの scope に対して 1 つ以上の surface を許容してよいが、
PJ04 ではまず **1 scope = 1 primary surface** でよい。

## projection

### tree projection

map model を tree として見る投影。

役割:

- tree editor
- linear panel
- 既存 M3E の主表示

特徴:

- 親子が前景化される
- relation は弱い
- breadth / depth が読みの主軸になる

### system projection

map model を system diagram として見る投影。

役割:

- `flow-lr` の system surface
- subsystem を箱として見る表示
- relation を主に読む diagram

特徴:

- relation が前景化される
- node の位置は diagram layout に従う
- scope node は subsystem box として可視化される

## window state

window state は正本に混ぜない。
これは「いまどう見ているか」の状態であり、map model ではない。

含むもの:

- selection
- zoom
- pan / camera
- detail level
- view mode (`tree` / `system`)

補足:

- `detail level` は scope の構造ではない
- 同じ surface でも window によって見え方は変わる

## UI 用語との対応

| map model 側 | UI 側の見え方 |
|---|---|
| `scope node` | subsystem box |
| `entity node` | 通常 node |
| `relation` | edge |
| `surface` | 図面 |
| `window state` | その図面の見え方 |

## PJ04 でまず必要な最小 model

PJ04 では、一般化しすぎず次の最小 model をまず成立させる。

1. `node`
2. `scope node`
3. `relation`
4. `surface`
5. `window state`

特に、以下を明示的に分けることが重要である。

1. `scope node` と `entity node`
2. `surface` と `window`
3. `map model` と projection
4. 正本構造と detail level

## PJ04 の結論

PJ04 における system diagram の本質は、
「tree を派手に描くこと」ではない。

本当に必要なのは、
**1 つの map model を持ち、その上に tree projection と system projection を載せること**
である。

したがって、system diagram 対応は viewer の飾りではなく、
map model の責務分離を伴う設計課題として扱う。
