# Implementation Plan

> この tasks は spec-only draft。実装 phase では task worktree `codex/layout-seam-lab` 等で実行する。各 task は TDD 順で、acceptance を満たすまで次の ratchet へ進まない。

## Phase 0: Harness Baseline

- [ ] 1. Add enforcement tool dependencies and baseline scripts
  - **Boundary:** `beta/package.json`, `beta/package-lock.json`
  - Add devDependencies for `dependency-cruiser` and `jscpd`.
  - Add scripts: `typecheck`, `lint:deps`, `lint:copy`.
  - Keep initial commands narrow enough to run on current code; do not encode broad future seams yet.
  - **Acceptance:** `npm run typecheck`, `npm run lint:deps`, and `npm run lint:copy` exist and run locally; failures are either green or documented as explicit baseline items to fix in task 2.

- [ ] 2. Wire harness into beta CI before build/test
  - **Boundary:** `.github/workflows/test.yml`
  - Add beta job steps after `npm ci`: `npm run typecheck`, `npm run lint:deps`, `npm run lint:copy`.
  - Do not change final job behavior unless required for workflow syntax.
  - **Acceptance:** workflow order is `npm ci -> typecheck -> lint:deps -> lint:copy -> build -> test`; no product source changes.

- [ ] 3. Add initial dependency-cruiser and jscpd configs
  - **Boundary:** `beta/dependency-cruiser.config.cjs`, `beta/jscpd.config.json`
  - Create baseline config with a layout seam placeholder rule that can be tightened when `layout_port.ts` exists.
  - Exclude `dist`, `node_modules`, and fixtures from copy scan.
  - **Acceptance:** configs are committed, scripts use them, and current baseline is ratchet-ready without pretending the layout seam is already enforced.

## Phase 1: LayoutPort Contract First

- [ ] 4. Write failing type/import test for the future LayoutPort
  - **Boundary:** `beta/tests/unit/layout_port_contract.test.ts` or equivalent
  - Test imports `layout`, `VisibleLayoutGraph`, `LayoutNodeMetric`, `LayoutOptions`, and `LayoutResult` from `src/shared/layout_port`.
  - Test builds a small tree sample and asserts a deterministic `LayoutResult` shape.
  - **Acceptance:** test fails because `layout_port.ts` does not exist yet.

- [ ] 5. Create `src/shared/layout_port.ts` with typed public contract
  - **Boundary:** `beta/src/shared/layout_port.ts`, TypeScript config only as needed
  - Move/adapt existing layout algorithm from `viewer.ts` into shared module; use bridge-worktree code only as prior art.
  - Export only the public types and `layout()`.
  - Keep internal helpers non-exported.
  - Do not create `layout_bridge.ts` in this first unit.
  - Include scatter/system options in the type even if first algorithm support is minimal; do not silently drop existing product modes.
  - **Acceptance:** task 4 contract test passes; no caller has been migrated yet.

- [ ] 6. Fix browser/workbench/labs TypeScript config for shared port imports
  - **Boundary:** `beta/tsconfig.browser.json`, `beta/src/browser/tsconfig.json`, `beta/tsconfig.workbench.json`, optional `beta/tsconfig.layout.json`, `beta/tsconfig.labs.json`
  - Resolve current `rootDir: "src/browser"` / include limitation so browser product and labs can typecheck `src/shared/layout_port.ts`.
  - Add dedicated labs typecheck config for `src/labs/**`.
  - Prefer root `src` or narrow shared include over generated copies.
  - **Acceptance:** `npm run typecheck` includes `layout_port.ts` and still covers browser/workbench/labs code.

## Phase 2: Product Adapter Migration and Exclusive Seam

