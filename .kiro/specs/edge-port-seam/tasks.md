# Implementation Plan

> この tasks は spec-only draft。実装 phase では task worktree `codex/edge-port-seam` 等で実行する。各 task は TDD 順で、acceptance を満たすまで次の ratchet へ進まない。現 draft 作成では implementation code を書かない。

## Phase 0: Baseline and Scope Lock

- [ ] 1. Confirm current edge / GraphLink implementation surface
  - **Boundary:** investigation only.
  - Inspect `viewer.ts` edge helpers, GraphLink endpoint edit code, shared `GraphLink` / `LinkPort` types, and current layout direction state.
  - Record exact current symbols and files in implementation handoff.
  - **Acceptance:** handoff lists current port helpers, route helpers, GraphLink endpoint edit helpers, and the known right-tree-only helper.

- [ ] 2. Add failing type contract test for future EdgePort
  - **Boundary:** `beta/tests/unit/edge_port_contract.test.ts` or equivalent.
  - Import `selectPorts`, `EdgeRect`, `EdgeBranchDirection`, and `EdgePorts` from the future shared port module.
  - Test Tree `right / left / up / down / both-left / both-right` expected side pairs.
  - For Tree `both`, require explicit `branchSide`; do not allow center-position fallback.
  - **Acceptance:** test fails because `edge_port.ts` does not exist yet; no product code changed.

- [ ] 3. Add failing route contract test for future EdgeRoute
  - **Boundary:** `beta/tests/unit/edge_route_contract.test.ts` or equivalent.
  - Import `route`, `EdgeRouteStyle`, and `EdgePath` from the future shared route module.
  - Assert route preserves selected source / target ports for `orthogonal / line / curve / force-link`.
  - **Acceptance:** test fails because `edge_route.ts` does not exist yet; route side reselection would fail the test.

## Phase 1: Pure Contracts

- [ ] 4. Create shared `EdgePort` public contract
  - **Boundary:** `beta/src/shared/edge_port.ts`, TypeScript config only as needed.
  - Define `EdgeRect`, `EdgePortSide`, `EdgePortPoint`, `EdgePorts`, `EdgeBranchDirection`, and `selectPorts`.
  - Implement branch direction rules from design.
  - Keep helper functions module-private.
  - Do not import `viewer.ts`, DOM, AppState, GraphLink, LinkPort, or route style.
  - **Acceptance:** task 2 tests pass; `EdgePortSide` has no `"auto"`; Tree `both` cannot be constructed without explicit `branchSide`; `selectPorts` is pure.

- [ ] 5. Create shared `EdgeRoute` public contract
  - **Boundary:** `beta/src/shared/edge_route.ts` or same public shared module if simpler.
  - Define `EdgeRouteStyle`, `EdgePathCommand`, `EdgePath`, and `route`.
  - Implement route styles without selecting or mutating ports.
  - **Acceptance:** task 3 tests pass; route output first/last coordinates equal selected ports.

- [ ] 6. Add branch direction matrix unit tests
  - **Boundary:** pure unit tests only.
  - Cover Tree `right / left / both / up / down`, Axial `right / left / up / down`, Radial quadrants, Disperse free vector, System `right / down / free`.
  - Include tie-break behavior for vector rules.
  - Confirm no test expects EdgePort to infer Tree `both` branch side from rectangle centers.
  - **Acceptance:** every Surface View direction in `map_layout_modes.md` that affects edge direction has at least one pure test or an explicit non-edge note; Tree `both` tests use LayoutPort-provided `branchSide`.

## Phase 2: Type Separation and Product Adapter

- [ ] 7. Define parent-child edge adapter types
  - **Boundary:** shared type or browser adapter type file.
  - Add `ParentChildEdgeRef` / adapter input types that are distinct from `GraphLink`.
  - Keep route style as `EdgeRouteStyle`, not relation type.
  - **Acceptance:** TypeScript prevents passing `GraphLink` directly to parent-child branch edge adapter without explicit adapter conversion.

