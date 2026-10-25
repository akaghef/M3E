#!/usr/bin/env node
/**
 * Reproducible, non-gating camera experiment for the WebGL rendering projection.
 * It deliberately treats fixture integrity and renderer availability as hard
 * failures, but leaves all timing interpretation to a human reviewer.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultManifestPath = path.join(here, "fixtures", "pfr-blueprint.performance-fixture.manifest.json");
const defaultOutputDir = path.resolve(here, "..", "perf-results");
const VIEWPORT = { width: 1440, height: 900 };
const DEFAULT_SEQUENCE = [
  { name: "pan", description: "pointer drag across the board" },
  { name: "zoom", description: "three wheel zoom deltas anchored at board center" },
];

function usage() {
  return `Usage: node perf/run_webgl_pan_zoom.mjs [options]

  --base-url URL          Viewer/API origin (default: http://localhost:4173)
  --manifest PATH         Fixture manifest path (default: pfr-blueprint.performance-fixture.manifest.json)
  --renderer MODE         webgl, svg, or both (default: both)
  --map-id ID             Must match the selected fixture manifest
  --scope-id ID           Must match the selected fixture manifest
  --runs N                Measured runs per renderer (default: 5)
  --warmup N              Warmup gestures per renderer (default: 2)
  --browser-channel NAME  Playwright browser channel, e.g. chrome
  --output FILE           Result JSON path (default: beta/perf-results/...)
  --verify-only           Verify fixture API integrity; do not launch browser
  --help                  Show this text`;
}

function parseArgs(argv) {
  const options = {
    baseUrl: "http://localhost:4173",
    renderer: "both",
    runs: 5,
    warmup: 2,
    browserChannel: undefined,
    output: undefined,
    manifestPath: undefined,
    verifyOnly: false,
    mapId: undefined,
    scopeId: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") { console.log(usage()); process.exit(0); }
    if (arg === "--headed") throw new Error("--headed is intentionally disabled: this experiment uses one isolated fixed page and must not attach or detach visible Chrome tabs.");
    if (arg === "--verify-only") { options.verifyOnly = true; continue; }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    index += 1;
    if (arg === "--base-url") options.baseUrl = value.replace(/\/$/, "");
    else if (arg === "--renderer") options.renderer = value;
    else if (arg === "--runs") options.runs = Number(value);
    else if (arg === "--warmup") options.warmup = Number(value);
    else if (arg === "--browser-channel") options.browserChannel = value;
    else if (arg === "--output") options.output = path.resolve(value);
    else if (arg === "--manifest") options.manifestPath = path.resolve(value);
    else if (arg === "--map-id") options.mapId = value;
    else if (arg === "--scope-id") options.scopeId = value;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error("--runs must be a positive integer");
  if (!Number.isInteger(options.warmup) || options.warmup < 0) throw new Error("--warmup must be a non-negative integer");
  if (!["webgl", "svg", "both"].includes(options.renderer)) throw new Error("--renderer must be webgl, svg, or both");
  return options;
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function stateHash(state) {
  return createHash("sha256").update(stableSerialize(state), "utf8").digest("hex");
}

function countCollection(value) {
  return Array.isArray(value) ? value.length : Object.keys(value || {}).length;
}

function jsonPointer(key) {
  return key.replaceAll("~", "~0").replaceAll("/", "~1");
}

async function apiJson(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  if (!response.ok) throw new Error(`API ${pathname} returned ${response.status}: ${await response.text()}`);
  return response.json();
}

export function verifyFixtureState(manifest, candidate, scoped, metadata) {
  const fixture = manifest.fixture;
  if (!candidate || !scoped) throw new Error("Map API did not return a saved fixture state.");
  const normalized = structuredClone(candidate);
  const rootId = candidate.rootId;
  const allowedPaths = manifest.integrity.allowedMutableStatePaths;
  const expectedLabelPath = `/nodes/${jsonPointer(rootId)}/text`;
  if (allowedPaths.length !== 1 || allowedPaths[0] !== expectedLabelPath) throw new Error("Manifest allowed mutable path no longer matches fixture root.");
  normalized.nodes[rootId].text = manifest.integrity.normalizedRootText;
  const checks = {
    fixtureRawStateHash: stateHash(candidate),
    fixtureContentHash: stateHash(normalized),
    nodeCount: countCollection(candidate.nodes),
    linkCount: countCollection(candidate.links),
    scopeNodeCount: countCollection(scoped.nodes),
    scopeLinkCount: countCollection(scoped.links),
    label: candidate.nodes[rootId]?.text,
    tags: metadata?.tags || [],
  };
  const errors = [];
  if (checks.fixtureContentHash !== manifest.integrity.fixtureContentHash) errors.push("fixture content hash differs after permitted root-label normalization");
  if (checks.label !== fixture.label) errors.push("fixture root label differs from manifest");
  for (const [key, expected] of Object.entries(manifest.integrity.counts)) if (checks[key] !== expected) errors.push(`${key} is ${checks[key]}, expected ${expected}`);
  for (const tag of fixture.tags) if (!checks.tags.includes(tag)) errors.push(`fixture metadata tag missing: ${tag}`);
  if (errors.length) throw new Error(`Fixture integrity failed closed: ${errors.join("; ")}`);
  return checks;
}

export async function verifyFixture({ baseUrl, manifestPath = defaultManifestPath, mapId, scopeId }) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const fixture = manifest.fixture;
  if (mapId && mapId !== fixture.mapId) throw new Error(`--map-id must equal frozen fixture ${fixture.mapId}; refusing substitute target.`);
  if (scopeId && scopeId !== fixture.scopeId) throw new Error(`--scope-id must equal frozen fixture ${fixture.scopeId}; refusing substitute target.`);
  // The source map is historical provenance and may evolve. Runtime fixture
  // verification reads only the frozen duplicate, its scoped state, and tags.
  const [fixtureDocument, scopeDocument, listDocument] = await Promise.all([
    apiJson(baseUrl, `/api/maps/${encodeURIComponent(fixture.mapId)}`),
    apiJson(baseUrl, `/api/maps/${encodeURIComponent(fixture.mapId)}?scope=${encodeURIComponent(fixture.scopeId)}`),
    apiJson(baseUrl, "/api/maps"),
  ]);
  const metadata = (listDocument.maps || []).find((entry) => entry.id === fixture.mapId);
  return { manifest, checks: verifyFixtureState(manifest, fixtureDocument.state, scopeDocument.state, metadata) };
}

function gitMetadata() {
  const run = (args) => {
    try { return execFileSync("git", args, { cwd: path.resolve(here, "..", ".."), encoding: "utf8" }).trim(); } catch { return "unknown"; }
  };
  return { commit: run(["rev-parse", "HEAD"]), dirty: run(["status", "--porcelain"]) !== "" };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
}

async function startProbe(page) {
  await page.evaluate(() => {
    const frames = [];
    const longTasks = [];
    let previous = null;
    let stopped = false;
    const tick = (timestamp) => {
      if (previous !== null) frames.push(timestamp - previous);
      previous = timestamp;
      if (!stopped) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    let observer = null;
    let longTaskSupported = false;
    try {
      observer = new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => entry.duration)));
      // Do not use buffered entries: this probe represents only the current
      // operation, not long tasks from page load or an earlier warmup.
      observer.observe({ type: "longtask" });
      longTaskSupported = true;
    } catch { /* Long Task API is optional. */ }
    const startedAt = performance.now();
    window.__m3ePanZoomProbe = { startedAt, frames, longTasks, longTaskSupported, stop: () => { stopped = true; observer?.disconnect(); return { startedAt, endedAt: performance.now(), frames, longTasks, longTaskSupported }; } };
  });
}

