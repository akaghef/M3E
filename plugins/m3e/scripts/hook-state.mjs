import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { dataDirectory } from './runtime.mjs';

export const ttl = Math.max(500, Number(process.env.M3E_HOOK_TTL_MS) || 30 * 60 * 1000);
export const stateRoot = path.resolve(process.env.M3E_HOOK_STATE_DIR || path.join(dataDirectory(), 'mcp-sessions'));
export const digest = value => createHash('sha256').update(value).digest('hex');
export const sessionPath = session => path.join(stateRoot, digest(session));
export const contextPath = (session, context) => path.join(sessionPath(session), 'contexts', digest(context));
export const pendingPath = (session, tool) => path.join(sessionPath(session), 'calls', `${digest(tool)}.json`);

export async function withSessionDirectoryLock(sessionDirectory, action) {
  const directory = path.join(stateRoot, '.locks', path.basename(sessionDirectory));
  await fs.mkdir(path.dirname(directory), { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 12; attempt++) {
    try { await fs.mkdir(directory, { mode: 0o700 }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const stat = await fs.stat(directory).catch(() => undefined);
      if (stat && Date.now() - stat.mtimeMs > 10_000) await fs.rm(directory, { recursive: true, force: true });
      await new Promise(resolve => setTimeout(resolve, 20));
      continue;
    }
    try { return await action(); }
    finally { await fs.rm(directory, { recursive: true, force: true }); }
  }
  throw new Error('M3E session state is busy.');
}

export const withSessionLock = (session, action) => withSessionDirectoryLock(sessionPath(session), action);

export async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

export async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
  await fs.rename(temporary, file);
}

export async function removeContext(directory) {
  await fs.rm(directory, { recursive: true, force: true });
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(1400) });
  const body = await response.text();
  if (body.length > 1_000_000) throw new Error('M3E returned an oversized event response.');
  const result = JSON.parse(body);
  if (!response.ok || result.ok === false) throw new Error('M3E did not accept the context request.');
  return result;
}

export async function leaveContext(binding) {
  await fetchJson(`${binding.apiUrl}/api/mcp/call`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'm3e_context', arguments: { action: 'leave', context_id: binding.context_id } }),
  });
}

export function eventsUrl(binding, after = binding.event_cursor || 0) {
  const url = new URL(`${binding.apiUrl}/api/mcp/events`);
  url.searchParams.set('context_id', binding.context_id);
  url.searchParams.set('after', String(after));
  return url;
}

export async function pruneExpired() {
  let sessions;
  try { sessions = await fs.readdir(stateRoot); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const now = Date.now();
  for (const session of sessions) {
    if (session === '.locks') continue;
    const directory = path.join(stateRoot, session);
    await withSessionDirectoryLock(directory, async () => {
    // A stopped client may never emit SessionEnd. Contexts have their own TTL.
    const contexts = await fs.readdir(path.join(directory, 'contexts')).catch(() => []);
    for (const context of contexts) {
      const location = path.join(directory, 'contexts', context);
      const binding = await readJson(path.join(location, 'binding.json')).catch(() => undefined);
      if (!binding || binding.expires_at <= now) await removeContext(location);
    }
    const calls = await fs.readdir(path.join(directory, 'calls')).catch(() => []);
    for (const call of calls) {
      if (!call.endsWith('.json')) continue;
      const file = path.join(directory, 'calls', call);
      const pending = await readJson(file).catch(() => undefined);
      if (!pending || pending.expires_at <= now) await fs.rm(file, { force: true });
    }
    });
  }
}
