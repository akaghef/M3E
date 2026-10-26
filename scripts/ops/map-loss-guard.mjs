#!/usr/bin/env node
// Detect silent node loss in one M3E scope that an AI agent maintains as its work base.
//
//   record: after an intended write, save the scope's current nodes as the baseline.
//   check:  compare the scope with the baseline; nodes that disappeared or whose text
//           became empty, and GraphLinks that disappeared, are loss. Loss is reported through m3e_feedback (and a macOS
//           notification with --notify) and exits 2. An unreachable server exits 3.
//
// Reads go through the running app's MCP endpoint (m3e_get); the guard never writes map
// content. Usage:
//   node scripts/ops/map-loss-guard.mjs <record|check> --target <scope URI> --ledger <file>
//        [--base http://localhost:4173] [--notify]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const hash = text => crypto.createHash('sha256').update(text ?? '').digest('hex');

export function diffSnapshots(previous, current) {
  const lost = [];
  const emptied = [];
  const changed = [];
  for (const [uri, before] of Object.entries(previous.nodes)) {
    const after = current.nodes[uri];
    if (!after) lost.push(before);
    else if (before.text_hash !== hash('') && after.text_hash === hash('')) emptied.push(before);
    else if (before.text_hash !== after.text_hash) changed.push({before, after});
  }
  const added = Object.keys(current.nodes).filter(uri => !previous.nodes[uri]).map(uri => current.nodes[uri]);
  // Ledgers recorded before GraphLinks were tracked have no links section.
  const lostLinks = Object.entries(previous.links ?? {}).filter(([uri]) => !current.links?.[uri]).map(([, link]) => link);
  return {lost, emptied, changed, added, lostLinks};
}

async function call(base, name, args) {
  const response = await fetch(`${base}/api/mcp/call`, {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({name, arguments: args}),
  });
  const body = await response.json();
  if (!body.ok) throw new Error(`${name}: ${body.error?.message ?? response.status}`);
  return body;
}

export async function snapshot(base, target) {
  const nodes = {};
  const links = {};
  let offset = 0;
  let linkOffset = 0;
  let revision = null;
  for (;;) {
    const page = await call(base, 'm3e_get', {kind: 'state', target, limit: 100, offset: offset ?? 0, link_offset: linkOffset ?? 0});
    revision = page.revision;
    if (offset != null) for (const node of page.nodes) {
      nodes[node.uri] = {name: node.name, parent: node.parent_uri, text_hash: hash(node.text)};
    }
    if (linkOffset != null) for (const link of page.links ?? []) {
      if (link.uri) links[link.uri] = {name: link.label || `${link.sourceNodeId} → ${link.targetNodeId}`};
    }
    offset = offset == null ? null : page.next_offset;
    linkOffset = linkOffset == null ? null : (page.next_link_offset ?? null);
    if (offset == null && linkOffset == null) break;
  }
  return {target, revision, taken_at: new Date().toISOString(), nodes, links};
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const options = {mode, base: 'http://localhost:4173', notify: false};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--notify') options.notify = true;
    else if (['--target', '--ledger', '--base'].includes(rest[i])) options[rest[i].slice(2)] = rest[++i];
    else throw new Error(`unknown argument: ${rest[i]}`);
  }
  if (!['record', 'check'].includes(mode) || !options.target || !options.ledger) {
    throw new Error('usage: map-loss-guard.mjs <record|check> --target <scope URI> --ledger <file> [--base URL] [--notify]');
  }
  return options;
}

const label = node => JSON.stringify(node.name);

export async function main(argv) {
  const options = parseArgs(argv);
  let current;
  try {
    current = await snapshot(options.base, options.target);
  } catch (error) {
    console.error(`map-loss-guard: cannot read the scope (${error.message})`);
    return 3;
  }
  if (options.mode === 'record') {
    fs.mkdirSync(path.dirname(options.ledger), {recursive: true});
    fs.writeFileSync(options.ledger, `${JSON.stringify(current, null, 1)}\n`);
    console.log(`map-loss-guard: recorded ${Object.keys(current.nodes).length} nodes, ${Object.keys(current.links).length} GraphLinks`);
    return 0;
  }
  const previous = JSON.parse(fs.readFileSync(options.ledger, 'utf8'));
  const {lost, emptied, changed, added, lostLinks} = diffSnapshots(previous, current);
  const before = Object.keys(previous.nodes).length;
  const after = Object.keys(current.nodes).length;
  console.log(`map-loss-guard: ${before} recorded → ${after} now; lost ${lost.length}, emptied ${emptied.length}, unrecorded changes ${changed.length}, added ${added.length}, lost GraphLinks ${lostLinks.length}`);
  for (const node of lost) console.log(`  lost: ${label(node)}`);
  for (const node of emptied) console.log(`  emptied: ${label(node)}`);
  for (const link of lostLinks) console.log(`  lost GraphLink: ${label(link)}`);
  for (const {before: b, after: a} of changed) console.log(`  changed: ${label(b)} → ${label(a)}`);
  if (lost.length + emptied.length + lostLinks.length === 0) return 0;
  const what = `記録済みscopeからノードが消失した: 消失 ${lost.length} 件、本文が空になった ${emptied.length} 件、GraphLink 消失 ${lostLinks.length} 件（記録 ${before} → 現在 ${after}）。`
    + ` 例: ${[...lost, ...emptied, ...lostLinks].slice(0, 10).map(label).join(', ')}`;
  try {
    await call(options.base, 'm3e_feedback', {
      what,
      why: 'AI agent の作業基盤として維持している scope で、意図した書き込みの記録後に内容が失われた。',
      where: options.target,
      when: `記録 ${previous.taken_at}（revision ${previous.revision}）から検査 ${current.taken_at}（revision ${current.revision}）の間`,
      who: 'map-loss-guard',
      how: `node scripts/ops/map-loss-guard.mjs check --target ${options.target}`,
    });
  } catch (error) {
    console.error(`map-loss-guard: feedback was not recorded (${error.message})`);
  }
  if (options.notify) {
    spawnSync('osascript', ['-e', `display notification ${JSON.stringify(what.slice(0, 200))} with title "M3E ノード消失"`]);
  }
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => process.exit(code), error => {
    console.error(`map-loss-guard: ${error.message}`);
    process.exit(1);
  });
}