async function stopProbe(page) {
  return page.evaluate(() => window.__m3ePanZoomProbe?.stop());
}

export function summarizeProbe(probe) {
  const intervals = probe?.frames || [];
  const longTasks = probe?.longTasks || [];
  return {
    durationMs: Math.max(0, (probe?.endedAt || 0) - (probe?.startedAt || 0)),
    frames: {
      count: intervals.length,
      medianMs: percentile(intervals, 0.5),
      p95Ms: percentile(intervals, 0.95),
      maxMs: intervals.length ? Math.max(...intervals) : 0,
      over16_7ms: intervals.filter((value) => value > 16.7).length,
      over33_3ms: intervals.filter((value) => value > 33.3).length,
    },
    longTasks: {
      supported: Boolean(probe?.longTaskSupported),
      count: longTasks.length,
      totalMs: longTasks.reduce((total, value) => total + value, 0),
      maxMs: longTasks.length ? Math.max(...longTasks) : 0,
    },
  };
}

async function boardPoint(page, renderer) {
  return page.locator("#board").evaluate((board) => {
    const rect = board.getBoundingClientRect();
    const candidates = [
      [0.16, 0.18], [0.84, 0.18], [0.16, 0.82], [0.84, 0.82],
      [0.5, 0.18], [0.5, 0.82], [0.18, 0.5], [0.82, 0.5],
    ];
    const debug = window.__m3eWebGLProjection?.getDebugState?.();
    const snapshot = window.__m3eWebGLProjection?.getSnapshot?.();
    if (debug && snapshot) {
      for (const [fractionX, fractionY] of candidates) {
        const x = rect.left + rect.width * fractionX;
        const y = rect.top + rect.height * fractionY;
        const worldX = (x - debug.camera.x) / debug.camera.zoom;
        const worldY = (y - debug.camera.y) / debug.camera.zoom;
        const occupied = snapshot.nodes.some((node) => worldX >= node.x - 8 && worldX <= node.x + node.width + 8 && worldY >= node.y - 8 && worldY <= node.y + node.height + 8);
        if (!occupied) return { x, y };
      }
    }
    return { x: rect.left + rect.width * 0.16, y: rect.top + rect.height * 0.18 };
  });
}

