#!/usr/bin/env node
/*
 * Differential judge for the record workspace store.
 *
 * Feeds the same random sequence of Commands to (a) the existing SQLite commit
 * path and (b) the record store, and requires the same accept/reject outcome
 * and the same resulting map state after an independent normalisation. Then
 * reopens the store from its files (journal replay) and, when a Bolt URI is
 * given, compares the Neo4j dump with the store's records byte for byte.
 *
 * Written apart from the store; it only uses the store's public API.
 * Run from beta/ after `npm run build:node`, with M3E_FORBID_LIVE_DATA=1.
 *
 *   node judge_store_differential.cjs --restored <rows.json> --snapshot <ws.jsonl>
 *        --work <empty dir> [--maps 3] [--steps 400] [--seed 1] [--bolt uri]
 */
"use strict";
const fs = require("fs");
const path = require("path");

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
for (const need of ["restored", "snapshot", "work"]) {
  if (!args[need]) { console.error(`missing --${need}`); process.exit(2); }
}
if (process.env.M3E_FORBID_LIVE_DATA !== "1") { console.error("set M3E_FORBID_LIVE_DATA=1"); process.exit(2); }

const dist = (p) => require(path.resolve("dist", p));
const { RapidMvpModel } = dist("node/rapid_mvp.js");
const { commitMapCommand, savedMap } = dist("node/map_commit.js");
const { diffState } = dist("shared/map_changes.js");
const { RecordWorkspaceStore } = dist("node/record_store/store.js");
const jsonl = dist("shared/record_model/jsonl.js");

// ---------- deterministic random ----------
let seed = Number(args.seed || 1) >>> 0;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const pick = (list) => list[Math.floor(rnd() * list.length)];
const clone = (value) => JSON.parse(JSON.stringify(value));

