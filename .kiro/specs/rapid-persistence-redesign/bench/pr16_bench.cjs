'use strict';
// PR16: apply one deterministic Command sequence to the draft record model on SQLite and Neo4j,
// plus today's whole-JSON save as the baseline, and compare latency, reads and storage.
// Validity rule (fixed before running): every engine's final state must equal the reference model.
//
// node pr16_bench.cjs --source <sqlite copy> --map <mapId> --work <dir> --beta <beta dir> --deps <dir>
//   [--scale 1] [--commands 2000] [--whole-json-commands 2000] [--seed 1]
//   [--engines whole-json,sqlite-delete,sqlite-wal,neo4j] [--neo4j bolt://127.0.0.1:17687] [--neo4j-data <dir>]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? acc.concat([[a.slice(2), all[i + 1]]]) : acc), []));
const betaRequire = createRequire(path.join(args.beta, 'package.json'));
const Database = betaRequire('better-sqlite3');
const neo4j = betaRequire('neo4j-driver');
const { generateKeyBetween, generateNKeysBetween } = createRequire(path.join(args.deps, 'package.json'))('fractional-indexing');
const SCALE = Number(args.scale || 1);
const COMMANDS = Number(args.commands || 2000);
const WHOLE_JSON_COMMANDS = Number(args['whole-json-commands'] || COMMANDS);
const ENGINES = (args.engines || 'whole-json,sqlite-delete,sqlite-wal,neo4j').split(',');
const MAP = 'bench';
fs.mkdirSync(args.work, { recursive: true });

// ---------- canonical helpers ----------
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const stable = (v) => JSON.stringify(sortKeys(v));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
function nodeFields(n) { const { id, parentId, children, attributes, text, nodeType, ...rest } = n; return stable(rest); }
function linkFields(l) { const { id, sourceNodeId, targetNodeId, attributes, ...rest } = l; return stable(rest); }
const now = () => Number(process.hrtime.bigint()) / 1e6;
function pct(xs, p) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : null; }
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

// ---------- source state (and optional synthetic scale-up) ----------
function loadState() {
  const db = new Database(args.source, { readonly: true });
  const row = db.prepare('SELECT state_json FROM maps WHERE id = ?').get(args.map);
  db.close();
  const state = JSON.parse(row.state_json);
  state.links = state.links || {};
  state.linearNotesByScope = state.linearNotesByScope || {};
  if (SCALE > 1) {
    const root = state.nodes[state.rootId];
    const originals = Object.values(state.nodes).filter((n) => n.id !== state.rootId);
    const links = Object.values(state.links);
    for (let c = 1; c < SCALE; c += 1) {
      const sfx = `~c${c}`;
      for (const n of originals) {
        const copy = JSON.parse(JSON.stringify(n));
        copy.id = n.id + sfx;
        copy.parentId = n.parentId === state.rootId ? state.rootId : n.parentId + sfx;
        copy.children = (n.children || []).map((x) => x + sfx);
        state.nodes[copy.id] = copy;
      }
      root.children.push(...state.nodes[state.rootId].children.filter((x) => !x.includes('~c')).map((x) => x + sfx));
      for (const l of links) { const copy = JSON.parse(JSON.stringify(l)); copy.id = l.id + sfx; copy.sourceNodeId += sfx; copy.targetNodeId += sfx; state.links[copy.id] = copy; }
    }
    root.children = [...new Set(root.children)];
  }
  return state;
}

// ---------- reference record model ----------
class Model {
  constructor() { this.nodes = new Map(); this.edges = new Map(); this.kids = new Map(); this.attrs = new Map(); this.links = new Map(); this.linear = new Map(); this.ids = []; this.pos = new Map(); this.rootId = null; }
  static fromState(state) {
    const m = new Model();
    m.rootId = state.rootId;
    for (const n of Object.values(state.nodes)) {
      m.addNodeRec({ id: n.id, nodeType: n.nodeType ?? null, text: n.text ?? null, fields: nodeFields(n) });
      for (const [k, v] of Object.entries(n.attributes || {})) m.attrs.set(`n:${n.id}\u0000${k}`, JSON.stringify(v));
    }
    for (const n of Object.values(state.nodes)) {
      const kids = n.children || [];
      const keys = generateNKeysBetween(null, null, kids.length);
      kids.forEach((c, i) => m.setEdge(c, n.id, keys[i]));
    }
    for (const l of Object.values(state.links)) {
      m.links.set(l.id, { id: l.id, source: l.sourceNodeId, target: l.targetNodeId, fields: linkFields(l) });
      for (const [k, v] of Object.entries(l.attributes || {})) m.attrs.set(`l:${l.id}\u0000${k}`, JSON.stringify(v));
    }
    for (const [k, v] of Object.entries(state.linearNotesByScope)) m.linear.set(k, v);
    return m;
  }
  addNodeRec(rec) { this.nodes.set(rec.id, rec); this.pos.set(rec.id, this.ids.length); this.ids.push(rec.id); }
  dropNodeRec(id) { const i = this.pos.get(id); const last = this.ids.pop(); if (last !== id) { this.ids[i] = last; this.pos.set(last, i); } this.pos.delete(id); this.nodes.delete(id); }
  setEdge(child, parent, key) {
    const old = this.edges.get(child);
    if (old) { const arr = this.kids.get(old.parent); arr.splice(arr.indexOf(child), 1); }
    this.edges.set(child, { parent, key });
    const arr = this.kids.get(parent) || []; this.kids.set(parent, arr);
    let lo = 0, hi = arr.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; const mk = this.edges.get(arr[mid]).key; if (mk < key || (mk === key && arr[mid] < child)) lo = mid + 1; else hi = mid; }
    arr.splice(lo, 0, child);
  }
  children(id) { return this.kids.get(id) || []; }
  lastKey(parent) { const a = this.children(parent); return a.length ? this.edges.get(a[a.length - 1]).key : null; }
  nextKey(id) { const e = this.edges.get(id); const a = this.children(e.parent); const i = a.indexOf(id); return i + 1 < a.length ? this.edges.get(a[i + 1]).key : null; }
  prevKeyExcluding(id, exclude) { const e = this.edges.get(id); const a = this.children(e.parent).filter((x) => x !== exclude); const i = a.indexOf(id); return i > 0 ? this.edges.get(a[i - 1]).key : null; }
  subtree(id) { const out = []; const st = [id]; while (st.length) { const x = st.pop(); out.push(x); st.push(...this.children(x)); } return out; }
  isAncestorOrSelf(anc, id) { let x = id; while (x) { if (x === anc) return true; x = this.edges.get(x)?.parent; } return false; }
  apply(cmd) {
    const c = cmd;
    switch (c.intent) {
      case 'rename': this.nodes.get(c.nodeId).text = c.text; break;
      case 'set-attribute': this.attrs.set(`${c.owner}\u0000${c.key}`, c.valueJson); break;
      case 'unset-attribute': this.attrs.delete(`${c.owner}\u0000${c.key}`); break;
      case 'add-child': this.addNodeRec({ id: c.nodeId, nodeType: 'text', text: c.text, fields: '{}' }); this.setEdge(c.nodeId, c.parentId, generateKeyBetween(this.lastKey(c.parentId), null)); break;
      case 'add-sibling': { const e = this.edges.get(c.afterId); const key = generateKeyBetween(e.key, this.nextKey(c.afterId)); this.addNodeRec({ id: c.nodeId, nodeType: 'text', text: c.text, fields: '{}' }); this.setEdge(c.nodeId, e.parent, key); break; }
      case 'reorder': { const y = this.edges.get(c.beforeId); const key = generateKeyBetween(this.prevKeyExcluding(c.beforeId, c.nodeId), y.key); this.setEdge(c.nodeId, y.parent, key); break; }
      case 'reparent': this.setEdge(c.nodeId, c.newParentId, generateKeyBetween(this.lastKey(c.newParentId), null)); break;
      case 'delete': {
        const ids = this.subtree(c.nodeId); const set = new Set(ids);
        const parent = this.edges.get(c.nodeId).parent; const arr = this.kids.get(parent); arr.splice(arr.indexOf(c.nodeId), 1);
        for (const [lid, l] of this.links) if (set.has(l.source) || set.has(l.target)) { this.links.delete(lid); for (const k of [...this.attrs.keys()]) if (k.startsWith(`l:${lid}\u0000`)) this.attrs.delete(k); }
        for (const id of ids) { this.dropNodeRec(id); this.edges.delete(id); this.kids.delete(id); this.linear.delete(id); for (const k of [...this.attrs.keys()]) if (k.startsWith(`n:${id}\u0000`)) this.attrs.delete(k); }
        break;
      }
      case 'link-create': this.links.set(c.linkId, { id: c.linkId, source: c.sourceId, target: c.targetId, fields: stable({ relationType: c.relationType }) }); break;
      case 'linear-set': this.linear.set(c.scopeRootId, c.text); break;
      case 'import-subtree': {
        const keys = batchKeys(c, this.lastKey(c.parentId));
        for (const x of c.nodes) { this.addNodeRec({ id: x.id, nodeType: 'text', text: x.text, fields: '{}' }); this.setEdge(x.id, x.parent, keys.get(x.id)); }
        break;
      }
      default: throw new Error(`unknown intent ${c.intent}`);
    }
  }
  exportRecords() {
    return {
      nodes: [...this.nodes.values()].map((n) => [n.id, n.nodeType, n.text, n.fields]),
      edges: [...this.edges.entries()].map(([c, e]) => [c, e.parent, e.key]),
      attrs: [...this.attrs.entries()].map(([k, v]) => [...k.split('\u0000'), v]),
      links: [...this.links.values()].map((l) => [l.id, l.source, l.target, l.fields]),
      linear: [...this.linear.entries()],
    };
  }
}
function batchKeys(c, lastKeyOfParent) {
  const keys = new Map(); keys.set(c.nodes[0].id, generateKeyBetween(lastKeyOfParent, null));
  const byParent = new Map(); for (const x of c.nodes.slice(1)) { const a = byParent.get(x.parent) || []; a.push(x.id); byParent.set(x.parent, a); }
  for (const a of byParent.values()) { const ks = generateNKeysBetween(null, null, a.length); a.forEach((id, i) => keys.set(id, ks[i])); }
  return keys;
}

