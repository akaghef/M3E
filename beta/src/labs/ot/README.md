# OT Component Seam Labs

Seven Beta-only routes load upstream ORRERY Telemetry cuts. Each `cut/<component>/logic.js` and `cut/<component>/markup.html` is copied byte-for-byte from the pinned `dashboard/index.html`; `cut/shared/dashboard.css` is the upstream style block body. The harness TypeScript only creates a small DOM host, installs the read-only fetch boundary, and loads the classic upstream fragment. It does not translate or reimplement OT behavior.

Source: `gyroid-eth/orrery-telemetry` at `22ffe6483530e643c8fc1af486319990e0181de4`.

License: PolyForm Perimeter 1.0.1, <https://polyformproject.org/licenses/perimeter/1.0.1>. Required Notice: Copyright (c) 2026 gyroid. See `upstream/LICENSE`.

## Dependency closures and limitations

The recorded line ranges and hashes in `provenance.json` are the machine-readable closure record.

- DECK: upstream lines 30700-30835 plus markup 2438-2474. It depends on the dashboard globals, telemetry data, and the full deck DOM; the isolated route is a source-cut load and may remain acquisition-only.
- NETWORK: upstream lines 31142-31905 plus markup 2475-2627. This includes the force/layout closure and network SVG controls. It depends on upstream globals and data state; no standalone simulation is supplied by the harness.
- DETAIL: upstream lines 33420-33877 plus markup 2777-2825. It depends on the terminal/detail DOM and dashboard globals; only the cut is loaded in isolation.
- EDGE: upstream lines 31372-31432 plus markup 2800-2825. It depends on the network edge state and drawer DOM; the route may show only the host when those globals are absent.
- MAIL: upstream lines 32042-32402 plus markup 2450-2474. It depends on upstream mail state and card DOM; no fixture-to-upstream translation is added.
- REPLAY: upstream lines 33081-33200 plus markup 2516-2627. It depends on the replay controller, graph state, and upstream event globals; partial rendering is expected.
- RUNTIME: upstream lines 34660-34856 plus markup 2628-2776. It depends on the spawn modal DOM and upstream catalog state. The harness keeps the existing POST-blocking adapter; it does not fake a launch.

This partial-render limitation is intentional: a coupled verbatim cut is evidence of identity, not a rewritten standalone product.

## Verification

Run from `beta/`:

`npm run check:ot-provenance` validates each fragment's SHA-256, exact recorded line range, and exact substring membership in `/tmp/orrery-telemetry-inspect/dashboard/index.html`. The unit test mutates a copied fragment and asserts validation fails.

