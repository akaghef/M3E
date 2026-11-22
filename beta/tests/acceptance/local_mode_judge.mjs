// Acceptance judge for local mode (design: .kiro/specs/rapid-persistence-redesign/local-mode-design.md §8).
// Owned by the orchestrator. Runs one remote and two locals as separate processes on temp dirs.
// Usage: node local_mode_judge.mjs <beta dir>
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const BETA = path.resolve(process.argv[2] ?? ".");
const SERVER = path.join(BETA, "dist/node/start_viewer.js");
const CLI = path.join(BETA, "dist/node/record_store_cli.js");
const require = createRequire(import.meta.url);
const { toSnapshot } = require(path.join(BETA, "dist/shared/record_model/to_snapshot.js"));
const WS = "ws_judge";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-local-judge-"));
const results = [];
const servers = new Set();

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
  });
}

async function start(name, env, port) {
  port ??= await freePort();
  const full = {
    ...process.env, M3E_FORBID_LIVE_DATA: "1", M3E_PORT: String(port), M3E_WORKSPACE_ID: WS,
    M3E_OPEN_BROWSER: "0", M3E_CLOUD_SYNC: "0", M3E_AUTO_SYNC: "0", M3E_SKIP_SAMPLE_GENERATION: "1", M3E_DB_FILE: "data.sqlite",
  };
  for (const k of ["M3E_STORE_DIR", "M3E_SYNC_REMOTE", "M3E_NEO4J_BOLT", "M3E_TAILSCALE_USERS", "M3E_HOST"]) delete full[k];
  Object.assign(full, env);
  const child = spawn(process.execPath, [SERVER], { cwd: BETA, env: full, stdio: ["ignore", "pipe", "pipe"] });
  const log = [];
  child.stdout.on("data", (c) => log.push(String(c)));
  child.stderr.on("data", (c) => log.push(String(c)));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`${name} exited ${child.exitCode}: ${log.join("").slice(-2000)}`);
    try { if ((await fetch(`${base}/api/maps`)).status === 200) break; } catch {}
    if (Date.now() > deadline) throw new Error(`${name} did not start: ${log.join("").slice(-2000)}`);
    await new Promise((r) => setTimeout(r, 150));
  }
  const s = { name, base, port, child, log, env };
  servers.add(s);
  return s;
}

function stop(s) {
  servers.delete(s);
  if (!s || s.child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => { s.child.once("exit", () => resolve()); s.child.kill("SIGTERM"); });
}

