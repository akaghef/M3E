#!/usr/bin/env node
// Claude Code entry for the shared M3E plugin scripts. Claude Code copies this
// plugin into its cache, so it cannot reach ../m3e by relative path; it runs the
// scripts of the configured M3E repository (mcp-client.json) instead. The Codex
// package in plugins/m3e stays unchanged, including its trusted hook definitions.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const allowed = new Set(['start-mcp.mjs', 'hook.mjs']);
const [script, ...args] = process.argv.slice(2);

function dataDirectory(env = process.env) {
  return path.resolve(env.M3E_HOME || (process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'M3E')
    : process.platform === 'win32'
      ? path.join(env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'M3E')
      : path.join(env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'M3E')));
}

try {
  if (!allowed.has(script)) throw new Error('M3E plugin: unknown entry.');
  let repoRoot = process.env.M3E_REPO_ROOT;
  if (!repoRoot) {
    try { repoRoot = JSON.parse(await fs.readFile(path.join(dataDirectory(), 'mcp-client.json'), 'utf8')).repoRoot; }
    catch { /* reported below */ }
  }
  if (!repoRoot) throw new Error('M3E repository not configured. Run scripts/mcp/configure-plugin.mjs in the M3E repository.');
  const target = path.join(await fs.realpath(repoRoot), 'plugins', 'm3e', 'scripts', script);
  await fs.access(target);
  const child = spawn(process.execPath, [target, ...args], { stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', () => { process.stderr.write('M3E plugin could not start.\n'); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
