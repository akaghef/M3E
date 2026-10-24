import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const project = fileURLToPath(new URL('../../', import.meta.url));
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
function git(cwd, args, input) {
  const result = spawnSync('git', args, {cwd, input, env: cleanEnv(), encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
function repository(dir) {
  fs.mkdirSync(dir, {recursive: true});
  git(dir, ['init', '-b', 'fixture']);
  git(dir, ['config', 'user.name', 'Sacrificial fixture']);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  const tree = git(dir, ['mktree'], '').trim();
  const commit = git(dir, ['-c', 'commit.gpgsign=false', 'commit-tree', tree, '-m', 'Fixture']).trim();
  git(dir, ['update-ref', 'HEAD', commit]);
  git(dir, ['branch', 'preserved']);
}
function snapshot(dir) {
  return {
    config: fs.readFileSync(path.join(dir, '.git/config')),
    head: fs.readFileSync(path.join(dir, '.git/HEAD')),
    commit: git(dir, ['rev-parse', 'HEAD']),
    refs: git(dir, ['for-each-ref']),
  };
}
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm3e-git-env-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const real = path.join(dir, 'sacrificial-real'), source = path.join(dir, 'source');
  repository(real);
  fs.mkdirSync(path.join(source, 'scripts/ops'), {recursive: true});
  // Copy only scripts needed by these tests; no link to the invoking repository's Git metadata.
  for (const name of ['scripts/ops', 'scripts/beta', 'scripts/final', '.githooks']) {
    fs.cpSync(path.join(project, name), path.join(source, name), {recursive: true});
  }
  const before = snapshot(real);
  const env = {
    ...cleanEnv(), GIT_DIR: path.join(real, '.git'), GIT_WORK_TREE: real,
    GIT_INDEX_FILE: path.join(real, '.git/index'), GIT_COMMON_DIR: path.join(real, '.git'),
    GIT_PREFIX: '', GIT_FUTURE_HOOK_VARIABLE: 'must also be removed',
  };
  return {dir, real, source, env, before};
}
function verifyRun(f, args) {
  const env = {...f.env};
  // A nested Node test runner otherwise skips its files and exits successfully.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, args, {
    cwd: f.source, env, encoding: 'utf8', timeout: 120000,
  });
  assert.deepEqual(snapshot(f.real), f.before, 'sacrificial repository config, HEAD and refs must remain byte-identical');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result;
}

for (const commitMode of [false, true]) {
  test(`preflight ${commitMode ? 'commit helper' : 'check runner'} isolates children from hook Git environment`, t => {
    const f = fixture(t), ops = path.join(f.source, 'scripts/ops');
    const target = path.join(f.dir, 'child-repository');
    repository(target);
    // Exercise real Git mutations in another temporary repository, independently of test helpers.
    fs.writeFileSync(path.join(ops, 'probe.mjs'), `
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cwd = ${JSON.stringify(target)};
for (const args of [['config','user.name','Child fixture'], ['update-ref','refs/heads/child','HEAD'], ['symbolic-ref','HEAD','refs/heads/child']]) {
  const result = spawnSync('git', args, {cwd, encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
}
fs.writeFileSync(${JSON.stringify(path.join(f.dir, 'child-env.json'))}, JSON.stringify(process.env));
`);
    fs.writeFileSync(path.join(ops, 'ci-checks.json'), JSON.stringify({probe: ['.', 'node scripts/ops/probe.mjs']}));
    let args = [path.join(ops, 'preflight.mjs')];
    if (commitMode) {
      repository(f.source);
      fs.mkdirSync(path.join(f.source, 'beta/node_modules'), {recursive: true});
      fs.writeFileSync(path.join(f.source, 'beta/package-lock.json'), 'fixture-lock\n');
      git(f.source, ['read-tree', '--empty']);
      for (const file of ['scripts/ops/preflight.mjs', 'scripts/ops/ci-checks.json', 'scripts/ops/probe.mjs', 'beta/package-lock.json']) {
        const blob = git(f.source, ['hash-object', '-w', '--stdin'], fs.readFileSync(path.join(f.source, file))).trim();
        git(f.source, ['update-index', '--add', '--cacheinfo', `100644,${blob},${file}`]);
      }
      const tree = git(f.source, ['write-tree']).trim();
      const sha = git(f.source, ['-c', 'commit.gpgsign=false', 'commit-tree', tree, '-m', 'Preflight source']).trim();
      git(f.source, ['update-ref', 'HEAD', sha]);
      args = [...args, '--commit', sha];
    }
    verifyRun(f, args);
    const childEnv = JSON.parse(fs.readFileSync(path.join(f.dir, 'child-env.json')));
    assert.deepEqual(Object.keys(childEnv).filter(key => key.startsWith('GIT_')), []);
    assert.equal(childEnv.PATH, f.env.PATH, 'ordinary environment is preserved');
    assert.equal(git(target, ['config', 'user.name']).trim(), 'Child fixture');
    assert.equal(git(target, ['branch', '--show-current']).trim(), 'child');
    assert.match(git(target, ['for-each-ref']), /refs\/heads\/child/);
  });
}

for (const [file, pattern] of [
  ['delivery-policy.test.mjs', 'daily sync rejects a task branch'],
  ['channel-runtime.test.mjs', 'Beta rejects dirty, untracked, task branch and unpublished source'],
  ['ci-push-gate.test.mjs', 'dev-beta push checks the pushed commit from a dirty checkout'],
]) {
  test(`${file} protects temporary Git repositories when invoked directly from a hook`, t => {
    const f = fixture(t);
    const result = verifyRun(f, ['--test', '--test-reporter=tap', '--test-name-pattern', pattern, path.join(f.source, 'scripts/ops', file)]);
    assert.match(result.stdout, /# pass 1(?:\r?\n|$)/, 'the selected test must actually execute');
  });
}