// ---------- independent normalisation ----------
const EDGE_LABEL = "m3e:edge-label";
const bare = (key) => (typeof key === "string" && key.startsWith("scope:") ? key.slice(6) : key);
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) if (value[key] !== null && value[key] !== undefined) out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}
function normalise(state) {
  const nodes = state.nodes || {};
  const root = state.rootId;
  const isScopeRoot = (id) => id === root || (nodes[id] && nodes[id].nodeType === "folder");
  const out = { rootId: root, nodes: {}, links: {}, surfaces: {}, linear: {}, annotations: {}, top: {}, primary: {} };
  for (const [id, node] of Object.entries(nodes)) {
    const n = {};
    for (const [key, value] of Object.entries(node)) {
      if (value === null || value === undefined || key === "scopeId" || key === "aliasOf") continue;
      n[key] = value;
    }
    const listed = [];
    for (const child of node.children || []) {
      if (nodes[child] && nodes[child].parentId === id && !listed.includes(child)) listed.push(child);
    }
    const unlisted = Object.keys(nodes).filter((c) => nodes[c].parentId === id && !listed.includes(c)).sort();
    n.children = listed.concat(unlisted);
    if (node.parentId === null || node.parentId === undefined) delete n.parentId;
    let type = node.nodeType;
    if (type === undefined || type === null || type === "leaf" || (type === "folder" && id === root)) type = "text";
    n.nodeType = type;
    const attrs = {};
    for (const [key, value] of Object.entries(node.attributes || {})) if (value !== null && value !== undefined) attrs[key] = value;
    if (attrs[EDGE_LABEL] === "" || node.parentId === null || node.parentId === undefined) delete attrs[EDGE_LABEL];
    n.attributes = attrs;
    if (n.isBroken === false) delete n.isBroken;
    for (const [key, fallback] of [["collapsed", false], ["details", ""], ["note", ""], ["link", ""], ["text", ""]]) {
      if (n[key] === undefined) n[key] = fallback;
    }
    out.nodes[id] = n;
  }
  for (const [id, link] of Object.entries(state.links || {})) {
    const l = {};
    for (const [key, value] of Object.entries(link)) if (value !== null && value !== undefined) l[key] = value;
    for (const port of ["sourcePort", "targetPort"]) if (l[port] === "auto") delete l[port];
    if (l.attributes) {
      const attrs = {};
      for (const [key, value] of Object.entries(l.attributes)) if (value !== null && value !== undefined) attrs[key] = value;
      if (Object.keys(attrs).length) l.attributes = attrs; else delete l.attributes;
    }
    out.links[id] = l;
  }
  for (const [id, surface] of Object.entries(state.surfaces || {})) {
    const scopeRoot = bare(surface.scopeId);
    if (!nodes[scopeRoot] || !isScopeRoot(scopeRoot)) continue;
    const views = {};
    for (const [nodeId, view] of Object.entries(surface.nodeViews || {})) {
      if (!nodes[nodeId] || !view || typeof view !== "object") continue;
      const clean = {};
      for (const [key, value] of Object.entries(view)) if (value !== null && value !== undefined) clean[key] = value;
      if (Object.keys(clean).length) views[nodeId] = clean;
    }
    out.surfaces[id] = { scope: scopeRoot, kind: surface.kind, layout: surface.layout, surfaceView: surface.surfaceView, nodeViews: views };
  }
  for (const key of Object.keys(state.linearNotesByScope || {}).sort()) {
    const text = state.linearNotesByScope[key];
    if (!text) continue;
    const b = bare(key);
    const target = nodes[b] && isScopeRoot(b) ? b : null;
    if (target !== null && out.linear[target] === undefined) out.linear[target] = text; else out.linear[key] = text;
  }
  for (const [id, ann] of Object.entries(state.annotations || {})) {
    const a = {};
    for (const [key, value] of Object.entries(ann)) if (value !== null && value !== undefined) a[key] = value;
    if (a.scopeId !== undefined && nodes[bare(a.scopeId)] && isScopeRoot(bare(a.scopeId))) a.scopeId = bare(a.scopeId);
    out.annotations[id] = a;
  }
  for (const id of Object.keys(nodes)) {
    if (!isScopeRoot(id)) continue;
    const scope = (state.scopes || {})[`scope:${id}`];
    const primary = scope && scope.primarySurfaceId;
    out.primary[id] = primary && out.surfaces[primary] ? primary : null;
  }
  const skip = new Set(["rootId", "nodes", "links", "surfaces", "linearNotesByScope", "annotations", "scopes", "selectedId", "scopeId", "savedAt"]);
  for (const [key, value] of Object.entries(state)) if (!skip.has(key) && value !== null && value !== undefined) out.top[key] = value;
  return sortKeys(out);
}
function firstDifference(a, b, where = "") {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const found = firstDifference(a[key], b[key], `${where}/${key}`);
      if (found) return found;
    }
  }
  return `${where}: ${String(JSON.stringify(a)).slice(0, 140)} != ${String(JSON.stringify(b)).slice(0, 140)}`;
}

