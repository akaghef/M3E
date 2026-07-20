---
title: PJ04 Layout + Multi-Root 戦略
pj: PJ04
status: draft (strategy)
date: 2026-04-22
scope: Phase 2 以降の layout / multi-Root / 描画 engine 方針
supersedes: none
references:
  - multi_root_scope_investigation.md
  - render_target_definition.md
  - system_diagram_map_model.md
  - map_attribute_spec.md
  - mermaid_parity_checklist.md
---

# Layout + Multi-Root 戦略

## 目的

PJ04 の描画層・map model・compile 契約を、次の 3 つの将来要件に耐える形で
同時に前進させるための **戦略書** (設計判断を集約した親文書)。

1. Multi-Root scope (複数入口 / 複数 lane) を意味論を壊さず吸収
2. 大規模 graph (100+ node) でも破綻しない layout
3. LangGraph 全機能再現 (Phase 3-5) に map 側が後追い migration なしで乗れる

各論 (4 案の神配置 / breadth lane / 4 層正本 / engine fork 不要 / Case A-D の評価)
はセッション議論で尽くされている。本書はそれらを **実行順序と hard rule** に
落とし、採否と pool を分ける。

## 0. Axiom (動かさない前提)

この 7 つは今回の議論で合意済み。以降の判断の土台。

| # | Axiom |
|---|---|
| X1 | **正本は制約 (④)、座標 (③) は cache 扱い** |
| X2 | **Mermaid / dagre / ELK は fork せず、engine だけ借りる** (elkjs を npm dep で導入) |
| X3 | **engine は Phase 3 前後で必要、今すぐ不要**。ただし schema は engine 前提で先に固める |
| X4 | **main lane は surface 内に 1 本のみ**。観察者 / review / escalation は別 lane に置く |
| X5 | **S-Root (AppState.rootId) は単数固定**。multi root 需要は map 分割で対応 |
| X6 | **Sc-Root (MapScope.rootNodeIds) の schema は配列のまま**、運用は当面 1 で回す |
| X7 | **auto layout は lane 内に閉じる**。lane 境界・lane role は user 意思 (hard anchor) |

## 1. 戦略の 3 レイヤ

本戦略は 3 レイヤで動く。上から下が契約、下から上が依存。

```
┌────────────────────────────────────────────┐
│ L-META: 制約正本 (④)                         │
│   lane-role / main lane / anchor / edge kind │
│   破綻を定義的に防ぐ規約                      │
└────────────────────────────────────────────┘
              │ 制約は engine 入力 or 手作業 hint
              ▼
┌────────────────────────────────────────────┐
│ L-COORD: 座標 (③)                            │
│   flowCol / flowRow / x / y                 │
│   cache。engine 有無で derive 方法が変わる     │
└────────────────────────────────────────────┘
              │ 座標が揃えば描ける
              ▼
┌────────────────────────────────────────────┐
│ L-RENDER: viewer SVG                         │
│   既存の bracket / diamond / edge 描画        │
│   ここは PJ04 の既存資産                      │
└────────────────────────────────────────────┘
```

## 2. Phase ごとの受け渡し

### Phase 1 — 完了済み / 締め作業のみ

- canonical 17-node parity: ✅
- edge v3 (orthogonal + U-arch + collision=0): ✅
- 残: 本戦略に整合するように doc open questions を更新 (§4 参照)

### Phase 2 — **layout 基盤の構築** (本戦略の実行主戦場)

#### 2-1. 制約語彙の確立 (L-META)

- `m3e:lane-role` 属性を `map_attribute_spec.md` に追加
  - values: `main` / `observer` / `review` / `escalation` / `reference` / `aux`
  - 制約: `main` は surface 内 1 本のみ (validator で検出)
- `m3e:anchor` 属性を追加
  - values: `fixed` / `hint` / (未指定=auto)
  - `fixed` は Tier 0 hard anchor として engine 導入後も動かない
- `m3e:edge-kind` 属性 (edge 側、近未来) — `forward` / `back` / `cross-lane` / `observe`

#### 2-2. breadth lane stacking の導入

- flow-lr surface に **上下方向の lane band** を導入
- lane 並び規約 (上から下):
  `observer → aux → main → review → escalation → reference`
- 並び強制は「soft default」。map 側 attribute で上書き可
- `flowRow` の意味を「絶対 row 番号」から「lane 内 row 番号」へ再定義
- 新規: `m3e:lane-row`(hint) — lane 内での row 位置

#### 2-3. 「監視する神」配置パターンの決定

- 既定 = **案 B (frame 肩書き)** — 特定対象なし / scope 全体監視
- 指し先あり = **案 A (sky lane)** — `lane-role=observer` で上段に積む
- 重い観察者 = **案 E (別 surface)** に逃がす
- **案 C (reference node) / 案 D (shadow lane) は原則不採用** (意味が弱い or 密度爆発)

#### 2-4. SVG snapshot 回帰 gate

- `projects/PJ04_MermaidSystemLangGraph/fixtures/canonical_layout.svg` を凍結
- `tools/snapshot.mjs` を拡張して `_diff.json` を出す (bbox 中心ずれ / 交差数 / 極端な座標)
- 閾値:
  - bbox 中心が 20px 以上動いた node が 3 個以上: blocker
  - 交差数が前回比 +30% 以上: blocker
  - 全 node の中心が同じ: ok

#### 2-5. Case D (multi-lane surface) を開ける

- schema 変更不要 (breadth lane stacking で吸収)
- layout engine 不要 (手作業 `flowRow` + lane-role で足りる)
- 開けることで observer / review / escalation の描画が即成立

### Phase 3 — **multi-entry + engine 導入判断**

#### 3-1. Case C (E-Root 複数化) 採用

