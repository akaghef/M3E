# UI Seam Integration Contract — Evidence Appendix (Codex read-only investigation, 2026-07-02)

Line numbers are approximate as of dev-beta 43e8571. This file is the evidence base for
`UI_Seam_Integration_Contract.md`; keep them in sync or mark this file historical.

## Shared Resource Catalog (measured)

| Resource | State location | # mutation sites | Existing owner/registry | Top collision hotspots |
|---|---|---:|---|---|
| Selection | `viewer.ts` `viewState.selectedNodeId`, `selectedNodeIds`, `selectionAnchorId` ~700-702; typed in `viewer.globals.d.ts` ~332-348 | ~24 direct sites | Partial: `normalizeSelectionState`, `setSingleSelection`, `setRangeSelection`, `toggleNodeSelection`, `selectGraphLink` ~8190-8339 | Keyboard nav/edit/delete ~14677-15380; canvas pointer select/drag ~14154-14444; undo/redo restore ~4008-4071; render normalizes selection during draw ~6879-6903 |
| Focus | DOM focus, not state: repeated `board.focus()` + inline `input.focus()` in `startInlineEdit` ~11240 | ~20 calls | none — raw DOM focus side effects | Pointer handlers focus board ~14174-14444; scope enter/exit focus ~3679-3737; inline editors capture focus and short-circuit global keys ~14723-14730 |
| Keyboard shortcuts | Main `document.addEventListener("keydown")` ~14677; cheatsheet keydown/keyup ~15443-15468; inline keydown ~11163, ~11248; linear text keydown ~13897 | 4 handler surfaces, dozens of branches | none — monolithic conditionals; no command registry | Overlapping bare keys: `r` routing/pan ~14781-14808; scatter `a/e/c/d/v` ~14854-14882; review `a/x/e` ~14896-14914; normal `a/f/c/i/j/k/l/m/p/e` ~15186-15380 |
| Pointer capture | `canvas.setPointerCapture`/release ~14174, ~14294, ~14378, ~14390; `board` capture ~14562-14661; linear resize ~13931-13951; pen/eraser ~2711-2880 | ~8 capture/release pairs | none — raw DOM pointer capture | Canvas node/link drag vs board pan/pinch vs drawing tools; `annotationTool !== "select"` bypasses canvas drag ~14154-14157 while board handles pen/eraser ~14542-14553 |
| Drag state | `viewState.dragState` ~730; `linkPortDragState` ~687-694; `panState`/`pinchState` ~724-725; `linearResizeState` ~524; `penDraft`/`eraserPointerId` ~486-487 | ~25 | Partial: separate handlers per surface, no shared drag arbiter | Structure drag and scatter drag share `viewState.dragState` ~14281-14389; link port drag separate ~14165-14378; board pan/pinch mutates camera in parallel ~14523-14657 |
| Hover state | Mostly CSS/DOM transient; no central hover state | 0 central | none — browser/CSS hover | Real shared resources are z-order / hit-test: SVG `data-node-id` hit targets, overlays, panels, PN layer |
| Edit mode | `inlineEditor`, `inlineEdgeLabelEditor` ~463-464; `suppressInlineBlurCommit` ~11286; `annotationTool` ~486 | ~12 | Partial: `startInlineEdit`/`stopInlineEdit`, `startIncomingEdgeLabelEdit`/stop ~11070-11294 | Global keydown early-returns when editor active ~14723-14730; inline Enter/Tab creates nodes ~11248-11270; blur commit races keyboard-driven stop ~11286 |
| Scope/navigation | `viewState.currentScopeId`, `currentScopeRootId`, `scopeHistory` ~703-705; `updateScopeInUrl` ~8341; `EnterScopeCommand`/`ExitScopeCommand` ~8361-8403 | ~14 | Partial: command functions, not a scope manager | Keyboard `]`/`[` + arrows ~15089-15110, ~15265-15380; routing switcher applies scope route ~12991; initial query param ~15503-15514 |
| Camera/viewport | `viewState.zoom/cameraX/cameraY/cameraMove` ~714-722; `cameraMotion` ~492; pending zoom globals ~4629 | ~20 | Partial: `moveCameraTo`, `setZoom`, `scheduleSetZoom`, `applyZoom` ~4220-4665 | Wheel pan/zoom ~14474-14503; board pan/pinch ~14523-14657; camera follow via `triggerCameraMove` ~12405; render/linear/inline overlays depend on same transform |
| Layout coordinates | `lastLayout`, `visibleOrder`, `contentWidth/Height` ~459-464, ~514; layout built in `render()` ~6899-6903; pure port `shared/layout_port.ts` | ~8 viewer sites + pure algorithm | **Yes**: `shared/layout_port.ts` `layout(...)`/`LayoutResult`; layout lab/golden tests | Render mutates `lastLayout` while selection normalization reads `visibleOrder`; scatter runtime positions sync into model ~2373 and mutate layout input |
| Render layers/overlays | String buckets inside `render()`: `defs`, `surfaceFrames`, `edges`, `scatterGuides`, `graphLinks`, `overlays`, `annotations`, `nodes` ~6920-6931; final SVG order ~7543 | 1 render assembly, many contributors | Partial: `shared/node_draw_port.ts` + SVG renderer; edge adapter ports | Fixed concatenation order ~6920-7543; no layer registry; selected link port controls append to `overlays` ~7191 |
| Save queue/persistence | `autosaveTimer` ~461; `lastServerSavedAt`, `lastServerBaseState` ~433-434; `scheduleAutosave`/`flushAutosaveNow` ~11764-11792; `saveDocToLocalDb` ~11453 | ~18 call sites, 1 queue | Partial: persistence port = HTTP `/api/maps/:id`; conflict/collab/cloud paths inside viewer | `saveDocToLocalDb` redirects to collab push when joined ~11463; conflict panel on 409 ~11477-11529; cloud push from local save ~11553-11555; linear notes + runtime scatter sync during snapshot ~11437 |
| Undo/redo | `undoStack`/`redoStack` ~515-516; `pushUndoSnapshot`, `undoLastChange`, `redoLastChange` ~3992-4071 | ~35 `pushUndoSnapshot` call sites | Partial: stack helper only; no command transaction registry | Drag pushes late/conditionally ~14348; delete flushes autosave immediately ~11361-11399; failed template insertion manually pops undo ~9953-9973 |
| Clipboard | `viewState.clipboardState` ~726; `clipboardBc` ~432; localStorage key ~679; system clipboard ~13362-13420; copy/cut/paste ~13462-13572 | ~11 | Partial: structured format + BroadcastChannel sync ~13280-13359 | Browser clipboard vs local server clipboard vs localStorage vs BroadcastChannel; cut state mutates selection/reparent on paste ~13541-13621 |
| z-index | CSS only: `viewer.css` bands 1–2000 (overlay 10, menus 20, conflict 25, V4 24, entity 12, markdown 13, routing/color/context 96–100, fatal 2000); Workbench PN 30/80 | many CSS declarations, no TS state | none — CSS constants, no layer-scale registry | Arbitrary overlapping bands across panels/popovers |
| Performance hot paths | `render()` ~6879; `applyZoom()` ~4220; `scheduleSetZoom()` RAF batching ~4629; scatter RAF globals ~674-677; render scheduling ~944-972 | ~10 RAF/timer surfaces | Partial: viewport fast-path event `m3e:viewport-changed` ~4241; layout/draw pure ports | Wheel/pan/pinch use `scheduleApplyZoom`, but inline editor / linear panel / PN / template placement still sync on viewport; render rebuilds full SVG string and normalizes state |