// ---------- random mutations on a plain state ----------
let counter = 0;
const RUN = Date.now().toString(36);
const freshId = (prefix) => `${prefix}_judge_${RUN}_${(counter++).toString(36)}_${Math.floor(rnd() * 1e9).toString(36)}`;
function subtree(state, id, acc = new Set()) {
  acc.add(id);
  for (const child of state.nodes[id].children || []) if (state.nodes[child] && !acc.has(child)) subtree(state, child, acc);
  return acc;
}
function nodeIds(state, filter = () => true) { return Object.keys(state.nodes).sort().filter((id) => filter(state.nodes[id], id)); }
const notAlias = (node) => node.nodeType !== "alias";
const MUTATIONS = {
  editText(state) { const id = pick(nodeIds(state, notAlias)); state.nodes[id].text = `${state.nodes[id].text} ${Math.floor(rnd() * 1000)}`; },
  editDetails(state) { const id = pick(nodeIds(state, notAlias)); state.nodes[id].details = rnd() < 0.2 ? "" : `details ${rnd()}`; },
  editNote(state) { const id = pick(nodeIds(state, notAlias)); state.nodes[id].note = rnd() < 0.3 ? "" : `note ${rnd()}`; },
  toggleCollapsed(state) { const id = pick(nodeIds(state)); state.nodes[id].collapsed = !state.nodes[id].collapsed; },
  setAttribute(state) {
    const id = pick(nodeIds(state)); const node = state.nodes[id]; node.attributes = node.attributes || {};
    const key = pick(["judge:flag", "plain", "m3e:status", EDGE_LABEL, "judge:empty"]);
    if (rnd() < 0.3 && key in node.attributes) delete node.attributes[key];
    else node.attributes[key] = key === "judge:empty" ? "" : `v${Math.floor(rnd() * 50)}`;
  },
  addNode(state) {
    const parent = pick(nodeIds(state, notAlias)); const id = freshId("n");
    state.nodes[id] = { id, parentId: parent, children: [], nodeType: "text", text: `new ${id.slice(-6)}`, collapsed: false, details: "", note: "", attributes: {}, link: "" };
    const kids = state.nodes[parent].children; kids.splice(Math.floor(rnd() * (kids.length + 1)), 0, id);
  },
  addBranch(state) { MUTATIONS.addNode(state); MUTATIONS.addNode(state); MUTATIONS.addNode(state); },
  reorder(state) {
    const parents = nodeIds(state, (n) => (n.children || []).length >= 2); if (!parents.length) return;
    const kids = state.nodes[pick(parents)].children; const from = Math.floor(rnd() * kids.length);
    const [moved] = kids.splice(from, 1); kids.splice(Math.floor(rnd() * (kids.length + 1)), 0, moved);
  },
  move(state) {
    const movable = nodeIds(state, (n, id) => id !== state.rootId && n.parentId); if (!movable.length) return;
    const id = pick(movable); const inside = subtree(state, id);
    const targets = nodeIds(state, (n, other) => !inside.has(other) && notAlias(n)); if (!targets.length) return;
    const target = pick(targets); const old = state.nodes[state.nodes[id].parentId];
    old.children = old.children.filter((c) => c !== id);
    state.nodes[id].parentId = target; const kids = state.nodes[target].children; kids.splice(Math.floor(rnd() * (kids.length + 1)), 0, id);
  },
  deleteSubtree(state) {
    const aliasTargets = new Set(Object.values(state.nodes).map((n) => n.targetNodeId).filter(Boolean));
    const candidates = nodeIds(state, (n, id) => id !== state.rootId && n.parentId && subtree(state, id).size <= 40); if (!candidates.length) return;
    const id = pick(candidates); const gone = subtree(state, id);
    for (const g of gone) if (aliasTargets.has(g)) return;
    const parent = state.nodes[state.nodes[id].parentId]; parent.children = parent.children.filter((c) => c !== id);
    for (const g of gone) delete state.nodes[g];
    for (const [lid, link] of Object.entries(state.links || {})) if (gone.has(link.sourceNodeId) || gone.has(link.targetNodeId)) delete state.links[lid];
    for (const surface of Object.values(state.surfaces || {})) for (const g of gone) if (surface.nodeViews) delete surface.nodeViews[g];
    for (const [sid, surface] of Object.entries(state.surfaces || {})) if (gone.has(bare(surface.scopeId))) delete state.surfaces[sid];
    for (const g of gone) { if (state.scopes) delete state.scopes[`scope:${g}`]; if (state.linearNotesByScope) { delete state.linearNotesByScope[g]; delete state.linearNotesByScope[`scope:${g}`]; } }
    for (const [aid, ann] of Object.entries(state.annotations || {})) if (gone.has(bare(ann.scopeId))) delete state.annotations[aid];
  },
  addLink(state) {
    const ids = nodeIds(state); if (ids.length < 2) return; const id = freshId("l"); state.links = state.links || {};
    state.links[id] = { id, sourceNodeId: pick(ids), targetNodeId: pick(ids), direction: "forward", style: "default", label: rnd() < 0.5 ? "rel" : undefined, relationType: rnd() < 0.5 ? "consist-of" : undefined };
    for (const key of Object.keys(state.links[id])) if (state.links[id][key] === undefined) delete state.links[id][key];
    if (state.links[id].sourceNodeId === state.links[id].targetNodeId) delete state.links[id];
  },
  editLink(state) { const ids = Object.keys(state.links || {}).sort(); if (!ids.length) return; state.links[pick(ids)].label = `l${Math.floor(rnd() * 99)}`; },
  removeLink(state) { const ids = Object.keys(state.links || {}).sort(); if (!ids.length) return; delete state.links[pick(ids)]; },
  linearText(state) {
    const roots = nodeIds(state, (n, id) => id === state.rootId || n.nodeType === "folder"); const id = pick(roots);
    state.linearNotesByScope = state.linearNotesByScope || {}; state.linearNotesByScope[id] = `- line ${rnd()}\n  - child`;
  },
  scopen(state) {
    const candidates = nodeIds(state, (n, id) => id !== state.rootId && n.nodeType === "text" && (n.children || []).length > 0); if (!candidates.length) return;
    state.nodes[pick(candidates)].nodeType = "folder";
  },
  unscopen(state) {
    const candidates = nodeIds(state, (n, id) => id !== state.rootId && n.nodeType === "folder"); if (!candidates.length) return;
    const id = pick(candidates); state.nodes[id].nodeType = "text";
    if (state.scopes) delete state.scopes[`scope:${id}`];
    for (const [sid, surface] of Object.entries(state.surfaces || {})) if (bare(surface.scopeId) === id) delete state.surfaces[sid];
    if (state.linearNotesByScope) { delete state.linearNotesByScope[id]; delete state.linearNotesByScope[`scope:${id}`]; }
    for (const [aid, ann] of Object.entries(state.annotations || {})) if (bare(ann.scopeId) === id) delete state.annotations[aid];
  },
  nodeView(state) {
    const sids = Object.keys(state.surfaces || {}).sort(); if (!sids.length) return; const surface = state.surfaces[pick(sids)];
    surface.nodeViews = surface.nodeViews || {}; surface.nodeViews[pick(nodeIds(state))] = { x: Math.floor(rnd() * 900), y: Math.floor(rnd() * 600) };
  },
  fontScale(state) { state.linearTextFontScale = Math.round((0.8 + rnd()) * 100) / 100; },
};
const WEIGHTS = { editText: 10, editDetails: 5, editNote: 2, toggleCollapsed: 4, setAttribute: 8, addNode: 10, addBranch: 3, reorder: 6, move: 6, deleteSubtree: 4, addLink: 4, editLink: 2, removeLink: 2, linearText: 2, scopen: 2, unscopen: 2, nodeView: 3, fontScale: 1 };
const BAG = Object.entries(WEIGHTS).flatMap(([name, weight]) => Array(weight).fill(name));

