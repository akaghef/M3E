# Requirements Document

## Project Description (Input)

**progressive-nav-seam** - Progressive Navigation (PN) の見える破綻を先に直す visible-fix seam と PN lab。

**(a) 誰の課題か**
M3E Director / Codex worker / akaghef。特に本番 PN UI でカードが canvas content に重なる、PN edge が EdgePort seam を通らない、viewport 変更ごとに overlay 再測定が走って見た目が崩れる、collapse / overflow / 3rd-level の動作が action-tree prototype の実績から後退している問題を解く。

**(b) 現状**
`beta/src/browser/workbench-ui.tsx` の PN は `makeProgressiveNodes()`、layout、overlay placement、edge routing、viewport event handling を同一 React component 内に持つ。PN edge は既存 `beta/src/shared/edge_port.ts` / `edge_route.ts` / `parent_child_edge_adapter.ts` を使わず、`edgePathBetweenRects` を直接 import している。CSS は `.wb-progressive-nav` を absolute overlay として置くが、canvas content との occupancy / avoidance contract が無い。`beta/src/browser/viewer.ts` の `applyZoom()` は viewport transform 適用ごとに `m3e:viewport-changed` を dispatch し、PN はその都度 DOM remeasure する。

**(c) 変えたいこと**
visible-fix scope として `pn_layout` typed pure seam を定義する。入力は `PnNode[]{ id, parentId, label, hint, action }`、root/anchor rect、viewport snapshot、measurement snapshot。出力は overlay placement、node rects、parent-child routed edges、overflow/collapse state。PN edge は EdgePort の `selectPorts` / `route` または `routeParentChildEdge` を唯一経路にする。PN lab は過去 `beta/prototypes/action-tree` の段階展開 / 親位置保持 / DOM rect edge / keyboard / search の実績を、seam 型入力で再現する。

## Boundary Context

- **In scope**: `.kiro/specs/progressive-nav-seam/` の spec 草案、破綻診断、`pn_layout` contract、PN overlay placement / layer contract、viewport fast path と PN remeasure 分離、collapse / overflow / 3rd-level 表示、EdgePort 連携、PN lab、golden sample、dependency-cruiser / typecheck / jscpd / PN lab Playwright / EN5-Lite ratchet 設計。
- **Out of scope**: この spec 作成時点での implementation code、`beta/` source 変更、package/workflow 変更、actual lab 実装、PR 作成、map-backing (`pn:id` を map subtree から読む `pn_model`)、Surface View canonical name reconcile の実装、PN の action semantics 拡張、AI proposal / generation behavior の修正。
- **Binding sources**:
  - `.kiro/steering/ui_view_taxonomy_and_ports.md`
  - `docs/06_Operations/Development_System.md`
  - `.kiro/specs/edge-port-seam/*`
  - `.kiro/specs/node-draw-seam/*`
  - `docs/tasks/handoff_layout_refactor_pn_integration.md`
  - `beta/prototypes/action-tree/{index.html,app.js,styles.css}`
  - `beta/src/browser/workbench-ui.tsx`
  - `beta/src/browser/viewer.ts`
  - `beta/src/shared/edge_port.ts`
  - `beta/src/shared/edge_route.ts`
  - `beta/src/shared/parent_child_edge_adapter.ts`
- **Visible-fix priority**: 表示 / レイアウト / 接続の破綻を最優先で直す。model backing と canonical name reconcile は follow-up に回す。
- **Exclusive seam rule**: PN placement と PN parent-child edge は `pn_layout` と EdgePort 経由を唯一経路にする。PN component が layout helper / `edgePathBetweenRects` / GraphLink nearest helper を直接呼ぶ状態は completion と見なさない。
- **Reference composition rule**: PN lab と product PN は同一 `pn_layout` / EdgePort shared module を import する。prototype からの copy / paste、lab-only fork、product-only fork は禁止する。

## Product and Operations Context

- **Related strategy**: `S3` data-safe / operable UI、`S13` runtime 経路単純化、viewer の見える破綻修復。
- **Active development target**: `beta/`
- **Glossary boundary**: `map` / `node` / parent-child `edge` / `GraphLink` / `canvas` / `viewer` を混同しない。PN の `edge` は PN tree 内の parent-child route であり GraphLink ではない。
- **PN taxonomy**: PN node fields are `pn:id`, `pn:hint`, `pn:action` conceptually; first ratchet uses in-memory `PnNode` input with `id / parentId / label / hint / action`.
- **Current failure mode**:
  - visible overlay と canvas content の occupancy が未定義で、PN cards can overlap live canvas nodes.
  - PN edge は shared EdgePort seam を bypass し、`edgePathBetweenRects` direct line で route される。
  - viewport transform と PN remeasure が同じ `m3e:viewport-changed` event に載っており、pan/zoom fast path 中に PN layout が再測定される。
  - 3rd-level / overflow は 2026-06-16 handoff で破綻済みと記録され、現在も PN layout / CSS が component-local fallback と global `window.m3eLayout` 呼び出しの混在状態にある。
  - action-tree prototype で実証済みだった段階展開、親位置保持、DOM rect からの edge、keyboard/search が product PN seam として保存されていない。