// Records export → two canonical forms: with keys (records) and with sibling index (structure).
function canonical(rec) {
  const sortRows = (rows) => rows.map((r) => JSON.stringify(r)).sort();
  const byParent = new Map();
  for (const [c, p, k] of rec.edges) { const a = byParent.get(p) || []; a.push([k, c]); byParent.set(p, a); }
  const structEdges = [];
  for (const [p, a] of byParent) { a.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : 1)); a.forEach(([, c], i) => structEdges.push([c, p, i])); }
  const common = { nodes: sortRows(rec.nodes), attrs: sortRows(rec.attrs), links: sortRows(rec.links), linear: sortRows(rec.linear) };
  return { records: sha(JSON.stringify({ ...common, edges: sortRows(rec.edges) })), structure: sha(JSON.stringify({ ...common, edges: sortRows(structEdges) })) };
}
function structureFromState(state) {
  const edges = [];
  for (const n of Object.values(state.nodes)) (n.children || []).forEach((c, i) => edges.push([c, n.id, i]));
  const attrs = [];
  for (const n of Object.values(state.nodes)) for (const [k, v] of Object.entries(n.attributes || {})) attrs.push([`n:${n.id}`, k, JSON.stringify(v)]);
  for (const l of Object.values(state.links)) for (const [k, v] of Object.entries(l.attributes || {})) attrs.push([`l:${l.id}`, k, JSON.stringify(v)]);
  const sortRows = (rows) => rows.map((r) => JSON.stringify(r)).sort();
  return sha(JSON.stringify({
    nodes: sortRows(Object.values(state.nodes).map((n) => [n.id, n.nodeType ?? null, n.text ?? null, nodeFields(n)])),
    attrs: sortRows(attrs),
    links: sortRows(Object.values(state.links).map((l) => [l.id, l.sourceNodeId, l.targetNodeId, linkFields(l)])),
    linear: sortRows(Object.entries(state.linearNotesByScope)),
    edges: sortRows(edges),
  }));
}

// ---------- deterministic Command sequence ----------
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const MIX = [['rename', 30], ['set-attribute', 15], ['unset-attribute', 5], ['add-child', 15], ['add-sibling', 10], ['reorder', 5], ['reparent', 8], ['delete', 5], ['link-create', 4], ['linear-set', 2], ['import-subtree', 1]];
function generate(model, count, seed) {
  const rnd = mulberry32(seed); const pick = (a) => a[Math.floor(rnd() * a.length)];
  const total = MIX.reduce((s, [, w]) => s + w, 0);
  const anyNode = () => model.ids[Math.floor(rnd() * model.ids.length)];
  const nonRoot = () => { let x; do x = anyNode(); while (x === model.rootId); return x; };
  const container = () => { let x; do x = anyNode(); while (model.nodes.get(x).nodeType === 'alias'); return x; };
  const cmds = [];
  for (let i = 0; cmds.length < count; i += 1) {
    let r = rnd() * total, intent = MIX[0][0];
    for (const [k, w] of MIX) { if ((r -= w) < 0) { intent = k; break; } }
    let c = null;
    if (intent === 'rename') c = { nodeId: nonRoot(), text: `renamed ${i}` };
    else if (intent === 'set-attribute') c = { owner: `n:${nonRoot()}`, key: pick(['m3e:status', 'bench:k1', 'bench:k2']), valueJson: JSON.stringify(rnd() < 0.5 ? `v${i}` : i) };
    else if (intent === 'unset-attribute') { const keys = [...model.attrs.keys()]; if (!keys.length) continue; const [owner, key] = pick(keys).split('\u0000'); c = { owner, key }; }
    else if (intent === 'add-child') c = { parentId: container(), nodeId: `bench-${i}`, text: `child ${i}` };
    else if (intent === 'add-sibling') c = { afterId: nonRoot(), nodeId: `bench-${i}`, text: `sibling ${i}` };
    else if (intent === 'reorder') { const n = nonRoot(); const sib = model.children(model.edges.get(n).parent).filter((x) => x !== n); if (!sib.length) continue; c = { nodeId: n, beforeId: pick(sib) }; }
    else if (intent === 'reparent') {
      let n = null; for (let t = 0; t < 20 && !n; t += 1) { const x = nonRoot(); if (model.subtree(x).length <= 200) n = x; }
      if (!n) continue; let p = null;
      for (let t = 0; t < 20 && !p; t += 1) { const y = container(); if (!model.isAncestorOrSelf(n, y) && y !== model.edges.get(n).parent) p = y; }
      if (!p) continue; c = { nodeId: n, newParentId: p };
    } else if (intent === 'delete') { let n = null; for (let t = 0; t < 20 && !n; t += 1) { const x = nonRoot(); if (model.subtree(x).length <= 30) n = x; } if (!n) continue; c = { nodeId: n }; }
    else if (intent === 'link-create') { const s = container(); let t = container(); if (t === s) continue; c = { linkId: `bench-link-${i}`, sourceId: s, targetId: t, relationType: 'bench' }; }
    else if (intent === 'linear-set') { const keys = [...model.linear.keys()]; const k = keys.length && rnd() < 0.7 ? pick(keys) : container(); c = { scopeRootId: k, text: `${'x'.repeat(20000)} ${i}` }; }
    else if (intent === 'import-subtree') {
      const parentId = container(); const nodes = [{ id: `bench-${i}-0`, parent: parentId, text: `import ${i}` }];
      for (let j = 1; j < 25; j += 1) nodes.push({ id: `bench-${i}-${j}`, parent: nodes[Math.floor(rnd() * j)].id, text: `import ${i}.${j}` });
      c = { parentId, nodes };
    }
    if (!c) continue;
    c.intent = intent; c.commandId = `cmd-${seed}-${cmds.length}`;
    model.apply(c); cmds.push(c);
  }
  return cmds;
}

