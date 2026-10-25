import { afterEach, describe, expect, it } from 'vitest';
import { createServer, request, type ServerResponse } from 'node:http';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ResourceUpdatedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { createM3eMcpServer, validateM3eApiUrl } from '../../src/node/mcp_server';
import { startM3eMcpHttp } from '../../src/node/start_mcp';

type RecordValue = Record<string, unknown>;
const map = { uri: 'm3e://maps/map_fixture', name: 'Biology', kind: 'map', map_name: 'Biology' };
const scope = { uri: 'm3e://maps/map_fixture/scopes/scope_fixture', name: 'Animals', kind: 'scope', map_name: 'Biology' };
const node = { uri: 'm3e://maps/map_fixture/nodes/node_fixture', name: 'Whale', kind: 'node', map_name: 'Biology' };
const disposers: Array<() => Promise<unknown>> = [];

// Protocol plumbing fixtures only: these do not count as real Core or cold-start acceptance.
async function backend() {
  const calls: Array<{ name: string; arguments: RecordValue }> = [];
  const streams = new Map<string, ServerResponse>();
  const history = new Map<string, RecordValue[]>();
  const streamRequests: Array<{ contextId: string; after: number }> = [];
  const waiters = new Map<string, () => void>();
  let count = 0;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/api/mcp/events/stream') {
      const id = url.searchParams.get('context_id')!;
      const after = Number(url.searchParams.get('after'));
      streamRequests.push({ contextId: id, after });
      res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.flushHeaders();
      streams.set(id, res); waiters.get(id)?.(); waiters.delete(id);
      for (const event of history.get(id) || []) {
        if (typeof event.cursor === 'number' && event.cursor > after) res.write(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
      }
      req.on('close', () => { if (streams.get(id) === res) streams.delete(id); });
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/mcp/docs') { res.end(JSON.stringify({ ok: true, text: `Canonical fixture ${url.searchParams.get('name')}` })); return; }
    if (url.pathname !== '/api/mcp/call') { res.writeHead(404).end(); return; }
    const parts: Buffer[] = [];
    for await (const part of req) parts.push(Buffer.from(part));
    const call = JSON.parse(Buffer.concat(parts).toString()) as { name: string; arguments: RecordValue };
    calls.push(call);
    const args = call.arguments;
    let result: RecordValue;
    if (call.name === 'm3e_context') {
      if (args.action === 'leave') result = { ok: true, left: true, context_id: args.context_id };
      else result = { ok: true, context_id: args.context_id || `private-context-${++count}`, revision: 'private-revision', focus: args.target === map.uri ? map : scope, subscriptions: [scope], event_cursor: 0, snapshot: { node_count: 3 }, requires_refocus: false };
    } else if (call.name === 'm3e_get' && args.kind === 'search') {
      // First page is only a node; autocomplete must continue and filter for maps/scopes.
      result = args.offset === 1 ? { ok: true, items: [map, scope], next_offset: null, total: 3 } : { ok: true, items: [node], next_offset: 1, total: 3 };
    } else if (call.name === 'm3e_get' && args.kind === 'maps') result = { ok: true, items: [map], total: 1, next_offset: null };
    else if (call.name === 'm3e_get') result = { ok: true, target: scope, revision: 'private-revision', nodes: [node], next_offset: null,
      scope_payload: args.payload_offset === 1 ? [{ kind: 'surface', key: 'overview', value: { name: 'Overview' } }] : [{ kind: 'linear_note', key: 'notes', value: 'Scope notes' }],
      payload_total: 2, next_payload_offset: args.payload_offset === 1 ? null : 1,
    };
    else if (call.name === 'm3e_delete') result = { ok: false, error: { code: 'FOCUS_INVALIDATED', message: 'The focused scope disappeared. Choose a surviving scope before writing.' }, requires_refocus: true };
    else result = { ok: true, context_id: args.context_id, focus: scope, changed: { created: 1, updated: 0, deleted: 0 } };
    if (result.ok === false) res.statusCode = 400;
    res.end(JSON.stringify(result));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No fixture address');
  disposers.unshift(async () => { for (const stream of streams.values()) stream.end(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  return {
    apiUrl: `http://127.0.0.1:${address.port}`, calls, streamRequests,
    waitForStream: (id: string) => streams.has(id) ? Promise.resolve() : new Promise<void>(resolve => waiters.set(id, resolve)),
    emit: (id: string, event: RecordValue) => {
      history.set(id, [...(history.get(id) || []), event]);
      return streams.get(id)?.write(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
    },
  };
}

async function connected(apiUrl: string, configure?: (transport: InMemoryTransport) => void) {
  const app = createM3eMcpServer({ apiUrl, requestTimeoutMs: 1000 });
  const client = new Client({ name: 'MCP protocol test', version: '1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  configure?.(serverTransport);
  await app.server.connect(serverTransport); await client.connect(clientTransport);
  disposers.unshift(async () => { await app.close(); await client.close(); });
  return client;
}

afterEach(async () => { for (const dispose of disposers.splice(0)) await dispose(); });

describe('M3E MCP SDK protocol adapter', () => {
  it('declares six model tools and one app-only mention tool with self-contained discovery', async () => {
    const fixture = await backend(); const client = await connected(fixture.apiUrl);
    const capabilities = client.getServerCapabilities();
    expect(capabilities?.experimental?.['openai/mentions']).toEqual({ searchTool: 'mentions_search' });
    expect(capabilities?.resources?.subscribe).toBe(true);
    expect(client.getInstructions()).toContain('no local skill');
    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name)).toEqual(['m3e_context', 'm3e_get', 'm3e_create', 'm3e_update', 'm3e_delete', 'm3e_feedback', 'mentions_search']);
    const mention = tools.find(tool => tool.name === 'mentions_search')!;
    expect(mention._meta).toEqual({ ui: { visibility: ['app'] } });
    expect(mention.annotations?.readOnlyHint).toBe(true);
    expect(tools.find(tool => tool.name === 'm3e_create')?.description).toContain('never a scope');
    expect(tools.every(tool => tool.inputSchema.additionalProperties === false)).toBe(true);
  });

  it('publishes canonical docs, templates and prompt using the backend canon; reads do not enter', async () => {
    const fixture = await backend(); const client = await connected(fixture.apiUrl);
    expect((await client.listResources()).resources.map(item => item.uri)).toEqual(['m3e://docs/glossary', 'm3e://docs/data-model', 'm3e://docs/map-manager', 'm3e://docs/operations']);
    expect((await client.listResourceTemplates()).resourceTemplates).toHaveLength(3);
    expect((await client.readResource({ uri: 'm3e://docs/glossary' })).contents[0]).toMatchObject({ text: 'Canonical fixture glossary' });
    const read = await client.readResource({ uri: scope.uri });
    expect(read.contents[0]).toMatchObject({ uri: scope.uri, mimeType: 'application/json' });
    expect(fixture.calls).toEqual([{ name: 'm3e_get', arguments: { kind: 'state', target: scope.uri } }]);
    expect((await client.listPrompts()).prompts.map(prompt => prompt.name)).toEqual(['m3e_structure']);
    const prompt = await client.getPrompt({ name: 'm3e_structure', arguments: { intent: 'Group the selected concepts' } });
    expect(prompt.messages[1]?.content).toMatchObject({ type: 'resource', resource: { uri: 'm3e://docs/map-manager', text: 'Canonical fixture map-manager' } });
    await expect(client.readResource({ uri: 'https://example.com/secret' })).rejects.toThrow();
    expect(fixture.calls).toHaveLength(1);
  });

  it('returns only human-labeled map/scope links for mention search with machine URIs', async () => {
    const fixture = await backend(); const client = await connected(fixture.apiUrl);
    const result = await client.callTool({ name: 'mentions_search', arguments: { query: 'biology' } });
    expect(result.content).toEqual([]);
    expect(result.structuredContent).toEqual({ items: [
      { type: 'resource_link', uri: map.uri, name: 'Biology', title: 'Biology', description: 'M3E map', mimeType: 'application/json' },
      { type: 'resource_link', uri: scope.uri, name: 'Animals', title: 'Animals', description: 'Scope in Biology', mimeType: 'application/json' },
    ] });
    expect(fixture.calls.map(call => call.arguments.offset)).toEqual([0, 1]);
    const initial = await client.callTool({ name: 'mentions_search', arguments: { query: '' } });
    expect(initial.isError).not.toBe(true);
    expect(fixture.calls.slice(2).every(call => !('query' in call.arguments))).toBe(true);
  });

  it('continues independently paginated scope content through the strict tool schema', async () => {
    const fixture = await backend(); const client = await connected(fixture.apiUrl);
    const first = await client.callTool({ name: 'm3e_get', arguments: { kind: 'state', target: scope.uri } });
    const firstPage = first.structuredContent as RecordValue;
    expect(firstPage).toMatchObject({ scope_payload: [{ kind: 'linear_note', value: 'Scope notes' }], next_payload_offset: 1 });
    const next = await client.callTool({ name: 'm3e_get', arguments: { kind: 'state', target: scope.uri, offset: 0, link_offset: 0, payload_offset: firstPage.next_payload_offset } });
    expect(next.isError).toBe(false);
    expect(next.structuredContent).toMatchObject({ scope_payload: [{ kind: 'surface', value: { name: 'Overview' } }], next_payload_offset: null });
    expect(fixture.calls.at(-1)?.arguments).toMatchObject({ offset: 0, link_offset: 0, payload_offset: 1 });
  });

  it('keeps identifiers in structured results and reports domain/validation failures as tool errors', async () => {
    const fixture = await backend(); const client = await connected(fixture.apiUrl);
    const result = await client.callTool({ name: 'm3e_context', arguments: { action: 'enter', target: scope.uri } });
    expect(result.structuredContent).toMatchObject({ context_id: 'private-context-1', focus: scope });
    expect(JSON.stringify(result.content)).not.toMatch(/private-context|private-revision|map_fixture|scope_fixture/);
    const failure = await client.callTool({ name: 'm3e_delete', arguments: { context_id: 'private-context-1', target: scope.uri } });
    expect(failure.isError).toBe(true);
    expect(failure.structuredContent).toMatchObject({ error: { code: 'FOCUS_INVALIDATED' } });
    const invalid = await client.callTool({ name: 'm3e_get', arguments: { kind: 'maps', invented_option: true } });
    expect(invalid.isError).toBe(true);
    expect(fixture.calls).toHaveLength(2);
  });

  it('uses SSE for resource updates, preserving invalidation metadata and releasing participation', async () => {
    const fixture = await backend(); const client = await connected(fixture.apiUrl);
    const notification = new Promise<RecordValue>(resolve => client.setNotificationHandler(ResourceUpdatedNotificationSchema, event => resolve(event.params)));
    await client.subscribeResource({ uri: scope.uri });
    await fixture.waitForStream('private-context-1');
    fixture.emit('private-context-1', { cursor: 1, type: 'focus_invalidated', requires_refocus: true, focus: map, affected_uri: scope.uri });
    const event = await notification;
    expect(event.uri).toBe(scope.uri);
    expect(event._meta).toMatchObject({ m3e: { type: 'focus_invalidated', requires_refocus: true } });
    await client.unsubscribeResource({ uri: scope.uri });
    expect(fixture.calls.at(-1)).toEqual({ name: 'm3e_context', arguments: { action: 'leave', context_id: 'private-context-1' } });
  });

  it('rejects foreign and ended context handles before forwarding any operation', async () => {
    const fixture = await backend(); const first = await connected(fixture.apiUrl); const second = await connected(fixture.apiUrl);
    const entered = await first.callTool({ name: 'm3e_context', arguments: { action: 'enter', target: scope.uri } });
    const contextId = (entered.structuredContent as RecordValue).context_id;
    const foreign = await second.callTool({ name: 'm3e_update', arguments: { kind: 'content', context_id: contextId, target: node.uri, text: 'Renamed' } });
    expect(foreign).toMatchObject({ isError: true, structuredContent: { requires_enter: true, error: { code: 'CONTEXT_SESSION_MISMATCH' } } });
    expect(fixture.calls).toHaveLength(1);
    await first.callTool({ name: 'm3e_context', arguments: { action: 'leave', context_id: contextId } });
    const ended = await first.callTool({ name: 'm3e_get', arguments: { kind: 'state', context_id: contextId } });
    expect(ended.isError).toBe(true);
    expect(fixture.calls).toHaveLength(2);
  });

  it('delivers queue-overflow resync control at the current event cursor', async () => {
    const fixture = await backend(); const client = await connected(fixture.apiUrl);
    const notification = new Promise<RecordValue>(resolve => client.setNotificationHandler(ResourceUpdatedNotificationSchema, event => resolve(event.params)));
    await client.subscribeResource({ uri: scope.uri });
    await fixture.waitForStream('private-context-1');
    fixture.emit('private-context-1', { cursor: 0, type: 'resync_required', requires_refocus: true, focus: scope });
    expect((await notification)._meta).toMatchObject({ m3e: { cursor: 0, type: 'resync_required' } });
  });

  it('reconnects from the last delivered event when an MCP notification fails', async () => {
    const fixture = await backend();
    let failed = false;
    const client = await connected(fixture.apiUrl, transport => {
      const send = transport.send.bind(transport);
      transport.send = async (message, options) => {
        const event = message as { method?: string; params?: { _meta?: { m3e?: { cursor?: number } } } };
        if (!failed && event.method === 'notifications/resources/updated' && event.params?._meta?.m3e?.cursor === 2) {
          failed = true;
          throw new Error('Diagnostic transport failure');
        }
        await send(message, options);
      };
    });
    const received: number[] = [];
    const completed = new Promise<void>(resolve => client.setNotificationHandler(ResourceUpdatedNotificationSchema, event => {
      received.push((event.params._meta?.m3e as RecordValue).cursor as number);
      if (received.length === 3) resolve();
    }));
    await client.subscribeResource({ uri: scope.uri });
    await fixture.waitForStream('private-context-1');
    for (const cursor of [1, 2, 3]) fixture.emit('private-context-1', { cursor, type: 'map_changed' });
    await completed;
    expect(failed).toBe(true);
    expect(received).toEqual([1, 2, 3]);
    expect(fixture.streamRequests.map(request => request.after)).toEqual([0, 1]);
  });

  it('rejects nonloopback and credential-bearing backend origins', () => {
    for (const value of ['https://example.com', 'http://127.0.0.1.evil.test', 'file:///tmp/data', 'http://u:p@localhost', 'http://localhost/api', 'http://localhost/?target=evil', 'http://localhost/#x']) expect(() => validateM3eApiUrl(value)).toThrow();
    expect(validateM3eApiUrl('http://127.0.0.1:4173/')).toBe('http://127.0.0.1:4173');
    expect(validateM3eApiUrl('http://[::1]:4173')).toBe('http://[::1]:4173');
  });

  it('runs the SDK Streamable HTTP client and validates Origin/Host on the loopback endpoint', async () => {
    const fixture = await backend(); const app = await startM3eMcpHttp({ apiUrl: fixture.apiUrl, port: 0 });
    const client = new Client({ name: 'HTTP protocol test', version: '1' });
    const transport = new StreamableHTTPClientTransport(new URL(app.url));
    const otherClient = new Client({ name: 'Another HTTP connection', version: '1' });
    const otherTransport = new StreamableHTTPClientTransport(new URL(app.url));
    disposers.unshift(async () => { await client.close(); await otherClient.close(); await app.close(); });
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(7);
    const result = await client.callTool({ name: 'm3e_get', arguments: { kind: 'maps' } });
    expect(result.structuredContent).toMatchObject({ items: [map] });
    const entered = await client.callTool({ name: 'm3e_context', arguments: { action: 'enter', target: scope.uri } });
    const contextId = (entered.structuredContent as RecordValue).context_id;
    await otherClient.connect(otherTransport);
    const foreign = await otherClient.callTool({ name: 'm3e_get', arguments: { kind: 'state', context_id: contextId } });
    expect(foreign).toMatchObject({ isError: true, structuredContent: { error: { code: 'CONTEXT_SESSION_MISMATCH' } } });
    const own = await client.callTool({ name: 'm3e_update', arguments: { kind: 'content', context_id: contextId, target: node.uri, attributes: { status: 'reviewed' } } });
    expect(own.isError).toBe(false);
    expect((await fetch(app.url, { headers: { Origin: 'https://untrusted.example' } })).status).toBe(403);
    const hostileHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      request(app.url, { headers: { Host: 'untrusted.example' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject).end();
    });
    expect(hostileHostStatus).toBe(403);
    await transport.terminateSession();
    await otherTransport.terminateSession();
  });

  it('launches the compiled entrypoint over SDK stdio with protocol-only stdout', async () => {
    const fixture = await backend(); const client = new Client({ name: 'Stdio protocol test', version: '1' });
    const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve('dist/node/start_mcp.js')], env: { M3E_API_URL: fixture.apiUrl }, stderr: 'pipe' });
    const errors: string[] = []; transport.stderr?.on('data', data => errors.push(String(data)));
    disposers.unshift(() => client.close());
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(7);
    const result = await client.callTool({ name: 'm3e_get', arguments: { kind: 'maps' } });
    expect(result.isError).toBe(false);
    expect(errors).toEqual([]);
  });
});