## Existing Analysis

### EA1: PN edge bypasses EdgePort

- `beta/src/browser/workbench-ui.tsx:34` imports `edgePathBetweenRects` from `./edge_geometry`.
- `beta/src/browser/workbench-ui.tsx:1151-1169` builds PN edge paths inside `ProgressiveNavigation`.
- `beta/src/browser/workbench-ui.tsx:1165` calls `edgePathBetweenRects(parentRect, childRect, 0)` directly.
- `beta/src/browser/edge_geometry.ts:153-157` implements `edgePathBetweenRects` as a straight `M source L target` based on nearest rect ends, not the shared `EdgePort` / `EdgeRoute` route contract.
- Existing shared seam exists: `beta/src/shared/edge_port.ts:84-92` exports `selectPorts`, `beta/src/shared/edge_route.ts:75-92` exports `route`, and `beta/src/shared/parent_child_edge_adapter.ts:58-67` composes `selectPorts -> route`.

**Root cause:** PN remained outside the EdgePort ratchet. The visible line may attach to DOM rect boundaries in simple right-tree cases, but it is not typed as parent-child edge, does not expose source/target side metadata, and can drift from product edge behavior.

### EA2: Overlay placement has no canvas-avoidance contract

- `beta/src/browser/workbench-ui.css:520-534` makes `.wb-progressive-nav` an absolute overlay at default `left: 72px; top: 307px`, with `overflow: visible` and no z-index.
- `beta/src/browser/workbench-ui.tsx:1001-1009` computes active-node placement from anchor `getBoundingClientRect()` and clamps only to viewport bounds.
- `beta/src/browser/workbench-ui.tsx:1233-1243` applies the placement directly to the overlay only in `active-node` mode.
- `beta/src/browser/workbench-ui.css:567-585` and `602-607` position edges and node buttons absolutely inside the same visible overlay, but there is no reservation, collision avoidance, or layer policy relative to the canvas.

**Root cause:** PN placement is a viewport clamp, not an overlay layout decision. It does not know the canvas content rects, safe zones, rail/topbar/right-panel occupancy, or whether opening deeper levels will cover selected canvas content.

### EA3: Viewport transform and PN remeasure are coupled

- `beta/src/browser/viewer.ts:4201-4222` applies canvas width/height/transform and dispatches `m3e:viewport-changed` on every `applyZoom()`.
- `beta/src/browser/workbench-ui.tsx:1202-1212` listens to `m3e:viewport-changed` and calls `measureRootAnchor`, which reads DOM rects and mutates `rootRect` / placement.
- `beta/src/browser/workbench-ui.tsx:1171-1200` uses live DOM measurement inside the React component, so every viewport event can cause layout state updates.

**Root cause:** pan/zoom fast path and PN measurement path share a high-frequency event. During camera movement, PN should translate from cached anchor/viewport state or defer remeasure; it should not recompute layout on every viewport transform.

### EA4: 3rd-level / overflow behavior regressed after 2026-06-16 PN+layout attempt

- `docs/tasks/handoff_layout_refactor_pn_integration.md:69-72` records that placing PN through `layout()` was implemented and reverted after the user reported PN collapsed.
- `docs/tasks/handoff_layout_refactor_pn_integration.md:92-96` records the unresolved visible issue: 3rd-level `View > Layout > Direction` collapsed because the layout was effectively two-level oriented; visual confirmation was incomplete.
- Current PN still mixes `window.m3eLayout` (`workbench-ui.tsx:1057-1110`) and fallback absolute columns (`workbench-ui.tsx:1070-1090`) while CSS allows unconstrained visible overflow (`workbench-ui.css:520-534`, `567-585`).

**Root cause:** PN was treated as another layout consumer without a PN-specific display contract. The product needs a `pn_layout` seam whose first-class invariant is staged expansion with bounded overlay footprint, not generic map layout.

### EA5: Prototype behavior was not converted into a reusable seam