// ---------- engine: today's whole-JSON save (baseline) ----------
function applyToState(state, c) {
  const N = state.nodes;
  const detach = (id) => { const p = N[N[id].parentId]; p.children.splice(p.children.indexOf(id), 1); };
  const owner = (o) => (o.startsWith('n:') ? N[o.slice(2)] : state.links[o.slice(2)]);
  switch (c.intent) {
    case 'rename': N[c.nodeId].text = c.text; break;
    case 'set-attribute': { const o = owner(c.owner); o.attributes = o.attributes || {}; o.attributes[c.key] = JSON.parse(c.valueJson); break; }
    case 'unset-attribute': { const o = owner(c.owner); delete o.attributes[c.key]; break; }
    case 'add-child': N[c.nodeId] = { id: c.nodeId, parentId: c.parentId, children: [], text: c.text, nodeType: 'text' }; N[c.parentId].children.push(c.nodeId); break;
    case 'add-sibling': { const p = N[N[c.afterId].parentId]; N[c.nodeId] = { id: c.nodeId, parentId: p.id, children: [], text: c.text, nodeType: 'text' }; p.children.splice(p.children.indexOf(c.afterId) + 1, 0, c.nodeId); break; }
    case 'reorder': { detach(c.nodeId); const p = N[N[c.beforeId].parentId]; p.children.splice(p.children.indexOf(c.beforeId), 0, c.nodeId); break; }
    case 'reparent': detach(c.nodeId); N[c.nodeId].parentId = c.newParentId; N[c.newParentId].children.push(c.nodeId); break;
    case 'delete': {
      const ids = []; const st = [c.nodeId]; while (st.length) { const x = st.pop(); ids.push(x); st.push(...N[x].children); }
      const set = new Set(ids); detach(c.nodeId);
      for (const [lid, l] of Object.entries(state.links)) if (set.has(l.sourceNodeId) || set.has(l.targetNodeId)) delete state.links[lid];
      for (const id of ids) { delete N[id]; delete state.linearNotesByScope[id]; }
      break;
    }
    case 'link-create': state.links[c.linkId] = { id: c.linkId, sourceNodeId: c.sourceId, targetNodeId: c.targetId, relationType: c.relationType }; break;
    case 'linear-set': state.linearNotesByScope[c.scopeRootId] = c.text; break;
    case 'import-subtree': for (const x of c.nodes) { N[x.id] = { id: x.id, parentId: x.parent, children: [], text: x.text, nodeType: 'text' }; N[x.parent].children.push(x.id); } break;
    default: throw new Error(c.intent);
  }
}
function wholeJsonEngine(state) {
  const file = path.join(args.work, 'whole-json.sqlite'); fs.rmSync(file, { force: true });
  const db = new Database(file); db.pragma('journal_mode = DELETE'); db.pragma('synchronous = FULL');
  db.exec('CREATE TABLE maps (id TEXT PRIMARY KEY, saved_at TEXT NOT NULL, state_json TEXT NOT NULL)');
  const t0 = now(); db.prepare('INSERT INTO maps VALUES (?, ?, ?)').run(MAP, new Date().toISOString(), JSON.stringify(state)); const importMs = now() - t0;
  const get = db.prepare('SELECT state_json FROM maps WHERE id = ?'); const put = db.prepare('UPDATE maps SET state_json = ?, saved_at = ? WHERE id = ?');
  const load = () => JSON.parse(get.get(MAP).state_json);
  return {
    name: 'whole-json', importMs, file,
    commit(c) { const s = load(); applyToState(s, c); put.run(JSON.stringify(s), new Date().toISOString(), MAP); },
    reads: {
      fullLoad: () => load(),
      subtree: (id) => { const s = load(); const out = []; const st = [id]; while (st.length) { const x = st.pop(); out.push(x); st.push(...s.nodes[x].children); } return out.length; },
      children: (id) => load().nodes[id].children.length,
      ancestors: (id) => { const s = load(); let n = 0, x = id; while (x) { n += 1; x = s.nodes[x].parentId; } return n; },
      neighborhood: (id) => { const s = load(); const adj = new Map(); const add = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); };
        for (const n of Object.values(s.nodes)) if (n.parentId) { add(n.id, n.parentId); add(n.parentId, n.id); }
        for (const l of Object.values(s.links)) { add(l.sourceNodeId, l.targetNodeId); add(l.targetNodeId, l.sourceNodeId); }
        let frontier = [id]; const seen = new Set([id]); for (let d = 0; d < 3; d += 1) { const next = []; for (const x of frontier) for (const y of adj.get(x) || []) if (!seen.has(y)) { seen.add(y); next.push(y); } frontier = next; } return seen.size - 1; },
    },
    exportStructure: () => structureFromState(load()),
    close: () => db.close(),
    sizeBytes: () => fs.statSync(file).size,
  };
}

