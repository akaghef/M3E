// Acceptance judge for the Neo4j store rebuild (DC39: the database is Neo4j; the journal only
// carries exchanges between devices and the remote). Owned by the acceptance session. The store
// owner may propose changes to the criteria or to the launch interface, but does not edit this file.
// Criteria are fixed before the store exists; a failure is reported, never answered by changing a criterion.
//
// Usage (run from the repository root, beta built with `npm --prefix beta run build`):
//   node beta/tests/acceptance/neo4j_store_judge.mjs synthetic [beta dir]
//       (a) (b) (c) (e) on temp data: one remote + two locals, each with its own disposable Neo4j.
//   node beta/tests/acceptance/neo4j_store_judge.mjs manifest --remote <url> --out <file>
//       Writes the pre-migration manifest of the remote's workspace (read-only: GET only).
//   node beta/tests/acceptance/neo4j_store_judge.mjs real --manifest <file> [--remote <url>] [--locals <url>,<url>] [--devices <spec>]
//       (d) against the real loaded workspace, read-only; plus (a) on the real data directories.
//
// Launch interface for the synthetic run (plumbing, not a criterion; see participantEnv()):
//   every participant: M3E_DATA_DIR=<temp>/<name>, M3E_WORKSPACE_ID=ws_judge, M3E_FORBID_LIVE_DATA=1,
//   M3E_NEO4J_BOLT / M3E_NEO4J_USER / M3E_NEO4J_PASSWORD / M3E_NEO4J_DATABASE of its own disposable Neo4j;
//   a local additionally M3E_SYNC_REMOTE=<remote base>. No M3E_STORE_DIR is given.
//   Disposable Neo4j: `neo4j` / `neo4j-admin` from PATH (override with M3E_JUDGE_NEO4J_BIN / M3E_JUDGE_NEO4J_ADMIN).
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const mode = process.argv[2] ?? "synthetic";
const argv = process.argv.slice(3);
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const results = [];
function check(id, ok, detail) {
  results.push({ id, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${detail ?? ""}`);
}
async function guarded(id, fn) {
  try { await fn(); } catch (error) { check(id, false, `aborted: ${String(error?.stack ?? error).slice(0, 1500)}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// Canonical content hashes (independent of storage order and of key order).
// ---------------------------------------------------------------------------------------------
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined && value[k] !== null).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const sha = (text) => crypto.createHash("sha256").update(text).digest("hex");
/** A record's content: `rev` (concurrency bookkeeping) is not content; `certainty: -1` is the store's "unset". */
function recordContent(record) {
  const { rev: _rev, ...rest } = record;
  if (rest.certainty === -1) delete rest.certainty;
  return canonical(rest);
}
const setHash = (lines) => sha([...lines].sort().join("\n"));
/** The viewer API document of a map, without the save bookkeeping (`savedAt`, `version`). */
const viewerHash = (doc) => sha(canonical(doc?.state ?? null));

const CATEGORY = {
  nodes: (r) => r.kind === "node",
  parentEdges: (r) => r.kind === "connection" && r.type === "edge",
  relationEdges: (r) => r.kind === "connection" && r.type !== "edge",
  aliases: (r) => r.kind === "node" && (r.alias !== undefined || r.nodeType === "alias"),
  scopes: (r) => r.kind === "scope",
  surfaces: (r) => r.kind === "surface",
};
/** Per map: counts and content hashes by category, from the record stream of `/api/sync/clone`. */
function summarizeRecords(records) {
  const maps = {};
  const workspace = [];
  for (const record of records) {
    if (record.kind === "commit" || record.kind === "snapshot") continue;
    const mapId = record.kind === "map" ? record.id : record.mapId;
    if (!mapId) { workspace.push(recordContent(record)); continue; }
    const m = (maps[mapId] ??= { counts: {}, kinds: {}, hashes: {}, _lines: {} });
    const content = recordContent(record);
    m.kinds[record.kind] = (m.kinds[record.kind] ?? 0) + 1;
    (m._lines[`kind:${record.kind}`] ??= []).push(content);
    for (const [cat, pred] of Object.entries(CATEGORY)) if (pred(record)) m.counts[cat] = (m.counts[cat] ?? 0) + 1;
    const attrs = record.attributes && typeof record.attributes === "object" ? Object.keys(record.attributes).length : 0;
    if (attrs) m.counts.attributes = (m.counts.attributes ?? 0) + attrs;
  }
  for (const m of Object.values(maps)) {
    for (const cat of [...Object.keys(CATEGORY), "attributes"]) m.counts[cat] ??= 0;
    for (const [key, lines] of Object.entries(m._lines)) m.hashes[key] = setHash(lines);
    m.contentHash = setHash(Object.values(m._lines).flat());
    delete m._lines;
  }
  return { maps, workspaceRecordsHash: setHash(workspace), workspaceRecordCount: workspace.length };
}

async function getJson(url, timeoutMs = 120_000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const text = await r.text();
  let body = text; try { body = text ? JSON.parse(text) : null; } catch {}
  return { status: r.status, body };
}
const listMaps = async (base) => { const b = (await getJson(`${base}/api/maps`)).body; return b?.maps ?? b; };

/** The manifest of a running server's workspace. GET only. */
async function takeManifest(remote, locals = []) {
  const head = (await getJson(`${remote}/api/sync/pull?after=${Number.MAX_SAFE_INTEGER}`)).body;
  const clone = (await getJson(`${remote}/api/sync/clone`, 600_000)).body;
  if (!clone || !Array.isArray(clone.records)) throw new Error(`clone gave no records: ${JSON.stringify(clone).slice(0, 300)}`);
  const summary = summarizeRecords(clone.records);
  const list = await listMaps(remote);
  const viewer = {};
  for (const m of list) {
    const doc = await getJson(`${remote}/api/maps/${encodeURIComponent(m.id)}`);
    viewer[m.id] = { label: m.label, archived: !!m.archived, status: doc.status, viewerHash: doc.status === 200 ? viewerHash(doc.body) : null };
  }
  const head2 = (await getJson(`${remote}/api/sync/pull?after=${Number.MAX_SAFE_INTEGER}`)).body;
  const seqOf = (h) => h?.snapshotSeq ?? h?.throughSeq;
  if (seqOf(head) !== seqOf(head2) || seqOf(head) !== clone.snapshotSeq) {
    throw new Error(`remote moved while the manifest was taken: ${seqOf(head)} → clone ${clone.snapshotSeq} → ${seqOf(head2)}`);
  }
  const maps = {};
  for (const id of new Set([...Object.keys(summary.maps), ...Object.keys(viewer)])) {
    maps[id] = { label: viewer[id]?.label ?? null, archived: viewer[id]?.archived ?? null, viewerStatus: viewer[id]?.status ?? null, viewerHash: viewer[id]?.viewerHash ?? null, ...(summary.maps[id] ?? { counts: null }) };
  }
  return {
    takenAt: new Date().toISOString(), source: remote,
    workspaceId: clone.workspaceId, historyId: clone.historyId, epoch: clone.epoch, throughSeq: clone.snapshotSeq,
    hashRule: "sha256 over sorted canonical JSON (sorted keys, null dropped) of each record without rev, certainty -1 dropped; viewerHash = canonical state of GET /api/maps/:id",
    mapCount: Object.keys(maps).length, workspaceRecordsHash: summary.workspaceRecordsHash, workspaceRecordCount: summary.workspaceRecordCount,
    maps, locals,
  };
}

// ---------------------------------------------------------------------------------------------
// (a) data-directory scan.
// ---------------------------------------------------------------------------------------------
const RECORD_KINDS = new Set(["snapshot", "map", "node", "connection", "scope", "surface", "details", "nodeView", "linearText", "annotation", "decay", "idMap"]);
function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) { out.push({ p, link: true }); continue; }
    if (e.isDirectory()) walk(p, out); else if (e.isFile()) out.push({ p, link: false });
  }
  return out;
}
function stateShaped(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.kind === "snapshot") return true;
  if (Array.isArray(value.records)) return true;
  if (value.state && typeof value.state === "object" && value.state.nodes && typeof value.state.nodes === "object") return true;
  if (value.nodes && typeof value.nodes === "object" && "rootId" in value) return true;
  return typeof value.kind === "string" && RECORD_KINDS.has(value.kind) && (typeof value.id === "string" || typeof value.mapId === "string");
}
/**
 * Violations in one data directory:
 *   R1 a file or link whose name contains "snapshot";
 *   R2 a .json/.jsonl file holding state-shaped content (a snapshot header, a record of a map, a whole map state);
 *   R3 an SQLite file holding any seeded node text;
 *   R4 (locals) any file holding the text of a node that existed on the remote before this local cloned.
 */
