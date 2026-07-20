# UI View Taxonomy & Edge Port Contract（binding steering）

> layout / edge / render に触る spec は本書を **honor 必須**。定義は既に存在したのに
> layout-seam-lab が legacy 命名と nearest-port を使い、定義が生かされなかった
> （2026-06-26 akaghef 指摘）。本書は再発防止のため canon を束ね、未活用だった
> port 契約を明示する。**新しい定義はしない。canon への束ねと拘束規則のみ。**

## Canonical 正本（参照先）

- **Surface View 正本**: `docs/03_Spec/map_layout_modes.md` — `Tree / Axial / Radial / Disperse / System` の5種＋ `subtype / direction / space / edge` option。
- **用語**: `docs/00_Home/Glossary.md`。
- **state 分離**: `docs/03_Spec/Model_State_And_Schema_V2.md` — `ViewState`(transient UI) と `Structure state`(canonical model) と `view logic`(投影規則)。
- **UI 分岐の網羅ソース（map）**: ws `ws_REMH1Z5TFA7S93R3HA0XK58JNR` / map `map_1780450175739_m0ybyy` / scope `n_1780450268817_0y2l7w`。View 配下に Tree/Axial/Radial/Disperse/System、加えて Scatter・Mindmap・Annotation・Panel の action 群、PN(`pn:id`/`pn:hint`/`pn:action`)。

## 拘束規則

1. **Surface View 名は canonical を使う**: `Tree / Axial / Radial / Disperse / System`。legacy 名（`tree / mindmap / logic-chart / timeline / scatter / system`）は migration 専用で、canonical へ map する。確定 map: `tree→Tree` / `timeline→Axial(timeline)` / `scatter→Disperse(scatter)` / `system→System`。**要確認**（`map_layout_modes.md` を正とする）: `mindmap→Tree(direction=both)?` / `logic-chart→Tree(down) か Axial?`。新規実装で legacy 名を増やさない。

2. **`edge` の両義を分離する**: parent-child relation（tree edge）と route style（option: `orthogonal / line / curve / force-link`）と `GraphLink`（cross relation）は別物。spec/コードで混同禁止。

3. **Edge port 契約（Port pure layer、2026-06-16 handoff 由来。未活用だった本体）**:
   - `selectPorts(srcRect, dstRect, branchDirection) → ports` は **branch-aware**（parent/child の相対位置と branch direction で port を選ぶ）。
   - `route(ports, style) → path`。
   - `nearestEdgePortSide(...)` は **GraphLink 端点編集専用**。**branch edge に流用するな**（流用すると「近い方の左右 port に繋がる」誤接続になる＝akaghef 指摘の不具合）。
   - `LinkPort` の `"auto"` は意味を一義化する（fixed side only の sanitize と齟齬あり、要整理）。

4. **Surface View 投資優先度（Decision_Pool 2026-07-18-002）**: **Tree = 最優先（仕上げ）、Disperse = 次点（最大エフォート）、Axial / Radial / System = 凍結**。新規 spec / 実装 / 検証投資は Tree・Disperse のみ対象。凍結 view は non-regression のみ守り、golden 表・lab では `frozen` と明示する。凍結 view に触る必要が出たら Decision_Pool で解凍判断してから着手する。

## 既知ギャップ（reconcile 対象）

- `.kiro/specs/layout-seam-lab` の `LayoutMode` は legacy 混在命名。canonical へ reconcile 要。
- branch-aware `selectPorts` 未実装（`Tree right` のみ）。left/both/up/down 欠如。
- layout-lab の edge 描画は暫定 bezier で、port 契約を反映していない（本来 edge seam の領域）。
- `LinkPort "auto"` の不整合。

## 適用

- layout / edge / render の spec・lab・実装は本書の規則1-3を満たすこと。
- edge/port seam を立てる際は規則3の Port pure layer 契約を出発点にする（`map_layout_modes.md` の Surface View と整合）。
