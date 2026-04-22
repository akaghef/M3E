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

を、**固定 map sandbox** で切り分け直す PJ である。

この PJ の最小到達点は、
**`plan6/cycle2/canonical_mermaid.html` のような canonical system diagram を固定 map 上で graph-first に描画し、その graph を LangGraph compile seed へ接続すること**
に置く。

## この PJ の位置づけ

### 何を解くか

PJ03 では workflow / demo / projection / LangGraph lab が同時に走り、
「system diagram を graph-first に持つとは何か」が主題として閉じなかった。

PJ04 では最初から次を固定して始める。

1. map は固定
2. 主題は system diagram
3. 正本候補は graph semantics
4. Mermaid は canonical notation / sample として扱う
5. LangGraph は runtime compile 先として扱う

### 本体との距離

この PJ は **beta 本体へ即統合する実装PJではなく、sandbox で graph-first の成立条件を詰める設計・試作PJ** である。

したがって本 PJ の価値は、

- system diagram を tree-first 誤読なしに表現できるか
- node / edge / scope semantics をどう切るべきか
- LangGraph compile の入口をどこに置くか

を狭い条件で確定することにある。

### 現在の repo 優先度との関係

現在の主戦場は `S2` Team Collaboration と `S3` 保存・同期・復元の信頼性であり、PJ04 はその代替ではない。
PJ04 は、それらと競合しない sandbox として **将来の graph authoring / inspection の地ならしをする探索枠** として扱う。

## 成功基準

### 最小成功

- 固定 map 上に `canonical_mermaid.html` 相当の canonical system diagram を graph-first に描画できる
- Mermaid canonical sample と M3E の map / scope 構造を比較できる
- notes 描画と scope 構造が明確に分離される

### 中間成功

- node / edge / scope semantics が graph-first に定義される
- fixed map で 1 本の graph authoring loop が回る
- M3E graph model から LangGraph compile seed へ 1 回通せる

### 最終成功

- PJ03 で本来やりたかった
  Mermaid + system diagram + LangGraph の一体化が
  tree-first 誤読なしに sandbox 内で成立する

## 非目標

- いきなり beta 本体へ全面統合すること
- 複数 map 対応を先に一般化すること
- PJ03 の clean-up をこの PJ の主目的にすること
- 完成 IDE を目指すこと

## 前提と判断ルール

1. 固定 map を前提に進める
2. Mermaid source は入力として使ってよいが、最終正本は graph semantics 寄りで判断する
3. notes 描画と graph 構造は別物として扱う
4. 描画ターゲットは `plan6/cycle2/canonical_mermaid.html` / `canonical_rendered.svg` を基準サンプルとして扱う
5. M3E 現行コードに寄せるが、tree-first convenience に引き戻されるなら却下する
6. LangGraph は compile / inspect 先であり、PJ04 の graph semantics を置き換える正本ではない
7. 正本は `map model` とし、`tree` と `system diagram` は projection として扱う

## フェーズ

### Phase 0 — Bootstrap

目的:

- sandbox を作る
- canonical sample / seed code / references を揃える

状態:

- 完了

成果物:

- PJ04 ディレクトリ
- README / plan / tasks
- PJ03 からの seed コピー

### Phase 1 — Fixed Map Drawing

目的:

- 固定 map 上で canonical system diagram を graph-first に描画する

出口条件:

- target map が固定される
- canonical Mermaid sample が notes ではなく scope 構造として表現される
- viewer 上で Mermaid sample と map 構造を見比べられる
- `canonical_mermaid.html` にある node / gate / labeled edge の主要表現が落ちずに再現される

成果物:

- canonical Mermaid sample の scope 化
- canonical render parity checklist
- fixed-map layout prototype
- notes 描画と scope 構造の切り分け

### Phase 2 — Interaction

目的:

- system diagram に必要な最小操作を足す

出口条件:

- 最小操作セットが文書化される
- fixed-map prototype と矛盾しない操作対象が定まる

候補:

- node 追加
- edge 追加
- edge type 編集
- lane / scope 編集

### Phase 3 — Graph Model

目的:

- node / edge / scope / surface / window state / layout hint / runtime feedback の graph-first schema を固める

出口条件:

- graph semantics が Mermaid parity 論点付きで定義される
- `map model / tree projection / system projection / window state` の分離が明文化される
- runtime feedback の置き場が決まるか、候補が十分に絞られる
- M3E 現行コードのどこを流用し、どこを切り離すかが明文化される

### Phase 4 — LangGraph Compile Seed

目的:

- fixed-map graph を LangGraph seed に compile する

出口条件:

- 1 本の fixed-map graph を LangGraph seed code または state に落とせる
- compile 経路が tree projection を runtime 正本として要求しない

### Phase 5 — Inspection

目的:

- current node / trace / blocked reason を M3E 側に戻す最小 loop を作る

出口条件:

- LangGraph runtime 側の状態を M3E map 上で最小限読める
- graph authoring と inspection が同じ sandbox 内で往復できる

## 直近の実行順

### Now

最初に閉じるべきなのは Phase 1 である。
理由は、graph semantics を先に抽象化しすぎると tree-first な代用品を正当化しやすく、逆に固定 map で 1 つ描いてみると必要な semantics の粒度が見えるからである。

### 次の最小 deliverable

1. fixed target map を 1 つ決める
2. canonical Mermaid sample を scope 構造へ写す
3. `canonical_mermaid.html` の node / gate / labeled edge を描画要件として列挙する
4. notes と scope の境界を明文化する
5. viewer 上で比較できる状態まで持っていく
6. system diagram での `map model` を書き下す

その後に、

1. 最小操作を切る
2. graph schema を定義する
3. LangGraph compile seed へ接続する

の順で進める。

## 未決定論点

1. Mermaid source を正本にするか、graph model を正本にするか
2. edge semantics を既存 link に寄せるか、system diagram 専用語彙を持つか
3. graph scope と既存 folder / scope の関係をどう切るか
4. runtime feedback を map 本体に置くか、別ストアに置くか
5. PJ04 の成果をどの粒度で beta 本体へ merge するか

## Seed 資産

この PJ はゼロからではなく、以下を seed として始める。

- Mermaid canonical sample (`plan6/cycle2/`)
- canonical flow doc (`docs/canonical_subpj_flow.md`)
- Mermaid parity checklist (`docs/mermaid_parity_checklist.md`)
- render target definition (`docs/render_target_definition.md`)
- system diagram map model (`docs/system_diagram_map_model.md`)
- merge strategy (`docs/merge_strategy.md`)
- LangGraph lab seed (`runtime/langgraph_lab/pj04_lab_seed.py`)
- M3E current references (`references/m3e_current/`)

## Merge 方針

PJ04 の探索成果は、PJ 継続中にそのまま beta 本体へ流し込まない。
merge は **PJ 終了後、別セッションで行う**。

順序は次で固定する。

1. docs first
2. model second
3. viewer third

詳細は [docs/merge_strategy.md](docs/merge_strategy.md) に分離する。

## メモ

この PJ で重要なのは、Mermaid をきれいに描くこと自体ではない。
**system diagram を M3E の map / scope / node / edge でどう持つと graph-first と言えるか**
を先に固定し、その後で操作と runtime を載せる順序を崩さないことが重要である。
