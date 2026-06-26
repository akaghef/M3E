# Implementation Plan

> この tasks は spec-only draft。実装 phase では task worktree `codex/node-draw-seam` 等で実行する。各 task は TDD 順で、acceptance を満たすまで次の ratchet へ進まない。現 draft 作成では implementation code を書かない。

## Phase 0: Baseline and Scope Lock

- [ ] 1. Confirm current node drawing implementation surface
  - **Boundary:** investigation only.
  - Inspect `viewer.ts` `NodeStyleAttrs`, `uiLabel`, `diagramLabel`, `measureNodeLabel`, `measureLayoutNode`, KaTeX helpers, `render()`, `drawNode()`, collapsed/status/confidence/lock/alias branches, child edge generation, folder preview generation, and `markdown_renderer.ts`.
  - Record exact current symbols and files in implementation handoff.
  - **Acceptance:** handoff lists current node style helpers, label helpers, KaTeX helpers, node fragment branches, child edge branch, folder preview branch, and Markdown/Mermaid preview boundary.

- [ ] 2. Add failing type contract test for future NodeDrawPort
  - **Boundary:** `beta/tests/unit/node_draw_contract.test.ts` or equivalent.
  - Import `NodeDrawInput`, `NodeDrawOutput`, `NodeDrawStyle`, `NodeDrawViewState`, `NodeDrawSurface`, and `renderNode` from future shared node draw modules.
  - Build a minimal plain positioned node using `LayoutNodePosition` and assert returned `{ svg, bounds }` shape.
  - **Acceptance:** test fails because `node_draw_port.ts` / `node_draw_svg.ts` do not exist yet; no product code changed.

- [ ] 3. Add failing fragment golden test harness
  - **Boundary:** `beta/tests/unit/node_draw_fragment_golden.test.ts`, `beta/tests/fixtures/node-draw-golden/`.
  - Define a hand-authored plain node golden fixture with deterministic expected fragment.
  - Include snapshot normalization for whitespace / numeric precision / class order as needed.
  - **Acceptance:** test fails until shared renderer exists; normal test run does not update fixtures.

## Phase 1: Pure Contract and Renderer

- [ ] 4. Create shared `NodeDrawPort` public contract
  - **Boundary:** `beta/src/shared/node_draw_port.ts`, TypeScript config only as needed.
  - Define node input, style, transient view state, surface, content, bounds, output, and KaTeX adapter types.
  - Import or reference `LayoutNodePosition` from shared `layout_port.ts`.
  - Include canonical Surface View names only.
  - Do not import `viewer.ts`, DOM canvas globals, `markdown_renderer.ts`, EdgePort modules, AppState, or GraphLink.
  - **Acceptance:** task 2 type imports compile; contract has no Markdown/Mermaid or edge relation fields.

- [ ] 5. Implement first shared `node_draw_svg.ts` renderer for plain/root/folder basics
  - **Boundary:** `beta/src/shared/node_draw_svg.ts`.
  - Render node hit rect, root/plain/folder visual box, plain multiline text, alias class variants, selected/multi/primary/link-source/cut/drag/drop classes.
  - Keep geometry deterministic and based only on `NodeDrawInput.position`.
  - Keep helpers module-private.
  - **Acceptance:** task 2 and task 3 plain/root/folder fixtures pass; renderer does not import browser implementation files.

- [ ] 6. Add style normalize and style-specific fragment tests
  - **Boundary:** `beta/src/shared/node_draw_port.ts`, `beta/src/shared/node_draw_svg.ts`, unit tests.
  - Cover `fill`, text color, border color/style/width, shape `rect/rounded/pill/diamond`, urgency/importance derived fill, status class, and confidence badge.
  - Validate invalid style values are dropped or clamped.
  - **Acceptance:** fragment tests pass for fill/color/border/status/confidence/urgency/importance; raw `m3e:style` parsing is not duplicated in lab.

- [ ] 7. Add label split helpers or adapter types
  - **Boundary:** shared helper or browser adapter test only.
  - Preserve current `uiLabel` / `diagramLabel` semantics through explicit adapter inputs: aliasLabel, broken snapshot, alias target label, icon, scope portal bracket marker.
  - Do not let renderer resolve alias target from `map.state`.
  - **Acceptance:** tests cover alias read/write/broken display labels and icon/scope portal display without importing `viewer.ts`.

