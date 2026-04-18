#!/usr/bin/env node
// Render projects/deps.json into the SortedTaskView subtree of an M3E map.
//
// Layout rule:
//   - tree-depth == DAG layer (deps travel in depth direction)
//   - siblings == parallel-executable PJs
//
// Tree-parent selection for a node at layer L (L > 0):
//   1. prefer prereq that lies on the critical path
//   2. otherwise the prereq with fewest existing tree-children (greedy spread)
//   3. tiebreak: deps.py score desc, then ID asc
// Remaining prereqs are drawn as GraphLinks (relationType "depends-on").
//
// Env:
//   M3E_PORT    (default 4173)
//   M3E_MAP_ID  (default map_BG9BZP6NRDTEH1JYNDFGS6S3T5 = dev map)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const DEPS_PY = path.join(HERE, 'deps.py');
const DEPS_JSON = path.join(REPO, 'projects', 'deps.json');
const PORT = process.env.M3E_PORT || '4173';
const MAP_ID = process.env.M3E_MAP_ID || 'map_BG9BZP6NRDTEH1JYNDFGS6S3T5';
const BASE = `http://localhost:${PORT}`;

const py = (...args) =>
  execFileSync('python', [DEPS_PY, ...args], { encoding: 'utf8' });

const layers = JSON.parse(py('layers', '--json'));
const criticalPath = JSON.parse(py('critical', '--json')).map(n => n.id);
const criticalEdges = new Set(
  criticalPath.slice(0, -1).map((s, i) => `${s}->${criticalPath[i + 1]}`),
);

const depsJson = JSON.parse(fs.readFileSync(DEPS_JSON, 'utf8'));
const tasks = Object.fromEntries(depsJson.tasks.map(t => [t.id, t]));
const edges = depsJson.deps;

const layerOf = {};
layers.forEach((layer, i) => layer.forEach(id => { layerOf[id] = i; }));

const predsOf = {};
const succsOf = {};
for (const id of Object.keys(tasks)) { predsOf[id] = []; succsOf[id] = []; }
for (const [s, d] of edges) { predsOf[d].push(s); succsOf[s].push(d); }

const descCount = id => {
  const seen = new Set();
  const stk = [...succsOf[id]];
  while (stk.length) {
    const x = stk.pop();
    if (seen.has(x)) continue;
    seen.add(x);
    for (const y of succsOf[x]) stk.push(y);
  }
  return seen.size;
};

const topo = [];
{
  const indeg = Object.fromEntries(
    Object.keys(tasks).map(id => [id, predsOf[id].length]),
  );
  const q = Object.keys(tasks).filter(id => indeg[id] === 0).sort();
  while (q.length) {
    const n = q.shift();
    topo.push(n);
    for (const d of succsOf[n]) if (--indeg[d] === 0) q.push(d);
  }
}

const longestDepth = {};
for (const n of [...topo].reverse()) {
  const ss = succsOf[n];
  longestDepth[n] = ss.length ? Math.max(...ss.map(s => longestDepth[s])) + 1 : 0;
}

const OPEN = new Set(['draft', 'active', 'gated', 'todo']);
const scoreOf = id => {
  const t = tasks[id];
  const openDesc = [...collectDescIds(id)].filter(
    d => OPEN.has(tasks[d].state || 'draft'),
  ).length;
  return 2 * openDesc + longestDepth[id] + (t.priority || 0);
};
function collectDescIds(id) {
  const seen = new Set();
  const stk = [...succsOf[id]];
  while (stk.length) {
    const x = stk.pop();
    if (seen.has(x)) continue;
    seen.add(x);
    for (const y of succsOf[x]) stk.push(y);
  }
  return seen;
}

const treeParent = {};
const childCount = Object.fromEntries(Object.keys(tasks).map(id => [id, 0]));
for (let L = 1; L < layers.length; L++) {
  const layer = layers[L].slice().sort((a, b) => {
    const ac = criticalPath.includes(a) ? 0 : 1;
    const bc = criticalPath.includes(b) ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return a.localeCompare(b);
  });
  for (const id of layer) {
    const cands = predsOf[id].filter(p => layerOf[p] === L - 1);
    let chosen = cands.find(p => criticalEdges.has(`${p}->${id}`));
    if (!chosen) {
      chosen = cands.slice().sort((a, b) => {
        if (childCount[a] !== childCount[b]) return childCount[a] - childCount[b];
        if (scoreOf(b) !== scoreOf(a)) return scoreOf(b) - scoreOf(a);
        return a.localeCompare(b);
      })[0];
    }
    treeParent[id] = chosen;
    childCount[chosen]++;
  }
}