- [ ] 8. Write failing product adapter tests before migration
  - **Boundary:** adapter unit tests or snapshot tests.
  - Build sample positioned parent/child rectangles from current layout output shape.
  - For Tree `both`, assert the adapter reads `LayoutResult.branchSide` or fails with a missing-contract error.
  - Assert adapter calls `selectPorts` with correct Surface View / direction and then `route`.
  - **Acceptance:** tests fail or are pending until product branch edge adapter uses shared contracts.

- [ ] 9. Migrate parent-child branch edge path to EdgePort / EdgeRoute
  - **Boundary:** product branch edge adapter / renderer files; avoid unrelated render refactor.
  - Convert positioned parent/child rects and Surface View direction to `EdgeBranchDirection`.
  - If current `LayoutResult` lacks Tree `both` `branchSide`, add the minimal LayoutPort contract extension before completing this task.
  - Do not infer Tree `both` branch side inside EdgePort or the edge adapter from rectangle centers.
  - Call `selectPorts` then `route`.
  - Preserve current Tree right output where expected.
  - **Acceptance:** adapter tests pass; Tree right visual/path snapshot remains compatible; left/up/down/both use branch-aware sides; Tree both uses `LayoutResult.branchSide`.

## Phase 3: `nearestEdgePortSide` Quarantine

- [ ] 10. Extract or isolate GraphLink endpoint edit nearest helper
  - **Boundary:** GraphLink endpoint edit module and minimal callers.
  - Move `nearestEdgePortSide` to a GraphLink endpoint edit module, or make it private to that module.
  - Rename if useful to `nearestEdgePortSideForGraphLinkEdit`.
  - **Acceptance:** branch edge code cannot reference the helper by local scope; GraphLink endpoint edit tests still pass.

- [ ] 11. Add dependency-cruiser quarantine rules
  - **Boundary:** `beta/dependency-cruiser.config.cjs` or existing depcruise config.
  - Forbid parent-child edge adapter / renderer modules from importing GraphLink endpoint edit module.
  - Forbid shared `edge_port` / `edge_route` from importing browser implementation.
  - Forbid `src/labs/edge-port/**` from importing `src/browser/**`.
  - **Acceptance:** `npm run lint:deps` fails with a temporary bypass import and passes after removing it.

- [ ] 12. Add jscpd copy ratchet for edge port logic
  - **Boundary:** `beta/jscpd.config.json` or existing config.
  - Ensure product and lab cannot carry copied port/route logic.
  - Baseline unrelated duplication only if necessary; never ignore `edge_port` / `edge_route` duplication.
  - **Acceptance:** `npm run lint:copy` fails for a temporary copied selector and passes after removing it.

## Phase 4: Golden Samples

- [ ] 13. Define edge-port golden sample schema and loader
  - **Boundary:** `beta/src/labs/edge-port/edge_port_samples.ts`, `beta/tests/fixtures/edge-port-golden/`.
  - Define deterministic JSON schema from design.
  - Add loader that reconstructs typed `EdgeBranchDirection` and route style.
  - **Acceptance:** loader test passes with a hand-authored minimal sample.

- [ ] 14. Add explicit real-layout capture command
  - **Boundary:** `beta/src/node/` or `beta/scripts/`, package script if needed.
  - Capture `srcRect`, `dstRect`, Surface View / direction, `LayoutResult.branchSide`, route style, selected ports, and path through product adapter.
  - Fail capture for Tree `both` if `LayoutResult.branchSide` is missing.
  - Sanitize labels and personal content.
  - Require explicit `--out` path and sample id.
  - **Acceptance:** command can generate deterministic samples only when explicitly invoked; normal tests never update fixtures.

- [ ] 15. Capture initial golden sample set
  - **Boundary:** `beta/tests/fixtures/edge-port-golden/*.json`.
  - Capture required first-unit samples: tree-right, tree-left, tree-both-left, tree-both-right, tree-up, tree-down, axial-right, axial-up, radial-balanced-quadrants, disperse-force-vector, system-right, system-down.
  - **Acceptance:** samples contain no personal payload; expected sides match the design table.

- [ ] 16. Add golden parity tests
  - **Boundary:** `beta/tests/unit/edge_port_golden.test.*`.
  - For each sample, run `selectPorts(sample.input)` and `route(...)`.
  - Compare expected side exactly, endpoint coordinates, path endpoints, and documented path command tolerance.
  - **Acceptance:** normal test run fails on changed side/path and prints sample id plus mismatched fields; Tree `both` fixtures without `branchSide` are invalid.