- [ ] 7. Write product adapter parity tests before migrating callers
  - **Boundary:** layout unit tests only
  - Add samples for tree, mindmap, and routing-scope where current behavior is deterministic.
  - Do not include scatter/system in first-unit golden acceptance; record them as follow-up ratchets.
  - If direct current `viewer.ts` helper testing is infeasible, encode expected output from captured pre-migration current behavior.
  - **Acceptance:** tests describe current layout behavior and fail or are pending until adapter calls `LayoutPort`.

- [ ] 8. Migrate `buildLayout(state)` to call `LayoutPort.layout`
  - **Boundary:** `beta/src/browser/viewer.ts`
  - Keep AppState/viewState-specific graph construction and measurement in viewer.
  - Remove layout placement algorithm ownership from viewer for migrated modes.
  - `window.m3eLayout` must call the shared `layout()` implementation and contain no layout logic.
  - **Acceptance:** product layout tests pass; browser build/typecheck pass.

- [ ] 9. Close routing scope helper bypass
  - **Boundary:** `beta/src/browser/viewer.ts`
  - Change `renderRoutingScopeSurface` to call `LayoutPort.layout` through a routing adapter.
  - Remove direct calls to `buildRightTreeLayout` and `buildMeasuredTreeContext` from product code.
  - **Acceptance:** grep/code review shows no product caller of layout internals; routing scope visual behavior is covered by a golden or unit sample.

- [ ] 10. Tighten dependency-cruiser layout ratchet
  - **Boundary:** `beta/dependency-cruiser.config.cjs`
  - Enforce that browser/workbench/labs may import only the public layout port, not layout internals.
  - If internals stay inside `layout_port.ts`, enforce no alternate layout modules and rely on non-exported helpers.
  - Add rule preventing `src/labs/**` from importing `src/browser/viewer.ts`.
  - Add rule preventing `src/labs/**` from importing `src/browser/**` implementation files; labs may use shared contracts such as `src/shared/*_port.ts`.
  - **Acceptance:** `npm run lint:deps` fails for a test bypass import and passes without it; `renderRoutingScopeSurface` cannot reintroduce helper direct import; lab cannot import product browser implementation.

## Phase 3: Golden Samples

- [ ] 11. Define golden sample schema and loader
  - **Boundary:** `beta/src/labs/layout/layout_samples.ts`, `beta/tests/fixtures/layout-golden/`
  - Define JSON schema/type for graph children map, boxSizes, mode/options, expected `LayoutResult`.
  - Add loader that reconstructs `childrenOf`.
  - **Acceptance:** loader test passes with a hand-authored minimal sample.

- [ ] 12. Add explicit capture command for real product layout samples
  - **Boundary:** `beta/src/node/` or `beta/scripts/`, package script if needed
  - Capture `VisibleLayoutGraph`, `boxSizes`, mode/options, and `LayoutResult` through product adapters for exactly `tree`, `mindmap`, and `routing-scope`.
  - Require explicit output path and sample id.
  - Sanitize labels/personal content.
  - **Acceptance:** command can generate deterministic `tree-basic`, `mindmap-basic`, and `scope-routing-basic` samples into `tests/fixtures/layout-golden/` only when explicitly invoked.

- [ ] 13. Add golden parity tests
  - **Boundary:** `beta/tests/unit/layout_golden.test.*`
  - Run `LayoutPort.layout(sample.input)` and compare to `sample.expected`.
  - Use exact order/key comparison and documented numeric tolerance where needed.
  - **Acceptance:** normal test run never updates fixtures; failing diff explains changed nodes/positions.

## Phase 4: Layout Lab

- [ ] 14. Add layout-lab app shell using existing Vite/React path
  - **Boundary:** `beta/src/labs/layout/`, `beta/tsconfig.labs.json`, `beta/vite.config.mjs`, optional HTML entry
  - Add a standalone app entry that imports `LayoutPort`.
  - Reuse React/Vite dependencies where practical, but keep lab source outside `src/browser/`.
  - Do not import `viewer.ts` or other `src/browser/**` implementation files.
  - **Acceptance:** `npm run build:browser` emits lab assets; `npm run typecheck` covers lab imports.