// ---------- run ----------
(async () => {
  const restored = JSON.parse(fs.readFileSync(args.restored, "utf8"));
  const records = jsonl.parseSnapshot(fs.readFileSync(args.snapshot, "utf8"));
  const work = path.resolve(args.work);
  fs.mkdirSync(work, { recursive: true });
  const dbPath = path.join(work, "baseline.sqlite");
  const storeDir = path.join(work, "store");
  if (fs.existsSync(dbPath) || fs.existsSync(storeDir)) { console.error("work dir must be empty"); process.exit(2); }
  RecordWorkspaceStore.create(storeDir, records);
  let store = RecordWorkspaceStore.open(storeDir, args.bolt ? { neo4j: { uri: args.bolt } } : {});

  const wanted = Number(args.maps || 3);
  const rows = restored.rows.slice().sort((a, b) => Object.keys(b.state.nodes).length - Object.keys(a.state.nodes).length);
  const chosen = [rows[0], rows[Math.floor(rows.length / 2)], ...rows.slice(1)].filter((row, index, list) => list.indexOf(row) === index).slice(0, wanted);
  if (args.only) { chosen.length = 0; chosen.push(...rows.filter((row) => args.only.split(',').includes(row.id))); }
  const problems = [];
  const report = (text) => { problems.push(text); if (problems.length <= 30) console.log("PROBLEM", text); };
  const stats = { commits: 0, rejected: 0, skipped: 0, compared: 0, byMutation: {}, storeMs: [], sqliteMs: [] };

  for (const row of chosen) {
    const mapId = row.id;
    RapidMvpModel.fromJSON(clone(row.state)).saveToSqlite(dbPath, mapId);
    // both sides must start equal
    const start = firstDifference(normalise(savedMap(dbPath, mapId).state), normalise(store.getMapRow(mapId).state));
    if (start) { report(`${mapId} initial state differs ${start}`); continue; }
    let current = savedMap(dbPath, mapId).state;
    const baseErrors = RapidMvpModel.fromJSON(clone(current)).validate().length;
    const steps = Number(args.steps || 400);
    for (let step = 0; step < steps; step++) {
      const name = pick(BAG);
      const mark = { seed, counter };
      const next = clone(current);
      try { MUTATIONS[name](next); } catch (error) { stats.skipped++; continue; }
      let errors;
      try { errors = RapidMvpModel.fromJSON(clone(next)).validate().length; } catch (error) { stats.skipped++; continue; }
      if (errors > baseErrors) { stats.skipped++; continue; }
      const changes = diffState(current, next);
      if (!changes.length) { stats.skipped++; continue; }
      // The store side replays the same mutation on its own state, as a client that loaded from it would.
      const after = { seed, counter };
      const storeCurrent = store.getMapRow(mapId).state;
      const storeNext = clone(storeCurrent);
      seed = mark.seed; counter = mark.counter;
      try { MUTATIONS[name](storeNext); } catch (error) { report(`${mapId} step ${step} ${name}: mutation failed on the store state ${error.message}`); break; }
      seed = after.seed; counter = after.counter;
      const storeChanges = diffState(storeCurrent, storeNext);
      const commandId = `cmd_judge_${mapId}_${step}_${Math.floor(rnd() * 1e9)}`;
      const command = { commandId, actor: { kind: "system", id: "judge" }, intent: name, changes };
      const storeCommand = { commandId, actor: { kind: "system", id: "judge" }, intent: name, changes: storeChanges };
      let t = performance.now();
      const a = commitMapCommand(dbPath, mapId, clone(command));
      stats.sqliteMs.push(performance.now() - t);
      t = performance.now();
      let b;
      try { b = store.commitMapCommand(mapId, clone(storeCommand), "acct_judge"); } catch (error) { report(`${mapId} step ${step} ${name}: store threw ${error.message}`); break; }
      stats.storeMs.push(performance.now() - t);
      stats.byMutation[name] = (stats.byMutation[name] || 0) + 1;
      if (a.ok !== b.ok) { report(`${mapId} step ${step} ${name}: sqlite ok=${a.ok} (${a.code || ""}) store ok=${b.ok} (${b.code || ""}) ${JSON.stringify((b.conflicts || a.conflicts || []).slice(0, 4))} ${b.message || ""} changes=${JSON.stringify(changes).slice(0, 900)}`); break; }
      if (!a.ok) { stats.rejected++; continue; }
      stats.commits++;
      // idempotent retry must replay on both
      if (step % 25 === 0) {
        const again = store.commitMapCommand(mapId, clone(storeCommand), "acct_judge");
        if (!again.ok || !again.replayed) report(`${mapId} step ${step}: retry not replayed`);
        const changed = clone(storeCommand); changed.changes = changed.changes.slice(); changed.changes.push({ kind: "map-field", key: ["linearPanelWidth"], op: "update", before: {}, after: { value: 1 } });
        const clash = store.commitMapCommand(mapId, changed, "acct_judge");
        if (clash.ok) report(`${mapId} step ${step}: same id with different content was accepted`);
      }
      current = savedMap(dbPath, mapId).state;
      if (step % 10 === 0 || step === steps - 1) {
        stats.compared++;
        const diff = firstDifference(normalise(current), normalise(store.getMapRow(mapId).state));
        if (diff) { report(`${mapId} step ${step} after ${name}: ${diff}`); break; }
      }
    }
    // stale command must conflict on both
    const stale = clone(current); const victim = pick(nodeIds(stale, notAlias)); stale.nodes[victim].text = "stale edit";
    const staleChanges = diffState(current, stale);
    for (const change of staleChanges) if (change.before && "text" in change.before) change.before.text = "something the server never had";
    const staleCommand = { commandId: `cmd_judge_stale_${mapId}`, actor: { kind: "system", id: "judge" }, intent: "stale", changes: staleChanges };
    const sa = commitMapCommand(dbPath, mapId, clone(staleCommand));
    const storeNow = store.getMapRow(mapId).state; const storeStale = clone(storeNow); storeStale.nodes[victim].text = "stale edit";
    const storeStaleChanges = diffState(storeNow, storeStale);
    for (const change of storeStaleChanges) if (change.before && "text" in change.before) change.before.text = "something the server never had";
    const sb = store.commitMapCommand(mapId, { ...clone(staleCommand), changes: storeStaleChanges }, "acct_judge");
    if (sa.ok || sb.ok || sa.code !== sb.code) report(`${mapId} stale command: sqlite ${sa.ok}/${sa.code} store ${sb.ok}/${sb.code}`);
    // whole-map save must land on the same state
    const wholeMark = { seed, counter };
    const whole = clone(savedMap(dbPath, mapId).state); MUTATIONS.addBranch(whole); MUTATIONS.editText(whole);
    RapidMvpModel.fromJSON(clone(whole)).saveToSqlite(dbPath, mapId);
    seed = wholeMark.seed; counter = wholeMark.counter;
    const storeWhole = store.getMapRow(mapId).state; MUTATIONS.addBranch(storeWhole); MUTATIONS.editText(storeWhole);
    const saved = store.saveWholeMap(mapId, storeWhole, "acct_judge", "whole-save");
    if (!saved.ok) report(`${mapId} whole save rejected ${saved.code}`);
    const diff = firstDifference(normalise(savedMap(dbPath, mapId).state), normalise(store.getMapRow(mapId).state));
    if (diff) report(`${mapId} after whole save: ${diff}`);
    console.log(`map ${mapId}: nodes ${Object.keys(row.state.nodes).length}`);
  }

  // ---- journal replay ----
  const before = jsonl.serializeSnapshot(store.records());
  const seqBefore = store.seq();
  await store.flush();
  const engine = store.engineStatus();
  if (args.bolt && (engine.error || engine.appliedSeq !== seqBefore)) report(`engine not caught up: ${JSON.stringify(engine)} seq ${seqBefore}`);
  await store.close();
  store = RecordWorkspaceStore.open(storeDir, args.bolt ? { neo4j: { uri: args.bolt } } : {});
  const after = jsonl.serializeSnapshot(store.records());
  if (before !== after) report("records differ after reopening from snapshot + journal");
  if (store.seq() !== seqBefore) report(`seq differs after reopen ${store.seq()} vs ${seqBefore}`);

  // ---- derived engine ----
  if (args.bolt) {
    const neo4j = require(path.resolve("node_modules/neo4j-driver"));
    const neo = dist("node/neo4j_store/store.js");
    const driver = neo4j.driver(args.bolt);
    const dumped = await neo.dump(driver);
    await driver.close();
    const text = jsonl.serializeSnapshot(dumped);
    if (text !== after) report(`Neo4j dump differs from the store records (${text.length} vs ${after.length} bytes)`);
  }
  await store.close();

  const median = (list) => (list.length ? list.slice().sort((x, y) => x - y)[Math.floor(list.length / 2)] : 0);
  const p95 = (list) => (list.length ? list.slice().sort((x, y) => x - y)[Math.floor(list.length * 0.95)] : 0);
  console.log(JSON.stringify({
    problems: problems.length, commits: stats.commits, rejected: stats.rejected, skipped: stats.skipped, compared: stats.compared,
    seq: seqBefore, bolt: Boolean(args.bolt), byMutation: stats.byMutation,
    storeMs: { median: +median(stats.storeMs).toFixed(1), p95: +p95(stats.storeMs).toFixed(1), max: +Math.max(0, ...stats.storeMs).toFixed(1) },
    sqliteMs: { median: +median(stats.sqliteMs).toFixed(1), p95: +p95(stats.sqliteMs).toFixed(1), max: +Math.max(0, ...stats.sqliteMs).toFixed(1) },
  }, null, 1));
  process.exit(problems.length ? 1 : 0);
})().catch((error) => { console.error("JUDGE CRASHED", error); process.exit(3); });
