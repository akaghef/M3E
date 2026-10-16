#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { runtimeConfig, pluginRoot } from './runtime.mjs';
import { ttl, digest, sessionPath, contextPath, pendingPath, readJson, writeJson, removeContext, fetchJson, leaveContext, eventsUrl, pruneExpired, withSessionLock } from './hook-state.mjs';

const phase = process.argv[2];
const writes = new Set(['m3e_create', 'm3e_update', 'm3e_delete']);
const toolName = name => typeof name === 'string' ? name.match(/^(?:mcp__.+__)?(m3e_(?:context|get|create|update|delete|feedback))$/)?.[1] : undefined;
const output = value => process.stdout.write(`${JSON.stringify(value)}\n`);
const deny = message => output({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: message, additionalContext: message } });
const inform = message => output({ hookSpecificOutput: { hookEventName: phase, additionalContext: message } });
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 1024;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const inputHash = args => digest(JSON.stringify(canonical(args)));
// Codex passes the MCP result object ({ structuredContent, isError }); Claude Code
// passes the tool's text content, as a JSON string or as content blocks.
const parseText = text => { try { const value = JSON.parse(text); return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined; } catch { return undefined; } };
const toolResult = response => {
  if (typeof response === 'string') return parseText(response);
  if (Array.isArray(response)) { const block = response.find(item => item?.type === 'text'); return block ? parseText(block.text) : undefined; }
  if (!response || response.isError) return undefined;
  if (response.structuredContent) return response.structuredContent;
  return Array.isArray(response.content) ? toolResult(response.content) : undefined;
};
let ownWrite = false;
let parsed = false;