## Phase 2: KaTeX and Layout Measurement Boundary

- [ ] 8. Add KaTeX content contract and fallback fragment tests
  - **Boundary:** shared renderer and tests only.
  - Support `content.kind = "latexHtml"` by rendering a deterministic `foreignObject` with `.latex-node-content`.
  - Add fallback test for adapter failure or pre-rendered escaped label.
  - **Acceptance:** fragment golden covers a KaTeX node and confirms no Markdown/Mermaid renderer is imported.

- [ ] 9. Extract or wrap latex measure/render adapters
  - **Boundary:** optional `beta/src/shared/node_draw_latex.ts` and browser adapter; no product migration yet.
  - Adapter may wrap current `measureLatex`, `latexSource`, `katex.renderToString`, and metrics cache.
  - Keep `measureLatex` usable by `measureLayoutNode()` for `LayoutNodeMetric`.
  - **Acceptance:** adapter unit tests or browser-adapter tests show latex metrics feed layout boxSizes and render output feeds nodeDraw content; nodeDraw does not call layout.

- [ ] 10. Add measurement boundary tests or handoff assertions
  - **Boundary:** unit tests or implementation handoff.
  - Verify `measureLayoutNode()` remains the boundary that produces `boxSizes` from node content/style before layout.
  - Verify `renderNode()` receives `LayoutNodePosition` and never invokes `layout()`.
  - **Acceptance:** type/import tests fail if `node_draw_svg.ts` imports `layout()` implementation or browser `measureLayoutNode()`.

## Phase 3: Edge and Preview Separation Before Product Migration

- [ ] 11. Write failing/product-pending test for child edge separation
  - **Boundary:** product adapter or render helper tests.
  - Assert parent-child edge path generation is outside node renderer and can run independently from `renderNode()`.
  - **Acceptance:** test fails or is pending until child edge generation no longer lives inside the node drawing branch.

- [ ] 12. Move parent-child edge generation out of `drawNode()`
  - **Boundary:** `beta/src/browser/viewer.ts` or narrow browser helper file.
  - Create transitional `renderParentChildEdges(...)` helper if EdgePort migration is not complete.
  - Preserve current Tree/Radial/etc. product behavior while ensuring node renderer does not produce edge paths.
  - Do not move edge logic into `node_draw_svg.ts`.
  - **Acceptance:** product output still includes parent-child edges; nodeDraw fragment output contains no `<path class="edge...">`; future EdgePort migration has a single edge adapter target.

- [ ] 13. Isolate folder preview from nodeDraw first ratchet
  - **Boundary:** `beta/src/browser/viewer.ts` or narrow browser helper file.
  - Keep folder preview mini graph rendering outside shared node renderer.
  - Preserve product behavior through viewer-owned `renderFolderPreview(...)` or equivalent helper.
  - Record follow-up seam candidate as `folderPreview` or `surfaceDraw`; do not implement that seam in this ratchet.
  - **Acceptance:** `node_draw_svg.ts` does not import or call `edgePortPairBetweenRects`, `smoothGraphLinkPath`, `normalizeGraphLink`, or preview layout helpers.

## Phase 4: Product Adapter Migration and Exclusive Seam

- [ ] 14. Add viewer adapter tests for NodeDrawInput construction
  - **Boundary:** browser adapter unit tests.
  - Convert representative `TreeNode` + `LayoutNodePosition` + transient state to `NodeDrawInput`.
  - Cover root/plain/folder/latex/status, alias read/write/broken, selected/multi/primary, cut, link-source, collapsed, scope-locked self/other.
  - **Acceptance:** tests fail or are pending until adapter exists; adapter does not change product state.

- [ ] 15. Create viewer node draw adapter
  - **Boundary:** `beta/src/browser/node_draw_viewer_adapter.ts` or equivalent, minimal `viewer.ts` exports only if unavoidable.
  - Convert raw `TreeNode`, current ViewState flags, scope lock map, collapsed counts, surface mode, and `LayoutNodePosition` into `NodeDrawInput`.
  - Normalize legacy view names to canonical `Tree / Axial / Radial / Disperse / System`.
  - **Acceptance:** task 14 tests pass; adapter is the only place that knows product globals/raw attributes.

