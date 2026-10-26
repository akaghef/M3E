import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const script = fileURLToPath(new URL('codex-grep.sh', import.meta.url));
const user = text => ({type: 'response_item', payload: {
  type: 'message', role: 'user', content: [{type: 'input_text', text}],
}});
const event = text => ({type: 'event_msg', payload: {type: 'user_message', message: text}});

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-grep-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const home = path.join(root, 'home');
  const sessions = path.join(home, '.codex/sessions');
  const archived = path.join(home, '.codex/archived_sessions');
  fs.mkdirSync(sessions, {recursive: true});
  fs.mkdirSync(archived, {recursive: true});
  function write(name, records, dir = sessions) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    // Deliberately escaped Japanese, quotes, backslashes and newlines; no real logs.
    const input = records.map(record => JSON.stringify(record)
      .replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))).join('\n') + '\n';
    if (name.endsWith('.zst')) {
      const r = spawnSync('zstd', ['-q', '-c'], {input});
      assert.equal(r.status, 0, String(r.stderr || r.error));
      fs.writeFileSync(file, r.stdout);
    } else fs.writeFileSync(file, input);
    return file;
  }
  function run(args, dir = sessions) {
    const env = {...process.env, HOME: home};
    delete env.CODEX_SESSIONS_DIR;
    if (dir !== null) env.CODEX_SESSIONS_DIR = dir;
    return spawnSync('bash', [script, ...args], {env, encoding: 'utf8'});
  }
  return {write, run, sessions, archived};
}

function hits(result, count) {
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, new RegExp(`\\[${count} match\\(es\\)`));
  assert.equal((result.stdout.match(/^=== /gm) || []).length, count);
}

test('searches old plain, current plain and compressed records, newest file first', t => {
  const f = fixture(t);
  f.write('2026/01/01/rollout-2026-01-01.jsonl', [{type: 'user_message', message: '横断 old'}]);
  f.write('2026/01/02/rollout-2026-01-02.jsonl', [user('横断 current')]);
  f.write('2026/01/03/rollout-2026-01-03.jsonl.zst', [user('横断 compressed')]);
  const r = f.run(['横断']);
  hits(r, 3);
  assert.deepEqual([...r.stdout.matchAll(/^=== (.+) ===$/gm)].map(m => m[1]), [
    'rollout-2026-01-03.jsonl.zst', 'rollout-2026-01-02.jsonl', 'rollout-2026-01-01.jsonl',
  ]);
  assert.ok(r.stdout.includes('横断 compressed'));
  assert.ok(!r.stdout.includes('\\u6a2a'));
});

test('filters on both substrings in the same user message and ignores other roles', t => {
  const f = fixture(t);
  const file = f.write('rollout.jsonl', [
    user('link viewer'), user('link only'), event('link viewer event'),
    {type: 'response_item', payload: {type: 'message', role: 'assistant', content: [{type: 'output_text', text: 'link viewer'}]}},
    {type: 'event_msg', payload: {type: 'agent_message', message: 'link viewer'}},
    {type: 'response_item', payload: {type: 'message', role: 'developer', content: [{type: 'input_text', text: 'link viewer'}]}},
    null, {type: 'response_item', payload: null},
  ]);
  fs.appendFileSync(file, '{unfinished\n');
  hits(f.run(['link']), 3);
  hits(f.run(['link', 'viewer']), 2);
  hits(f.run(['absent']), 0);
});

test('parses whitespace and escapes, joins text blocks, truncates after matching', t => {
  const f = fixture(t);
  const message = '横断 "quoted" \\path\n' + 'あ'.repeat(810) + ' tail';
  const record = user(message);
  record.payload.content.push({type: 'input_image', image_url: 'invented'}, {type: 'input_text', text: 'viewer'});
  const file = f.write('rollout.jsonl', [record]);
  // JSON whitespace must not affect recognition of the old shape either.
  fs.appendFileSync(file, '{ "message": "横断 spaced", "type": "user_message" }\n');
  const r = f.run(['横断', 'tail']);
  hits(r, 1);
  assert.equal(r.stdout, '\n=== rollout.jsonl ===\n' + message.slice(0, 800) + '\n');
  hits(f.run(['横断', 'viewer']), 1);
  hits(f.run(['横断']), 2);
});

test('default excludes archives; directory override searches only the supplied root', t => {
  const f = fixture(t);
  f.write('rollout-active.jsonl', [user('needle active')]);
  f.write('rollout-archived.jsonl.zst', [user('needle archived')], f.archived);
  const active = f.run(['needle'], null);
  hits(active, 1);
  assert.ok(active.stdout.includes('needle active'));
  const archived = f.run(['needle'], f.archived);
  hits(archived, 1);
  assert.ok(archived.stdout.includes('needle archived'));
});

test('requires a query and reports damaged compressed files as failure', t => {
  const f = fixture(t);
  assert.notEqual(f.run([]).status, 0);
  fs.writeFileSync(path.join(f.sessions, 'broken.jsonl.zst'), 'not zstd');
  const r = f.run(['needle']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /zstd|decompress/i);
});

test('ignores injected context that Codex records as user input', t => {
  const f = fixture(t);
  f.write('rollout.jsonl', [
    user('<environment_context>\n  <cwd>needle</cwd>\n</environment_context>'),
    user('# AGENTS.md instructions for /repo\nneedle rule'),
    user('<skill>\nneedle skill\n</skill>'),
    user('<external_codex_apps_open_page>needle</external_codex_apps_open_page>'),
    {type: 'response_item', payload: {type: 'message', role: 'user', content: [
      {type: 'input_text', text: '<environment_context>needle</environment_context>'},
      {type: 'input_text', text: 'needle typed by the human'},
    ]}},
  ]);
  const r = f.run(['needle']);
  hits(r, 1);
  assert.ok(r.stdout.includes('needle typed by the human'));
  assert.ok(!r.stdout.includes('environment_context'));
});
