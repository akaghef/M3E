---
pj_id: PJ04
project: MermaidSystemLangGraph
status: active
date: 2026-04-22
---

# PJ04 Mermaid + System Diagram + LangGraph — Plan

## TL;DR

PJ04 は、PJ03 で混線した

- Mermaid notation
- system diagram
- graph-first authoring
- LangGraph runtime

を、**固定 map sandbox** の上でやり直す PJ である。

主題は、
**「固定 map 上に system diagram を graph-first に描画し、操作を足し、LangGraph compile まで通す」**
こと。

## 前提

この PJ では次を前提にする。

1. map は固定
2. まず system diagram を描画する
3. その後に操作を足す
4. ある程度具体的な部分は M3E 現行コードに寄せる
5. Mermaid は notation / canonical sample として使う
6. LangGraph は runtime として使う

## なぜ PJ03 を継続せず PJ04 にしたか

PJ03 は参照元として重要だが、

- groundwork
- demo
- projection
- LangGraph lab
- graph authoring vision

が一つの PJ に積み重なりすぎて、graph-first 設計を clean に進めにくい。

PJ04 では、最初から

- fixed map
- system diagram
- Mermaid canonical
- LangGraph seed

を束ねた sandbox として始める。

## 成功基準

### 最小成功

- 固定 map 上に canonical system diagram を graph-first に描画できる
- Mermaid canonical sample と M3E scope 構造が比較できる
- 操作追加の最小設計がある

### 中間成功

- node / edge / scope semantics が graph-first に定義される
- fixed map で 1 本の graph authoring loop が回る
- M3E graph model -> LangGraph compile seed が通る

### 最終成功

- PJ03 で本来やりたかった「Mermaid + system diagram + LangGraph の一体化」が、
- tree-first 誤読なしで sandbox 内に成立する

## 非目標

- いきなり本体へ全面統合
- 複数 map 対応
- PJ03 の clean-up
- 完成 IDE

## Phase

### Phase 0 — Bootstrap

目的:

- sandbox を作る
- canonical sample / seed code / references を揃える

成果物:

- PJ04 ディレクトリ
- README / plan / tasks
- PJ03 からの seed コピー

### Phase 1 — Fixed Map Drawing

目的:

- fixed map 上で system diagram を graph-first に描画する

成果物:

- canonical Mermaid sample の scope 化
- fixed-map layout prototype
- notes 描画と scope 構造の切り分け

### Phase 2 — Interaction

目的:

- system diagram に必要な最小操作を足す

候補:

- node 追加
- edge 追加
- edge type 編集
- lane / scope 編集

### Phase 3 — Graph Model

目的:

- node / edge / scope / layout hint / runtime feedback の graph-first schema を固める

### Phase 4 — LangGraph Compile Seed

目的:

- fixed-map graph を LangGraph seed に compile する

### Phase 5 — Inspection

目的:

- current node / trace / blocked reason を M3E 側に戻す最小 loop を作る

## 初手の論点

1. Mermaid source を正本にするか、graph model を正本にするか
2. GraphLink を既存 link に乗せるか、別 semantics にするか
3. graph scope と folder scope をどう並立させるか
4. runtime feedback を map 本体に置くか別ストアに置くか

## 実装の出発点

この PJ はゼロからではなく、以下を seed として始める。

- Mermaid canonical sample (`plan6/cycle2/`)
- canonical flow doc (`docs/canonical_subpj_flow.md`)
- Mermaid parity checklist (`docs/mermaid_parity_checklist.md`)
- LangGraph lab seed (`runtime/langgraph_lab/pj04_lab_seed.py`)
- M3E current references (`references/m3e_current/`)

## 一言でいうと

PJ04 は、
**PJ03 で本当はやりたかった Mermaid + system diagram + LangGraph を clean sandbox で実現する PJ**
である。
