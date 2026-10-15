#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson, writeJson, leaveContext, removeContext, eventsUrl, withSessionDirectoryLock } from './hook-state.mjs';

const directory = process.argv[2];
const token = process.argv[3];
if (!directory || !token) process.exit(2);
const bindingFile = path.join(directory, 'binding.json');
const queueFile = path.join(directory, 'queue.json');
const lockFile = path.join(directory, 'listener.json');
const sessionDirectory = path.dirname(path.dirname(directory));
let stopping = false;
let controller;
let binding;

async function refresh() {
  return withSessionDirectoryLock(sessionDirectory, async () => {
  const lock = await readJson(lockFile).catch(() => undefined);
  if (lock?.token !== token) { stopping = true; controller?.abort(); return; }
  binding = await readJson(bindingFile).catch(() => undefined);
  if (!binding || binding.expires_at <= Date.now()) {
    stopping = true;
    controller?.abort();
    return;
  }
  await writeJson(lockFile, { token, expires_at: Date.now() + 3000 });
  });
}

async function storeEvent(event) {
  if (!event || !Number.isSafeInteger(event.cursor)) return;
  return withSessionDirectoryLock(sessionDirectory, async () => {
  const current = await readJson(bindingFile).catch(() => undefined);
  if (!current || current.expires_at <= Date.now()) return;
  const queue = await readJson(queueFile).catch(() => undefined);
  const unique = new Map((queue?.events || []).filter(item => item.cursor > current.event_cursor).map(item => [item.cursor, item]));
  if (event.cursor > current.event_cursor) unique.set(event.cursor, event);
  const events = [...unique.values()].sort((a, b) => a.cursor - b.cursor);
  await writeJson(queueFile, {
    event_cursor: Math.max(event.cursor, queue?.event_cursor || 0),
    resync_required: events.length > 256 || event.type === 'resync_required' || (queue?.resync_required && queue.event_cursor > current.event_cursor),
    events: events.slice(-256),
  });
  });
}

await refresh();
const heartbeat = setInterval(() => { refresh().catch(() => { stopping = true; controller?.abort(); }); }, 500);
try {
  while (!stopping) {
    controller = new AbortController();
    try {
      const queue = await readJson(queueFile).catch(() => undefined);
      const url = eventsUrl(binding, Math.max(binding.event_cursor, queue?.event_cursor || 0));
      url.pathname += '/stream';
      const response = await fetch(url, { headers: { accept: 'text/event-stream' }, signal: controller.signal });
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('No event stream.');
      const decoder = new TextDecoder();
      let buffer = '';
      for await (const chunk of response.body) {
        if (stopping) break;
        buffer += decoder.decode(chunk, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');
        if (buffer.length > 1_000_000) throw new Error('Event stream exceeded its limit.');
        let end;
        while ((end = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (data) {
            const event = JSON.parse(data);
            if (event.type === 'context_left') { stopping = true; controller.abort(); break; }
            await storeEvent(event);
          }
        }
      }
    } catch { /* The next write always catches up from the authoritative queue. */ }
    if (!stopping) await new Promise(resolve => setTimeout(resolve, 500));
  }
} finally {
  clearInterval(heartbeat);
  let expired;
  await withSessionDirectoryLock(sessionDirectory, async () => {
  const lock = await readJson(lockFile).catch(() => undefined);
  const current = await readJson(bindingFile).catch(() => undefined);
  if (lock?.token === token) {
    if (current?.expires_at <= Date.now()) {
      expired = current;
      await removeContext(directory).catch(() => {});
    } else await fs.rm(lockFile, { force: true }).catch(() => {});
  }
  }).catch(() => {});
  if (expired) await leaveContext(expired).catch(() => {});
}
