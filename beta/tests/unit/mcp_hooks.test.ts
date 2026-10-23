import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../../..');
const hook = path.join(root, 'plugins/m3e/scripts/hook.mjs');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const focus = { name: 'Research', kind: 'scope', uri: 'm3e://maps/test/scopes/research' };
let temp: string;
let apiUrl: string;
let requests: { method: string | undefined; path: string; body?: any }[];
let streams: Set<ServerResponse>;
let eventResult: any;
let eventGate: Promise<void> | undefined;
let server: ReturnType<typeof createServer>;

function run(file: string, args: string[] = [], input = '', env: NodeJS.ProcessEnv = {}, cwd = temp): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      cwd, env: { ...process.env, M3E_HOME: path.join(temp, 'home'), M3E_HOOK_STATE_DIR: path.join(temp, 'state'), M3E_API_URL: apiUrl, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ stdout, stderr, code }));
    child.stdin.end(input);
  });
}

async function invoke(phase: string, name = 'm3e_context', args: any = { action: 'enter', target: focus.uri }, response?: any, call = 'first-call', session = 'parent-session', env: NodeJS.ProcessEnv = {}) {
  const result = await run(hook, [phase], JSON.stringify({
    hook_event_name: phase, session_id: session, tool_use_id: call, tool_name: `mcp__m3e__${name}`, tool_input: args,
    ...(response ? { tool_response: { structuredContent: response, content: [] } } : {}),
  }), env);
  expect(result.stderr).toBe('');
  expect(result.code).toBe(0);
  return result.stdout ? JSON.parse(result.stdout) : undefined;
}

async function enter(context = 'context-a', call = 'first-call', session = 'parent-session', env: NodeJS.ProcessEnv = {}) {
  await invoke('PreToolUse', 'm3e_context', undefined, undefined, call, session, env);
  await invoke('PostToolUse', 'm3e_context', undefined, { ok: true, context_id: context, revision: 'revision-a', event_cursor: 0, focus }, call, session, env);
}

function bindingFile(context = 'context-a', session = 'parent-session') {
  return path.join(temp, 'state', hash(session), 'contexts', hash(context), 'binding.json');
}

beforeEach(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'm3e-hooks-'));
  requests = [];
  streams = new Set();
  eventResult = { ok: true, event_cursor: 0, events: [], requires_refocus: false, focus };
  eventGate = undefined;
  server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url!, 'http://localhost');
    requests.push({ method: req.method, path: url.pathname, ...(body ? { body: JSON.parse(body) } : {}) });
    if (url.pathname === '/api/mcp/events/stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(': connected\n\n');
      streams.add(res);
      res.on('close', () => streams.delete(res));
    } else if (url.pathname === '/api/mcp/events') {
      if (eventGate) await eventGate;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(eventResult));
    } else {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, left: true }));
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  apiUrl = `http://127.0.0.1:${(server.address() as any).port}`;
});

afterEach(async () => {
  for (const session of ['parent-session', 'other-session']) await invoke('SessionEnd', 'm3e_context', {}, undefined, 'end', session);
  for (const stream of streams) stream.end();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await fs.rm(temp, { recursive: true, force: true });
});

