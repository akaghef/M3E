import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function dataDirectory(env = process.env) {
  return path.resolve(env.M3E_HOME || (process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'M3E')
    : process.platform === 'win32'
      ? path.join(env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'M3E')
      : path.join(env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'M3E')));
}

export async function runtimeConfig(env = process.env) {
  let saved = {};
  try { saved = JSON.parse(await fs.readFile(path.join(dataDirectory(env), 'mcp-client.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('M3E mcp-client.json cannot be read. Run the M3E plugin configuration helper.'); }
  const apiUrl = new URL(env.M3E_API_URL || saved.apiUrl || 'http://127.0.0.1:4173');
  if (!['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.username || apiUrl.password || !['localhost', '127.0.0.1', '[::1]'].includes(apiUrl.hostname)) {
    throw new Error('M3E_API_URL must be a loopback HTTP URL without credentials.');
  }
  apiUrl.pathname = apiUrl.pathname.replace(/\/$/, '');
  apiUrl.search = '';
  apiUrl.hash = '';
  return { apiUrl: apiUrl.toString().replace(/\/$/, ''), repoRoot: env.M3E_REPO_ROOT || saved.repoRoot, nodeExecutable: env.M3E_NODE || saved.nodeExecutable || process.execPath };
}

export async function validateRepository(repoRoot) {
  const root = await fs.realpath(path.resolve(repoRoot));
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'beta', 'package.json'), 'utf8'));
  if (pkg.name !== 'm3e-rapid-mvp') throw new Error('The configured repository is not M3E Beta.');
  const entry = path.join(root, 'beta', 'dist', 'node', 'start_mcp.js');
  await fs.access(entry);
  return { root, entry };
}

export async function resolveRepository(config) {
  if (config.repoRoot) return validateRepository(config.repoRoot);
  const candidates = new Map();
  for (let base of [pluginRoot, process.cwd()]) {
    while (true) {
      try { const found = await validateRepository(base); candidates.set(found.root, found); } catch { /* Not a built M3E root. */ }
      const parent = path.dirname(base);
      if (parent === base) break;
      base = parent;
    }
  }
  if (candidates.size === 1) return [...candidates.values()][0];
  throw new Error(candidates.size > 1
    ? 'Multiple M3E builds found. Configure an explicit repository with the M3E plugin configuration helper.'
    : 'M3E Beta build not configured. Build Beta, then run scripts/mcp/configure-plugin.mjs for the M3E application home.');
}