async function exercise(page, name, renderer) {
  const point = await boardPoint(page, renderer);
  if (name === "pan") {
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    for (let index = 1; index <= 12; index += 1) await page.mouse.move(point.x + index * 14, point.y - index * 5, { steps: 1 });
    await page.mouse.up();
  } else {
    await page.mouse.move(point.x, point.y);
    // M3E reserves unmodified wheel for pan; control/meta wheel is the
    // canonical anchored zoom gesture on both renderer paths.
    await page.keyboard.down("Control");
    try {
      for (const deltaY of [-180, -140, 96]) await page.mouse.wheel(0, deltaY);
    } finally {
      await page.keyboard.up("Control");
    }
  }
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function settleRenderer(page, minimumFrames = 5) {
  await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const next = () => {
      frames += 1;
      if (frames >= minimumFrames) resolve(); else requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }));
}

async function webglDebug(page) {
  return page.evaluate(() => {
    const api = window.__m3eWebGLProjection;
    return api ? { state: api.getDebugState(), snapshot: api.getSnapshot() } : null;
  });
}

function assertWebglInvariant(before, after) {
  if (!before?.state?.active || !after?.state?.active) throw new Error("WebGL projection was not active; SVG fallback is not a WebGL measurement.");
  const uploadDelta = after.state.geometryUploads - before.state.geometryUploads;
  const cameraDelta = after.state.cameraUpdates - before.state.cameraUpdates;
  const beforeCounts = { nodes: before.snapshot?.nodes?.length, edges: before.snapshot?.edges?.length, graphLinks: before.snapshot?.graphLinks?.length };
  const afterCounts = { nodes: after.snapshot?.nodes?.length, edges: after.snapshot?.edges?.length, graphLinks: after.snapshot?.graphLinks?.length };
  if (uploadDelta !== 0) throw new Error(`WebGL geometry changed during camera gesture: geometryUploads delta ${uploadDelta}`);
  if (cameraDelta <= 0) throw new Error("WebGL camera did not update during camera gesture.");
  if (JSON.stringify(beforeCounts) !== JSON.stringify(afterCounts)) throw new Error("WebGL snapshot counts changed during camera gesture.");
  return { before: beforeCounts, after: afterCounts, geometryUploadsDelta: uploadDelta, cameraUpdatesDelta: cameraDelta };
}