- [ ] 16. Migrate `drawNode()` node fragment generation to `node_draw_svg.renderNode`
  - **Boundary:** `beta/src/browser/viewer.ts`, adapter file only.
  - Replace root/plain/folder/alias/status/confidence/collapsed/lock/latex direct node SVG generation with shared renderer calls.
  - Keep traversal, max bounds update, edge layers, graph links, annotations, surface frames, and preview helper orchestration in viewer.
  - **Acceptance:** browser build/typecheck pass; fragment parity tests pass; `viewer.ts` no longer directly concatenates node body/status/confidence/collapsed/lock/latex fragments except for explicitly out-of-scope node components or folder preview helpers.

- [ ] 17. Tighten dependency-cruiser nodeDraw ratchet
  - **Boundary:** `beta/dependency-cruiser.config.cjs` or existing depcruise config.
  - Forbid `src/labs/node/**` from importing `src/browser/**`.
  - Forbid `src/shared/node_draw_svg.ts` from importing browser implementation, `markdown_renderer.ts`, edge route/geometry modules, or labs.
  - If renderer internals split, allow product/lab to import only the public nodeDraw entrypoint.
  - **Acceptance:** `npm run lint:deps` fails with a temporary bypass import and passes after removing it.

- [ ] 18. Add jscpd no-copy ratchet for node drawing
  - **Boundary:** `beta/jscpd.config.json` or existing config.
  - Ensure lab/product cannot carry copied SVG/style/label rendering logic.
  - Exclude generated snapshots and fixtures only; never ignore `node_draw_svg.ts` logic.
  - **Acceptance:** `npm run lint:copy` fails for a temporary copied renderer branch and passes after removing it.

## Phase 5: Golden Samples

- [ ] 19. Define node-draw golden sample schema and loader
  - **Boundary:** `beta/src/labs/node/node_samples.ts`, `beta/tests/fixtures/node-draw-golden/`.
  - Define deterministic JSON schema from design.
  - Add loader that reconstructs typed `NodeDrawInput`.
  - **Acceptance:** loader test passes with a hand-authored minimal sample.

- [ ] 20. Add initial pure fragment golden set
  - **Boundary:** `beta/tests/fixtures/node-draw-golden/*.json` / `*.svg.snap`.
  - Include plain, long wrap, multiline, root, folder, alias read/write/broken, selected/multi/primary, cut, link-source, collapsed, scope-locked self/other, fill, color, border, status, confidence, KaTeX.
  - Keep labels sanitized and deterministic.
  - **Acceptance:** golden parity tests compare fragment and bounds; no personal payload; normal tests never update fixtures.

- [ ] 21. Add explicit golden update command
  - **Boundary:** package script or test helper only.
  - Require explicit sample id and output path.
  - Do not update snapshots during normal test run.
  - **Acceptance:** update command exists, validates schema, and refuses unknown samples.

## Phase 6: Node-lab

- [ ] 22. Add node-lab app shell
  - **Boundary:** `beta/src/labs/node/`, lab tsconfig/Vite entry only as needed.
  - Standalone lab imports shared `node_draw_port` / `node_draw_svg`.
  - Do not import `viewer.ts`, `workbench-ui.tsx`, or other browser implementation files.
  - Load product's real `viewer.css` for lab route; if the current product CSS bundle is not literally named `viewer.css`, resolve to the CSS file/bundle that product viewer actually uses and document that mapping.
  - Load KaTeX stylesheet for lab route.
  - **Acceptance:** lab typechecks and builds; dependency-cruiser blocks browser implementation imports; lab HTML/Vite entry includes product viewer CSS and KaTeX stylesheet.

- [ ] 23. Implement fixed positionedNode[] visualization
  - **Boundary:** lab files only.
  - Render fixed positioned samples with no layout or edge calls.
  - Provide sample selector, canonical Surface View selector, input summary, output bounds, and fragment diff panel.
  - **Acceptance:** lab can switch every initial sample and recompute through shared renderer; no parent-child edge appears in lab canvas.

