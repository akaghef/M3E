import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SubscribeRequestSchema, UnsubscribeRequestSchema, McpError, ErrorCode, type CallToolResult, type ResourceLink } from '@modelcontextprotocol/sdk/types.js';
import { createParser } from 'eventsource-parser';
import { z } from 'zod';

type RecordValue = Record<string, unknown>;
type Reference = { uri: string; name: string; kind?: string; map_name?: string };
type Watch = { controller: AbortController; cursor: number; uris: Set<string>; finished?: Promise<void> };

export interface M3eMcpOptions {
  apiUrl?: string;
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
}

export const M3E_MCP_INSTRUCTIONS = `M3E is a graphical workspace of maps, nodes and scopes. A scope is an explicit cognition/editing boundary within a map; ordinary hierarchy does not create a scope. Discover maps with m3e_get (kind maps or search), or use a supplied M3E resource URI, then enter it with m3e_context. Keep the returned context_id for subsequent operations. A context has one focus and multiple subscriptions. Tool results contain human summaries and structured machine references; display names to humans, not identifiers.
The six tools contain the normal workflow; no local skill, repository instruction or prompt is required. Resources m3e://docs/glossary, m3e://docs/data-model, m3e://docs/map-manager and m3e://docs/operations provide canonical meaning, structural judgment and operation guidance. Reading a resource does not join or subscribe. Tools return bounded state, pagination and retained revision information. Continue using returned context and references; do not repeatedly fetch a whole map, generate node IDs, edit raw state, or recolor automatically. Review changed_nodes in a change event, then use its revision as expected_revision to acknowledge the change without another GET. If requires_read is true, read the changed target first. A focus-invalidated/resync event or failed consistency check requires re-evaluating the requested target and explicitly focusing a surviving scope before writing. Never silently retry a write against a new focus.`;

export const M3E_DOC_RESOURCES = [
  { key: 'glossary', name: 'M3E vocabulary', description: 'Canonical meaning of map, node, scope, edge, GraphLink, alias and display terms.' },
  { key: 'data-model', name: 'M3E data model', description: 'Canonical Content, Topology, Layout and Style model and persistent invariants.' },
  { key: 'map-manager', name: 'M3E structural guidance', description: 'Canonical scope purpose, hierarchy and relation decisions, explicit constraints and verification.' },
  { key: 'operations', name: 'M3E operations', description: 'Canonical MCP participation, retained context, change handling and operation guidance.' },
] as const;

/** Only the existing local app may be addressed. Resource/tool arguments never become fetch URLs. */
export function validateM3eApiUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('M3E_API_URL must be a loopback HTTP origin without credentials, path, query or fragment.');
  }
  return url.origin;
}

function record(value: unknown): RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as RecordValue : {};
}

function references(value: unknown): Reference[] {
  return Array.isArray(value) ? value.filter((item): item is Reference => {
    const candidate = record(item);
    return typeof candidate.uri === 'string' && typeof candidate.name === 'string';
  }) : [];
}

function reference(value: unknown): Reference | undefined { return references([value])[0]; }

function resultSummary(name: string, value: RecordValue): string {
  if (value.ok === false) {
    const error = record(value.error);
    return typeof error.message === 'string' ? error.message : 'M3E could not complete the operation. Review the structured error before retrying.';
  }
  const focus = reference(value.focus);
  const target = reference(value.target);
  const changed = record(value.changed);
  if (name === 'm3e_feedback') return 'Feedback recorded.';
  if (name === 'm3e_context') return focus ? `Context ready at ${focus.name}. ${references(value.subscriptions).length} subscriptions.` : 'Context updated.';
  if (name === 'm3e_get') {
    const items = references(value.items);
    if (Array.isArray(value.items)) return `${items.length} results${typeof value.total === 'number' ? ` of ${value.total}` : ''}${items.length ? `: ${items.slice(0, 12).map(item => item.name).join(', ')}` : '.'}${items.length > 12 ? '…' : ''}`;
    return `${target?.name || 'Map content'}: ${Array.isArray(value.nodes) ? value.nodes.length : 0} nodes returned${value.next_offset !== null && value.next_offset !== undefined ? '; more results available' : ''}.`;
  }
  const counts = ['created', 'updated', 'deleted'].flatMap(key => typeof changed[key] === 'number' ? [`${changed[key]} ${key}`] : []);
  return `Change saved${counts.length ? `: ${counts.join(', ')}` : ''}${focus ? ` in ${focus.name}` : ''}.`;
}