## Existing seams & ports

- `beta/src/shared/layout_port.ts` — pure layout contract (`VisibleLayoutGraph`, `LayoutOptions`, `LayoutResult`, `layout`).
- `beta/src/shared/node_draw_port.ts` + `node_draw_svg.ts` — node drawing contract.
- `beta/src/shared/parent_child_edge_adapter.ts`, `edge_port.ts`, `edge_route.ts`, `browser/edge_adapters/graphlink_endpoint_edit.ts` — edge routing/port seams.
- Browser-local modules are few (`markdown_renderer.ts`, `artifacts.ts`, `home.ts`, `workbench-ui.tsx`, `edge_geometry.ts`); most runtime integration remains in `viewer.ts`.
- Persistence seam: HTTP APIs in `beta/src/node/start_viewer.ts` (`/api/maps/:id`, sync, clipboard, layout snapshot, collab).
- Test/lab seams exist for layout, node draw, edge port, progressive navigation, visual viewer behavior.

## Existing CI / validation hooks

- `.github/workflows/test.yml` — beta typecheck, dependency boundary lint (`lint:deps`), copy-drift lint (`lint:copy`), build, unit tests; final build.
- `.github/workflows/agent-instruction-lint.yml` — `scripts/ops/check-persistent-rule-gate.sh`.
- `beta/package.json` — `typecheck`, `lint:deps`, `lint:copy`, `test:unit`, `test:visual`, `test:shortcuts`, `test:layout`, `test:node`, `test:e2e`.
- Contract tests already exist: `layout_port_contract.test.ts`, `layout_golden.test.ts`, `node_draw_contract.test.ts`, `edge_port_contract.test.ts`, `edge_route_contract.test.ts`.

## Surprises (contradict prior assumptions)

1. No keyboard command registry exists despite the very large shortcut surface.
2. Layout / node draw / edge ports are already pure — the missing seam is interaction-state ownership (selection, pointer, drag, editMode, focus).
3. `render()` is not pure: it normalizes selection and scope-related state while drawing.
4. Clipboard is over-engineered relative to assumptions: structured payload + BroadcastChannel + localStorage + browser clipboard + local server clipboard all coexist.
5. Save is not just autosave: a local save may become a collab push, cloud push, conflict UI, or vault conflict handling.
6. z-index is pure CSS convention; no shared overlay/layer registry.
7. Hover is not a central resource; hit-test and z-order are the real shared resources.
8. Undo snapshots include selection but not all transient interaction state — command transaction boundaries are uneven.
9. Scatter mode has its own tool state but shares selection, drag, links, camera, layout, undo.
10. Workbench/PN already has a viewport fast path; the main SVG renderer has no equivalent resource registry.