## Phase 5: Edge-port-lab

- [ ] 17. Add edge-port-lab app shell
  - **Boundary:** `beta/src/labs/edge-port/`, lab tsconfig/Vite entry only as needed.
  - Standalone lab imports shared `edge_port` / `edge_route`.
  - Do not import `viewer.ts` or other browser implementation files.
  - **Acceptance:** lab typechecks and builds; dependency-cruiser blocks browser implementation imports.

- [ ] 18. Implement golden sample visualization
  - **Boundary:** lab files only.
  - Render source/target rectangles, selected port dots, route path, expected side markers, and mismatch state.
  - Provide controls for sample, Surface View, direction, route style, and explicit Tree both branch side as sample input.
  - Represent GraphLink distinction for `force-link` through lab/product style tokens, not EdgeRoute contract fields.
  - **Acceptance:** lab can switch every initial golden sample and recompute using shared contracts; Tree both uses explicit sample `branchSide`.

- [ ] 19. Add lab mechanical checks and smoke test
  - **Boundary:** lab files and Playwright/Vitest smoke depending on existing test fit.
  - Expose checks for side match, endpoint match, rect boundary, no through-node path, and obvious wrong-target/wrong-side connection.
  - Smoke test verifies lab loads, sample selector exists, and changing explicit branch side / direction changes selected sides.
  - **Acceptance:** smoke test does not depend on product `viewer.ts`; manual akaghef visual approval remains separate.

## Phase 6: EN5 Product Composition

- [ ] 20. Write failing real-server edge-port composition test
  - **Boundary:** `beta/tests/unit/edge_port_composition_api.test.js` or equivalent.
  - Start `createAppServer()` on ephemeral `127.0.0.1:0` with temp `M3E_DATA_DIR` / `M3E_DB_FILE`.
  - Load or seed map through real product path.
  - Fetch edge port snapshot through existing diagnostic if available.
  - **Acceptance:** test fails until diagnostic/snapshot mechanism exists; it does not use fixture server `14174`.

- [ ] 21. Reuse diagnostic or add narrow read-only edge-port snapshot route
  - **Boundary:** server/viewer diagnostic only as needed.
  - Prefer existing diagnostic route.
  - If missing, add narrow read-only route that returns branch edge port/path snapshot.
  - Do not add mutation APIs.
  - **Acceptance:** task 20 passes against real app server with temp data and closes server cleanly.

- [ ] 22. Add local-blocked reporting for EN5
  - **Boundary:** composition test helper only.
  - If native binding or localhost listen is unavailable, report exact reason.
  - Do not substitute fixture server.
  - **Acceptance:** pure tests still run; CI/non-sandbox remains the expected composition gate.

## Phase 7: Final Ratchet Verification

- [ ] 23. Run narrow verification set
  - **Boundary:** commands only.
  - Run `npm run typecheck`, `npm run lint:deps`, `npm run lint:copy`, edge-port pure tests, golden parity tests, lab smoke, and EN5 composition.
  - Run full `npm test` if product server/browser integration changed enough to justify it.
  - **Acceptance:** all required checks pass or blocked checks report exact environment cause.

- [ ] 24. Verify exclusive seam by negative inspection
  - **Boundary:** code review / grep.
  - Confirm branch edge adapter does not import or call `nearestEdgePortSide`.
  - Confirm `nearestEdgePortSide` lives only in GraphLink endpoint edit module or is private to that module.
  - Confirm `src/labs/edge-port/**` imports shared contracts, not `src/browser/**`.
  - Confirm no copied port/route logic exists in lab/product.
  - **Acceptance:** negative inspection results are included in final handoff.

- [ ] 25. Director handoff
  - **Boundary:** final report / PR body.
  - Report changed files, checks run, lab URL/usage, golden samples included, EN5 result, nearest-helper quarantine result, and residual risks.
  - Explicitly state whether skill mirrors or durable rules were changed.
  - **Acceptance:** Director can review the EdgePort seam ratchet without reading implementation history.