function scanDataDir(dir, { seedTexts = [], preCloneTexts = [] }) {
  const violations = [];
  for (const { p, link } of walk(dir)) {
    const rel = path.relative(dir, p);
    if (/snapshot/i.test(path.basename(p))) violations.push(`R1 ${rel}`);
    if (link) continue;
    let buf;
    try { buf = fs.readFileSync(p); } catch { continue; }
    if (/\.jsonl?$/i.test(p)) {
      const text = buf.toString("utf8");
      let shaped = false;
      try { shaped = stateShaped(JSON.parse(text)); } catch {
        for (const line of text.split("\n")) { if (!line.trim()) continue; try { if (stateShaped(JSON.parse(line))) { shaped = true; break; } } catch {} }
      }
      if (shaped) violations.push(`R2 ${rel}`);
    }
    if (buf.subarray(0, 16).toString("latin1") === "SQLite format 3\0" && seedTexts.some((t) => buf.includes(t))) violations.push(`R3 ${rel}`);
    const hit = preCloneTexts.find((t) => buf.includes(t));
    if (hit) violations.push(`R4 ${rel} holds pre-clone text`);
  }
  return violations;
}

// ---------------------------------------------------------------------------------------------
// Disposable Neo4j, one per participant.
// ---------------------------------------------------------------------------------------------
const NEO4J_BIN = process.env.M3E_JUDGE_NEO4J_BIN || "neo4j";
const NEO4J_ADMIN = process.env.M3E_JUDGE_NEO4J_ADMIN || "neo4j-admin";
const NEO4J_PASSWORD = "judge-disposable-1";

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
  });
}
const portOpen = (port) => new Promise((resolve) => {
  const s = net.connect(port, "127.0.0.1");
  s.once("connect", () => { s.destroy(); resolve(true); });
  s.once("error", () => resolve(false));
});

