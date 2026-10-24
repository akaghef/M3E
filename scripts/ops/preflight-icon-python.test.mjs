import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const project = fileURLToPath(new URL('../../', import.meta.url));
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_') && key !== 'NODE_TEST_CONTEXT'));
const bash = spawnSync('bash', ['-c', 'command -v bash'], {encoding: 'utf8'}).stdout.trim();

// A preflight copy whose PATH holds only fake interpreters, so no host Python can satisfy a check.
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm3e-icon-python-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const source = path.join(dir, 'source');
  fs.cpSync(path.join(project, 'scripts/ops'), path.join(source, 'scripts/ops'), {recursive: true});
  const bin = name => { const p = path.join(dir, name); fs.mkdirSync(p); return p; };
  const noPillow = bin('no-pillow'), pillow = bin('pillow'), tools = bin('tools');
  const log = path.join(dir, 'pillow-python.log');
  // First on PATH, like Homebrew's python3 without Pillow: cannot import PIL, cannot run the checks.
  fs.writeFileSync(path.join(noPillow, 'python3'), '#!/bin/sh\nexit 1\n', {mode: 0o755});
  fs.writeFileSync(path.join(pillow, 'python3'), `#!/bin/sh\nif [ "$1" = "-c" ]; then exit 0; fi\necho "$@" >> '${log}'\nexit 0\n`, {mode: 0o755});
  fs.symlinkSync(bash, path.join(tools, 'bash'));
  return {source, noPillow, pillow, tools, log};
}
function preflight(f, check, PATH, extra = {}) {
  return spawnSync(process.execPath, [path.join(f.source, 'scripts/ops/preflight.mjs'), '--check', check], {
    cwd: f.source, env: {...cleanEnv(), M3E_AGENT_ICON_PYTHON: '', ...extra, PATH}, encoding: 'utf8', timeout: 60000,
  });
}
const ran = f => fs.existsSync(f.log) ? fs.readFileSync(f.log, 'utf8') : '';

for (const check of ['agent-icon-tests', 'agent-icons']) {
  test(`${check} uses a python3 with Pillow even when one without it comes first on PATH`, {skip: process.platform === 'win32'}, t => {
    const f = fixture(t);
    const result = preflight(f, check, [f.noPillow, f.pillow, f.tools].join(path.delimiter));
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(ran(f), /agent-node-icons\.py/);
  });
}

test('an explicit M3E_AGENT_ICON_PYTHON is used for the icon checks', {skip: process.platform === 'win32'}, t => {
  const f = fixture(t);
  const result = preflight(f, 'agent-icons', [f.noPillow, f.tools].join(path.delimiter), {M3E_AGENT_ICON_PYTHON: path.join(f.pillow, 'python3')});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(ran(f), /check-agent-node-icons\.py/);
});

test('icon checks fail with a Pillow message when no python3 can import PIL', {skip: process.platform === 'win32'}, t => {
  const f = fixture(t);
  const result = preflight(f, 'agent-icons', [f.noPillow, f.tools].join(path.delimiter));
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /Pillow/);
  assert.equal(ran(f), '');
});