describe('M3E session hooks (protocol diagnostics)', () => {
  it('binds the actual context result to a session and call, then checks only deltas before writing', async () => {
    await enter();
    const binding = JSON.parse(await fs.readFile(bindingFile(), 'utf8'));
    expect(binding.bound_tool_use_id).toBe('first-call');
    expect(binding.context_id).toBe('context-a');
    const result = await invoke('PreToolUse', 'm3e_update', { context_id: 'context-a', operation: 'edit' }, undefined, 'edit-call');
    expect(result).toBeUndefined();
    expect(requests.some(request => request.path === '/api/mcp/events')).toBe(true);
    expect(requests.every(request => ['/api/mcp/events', '/api/mcp/events/stream'].includes(request.path))).toBe(true);
  });

  it('binds Claude Code results passed as JSON text or content blocks, and ignores non-JSON error text', async () => {
    const claude = async (phase: string, call: string, session: string, response?: unknown) => {
      const result = await run(hook, [phase], JSON.stringify({
        hook_event_name: phase, session_id: session, tool_use_id: call, tool_name: 'mcp__plugin_m3e_m3e__m3e_context',
        tool_input: { action: 'enter', target: focus.uri }, ...(response !== undefined ? { tool_response: response } : {}),
      }));
      expect(result.stderr).toBe('');
      expect(result.code).toBe(0);
    };
    const ok = (context: string) => JSON.stringify({ ok: true, context_id: context, revision: 'revision-a', event_cursor: 0, focus });
    await claude('PreToolUse', 'text-call', 'claude-text');
    await claude('PostToolUse', 'text-call', 'claude-text', ok('context-text'));
    expect(JSON.parse(await fs.readFile(bindingFile('context-text', 'claude-text'), 'utf8')).context_id).toBe('context-text');
    await claude('PreToolUse', 'block-call', 'claude-block');
    await claude('PostToolUse', 'block-call', 'claude-block', [{ type: 'text', text: ok('context-block') }]);
    expect(JSON.parse(await fs.readFile(bindingFile('context-block', 'claude-block'), 'utf8')).context_id).toBe('context-block');
    await claude('PreToolUse', 'error-call', 'claude-error');
    await claude('PostToolUse', 'error-call', 'claude-error', 'Error: The local M3E app is unavailable.');
    await expect(fs.readdir(path.join(temp, 'state', hash('claude-error'), 'contexts'))).rejects.toThrow();
  });

  it('keeps sibling contexts separate when the host shares the parent session id', async () => {
    await enter('context-a', 'agent-a-call');
    await enter('context-b', 'agent-b-call');
    expect(JSON.parse(await fs.readFile(bindingFile('context-a'), 'utf8')).bound_tool_use_id).toBe('agent-a-call');
    expect(JSON.parse(await fs.readFile(bindingFile('context-b'), 'utf8')).bound_tool_use_id).toBe('agent-b-call');
    expect((await invoke('PreToolUse', 'm3e_update', { context_id: 'context-a' }, undefined, 'other-call', 'other-session')).hookSpecificOutput.permissionDecision).toBe('deny');
    expect(await invoke('PreToolUse', 'm3e_update', { context_id: 'context-b' }, undefined, 'own-call')).toBeUndefined();
  });

  it('does not bind an unmatched or altered PostToolUse result', async () => {
    const result = { ok: true, context_id: 'context-a', revision: 'r', event_cursor: 0, focus };
    await invoke('PostToolUse', 'm3e_context', undefined, result, 'missing-pre');
    await expect(fs.access(bindingFile())).rejects.toThrow();
    const foreign = { action: 'focus', context_id: 'context-a', target: focus.uri };
    await invoke('PreToolUse', 'm3e_context', foreign, undefined, 'foreign-call');
    await invoke('PostToolUse', 'm3e_context', foreign, result, 'foreign-call');
    await expect(fs.access(bindingFile())).rejects.toThrow();
    await invoke('PreToolUse');
    await invoke('PostToolUse', 'm3e_context', { action: 'enter', target: 'changed-target' }, result);
    await expect(fs.access(bindingFile())).rejects.toThrow();
  });

  it('stops invalidated Scope writes and gives the current human focus without acknowledging events', async () => {
    await enter();
    eventResult = { ok: true, event_cursor: 1, events: [{ cursor: 1, type: 'focus_invalidated', requires_refocus: true }], requires_refocus: true, focus: { ...focus, name: 'Parent research' } };
    const result = await invoke('PreToolUse', 'm3e_delete', { context_id: 'context-a' }, undefined, 'delete-call');
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(result.hookSpecificOutput.additionalContext).toContain('Parent research');
    expect(JSON.parse(await fs.readFile(bindingFile(), 'utf8')).event_cursor).toBe(0);
    expect(requests.every(request => request.method === 'GET')).toBe(true);
  });

  it('stores pushed SSE events in the session queue and checks it before writes', async () => {
    await enter();
    await expect.poll(() => streams.size, { timeout: 15_000 }).toBe(1);
    const event = { cursor: 1, type: 'subscription_invalidated', message: 'A subscribed boundary disappeared.' };
    for (const stream of streams) stream.write(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
    const queueFile = path.join(path.dirname(bindingFile()), 'queue.json');
    await expect.poll(async () => JSON.parse(await fs.readFile(queueFile, 'utf8').catch(() => '{}')).events?.length, { timeout: 15_000 }).toBe(1);
    const result = await invoke('PreToolUse', 'm3e_create', { context_id: 'context-a' }, undefined, 'create-call');
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('refreshes its cursor after a real get response without requiring another get in unchanged contexts', async () => {
    await enter();
    eventResult = { ...eventResult, event_cursor: 1, events: [{ cursor: 1, type: 'map_changed' }] };
    expect((await invoke('PreToolUse', 'm3e_update', { context_id: 'context-a' }, undefined, 'stale-write')).hookSpecificOutput.permissionDecision).toBe('deny');
    const args = { context_id: 'context-a', kind: 'state' };
    await invoke('PreToolUse', 'm3e_get', args, undefined, 'get-call');
    await invoke('PostToolUse', 'm3e_get', args, { ok: true, context_id: 'context-a', revision: 'revision-b', event_cursor: 1 }, 'get-call');
    eventResult.events = [];
    expect(await invoke('PreToolUse', 'm3e_update', { context_id: 'context-a' }, undefined, 'new-write')).toBeUndefined();
    expect(JSON.parse(await fs.readFile(bindingFile(), 'utf8')).revision).toBe('revision-b');
  });

  it('surfaces complete change deltas, then accepts an explicitly reviewed revision without another get', async () => {
    await enter();
    eventResult = { ...eventResult, event_cursor: 1, events: [{ cursor: 1, type: 'map_changed', revision: 'revision-b', requires_read: false, changed_nodes: [{ name: 'New evidence', uri: 'm3e://maps/test/nodes/evidence', change: 'updated', text: 'Revised evidence' }] }] };
    const denied = await invoke('PreToolUse', 'm3e_update', { context_id: 'context-a' }, undefined, 'first-write');
    expect(denied.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(denied.hookSpecificOutput.additionalContext).toContain('Revised evidence');
    expect(denied.hookSpecificOutput.additionalContext).toContain('expected_revision');
    expect(await invoke('PreToolUse', 'm3e_update', { context_id: 'context-a', expected_revision: 'revision-b' }, undefined, 'reviewed-write')).toBeUndefined();
    expect(requests.every(request => request.method === 'GET' && request.path.startsWith('/api/mcp/events'))).toBe(true);
  });

  it('requires a targeted read for an incomplete delta even when its revision is known', async () => {
    await enter();
    eventResult = { ...eventResult, event_cursor: 1, events: [{ cursor: 1, type: 'map_changed', revision: 'revision-b', requires_read: true }] };
    const denied = await invoke('PreToolUse', 'm3e_update', { context_id: 'context-a', expected_revision: 'revision-b' }, undefined, 'incomplete-write');
    expect(denied.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(denied.hookSpecificOutput.additionalContext).toContain('Read the changed target');
  });

  it('does not acknowledge a delta too large to deliver in the hook context', async () => {
    await enter();
    eventResult = { ...eventResult, event_cursor: 1, events: [{ cursor: 1, type: 'map_changed', revision: 'revision-b', requires_read: false, changed_nodes: [{ name: 'Large note', text: '🧠'.repeat(6000) }] }] };
    const denied = await invoke('PreToolUse', 'm3e_update', { context_id: 'context-a', expected_revision: 'revision-b' }, undefined, 'oversize-write');
    expect(denied.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(denied.hookSpecificOutput.additionalContext).toContain('exceed the hook context limit');
    expect(denied.hookSpecificOutput.additionalContext.length).toBeLessThan(200);
  });

  it('does not revive a context when SessionEnd occurs during the pre-write event request', async () => {
    await enter();
    let release!: () => void;
    eventGate = new Promise<void>(resolve => { release = resolve; });
    const writing = invoke('PreToolUse', 'm3e_update', { context_id: 'context-a' }, undefined, 'in-flight-write');
    await expect.poll(() => requests.some(request => request.path === '/api/mcp/events'), { timeout: 15_000 }).toBe(true);
    await invoke('SessionEnd', 'm3e_context', {});
    release();
    expect((await writing).hookSpecificOutput.permissionDecision).toBe('deny');
    await expect(fs.access(bindingFile())).rejects.toThrow();
    await expect.poll(() => streams.size, { timeout: 15_000 }).toBe(0);
    await expect(fs.access(path.dirname(bindingFile()))).rejects.toThrow();
  });

  it('does not regress retained state when older post-tool responses arrive later', async () => {
    await enter();
    const args = { context_id: 'context-a', kind: 'state' };
    await invoke('PreToolUse', 'm3e_get', args, undefined, 'older-call');
    await invoke('PreToolUse', 'm3e_get', args, undefined, 'newer-call');
    await invoke('PostToolUse', 'm3e_get', args, { ok: true, context_id: 'context-a', revision: 'revision-c', event_cursor: 2 }, 'newer-call');
    await invoke('PostToolUse', 'm3e_get', args, { ok: true, context_id: 'context-a', revision: 'revision-b', event_cursor: 1 }, 'older-call');
    const binding = JSON.parse(await fs.readFile(bindingFile(), 'utf8'));
    expect(binding.event_cursor).toBe(2);
    expect(binding.revision).toBe('revision-c');
  });

  it('passes unrelated tools and denies malformed inputs, missing bindings, and malformed own event responses', async () => {
    const unrelated = await run(hook, ['PreToolUse'], JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'mcp__files__write' }));
    expect(unrelated.stdout).toBe('');
    expect((JSON.parse((await run(hook, ['PreToolUse'], '{broken')).stdout)).hookSpecificOutput.permissionDecision).toBe('deny');
    expect((await invoke('PreToolUse', 'm3e_update', { context_id: 'missing' })).hookSpecificOutput.permissionDecision).toBe('deny');
    await enter();
    eventResult = { ok: true, events: 'broken' };
    expect((await invoke('PreToolUse', 'm3e_update', { context_id: 'context-a' }, undefined, 'bad-events')).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('leaves all bound contexts on SessionEnd and removes local state', async () => {
    await enter('context-a', 'a');
    await enter('context-b', 'b');
    await invoke('SessionEnd', 'm3e_context', {});
    await expect(fs.access(path.dirname(path.dirname(path.dirname(bindingFile()))))).rejects.toThrow();
    expect(requests.filter(request => request.method === 'POST').map(request => request.body.arguments).sort((a, b) => a.context_id.localeCompare(b.context_id))).toEqual([
      { action: 'leave', context_id: 'context-a' }, { action: 'leave', context_id: 'context-b' },
    ]);
  });

  it('expires local bindings even if SessionEnd never arrives', async () => {
    await enter('context-a', 'first-call', 'parent-session', { M3E_HOOK_TTL_MS: '500' });
    await expect.poll(async () => fs.access(bindingFile()).then(() => true, () => false), { timeout: 4000 }).toBe(false);
    expect((await invoke('PreToolUse', 'm3e_update', { context_id: 'context-a' }, undefined, 'expired-write')).hookSpecificOutput.permissionDecision).toBe('deny');
  });
});

describe('M3E plugin launch configuration (packaging diagnostics)', () => {
  it('launches the configured existing build from a copied plugin and unrelated working directory', async () => {
    const repo = path.join(temp, 'source-repository');
    await fs.mkdir(path.join(repo, 'beta/dist/node'), { recursive: true });
    await fs.writeFile(path.join(repo, 'beta/package.json'), JSON.stringify({ name: 'm3e-rapid-mvp' }));
    await fs.writeFile(path.join(repo, 'beta/dist/node/start_mcp.js'), 'console.log(JSON.stringify({cwd:process.cwd(),api:process.env.M3E_API_URL,node:process.execPath}));');
    const configured = await run(path.join(root, 'scripts/mcp/configure-plugin.mjs'), ['--repo-root', repo, '--api-url', apiUrl, '--node', process.execPath]);
    expect(configured.code).toBe(0);
    const cache = path.join(temp, 'plugin-cache');
    await fs.cp(path.join(root, 'plugins/m3e'), cache, { recursive: true });
    const result = await run(path.join(cache, 'scripts/start-mcp.mjs'), [], '', { M3E_API_URL: '', M3E_REPO_ROOT: '', M3E_NODE: '' });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ cwd: await fs.realpath(repo), api: apiUrl, node: process.execPath });
    const metadata = await fs.stat(path.join(temp, 'home/mcp-client.json'));
    expect(metadata.mode & 0o777).toBe(0o600);
  });

  it('never inherits a preview API endpoint into durable launch configuration', async () => {
    const repo = path.join(temp, 'source-repository');
    await fs.mkdir(path.join(repo, 'beta/dist/node'), { recursive: true });
    await fs.writeFile(path.join(repo, 'beta/package.json'), JSON.stringify({ name: 'm3e-rapid-mvp' }));
    await fs.writeFile(path.join(repo, 'beta/dist/node/start_mcp.js'), '');
    expect((await run(path.join(root, 'scripts/mcp/configure-plugin.mjs'), ['--repo-root', repo])).code).toBe(0);
    expect(JSON.parse(await fs.readFile(path.join(temp, 'home/mcp-client.json'), 'utf8')).apiUrl).toBe('http://127.0.0.1:4173');
  });
});