- `beta/prototypes/action-tree/app.js:80-98` computes visible nodes by active path plus sibling/child expansion.
- `beta/prototypes/action-tree/app.js:100-131` supports hover/click activation, root collapse, reset, and root reveal suppression.
- `beta/prototypes/action-tree/app.js:133-164` computes edges from live DOM rects.
- `beta/prototypes/action-tree/app.js:260-301` implements command search/list and keyboard-focused rendering.
- `beta/prototypes/action-tree/styles.css:38-48` keeps canvas and navigator in a grid, avoiding unmanaged overlap between the navigation surface and canvas.

**Root cause:** validated PN behavior exists only as a prototype. Product PN adopted pieces of it without a shared input/output contract, lab gate, or golden tests.

## Requirements

### Requirement 1: `pn_layout` typed pure contract

**Objective:** Codex worker と Director として、PN visible placement と PN tree edge を product component local state から切り出したい。これにより visible failure を pure golden と lab で固定できる。

#### Acceptance Criteria

1. implementation phase では `src/shared/pn_layout.ts` または同等の shared public contract を定義する設計でなければならない。
2. public input は `PnNode[]{ id, parentId?, label, hint, action? }`、`activeId`、`rootId`、`anchorRect`、`viewportRect`、`safeZones`、`nodeMetrics`、`options` を持たなければならない。
3. public output は `overlayRect`、`nodeRectsById`、`visibleNodeIds`、`pathIds`、`edges`、`overflow`、`focusOrder` を持たなければならない。
4. `pn_layout` は DOM / React / canvas element / global `viewState` / AppState / map storage に依存しない pure function でなければならない。
5. `pn_layout` は first ratchet では map-backing を読まず、caller-provided `PnNode[]` だけを consume しなければならない。
6. output edge は SVG `d` だけでなく source / target id、source / target rect、selected source / target side、route style を検査可能にしなければならない。
7. helper は shared module 内で module-private にし、product / lab / tests は public `layoutProgressiveNav(...)` だけを呼ぶ設計でなければならない。

### Requirement 2: Overlay placement and layer contract

**Objective:** akaghef として、PN cards が canvas content に重ならない visible behavior を先に保証したい。これにより本番 UI の破綻を先に止める。

#### Acceptance Criteria

1. `pn_layout` は viewport bounds だけでなく `safeZones` を入力に持ち、left rail / topbar / right panel / selected canvas content / active anchor avoidance を表現できなければならない。
2. overlay placement は `placementForAnchor` のような viewport clamp だけで完了してはならない。
3. first ratchet の placement fallback 優先順は `right-of-anchor`、`dock-left-of-anchor`、`compact`、`fixed-side-panel`、`scroll` でなければならない。
4. placement はこの順序で試行し、canvas safeZones に対する `overlapScore = 0` を満たす最初の candidate を採用しなければならない。
5. chosen placement の `overlayRect` と placed node rects は selected / visible canvas node rects と重なってはならず、chosen placement の対 canvas-node `overlapScore` は必ず `0` でなければならない。
6. output は選ばれた placement reason、ordered candidate list、rejected candidate overlap score を持ち、golden で検査できなければならない。
7. CSS layer contract は PN overlay、PN edge layer、PN node layer、canvas content、modal/popover の z-order を明示しなければならない。
8. PN overlay は product canvas transform の子になってはならず、camera pan/zoom scale の影響を受けない screen-space overlay として扱わなければならない。
9. どの placement でも canvas-node overlap を避けられない場合は `overflow.mode` を `scroll` / `compact` / `side-panel` のいずれかにし、silent clip を禁止しなければならない。
10. canvas overlap rule は selected / visible canvas node content safeZones に対する規則であり、overlay 自身の内部レイアウトや空白 canvas との関係には適用しない設計でなければならない。

### Requirement 3: EdgePort integration for PN parent-child edges

**Objective:** PN edge を EdgePort seam に乗せ、`edgePathBetweenRects` direct call をやめたい。これにより parent-child edge / route style / GraphLink を混同しない。

#### Acceptance Criteria

1. PN parent-child edge は `selectPorts -> route` または `routeParentChildEdge` を唯一経路にしなければならない。
2. PN product code は `edgePathBetweenRects` を import または call してはならない。
3. PN lab は `src/browser/edge_geometry.ts` を import してはならない。
4. PN edge input は parent-child relation として typed され、GraphLink / LinkPort / nearest endpoint edit helper を入力に持ってはならない。
5. first ratchet の PN route style は EdgeRoute canonical `orthogonal | line | curve | force-link` の subset に map しなければならない。
6. PN edge golden は source side / target side を exact compare しなければならない。
7. EdgePort integration は existing `edge_port.ts` / `edge_route.ts` / `parent_child_edge_adapter.ts` を reuse し、PN 専用の port selector copy を作ってはならない。