const docRaw = execFileSync('curl', ['-s', `${BASE}/api/maps/${MAP_ID}`], {
  encoding: 'utf8',
});
const doc = JSON.parse(docRaw);
const state = doc.state;
const nodes = state.nodes;
const links = (state.links ||= {});

let svId = null;
for (const [id, n] of Object.entries(nodes)) {
  if (n.text === 'SortedTaskView') { svId = id; break; }
}

function collectDescendants(rootId) {
  const out = new Set();
  const stk = [rootId];
  while (stk.length) {
    const x = stk.pop();
    for (const c of nodes[x].children || []) {
      if (!out.has(c)) { out.add(c); stk.push(c); }
    }
  }
  return out;
}

const ts = Date.now();
let idCounter = 0;
const genId = (prefix) => {
  const c = (idCounter++).toString(36).padStart(4, '0');
  const r = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${ts}_${c}${r}`;
};

if (svId) {
  for (const d of collectDescendants(svId)) delete nodes[d];
  nodes[svId].children = [];
} else {
  svId = genId('n');
  const rootId = state.rootId;
  nodes[svId] = {
    id: svId,
    parentId: rootId,
    text: 'SortedTaskView',
    nodeType: 'folder',
    children: [],
    collapsed: false,
    details: '',
    note: '',
    link: '',
    attributes: { rendered_by: 'sort-task' },
  };
  (nodes[rootId].children ||= []).push(svId);
}

for (const [lid, l] of Object.entries(links)) {
  if (l.relationType === 'depends-on') delete links[lid];
}

function addNode(parentId, text, opts = {}) {
  const id = genId('n');
  nodes[id] = {
    id,
    parentId,
    text,
    nodeType: opts.folder ? 'folder' : 'text',
    children: [],
    collapsed: false,
    details: opts.details || '',
    note: '',
    link: '',
    attributes: opts.attributes || {},
  };
  nodes[parentId].children.push(id);
  return id;
}

const metaId = addNode(svId, 'meta', { folder: true });
addNode(metaId, `critical-path: ${criticalPath.join(' -> ')}`);
const total = Object.keys(tasks).length;
const open = Object.values(tasks).filter(
  t => OPEN.has(t.state || 'draft'),
).length;
addNode(metaId, `open: ${open} / total: ${total}`);
addNode(metaId, `layers: ${layers.length}`);
addNode(metaId, `last-render: ${new Date().toISOString()}`);

const dagId = addNode(svId, 'DAG', { folder: true });

const pjNode = {};
const buildPJ = (pjId, parentNodeId) => {
  const t = tasks[pjId];
  pjNode[pjId] = addNode(parentNodeId, `${pjId} ${t.title || ''}`.trim(), {
    attributes: {
      pj_id: pjId,
      state: t.state || 'draft',
      layer: `L${layerOf[pjId]}`,
      on_critical: String(criticalPath.includes(pjId)),
    },
  });
};
for (const id of layers[0]) buildPJ(id, dagId);
for (let L = 1; L < layers.length; L++) {
  for (const id of layers[L]) buildPJ(id, pjNode[treeParent[id]]);
}

for (const [s, d] of edges) {
  const lid = genId('link');
  links[lid] = {
    id: lid,
    sourceNodeId: pjNode[s],
    targetNodeId: pjNode[d],
    relationType: 'depends-on',
    direction: 'forward',
    style: criticalEdges.has(`${s}->${d}`) ? 'emphasis' : 'default',
  };
}

const tmpPath = path.join(
  process.env.TEMP || '/tmp',
  `sort_task_render_${ts}.json`,
);
fs.writeFileSync(tmpPath, JSON.stringify(doc));
try {
  const resp = execFileSync('curl', [
    '-s', '-w', '\n%{http_code}',
    '-X', 'POST',
    '-H', 'Content-Type: application/json; charset=utf-8',
    '--data-binary', `@${tmpPath}`,
    `${BASE}/api/maps/${MAP_ID}`,
  ], { encoding: 'utf8' });
  const lines = resp.trim().split('\n');
  const httpCode = lines.pop();
  if (httpCode !== '200') {
    console.error(`POST failed: http ${httpCode}\n${lines.join('\n')}`);
    process.exit(1);
  }
} finally {
  fs.unlinkSync(tmpPath);
}

console.log(
  `rendered ${total} PJ / ${edges.length} edges / ${layers.length} layers -> ${MAP_ID}`,
);
