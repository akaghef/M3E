// Acceptance judge for the principle "手間は変化分に比例させる" on the viewer's save path
// (.kiro/specs/rapid-persistence-redesign/sync-principles.md). Owned by the orchestrator: an
// implementer must not edit it. The real viewer, served by the real server, toggles one node's scope
// (key f) on a 50-node map and on a 20,000-node map. The judged time is the main-thread time from the
// autosave timer firing to the Command request leaving the page: building the save, not drawing.
// Usage: node delta_viewer_judge.mjs <beta dir>
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const BETA = path.resolve(process.argv[2] ?? ".");
const SERVER = path.join(BETA, "dist/node/start_viewer.js");
const require = createRequire(import.meta.url);
const { toSnapshot } = require(path.join(BETA, "dist/shared/record_model/to_snapshot.js"));
const { RecordWorkspaceStore } = require(path.join(BETA, "dist/node/record_store/store.js"));
const { chromium } = require(path.join(BETA, "node_modules/playwright"));
const WS = "ws_delta_viewer_judge";
const RATIO = 3;
const TOGGLES = 9;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-delta-viewer-judge-"));
const results = [];

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
  });
}

function node(id, parentId, children, text) {
  return { id, parentId, children, collapsed: false, nodeType: "text", text, details: "", note: "", attributes: {}, link: "" };
}

function mapState(count) {
  const nodes = { root: node("root", null, [], "Root") };
  for (let i = 0; i < count; i += 1) {
    const id = `n${i}`;
    nodes[id] = node(id, "root", [], `Node ${i}`);
    nodes.root.children.push(id);
  }
  return { rootId: "root", nodes, links: {} };
}

async function start(name, count) {
  const storeDir = path.join(root, name, "store");
  fs.mkdirSync(path.dirname(storeDir), { recursive: true });
  RecordWorkspaceStore.create(storeDir, toSnapshot(WS, [{ id: "m", state: mapState(count) }]));
  const port = await freePort();
  const env = {
    ...process.env, M3E_FORBID_LIVE_DATA: "1", M3E_PORT: String(port), M3E_WORKSPACE_ID: WS, M3E_STORE_DIR: storeDir,
    M3E_DATA_DIR: path.dirname(storeDir), M3E_OPEN_BROWSER: "0", M3E_CLOUD_SYNC: "0", M3E_AUTO_SYNC: "0",
    M3E_SKIP_SAMPLE_GENERATION: "1", M3E_DB_FILE: "data.sqlite",
  };
  for (const k of ["M3E_SYNC_REMOTE", "M3E_NEO4J_BOLT", "M3E_TAILSCALE_USERS", "M3E_HOST"]) delete env[k];
  const child = spawn(process.execPath, [SERVER], { cwd: BETA, env, stdio: ["ignore", "pipe", "pipe"] });
  const log = [];
  child.stdout.on("data", (c) => log.push(String(c)));
  child.stderr.on("data", (c) => log.push(String(c)));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 120_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`server exited: ${log.join("").slice(-2000)}`);
    try { if ((await fetch(`${base}/api/maps`)).status === 200) break; } catch {}
    if (Date.now() > deadline) throw new Error(`server did not start: ${log.join("").slice(-2000)}`);
    await new Promise((r) => setTimeout(r, 150));
  }
  return { base, child };
}

function stop(s) {
  if (s.child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => { s.child.once("exit", () => resolve()); s.child.kill("SIGTERM"); });
}

// Record when the autosave timer fires and when a Command request leaves the page.
const INSTRUMENT = () => {
  const w = window;
  w.__saveStart = null;
  w.__saveCosts = [];
  w.__saveStatus = [];
  const original = w.setTimeout;
  w.setTimeout = function (fn, delay, ...rest) {
    if (delay === 700 && typeof fn === "function") {
      const wrapped = (...args) => { w.__saveStart = performance.now(); return fn(...args); };
      return original.call(this, wrapped, delay, ...rest);
    }
    return original.call(this, fn, delay, ...rest);
  };
  const fetchOriginal = w.fetch;
  w.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input.url;
    if (init && init.method === "POST" && /\/api\/maps\/[^/]+(\/commands)?$/.test(url) && w.__saveStart !== null) {
      w.__saveCosts.push(performance.now() - w.__saveStart);
      w.__saveStart = null;
      return fetchOriginal.call(this, input, init).then((response) => { w.__saveStatus.push(response.status); return response; });
    }
    return fetchOriginal.call(this, input, init);
  };
};

async function measure(browser, name, count) {
  const s = await start(name, count);
  const page = await browser.newPage();
  try {
    await page.addInitScript(INSTRUMENT);
    await page.goto(`${s.base}/viewer.html?ws=${WS}&map=m`, { timeout: 180_000 });
    await page.waitForFunction(() => document.title.includes("Root"), null, { timeout: 180_000 });
    await page.waitForTimeout(1500);
    await page.keyboard.press("ArrowRight");
    for (let i = 0; i < TOGGLES; i += 1) {
      await page.keyboard.press("f");
      await page.waitForFunction((n) => window.__saveStatus.length >= n, i + 1, { timeout: 120_000 });
    }
    const { costs, status } = await page.evaluate(() => ({ costs: window.__saveCosts, status: window.__saveStatus }));
    if (status.some((code) => code !== 200)) throw new Error(`${name}: a save answered ${status.join(",")}`);
    const sorted = [...costs].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  } finally {
    await page.close();
    await stop(s);
  }
}

const browser = await chromium.launch();
try {
  const small = await measure(browser, "viewer-small", 50);
  const large = await measure(browser, "viewer-large", 20000);
  const ratio = large / small;
  const pass = ratio < RATIO;
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"} DV1 save of a one-node scope toggle on a 50 / 20,000 node map: small ${small.toFixed(2)} ms, large ${large.toFixed(2)} ms, ratio ${ratio.toFixed(1)} (limit ${RATIO})`);
} catch (error) {
  console.error(`ERROR ${error.stack ?? error}`);
  results.push(false);
} finally {
  await browser.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed. temp=${root}`);
process.exit(passed === results.length && results.length > 0 ? 0 : 1);