async function ensureListener(directory, binding) {
  const lock = path.join(directory, 'listener.json');
  const existing = await readJson(lock).catch(() => undefined);
  if (existing?.expires_at > Date.now()) return;
  const token = randomUUID();
  try {
    await fs.writeFile(lock, JSON.stringify({ token, expires_at: Date.now() + 3000 }), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const lockState = await readJson(lock).catch(() => undefined);
    if (lockState?.expires_at > Date.now()) return;
    await fs.rm(lock, { force: true });
    return ensureListener(directory, binding);
  }
  const child = spawn(process.execPath, [path.join(pluginRoot, 'scripts', 'listen.mjs'), directory, token], {
    detached: true, stdio: 'ignore', env: process.env,
  });
  child.on('error', () => { /* Canonical catch-up in PreToolUse remains mandatory. */ });
  child.unref();
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('Hook input is too large.');
  }
  let input;
  try { input = JSON.parse(raw); }
  catch { if (phase === 'PreToolUse') deny('M3E could not verify this tool call because its hook input is malformed. Retry after restoring the hook.'); return; }
  parsed = true;
  if (phase !== input.hook_event_name) return;
  if (phase === 'SessionEnd') {
    if (!validId(input.session_id)) return;
    const directory = sessionPath(input.session_id);
    const bindings = await withSessionLock(input.session_id, async () => {
      const contexts = await fs.readdir(path.join(directory, 'contexts')).catch(() => []);
      const values = await Promise.all(contexts.map(context => readJson(path.join(directory, 'contexts', context, 'binding.json')).catch(() => undefined)));
      // Remove local ownership immediately, so listeners stop even if leave fails.
      await fs.rm(directory, { recursive: true, force: true });
      return values;
    });
    await Promise.allSettled(bindings.filter(Boolean).map(leaveContext));
    return;
  }
  const name = toolName(input.tool_name);
  if (!name) return; // Never hold up unrelated tools.
  ownWrite = phase === 'PreToolUse' && writes.has(name);
  if (!validId(input.session_id) || !validId(input.tool_use_id) || !input.tool_input || typeof input.tool_input !== 'object') {
    if (ownWrite) deny('M3E cannot verify the local session and tool call. Restore the session hook before writing.');
    return;
  }
  const args = input.tool_input;
  const pendingFile = pendingPath(input.session_id, input.tool_use_id);
  if (phase === 'PreToolUse') {
    await pruneExpired();
    const { apiUrl } = await runtimeConfig();
    if (ownWrite) {
      if (!validId(args.context_id)) { deny('M3E writing requires the context returned by m3e_context. Enter a Map or Scope first.'); return; }
      const directory = contextPath(input.session_id, args.context_id);
      const binding = await readJson(path.join(directory, 'binding.json'));
      if (!binding || binding.expires_at <= Date.now() || binding.apiUrl !== apiUrl) {
        deny('M3E has no current context binding for this session and endpoint. Enter the target Map or Scope before writing.'); return;
      }
      const queue = await readJson(path.join(directory, 'queue.json')).catch(() => undefined);
      // This reads event deltas, never a Map snapshot, and does not acknowledge events.
      const current = await fetchJson(eventsUrl(binding));
      if (!Array.isArray(current.events) || !Number.isFinite(current.event_cursor)) throw new Error('M3E returned malformed events.');
      const events = [...(queue?.events || []), ...current.events].filter(event => event.cursor > binding.event_cursor);
      if (current.requires_refocus || current.resync_required || (queue?.resync_required && queue.event_cursor > binding.event_cursor) || events.some(event => event.requires_refocus || ['focus_invalidated', 'subscription_invalidated', 'resync_required'].includes(event.type))) {
        const focus = current.focus?.name || 'an available Scope';
        deny(`M3E changed the selected Scope or its subscriptions. The pending write was stopped. Current focus: ${focus}. Review the returned changes, then explicitly select a valid focus with m3e_context before writing again.`); return;
      }
      if (events.length) {
        const unique = [...new Map(events.map(event => [event.cursor, event])).values()].sort((a, b) => a.cursor - b.cursor);
        const latest = unique.at(-1);
        const delta = JSON.stringify(unique);
        // The host limit is in approximate tokens. Bound UTF-8 bytes below it,
        // including multibyte text, so the complete delta remains inline.
        const limited = Buffer.byteLength(delta, 'utf8') <= 20_000;
        const incomplete = !limited || unique.some(event => event.requires_read === true);
        if (incomplete || typeof args.expected_revision !== 'string' || args.expected_revision !== latest.revision) {
          const explanation = incomplete
            ? 'The change exceeds the retained delta. Read the changed target with m3e_get, then reconsider the operation.'
            : 'Review the changes and reconsider the operation. A revised write may acknowledge the shown revision with expected_revision; another GET is not required for a complete delta.';
          output({ hookSpecificOutput: {
            hookEventName: 'PreToolUse', permissionDecision: 'deny',
            permissionDecisionReason: 'M3E has unread changes affecting this context. The pending write was stopped for review.',
            additionalContext: limited ? `${explanation}\nM3E event data: ${delta}` : 'The unread changes exceed the hook context limit. Read the changed target with m3e_get before reconsidering this operation.',
          } }); return;
        }
      }
      await withSessionLock(input.session_id, async () => {
        const live = await readJson(path.join(directory, 'binding.json'));
        if (!live || live.expires_at <= Date.now() || live.apiUrl !== apiUrl) throw new Error('The session ended during the pending change check.');
        await writeJson(path.join(directory, 'binding.json'), { ...live, expires_at: Date.now() + ttl });
        await ensureListener(directory, live);
        await writeJson(pendingFile, { name, input_hash: inputHash(args), context_id: args.context_id, apiUrl, expires_at: Date.now() + ttl });
      });
      return;
    }
    await withSessionLock(input.session_id, () => writeJson(pendingFile, { name, input_hash: inputHash(args), context_id: args.context_id, apiUrl, expires_at: Date.now() + ttl }));
    return;
  }
  if (phase !== 'PostToolUse') return;
  await withSessionLock(input.session_id, async () => {
  const pending = await readJson(pendingFile);
  await fs.rm(pendingFile, { force: true });
  if (!pending || pending.expires_at <= Date.now() || pending.name !== name || pending.input_hash !== inputHash(args)) return;
  const result = toolResult(input.tool_response);
  if (!result || result.ok === false || !validId(result.context_id)) return;
  if (pending.context_id && pending.context_id !== result.context_id) {
    inform('M3E returned a different context from the requested one. The local binding was not changed; enter the intended Scope again.'); return;
  }
  const directory = contextPath(input.session_id, result.context_id);
  if (result.left) { await removeContext(directory); return; }
  const previous = await readJson(path.join(directory, 'binding.json'));
  const focus = result.focus || previous?.focus;
  if (!Number.isFinite(result.event_cursor) || !focus || !['string', 'number'].includes(typeof result.revision)) return;
  // Only this session's successful enter may establish local ownership.
  if (!previous && (name !== 'm3e_context' || args.action !== 'enter' || args.context_id !== undefined)) return;
  if (previous && result.event_cursor < previous.event_cursor) return;
  const binding = {
    context_id: result.context_id, apiUrl: pending.apiUrl, revision: result.revision,
    event_cursor: result.event_cursor, focus, requires_refocus: !!result.requires_refocus,
    bound_tool_use_id: previous?.bound_tool_use_id || input.tool_use_id,
    last_tool_use_id: input.tool_use_id, expires_at: Date.now() + ttl,
  };
  await writeJson(path.join(directory, 'binding.json'), binding);
  await ensureListener(directory, binding);
  });
}

try { await main(); }
catch {
  if (ownWrite || (!parsed && phase === 'PreToolUse')) deny('M3E could not verify pending context changes. The write was stopped. Restore the M3E connection or re-enter the target Scope, then retry.');
  // A failed post/end hook never prevents unrelated work. Server TTL and atomic
  // context validation are required independently of this host-level hook.
}
