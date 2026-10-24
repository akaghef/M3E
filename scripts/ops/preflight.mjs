#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
// Git hooks export repository selectors; cwd alone cannot isolate child Git calls.
const childEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
const command = (name, args, options = {}) => spawnSync(name, args, {
  encoding: 'utf8', ...options, env: childEnv(),
});
const reportCommandFailure = (label, result) => {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  throw new Error(`${label} failed${result.status === null ? '' : ` (exit ${result.status})`}`);
};

function commitPreflight(revision) {
  const resolved = command('git', ['rev-parse', '--verify', `${revision}^{commit}`], {cwd: root});
  if (resolved.status !== 0) reportCommandFailure('Resolve commit', resolved);
  const sha = resolved.stdout.trim();
  const sourceLock = command('git', ['hash-object', 'beta/package-lock.json'], {cwd: root});
  if (sourceLock.status !== 0) reportCommandFailure('Read source lockfile', sourceLock);
  const commitLock = command('git', ['rev-parse', `${sha}:beta/package-lock.json`], {cwd: root});
  if (commitLock.status !== 0) reportCommandFailure('Read commit lockfile', commitLock);
  if (sourceLock.stdout.trim() !== commitLock.stdout.trim()) {
    throw new Error('beta/package-lock.json differs from the pushed commit. Run npm --prefix beta ci in this checkout, then retry.');
  }
  const sourceModules = join(root, 'beta/node_modules');
  if (!fs.statSync(sourceModules, {throwIfNoEntry: false})?.isDirectory()) {
    throw new Error('beta/node_modules is missing in the push source checkout. Run npm --prefix beta ci, then retry.');
  }

  const temporaryRoot = fs.mkdtempSync(join(os.tmpdir(), 'm3e-preflight-'));
  const worktree = join(temporaryRoot, 'worktree');
  let caughtSignal = '';
  const catchSignal = signal => { caughtSignal ||= signal; };
  process.on('SIGINT', catchSignal);
  process.on('SIGTERM', catchSignal);
  let result;
  let cleanupError;
  try {
    const add = command('git', ['worktree', 'add', '--detach', worktree, sha], {cwd: root, stdio: 'inherit'});
    if (add.status !== 0) reportCommandFailure('Create commit worktree', add);
    const modulesTarget = join(worktree, 'beta/node_modules');
    if (process.platform === 'darwin') {
      const clone = command('/bin/cp', ['-cR', sourceModules, modulesTarget], {cwd: root, stdio: 'inherit'});
      if (clone.status !== 0) reportCommandFailure('Clone beta/node_modules', clone);
    } else {
      fs.cpSync(sourceModules, modulesTarget, {recursive: true, dereference: true});
    }
    result = command(process.execPath, [join(worktree, 'scripts/ops/preflight.mjs')], {cwd: worktree, stdio: 'inherit'});
  } catch (error) {
    cleanupError = error;
  } finally {
    const remove = command('git', ['worktree', 'remove', '--force', worktree], {cwd: root, stdio: 'inherit'});
    if (remove.status !== 0) {
      try { fs.rmSync(worktree, {recursive: true, force: true}); }
      catch (error) { cleanupError ||= error; }
    }
    const prune = command('git', ['worktree', 'prune'], {cwd: root, stdio: 'inherit'});
    if (prune.status !== 0) cleanupError ||= new Error('git worktree prune failed');
    fs.rmSync(temporaryRoot, {recursive: true, force: true});
    process.off('SIGINT', catchSignal);
    process.off('SIGTERM', catchSignal);
  }
  if (cleanupError) {
    console.error(`FAIL commit preflight: ${cleanupError.message}`);
    process.exitCode = 1;
  } else if (caughtSignal) {
    process.exitCode = caughtSignal === 'SIGINT' ? 130 : 143;
  } else if (!result || result.status !== 0) {
    process.exitCode = result?.status ?? 1;
  } else {
    process.exitCode = 0;
  }
}

const commitMode = args[0] === '--commit';
if (commitMode) {
  if (args.length !== 2 || !args[1]) {
    console.error('Usage: preflight.sh --commit <sha>'); process.exitCode = 1;
  } else {
    try { commitPreflight(args[1]); }
    catch (error) { console.error(`FAIL commit preflight: ${error.message}`); process.exitCode = 1; }
  }
} else {
  const checks = JSON.parse(fs.readFileSync(new URL('ci-checks.json', import.meta.url)));
  if (args.length && (args.length !== 2 || args[0] !== '--check' || !checks[args[1]])) {
    console.error('Usage: preflight.sh [--check <name>]'); process.exitCode = 1;
  } else {
    const selected = args.length ? [args[1]] : Object.keys(checks);
    if (selected.some(name => checks[name][0] === 'beta') && !fs.existsSync(resolve(root, 'beta/node_modules'))) {
      console.error('FAIL prerequisites: beta/node_modules is missing. Run npm ci in beta explicitly; preflight never installs dependencies.'); process.exitCode = 1;
    } else {
      const started = Date.now(), failed = [];
      for (const name of selected) {
        console.log('\n[preflight] ' + name);
        const [cwd, check] = checks[name];
        const result = command('bash', ['-e', '-o', 'pipefail', '-c', check], {cwd: resolve(root, cwd), stdio: 'inherit'});
        if (result.status !== 0) { failed.push(name); console.error('FAIL ' + name + (result.error ? ': ' + result.error.message : '')); }
      }
      console.log('\n[preflight] ' + (failed.length ? 'FAIL: ' + failed.join(', ') : 'PASS: ' + selected.join(', ')) + ' (' + ((Date.now()-started)/1000).toFixed(1) + 's)');
      process.exitCode = failed.length ? 1 : 0;
    }
  }
}