- [ ] 15. Implement dummy rectangle layout visualization
  - **Boundary:** lab app files only
  - Render sample nodes as rectangles from `LayoutResult.pos`.
  - Render simple parent-child lines from sample graph.
  - Provide controls for sample, mode, density, branchDirection, direction, depthAlign, spacing.
  - Provide exactly the first-unit samples: tree, mindmap, routing-scope. Scatter/system controls or samples are follow-up ratchets.
  - **Acceptance:** lab can switch the three golden samples and recompute layout using the shared port.

- [ ] 16. Add lab smoke test
  - **Boundary:** Playwright or Vitest DOM smoke, depending on existing test fit
  - Verify lab loads, sample selector exists, and changing a layout option changes output summary or positions.
  - **Acceptance:** smoke test runs without relying on product `viewer.ts`; manual akaghef visual approval remains a separate Director review step.

## Phase 5: EN5 Product Composition

- [ ] 17. Write failing `createAppServer()` composition test for layout snapshot
  - **Boundary:** `beta/tests/unit/layout_composition_api.test.js`
  - Start `createAppServer()` on `127.0.0.1:0` with temp `M3E_DATA_DIR` / `M3E_DB_FILE`.
  - Create/load a map through real API or seed path.
  - Fetch product layout snapshot through an existing viewer diagnostic if one can return layout output.
  - If no existing diagnostic can return layout output, leave the test failing until task 18 adds a narrow read-only route.
  - **Acceptance:** test fails until the diagnostic/snapshot mechanism exists; it must not use port `14174` fixture server and must not require mutation API.

- [ ] 18. Reuse diagnostic or add narrow read-only product layout snapshot route
  - **Boundary:** server/viewer diagnostic route only as needed
  - First try to reuse an existing viewer diagnostic that exposes layout output.
  - Only if none exists, expose enough layout snapshot data for EN5 through a narrow read-only test/debug route.
  - Do not open broad internal mutation APIs.
  - Use real app server startup path.
  - **Acceptance:** task 17 passes against ephemeral `createAppServer()`; temp data is cleaned up.

- [ ] 19. Add CI-safe skip/failure reporting for constrained local environments
  - **Boundary:** composition test helper only
  - If native binding or listen is unavailable locally, report exact reason.
  - Do not replace EN5 with fixture server.
  - **Acceptance:** CI runs test normally; local blocked runs are explicit and do not hide pure layout failures.

## Phase 6: Final Ratchet Verification

- [ ] 20. Run full narrow verification set
  - **Boundary:** commands only
  - Run `npm run typecheck`, `npm run lint:deps`, `npm run lint:copy`, `npm run test:layout`, and the narrow composition test.
  - Run full `npm test` if the implementation changed server/browser integration enough to justify it.
  - **Acceptance:** all required checks pass or blocked checks report exact environment cause.

- [ ] 21. Verify exclusive seam manually by negative inspection
  - **Boundary:** code review / grep
  - Confirm no `buildRightTreeLayout`, `buildMeasuredTreeContext`, or copied layout helper is reachable from product/lab callers.
  - Confirm `renderRoutingScopeSurface` uses `LayoutPort.layout`.
  - Confirm lab lives under `src/labs/layout/` and imports `LayoutPort`, not `viewer.ts`, other `src/browser/**` files, or `window.m3eLayout`.
  - Confirm no first-unit `layout_bridge.ts` was added.
  - **Acceptance:** negative inspection results are included in final handoff.

- [ ] 22. Director handoff
  - **Boundary:** final report / PR body
  - Report changed files, checks run, lab URL/usage, golden samples included, EN5 result, and residual risks.
  - Explicitly state whether skill mirrors or durable rules were changed.
  - **Acceptance:** Director can review the first layout seam ratchet without reading implementation history.