const targetSchema = z.string().min(1).max(4096).describe('Canonical M3E resource URI returned by discovery, e.g. m3e://maps/{map_id}/scopes/{node_id}, or human path M:(map label)> Parent >> Scope. Use > within a scope and >> at a scope boundary; never guess ambiguous names.');
const contextSchema = z.string().min(1).max(100).describe('Opaque context_id returned by m3e_context enter. Keep it internally; use the returned human focus name in reports.');
const revisionSchema = z.string().min(1).max(256).optional().describe('Normally omit: Core uses the retained baseline and rejects stale writes. After reviewing a relevant changed_nodes event, pass its revision to acknowledge that delta without another GET. Invalidated focus still requires explicit refocus.');
const attributesSchema = z.record(z.string().min(1).max(100), z.union([z.string().max(10_000), z.null()])).optional().describe('Merge patch for explicitly requested node attributes (for example status): string sets a value; null deletes the named key. Preserve unrelated attributes and do not add style changes without instruction.');
const paging = {
  offset: z.number().int().nonnegative().optional().describe('Node/result offset; follow next_offset from the prior result.'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum results per page (1–100).'),
};

export function createM3eMcpServer(options: M3eMcpOptions = {}): { server: McpServer; close: () => Promise<void> } {
  const apiUrl = validateM3eApiUrl(options.apiUrl ?? process.env.M3E_API_URL ?? 'http://127.0.0.1:4173');
  const fetcher = options.fetch ?? fetch;
  const timeout = options.requestTimeoutMs ?? 15_000;
  const server = new McpServer({ name: 'm3e', title: 'M3E', version: '0.1.0' }, {
    instructions: M3E_MCP_INSTRUCTIONS,
    capabilities: { resources: { subscribe: true }, logging: {}, experimental: { 'openai/mentions': { searchTool: 'mentions_search' } } },
  });
  const watches = new Map<string, Watch>();
  const resourceContexts = new Map<string, string>();
  const contexts = new Set<string>();
  let closed = false;

  async function request(path: string, init: RequestInit = {}): Promise<RecordValue> {
    const response = await fetcher(`${apiUrl}${path}`, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeout) });
    if (!response.ok && (response.status < 400 || response.status >= 500)) throw new Error(`The local M3E app returned HTTP ${response.status}. Check that Beta is running with MCP support.`);
    const result = record(await response.json());
    if (typeof result.ok !== 'boolean') throw new Error('The local M3E app returned an invalid response. Check that Beta includes MCP support.');
    if (!response.ok && result.ok !== false) throw new Error('The local M3E app returned an invalid error response.');
    return result;
  }

  const call = (name: string, args: RecordValue) => request('/api/mcp/call', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, arguments: args }),
  });

  async function doc(key: string): Promise<string> {
    const result = await request(`/api/mcp/docs?name=${encodeURIComponent(key)}`);
    if (result.ok === false || typeof result.text !== 'string') throw new McpError(ErrorCode.InternalError, 'Canonical M3E document is unavailable.');
    return result.text;
  }

  function pause(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise(resolve => {
      if (signal.aborted) { resolve(); return; }
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
      const timer = setTimeout(finish, ms);
      signal.addEventListener('abort', finish, { once: true });
    });
  }

  async function notify(watch: Watch, event: RecordValue): Promise<void> {
    const cursor = typeof event.cursor === 'number' ? event.cursor : watch.cursor;
    // Overflow control messages describe a gap after the current cursor, so they
    // deliberately reuse it. Ordinary replayed changes remain deduplicated.
    if (cursor < watch.cursor || (cursor === watch.cursor && event.type !== 'resync_required')) return;
    const uris = new Set(watch.uris);
    const newFocus = reference(event.focus);
    if (newFocus) uris.add(newFocus.uri);
    for (const uri of uris) await server.server.sendResourceUpdated({ uri, _meta: { m3e: event } });
    if (event.requires_refocus || event.type === 'resync_required') {
      await server.server.sendLoggingMessage({ level: 'warning', logger: 'M3E', data: 'M3E context changed. Re-evaluate the target and focus a surviving scope before the next write.' });
    }
    watch.cursor = cursor;
  }

  async function stream(contextId: string, watch: Watch): Promise<void> {
    let delay = 500;
    while (!watch.controller.signal.aborted && !closed) {
      try {
        const query = new URLSearchParams({ context_id: contextId, after: String(watch.cursor) });
        const response = await fetcher(`${apiUrl}/api/mcp/events/stream?${query}`, { redirect: 'error', headers: { Accept: 'text/event-stream' }, signal: watch.controller.signal });
        if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('M3E event stream unavailable.');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const pending: RecordValue[] = [];
        const parser = createParser({ onEvent: message => {
          if (message.event !== 'change' && message.event !== undefined) return;
          pending.push(record(JSON.parse(message.data)));
        } });
        try {
          while (!closed) {
            const part = await reader.read();
            if (part.done) break;
            parser.feed(decoder.decode(part.value, { stream: true }));
            // Stop on the first delivery failure. A later success must never move
            // the replay cursor past an event that the MCP transport rejected.
            for (const event of pending.splice(0)) await notify(watch, event);
          }
        } finally {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
        delay = 500;
      } catch {
        // Reconnect from the last delivered cursor. Reading the stream never acknowledges Core's queue.
      }
      if (!watch.controller.signal.aborted && !closed) await pause(delay, watch.controller.signal);
      delay = Math.min(delay * 2, 5000);
    }
  }

  function retain(result: RecordValue): void {
    if (result.ok === false || typeof result.context_id !== 'string') return;
    const contextId = result.context_id;
    contexts.add(contextId);
    const uris = new Set(references(result.subscriptions).map(item => item.uri));
    const focus = reference(result.focus);
    if (focus) uris.add(focus.uri);
    const existing = watches.get(contextId);
    if (existing) { if (uris.size) existing.uris = uris; return; }
    const watch: Watch = { controller: new AbortController(), cursor: typeof result.event_cursor === 'number' ? result.event_cursor : 0, uris };
    watches.set(contextId, watch);
    watch.finished = stream(contextId, watch);
  }

  async function leave(contextId: string): Promise<void> {
    watches.get(contextId)?.controller.abort();
    watches.delete(contextId);
    contexts.delete(contextId);
    await call('m3e_context', { action: 'leave', context_id: contextId });
  }

  async function invoke(name: string, args: RecordValue): Promise<CallToolResult> {
    if (args.context_id !== undefined && (typeof args.context_id !== 'string' || !contexts.has(args.context_id))) {
      const message = 'This participation belongs to another connection or has ended. Enter the intended map or scope in this connection before continuing.';
      return { isError: true, content: [{ type: 'text', text: message }], structuredContent: { ok: false, error: { code: 'CONTEXT_SESSION_MISMATCH', message }, requires_enter: true } };
    }
    try {
      const result = await call(name, args);
      if (name === 'm3e_context' && args.action === 'leave' && typeof args.context_id === 'string' && result.ok !== false) {
        watches.get(args.context_id)?.controller.abort(); watches.delete(args.context_id); contexts.delete(args.context_id);
      } else retain(result);
      return { content: [{ type: 'text', text: resultSummary(name, result) }], structuredContent: result, isError: result.ok === false };
    } catch (error) {
      const message = error instanceof Error && error.message.startsWith('The local M3E app') ? error.message : 'M3E could not be reached. Check that the local Beta app is running, then retry.';
      return { isError: true, content: [{ type: 'text', text: message }], structuredContent: { ok: false, error: { code: 'backend_unavailable', message } } };
    }
  }

  server.registerTool('m3e_context', {
    title: 'Join and focus M3E',
    description: 'Enter a map/scope target to get a retained context, focus, subscriptions and a compact snapshot. enter requires target; focus changes the one focus and requires context_id + target; subscribe/unsubscribe change additional target subscriptions; leave closes context_id. Keep context_id for later tools. Focus changes do not discard other subscriptions. Read resources without entering when only reference material is needed. After focus_invalidated or resync_required, review the returned focus/event and explicitly focus the intended surviving target before writing. Canon: m3e://docs/glossary and m3e://docs/map-manager.',
    inputSchema: z.object({ action: z.enum(['enter', 'focus', 'subscribe', 'unsubscribe', 'leave']), target: targetSchema.optional(), context_id: contextSchema.optional() }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, args => invoke('m3e_context', args));
  server.registerTool('m3e_get', {
    title: 'Read M3E maps',
    description: 'Discover with kind maps; find human names with kind search + query; read a map/scope/node with kind state and target or retained context_id. Returns canonical resource URIs, human names, bounded results and pagination. Read-only; no participation is started. Independently follow next_offset via offset for nodes/results, next_link_offset via link_offset for GraphLinks, and next_payload_offset via payload_offset for scope_payload (linear notes, annotations, scopes and surfaces). Large payload records may have value_preview and content_truncated instead of the full value; copies preserve the complete content. Normal consecutive edits use retained context and tool change results; no repeated whole-map GET is required.',
    inputSchema: z.object({ kind: z.enum(['maps', 'search', 'state']), target: targetSchema.optional(), context_id: contextSchema.optional(), query: z.string().min(1).max(200).optional(), ...paging, link_offset: z.number().int().nonnegative().optional(), payload_offset: z.number().int().nonnegative().optional().describe('Independent scope payload offset; use next_payload_offset to continue notes, annotations, scope and surface records.') }).strict(),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, args => invoke('m3e_get', args));
  server.registerTool('m3e_create', {
    title: 'Create M3E content',
    description: 'Create beneath target (destination parent; defaults to retained focus). kind node uses text; kind copy uses source and copies the complete source subtree while preserving content, structure and metadata; kind import_mfh uses mfh to create an entire hierarchy atomically. kind import_structure takes structure {roots,nodes:[{id,title,parent,children}]} and import_key, atomically appends one explicitly requested scope and deduplicates retries. MF-H is Markdown heading tree text: # Root, ## Child, ### Grandchild; start with #, never skip levels, and use details: lines for heading details. Every heading creates an ordinary node, never a scope. Example mfh: "# Animals\n## Mammals\n### Whale". IDs, placement and persistence are handled by existing Core. Preserve user Content/Topology/Layout/Style constraints; do not invent scope boundaries or recolor. Canon: m3e://docs/data-model and m3e://docs/map-manager.',
    inputSchema: z.object({ kind: z.enum(['node', 'copy', 'import_mfh', 'import_structure']), context_id: contextSchema, target: targetSchema.optional(), text: z.string().min(1).max(32_000).optional(), attributes: attributesSchema, source: targetSchema.optional(), mfh: z.string().min(1).max(300_000).optional(), structure: z.object({ roots: z.array(z.string()), nodes: z.array(z.object({ id: z.string(), title: z.string(), parent: z.string().nullable(), children: z.array(z.string()) }).passthrough()) }).passthrough().optional(), import_key: z.string().min(1).max(200).optional(), expected_revision: revisionSchema }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, args => invoke('m3e_create', args));
  server.registerTool('m3e_update', {
    title: 'Update M3E content or structure',
    description: 'Change only the named target inside a retained context. kind content uses text; kind move changes tree ownership to parent; scopen creates an explicit scope boundary; unscopen removes that boundary while preserving its content. Hierarchy/node count alone never implies a scope: establish its cognition/editing purpose first using m3e://docs/map-manager. A tree edge is ownership, GraphLink is a non-tree relation, alias is a reference window. Never silently replace one with another. Retained consistency checks reject stale changes; reconsider a focus-invalidated context rather than retrying against its fallback focus.',
    inputSchema: z.object({ kind: z.enum(['content', 'move', 'scopen', 'unscopen']), context_id: contextSchema, target: targetSchema, text: z.string().min(1).max(32_000).optional(), attributes: attributesSchema, parent: targetSchema.optional(), expected_revision: revisionSchema }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, args => invoke('m3e_update', args));
  server.registerTool('m3e_delete', {
    title: 'Delete M3E content',
    description: 'Delete the explicitly named target subtree in the retained context. This removes its descendants as well; choose unscopen with m3e_update to remove only a scope boundary. Deleting a subscribed/focused scope invalidates old assumptions and moves affected context focus to a surviving ancestor; subsequent writes are blocked until explicit refocus. Preserve unrelated content and use only when deletion is authorized.',
    inputSchema: z.object({ context_id: contextSchema, target: targetSchema, expected_revision: revisionSchema }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, args => invoke('m3e_delete', args));
  server.registerTool('m3e_feedback', {
    title: 'Record M3E feedback',
    description: 'Persist a bounded feedback/reproduction note using what and optional why, where, when, who, how. Attach context_id when related to the current map. Records experience for a later session; does not change map content. Describe human names and observable behavior, never credentials or secrets.',
    inputSchema: z.object({ context_id: contextSchema.optional(), what: z.string().min(1).max(10_000), why: z.string().max(10_000).optional(), where: z.string().max(10_000).optional(), when: z.string().max(10_000).optional(), who: z.string().max(10_000).optional(), how: z.string().max(10_000).optional() }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, args => invoke('m3e_feedback', args));

  server.registerTool('mentions_search', {
    title: 'Find an M3E map or scope', description: 'Application-only mention autocomplete. Search map/scope human names and return resource links; selecting or reading a result does not join it. Pass its URI to m3e_context enter to participate.',
    inputSchema: z.object({ query: z.string().max(200) }).strict(), annotations: { readOnlyHint: true, openWorldHint: false }, _meta: { ui: { visibility: ['app'] } },
  }, async ({ query }) => {
    try {
      const items: ResourceLink[] = [];
      let offset = 0;
      do {
        const result = await call('m3e_get', { kind: 'search', ...(query.trim() ? { query } : {}), offset, limit: 100 });
        if (result.ok === false) return { isError: true, content: [], structuredContent: { items: [], error: result.error } };
        for (const item of references(result.items)) {
          if (item.kind !== 'map' && item.kind !== 'scope') continue;
          items.push({ type: 'resource_link', uri: item.uri, name: item.name, title: item.name, description: item.kind === 'scope' ? `Scope in ${item.map_name || 'M3E'}` : 'M3E map', mimeType: 'application/json' });
          if (items.length >= 20) break;
        }
        if (typeof result.next_offset !== 'number' || result.next_offset <= offset) break;
        offset = result.next_offset;
      } while (items.length < 20);
      return { content: [], structuredContent: { items } };
    } catch { return { isError: true, content: [], structuredContent: { items: [], error: 'The local M3E app is unavailable.' } }; }
  });

  for (const item of M3E_DOC_RESOURCES) {
    server.registerResource(item.name, `m3e://docs/${item.key}`, { title: item.name, description: item.description, mimeType: 'text/markdown' }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: await doc(item.key) }] }));
  }
  for (const item of [
    { name: 'M3E map', template: 'm3e://maps/{map_id}' },
    { name: 'M3E scope', template: 'm3e://maps/{map_id}/scopes/{node_id}' },
    { name: 'M3E node', template: 'm3e://maps/{map_id}/nodes/{node_id}' },
  ]) {
    server.registerResource(item.name, new ResourceTemplate(item.template, { list: undefined }), { title: item.name, description: 'Read a bounded state snapshot without entering or subscribing. Resolve canonical URIs with m3e_get or a map/scope mention.', mimeType: 'application/json' }, async uri => {
      const result = await call('m3e_get', { kind: 'state', target: uri.href });
      if (result.ok === false) throw new McpError(-32002, resultSummary('m3e_get', result));
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(result) }] };
    });
  }

  server.registerPrompt('m3e_structure', {
    title: 'Plan M3E hierarchy and scopes', description: 'Use canonical M3E structural guidance to reason about hierarchy, scope purpose and explicit Content/Topology/Layout/Style constraints. Optional; ordinary tools remain usable without prompts.',
    argsSchema: { intent: z.string().describe('The user goal and any explicit structural constraints.'), target: z.string().optional().describe('Human path or previously resolved M3E resource URI.') },
  }, async ({ intent, target }) => ({
    description: 'M3E canonical structural guidance', messages: [
      { role: 'user', content: { type: 'text', text: `Apply the canonical guidance below to this request. Preserve explicit constraints; identify unresolved structural judgment before writing.\nRequest: ${intent}${target ? `\nTarget: ${target}` : ''}` } },
      { role: 'user', content: { type: 'resource', resource: { uri: 'm3e://docs/map-manager', mimeType: 'text/markdown', text: await doc('map-manager') } } },
    ],
  }));

  server.server.setRequestHandler(SubscribeRequestSchema, async ({ params }) => {
    if (!/^m3e:\/\/maps\/[^/?#]+(?:\/(?:scopes|nodes)\/[^/?#]+)?$/.test(params.uri)) throw new McpError(ErrorCode.InvalidParams, 'Subscribe to a canonical M3E map, scope or node resource.');
    if (resourceContexts.has(params.uri)) return {};
    const result = await call('m3e_context', { action: 'enter', target: params.uri });
    if (result.ok === false || typeof result.context_id !== 'string') throw new McpError(-32002, resultSummary('m3e_context', result));
    resourceContexts.set(params.uri, result.context_id); retain(result);
    watches.get(result.context_id)?.uris.add(params.uri);
    return {};
  });
  server.server.setRequestHandler(UnsubscribeRequestSchema, async ({ params }) => {
    const contextId = resourceContexts.get(params.uri);
    if (contextId) { resourceContexts.delete(params.uri); await leave(contextId); }
    return {};
  });

  async function cleanup(): Promise<void> {
    if (closed) return;
    closed = true;
    for (const watch of watches.values()) watch.controller.abort();
    await Promise.allSettled([...contexts].map(contextId => leave(contextId)));
    resourceContexts.clear();
  }
  server.server.onclose = () => { void cleanup(); };
  return { server, close: async () => { await cleanup(); await server.close(); } };
}
