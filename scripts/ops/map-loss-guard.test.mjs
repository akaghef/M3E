import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {main} from './map-loss-guard.mjs';

const target = 'm3e://maps/m/scopes/s';
const node = (uri, text) => ({uri, name: text, text, parent_uri: null});

// A stand-in for the app's /api/mcp/call that pages m3e_get state and records feedback.
async function fakeApp(t, state) {
  const feedback = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const {name, arguments: args} = JSON.parse(body);
      let result;
      if (name === 'm3e_get') {
        const links = state.links ?? [];
        const nodes = state.nodes.slice(args.offset, args.offset + 2);
        const next = args.offset + 2 < state.nodes.length ? args.offset + 2 : null;
        const nextLink = args.link_offset + 2 < links.length ? args.link_offset + 2 : null;
        result = {ok: true, revision: state.revision, nodes, next_offset: next,
          links: links.slice(args.link_offset, args.link_offset + 2), next_link_offset: nextLink};
      } else if (name === 'm3e_feedback') {
        feedback.push(args);
        result = {ok: true};
      } else result = {ok: false, error: {message: 'unexpected tool'}};
      res.writeHead(200, {'content-type': 'application/json'});
      res.end(JSON.stringify(result));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return {base: `http://127.0.0.1:${server.address().port}`, feedback};
}

function ledgerPath(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'map-loss-guard-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  return path.join(dir, 'ledger.json');
}

test('an unchanged scope passes and intended edits recorded with record pass', async t => {
  const state = {revision: 'r1', nodes: [node('a', 'C0'), node('b', 'C1'), node('c', 'C2')]};
  const app = await fakeApp(t, state);
  const ledger = ledgerPath(t);
  const args = ['--target', target, '--ledger', ledger, '--base', app.base];
  assert.equal(await main(['record', ...args]), 0);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(ledger, 'utf8')).nodes).length, 3);
  assert.equal(await main(['check', ...args]), 0);
  state.nodes.pop();
  assert.equal(await main(['record', ...args]), 0);
  assert.equal(await main(['check', ...args]), 0);
  assert.equal(app.feedback.length, 0);
});

test('nodes lost across pages or emptied after recording are reported as loss', async t => {
  const state = {revision: 'r1', nodes: [node('a', 'C0'), node('b', 'C1'), node('c', 'C2'), node('d', 'C3')]};
  const app = await fakeApp(t, state);
  const ledger = ledgerPath(t);
  const args = ['--target', target, '--ledger', ledger, '--base', app.base];
  await main(['record', ...args]);
  state.revision = 'r2';
  state.nodes = [node('a', 'C0'), node('b', ''), node('e', 'new')];
  assert.equal(await main(['check', ...args]), 2);
  assert.equal(app.feedback.length, 1);
  assert.match(app.feedback[0].what, /消失 2 件、本文が空になった 1 件/);
  assert.match(app.feedback[0].what, /"C2"/);
  assert.equal(app.feedback[0].where, target);
});

test('GraphLinks lost after recording are reported as loss even when every node survives', async t => {
  const link = (uri, label) => ({uri, label, sourceNodeId: 'a', targetNodeId: 'b'});
  const state = {revision: 'r1', nodes: [node('a', 'C0'), node('b', 'C1')],
    links: [link('l1', '必須'), link('l2', '再利用'), link('l3', '経路')]};
  const app = await fakeApp(t, state);
  const ledger = ledgerPath(t);
  const args = ['--target', target, '--ledger', ledger, '--base', app.base];
  await main(['record', ...args]);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(ledger, 'utf8')).links).length, 3);
  state.links = [link('l1', '必須')];
  assert.equal(await main(['check', ...args]), 2);
  assert.match(app.feedback[0].what, /GraphLink 消失 2 件/);
});

test('an unreachable app is not mistaken for loss', async t => {
  const ledger = ledgerPath(t);
  assert.equal(await main(['check', '--target', target, '--ledger', ledger, '--base', 'http://127.0.0.1:9']), 3);
});