async function call(base, method, route, body) {
  const r = await fetch(base + route, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let parsed = text; try { parsed = text ? JSON.parse(text) : null; } catch {}
  return { status: r.status, body: parsed };
}

const node = (id, parentId, children, text) => ({ id, parentId, children, nodeType: "text", text, collapsed: false, details: "", note: "", attributes: {}, link: "" });
const getMap = async (s, id) => (await call(s.base, "GET", `/api/maps/${id}`)).body;
const textOf = async (s, map, nid) => (await getMap(s, map))?.state?.nodes?.[nid]?.text;
const mapIds = async (s) => { const b = (await call(s.base, "GET", "/api/maps")).body; return (b.maps ?? b).map((m) => m.id).sort(); };
async function setText(s, map, nid, text) {
  const cur = await getMap(s, map);
  const next = JSON.parse(JSON.stringify(cur.state));
  next.nodes[nid].text = text;
  const r = await call(s.base, "POST", `/api/maps/${map}`, { state: next, baseSavedAt: cur.savedAt });
  if (r.status !== 200) throw new Error(`setText on ${s.name} → ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
}
const status = async (s) => (await call(s.base, "GET", "/api/sync/local/status")).body;
const push = async (s) => call(s.base, "POST", "/api/sync/local/push");
const pull = async (s) => call(s.base, "POST", "/api/sync/local/pull");
const remoteSeq = async (r) => (await call(r.base, "GET", "/api/sync/clone")).body.snapshotSeq;

function check(id, ok, detail) {
  results.push({ id, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${detail ?? ""}`);
}

async function main() {
  // Remote with an empty store, then two maps written on the remote itself (setup, not under test).
  const snap = path.join(root, "empty.jsonl");
  fs.writeFileSync(snap, toSnapshot(WS, [], { now: "2026-11-23T00:00:00.000Z" }).map((r) => JSON.stringify(r)).join("\n") + "\n");
  const created = spawnSync(process.execPath, [CLI, "--create", path.join(root, "remote/store"), "--from-snapshot", snap], { encoding: "utf8" });
  if (created.status !== 0) throw new Error(`create remote store: ${created.stderr}`);
  const remote = await start("remote", { M3E_DATA_DIR: path.join(root, "remote"), M3E_STORE_DIR: path.join(root, "remote/store") });
  const seedState = { rootId: "j_root", nodes: { j_root: node("j_root", null, ["j_a", "j_b"], "Judge"), j_a: node("j_a", "j_root", [], "a0"), j_b: node("j_b", "j_root", [], "b0") }, links: {} };
  for (const id of ["m1", "m2"]) {
    const r = await call(remote.base, "POST", `/api/maps/${id}`, { version: 1, savedAt: new Date().toISOString(), state: seedState });
    if (r.status !== 200) throw new Error(`seed ${id}: ${r.status} ${JSON.stringify(r.body)}`);
  }
  const localEnv = (n) => ({ M3E_DATA_DIR: path.join(root, n), M3E_SYNC_REMOTE: remote.base });
  let A = await start("A", localEnv("A"));
  const B = await start("B", localEnv("B"));

  // AC1 clone
  const rm = await mapIds(remote);
  check("AC1", JSON.stringify(await mapIds(A)) === JSON.stringify(rm) && JSON.stringify(await mapIds(B)) === JSON.stringify(rm)
    && (await textOf(A, "m1", "j_a")) === "a0" && (await textOf(B, "m1", "j_b")) === "b0", `remote maps ${rm.join(",")}`);
  const stA0 = await status(A);
  check("AC1-status", stA0?.mode === "local" && typeof stA0.unsent === "number", JSON.stringify(stA0));
  check("AC1-remote-mode", (await status(remote))?.mode === "remote");

  // AC3 no automatic push
  const seq0 = await remoteSeq(remote);
  await setText(A, "m1", "j_a", "A1");
  await new Promise((r) => setTimeout(r, 1500));
  check("AC3", (await textOf(remote, "m1", "j_a")) === "a0" && (await remoteSeq(remote)) === seq0 && (await status(A)).unsent >= 1, `unsent=${(await status(A)).unsent}`);

  // AC2 push then pull on B
  const p1 = await push(A);
  check("AC2-push", p1.status === 200 && (await textOf(remote, "m1", "j_a")) === "A1" && (await status(A)).unsent === 0, JSON.stringify(p1.body).slice(0, 200));
  await pull(B);
  check("AC2-pull", (await textOf(B, "m1", "j_a")) === "A1");

  // AC6 independent edits
  await setText(A, "m1", "j_a", "A2");
  await setText(B, "m1", "j_b", "B2");
  await push(A); await push(B); await pull(A); await pull(B);
  const six = [await textOf(remote, "m1", "j_a"), await textOf(remote, "m1", "j_b"), await textOf(A, "m1", "j_b"), await textOf(B, "m1", "j_a")];
  check("AC6", JSON.stringify(six) === JSON.stringify(["A2", "B2", "B2", "A2"]), six.join(","));

  // AC5 conflict on the same field
  await setText(A, "m1", "j_b", "A-conflict");
  await setText(B, "m1", "j_b", "B-conflict");
  await push(A);
  const pb = await push(B);
  await pull(B);
  const cl = (await call(B.base, "GET", "/api/sync/local/conflicts")).body;
  const conflicts = Array.isArray(cl) ? cl : (cl?.conflicts ?? cl?.items ?? []);
  check("AC5", (await textOf(remote, "m1", "j_b")) === "A-conflict" && (await textOf(B, "m1", "j_b")) === "A-conflict"
    && (await status(B)).conflicts >= 1 && conflicts.length >= 1, `pushB=${JSON.stringify(pb.body).slice(0, 160)} conflicts=${conflicts.length}`);

  // AC4 offline edit while the remote is down
  const remotePort = remote.port;
  await stop(remote);
  await setText(A, "m1", "j_a", "offline");
  const pOff = await push(A);
  const stOff = await status(A);
  check("AC4-down", stOff.remote?.state === "unreachable" && stOff.unsent >= 1, `push=${pOff.status} status=${JSON.stringify(stOff).slice(0, 200)}`);
  const remote2 = await start("remote", { M3E_DATA_DIR: path.join(root, "remote"), M3E_STORE_DIR: path.join(root, "remote/store") }, remotePort);
  await push(A);
  check("AC4-up", (await textOf(remote2, "m1", "j_a")) === "offline" && (await status(A)).unsent === 0);

  // AC8 restart with a non-empty outbox
  await setText(A, "m1", "j_a", "restart");
  await stop(A);
  A = await start("A", localEnv("A"));
  const stR = await status(A);
  await push(A);
  check("AC8", stR.unsent >= 1 && (await textOf(A, "m1", "j_a")) === "restart" && (await textOf(remote2, "m1", "j_a")) === "restart", `unsent after restart=${stR.unsent}`);

  // MCP write path on a local
  const enter = (await call(A.base, "POST", "/api/mcp/call", { name: "m3e_context", arguments: { action: "enter", target: "m3e://maps/m1" } })).body;
  const ctx = enter?.context_id ?? enter?.result?.context_id;
  const mc = await call(A.base, "POST", "/api/mcp/call", { name: "m3e_create", arguments: { kind: "node", context_id: ctx, text: "via mcp" } });
  await push(A);
  const remoteNodes = Object.values((await getMap(remote2, "m1")).state.nodes).map((n) => n.text);
  check("MCP", mc.status === 200 && remoteNodes.includes("via mcp"), `create=${mc.status}`);

  // AC7 map create and delete
  const nm = await call(A.base, "POST", "/api/maps/new", { label: "Judge new map" });
  // The app deletes a map in two steps: archive, then delete (DELETE on an unarchived map is 409 NOT_ARCHIVED).
  const arch = await call(A.base, "POST", "/api/maps/m2/archive");
  const del = await call(A.base, "DELETE", "/api/maps/m2");
  await push(A); await pull(B);
  const labels = async (s) => { const b = (await call(s.base, "GET", "/api/maps")).body; return (b.maps ?? b).map((m) => `${m.id}|${m.label}`); };
  const bl = await labels(B), rl = await labels(remote2);
  check("AC7", bl.some((x) => x.endsWith("|Judge new map")) && rl.some((x) => x.endsWith("|Judge new map")) && !bl.some((x) => x.startsWith("m2|")) && !rl.some((x) => x.startsWith("m2|")),
    `new=${nm.status} archive=${arch.status} delete=${del.status} B=${bl.join(";")}`);

  // AC10 confirmed seq and no duplicate commits
  await pull(A); await pull(B);
  const rs = await remoteSeq(remote2);
  const journal = fs.readFileSync(path.join(root, "remote/store/journal.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const ids = journal.map((l) => l.commandId).filter(Boolean);
  check("AC10", (await status(A)).confirmedSeq === rs && (await status(B)).confirmedSeq === rs && new Set(ids).size === ids.length, `remoteSeq=${rs} A=${(await status(A)).confirmedSeq} B=${(await status(B)).confirmedSeq} dupIds=${ids.length - new Set(ids).size}`);

  // AC11 a clone started without M3E_SYNC_REMOTE is still a local (edits go to the outbox, not straight into its store)
  await stop(B);
  const B2 = await start("B", { M3E_DATA_DIR: path.join(root, "B") });
  const st11 = await status(B2);
  await setText(B2, "m1", "j_a", "no-env");
  const st11b = await status(B2);
  await push(B2);
  check("AC11", st11?.mode === "local" && st11b.unsent === st11.unsent + 1 && (await textOf(remote2, "m1", "j_a")) === "no-env", `mode=${st11?.mode} unsent ${st11?.unsent}->${st11b?.unsent}`);

  // AC9 fencing: point A at another remote (other history)
  const created2 = spawnSync(process.execPath, [CLI, "--create", path.join(root, "other/store"), "--from-snapshot", snap], { encoding: "utf8" });
  if (created2.status !== 0) throw new Error(`create other store: ${created2.stderr}`);
  const other = await start("other", { M3E_DATA_DIR: path.join(root, "other"), M3E_STORE_DIR: path.join(root, "other/store") });
  const otherSeq0 = await remoteSeq(other);
  await stop(A);
  A = await start("A", { M3E_DATA_DIR: path.join(root, "A"), M3E_SYNC_REMOTE: other.base });
  await setText(A, "m1", "j_a", "fenced");
  const fp = await push(A); const fl = await pull(A);
  const stF = await status(A);
  check("AC9", (fp.status === 409 || fp.body?.code === "FENCED" || JSON.stringify(fp.body).includes("FENCED")) && stF.remote?.state === "refused" && (await remoteSeq(other)) === otherSeq0 && (await textOf(A, "m1", "j_a")) === "fenced",
    `push=${fp.status} ${JSON.stringify(fp.body).slice(0, 120)} pull=${fl.status} state=${stF.remote?.state}`);
}

try {
  await main();
} catch (error) {
  check("RUN", false, error.stack);
} finally {
  for (const s of [...servers]) await stop(s);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed. temp=${root}`);
  process.exitCode = failed.length ? 1 : 0;
}