async function createNeo4j(root, name) {
  const dir = path.join(root, `neo4j-${name}`);
  const conf = path.join(dir, "conf");
  fs.mkdirSync(conf, { recursive: true });
  const port = await freePort();
  fs.writeFileSync(path.join(conf, "neo4j.conf"), [
    ...["data", "logs", "run", "import", "plugins"].map((d) => `server.directories.${d}=${path.join(dir, d)}`),
    `server.bolt.listen_address=127.0.0.1:${port}`, `server.bolt.advertised_address=127.0.0.1:${port}`,
    "server.http.enabled=false", "server.https.enabled=false",
    "server.memory.heap.initial_size=256m", "server.memory.heap.max_size=512m", "server.memory.pagecache.size=64m",
    "dbms.usage_report.enabled=false", "",
  ].join("\n"));
  const neoHome = spawnSync(NEO4J_BIN, ["version"], { encoding: "utf8" });
  if (neoHome.status !== 0) throw new Error(`neo4j not runnable: ${neoHome.stderr}`);
  const env = { ...process.env, NEO4J_CONF: conf };
  const pw = spawnSync(NEO4J_ADMIN, ["dbms", "set-initial-password", NEO4J_PASSWORD], { env, encoding: "utf8" });
  if (pw.status !== 0) throw new Error(`set-initial-password ${name}: ${pw.stderr || pw.stdout}`);
  return { name, dir, conf, port, env, bolt: `bolt://127.0.0.1:${port}` };
}
async function startNeo4j(neo) {
  const r = spawnSync(NEO4J_BIN, ["start"], { env: neo.env, encoding: "utf8" });
  if (r.status !== 0 && !/already running/i.test(r.stdout + r.stderr)) throw new Error(`neo4j start ${neo.name}: ${r.stdout}${r.stderr}`);
  const deadline = Date.now() + 120_000;
  while (!(await portOpen(neo.port))) {
    if (Date.now() > deadline) throw new Error(`neo4j ${neo.name} did not open bolt ${neo.port}`);
    await sleep(500);
  }
  for (;;) {
    try { await cypher(neo, "RETURN 1"); return; } catch (e) { if (Date.now() > deadline) throw e; await sleep(500); }
  }
}
function stopNeo4j(neo) {
  spawnSync(NEO4J_BIN, ["stop"], { env: neo.env, encoding: "utf8" });
}
let neo4jDriverModule = null;
async function cypher(neo, query, params = {}) {
  const driver = neo4jDriverModule.driver(neo.bolt, neo4jDriverModule.auth.basic("neo4j", NEO4J_PASSWORD), { connectionTimeout: 5000 });
  try {
    const res = await driver.executeQuery(query, params, { database: "neo4j" });
    return res.records.map((r) => r.toObject());
  } finally { await driver.close(); }
}

/** Diagnostics only: whether the text sits inside some larger string property (a blob) and how much Neo4j holds. */
async function embedded(neo, text) {
  try {
    const all = await cypher(neo, "MATCH (n) RETURN count(n) AS c");
    const inside = await cypher(neo, "MATCH (n) WHERE any(k IN keys(n) WHERE n[k] IS :: STRING AND n[k] CONTAINS $t) RETURN count(n) AS c", { t: text });
    return `(neo4j holds ${all[0]?.c} nodes; ${inside[0]?.c} hold the text inside a longer string)`;
  } catch (e) { return `(neo4j query failed: ${String(e).slice(0, 120)})`; }
}

