# Implementation Plan

> この tasks は spec-only draft。実装 phase では task worktree `codex/progressive-nav-seam` 等で実行する。各 task は TDD 順で、acceptance を満たすまで次の ratchet へ進まない。現 draft 作成では implementation code を書かない。

## Phase 0: Baseline and Scope Lock

- [ ] 1. Confirm current PN visible failure surface
  - **Boundary:** investigation only.
  - Inspect `workbench-ui.tsx`, `workbench-ui.css`, `viewer.ts applyZoom()`, existing PN Playwright tests, action-tree prototype, and shared EdgePort modules.
  - Record exact current symbols and lines for `makeProgressiveNodes`, `ProgressiveNavigation`, `edgePathBetweenRects`, `m3e:viewport-changed`, and CSS overlay classes.
  - **Acceptance:** implementation handoff lists root causes for canvas overlap, PN edge bypass, viewport remeasure coupling, and 3rd-level/overflow regression.

- [ ] 2. Add failing `pn_layout` contract test
  - **Boundary:** `beta/tests/unit/pn_layout_contract.test.ts` or equivalent.
  - Import future `layoutProgressiveNav`, `PnNode`, `PnLayoutInput`, `PnLayoutOutput`.
  - Build a minimal `[GUI] -> View -> Layout -> Direction -> Right` sample.
  - Assert output includes overlayRect, visibleNodeIds, pathIds, node rects, focusOrder, overflow, and EdgePort side metadata on edges.
  - **Acceptance:** test fails because `pn_layout.ts` does not exist yet; no product code changed.

- [ ] 3. Add failing safe-zone golden test
  - **Boundary:** `beta/tests/unit/pn_layout_golden.test.ts`, `beta/tests/fixtures/pn-layout-golden/`.
  - Hand-author a safe-zone collision case where `right-of-anchor` overlaps selected canvas node content and `dock-left-of-anchor` or a later fallback is the first candidate with canvas-node overlapScore `0`.
  - **Acceptance:** test fails until shared layout exists; expected output includes placement reason, fixed trial order, rejected candidate scores, and chosen placement canvas-node `overlapScore = 0`.

- [ ] 4. Add failing EdgePort integration test for PN edge
  - **Boundary:** pure unit test only.
  - Route a PN parent-child edge and assert source `right`, target `left`, route style metadata, and endpoint coordinates through existing EdgePort output shape.
  - **Acceptance:** test fails until PN layout edge output uses `routeParentChildEdge` or `selectPorts -> route`; no `edgePathBetweenRects` import is used in test.

## Phase 1: Shared `pn_layout`

- [ ] 5. Create shared `pn_layout` public contract
  - **Boundary:** `beta/src/shared/pn_layout.ts`, TypeScript config only as needed.
  - Define `PnNode`, `PnRect`, viewport/safe-zone/input/output/edge/placement/overflow types and `layoutProgressiveNav`.
  - Keep helpers module-private.
  - Do not import React, DOM, `viewer.ts`, `workbench-ui.tsx`, AppState, map storage, or browser globals.
  - **Acceptance:** task 2 type imports compile; contract contains no map-backing and no product command side effects.

- [ ] 6. Implement visible node/path/focus calculation
  - **Boundary:** `pn_layout.ts` and unit tests only.
  - Implement active path, sibling/child visibility, root baseline, 3rd-level support, and focusOrder.
  - Include action-tree-like behavior for active path retention.
  - **Acceptance:** tests pass for root open, 3rd-level `View > Layout > Direction`, active-node expand, and search-filter path retention.

- [ ] 7. Implement deterministic node rect placement
  - **Boundary:** `pn_layout.ts` and unit tests only.
  - Place visible PN nodes by depth columns with explicit row gaps and column gaps.
  - Preserve parent position context when expanding deeper levels.
  - Support at least four depth columns before overflow fallback.
  - **Acceptance:** 3rd-level and 4th-level samples do not overlap sibling cards; output node rects are deterministic exact golden values.