- `GraphSpec.entries: string[]` を `entry: string` と並列に正とする
- `entry` は deprecated alias として残す
- `validateGraphSpec` は entries[] の reachability を検査
- LangGraph subprocess へは **virtual START 挿入** (`compileFromMap` で post-process)
- viewer 側は各 entry box に `▶` marker

#### 3-2. engine (elkjs) 導入の Go/No-Go

- Go 条件 (以下の **いずれか** を満たしたら): 
  - 1 surface の node 数が 30 を超えた
  - lane が 4 段以上になった
  - user が手作業 `flowCol/flowRow` で疲弊した (セッション内 3 回以上の調整)
- No-Go なら現状の手作業 + hint で継続
- 導入時は elkjs の `layerConstraint` / `fixed` に lane-role / anchor を pass-through

### Phase 4 以降 — 成熟化

- Case B (Sc-Root 複数化) の運用緩和判断
  - channel union の衝突解決ルールを `map_attribute_spec.md` に明文化してから
- elkjs による動的 re-layout (編集後の座標 cache 更新)
- subgraph 入れ子の hierarchical layout (elkjs hierarchical 使用)
- trace overlay が lane 配置上で animate する (Phase 5 Observability と接続)

## 3. Hard Rule (破綻回避)

違反したら即 blocker。

| 記号 | 規則 |
|---|---|
| HR-1 | `lane-role=main` は surface 内に 1 本のみ。複数検出で compile error |
| HR-2 | user が手で動かした `flowCol/flowRow` は auto で上書きしない (sticky) |
| HR-3 | engine 導入時は canonical SVG snapshot diff が閾値内であること |
| HR-4 | auto layout は lane 内に閉じる。lane 境界 (lane-role / row band) は engine に触らせない |
| HR-5 | 座標正本を `x/y` に置かない。`x/y` は常に cache / manual override 扱い |
| HR-6 | AppState.rootId の単数性を破る schema 変更は本 PJ 中は禁止 |

## 4. Open Questions の再配置

以前の open questions を戦略に合わせて再整理。

### 現状 open → 採用/pool/閉じる

| 元 | 再配置 |
|---|---|
| "fixed map での座標正本をどこに置くか" (`render_target_definition.md`) | **制約正本 (④) 採用**。座標は cache。`m3e:lane-role` / `m3e:anchor` に移す |
| "Human Gate を diamond 化するか" | pool (層違いの議論、本戦略で扱わず) |
| "phase grouping を border 付き subgraph にするか" | **border 付き scope として Phase 2-2 の lane 整理に乗せる** |
| "Mermaid import をいつ許可するか" | pool (現状 import 不要) |

### 新規 open (本戦略が生み出した)

| ID | 問い | pool or 採用 tgt |
|---|---|---|
| OQ-L1 | `lane-role` values の最終固定 (追加/削除の余地) | Phase 2-1 で fix |
| OQ-L2 | lane 並び規約を hard default にするか soft にするか | Phase 2-2 で fix |
| OQ-L3 | elkjs vs dagre の選択 (表現力 vs 軽さ) | Phase 3-2 で fix |
| OQ-L4 | engine を browser 側 (elkjs) / node 側 どちらで動かすか | Phase 3-2 で fix |
| OQ-L5 | multi-entry graph の default invoke 挙動 (最初の entry / 並列 / 要指定) | Phase 3-1 で fix |
| OQ-L6 | snapshot gate 閾値 (20px / 30% は仮) | Phase 2-4 で tuning |
| OQ-L7 | S-Root 1 固定を docs 正式化するか (data-model.md 参照) | beta merge 時 |

## 5. 具体的な着手順 (次セッションの initial queue)

```
(A) map_attribute_spec.md に m3e:lane-role / m3e:anchor を追加
(B) render_target_definition.md の open questions を本戦略に向けて更新
(C) fixtures/canonical_layout.svg を凍結
(D) tools/snapshot.mjs に _diff.json 出力を追加
(E) PJ04 canonical map に lane-role を当てる (手作業)
    - Explore / Plan / Execute System / Terminal は lane-role=main
    - Source / Notes は lane-role=reference
    - 観察者はまだ居ない (神は pool)
(F) viewer.ts の flow-lr layout を lane-role に従って row 割当
(G) snapshot gate を回帰 check として loop に組み込む
```

(A)-(D) は docs + tooling 変更で map / 描画コードに触らない。
(E)-(G) で map と viewer を動かす。

## 6. 本戦略が触らないもの

- `beta/src/node/workflow_*.ts` / `graph_runtime.ts` (PJ03 契約)
- `beta/src/shared/workflow_types.ts` / `checkpoint_types.ts` の既存 field
- `AppState.rootId` の単数性
- LangGraph subprocess 側の Python コード (Phase B 以降の話)
- tree projection (本戦略は system projection 限定)

## 7. Merge への接続

PJ04 merge strategy (`merge_strategy.md`) に照らして、本戦略の成果は:

- L-META 語彙 (`lane-role` / `anchor` / `edge-kind`) → **docs first** (PR 1)
- SurfaceNodeView 意味変更 (flowCol/flowRow の lane 解釈) → **model second** (PR 2)
- viewer の lane band 描画 → **viewer third** (PR 3)
- snapshot gate tool → viewer と一緒 (PR 3)

PJ04 終了条件に「L-META 語彙が固定されている」を加える。

## 8. TL;DR

> **意味 (制約) を正本にする。座標は cache。engine は Phase 3 前後で入れる、fork はしない。
> main lane は 1 本、観察者は別 lane。Case D (multi-lane) は今すぐ開ける、Case C (multi-entry)
> は Phase 3 で、Case A (S-Root forest) は閉じたまま、Case B (Sc-Root multi) は保留。**