// ---------------------------------------------------------------------------------------------
// M3E servers.
// ---------------------------------------------------------------------------------------------
const WS = "ws_judge";
const servers = new Set();
/** `--control-jsonl-store`: a diagnostic run of the judge's own mechanics on the pre-rebuild store. Never acceptance evidence. */
const CONTROL = argv.includes("--control-jsonl-store");
const controlEnv = {};
function participantEnv(root, name, neo, remoteBase) {
  const env = {
    M3E_FORBID_LIVE_DATA: "1", M3E_WORKSPACE_ID: WS, M3E_OPEN_BROWSER: "0", M3E_CLOUD_SYNC: "0", M3E_AUTO_SYNC: "0",
    M3E_SKIP_SAMPLE_GENERATION: "1", M3E_BACKUP_INTERVAL_MS: "2000",
    M3E_DATA_DIR: path.join(root, name),
    M3E_NEO4J_BOLT: neo.bolt, M3E_NEO4J_USER: "neo4j", M3E_NEO4J_PASSWORD: NEO4J_PASSWORD, M3E_NEO4J_DATABASE: "neo4j",
  };
  if (remoteBase) env.M3E_SYNC_REMOTE = remoteBase;
  else Object.assign(env, controlEnv);
  return env;
}
async function startServer(BETA, name, env, port, { waitReady = true } = {}) {
  port ??= await freePort();
  const full = { ...process.env };
  for (const k of Object.keys(full)) if (k.startsWith("M3E_")) delete full[k];
  Object.assign(full, env, { M3E_PORT: String(port) });
  const child = spawn(process.execPath, [path.join(BETA, "dist/node/start_viewer.js")], { cwd: BETA, env: full, stdio: ["ignore", "pipe", "pipe"] });
  const log = [];
  child.stdout.on("data", (c) => log.push(String(c)));
  child.stderr.on("data", (c) => log.push(String(c)));
  const s = { name, base: `http://127.0.0.1:${port}`, port, child, log, env };
  servers.add(s);
  if (!waitReady) return s;
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`${name} exited ${child.exitCode}: ${log.join("").slice(-2000)}`);
    try { if ((await fetch(`${s.base}/api/maps`, { signal: AbortSignal.timeout(5000) })).status === 200) break; } catch {}
    if (Date.now() > deadline) throw new Error(`${name} did not serve /api/maps: ${log.join("").slice(-2000)}`);
    await sleep(200);
  }
  return s;
}
function stopServer(s) {
  servers.delete(s);
  if (!s || s.child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(() => { s.child.kill("SIGKILL"); }, 20_000);
    s.child.once("exit", () => { clearTimeout(t); resolve(); });
    s.child.kill("SIGTERM");
  });
}
async function call(base, method, route, body, timeoutMs = 30_000) {
  try {
    const r = await fetch(base + route, { method, signal: AbortSignal.timeout(timeoutMs), headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let parsed = text; try { parsed = text ? JSON.parse(text) : null; } catch {}
    return { status: r.status, body: parsed };
  } catch (error) {
    return { status: 0, body: null, error: String(error?.name ?? error) };
  }
}
const node = (id, parentId, children, text) => ({ id, parentId, children, nodeType: "text", text, collapsed: false, details: "", note: "", attributes: {}, link: "" });
const getMap = async (s, id) => (await call(s.base, "GET", `/api/maps/${id}`)).body;
const textOf = async (s, map, nid) => (await getMap(s, map))?.state?.nodes?.[nid]?.text;
const mapIds = async (s) => { const b = (await call(s.base, "GET", "/api/maps")).body; return (b?.maps ?? b ?? []).map((m) => m.id).sort(); };
async function setText(s, map, nid, text) {
  const cur = await getMap(s, map);
  if (!cur?.state?.nodes?.[nid]) throw new Error(`setText on ${s.name}: ${map}/${nid} not readable`);
  const next = JSON.parse(JSON.stringify(cur.state));
  next.nodes[nid].text = text;
  const r = await call(s.base, "POST", `/api/maps/${map}`, { state: next, baseSavedAt: cur.savedAt });
  if (r.status !== 200) throw new Error(`setText on ${s.name} → ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
}
const status = async (s) => (await call(s.base, "GET", "/api/sync/local/status")).body;
const push = async (s) => call(s.base, "POST", "/api/sync/local/push");
const pull = async (s) => call(s.base, "POST", "/api/sync/local/pull");
async function allViewerHashes(s) {
  const out = {};
  for (const id of await mapIds(s)) { const r = await call(s.base, "GET", `/api/maps/${id}`); out[id] = r.status === 200 ? viewerHash(r.body) : `status ${r.status}`; }
  return out;
}
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

async function synthetic(BETA) {
  const require = createRequire(path.join(BETA, "package.json"));
  neo4jDriverModule = require("neo4j-driver");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-neo4j-judge-"));
  const tag = crypto.randomBytes(4).toString("hex");
  const T = (s) => `judge-${tag}-${s}`;
  const neo = {};
  const dataDir = (n) => path.join(root, n);
  try {
    const [nr, na, nb] = await Promise.all(["remote", "A", "B"].map((n) => createNeo4j(root, n)));
    Object.assign(neo, { remote: nr, A: na, B: nb });
    await Promise.all(Object.values(neo).map(startNeo4j));

    const seedTexts = [T("root"), T("a0"), T("b0"), T("c0")];
    const preClone = [T("c0")]; // never edited, so only a clone can bring it to a local
    const scanAll = (phase, parts) => {
      for (const [n, isLocal] of parts) {
        const v = scanDataDir(dataDir(n), { seedTexts, preCloneTexts: isLocal ? preClone : [] });
        check(`A-${phase}-${n}`, v.length === 0, v.slice(0, 8).join("; "));
      }
    };

    // Remote on an empty disposable Neo4j; two maps written through the viewer API.
    if (CONTROL) {
      // Control run only: the remote gets the pre-rebuild JSONL record store, so the later phases can be exercised.
      const { toSnapshot } = createRequire(path.join(BETA, "package.json"))(path.join(BETA, "dist/shared/record_model/to_snapshot.js"));
      const snap = path.join(root, "control-empty.jsonl");
      fs.writeFileSync(snap, toSnapshot(WS, [], { now: "2026-11-27T00:00:00.000Z" }).map((r) => JSON.stringify(r)).join("\n") + "\n");
      const created = spawnSync(process.execPath, [path.join(BETA, "dist/node/record_store_cli.js"), "--create", path.join(root, "remote/store"), "--from-snapshot", snap], { encoding: "utf8" });
      if (created.status !== 0) throw new Error(`control store: ${created.stderr}`);
      controlEnv.M3E_STORE_DIR = path.join(root, "remote/store");
    }
    let remote = await startServer(BETA, "remote", participantEnv(root, "remote", neo.remote));
    const seedState = { rootId: "j_root", nodes: {
      j_root: node("j_root", null, ["j_a", "j_b", "j_c"], T("root")), j_a: node("j_a", "j_root", [], T("a0")),
      j_b: node("j_b", "j_root", [], T("b0")), j_c: node("j_c", "j_root", [], T("c0")) }, links: {} };
    for (const id of ["m1", "m2"]) {
      const r = await call(remote.base, "POST", `/api/maps/${id}`, { version: 1, savedAt: new Date().toISOString(), state: seedState });
      if (r.status !== 200) throw new Error(`seed ${id}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    }
    scanAll("start", [["remote", false]]);

    // (b) on the remote: a record changed in Neo4j directly is what the viewer API returns.
    await guarded("B1-remote", async () => {
      const hits = await cypher(neo.remote, "MATCH (n) WHERE any(k IN keys(n) WHERE n[k] = $t) RETURN count(n) AS c", { t: T("a0") });
      const c = Number(hits[0]?.c ?? 0);
      if (c > 0) await cypher(neo.remote, "MATCH (n) WHERE any(k IN keys(n) WHERE n[k] = $t) WITH n, [k IN keys(n) WHERE n[k] = $t] AS ks UNWIND ks AS k SET n[k] = $t2", { t: T("a0"), t2: T("a0-direct") });
      let seen = [];
      for (let i = 0; i < 25; i++) { seen = [await textOf(remote, "m1", "j_a"), await textOf(remote, "m2", "j_a")]; if (seen.every((x) => x === T("a0-direct"))) break; await sleep(200); }
      check("B1-remote", c >= 2 && seen.every((x) => x === T("a0-direct")), `neo4j nodes holding the text=${c} ${c ? "" : await embedded(neo.remote, T("a0"))} viewer=${seen.join(",")}`);
    });

    const localEnv = (n) => participantEnv(root, n, neo[n], remote.base);
    let A = await startServer(BETA, "A", localEnv("A"));
    let B = await startServer(BETA, "B", localEnv("B"));
    await guarded("C0-clone", async () => {
      const rm = await mapIds(remote);
      check("C0-clone", same(await mapIds(A), rm) && same(await mapIds(B), rm) && (await textOf(A, "m1", "j_c")) === T("c0") && (await textOf(B, "m2", "j_c")) === T("c0"), `remote maps ${rm.join(",")}`);
    });
    scanAll("clone", [["remote", false], ["A", true], ["B", true]]);

    // (b) on a local.
    await guarded("B1-local", async () => {
      const hits = await cypher(neo.A, "MATCH (n) WHERE any(k IN keys(n) WHERE n[k] = $t) RETURN count(n) AS c", { t: T("c0") });
      const c = Number(hits[0]?.c ?? 0);
      if (c > 0) await cypher(neo.A, "MATCH (n) WHERE any(k IN keys(n) WHERE n[k] = $t) WITH n, [k IN keys(n) WHERE n[k] = $t] AS ks UNWIND ks AS k SET n[k] = $t2", { t: T("c0"), t2: T("c0-directA") });
      let seen;
      for (let i = 0; i < 25; i++) { seen = await textOf(A, "m1", "j_c"); if (seen === T("c0-directA")) break; await sleep(200); }
      check("B1-local", c >= 1 && seen === T("c0-directA"), `neo4j nodes holding the text=${c} ${c ? "" : await embedded(neo.A, T("c0"))} viewer=${seen}`);
    });

    // (c) edit on A → push → pull on B.
    await guarded("C1", async () => {
      await setText(A, "m1", "j_a", T("A1"));
      scanAll("edit", [["A", true]]);
      const p = await push(A);
      scanAll("push", [["remote", false], ["A", true]]);
      await pull(B);
      scanAll("pull", [["B", true]]);
      check("C1", p.status === 200 && (await textOf(remote, "m1", "j_a")) === T("A1") && (await textOf(B, "m1", "j_a")) === T("A1") && (await status(A))?.unsent === 0,
        `push=${p.status} remote=${await textOf(remote, "m1", "j_a")} B=${await textOf(B, "m1", "j_a")}`);
    });

    // (c) the same node changed on both locals: a conflict, nothing lost.
    await guarded("C2", async () => {
      await pull(A); await pull(B);
      await setText(A, "m1", "j_b", T("A-conflict"));
      await setText(B, "m1", "j_b", T("B-conflict"));
      const pa = await push(A);
      const pb = await push(B);
      await pull(B);
      const cl = (await call(B.base, "GET", "/api/sync/local/conflicts")).body;
      const rows = Array.isArray(cl) ? cl : (cl?.conflicts ?? []);
      const remoteText = await textOf(remote, "m1", "j_b");
      const bText = await textOf(B, "m1", "j_b");
      const keptLoser = JSON.stringify(rows).includes(T("B-conflict")) || bText === T("B-conflict");
      check("C2", pa.status === 200 && remoteText === T("A-conflict") && (await status(B))?.conflicts >= 1 && rows.length >= 1 && keptLoser,
        `pushA=${pa.status} pushB=${pb.status} remote=${remoteText} B=${bText} conflicts=${rows.length} loserKept=${keptLoser}`);
    });

    // (c) offline edits are kept (also across a restart of the local) and pushed later.
    await guarded("C3", async () => {
      const remotePort = remote.port;
      await stopServer(remote);
      await setText(A, "m1", "j_a", T("offline"));
      const pOff = await push(A);
      const stOff = await status(A);
      await stopServer(A);
      A = await startServer(BETA, "A", localEnv("A"), A.port);
      const keptAfterRestart = (await textOf(A, "m1", "j_a")) === T("offline") && (await status(A))?.unsent >= 1;
      check("C3-down", stOff?.remote?.state === "unreachable" && stOff?.unsent >= 1 && keptAfterRestart, `push=${pOff.status} status=${JSON.stringify(stOff).slice(0, 200)} keptAfterRestart=${keptAfterRestart}`);
      remote = await startServer(BETA, "remote", participantEnv(root, "remote", neo.remote), remotePort);
      const pUp = await push(A);
      await pull(B);
      check("C3-up", pUp.status === 200 && (await textOf(remote, "m1", "j_a")) === T("offline") && (await textOf(B, "m1", "j_a")) === T("offline") && (await status(A))?.unsent === 0,
        `push=${pUp.status} remote=${await textOf(remote, "m1", "j_a")} B=${await textOf(B, "m1", "j_a")}`);
    });

    // Backups run every 2 s (M3E_BACKUP_INTERVAL_MS); wait for several, then scan.
    await sleep(5000);
    scanAll("backup", [["remote", false], ["A", true], ["B", true]]);

    // (e) restart: every participant's state survives a server restart.
    await guarded("E1", async () => {
      await pull(A); await pull(B);
      await setText(A, "m2", "j_a", T("pending-restart")); // an unsent edit must survive too
      const before = { remote: await allViewerHashes(remote), A: await allViewerHashes(A), B: await allViewerHashes(B), unsentA: (await status(A))?.unsent };
      const ports = { remote: remote.port, A: A.port, B: B.port };
      await Promise.all([stopServer(A), stopServer(B), stopServer(remote)]);
      remote = await startServer(BETA, "remote", participantEnv(root, "remote", neo.remote), ports.remote);
      A = await startServer(BETA, "A", localEnv("A"), ports.A);
      B = await startServer(BETA, "B", localEnv("B"), ports.B);
      const after = { remote: await allViewerHashes(remote), A: await allViewerHashes(A), B: await allViewerHashes(B), unsentA: (await status(A))?.unsent };
      check("E1", same(before, after) && before.unsentA >= 1, `same=${same(before, after)} unsentA ${before.unsentA}->${after.unsentA}`);
      scanAll("restart", [["remote", false], ["A", true], ["B", true]]);
    });

    // (e) reboot: servers and Neo4j all stop; Neo4j comes back first, then the servers.
    await guarded("E2", async () => {
      const before = { remote: await allViewerHashes(remote), A: await allViewerHashes(A), B: await allViewerHashes(B), unsentA: (await status(A))?.unsent };
      const ports = { remote: remote.port, A: A.port, B: B.port };
      await Promise.all([stopServer(A), stopServer(B), stopServer(remote)]);
      Object.values(neo).forEach(stopNeo4j);
      await Promise.all(Object.values(neo).map(startNeo4j));
      remote = await startServer(BETA, "remote", participantEnv(root, "remote", neo.remote), ports.remote);
      A = await startServer(BETA, "A", localEnv("A"), ports.A);
      B = await startServer(BETA, "B", localEnv("B"), ports.B);
      const after = { remote: await allViewerHashes(remote), A: await allViewerHashes(A), B: await allViewerHashes(B), unsentA: (await status(A))?.unsent };
      const p = await push(A); await pull(B);
      check("E2", same(before, after) && p.status === 200 && (await textOf(B, "m2", "j_a")) === T("pending-restart"), `same=${same(before, after)} push=${p.status} B=${await textOf(B, "m2", "j_a")}`);
      scanAll("reboot", [["remote", false], ["A", true], ["B", true]]);
    });

    // (b) with Neo4j stopped the server refuses or reports it, never serving file state.
    await guarded("B2", async () => {
      const okBefore = await textOf(B, "m1", "j_a");
      stopNeo4j(neo.B);
      const g = await call(B.base, "GET", "/api/maps/m1", undefined, 20_000);
      const list = await call(B.base, "GET", "/api/maps", undefined, 20_000);
      const cur = { state: { ...seedState, nodes: { ...seedState.nodes, j_a: { ...seedState.nodes.j_a, text: T("while-down") } } } };
      const w = await call(B.base, "POST", "/api/maps/m1", cur, 20_000);
      const served = g.status === 200 && !!g.body?.state;
      const listed = list.status === 200 && (list.body?.maps ?? list.body)?.length > 0;
      check("B2-read", !!okBefore && g.status !== 0 && !served && list.status !== 0 && !listed, `GET map=${g.status}${g.error ? " " + g.error : ""} served=${served} GET list=${list.status} listed=${listed}`);
      check("B2-write", w.status !== 0 && w.status !== 200, `POST=${w.status}${w.error ? " " + w.error : ""}`);
      // (e) the server serves again once Neo4j is back, without a server restart.
      await startNeo4j(neo.B);
      let back;
      for (let i = 0; i < 120; i++) { back = await textOf(B, "m1", "j_a"); if (back === okBefore) break; await sleep(500); }
      check("E3", back === okBefore && (await textOf(B, "m1", "j_a")) !== T("while-down"), `after Neo4j returned: ${back}`);
    });

    // (e) boot order reversed: a server started while its Neo4j is down serves once Neo4j comes up.
    await guarded("E4", async () => {
      const want = await textOf(A, "m1", "j_a");
      const port = A.port;
      await stopServer(A);
      stopNeo4j(neo.A);
      A = await startServer(BETA, "A", localEnv("A"), port, { waitReady: false });
      await sleep(3000);
      const early = await call(A.base, "GET", "/api/maps/m1", undefined, 10_000);
      const servedEarly = early.status === 200 && !!early.body?.state;
      await startNeo4j(neo.A);
      let back;
      for (let i = 0; i < 120; i++) { if (A.child.exitCode !== null) break; back = await textOf(A, "m1", "j_a"); if (back === want) break; await sleep(500); }
      check("E4", !servedEarly && back === want, `servedWhileDown=${servedEarly} exit=${A.child.exitCode} after Neo4j up: ${back}`);
    });
    scanAll("final", [["remote", false], ["A", true], ["B", true]]);
  } finally {
    for (const s of [...servers]) await stopServer(s);
    Object.values(neo).forEach(stopNeo4j);
    console.log(`temp=${root}`);
  }
}

// ---------------------------------------------------------------------------------------------
// (d) real workspace, read-only.
// ---------------------------------------------------------------------------------------------
const DEFAULT_REMOTE = "https://swingbymac-mini.tail6206ae.ts.net";
const REAL_WS = "ws_REMH1Z5TFA7S93R3HA0XK58JNR";
/** host:path pairs; host "local" is this machine, others go through ssh. Windows paths use win: prefix. */
const DEFAULT_DEVICES = [
  ["mini", `/Users/swingby/Library/Application Support/M3E/workspaces/${REAL_WS}`],
  ["local", path.join(os.homedir(), `Library/Application Support/M3E/workspaces/${REAL_WS}`)],
  ["win", `%LOCALAPPDATA%\\M3E\\workspaces\\${REAL_WS}`],
];
function listDeviceFiles(host, dir) {
  if (host === "local") return walk(dir).map((f) => path.relative(dir, f.p));
  const cmd = host === "win"
    ? `powershell -NoProfile -Command "$d=[Environment]::ExpandEnvironmentVariables('${dir}'); Get-ChildItem -Recurse -Force $d | ForEach-Object { $_.FullName.Substring($d.Length) }"`
    : `cd ${JSON.stringify(dir)} && find . -mindepth 1`;
  const r = spawnSync("ssh", ["-o", "ConnectTimeout=10", host, cmd], { encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`${host}: ${r.stderr.slice(0, 300)}`);
  return r.stdout.split(/\r?\n/).filter(Boolean);
}

/** Diagnostics only (the verdict is the hash): field paths that differ from the viewer documents saved beside the manifest. */
function diffPaths(x, y, p = "", out = []) {
  if (out.length >= 6) return out;
  if (typeof x !== typeof y || Array.isArray(x) !== Array.isArray(y) || (x === null) !== (y === null)) { out.push(`${p || "/"} type`); return out; }
  if (x && typeof x === "object") {
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (!(k in y)) out.push(`${p}/${k} missing now`); else if (!(k in x)) out.push(`${p}/${k} new now`); else diffPaths(x[k], y[k], `${p}/${k}`, out);
      if (out.length >= 6) break;
    }
  } else if (x !== y) out.push(`${p} value`);
  return out;
}
async function explainViewer(base, ids, manifestPath) {
  const dir = path.join(path.dirname(manifestPath), `viewer-seq${JSON.parse(fs.readFileSync(manifestPath, "utf8")).throughSeq}`);
  const out = [];
  for (const id of ids.slice(0, 5)) {
    const file = path.join(dir, `${id}.json`);
    if (!fs.existsSync(file)) { out.push(id); continue; }
    const now = await getJson(`${base}/api/maps/${encodeURIComponent(id)}`);
    const before = JSON.parse(fs.readFileSync(file, "utf8"));
    const paths = diffPaths(before.state, now.body?.state).map((s) => s.replace(/^\/nodes\/[^/]+/, "/nodes/*"));
    out.push(`${id}: ${[...new Set(paths)].join(", ")}`);
  }
  if (ids.length > 5) out.push(`… ${ids.length} maps`);
  return out;
}

async function real() {
  const manifestPath = opt("manifest");
  if (!manifestPath) throw new Error("--manifest <file> is required");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const remote = opt("remote", manifest.source ?? DEFAULT_REMOTE);
  const now = await takeManifest(remote);
  check("D0-workspace", now.workspaceId === manifest.workspaceId, `workspace ${now.workspaceId} (manifest ${manifest.workspaceId}); history ${manifest.historyId}/${manifest.epoch}@${manifest.throughSeq} → ${now.historyId}/${now.epoch}@${now.throughSeq}`);
  check("D0-maps", same(Object.keys(now.maps).sort(), Object.keys(manifest.maps).sort()), `maps ${Object.keys(manifest.maps).length} → ${Object.keys(now.maps).length}`);
  check("D0-workspace-records", now.workspaceRecordsHash === manifest.workspaceRecordsHash, `workspace-level records ${manifest.workspaceRecordCount} → ${now.workspaceRecordCount}`);
  let bad = { counts: [], hashes: [], viewer: [], labels: [] };
  for (const [id, want] of Object.entries(manifest.maps)) {
    const got = now.maps[id];
    if (!got) continue;
    if (!same(got.counts, want.counts)) bad.counts.push(`${id} ${JSON.stringify(want.counts)} → ${JSON.stringify(got.counts)}`);
    if (got.contentHash !== want.contentHash) bad.hashes.push(`${id} [${Object.keys({ ...want.hashes, ...got.hashes }).filter((k) => want.hashes?.[k] !== got.hashes?.[k]).join(",")}]`);
    if (got.viewerHash !== want.viewerHash) bad.viewer.push(id);
    if (got.label !== want.label) bad.labels.push(id);
  }
  check("D1-counts", bad.counts.length === 0, bad.counts.slice(0, 5).join(" | "));
  check("D2-content", bad.hashes.length === 0, bad.hashes.slice(0, 10).join(" | "));
  check("D3-viewer", bad.viewer.length === 0, (await explainViewer(remote, bad.viewer, manifestPath)).join(" | "));
  check("D4-names", bad.labels.length === 0, bad.labels.slice(0, 10).join(","));
  // Every local serves the same maps as the manifest.
  for (const base of (opt("locals", "") || "").split(",").filter(Boolean)) {
    await guarded(`D5-${base}`, async () => {
      const diff = [];
      for (const [id, want] of Object.entries(manifest.maps)) {
        const r = await getJson(`${base}/api/maps/${encodeURIComponent(id)}`);
        if ((r.status === 200 ? viewerHash(r.body) : null) !== want.viewerHash) diff.push(id);
      }
      check(`D5-${base}`, diff.length === 0, (await explainViewer(base, diff, manifestPath)).join(" | "));
    });
  }
  // (a) on the real data directories: no snapshot file.
  const devices = opt("devices") ? opt("devices").split(";").map((s) => { const i = s.indexOf(":"); return [s.slice(0, i), s.slice(i + 1)]; }) : DEFAULT_DEVICES;
  for (const [host, dir] of devices) {
    await guarded(`A-real-${host}`, async () => {
      const hits = listDeviceFiles(host, dir).filter((f) => /snapshot/i.test(f.split(/[\\/]/).pop()));
      check(`A-real-${host}`, hits.length === 0, hits.slice(0, 6).join("; "));
    });
  }
}

try {
  if (mode === "manifest") {
    const out = opt("out");
    if (!out) throw new Error("--out <file> is required");
    if (fs.existsSync(out)) throw new Error(`${out} exists; choose another name`);
    const m = await takeManifest(opt("remote", DEFAULT_REMOTE), (opt("locals", "") || "").split(",").filter(Boolean));
    fs.writeFileSync(out, JSON.stringify(m, null, 2) + "\n", { flag: "wx" });
    const total = (k) => Object.values(m.maps).reduce((s, x) => s + (x.counts?.[k] ?? 0), 0);
    console.log(`manifest ${out}: ${m.workspaceId} ${m.historyId}/${m.epoch}@${m.throughSeq}, ${m.mapCount} maps, nodes=${total("nodes")} parentEdges=${total("parentEdges")} relationEdges=${total("relationEdges")} aliases=${total("aliases")} scopes=${total("scopes")} attributes=${total("attributes")} surfaces=${total("surfaces")}`);
  } else if (mode === "real") {
    await real();
  } else if (mode === "synthetic") {
    if (CONTROL) console.log("CONTROL RUN on the pre-rebuild JSONL store: diagnostics of the judge, not acceptance.");
    await synthetic(path.resolve(argv.find((a) => !a.startsWith("--")) ?? "beta"));
  } else {
    throw new Error(`unknown mode ${mode}`);
  }
} catch (error) {
  check("RUN", false, String(error?.stack ?? error).slice(0, 3000));
} finally {
  for (const s of [...servers]) await stopServer(s);
  if (mode !== "manifest" || results.some((r) => !r.ok)) {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed.`);
    process.exitCode = failed.length ? 1 : 0;
  }
}