// ---------- engine: draft record model on SQLite (OP43) ----------
function sqliteEngine(model, mode) {
  const file = path.join(args.work, `records-${mode}.sqlite`); for (const f of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
  const db = new Database(file);
  if (mode === 'wal') { db.pragma('journal_mode = WAL'); db.pragma('synchronous = NORMAL'); } else { db.pragma('journal_mode = DELETE'); db.pragma('synchronous = FULL'); }
  db.exec(`
    CREATE TABLE map (map_id TEXT PRIMARY KEY, head_seq INTEGER NOT NULL) WITHOUT ROWID;
    CREATE TABLE node (map_id TEXT, node_id TEXT, node_type TEXT, text TEXT, fields_json TEXT, rev INTEGER, PRIMARY KEY (map_id, node_id)) WITHOUT ROWID;
    CREATE TABLE edge (map_id TEXT, child_id TEXT, parent_id TEXT, order_key TEXT COLLATE BINARY, rev INTEGER, PRIMARY KEY (map_id, child_id)) WITHOUT ROWID;
    CREATE INDEX edge_parent ON edge (map_id, parent_id, order_key, child_id);
    CREATE TABLE attribute (map_id TEXT, owner_id TEXT, key TEXT, value_json TEXT, rev INTEGER, PRIMARY KEY (map_id, owner_id, key)) WITHOUT ROWID;
    CREATE TABLE graph_link (map_id TEXT, link_id TEXT, source_id TEXT, target_id TEXT, fields_json TEXT, rev INTEGER, PRIMARY KEY (map_id, link_id)) WITHOUT ROWID;
    CREATE INDEX graph_link_source ON graph_link (map_id, source_id);
    CREATE INDEX graph_link_target ON graph_link (map_id, target_id);
    CREATE TABLE linear_text (map_id TEXT, scope_root_id TEXT, text TEXT, rev INTEGER, PRIMARY KEY (map_id, scope_root_id)) WITHOUT ROWID;
    CREATE TABLE journal (map_id TEXT, seq INTEGER, command_id TEXT, intent TEXT, effects_json TEXT, committed_at TEXT, PRIMARY KEY (map_id, seq), UNIQUE (map_id, command_id)) WITHOUT ROWID;`);
  const t0 = now();
  db.transaction(() => {
    db.prepare('INSERT INTO map VALUES (?, 0)').run(MAP);
    const insN = db.prepare('INSERT INTO node VALUES (?, ?, ?, ?, ?, 0)'); for (const n of model.nodes.values()) insN.run(MAP, n.id, n.nodeType, n.text, n.fields);
    const insE = db.prepare('INSERT INTO edge VALUES (?, ?, ?, ?, 0)'); for (const [c, e] of model.edges) insE.run(MAP, c, e.parent, e.key);
    const insA = db.prepare('INSERT INTO attribute VALUES (?, ?, ?, ?, 0)'); for (const [k, v] of model.attrs) { const [o, key] = k.split('\u0000'); insA.run(MAP, o, key, v); }
    const insL = db.prepare('INSERT INTO graph_link VALUES (?, ?, ?, ?, ?, 0)'); for (const l of model.links.values()) insL.run(MAP, l.id, l.source, l.target, l.fields);
    const insT = db.prepare('INSERT INTO linear_text VALUES (?, ?, ?, 0)'); for (const [k, v] of model.linear) insT.run(MAP, k, v);
  })();
  const importMs = now() - t0;
  const q = (sql) => db.prepare(sql);
  const S = {
    seen: q('SELECT seq FROM journal WHERE map_id = ? AND command_id = ?'), bump: q('UPDATE map SET head_seq = head_seq + 1 WHERE map_id = ? RETURNING head_seq AS seq'),
    journal: q('INSERT INTO journal VALUES (?, ?, ?, ?, ?, ?)'),
    node: q('SELECT node_type AS nodeType, text, fields_json AS fields, rev FROM node WHERE map_id = ? AND node_id = ?'),
    setText: q('UPDATE node SET text = ?, rev = ? WHERE map_id = ? AND node_id = ?'),
    attr: q('SELECT value_json AS v FROM attribute WHERE map_id = ? AND owner_id = ? AND key = ?'),
    putAttr: q('INSERT OR REPLACE INTO attribute VALUES (?, ?, ?, ?, ?)'), delAttr: q('DELETE FROM attribute WHERE map_id = ? AND owner_id = ? AND key = ?'),
    ownerAttrs: q('SELECT key, value_json AS v FROM attribute WHERE map_id = ? AND owner_id = ?'), delOwnerAttrs: q('DELETE FROM attribute WHERE map_id = ? AND owner_id = ?'),
    edge: q('SELECT parent_id AS parent, order_key AS key FROM edge WHERE map_id = ? AND child_id = ?'),
    lastKey: q('SELECT order_key AS key FROM edge WHERE map_id = ? AND parent_id = ? ORDER BY order_key DESC, child_id DESC LIMIT 1'),
    nextKey: q('SELECT order_key AS key FROM edge WHERE map_id = ? AND parent_id = ? AND order_key > ? ORDER BY order_key, child_id LIMIT 1'),
    prevKeyEx: q('SELECT order_key AS key FROM edge WHERE map_id = ? AND parent_id = ? AND order_key < ? AND child_id <> ? ORDER BY order_key DESC, child_id DESC LIMIT 1'),
    insNode: q('INSERT INTO node VALUES (?, ?, ?, ?, ?, ?)'), insEdge: q('INSERT INTO edge VALUES (?, ?, ?, ?, ?)'),
    moveEdge: q('UPDATE edge SET parent_id = ?, order_key = ?, rev = ? WHERE map_id = ? AND child_id = ?'),
    isAncestor: q(`WITH RECURSIVE anc(id) AS (SELECT ? UNION ALL SELECT e.parent_id FROM anc CROSS JOIN edge e ON e.map_id = ? AND e.child_id = anc.id) SELECT 1 AS hit FROM anc WHERE id = ? LIMIT 1`),
    subtree: q(`WITH RECURSIVE sub(id) AS (SELECT ? UNION ALL SELECT e.child_id FROM sub CROSS JOIN edge e ON e.map_id = ? AND e.parent_id = sub.id) SELECT id FROM sub`),
    linksOf: q('SELECT link_id AS id, source_id AS source, target_id AS target, fields_json AS fields FROM graph_link WHERE map_id = ? AND (source_id = ? OR target_id = ?)'),
    delLink: q('DELETE FROM graph_link WHERE map_id = ? AND link_id = ?'), insLink: q('INSERT INTO graph_link VALUES (?, ?, ?, ?, ?, ?)'),
    delNode: q('DELETE FROM node WHERE map_id = ? AND node_id = ?'), delEdge: q('DELETE FROM edge WHERE map_id = ? AND child_id = ?'),
    linear: q('SELECT text FROM linear_text WHERE map_id = ? AND scope_root_id = ?'), putLinear: q('INSERT OR REPLACE INTO linear_text VALUES (?, ?, ?, ?)'),
    delLinear: q('DELETE FROM linear_text WHERE map_id = ? AND scope_root_id = ?'),
  };
  const commit = db.transaction((c) => {
    if (S.seen.get(MAP, c.commandId)) return;
    const seq = S.bump.get(MAP).seq; const fx = [];
    switch (c.intent) {
      case 'rename': { const n = S.node.get(MAP, c.nodeId); S.setText.run(c.text, seq, MAP, c.nodeId); fx.push(['node', c.nodeId, 'update', n.rev, { text: n.text }, { text: c.text }]); break; }
      case 'set-attribute': { const [o, k] = [c.owner, c.key]; const old = S.attr.get(MAP, o, k); S.putAttr.run(MAP, o, k, c.valueJson, seq); fx.push(['attribute', `${o}/${k}`, old ? 'update' : 'create', null, old?.v ?? null, c.valueJson]); break; }
      case 'unset-attribute': { const old = S.attr.get(MAP, c.owner, c.key); S.delAttr.run(MAP, c.owner, c.key); fx.push(['attribute', `${c.owner}/${c.key}`, 'delete', null, old?.v ?? null, null]); break; }
      case 'add-child': case 'add-sibling': {
        let parent, key;
        if (c.intent === 'add-child') { const p = S.node.get(MAP, c.parentId); if (!p || p.nodeType === 'alias') throw new Error('invalid parent'); parent = c.parentId; key = generateKeyBetween(S.lastKey.get(MAP, parent)?.key ?? null, null); }
        else { const e = S.edge.get(MAP, c.afterId); parent = e.parent; key = generateKeyBetween(e.key, S.nextKey.get(MAP, parent, e.key)?.key ?? null); }
        S.insNode.run(MAP, c.nodeId, 'text', c.text, '{}', seq); S.insEdge.run(MAP, c.nodeId, parent, key, seq);
        fx.push(['node', c.nodeId, 'create', null, null, { text: c.text }], ['edge', c.nodeId, 'create', null, null, { parent, key }]); break;
      }
      case 'reorder': { const y = S.edge.get(MAP, c.beforeId); const old = S.edge.get(MAP, c.nodeId); const key = generateKeyBetween(S.prevKeyEx.get(MAP, y.parent, y.key, c.nodeId)?.key ?? null, y.key); S.moveEdge.run(y.parent, key, seq, MAP, c.nodeId); fx.push(['edge', c.nodeId, 'update', null, old, { parent: y.parent, key }]); break; }
      case 'reparent': {
        if (S.isAncestor.get(c.newParentId, MAP, c.nodeId)) throw new Error('cycle');
        const old = S.edge.get(MAP, c.nodeId); const key = generateKeyBetween(S.lastKey.get(MAP, c.newParentId)?.key ?? null, null);
        S.moveEdge.run(c.newParentId, key, seq, MAP, c.nodeId); fx.push(['edge', c.nodeId, 'update', null, old, { parent: c.newParentId, key }]); break;
      }
      case 'delete': {
        const ids = S.subtree.all(c.nodeId, MAP).map((r) => r.id); const doneLinks = new Set();
        for (const id of ids) {
          for (const l of S.linksOf.all(MAP, id, id)) { if (doneLinks.has(l.id)) continue; doneLinks.add(l.id); fx.push(['graph_link', l.id, 'delete', null, l, null], ['attributes', `l:${l.id}`, 'delete', null, S.ownerAttrs.all(MAP, `l:${l.id}`), null]); S.delLink.run(MAP, l.id); S.delOwnerAttrs.run(MAP, `l:${l.id}`); }
          fx.push(['node', id, 'delete', null, S.node.get(MAP, id), null], ['edge', id, 'delete', null, S.edge.get(MAP, id), null], ['attributes', `n:${id}`, 'delete', null, S.ownerAttrs.all(MAP, `n:${id}`), null]);
          const lt = S.linear.get(MAP, id); if (lt) fx.push(['linear_text', id, 'delete', null, lt.text, null]);
          S.delNode.run(MAP, id); S.delEdge.run(MAP, id); S.delOwnerAttrs.run(MAP, `n:${id}`); S.delLinear.run(MAP, id);
        }
        break;
      }
      case 'link-create': { if (!S.node.get(MAP, c.sourceId) || !S.node.get(MAP, c.targetId)) throw new Error('endpoint'); const fields = stable({ relationType: c.relationType }); S.insLink.run(MAP, c.linkId, c.sourceId, c.targetId, fields, seq); fx.push(['graph_link', c.linkId, 'create', null, null, { source: c.sourceId, target: c.targetId, fields }]); break; }
      case 'linear-set': { const old = S.linear.get(MAP, c.scopeRootId); S.putLinear.run(MAP, c.scopeRootId, c.text, seq); fx.push(['linear_text', c.scopeRootId, old ? 'update' : 'create', null, old?.text ?? null, c.text]); break; }
      case 'import-subtree': {
        const keys = batchKeys(c, S.lastKey.get(MAP, c.parentId)?.key ?? null);
        for (const x of c.nodes) { S.insNode.run(MAP, x.id, 'text', x.text, '{}', seq); S.insEdge.run(MAP, x.id, x.parent, keys.get(x.id), seq); fx.push(['node', x.id, 'create', null, null, { text: x.text }], ['edge', x.id, 'create', null, null, { parent: x.parent, key: keys.get(x.id) }]); }
        break;
      }
      default: throw new Error(c.intent);
    }
    S.journal.run(MAP, seq, c.commandId, c.intent, JSON.stringify(fx), new Date().toISOString());
  });
  const exportRecords = () => ({
    nodes: q('SELECT node_id, node_type, text, fields_json FROM node WHERE map_id = ?').raw().all(MAP),
    edges: q('SELECT child_id, parent_id, order_key FROM edge WHERE map_id = ?').raw().all(MAP),
    attrs: q('SELECT owner_id, key, value_json FROM attribute WHERE map_id = ?').raw().all(MAP),
    links: q('SELECT link_id, source_id, target_id, fields_json FROM graph_link WHERE map_id = ?').raw().all(MAP),
    linear: q('SELECT scope_root_id, text FROM linear_text WHERE map_id = ?').raw().all(MAP),
  });
  const R = {
    children: q('SELECT child_id FROM edge WHERE map_id = ? AND parent_id = ? ORDER BY order_key, child_id'),
    ancestors: q(`WITH RECURSIVE anc(id) AS (SELECT ? UNION ALL SELECT e.parent_id FROM anc CROSS JOIN edge e ON e.map_id = ? AND e.child_id = anc.id) SELECT count(*) AS n FROM anc`),
    // SQLite >= 3.41 picks edge as the outer loop unless CROSS JOIN fixes the order (research-engines.md 1).
    neighborhood: q(`WITH RECURSIVE walk(id, d) AS (SELECT $start, 0
        UNION SELECT e.parent_id, w.d + 1 FROM walk w CROSS JOIN edge e ON e.map_id = $m AND e.child_id = w.id WHERE w.d < 3
        UNION SELECT e.child_id, w.d + 1 FROM walk w CROSS JOIN edge e ON e.map_id = $m AND e.parent_id = w.id WHERE w.d < 3
        UNION SELECT g.target_id, w.d + 1 FROM walk w CROSS JOIN graph_link g ON g.map_id = $m AND g.source_id = w.id WHERE w.d < 3
        UNION SELECT g.source_id, w.d + 1 FROM walk w CROSS JOIN graph_link g ON g.map_id = $m AND g.target_id = w.id WHERE w.d < 3)
      SELECT count(DISTINCT id) - 1 AS n FROM walk`),
  };
  return {
    name: `sqlite-${mode}`, importMs, file,
    commit: (c) => commit(c),
    reads: {
      fullLoad: () => exportRecords(),
      subtree: (id) => S.subtree.all(id, MAP).length,
      children: (id) => R.children.all(MAP, id).length,
      ancestors: (id) => R.ancestors.get(id, MAP).n,
      neighborhood: (id) => R.neighborhood.get({ m: MAP, start: id }).n,
    },
    exportRecords,
    close: () => db.close(),
    sizeBytes: () => [file, `${file}-wal`].reduce((s, f) => s + (fs.existsSync(f) ? fs.statSync(f).size : 0), 0),
  };
}

// ---------- engine: draft record model on Neo4j (OP44) ----------
async function neo4jEngine(model) {
  const driver = neo4j.driver(args.neo4j || 'bolt://127.0.0.1:17687', neo4j.auth.none(), { disableLosslessIntegers: true });
  const run = async (cypher, params = {}) => { const s = driver.session(); try { return (await s.run(cypher, params)).records; } finally { await s.close(); } };
  let readSession = null;
  const read = async (cypher, params = {}) => { readSession = readSession || driver.session({ defaultAccessMode: neo4j.session.READ }); return (await readSession.run(cypher, params)).records; };
  await run('MATCH (n) CALL (n) { DETACH DELETE n } IN TRANSACTIONS OF 10000 ROWS');
  for (const c of ['CREATE CONSTRAINT n_key IF NOT EXISTS FOR (n:N) REQUIRE n.key IS UNIQUE', 'CREATE CONSTRAINT a_key IF NOT EXISTS FOR (a:A) REQUIRE a.key IS UNIQUE',
    'CREATE CONSTRAINT l_key IF NOT EXISTS FOR (l:L) REQUIRE l.key IS UNIQUE', 'CREATE CONSTRAINT m_key IF NOT EXISTS FOR (m:M) REQUIRE m.mapId IS UNIQUE',
    'CREATE INDEX a_owner IF NOT EXISTS FOR (a:A) ON (a.owner)', 'CREATE INDEX g_key IF NOT EXISTS FOR ()-[g:GRAPH_LINK]-() ON (g.key)']) await run(c);
  await run('CALL db.awaitIndexes(300)');
  const K = (id) => `${MAP}/${id}`;
  const t0 = now();
  const batches = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
  await run('CREATE (:M {mapId: $m, headSeq: 0})', { m: MAP });
  for (const b of batches([...model.nodes.values()].map((n) => ({ key: K(n.id), id: n.id, nodeType: n.nodeType, text: n.text, fields: n.fields })), 5000)) await run('UNWIND $rows AS r CREATE (:N {key: r.key, id: r.id, nodeType: r.nodeType, text: r.text, fields: r.fields, rev: 0})', { rows: b });
  for (const b of batches([...model.edges.entries()].map(([c, e]) => ({ c: K(c), p: K(e.parent), k: e.key })), 5000)) await run('UNWIND $rows AS r MATCH (c:N {key: r.c}), (p:N {key: r.p}) CREATE (c)-[:CHILD_OF {orderKey: r.k, rev: 0}]->(p)', { rows: b });
  for (const b of batches([...model.attrs.entries()].map(([k, v]) => { const [o, key] = k.split('\u0000'); return { key: `${MAP}/${o}/${key}`, owner: `${MAP}/${o}`, k: key, v }; }), 5000)) await run('UNWIND $rows AS r CREATE (:A {key: r.key, owner: r.owner, k: r.k, valueJson: r.v, rev: 0})', { rows: b });
  for (const b of batches([...model.links.values()].map((l) => ({ s: K(l.source), t: K(l.target), key: K(l.id), id: l.id, f: l.fields })), 5000)) await run('UNWIND $rows AS r MATCH (s:N {key: r.s}), (t:N {key: r.t}) CREATE (s)-[:GRAPH_LINK {key: r.key, linkId: r.id, fields: r.f, rev: 0}]->(t)', { rows: b });
  for (const b of batches([...model.linear.entries()].map(([k, v]) => ({ key: K(k), scope: k, text: v })), 500)) await run('UNWIND $rows AS r CREATE (:L {key: r.key, scope: r.scope, text: r.text, rev: 0})', { rows: b });
  const importMs = now() - t0;

  // OP44 keeps the journal in a separate failure domain: append to a local SQLite journal after the graph commit.
  const jfile = path.join(args.work, 'neo4j-journal.sqlite'); fs.rmSync(jfile, { force: true });
  const jdb = new Database(jfile); jdb.pragma('journal_mode = DELETE'); jdb.pragma('synchronous = FULL');
  jdb.exec('CREATE TABLE journal (map_id TEXT, seq INTEGER, command_id TEXT, intent TEXT, effects_json TEXT, committed_at TEXT, PRIMARY KEY (map_id, seq), UNIQUE (map_id, command_id)) WITHOUT ROWID');
  const jins = jdb.prepare('INSERT INTO journal VALUES (?, ?, ?, ?, ?, ?)');
  const one = async (tx, cypher, params) => (await tx.run(cypher, params)).records[0];
  const lastKey = async (tx, parent) => (await one(tx, 'MATCH (p:N {key: $p}) OPTIONAL MATCH (:N)-[e:CHILD_OF]->(p) RETURN p.nodeType AS t, max(e.orderKey) AS k', { p: K(parent) }));
  const session = driver.session();
  const journalMs = [];
  const commit = async (c) => {
    const result = await session.executeWrite(async (tx) => {
      const seq = (await one(tx, 'MATCH (m:M {mapId: $m}) SET m.headSeq = m.headSeq + 1 RETURN m.headSeq AS seq', { m: MAP })).get('seq');
      const fx = [];
      switch (c.intent) {
        case 'rename': { const r = await one(tx, 'MATCH (n:N {key: $k}) WITH n, n.text AS old, n.rev AS rev SET n.text = $t, n.rev = $seq RETURN old, rev', { k: K(c.nodeId), t: c.text, seq }); fx.push(['node', c.nodeId, 'update', r.get('rev'), { text: r.get('old') }, { text: c.text }]); break; }
        case 'set-attribute': { const r = await one(tx, 'MERGE (a:A {key: $key}) ON CREATE SET a.owner = $owner, a.k = $k WITH a, a.valueJson AS old SET a.valueJson = $v, a.rev = $seq RETURN old', { key: `${MAP}/${c.owner}/${c.key}`, owner: `${MAP}/${c.owner}`, k: c.key, v: c.valueJson, seq }); fx.push(['attribute', `${c.owner}/${c.key}`, r.get('old') == null ? 'create' : 'update', null, r.get('old'), c.valueJson]); break; }
        case 'unset-attribute': { const r = await one(tx, 'MATCH (a:A {key: $key}) WITH a, a.valueJson AS old DELETE a RETURN old', { key: `${MAP}/${c.owner}/${c.key}` }); fx.push(['attribute', `${c.owner}/${c.key}`, 'delete', null, r ? r.get('old') : null, null]); break; }
        case 'add-child': case 'add-sibling': {
          let parent, key;
          if (c.intent === 'add-child') { const r = await lastKey(tx, c.parentId); if (!r || r.get('t') === 'alias') throw new Error('invalid parent'); parent = c.parentId; key = generateKeyBetween(r.get('k'), null); }
          else { const r = await one(tx, 'MATCH (x:N {key: $x})-[e:CHILD_OF]->(p:N) OPTIONAL MATCH (:N)-[f:CHILD_OF]->(p) WHERE f.orderKey > e.orderKey RETURN p.id AS p, e.orderKey AS k, min(f.orderKey) AS next', { x: K(c.afterId) }); parent = r.get('p'); key = generateKeyBetween(r.get('k'), r.get('next')); }
          await tx.run('MATCH (p:N {key: $p}) CREATE (:N {key: $k, id: $id, nodeType: "text", text: $t, fields: "{}", rev: $seq})-[:CHILD_OF {orderKey: $o, rev: $seq}]->(p)', { p: K(parent), k: K(c.nodeId), id: c.nodeId, t: c.text, o: key, seq });
          fx.push(['node', c.nodeId, 'create', null, null, { text: c.text }], ['edge', c.nodeId, 'create', null, null, { parent, key }]); break;
        }
        case 'reorder': {
          const r = await one(tx, 'MATCH (y:N {key: $y})-[ey:CHILD_OF]->(p:N) OPTIONAL MATCH (s:N)-[f:CHILD_OF]->(p) WHERE f.orderKey < ey.orderKey AND s.key <> $n RETURN p.id AS p, ey.orderKey AS yk, max(f.orderKey) AS prev', { y: K(c.beforeId), n: K(c.nodeId) });
          const key = generateKeyBetween(r.get('prev'), r.get('yk'));
          const o = await one(tx, 'MATCH (:N {key: $n})-[e:CHILD_OF]->(p:N) WITH e, p.id AS oldParent, e.orderKey AS oldKey SET e.orderKey = $o, e.rev = $seq RETURN oldParent, oldKey', { n: K(c.nodeId), o: key, seq });
          fx.push(['edge', c.nodeId, 'update', null, { parent: o.get('oldParent'), key: o.get('oldKey') }, { parent: r.get('p'), key }]); break;
        }
        case 'reparent': {
          const cyc = await one(tx, 'MATCH (np:N {key: $np}) RETURN EXISTS { MATCH (np)-[:CHILD_OF*0..]->(:N {key: $n}) } AS cyc', { np: K(c.newParentId), n: K(c.nodeId) });
          if (cyc.get('cyc')) throw new Error('cycle');
          const key = generateKeyBetween((await lastKey(tx, c.newParentId)).get('k'), null);
          const o = await one(tx, 'MATCH (n:N {key: $n})-[e:CHILD_OF]->(old:N) WITH n, e, old.id AS oldParent, e.orderKey AS oldKey DELETE e WITH n, oldParent, oldKey MATCH (np:N {key: $np}) CREATE (n)-[:CHILD_OF {orderKey: $o, rev: $seq}]->(np) RETURN oldParent, oldKey', { n: K(c.nodeId), np: K(c.newParentId), o: key, seq });
          fx.push(['edge', c.nodeId, 'update', null, { parent: o.get('oldParent'), key: o.get('oldKey') }, { parent: c.newParentId, key }]); break;
        }
        case 'delete': {
          const sub = await one(tx, 'MATCH (r:N {key: $r})<-[:CHILD_OF*0..]-(d:N) OPTIONAL MATCH (d)-[e:CHILD_OF]->(p:N) RETURN collect({key: d.key, id: d.id, node: properties(d), parent: p.id, orderKey: e.orderKey}) AS rows', { r: K(c.nodeId) });
          const rows = sub.get('rows'); const keys = rows.map((x) => x.key); const ids = rows.map((x) => x.id);
          const links = (await tx.run('MATCH (d:N)-[g:GRAPH_LINK]-(:N) WHERE d.key IN $keys RETURN DISTINCT g.linkId AS id, properties(g) AS g', { keys })).records.map((r) => ({ id: r.get('id'), g: r.get('g') }));
          const owners = [...ids.map((id) => `${MAP}/n:${id}`), ...links.map((l) => `${MAP}/l:${l.id}`)];
          const attrs = (await tx.run('MATCH (a:A) WHERE a.owner IN $owners WITH a, properties(a) AS p DELETE a RETURN p', { owners })).records.map((r) => r.get('p'));
          const linear = (await tx.run('MATCH (l:L) WHERE l.key IN $keys WITH l, properties(l) AS p DELETE l RETURN p', { keys })).records.map((r) => r.get('p'));
          await tx.run('MATCH (d:N) WHERE d.key IN $keys DETACH DELETE d', { keys });
          fx.push(['subtree', c.nodeId, 'delete', null, { rows, links, attrs, linear }, null]); break;
        }
        case 'link-create': {
          const fields = stable({ relationType: c.relationType });
          const r = await one(tx, 'MATCH (s:N {key: $s}), (t:N {key: $t}) CREATE (s)-[:GRAPH_LINK {key: $key, linkId: $id, fields: $f, rev: $seq}]->(t) RETURN 1 AS ok', { s: K(c.sourceId), t: K(c.targetId), key: K(c.linkId), id: c.linkId, f: fields, seq });
          if (!r) throw new Error('endpoint'); fx.push(['graph_link', c.linkId, 'create', null, null, { source: c.sourceId, target: c.targetId, fields }]); break;
        }
        case 'linear-set': { const r = await one(tx, 'MERGE (l:L {key: $key}) ON CREATE SET l.scope = $scope WITH l, l.text AS old SET l.text = $t, l.rev = $seq RETURN old', { key: K(c.scopeRootId), scope: c.scopeRootId, t: c.text, seq }); fx.push(['linear_text', c.scopeRootId, r.get('old') == null ? 'create' : 'update', null, r.get('old'), c.text]); break; }
        case 'import-subtree': {
          const keys = batchKeys(c, (await lastKey(tx, c.parentId)).get('k'));
          const rows = c.nodes.map((x) => ({ k: K(x.id), id: x.id, t: x.text, p: K(x.parent), o: keys.get(x.id) }));
          await tx.run('UNWIND $rows AS r CREATE (:N {key: r.k, id: r.id, nodeType: "text", text: r.t, fields: "{}", rev: $seq})', { rows, seq });
          await tx.run('UNWIND $rows AS r MATCH (c:N {key: r.k}), (p:N {key: r.p}) CREATE (c)-[:CHILD_OF {orderKey: r.o, rev: $seq}]->(p)', { rows, seq });
          for (const x of c.nodes) fx.push(['node', x.id, 'create', null, null, { text: x.text }], ['edge', x.id, 'create', null, null, { parent: x.parent, key: keys.get(x.id) }]);
          break;
        }
        default: throw new Error(c.intent);
      }
      return { seq, fx };
    });
    const j0 = now(); jins.run(MAP, result.seq, c.commandId, c.intent, JSON.stringify(result.fx), new Date().toISOString()); journalMs.push(now() - j0);
  };
  const recs = async (cypher, params, f) => (await read(cypher, { m: `${MAP}/`, ...params })).map(f);
  const exportRecords = async () => ({
    nodes: await recs('MATCH (n:N) RETURN n.id AS id, n.nodeType AS t, n.text AS x, n.fields AS f', {}, (r) => [r.get('id'), r.get('t'), r.get('x'), r.get('f')]),
    edges: await recs('MATCH (c:N)-[e:CHILD_OF]->(p:N) RETURN c.id AS c, p.id AS p, e.orderKey AS k', {}, (r) => [r.get('c'), r.get('p'), r.get('k')]),
    attrs: await recs('MATCH (a:A) RETURN a.owner AS o, a.k AS k, a.valueJson AS v', {}, (r) => [r.get('o').slice(MAP.length + 1), r.get('k'), r.get('v')]),
    links: await recs('MATCH (s:N)-[g:GRAPH_LINK]->(t:N) RETURN g.linkId AS id, s.id AS s, t.id AS t, g.fields AS f', {}, (r) => [r.get('id'), r.get('s'), r.get('t'), r.get('f')]),
    linear: await recs('MATCH (l:L) RETURN l.scope AS s, l.text AS t', {}, (r) => [r.get('s'), r.get('t')]),
  });
  const count = async (cypher, params) => (await read(cypher, params))[0].get('n');
  return {
    name: 'neo4j', importMs, journalMs,
    commit,
    reads: {
      fullLoad: () => exportRecords(),
      subtree: (id) => count('MATCH (:N {key: $k})<-[:CHILD_OF*0..]-(d:N) RETURN count(d) AS n', { k: K(id) }),
      children: (id) => count('MATCH (c:N)-[e:CHILD_OF]->(:N {key: $k}) WITH c ORDER BY e.orderKey, c.id RETURN count(c) AS n', { k: K(id) }),
      ancestors: (id) => count('MATCH p = (:N {key: $k})-[:CHILD_OF*0..]->(r:N) WHERE NOT (r)-[:CHILD_OF]->() RETURN length(p) + 1 AS n', { k: K(id) }),
      // Anchor the start node first; the unanchored form made the planner expand from every node.
      neighborhood: (id) => count('MATCH (s:N {key: $k}) MATCH (s)-[:CHILD_OF|GRAPH_LINK]-{1,3}(x:N) WHERE x <> s RETURN count(DISTINCT x) AS n', { k: K(id) }),
    },
    exportRecords,
    close: async () => { await session.close(); if (readSession) await readSession.close(); await driver.close(); jdb.close(); },
    sizeBytes: () => (args['neo4j-data'] ? dirSize(args['neo4j-data']) : null),
  };
}
function dirSize(d) { let s = 0; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); s += e.isDirectory() ? dirSize(p) : fs.statSync(p).size; } return s; }

