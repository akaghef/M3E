# WebGL pan / zoom experiment

This is a reproducible measurement artifact, not a CI performance gate. It records browser timing evidence for the same deterministic camera gesture through the `renderer=webgl` and `renderer=svg` paths. Human review decides whether the values are acceptable; the runner only rejects an invalid fixture, rendering failure, or unavailable requested WebGL projection.

## Fixture contract

`fixtures/pfr-blueprint.performance-fixture.manifest.json` names the one frozen local duplicate. It contains IDs, hashes, counts, and tags only; it never contains map body/content.

The duplicate was checked immediately after `POST /api/maps/{sourceMapId}/duplicate`: its raw saved state was byte-for-byte equal under the manifest canonicalization. That source ID/hash is provenance only; the active source map is never read at runtime and may evolve independently. The required rename changes the saved root node label, so the runner permits exactly `/nodes/bp_root/text`; it restores that field to the manifest's fixed `normalizedRootText` before comparing `fixtureContentHash`. Any other state difference fails closed. Tags and pin/archive metadata live outside the map state hash and are checked independently from `/api/maps` list metadata.

Do not edit the fixture. If its integrity check fails, stop and create a separately named fixture with a new manifest instead of measuring a mutated target.

## Run

The local daily-use server is normally `http://localhost:4173`:

```bash
cd beta
npm run perf:webgl:fixture -- --base-url http://localhost:4173
npm run perf:webgl:pan-zoom -- --base-url http://localhost:4173 --renderer both --browser-channel chrome
```

For a task-worktree server, run the same command against that server only after its database contains this fixture ID, or pass the matching map/scope/hash options. The runner does not silently substitute another map.

Useful options are `--renderer webgl|svg|both`, `--runs N`, `--warmup N`, `--browser-channel chrome`, `--base-url URL`, `--manifest PATH`, `--map-id ID`, `--scope-id ID`, and `--output FILE`. The baseline is headless Chromium/Chrome with the explicit viewport in the result. `--headed` is intentionally rejected so this command never attaches or detaches visible Chrome tabs. `--verify-only` performs only the API integrity pass.

Results are written to `beta/perf-results/` (ignored by Git). Each JSON result records timestamp, Git revision/dirty state, Node/OS, browser/version, viewport/DPR, target/hash, run config, gesture timings, Long Task observations, and per-run WebGL debug invariants.

## Create a whole-map unscoped fixture

When a scoped fixture is too light to compare WebGL with SVG, create a separate manifest and map with:

```bash
cd beta
node perf/make_unscoped_fixture.mjs \
  --base-url http://localhost:4173 \
  --source-map-id <source-map-id> \
  --workspace-id <workspace-id>
```

The script reads `GET /api/maps/{sourceMapId}`, converts every `nodeType: "folder"` to `nodeType: "text"`, and keeps the node tree and all other state fields. It creates the destination with `POST /api/maps/{sourceMapId}/duplicate`, verifies the raw duplicate, and writes the transformed state only to that newly returned map ID with `POST /api/maps/{generatedMapId}`. The manifest uses the generated map root as `scopeId`, so the runner reads the complete subtree. The default output is `fixtures/pfr-blueprint.unscoped-full.performance-fixture.manifest.json`; existing output files are refused rather than overwritten. `--output` may select another path under `beta/perf/fixtures/`.

`--workspace-id` is explicit because workspace context is a viewer URL/API context and is not part of the saved map state returned by `GET /api/maps/{mapId}`. The API calls create a new map and never write to the supplied source map.

## Measurement semantics

Every experiment creates one isolated headless browser context and one fixed page. WebGL and SVG are loaded sequentially in that same page; every warmup and measured run stays in it and follows the same ordered gesture sequence. The runner never creates or closes a page/context/tab per run. Each operation records request-animation-frame intervals (count, median, p95, max, `>16.7 ms`, `>33.3 ms`), Long Task count/total/max, and operation duration from that probe's own `startedAt`/`endedAt` window. For WebGL the runner additionally requires camera updates to increase, geometry uploads to remain unchanged, and snapshot node/edge/GraphLink counts to remain invariant. A WebGL context that is unavailable or falls back to SVG writes `status: "no-measurement"` and exits non-zero; it is never reported as a WebGL result.