### Requirement 4: Viewport fast path and PN remeasure separation

**Objective:** pan/zoom fast path と PN remeasure を分離し、PN が viewport 変更のたびに崩れないようにしたい。

#### Acceptance Criteria

1. implementation phase では `m3e:viewport-changed` を PN layout remeasure の唯一 trigger にしてはならない。
2. PN は anchor measurement snapshot と viewport snapshot を持ち、camera transform 中は cheap translate / cached placement path を使う設計でなければならない。
3. DOM remeasure は open, active path change, anchor identity change, layout option change, resize, settled camera event のような bounded trigger に限定しなければならない。
4. high-frequency pan/zoom event が発生しても `layoutProgressiveNav` の recompute count が増え続けないことを Playwright or unit harness で検査しなければならない。
5. `viewer.ts applyZoom()` の fast path は canvas transform / inline editor / linear panel sync を阻害してはならない。
6. PN remeasure が必要な場合でも requestAnimationFrame / debounce / settled event などで coalesce し、multiple synchronous state updates を避けなければならない。
7. viewport separation は linear panel pan fast-path regression を再発させないよう、PN-only coupling と dependent overlay sync を分けて記録しなければならない。

### Requirement 5: Collapse, overflow, and 3rd-level display

**Objective:** action-tree prototype の段階展開を基準に、PN の 3rd-level / overflow / collapse を product で保証したい。

#### Acceptance Criteria

1. `pn_layout` は active path、visible sibling set、visible children set を output し、3rd-level 以上を first-class に扱わなければならない。
2. 3rd-level `View > Layout > Direction` と route groups は overlap / clipped / offscreen になってはならない。
3. root click or reset collapse は visible nodes を root baseline に戻し、hover root reveal suppression のような accidental reopen 防止を設計しなければならない。
4. overflow は hidden accidental clipping ではなく explicit state (`scroll`, `compact`, `side-panel`, etc.) として扱わなければならない。
5. keyboard focus order は `focusOrder` output と一致し、search filtering 後も selected/focused row が visible でなければならない。
6. hover / focus / click activation は active path と output `visibleNodeIds` を一致させなければならない。
7. product test は 3rd-level と active-node PN の両方を検査しなければならない。

### Requirement 6: PN lab based on action-tree prototype

**Objective:** akaghef として、以前検証した action-tree と同じ感じで PN visible behavior を product 全体なしに目視したい。

#### Acceptance Criteria

1. PN lab は `src/labs/pn/` 配下の standalone app として設計されなければならない。
2. lab input は `PnNode[]{ id, parentId, label, hint, action }` を第一入力にしなければならない。
3. lab は段階展開、親位置保持、DOM rect からの measurement snapshot、EdgePort routed edge、keyboard move/open/run、search filtering、collapse/reset を確認できなければならない。
4. lab は product browser implementation (`src/browser/workbench-ui.tsx`, `viewer.ts`) を import してはならない。
5. lab は existing action-tree prototype を参考にするが、logic copy ではなく shared `pn_layout` contract を通して動かなければならない。
6. lab Playwright は 3rd-level、overflow fallback、keyboard/search、edge side metadata、no canvas overlap を検査しなければならない。
7. lab は action-tree の段階展開、親 node 位置保持、keyboard/search、safeZone no-overlap を `PnNode[]` 入力で再現し、akaghef が動作感承認を判断できる状態にしなければならない。
8. PN lab の見た目承認ラインは spec で事前固定せず、akaghef の lab 動作感承認で確定しなければならない。
9. lab green 単独を product green と見なしてはならず、product PN adapter Playwright と EN5-Lite gate を通して昇格可能にしなければならない。

### Requirement 7: EN5-Lite visible-fix ratchet

**Objective:** visible-fix seam を一度切った後に再結合しないよう、EdgePort / nodeDraw pattern と同じ ratchet を持ちたい。

#### Acceptance Criteria

1. **EN3**: `typecheck` は shared `pn_layout`、product adapter、PN lab、tests が同一 contract を import することを検査する設計でなければならない。
2. **EN1/EN4**: dependency-cruiser は `src/labs/pn/** -> src/browser/**` import と product PN から `edgePathBetweenRects` direct import を禁止する設計でなければならない。
3. **EN2**: `jscpd` は product / PN lab 間で layout, visibility, placement, edge routing logic の copy を検出する gate として設定されなければならない。
4. pure unit tests は `pn_layout` golden を使い、placement, node rects, edge side, overflow, visible ids, focus order を検査しなければならない。
5. PN lab Playwright は product-independent visual behavior を検査しなければならない。
6. product PN Playwright は live viewer route で PN overlay が selected canvas content と重ならないこと、3rd-level が表示されること、viewport pan/zoom 中に PN layout recompute が暴走しないことを検査しなければならない。
7. first ratchet は EN5-Lite とし、pure golden + PN lab Playwright + product PN Playwright + typecheck + dependency-cruiser + jscpd を必須にしなければならない。
8. real-server broad composition は follow-up にできるが、fixture-only green を product green と見なしてはならない。

