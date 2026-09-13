# OT Component Seam Labs

Seven Beta-only routes load upstream ORRERY Telemetry cuts. Each `cut/<component>/logic.js` and `cut/<component>/markup.html` is copied byte-for-byte from the pinned `dashboard/index.html`; `cut/shared/dashboard.css` is the upstream style block body. The harness TypeScript only creates a small DOM host, installs the read-only fetch boundary, and loads the classic upstream fragment. It does not translate or reimplement OT behavior.

Source: `gyroid-eth/orrery-telemetry` at `22ffe6483530e643c8fc1af486319990e0181de4`.

License: PolyForm Perimeter 1.0.1, <https://polyformproject.org/licenses/perimeter/1.0.1>. Required Notice: Copyright (c) 2026 gyroid. See `upstream/LICENSE`.

## Dependency closures and limitations

The recorded line ranges and hashes in `provenance.json` are the machine-readable closure record.

- DECK: logic `30787-30838`, markup `2435-2474`; action `render`, representative root `#wrap`.
- NETWORK: logic `31142-31918`, markup `2476-2622`; action `buildEls`, representative roots `#gsvg` and `#net`.
- DETAIL: logic `33418-33785`, markup `2777-2824`; action `openPanel`, representative root `#term`.
- EDGE: logic `31362-31434`, markup `2763-2775`; action `openDrawer`, representative root `#edrawer`.
- MAIL: logic `32042-32380`, markup `2476-2622`; action `mailDrain`, representative root `#gsvg`.
- REPLAY: logic `33081-33245`, markup `2476-2622`; action `startReplay`, representative roots `#replayBar` and `#gsvg`.
- RUNTIME: logic `34660-34853`, markup `2628-2753`; action `openSpawnModal`, representative root `#spawnmd`.

This partial-render limitation is intentional: a coupled verbatim cut is evidence of identity, not a rewritten standalone product. The harness invokes the named upstream action and persists `data-ot-action-invoked`, `data-ot-action-effect`, `data-ot-action-result`, and `data-ot-classification` in the DOM. Dependency errors are visible in `[data-ot-error]`; syntax errors and uncaught page errors are test failures. The current-turn browser run was not completed because the sandbox denied the preview server bind (`listen EPERM 127.0.0.1:14278`), so no per-route classification is claimed here; the Director must rerun the focused Playwright command.

## Verification

Run from `beta/`:

`npm run check:ot-provenance` validates each fragment's SHA-256, exact recorded line range, and exact substring membership in `/tmp/orrery-telemetry-inspect/dashboard/index.html`. The unit test mutates a copied fragment and asserts validation fails.

`npm run build:browser && npm run check:ot-build-artifacts` verifies representative exact markup and logic strings are reachable in emitted artifacts. The focused production-preview smoke is `./node_modules/.bin/playwright test --config playwright.ot-seam.config.js tests/visual/ot_component_seam_labs.spec.js`; it checks all seven routes, representative upstream IDs, CSS/JS request status, page errors, console errors, and the visible partial-render exception.