async function measureRenderer(page, browser, options, fixture, renderer) {
  const url = new URL("/viewer.html", options.baseUrl);
  url.searchParams.set("ws", fixture.workspaceId);
  url.searchParams.set("map", fixture.mapId);
  url.searchParams.set("scope", fixture.scopeId);
  url.searchParams.set("surface", "tree");
  url.searchParams.set("renderer", renderer);
  if (renderer === "webgl") url.searchParams.set("webglDebug", "1");
  try {
    // The viewer maintains an SSE connection, so networkidle never settles.
    // DOM content plus the renderer-specific readiness checks below is the
    // deterministic readiness contract for this experiment.
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator("#board").waitFor({ state: "visible", timeout: 15_000 });
    if (renderer === "webgl") {
      const active = await page.waitForFunction(() => Boolean(window.__m3eWebGLProjection?.getDebugState()?.active) && !document.querySelector("#webgl-canvas")?.hidden, undefined, { timeout: 10_000 }).catch(() => false);
      if (!active) return { renderer, status: "no-measurement", reason: "WebGL projection unavailable or fell back to SVG", url: url.toString() };
    } else {
      await page.locator("#canvas:not([hidden])").waitFor({ state: "visible", timeout: 10_000 });
    }
    for (let warmup = 0; warmup < options.warmup; warmup += 1) for (const operation of DEFAULT_SEQUENCE) await exercise(page, operation.name, renderer);
    const operations = [];
    for (let run = 0; run < options.runs; run += 1) {
      for (const operation of DEFAULT_SEQUENCE) {
        const before = renderer === "webgl" ? await webglDebug(page) : null;
        await startProbe(page);
        await exercise(page, operation.name, renderer);
        const probe = await stopProbe(page);
        const after = renderer === "webgl" ? await webglDebug(page) : null;
        const metric = { run: run + 1, name: operation.name, ...summarizeProbe(probe) };
        if (renderer === "webgl") metric.webglDebug = assertWebglInvariant(before, after);
        operations.push(metric);
      }
    }
    return { renderer, status: "measured", url: url.toString(), browser: { version: browser.version(), viewport: VIEWPORT, devicePixelRatio: 1 }, operations };
  } finally { /* The fixed page is intentionally retained for every renderer/run. */ }
}

function defaultOutputPath() {
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  return path.join(defaultOutputDir, `webgl-pan-zoom-${stamp}.json`);
}

async function writeResult(output, result) {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fixtureCheck = await verifyFixture(options);
  if (options.verifyOnly) {
    console.log(JSON.stringify({ status: "fixture-valid", mapId: fixtureCheck.manifest.fixture.mapId, fixtureContentHash: fixtureCheck.checks.fixtureContentHash, counts: fixtureCheck.manifest.integrity.counts }, null, 2));
    return;
  }
  const rendererModes = options.renderer === "both" ? ["webgl", "svg"] : [options.renderer];
  const output = options.output || defaultOutputPath();
  const result = {
    schemaVersion: 1,
    status: "measured",
    createdAt: new Date().toISOString(),
    git: gitMetadata(),
    environment: { node: process.version, platform: process.platform, arch: process.arch, host: os.hostname(), viewport: VIEWPORT, devicePixelRatio: 1 },
    target: { baseUrl: options.baseUrl, workspaceId: fixtureCheck.manifest.fixture.workspaceId, sourceMapId: fixtureCheck.manifest.provenance.sourceMapId, mapId: fixtureCheck.manifest.fixture.mapId, scopeId: fixtureCheck.manifest.fixture.scopeId, fixtureContentHash: fixtureCheck.checks.fixtureContentHash, fixtureRawStateHash: fixtureCheck.checks.fixtureRawStateHash },
    runConfig: { warmupIterations: options.warmup, measuredRuns: options.runs, sequence: DEFAULT_SEQUENCE, headed: false, browserChannel: options.browserChannel || null },
    rendererRuns: [],
  };
  let browser;
  let context;
  try {
    browser = await chromium.launch({ headless: true, channel: options.browserChannel });
    // Contract: one isolated context and one page for the complete experiment.
    // Renderer changes navigate this same page; no warmup or measured run opens
    // or closes a browser context/page/tab.
    context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    for (const renderer of rendererModes) result.rendererRuns.push(await measureRenderer(page, browser, options, fixtureCheck.manifest.fixture, renderer));
    // The fixture must still be byte-for-byte equivalent after the permitted label normalization.
    const after = await verifyFixture(options);
    result.target.fixtureContentHashAfter = after.checks.fixtureContentHash;
    if (result.rendererRuns.some((run) => run.status !== "measured")) result.status = "no-measurement";
  } catch (error) {
    result.status = "no-measurement";
    result.error = error instanceof Error ? (error.stack || error.message) : String(error);
  } finally {
    await context?.close();
    await browser?.close();
    await writeResult(output, result);
  }
  console.log(`Result: ${output}`);
  if (result.status !== "measured") {
    console.error(result.error || "No WebGL measurement was produced.");
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
}
