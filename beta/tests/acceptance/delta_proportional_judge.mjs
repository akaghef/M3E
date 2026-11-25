// Acceptance judge for the principle "手間は変化分に比例させる"
// (.kiro/specs/rapid-persistence-redesign/sync-principles.md). Owned by the orchestrator: an
// implementer must not edit it. Each check fixes the change (Δ) and varies only the size of the
// workspace, map or journal, through the real server process, and compares median times.
// Usage: node delta_proportional_judge.mjs <beta dir>
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
const { diffState } = require(path.join(BETA, "dist/shared/map_changes.js"));
const WS = "ws_delta_judge";
const RATIO = 3;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-delta-judge-"));
const servers = new Set();
const results = [];

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
  });
}

async function start(storeDir) {
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
  const s = { base, child };
  servers.add(s);
  return s;
}

function stop(s) {
  servers.delete(s);
  if (s.child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => { s.child.once("exit", () => resolve()); s.child.kill("SIGTERM"); });
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

function createStore(name, maps) {
  const dir = path.join(root, name, "store");
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  RecordWorkspaceStore.create(dir, toSnapshot(WS, maps.map(([id, count]) => ({ id, state: mapState(count) }))));
  return dir;
}

let commandNo = 0;
function textCommand(nodeId, from, to) {
  commandNo += 1;
  return {
    commandId: `cmd_delta_${commandNo}`, intent: "assert", actor: { kind: "human", id: "delta-judge" },
    changes: [{ kind: "node", key: [nodeId], op: "update", before: { text: from }, after: { text: to } }],
  };
}

async function post(base, route, body) {
  const response = await fetch(base + route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const text = await response.text();
  if (response.status !== 200) throw new Error(`${route} ${response.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function median(times, run) {
  for (let i = 0; i < 3; i += 1) await run(); // warm-up
  const samples = [];
  for (let i = 0; i < times; i += 1) {
    const t0 = process.hrtime.bigint();
    await run();
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

function judge(id, label, small, large) {
  const ratio = large / small;
  const pass = ratio < RATIO;
  results.push({ id, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${label}: small ${small.toFixed(2)} ms, large ${large.toFixed(2)} ms, ratio ${ratio.toFixed(1)} (limit ${RATIO})`);
}

// DJ1: a pull of one line costs the same whatever the length of the journal before it.
// DJ2: answering a repeated commandId costs the same whatever the length of the journal.
async function journalChecks() {
  const measure = async (name, lines) => {
    const dir = createStore(name, [["m", 10]]);
    const store = RecordWorkspaceStore.open(dir, { warm: false });
    let text = "Node 0";
    let last;
    for (let i = 0; i < lines; i += 1) {
      last = textCommand("n0", text, `${name} ${i}`);
      const result = store.commitMapCommand("m", last, "acct_local_human");
      if (!result.ok) throw new Error(`seed commit failed: ${JSON.stringify(result)}`);
      text = `${name} ${i}`;
    }
    const seq = store.seq();
    await store.close();
    const s = await start(dir);
    try {
      // The server may commit on start; ask for exactly the last line it holds.
      const first = await (await fetch(`${s.base}/api/sync/pull?after=${seq - 1}`)).json();
      const after = first.lines.at(-1).seq - 1;
      const pull = await median(25, async () => {
        const response = await fetch(`${s.base}/api/sync/pull?after=${after}`);
        const body = await response.json();
        if (!Array.isArray(body.lines) || body.lines.length !== 1) throw new Error(`pull returned ${JSON.stringify(body).slice(0, 200)}`);
      });
      const repeat = await median(25, async () => {
        const body = await post(s.base, "/api/maps/m/commands", last);
        if (body.ok !== true) throw new Error(`repeat returned ${JSON.stringify(body).slice(0, 200)}`);
      });
      return { pull, repeat };
    } finally {
      await stop(s);
    }
  };
  const small = await measure("journal-small", 100);
  const large = await measure("journal-large", 5000);
  judge("DJ1", "pull of one line after a 100 / 5,000 line journal", small.pull, large.pull);
  judge("DJ2", "repeated commandId after a 100 / 5,000 line journal", small.repeat, large.repeat);
}

// DJ3: a one-node commit costs the same whatever the size of the map.
async function commitCheck() {
  const measure = async (name, count) => {
    const dir = createStore(name, [["m", count]]);
    const s = await start(dir);
    try {
      let text = "Node 1";
      return await median(15, async () => {
        const next = `${text}+`;
        const body = await post(s.base, "/api/maps/m/commands", textCommand("n1", text, next));
        if (body.ok !== true) throw new Error(`commit returned ${JSON.stringify(body).slice(0, 200)}`);
        text = next;
      });
    } finally {
      await stop(s);
    }
  };
  const small = await measure("commit-small", 50);
  const large = await measure("commit-large", 20000);
  judge("DJ3", "one-node commit on a 50 / 20,000 node map", small, large);
}

// DJ4: adding one child, and DJ5: moving one node to another parent, cost the same whatever the
// size of the map. The Command is the viewer's: the difference of two states, built before timing.
async function structureChecks() {
  const measure = async (name, count, mutate) => {
    const dir = createStore(name, [["m", count]]);
    const s = await start(dir);
    try {
      let state = mapState(count);
      const samples = [];
      for (let i = 0; i < 18; i += 1) {
        const next = JSON.parse(JSON.stringify(state));
        mutate(next, i);
        commandNo += 1;
        const command = { commandId: `cmd_delta_${commandNo}`, intent: "assert", actor: { kind: "human", id: "delta-judge" }, changes: diffState(state, next) };
        const t0 = process.hrtime.bigint();
        const body = await post(s.base, "/api/maps/m/commands", command);
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        if (body.ok !== true) throw new Error(`${name} returned ${JSON.stringify(body).slice(0, 200)}`);
        state = next;
        if (i >= 3) samples.push(ms);
      }
      samples.sort((a, b) => a - b);
      return samples[Math.floor(samples.length / 2)];
    } finally {
      await stop(s);
    }
  };
  const add = (state, i) => {
    const id = `added${i}`;
    state.nodes[id] = node(id, "root", [], `Added ${i}`);
    state.nodes.root.children.push(id);
  };
  const move = (state, i) => {
    const id = `n${i + 2}`;
    state.nodes.root.children = state.nodes.root.children.filter((child) => child !== id);
    state.nodes.n0.children.push(id);
    state.nodes[id].parentId = "n0";
  };
  judge("DJ4", "add one child on a 50 / 20,000 node map", await measure("add-small", 50, add), await measure("add-large", 20000, add));
  judge("DJ5", "move one node to another parent on a 50 / 20,000 node map", await measure("move-small", 50, move), await measure("move-large", 20000, move));
}

try {
  await journalChecks();
  await commitCheck();
  await structureChecks();
} catch (error) {
  console.error(`ERROR ${error.stack ?? error}`);
  results.push({ id: "run", pass: false });
} finally {
  for (const s of [...servers]) await stop(s);
}
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed. temp=${root}`);
process.exit(passed === results.length && results.length > 0 ? 0 : 1);