- [ ] 8. Implement overlay candidate scoring
  - **Boundary:** `pn_layout.ts` and unit tests only.
  - Add fixed trial order: `right-of-anchor`, `dock-left-of-anchor`, `compact`, `fixed-side-panel`, `scroll`.
  - Score weighted safe-zone overlap, viewport overflow, anchor occlusion, and distance.
  - Adopt the first candidate in trial order whose selected/visible canvas-node `overlapScore` is `0`.
  - Emit selected/rejected candidate scores.
  - **Acceptance:** safe-zone golden passes; viewport clamp alone is insufficient to pass the test; chosen placement canvas-node `overlapScore = 0`.

- [ ] 9. Implement overflow modes
  - **Boundary:** `pn_layout.ts` and unit tests only.
  - Emit explicit `none | scroll | compact | side-panel`.
  - Add narrow viewport sample and clippedIds/scrollRect output.
  - If no placement can satisfy canvas-node overlapScore `0`, choose explicit overflow handling (`scroll`, `compact`, or `side-panel`) rather than silent clipping.
  - **Acceptance:** narrow golden uses explicit overflow state, chosen placement records why zero overlap could not be achieved, and no uncontrolled CSS clipping is accepted.

## Phase 2: EdgePort Routing

- [ ] 10. Add PN edge adapter inside shared layout
  - **Boundary:** `pn_layout.ts` or narrow shared helper.
  - Convert parent/child PN rects to existing EdgePort `EdgeRect`.
  - Call `routeParentChildEdge` or `selectPorts` then `route`.
  - Map PN route option to EdgeRoute `orthogonal | line | curve`.
  - **Acceptance:** task 4 passes; every output edge includes sourceSide/targetSide and path `d`.

- [ ] 11. Remove product PN `edgePathBetweenRects` bypass
  - **Boundary:** product PN adapter / `workbench-ui.tsx` only.
  - Stop importing `edgePathBetweenRects` in PN code.
  - Render `PnRoutedEdge.d` and metadata from `layoutProgressiveNav`.
  - Do not change GraphLink or normal map edge rendering.
  - **Acceptance:** existing PN edge Playwright tests pass with EdgePort output; grep confirms no PN path calls `edgePathBetweenRects`.

- [ ] 12. Add dependency-cruiser PN edge bypass rule
  - **Boundary:** `beta/dependency-cruiser.config.cjs`.
  - Forbid product PN adapter / workbench PN module from importing `src/browser/edge_geometry.ts`.
  - Forbid `src/labs/pn/**` from importing `src/browser/**`.
  - Forbid `src/shared/pn_layout.ts` from importing browser/React/DOM modules.
  - **Acceptance:** `npm --prefix beta run lint:deps` fails with a temporary bypass import and passes after removing it.

## Phase 3: Product PN Adapter

- [ ] 13. Create product measurement adapter
  - **Boundary:** `beta/src/browser/pn_workbench_adapter.ts` or narrow code inside `workbench-ui.tsx`.
  - Collect anchorRect, viewportRect, fixed UI safe zones, selected canvas content rect when available, and nodeMetrics.
  - Keep DOM reads outside shared `pn_layout`.
  - **Acceptance:** adapter unit/harness test can build `PnLayoutInput` without invoking product commands or map storage.

- [ ] 14. Wire `ProgressiveNavigation` through `layoutProgressiveNav`
  - **Boundary:** `workbench-ui.tsx` and optional PN adapter.
  - Replace component-local layout/edge computation with shared output.
  - Preserve existing PN node labels/actions and active-node PN behavior.
  - Preserve current click/hover/focus activation semantics unless tests expose a visible bug.
  - **Acceptance:** existing `workbench_progressive_nav.spec.js` visible behavior passes; 3rd-level layout route group remains visible.

- [ ] 15. Add explicit PN layer CSS contract
  - **Boundary:** `workbench-ui.css`.
  - Add documented z-index/layer relation for PN overlay, PN edges, PN cards, modal/popover.
  - Ensure PN overlay is screen-space and not a child of transformed canvas content.
  - Replace uncontrolled visible overflow with class/state based scroll/compact/side-panel behavior.
  - **Acceptance:** screenshot/DOM checks show PN cards above PN edges, modal above PN, and no accidental clipping in narrow viewport sample.

## Phase 4: Viewport Separation

