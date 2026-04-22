---
title: PJ04 Merge Strategy
pj: PJ04
status: draft
date: 2026-04-22
---

# PJ04 終了後の Merge Strategy

## 目的

本書は、PJ04 の成果をどの順番で本体へ merge するかを定義する。
ここで重要なのは、PJ04 の探索文脈と beta 本体の安定運用を混ぜないことである。

PJ04 の merge は **PJ 終了後、別セッションで行う**。
探索中にそのまま本体へ流し込まない。

## なぜ分けるか

PJ04 では次が同時に起きている。

- 用語の再定義
- viewer の試験実装
- map model の再整理
- system projection の試作

これは有益だが、探索の最中は前提がまだ動く。
この段階で beta 本体へ直接統合すると、次の問題が出る。

1. tree-first 前提の既存 doc と衝突する
2. 試験実装が正本化されやすい
3. merge review が「何を採る判断か」不明瞭になる

したがって、PJ04 ではまず **PJ 内 docs で理論芯を固定** し、
その後に別セッションで merge 判断を行う。

## merge の基本方針

1. 先に doc を固める
2. その後に model 差分を切る
3. 最後に viewer / UI を選別して持ち込む

つまり、merge の順は

1. 語彙
2. model
3. projection
4. 実装

である。

## PJ04 終了条件と merge 開始条件

merge 開始前に、少なくとも次を満たす。

1. PJ04 docs 内で用語が固定されている
2. `map model / tree projection / system projection / window state` の分離が明文化されている
3. viewer 試作で system diagram の成立条件が一通り見えている
4. 「試験的 workaround」と「持ち込むべき設計」が分離できている

これを満たさないうちは、merge しない。

## 何を merge 候補にするか

### 1. docs first

まず merge 候補にするのは文書である。

対象:

- 用語の整理
- map model の整理
- system projection の位置づけ
- merge 時の注意点

理由:

- 実装より先にレビューできる
- 本体側の言葉を揃えられる
- tree-first 前提の doc を段階的に置き換えられる

### 2. model second

次に merge 候補にするのは model 上の責務分離である。

対象:

- `surface` と `window` の分離
- `scope node` / `entity node` の区別
- `relation` を一次情報として扱うための土台

ここは一気に全面移行せず、
既存 M3E を壊さない形で差し込めるものだけを持ち込む。

### 3. viewer third

viewer 実装は最後に選別して merge する。

候補:

- `tree/system` view mode
- system surface での linear panel 非表示
- scope box / detail preview
- 4 点 anchor
- flow-lr 専用キーバインド

ただし、この層は PJ04 内の試行錯誤が多いので、
**そのまま全部は持ち込まない**。

## merge 対象から外すもの

PJ04 終了時点で、以下はそのまま本体に持ち込まない前提で考える。

1. PJ04 専用 attribute 名の暫定値
2. canonical sample 専用の座標調整
3. 試行的な layout workaround
4. merge review を通っていない用語

## merge セッションでやること

別セッションで、次を順に実施する。

1. PJ04 docs を読み直して採用する語彙を固定する
2. 本体 docs に必要な差分だけを抜き出す
3. viewer 実装を「採用」「保留」「破棄」に三分する
4. 本体向けの最小差分 PR 単位に分割する

つまり、merge セッションは実装の続きではなく、
**PJ04 の成果を本体向けに審査・整形する作業** として行う。

## 推奨する PR 分割

### PR 1

docs only

- 用語整理
- map model の位置づけ
- projection の位置づけ

### PR 2

model / state

- `surface` / `window` の責務分離
- `view mode` の導入余地

### PR 3

viewer

- system mode UI
- linear panel 非表示
- scope box
- edge anchor / routing 改善

## 最終方針

PJ04 の成果は価値があるが、
その価値は「試作コードをそのまま流し込むこと」ではない。

価値の中心は、
**system diagram を扱うために map model と projection をどう分けるべきかを先に言語化したこと**
にある。

したがって merge は、
PJ04 終了後の別セッションで
**docs first, model second, viewer third**
の順で行う。