## Follow-up / Non-goals

1. **map-backing / `pn_model`**: `pn:id` / `pn:hint` / `pn:action` を map subtree から読む model adapter は visible-fix 後の follow-up。
2. **canonical Surface View name reconcile**: product PN の legacy labels / modes (`mindmap`, `logic-chart`, `timeline`, `scatter`) を `Tree / Axial / Radial / Disperse / System` へ reconcile する作業は follow-up。ただし新しい spec/type では canonical naming を使い、legacy を増やさない。
3. **AI generation / prepared-answer fixes**: active-node PN actions の generation quality や fixture fallback removal は別 task。
4. **GraphLink editing**: PN edge is parent-child tree edge only; GraphLink endpoint edit semantics are out of scope.

## Director Resolved

### PN-Q1: overlay fallback priority

**決定:** placement の試行順は `right-of-anchor` → `dock-left-of-anchor` → `compact` → `fixed-side-panel` → `scroll` とする。canvas safeZones に対する `overlapScore = 0` を満たす最初の placement を採用する。

**根拠:** first visible-fix は見える破綻を止めることが目的であり、候補探索の自由度より決定論的な fallback と golden 検査を優先する。

### PN-Q2: safe-zone overlap tolerance

**決定:** selected / visible canvas node content safeZones に対する許容 overlap は `0` とする。採用された placement の `overlayRect` と placed node rects は canvas node rects と重なってはならず、chosen placement の対 canvas-node `overlapScore` は `0` 必須とする。overlay 自身の内部レイアウトや空白 canvas との関係はこの限りでない。

**根拠:** ユーザー報告の本体は PN card が canvas content に重なる visible failure であり、曖昧な許容量を置くと同じ破綻が残る。

### PN-Q3: PN lab approval line

**決定:** PN lab の見た目承認ラインは事前固定しない。lab は action-tree の段階展開、親 node 位置保持、keyboard/search、safeZone no-overlap を `PnNode[]` 入力で再現し、akaghef が動作感承認を判断できる状態にする。

**根拠:** PN の最終 feel は lab での人間承認が必要な visual surface であり、spec は判断可能な最低条件を固定する。

### (a) First ratchet is visible-fix PN seam

**決定:** 最初の単位は map-backed PN model ではなく、見える破綻を止める `pn_layout` seam と PN lab に限定する。

**根拠:** ユーザー scope は「見える破綻を先に直す」。canvas overlap / edge bypass / viewport remeasure / 3rd-level が現在の blocking visible failure である。

### (b) PN edge uses existing EdgePort, not a new edge layer

**決定:** PN 用 port selector は作らず、既存 `edge_port.ts` / `edge_route.ts` / `parent_child_edge_adapter.ts` を reuse する。

**根拠:** EdgePort seam は既に shared contract として存在し、PN はそれを bypass していることが原因である。

### (c) PN lab derives from action-tree behavior, not product implementation

**決定:** PN lab は action-tree prototype の validated interaction を基準にするが、実装は shared `pn_layout` contract を通す。

**根拠:** prototype の価値は段階展開 / search / keyboard / DOM-rect edge の behavior であり、prototype code の copy ではない。

### (d) EN5-Lite is enough for first visible-fix ratchet

**決定:** first ratchet は pure golden、PN lab Playwright、product PN Playwright、typecheck、dependency-cruiser、jscpd で完了可能にする。real-server broad composition は follow-up。

**根拠:** visible PN overlay は lab + product viewer Playwright で検査できる。map-backing が non-goal のため real map model composition を first gate にしない。

## Requirements Traceability Notes

- Requirement 1-2: `pn_layout` contract and overlay/canvas avoidance.
- PN-Q1 / PN-Q2 update Requirement 2: placement order is fixed and chosen placement must have canvas-node `overlapScore = 0`.
- Requirement 3: EdgePort integration and `edgePathBetweenRects` bypass removal.
- Requirement 4: viewport fast path separation.
- Requirement 5: collapse / overflow / 3rd-level behavior.
- PN-Q3 updates Requirement 6: lab approval line is akaghef動作感承認, with action-tree behaviors as minimum acceptance.
- Requirement 7: EN5-Lite ratchet and guardrails.