- [ ] 16. Add recompute counter harness before changing event wiring
  - **Boundary:** PN adapter test or Playwright instrumentation.
  - Count `layoutProgressiveNav` recomputes while many `m3e:viewport-changed` events fire.
  - **Acceptance:** test initially fails or is marked expected-fail because current PN remeasures from the high-frequency viewport event.

- [ ] 17. Split camera fast path from PN remeasure
  - **Boundary:** `workbench-ui.tsx`, PN adapter, minimal `viewer.ts` event change if needed.
  - Limit full DOM remeasure to open/activeId/anchor identity/layout option/resize/camera settled triggers.
  - Coalesce measurement through requestAnimationFrame or debounce.
  - Do not regress linear panel immediate transform sync.
  - **Acceptance:** recompute counter test passes; active PN remains visually stable during drag pan; no synchronous remeasure loop occurs.

- [ ] 18. Add product viewport Playwright regression
  - **Boundary:** `beta/tests/visual/workbench_progressive_nav.spec.js` or new focused spec.
  - Open active-node PN, simulate pan/zoom or repeated viewport events, assert overlay remains usable and recompute count is bounded.
  - **Acceptance:** test fails if PN recomputes on every viewport tick or jumps into canvas content.

## Phase 5: Collapse, Overflow, and 3rd-level Product Coverage

- [ ] 19. Add 3rd-level/4th-level PN product test
  - **Boundary:** Playwright only.
  - Exercise `View > Layout > Direction`, `View > Layout > Edge Route`, and active-node `N2 -> N3-N6`.
  - Assert all relevant nodes are visible, non-overlapping, inside overlay scroll/side-panel region, and edges connect expected sides.
  - **Acceptance:** product test fails on the 2026-06-16 two-level collapse class of bug.

- [ ] 20. Add no canvas-content overlap product test
  - **Boundary:** Playwright only.
  - Use a map fixture with selected node near PN anchor.
  - Open PN and assert chosen placement overlayRect and placed PN node rects have zero overlap with selected / visible canvas node safeZones.
  - **Acceptance:** test fails for viewport-clamp-only placement; passes only when chosen placement canvas-node `overlapScore = 0`.

- [ ] 21. Add collapse/reset behavior coverage
  - **Boundary:** `pn_layout` tests + PN lab/product Playwright.
  - Verify root reset collapses to baseline, focusOrder resets, and hover does not immediately reopen root after collapse.
  - **Acceptance:** action-tree collapse behavior is represented in tests and lab.

## Phase 6: PN Lab

- [ ] 22. Add PN lab app shell
  - **Boundary:** `beta/src/labs/pn/`, Vite entry only as needed.
  - Standalone lab imports `src/shared/pn_layout.ts` and existing EdgePort public contracts only through `pn_layout`.
  - Do not import `viewer.ts`, `workbench-ui.tsx`, or `edge_geometry.ts`.
  - **Acceptance:** lab typechecks/builds; dependency-cruiser blocks browser imports.

- [ ] 23. Add PN lab samples
  - **Boundary:** `beta/src/labs/pn/pn_samples.ts`.
  - Include `gui-basic`, `view-layout-3rd-level`, `active-node-generation`, `overflow-narrow`, `safe-zone-collision`, and `search-filter-keeps-path`.
  - Use `PnNode[]{ id,parentId,label,hint,action }` as sample source.
  - **Acceptance:** samples contain no personal payload, can be loaded by unit tests and lab, and include at least one sample where chosen placement canvas-node `overlapScore = 0` is visible in the lab summary.

- [ ] 24. Implement PN lab visualization
  - **Boundary:** lab files only.
  - Render simulated canvas/safe zones, overlay, node cards, EdgePort routed edges, focus order, overflow mode, and placement score.
  - Provide controls for sample, active node, viewport preset, anchor preset, safe-zone toggle, route style, search, reset/collapse.
  - Do not pre-fix final visual approval style; expose the minimum judgment surface for akaghef動作感承認.
  - **Acceptance:** akaghef can inspect action-tree staged expansion, parent node position retention, keyboard/search, safeZone no-overlap from `PnNode[]`, overlay placement/overflow, and edge routing in one lab.

