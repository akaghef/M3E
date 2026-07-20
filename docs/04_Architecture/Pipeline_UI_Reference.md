# Pipeline UI Reference

## Status

- Date: 2026-06-06
- Status: working reference
- Source: X post by GianMattya: https://x.com/GianMattya/status/2062294853464265004
- Reference asset: [../for-akaghef/assets/260606_pipeline_flow_ui_reference.jpg](../for-akaghef/assets/260606_pipeline_flow_ui_reference.jpg)

この文書は、参照 UI を M3E にそのままコピーするための仕様ではない。
M3E の既存語彙と実装境界に落とし込み、後続の viewer / workbench 実装で使える設計資産として扱う。

## Scope

取り込むもの:

- 左から右へ読む pipeline / system graph の情報設計
- node type を card / badge / port / color で見分ける視覚文法
- 選択 node の詳細を右 panel に出す inspector pattern
- replay / trace / minimap / legend の周辺 UI 構成
- 大規模 AI system を「文書」ではなく「可視化用 UI」で理解する発想

取り込まないもの:

- M3E の既定 Rapid tree viewer の置換
- 全 node を常時強い色で塗る visual style
- edge label を全量常時表示する密度
- dark theme を全 surface の既定にする判断
- Markdown renderer への raw HTML / JavaScript 埋め込み

## Fit to M3E

| 参照 UI の要素 | M3E での対応 | 実装上の扱い |
|---|---|---|
| 全体 canvas | `viewer` の rendering surface | UI shell ではなく描画 layer |
| 左から右の列 | Surface View の `Axial` / `System` | `layout=flow-lr` の候補 |
| card node | `TreeNode` の表示 | node 本体は既存 `AppState.nodes` |
| card type | `attributes` / `GraphSpecNode.kind` | color だけでなく badge / shape で表現 |
| data flow line | `GraphLink` | 親子 `edge` と混同しない |
| system spine | 親子 `edge` | scope / contract の主骨格 |
| right detail panel | inspector / Contract Tree preview | 選択状態は `ViewState`、正本変更は Model 経由 |
| replay button | Run / Trace 表示 | runtime state を Authoring Map に直接書き戻さない |
| minimap | camera overview | `ViewState` に属する |
| legend | type encoding guide | color-only encoding を避ける |

## Visual Rules

1. 既定 Rapid surface は現行の calm / information-first 方針を維持する。
2. この参照 UI は、system / runtime / workflow graph のような「実行構造を読む surface」に限定して適用する。
3. node type は color + badge + shape の 3 系統で表す。色だけに意味を持たせない。
4. edge label は hover / selected / replay step の時だけ強く表示する。常時全表示は避ける。
5. 選択 node の incoming / outgoing path を強調し、それ以外を dim する。
6. detail panel は graph を隠しすぎない。大画面では右固定、小画面では bottom sheet にする。
7. replay / trace 表示は ViewState または Run record 由来の一時表示であり、map 構造の正本にはしない。

## Transferable Component Inventory

| Component | Purpose | M3E implementation note |
|---|---|---|
| Top toolbar | view mode, fit, replay, filter | React UI shell |
| Type legend | node/link type decoding | React UI shell; color + label + icon |
| Flow card | node summary | rendering layer node component |
| Port marker | edge attachment clarity | GraphLink source/target port display |
| Edge label chip | branch / condition label | hidden by default, shown on focus |
| Inspector panel | selected node contract | React panel fed by selected `TreeNode` / `GraphSpecNode` |
| Trace replay control | execution playback | derived from Run / Trace, not stored as node edits |
| Minimap | spatial orientation | camera ViewState |

## Implementation Contract

実装に進む場合は、次の境界を守る。

- UI shell: React component。toolbar / inspector / legend / replay control を持つ。
- Rendering layer: graph surface。node / edge / GraphLink / port / minimap を描く。
- Model: `AppState`、`TreeNode`、`GraphLink`、`MapSurface` を保持する。
- ViewState: selected node, selected link, camera, hover, replay step, dimming を保持する。
- GraphSpec: 実行可能な system contract へ compile する derived data。map 正本ではない。

既存 dependency を使う。

| Need | Preferred dependency | Reason |
|---|---|---|
| interactive node graph | `@xyflow/react` | node / edge / port / viewport が揃っている |
| automatic layered layout | `elkjs` | left-to-right pipeline layout に向く |
| dense graph analysis / overview | `cytoscape` | 大規模 graph の集約表示に向く |

自前 SVG layout を新規に増やすのは、既存 viewer の限定的な保守に留める。
新しい pipeline / system surface は、まず `@xyflow/react` + `elkjs` の adapter として検証する。

## Data Mapping Draft

`TreeNode.attributes` は既存 namespace を優先する。

| Purpose | Existing / preferred key |
|---|---|
| GraphSpec node kind | `m3e:kernel-node-kind` |
| callable / tool ref | `m3e:kernel-callable-ref` |
| display label | `m3e:kernel-label` |
| subgraph scope | `m3e:kernel-subgraph-scope` |
| router ref | `m3e:kernel-router-ref` |
| channels | `m3e:kernel-channels` |
| workflow graph status | `workflow.graph.*` |

新しい表示専用 key が必要な場合は、`m3e:surface.*` namespace を候補にする。
ただし、最初は `MapSurface.nodeViews` の `flowCol` / `flowRow` / `shape` を優先し、node 本体へ表示都合を混ぜすぎない。

## Test Plan

### Normal

- `flow-lr` surface で node が左から右へ安定配置される。
- node 選択時に inspector が対象 node / GraphSpec 情報を表示する。
- selected path の強調と非関連 node の dimming が働く。
- minimap と fit-to-content が camera state と一致する。

### Boundary

- 100 node / 200 GraphLink 程度でも label が破綻しない。
- 長い node label は card 内で折り返すか、省略 + tooltip になる。
- 小さい viewport では inspector が bottom sheet に切り替わる。
- edge label が多い graph でも常時表示で重ならない設計にする。

### Failure

- endpoint 不明の GraphLink は描画しないか、明確な broken 表示にする。
- compile warning がある GraphSpec node は inspector で warning を出す。
- replay trace が存在しない場合、replay control は disabled state にする。
- runtime trace を Authoring Map の node edit として誤保存しない。

## Next Implementation Slice

1. `beta` の workbench 側に read-only pipeline preview route を作る。
2. `AppState` + `GraphSpec` から `@xyflow/react` nodes / edges へ変換する adapter を作る。
3. `elkjs` で `flow-lr` layout を計算する。
4. inspector は既存 selected node state を読むだけにし、書き込みは後続 task に分離する。
5. Playwright で nonblank render、fit-to-content、selection inspector、label overflow を確認する。
