// Offline generation only. CI consumes the checked-in JSON, never a personal path.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const source = process.argv[2];
if (!source) throw new Error('Pass the reviewed architecture HTML path');
const basePath = fileURLToPath(new URL('./lane_asys.json', import.meta.url));
const base = fs.readFileSync(basePath), html = fs.readFileSync(source, 'utf8');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const domains = [['m3e','M3E'],['system','System'],['research','Research'],['family','Family'],['engineering','Engineering'],['business','Business']];
const fixture = JSON.parse(base), original = JSON.parse(base);
const sets = Object.fromEntries(domains.map(([key, label]) => {
  const match = html.match(new RegExp(`const ${key}Nodes=new Set\\(\\[([^\\]]+)\\]\\);`));
  assert(match, `Missing declaration ${key}Nodes`);
  assert.match(match[1], /^\s*'[^']+'(?:\s*,\s*'[^']+')*\s*$/);
  return [label, [...match[1].matchAll(/'([^']+)'/g)].map(match => match[1])];
}));
for (const values of Object.values(sets)) for (const id of values) assert(fixture.state.nodes[`item_${id}`], `Unknown reference ${id}`);
const domainIds = {dom_m3e:'M3E',sys:'System',res:'Research',fam:'Family',eng:'Engineering',biz:'Business'};
for (const [id, node] of Object.entries(fixture.state.nodes)) {
  if (!id.startsWith('item_')) continue;
  const name = id.slice(5);
  const labels = domains.map(([, label]) => label).filter(label => sets[label].includes(name) || domainIds[name] === label);
  assert(!Object.hasOwn(node.attributes || {}, 'domain'));
  node.attributes = {...node.attributes, domain: labels.join(',')};
}
const restored = structuredClone(fixture);
for (const [id, node] of Object.entries(restored.state.nodes)) if (id.startsWith('item_')) {
  delete node.attributes.domain;
  if (!original.state.nodes[id].attributes) delete node.attributes;
}
assert.deepEqual(restored, original);
assert.equal(digest(fs.readFileSync(basePath)), digest(base));
fs.writeFileSync(new URL('./lane_asys_domains.json', import.meta.url), JSON.stringify(fixture, null, 2) + '\n');
fs.writeFileSync(new URL('./lane_asys_domains.provenance.json', import.meta.url), JSON.stringify({ source: 'akaghef-system-architecture.html', htmlSha256: digest(html), baseSha256: digest(base), declarations: sets }, null, 2) + '\n');