- [ ] 25. Add PN lab Playwright checks
  - **Boundary:** `beta/tests/visual/pn_lab.spec.js` or equivalent.
  - Check lab loads, sample switching works, keyboard/search changes focus and visible rows, 3rd-level nodes render, safe-zone placement avoids overlap with canvas-node `overlapScore = 0`, and edge side metadata is present.
  - **Acceptance:** Playwright test does not depend on product viewer; screenshot/DOM evidence covers EN5-Lite lab gate.

## Phase 7: Golden and Copy Ratchet

- [ ] 26. Finalize PN layout golden schema and loader
  - **Boundary:** `beta/src/shared/pn_layout_golden.ts` or test helper, fixture directory.
  - Validate schema for input and expected output.
  - Reject unknown fields that would hide stale prototype shape.
  - **Acceptance:** loader test passes with all initial samples; normal test run never updates fixtures.

- [ ] 27. Add golden parity tests
  - **Boundary:** `beta/tests/unit/pn_layout_golden.test.ts`.
  - Compare placement trial order, placement mode, overlay rect, visibleNodeIds, pathIds, focusOrder, overflow mode, chosen canvas-node overlapScore, source/target edge side, and endpoint summary.
  - Use exact values unless tolerance is explicitly documented for pixel rounding.
  - **Acceptance:** changed placement/edge behavior fails with sample id and mismatched field; any chosen placement with canvas-node overlapScore > 0 fails.

- [ ] 28. Add jscpd PN ratchet
  - **Boundary:** `beta/jscpd.config.json`.
  - Include `src/shared/pn_layout.ts`, `src/labs/pn`, and product PN adapter/workbench file.
  - Exclude generated fixtures/snapshots only if necessary.
  - **Acceptance:** `npm --prefix beta run lint:copy` fails for copied action-tree/product layout logic and passes after removal.

## Phase 8: Verification and Handoff

- [ ] 29. Run narrow verification set
  - **Boundary:** commands only.
  - Run:
    - `npm --prefix beta run typecheck`
    - `npm --prefix beta run lint:deps`
    - `npm --prefix beta run lint:copy`
    - `npx --prefix beta vitest run tests/unit/pn_layout_*.test.*`
    - `npx --prefix beta playwright test tests/visual/pn_lab.spec.js`
    - `npx --prefix beta playwright test tests/visual/workbench_progressive_nav.spec.js`
  - **Acceptance:** all first-ratchet checks pass, or blocked checks report exact environment cause.

- [ ] 30. Verify exclusive seam by negative inspection
  - **Boundary:** code review / grep.
  - Confirm product PN does not import/call `edgePathBetweenRects`.
  - Confirm `src/labs/pn/**` imports shared contracts, not `src/browser/**`.
  - Confirm `pn_layout.ts` imports no React/DOM/browser implementation.
  - Confirm PN lab does not copy action-tree layout logic.
  - Confirm map-backing and canonical name reconcile are not implemented in this ratchet.
  - **Acceptance:** negative inspection results are included in final handoff.

- [ ] 31. Director handoff
  - **Boundary:** final report / PR body.
  - Report changed files, behavior, checks run, PN lab URL/usage, golden samples included, viewport separation result, EdgePort integration result, no-overlap result, and residual risks.
  - Explicitly state whether skill mirrors or durable rules were changed.
  - **Acceptance:** Director can review visible-fix PN seam without reading implementation history.

## Follow-up Tasks (Non-goal for First Ratchet)

- [ ] F1. Design `pn_model` map-backing adapter
  - **Boundary:** future spec/task only.
  - Convert map subtree attributes `pn:id`, `pn:hint`, `pn:action` into `PnNode[]`.
  - **Acceptance:** visible-fix PN remains fed through the same `pn_layout` contract.

- [ ] F2. Reconcile product PN labels/actions with canonical Surface View names
  - **Boundary:** future spec/task only.
  - Map legacy product options to `Tree / Axial / Radial / Disperse / System`.
  - **Acceptance:** no new legacy Surface View names enter shared contracts.

- [ ] F3. Add real-server PN composition gate
  - **Boundary:** future EN5-Full.
  - Use `createAppServer()` or existing diagnostic to load a sanitized map and inspect PN overlay output through the real server path.
  - **Acceptance:** fixture-only green is no longer broad-promotion sufficient after first ratchet.