// ---------- driver ----------
(async () => {
  const state = loadState();
  const reference = Model.fromState(state);
  const initialStructure = structureFromState(state);
  const initialRecords = canonical(reference.exportRecords());
  if (initialStructure !== initialRecords.structure) throw new Error(`conversion is not lossless: ${initialStructure} vs ${initialRecords.structure}`);
  const genModel = Model.fromState(state);
  const commands = generate(genModel, COMMANDS, Number(args.seed || 1));
  const expected = canonical(genModel.exportRecords());
  // Reference for the whole-JSON engine, which may run a shorter prefix.
  const prefixModel = Model.fromState(state); commands.slice(0, WHOLE_JSON_COMMANDS).forEach((c) => prefixModel.apply(c));
  const expectedPrefix = canonical(prefixModel.exportRecords());

  const sample = { nodes: reference.nodes.size, edges: reference.edges.size, attrs: reference.attrs.size, links: reference.links.size, linear: reference.linear.size };
  const biggest = [...reference.children(reference.rootId)].map((id) => [id, reference.subtree(id).length]).sort((a, b) => b[1] - a[1]);
  const sizes = new Map(); const order = reference.subtree(reference.rootId).reverse();
  for (const id of order) sizes.set(id, 1 + reference.children(id).reduce((t, c) => t + sizes.get(c), 0));
  const mid = [...sizes.entries()].reduce((best, e) => (Math.abs(e[1] - 1000) < Math.abs(best[1] - 1000) ? e : best));
  const wideParent = [...reference.kids.entries()].sort((a, b) => b[1].length - a[1].length)[0][0];
  const deepest = reference.ids.reduce((best, id) => { let d = 0, x = id; while (x) { d += 1; x = reference.edges.get(x)?.parent; } return d > best[1] ? [id, d] : best; }, [null, 0])[0];
  const linked = reference.children(wideParent)[0];
  const readTargets = { subtreeLarge: biggest[0][0], subtreeMid: mid[0], children: wideParent, ancestors: deepest, neighborhood: linked };
  const readSizes = { subtreeLarge: biggest[0][1], subtreeMid: mid[1], children: reference.children(wideParent).length };

  const results = { scale: SCALE, sample, commands: COMMANDS, wholeJsonCommands: WHOLE_JSON_COMMANDS, readSizes, mix: Object.fromEntries(MIX), engines: {} };
  for (const name of ENGINES) {
    const engine = name === 'whole-json' ? wholeJsonEngine(JSON.parse(JSON.stringify(state)))
      : name === 'neo4j' ? await neo4jEngine(reference) : sqliteEngine(reference, name.replace('sqlite-', ''));
    const n = name === 'whole-json' ? WHOLE_JSON_COMMANDS : COMMANDS;
    const lat = {}; const t0 = now();
    for (const c of commands.slice(0, n)) { const s = now(); await engine.commit(c); (lat[c.intent] = lat[c.intent] || []).push(now() - s); }
    const totalMs = now() - t0;
    const reads = {};
    for (const [read, target] of [['fullLoad', null], ['subtree', readTargets.subtreeLarge], ['subtreeMid', readTargets.subtreeMid], ['children', readTargets.children], ['ancestors', readTargets.ancestors], ['neighborhood', readTargets.neighborhood]]) {
      const fn = read === 'subtreeMid' ? engine.reads.subtree : engine.reads[read];
      const out = await fn(target); const times = [];
      for (let i = 0; i < 5; i += 1) { const s = now(); await fn(target); times.push(now() - s); }
      reads[read] = { medianMs: r3(pct(times, 50)), result: typeof out === 'number' ? out : undefined };
    }
    let check;
    if (name === 'whole-json') { const got = engine.exportStructure(); check = { structure: got === expectedPrefix.structure }; }
    else { const got = canonical(await engine.exportRecords()); check = { records: got.records === expected.records, structure: got.structure === expected.structure }; }
    const all = Object.values(lat).flat();
    results.engines[name] = {
      importMs: r3(engine.importMs), totalCommitMs: r3(totalMs), commitsPerSecond: r3((n / totalMs) * 1000),
      commit: { p50: r3(pct(all, 50)), p95: r3(pct(all, 95)), p99: r3(pct(all, 99)), max: r3(Math.max(...all)) },
      byIntent: Object.fromEntries(Object.entries(lat).map(([k, v]) => [k, { n: v.length, p50: r3(pct(v, 50)), p95: r3(pct(v, 95)), max: r3(Math.max(...v)) }])),
      journalAppend: engine.journalMs ? { p50: r3(pct(engine.journalMs, 50)), p95: r3(pct(engine.journalMs, 95)) } : undefined,
      reads, sizeBytes: engine.sizeBytes(), valid: check,
    };
    await engine.close();
    console.error(`[pr16] ${name} done: valid=${JSON.stringify(check)} total=${Math.round(totalMs)}ms`);
  }
  const out = path.join(args.work, `pr16-scale${SCALE}.json`);
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(out);
})().catch((err) => { console.error(err); process.exit(1); });