- [ ] 24. Add node-lab Playwright checks
  - **Boundary:** Playwright e2e or existing browser test fit.
  - Verify lab loads, selector exists, canonical Surface View names render, and changing sample changes fragments.
  - Check KaTeX foreignObject, collapsed badge, scope lock, alias variants, status badge, confidence badge.
  - Check product viewer CSS and KaTeX stylesheet are loaded in the page before screenshot assertions.
  - Capture screenshot evidence for the EN5-Lite gate.
  - **Acceptance:** Playwright test does not depend on product `viewer.ts`; screenshot/DOM checks prove node-lab uses product viewer CSS and KaTeX stylesheet; manual akaghef visual approval remains separate Director review step.

## Phase 7: EN5-Lite and EN5-Full Follow-up

- [ ] 25. Record and verify EN5-Lite first-ratchet gate
  - **Boundary:** tests/config/handoff only; no real-server route required.
  - Gate must include pure fragment golden, node-lab Playwright screenshot, EN4 dependency-cruiser ratchet, EN3 typecheck shared port, and EN2 jscpd.
  - Verify node-lab loads product viewer CSS and KaTeX stylesheet before screenshot checks.
  - Verify dependency-cruiser locks viewer node SVG generation to `node_draw_svg` and blocks bypass imports.
  - **Acceptance:** implementation handoff reports all EN5-Lite components with command results; fixture-only lab green is not accepted; absence of real-server snapshot does not block first ratchet.

- [ ] 26. File EN5-Full real-server node snapshot follow-up
  - **Boundary:** handoff / task note only unless implementation phase explicitly includes diagnostic work.
  - Define EN5-Full as real `createAppServer()` path or existing diagnostic loading a tiny sanitized map and capturing viewer node DOM/SVG selector summary.
  - EN5-Full must assert product path emits nodeDraw classes/fragments for root/plain/folder/latex/status/collapsed.
  - Mark EN5-Full as mandatory before broad promotion, not as first-ratchet blocker.
  - **Acceptance:** handoff contains a concrete follow-up task for narrow read-only viewer snapshot route or existing diagnostic reuse; no mutation API is proposed.

- [ ] 27. Reuse diagnostic or add narrow read-only nodeDraw snapshot route for EN5-Full
  - **Boundary:** server/viewer diagnostic only in the follow-up phase.
  - Prefer existing diagnostic route.
  - If missing, expose enough sanitized node fragment/selector summary for EN5-Full through a narrow read-only test/debug route.
  - Do not add mutation APIs.
  - **Acceptance:** EN5-Full passes against real app server with temp data and closes server cleanly before broad promotion.

- [ ] 28. Add local-blocked reporting for EN5-Full
  - **Boundary:** composition test helper only.
  - If native binding or localhost listen is unavailable, report exact reason.
  - Do not substitute fixture server for EN5-Full.
  - **Acceptance:** EN5-Lite checks still run; CI/non-sandbox remains expected EN5-Full gate before broad promotion.

## Phase 8: Final Ratchet Verification

- [ ] 29. Run narrow verification set
  - **Boundary:** commands only.
  - Run `npm run typecheck`, `npm run lint:deps`, `npm run lint:copy`, nodeDraw pure tests, fragment golden tests, node-lab Playwright screenshot checks, and EN5-Lite gate check.
  - Run full `npm test` if product server/browser integration changed enough to justify it.
  - **Acceptance:** all first-ratchet required checks pass or blocked checks report exact environment cause; EN5-Full absence is reported as required follow-up, not first-ratchet failure.

- [ ] 30. Verify exclusive seam by negative inspection
  - **Boundary:** code review / grep.
  - Confirm `node_draw_svg.ts` does not import browser implementation, Markdown renderer, edge helpers, or labs.
  - Confirm `src/labs/node/**` imports shared contracts, not `src/browser/**`.
  - Confirm viewer node fragment generation enters through `renderNode`.
  - Confirm parent-child edge generation is outside node renderer.
  - Confirm folder preview remains viewer-owned helper and is not in `node_draw_svg`.
  - Confirm tabular component remains excluded from first ratchet and is documented as follow-up seam.
  - **Acceptance:** negative inspection results are included in final handoff.

- [ ] 31. Director handoff
  - **Boundary:** final report / PR body.
  - Report changed files, checks run, node-lab URL/usage, golden samples included, KaTeX adapter result, edge/preview separation result, EN5-Lite result, EN5-Full follow-up, and residual risks.
  - Explicitly state whether skill mirrors or durable rules were changed.
  - **Acceptance:** Director can review the nodeDraw seam ratchet without reading implementation history.
