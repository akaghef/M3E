"use strict";

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type http from "http";
import type { AppState, SavedMap, TreeNode } from "../shared/types";
import { parseMapPath, resolveNodePath } from "../shared/path_resolve";
import { parseIndentedTextToNodes } from "./indented_text_parser";
import { RapidMvpModel } from "./rapid_mvp";

const TOOLS = ["m3e_context", "m3e_get", "m3e_create", "m3e_update", "m3e_delete", "m3e_feedback"];
const DOCUMENTS = ["glossary", "data-model", "map-manager", "operations"].map((name) => `m3e://docs/${name}`);
const MAX_CONTEXTS = 256;
const MAX_EVENTS = 256;
const MAX_BATCH = 1000;
const MAX_TEXT = 32_000;
const CONTEXT_TTL = 8 * 60 * 60 * 1000;
type Args = Record<string, unknown>;
type Ref = { mapId: string; nodeId: string; kind: "map" | "scope" | "node"; uri: string; name: string; ancestors: string[] };
type Event = { cursor: number; type: string; message: string; [key: string]: unknown };
type Context = {
  id: string; dbPath: string; focus: Ref | null; subscriptions: Map<string, Ref>;
  baseline: Map<string, SavedMap>; observed: Map<string, string>; invalidated: boolean;
  events: Event[]; cursor: number; touched: number; listeners: Set<(event: Event) => void>;
};
export interface M3eMcpServiceOptions {
  dbPath: () => string;
  feedbackDir: () => string;
  onSaved?: (mapId: string, savedAt: string) => void;
  canWrite?: (mapId: string) => string | null;
}
class McpError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
function fail(code: string, message: string): never { throw new McpError(code, message); }
function object(value: unknown): Args {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_ARGUMENT", "Arguments must be an object.");
  return value as Args;
}
function str(value: unknown, label: string, max = MAX_TEXT): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) fail("INVALID_ARGUMENT", `${label} must be nonempty text within ${max} characters.`);
  return value;
}
function fields(args: Args, allowed: string[]): void {
  if (Object.keys(args).some((key) => !allowed.includes(key))) fail("INVALID_ARGUMENT", "An unsupported argument was supplied.");
}
function page(args: Args, key = "offset", defaultValue = 0, max = Number.MAX_SAFE_INTEGER): number {
  const value = args[key] ?? defaultValue;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > max) fail("INVALID_ARGUMENT", `${key} is outside the supported range.`);
  return value;
}
function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function name(node: TreeNode): string { return (node.aliasLabel || node.text || "Untitled").slice(0, 240); }
function publicRef(ref: Ref | null): {uri: string; name: string; kind: string} | null {
  return ref ? { uri: ref.uri, name: ref.name, kind: ref.kind } : null;
}
function mapUri(id: string): string { return `m3e://maps/${encodeURIComponent(id)}`; }
function refFor(mapId: string, state: AppState, nodeId: string, kind?: Ref["kind"]): Ref {
  const node = state.nodes[nodeId];
  if (!node) fail("TARGET_NOT_FOUND", "The requested node no longer exists.");
  const type = kind ?? (nodeId === state.rootId ? "map" : node.nodeType === "folder" ? "scope" : "node");
  const ancestors: string[] = [];
  let parent = node.parentId;
  while (parent && state.nodes[parent] && !ancestors.includes(parent)) {
    ancestors.push(parent); parent = state.nodes[parent]!.parentId;
  }
  return { mapId, nodeId, kind: type, name: name(node), uri: type === "map" ? mapUri(mapId) : `${mapUri(mapId)}/${type === "scope" ? "scopes" : "nodes"}/${encodeURIComponent(nodeId)}`, ancestors };
}
function saved(db: string, mapId: string): SavedMap {
  try { return RapidMvpModel.loadSavedMapFromSqlite(db, mapId); }
  catch { return fail("MAP_NOT_FOUND", "The requested map is unavailable."); }
}
function revision(doc: SavedMap): string { return RapidMvpModel.savedRevision(doc); }
function rawModel(state: AppState): RapidMvpModel {
  const model = new RapidMvpModel();
  model.state = copy(state);
  return model;
}
function descendants(state: AppState, root: string): string[] {
  const model = rawModel(state);
  // Core validates stored data before callers traverse it.
  if (model.validate().length) fail("INVALID_STATE", "The saved map does not satisfy the Core invariants.");
  return model.queryNodeIds(root);
}
function bounded<T>(items: T[], offset: number, limit: number): { items: T[]; next: number | null } {
  const result: T[] = [];
  let bytes = 0;
  for (const item of items.slice(offset, offset + limit)) {
    const size = Buffer.byteLength(JSON.stringify(item));
    if (bytes + size > 240_000) break;
    result.push(item); bytes += size;
  }
  return { items: result, next: offset + result.length < items.length ? offset + result.length : null };
}

type ScopePayloadEntry = { kind: "linear_note" | "annotation" | "scope" | "surface"; key: string; value: unknown };
/** Read only records owned by the selected scope nodes; surfaces may contain unrelated view entries. */
function scopePayload(state: AppState | undefined, selected: Set<string>): ScopePayloadEntry[] {
  if (!state) return [];
  const entries: ScopePayloadEntry[] = [];
  const scopeIds = new Set<string>();
  for (const id of selected) {
    if (id === state.rootId || state.nodes[id]?.nodeType === "folder") { scopeIds.add(id); scopeIds.add(`scope:${id}`); }
  }
  for (const [key, value] of Object.entries(state.scopes ?? {})) {
    if (!scopeIds.has(key) && !scopeIds.has(value.id) && !(Array.isArray(value.rootNodeIds) && value.rootNodeIds.some((id) => selected.has(id)))) continue;
    scopeIds.add(key); scopeIds.add(value.id);
    entries.push({ kind: "scope", key, value });
  }
  for (const [key, value] of Object.entries(state.linearNotesByScope ?? {})) {
    if (selected.has(key) || scopeIds.has(key)) entries.push({ kind: "linear_note", key, value });
  }
  for (const [key, value] of Object.entries(state.annotations ?? {})) {
    if ((value.scopeId && (selected.has(value.scopeId) || scopeIds.has(value.scopeId))) || (!value.scopeId && selected.has(state.rootId))) entries.push({ kind: "annotation", key, value });
  }
  for (const [key, value] of Object.entries(state.surfaces ?? {})) {
    if (!scopeIds.has(value.scopeId)) continue;
    entries.push({ kind: "surface", key, value: { ...value, ...(value.nodeViews ? { nodeViews: Object.fromEntries(Object.entries(value.nodeViews).filter(([id]) => selected.has(id))) } : {}) } });
  }
  return entries;
}

/** Session-local participation around the existing Rapid Core and SQLite storage. */
export class M3eMcpService {
  private readonly contexts = new Map<string, Context>();
  constructor(private readonly options: M3eMcpServiceOptions) {}

  private context(id: unknown): Context {
    const key = str(id, "context_id", 100);
    const context = this.contexts.get(key);
    if (!context || context.dbPath !== this.options.dbPath() || Date.now() - context.touched > CONTEXT_TTL) {
      this.contexts.delete(key);
      fail("CONTEXT_EXPIRED", "Participation has ended or expired. Enter the map again.");
    }
    context.touched = Date.now();
    return context;
  }
  private resolve(target: unknown): { ref: Ref; doc: SavedMap } {
    const value = str(target, "target", 4096).trim();
    const uri = /^m3e:\/\/maps\/([^/?#]+)(?:\/(scopes|nodes)\/([^/?#]+))?$/.exec(value);
    if (uri) {
      let mapId: string; let nodeId: string | undefined;
      try { mapId = decodeURIComponent(uri[1]!); nodeId = uri[3] ? decodeURIComponent(uri[3]) : undefined; }
      catch { return fail("INVALID_TARGET", "The resource URI has invalid escaping."); }
      const doc = saved(this.options.dbPath(), mapId);
      const id = nodeId ?? doc.state.rootId;
      const ref = refFor(mapId, doc.state, id);
      if (uri[2] === "scopes" && id !== doc.state.rootId && doc.state.nodes[id]!.nodeType !== "folder") fail("SCOPE_NOT_FOUND", "The requested scope boundary no longer exists.");
      return { ref, doc };
    }
    const match = /^M:\(([^)]*)\)(?:\s*>?\s*(.*))?$/i.exec(value);
    if (!match) fail("INVALID_TARGET", "Use an M3E resource URI or a canonical M:(map name)> path.");
    const maps = RapidMvpModel.listMaps(this.options.dbPath(), { includeArchived: true }).filter((map) => map.label === match[1]);
    if (maps.length !== 1) fail(maps.length ? "PATH_AMBIGUOUS" : "MAP_NOT_FOUND", maps.length ? "More than one map has that name. Select its resource URI." : "No map has that name.");
    const doc = saved(this.options.dbPath(), maps[0]!.id);
    if (!match[2]?.trim()) return { ref: refFor(maps[0]!.id, doc.state, doc.state.rootId), doc };
    const parsed = parseMapPath(value);
    if (!parsed) fail("INVALID_TARGET", "The node path is empty.");
    const result = resolveNodePath(doc.state, parsed.segments);
    if (!result.ok) fail(result.error.code, result.error.message);
    return { ref: refFor(maps[0]!.id, doc.state, result.nodeId), doc };
  }
  private emit(context: Context, type: string, message: string, data: Args = {}): void {
    const event: Event = { cursor: ++context.cursor, type, message, ...data, focus: publicRef(context.focus), requires_refocus: context.invalidated };
    // Bound both individual deltas and the aggregate replay response.
    if (Array.isArray(event.changed_nodes)) {
      while (event.changed_nodes.length && Buffer.byteLength(JSON.stringify(event)) > 24_000) { event.changed_nodes.pop(); event.requires_read = true; }
    }
    context.events.push(event);
    while (context.events.length > MAX_EVENTS || (context.events.length > 1 && Buffer.byteLength(JSON.stringify(context.events)) > 240_000)) context.events.shift();
    for (const listener of context.listeners) { try { listener(event); } catch { context.listeners.delete(listener); } }
  }
  private reconcile(context: Context, mapId: string, doc: SavedMap | null, ownChange = false): void {
    const nextRevision = doc ? revision(doc) : "deleted";
    if (context.observed.get(mapId) === nextRevision) return;
    context.observed.set(mapId, nextRevision);
    const previous = context.baseline.get(mapId);
    const watched = [...context.subscriptions.values(), ...(context.focus ? [context.focus] : [])].filter((ref) => ref.mapId === mapId);
    const relevantIds = new Set<string>();
    for (const ref of watched) {
      if (previous?.state.nodes[ref.nodeId]) for (const id of descendants(previous.state, ref.nodeId)) relevantIds.add(id);
      if (doc?.state.nodes[ref.nodeId]) for (const id of descendants(doc.state, ref.nodeId)) relevantIds.add(id);
    }
    const changedIds = [...relevantIds].filter((id) => JSON.stringify(previous?.state.nodes[id]) !== JSON.stringify(doc?.state.nodes[id]));
    const relevantLinks = (state?: AppState) => Object.values(state?.links ?? {}).filter((link) => relevantIds.has(link.sourceNodeId) || relevantIds.has(link.targetNodeId));
    const linksChanged = JSON.stringify(relevantLinks(previous?.state)) !== JSON.stringify(relevantLinks(doc?.state));
    const payloadChanged = JSON.stringify(scopePayload(previous?.state, relevantIds)) !== JSON.stringify(scopePayload(doc?.state, relevantIds));
    if (doc && previous && !ownChange && !changedIds.length && !linksChanged && !payloadChanged) {
      // Parent topology can change outside the subtree. Keep the retreat chain current.
      if (context.focus?.mapId === mapId && doc.state.nodes[context.focus.nodeId]) context.focus = refFor(mapId, doc.state, context.focus.nodeId, context.focus.kind);
      for (const [uri, ref] of context.subscriptions) {
        if (ref.mapId === mapId && doc.state.nodes[ref.nodeId]) context.subscriptions.set(uri, refFor(mapId, doc.state, ref.nodeId, ref.kind));
      }
      // Full-map CAS stays current without making unrelated scope changes interrupt this participant.
      context.baseline.set(mapId, doc);
      return;
    }
    const changes = changedIds.slice(0, 30).map((id) => {
      const old = previous?.state.nodes[id], node = doc?.state.nodes[id];
      const state = node ? doc!.state : previous!.state;
      const changedFields = [...new Set([...Object.keys(old ?? {}), ...Object.keys(node ?? {})])].filter((key) => JSON.stringify((old as unknown as Args)?.[key]) !== JSON.stringify((node as unknown as Args)?.[key]));
      return { ...publicRef(refFor(mapId, state, id)), change: !old ? "created" : !node ? "deleted" : "updated", changed_fields: changedFields, ...(node ? { text: node.text.slice(0, 2000), node_type: node.nodeType ?? "text", child_count: node.children.length, attributes: Object.fromEntries(Object.entries(node.attributes ?? {}).slice(0, 12).map(([key, value]) => [key.slice(0, 100), value.slice(0, 500)])) } : {}) };
    });
    const attributesTruncated = changedIds.some((id) => {
      const entries = Object.entries(doc?.state.nodes[id]?.attributes ?? {});
      return entries.length > 12 || entries.some(([key, value]) => key.length > 100 || value.length > 500);
    });
    const delta = { changed_nodes: changes, changed_count: changedIds.length, links_changed: linksChanged, scope_payload_changed: payloadChanged, requires_read: changedIds.length > 30 || linksChanged || payloadChanged || attributesTruncated || changes.some((change) => change.changed_fields.some((field) => !["text", "attributes", "nodeType", "id"].includes(field)) || (change.text?.length ?? 0) >= 2000 || JSON.stringify(change.attributes ?? {}).length >= 6000), affected_resources: watched.slice(0, 10).map((ref) => ref.uri) };
    let invalidated = false;
    if (context.focus?.mapId === mapId) {
      const old = context.focus;
      const node = doc?.state.nodes[old.nodeId];
      if (!node || (old.kind === "scope" && old.nodeId !== doc?.state.rootId && node.nodeType !== "folder")) {
        const ancestor = old.ancestors.find((id) => doc?.state.nodes[id] && (old.kind !== "scope" || id === doc.state.rootId || doc.state.nodes[id]!.nodeType === "folder"));
        context.focus = ancestor && doc ? refFor(mapId, doc.state, ancestor) : null;
        context.invalidated = true; invalidated = true;
        this.emit(context, "focus_invalidated", "The focused boundary disappeared. Re-evaluate and explicitly focus a surviving target before writing.", { map_uri: mapUri(mapId), affected_uri: old.uri, revision: nextRevision, ...delta });
      } else if (doc) context.focus = refFor(mapId, doc.state, old.nodeId, old.kind);
    }
    for (const [uri, ref] of context.subscriptions) {
      if (ref.mapId !== mapId) continue;
      const node = doc?.state.nodes[ref.nodeId];
      if (!node || (ref.kind === "scope" && ref.nodeId !== doc?.state.rootId && node.nodeType !== "folder")) {
        context.subscriptions.delete(uri);
        this.emit(context, "subscription_invalidated", "A subscribed boundary disappeared.", { map_uri: mapUri(mapId), affected_uri: uri, revision: nextRevision });
      } else if (doc) context.subscriptions.set(uri, refFor(mapId, doc.state, ref.nodeId, ref.kind));
    }
    if (!invalidated && !ownChange) this.emit(context, "map_changed", "The map changed. Review the change before applying further edits.", { map_uri: mapUri(mapId), revision: nextRevision, ...delta });
  }
  /** Called by the server's real change broadcast, never by a polling timer. */
  notifyMapChanged(mapId: string): void {
    let doc: SavedMap | null = null;
    try { doc = saved(this.options.dbPath(), mapId); } catch { /* map deletion */ }
    for (const context of this.contexts.values()) {
      if (context.dbPath !== this.options.dbPath()) continue;
      if (context.focus?.mapId === mapId || [...context.subscriptions.values()].some((ref) => ref.mapId === mapId)) this.reconcile(context, mapId, doc);
    }
  }
  events(contextId: string, after = 0): any {
    try {
      const context = this.context(contextId);
      if (!Number.isSafeInteger(after) || after < 0 || after > context.cursor) fail("INVALID_CURSOR", "The event cursor is invalid.");
      const overflow = after < (context.events[0]?.cursor ?? 1) - 1;
      return { ok: true, events: context.events.filter((event) => event.cursor > after), event_cursor: context.cursor, resync_required: overflow, requires_refocus: context.invalidated, focus: publicRef(context.focus) };
    } catch (err) { return this.error(err); }
  }
  listen(contextId: string, listener: (event: Event) => void): () => void {
    const context = this.context(contextId);
    if (context.listeners.size >= 8) fail("LISTENER_LIMIT", "This participation already has the maximum number of listeners.");
    context.listeners.add(listener);
    return () => context.listeners.delete(listener);
  }
  private summary(context: Context): Args {
    const focus = context.focus;
    const doc = focus ? context.baseline.get(focus.mapId) : null;
    const node = focus && doc?.state.nodes[focus.nodeId];
    return {
      context_id: context.id, revision: doc ? revision(doc) : null, focus: publicRef(focus),
      subscriptions: [...context.subscriptions.values()].map(publicRef), event_cursor: context.cursor,
      requires_refocus: context.invalidated, operations: TOOLS, documents: DOCUMENTS,
      snapshot: node && doc && focus ? { node_count: descendants(doc.state, node.id).length, child_count: node.children.length, children: node.children.slice(0, 40).map((id) => publicRef(refFor(focus.mapId, doc.state, id))), children_truncated: node.children.length > 40 } : null,
    };
  }
  private error(err: unknown): Args {
    if (err instanceof McpError) return { ok: false, error: { code: err.code, message: err.message } };
    if ((err as Error)?.message === "REVISION_CONFLICT") return { ok: false, error: { code: "REVISION_CONFLICT", message: "The saved map changed before commit. Refresh the context before retrying." } };
    return { ok: false, error: { code: "INVALID_OPERATION", message: "The Core rejected this operation. No partial batch was saved." } };
  }
  call(tool: string, input: unknown): any {
    let context: Context | undefined;
    try {
      const args = object(input);
      if (!TOOLS.includes(tool)) fail("UNKNOWN_TOOL", "This operation is not available.");
      if (args.context_id !== undefined) context = this.context(args.context_id);
      if (tool === "m3e_context") return this.participate(args, context);
      if (tool === "m3e_get") return this.get(args, context);
      if (tool === "m3e_feedback") return this.feedback(args, context);
      if (!context) fail("CONTEXT_REQUIRED", "Enter a map or scope before writing.");
      return this.mutate(tool, args, context);
    } catch (err) {
      return { ...this.error(err), ...(context ? { context_id: context.id, focus: publicRef(context.focus), requires_refocus: context.invalidated, event_cursor: context.cursor } : {}) };
    }
  }
  private participate(args: Args, context?: Context): Args {
    fields(args, ["action", "target", "context_id"]);
    const action = str(args.action, "action", 30);
    if (action === "enter") {
      if (context) fail("INVALID_ARGUMENT", "Enter creates a new participation; omit context_id.");
      const { ref, doc } = this.resolve(args.target);
      for (const [id, old] of this.contexts) if (Date.now() - old.touched > CONTEXT_TTL) this.contexts.delete(id);
      if (this.contexts.size >= MAX_CONTEXTS) fail("CONTEXT_LIMIT", "Too many active participations. Leave unused contexts first.");
      context = { id: randomUUID(), dbPath: this.options.dbPath(), focus: ref, subscriptions: new Map([[ref.uri, ref]]), baseline: new Map([[ref.mapId, doc]]), observed: new Map([[ref.mapId, revision(doc)]]), invalidated: false, events: [], cursor: 0, touched: Date.now(), listeners: new Set() };
      this.contexts.set(context.id, context);
    } else {
      if (!context) fail("CONTEXT_REQUIRED", "Enter a map or scope first.");
      if (action === "leave") {
        this.emit(context, "context_left", "Participation ended.");
        this.contexts.delete(context.id);
        return { ok: true, left: true, context_id: context.id };
      }
      if (!["focus", "subscribe", "unsubscribe"].includes(action)) fail("INVALID_ARGUMENT", "Unknown context action.");
      if (action === "unsubscribe") {
        const target = str(args.target, "target", 4096);
        // A deleted subscription may still be explicitly removed by URI.
        const uri = context.subscriptions.has(target) ? target : this.resolve(target).ref.uri;
        context.subscriptions.delete(uri);
      } else {
        const { ref, doc } = this.resolve(args.target);
        if (action === "subscribe" && context.baseline.has(ref.mapId)) this.reconcile(context, ref.mapId, doc);
        if (context.subscriptions.size >= 32 && !context.subscriptions.has(ref.uri)) fail("SUBSCRIPTION_LIMIT", "Use at most 32 subscriptions per participation.");
        if (action === "focus") { context.focus = ref; context.invalidated = false; }
        context.subscriptions.set(ref.uri, ref);
        // Subscribing is not an acknowledgement of stale focus state.
        if (action === "focus" || !context.baseline.has(ref.mapId)) context.baseline.set(ref.mapId, doc);
        context.observed.set(ref.mapId, revision(doc));
      }
    }
    return { ok: true, ...this.summary(context) };
  }
  private get(args: Args, context?: Context): Args {
    fields(args, ["kind", "target", "context_id", "query", "offset", "limit", "link_offset", "payload_offset"]);
    const kind = str(args.kind, "kind", 20);
    const offset = page(args), limit = page(args, "limit", 50, 100);
    if (!limit) fail("INVALID_ARGUMENT", "limit must be positive.");
    if (kind === "maps" || kind === "search") {
      const query = args.query === undefined ? "" : str(args.query, "query", 200).toLocaleLowerCase();
      const items: Args[] = [];
      const scope = kind === "search" && (args.target || context?.focus) ? this.resolve(args.target ?? context!.focus!.uri) : null;
      for (const map of RapidMvpModel.listMaps(this.options.dbPath())) {
        if (scope && scope.ref.mapId !== map.id) continue;
        const doc = kind === "search" ? saved(this.options.dbPath(), map.id) : null;
        const selected = scope && doc ? new Set(descendants(doc.state, scope.ref.nodeId)) : null;
        if ((!scope || scope.ref.kind === "map") && (!query || map.label.toLocaleLowerCase().includes(query))) items.push({ uri: mapUri(map.id), name: map.label.slice(0, 240), kind: "map", map_name: map.label.slice(0, 240), node_count: map.nodeCount });
        if (doc) for (const node of Object.values(doc.state.nodes)) {
          if (node.id === doc.state.rootId || (selected && !selected.has(node.id))) continue;
          if (!query || node.text.toLocaleLowerCase().includes(query)) items.push({ ...publicRef(refFor(map.id, doc.state, node.id)), map_name: map.label.slice(0, 240) });
        }
      }
      const result = bounded(items, offset, limit);
      return { ok: true, items: result.items, total: items.length, offset, limit, next_offset: result.next };
    }
    if (kind !== "state") fail("INVALID_ARGUMENT", "Unknown read kind.");
    const { ref, doc } = this.resolve(args.target ?? context?.focus?.uri);
    if (context) {
      this.reconcile(context, ref.mapId, doc);
      if (!context.invalidated) context.baseline.set(ref.mapId, doc);
    }
    const ids = descendants(doc.state, ref.nodeId);
    const clip = (value: string | undefined): string => (value ?? "").slice(0, 4000);
    const nodes = ids.map((id) => {
      const node = doc.state.nodes[id]!;
      const attributes = Object.fromEntries(Object.entries(node.attributes ?? {}).slice(0, 32).map(([key, value]) => [key.slice(0, 100), clip(String(value))]));
      return { ...publicRef(refFor(ref.mapId, doc.state, id)), text: clip(node.text), details: clip(node.details), note: clip(node.note), link: clip(node.link), node_type: node.nodeType ?? "text", attributes, content_truncated: JSON.stringify({ text: node.text, details: node.details, note: node.note, link: node.link, attributes: node.attributes }) !== JSON.stringify({ text: clip(node.text), details: clip(node.details), note: clip(node.note), link: clip(node.link), attributes }), parent_uri: node.parentId ? refFor(ref.mapId, doc.state, node.parentId).uri : null, children: node.children.slice(0, 100).map((child) => refFor(ref.mapId, doc.state, child).uri), child_count: node.children.length, ...(node.targetNodeId ? { target_uri: `${mapUri(ref.mapId)}/nodes/${encodeURIComponent(node.targetNodeId)}`, alias_access: node.access ?? "read", is_broken: Boolean(node.isBroken) } : {}) };
    });
    const selected = new Set(ids);
    const links = Object.values(doc.state.links ?? {}).filter((link) => selected.has(link.sourceNodeId) || selected.has(link.targetNodeId)).map((link) => ({ ...link, ...(link.label ? { label: clip(link.label) } : {}), ...(link.relationType ? { relationType: clip(link.relationType) } : {}) }));
    const linkOffset = page(args, "link_offset");
    const result = bounded(nodes, offset, limit), linkResult = bounded(links, linkOffset, limit);
    const payload = scopePayload(doc.state, selected).map((entry) => {
      const text = JSON.stringify(entry.value);
      return text.length > 24_000 ? { kind: entry.kind, key: entry.key, value_preview: text.slice(0, 24_000), content_truncated: true } : { ...entry, content_truncated: false };
    });
    const payloadResult = bounded(payload, page(args, "payload_offset"), limit);
    return { ok: true, target: publicRef(ref), revision: revision(doc), nodes: result.items, links: linkResult.items, scope_payload: payloadResult.items, payload_total: payload.length, next_payload_offset: payloadResult.next, total: nodes.length, link_total: links.length, offset, limit, next_offset: result.next, next_link_offset: linkResult.next, ...(context ? { context_id: context.id, requires_refocus: context.invalidated, event_cursor: context.cursor } : {}) };
  }
  private mutate(tool: string, args: Args, context: Context): Args {
    const allowed = tool === "m3e_create" ? ["kind", "context_id", "target", "text", "attributes", "source", "mfh", "structure", "import_key", "expected_revision"] : tool === "m3e_update" ? ["kind", "context_id", "target", "text", "attributes", "parent", "expected_revision"] : ["context_id", "target", "expected_revision"];
    fields(args, allowed);
    if (context.invalidated || !context.focus) fail("FOCUS_INVALIDATED", "The focused boundary disappeared. Explicitly focus a surviving target before writing.");
    const mapId = context.focus.mapId;
    let current: SavedMap;
    try { current = saved(this.options.dbPath(), mapId); }
    catch { this.reconcile(context, mapId, null); return fail("FOCUS_INVALIDATED", "The focused map disappeared. Enter or focus a surviving map."); }
    this.reconcile(context, mapId, current);
    if (context.invalidated) fail("FOCUS_INVALIDATED", "The focused boundary disappeared. Explicitly focus a surviving target before writing.");
    const expected = args.expected_revision === undefined ? revision(context.baseline.get(mapId)!) : str(args.expected_revision, "expected_revision", 100);
    if (expected !== revision(current)) fail("REVISION_CONFLICT", "The map changed since the retained context. Read the relevant state or explicitly refocus before retrying.");
    const blocked = this.options.canWrite?.(mapId);
    if (blocked) fail("WRITE_UNAVAILABLE", blocked);
    const resolved = this.resolve(args.target ?? context.focus!.uri);
    if (resolved.ref.mapId !== mapId) fail("FOCUS_MAP_MISMATCH", "Focus the destination map before editing it.");
    const target = resolved.ref.nodeId;
    const model = rawModel(current.state);
    const created: string[] = [];
    const before = Object.keys(current.state.nodes).length;
    let updated = 0;
    if (tool === "m3e_create") {
      if (model.state.nodes[target]!.nodeType === "alias") fail("INVALID_OPERATION", "Alias nodes cannot own children.");
      const kind = str(args.kind, "kind", 30);
      const common = ["kind", "context_id", "target", "expected_revision"];
      fields(args, [...common, ...(kind === "node" ? ["text", "attributes"] : kind === "copy" ? ["source"] : kind === "import_mfh" ? ["mfh"] : kind === "import_structure" ? ["structure", "import_key"] : [])]);
      if (kind === "node") {
        const id = model.addNode(target, str(args.text, "text")); created.push(id);
        if (args.attributes !== undefined) this.patchAttributes(model.state.nodes[id]!, args.attributes);
      }
      else if (kind === "copy") {
        const source = this.resolve(args.source);
        if (descendants(source.doc.state, source.ref.nodeId).length > MAX_BATCH) fail("BATCH_LIMIT", "The subtree exceeds the atomic copy limit of 1000 nodes.");
        // A cross-map external alias needs an explicit policy, never accidental rebinding.
        if (source.ref.mapId !== mapId) {
          const ids = new Set(descendants(source.doc.state, source.ref.nodeId));
          if ([...ids].some((id) => { const node = source.doc.state.nodes[id]!; return node.nodeType === "alias" && node.targetNodeId && !ids.has(node.targetNodeId); })) fail("CROSS_MAP_ALIAS", "The subtree contains an external alias. Resolve its cross-map meaning before copying.");
        }
        created.push(...model.copySubtree(source.doc.state, source.ref.nodeId, target));
      } else if (kind === "import_structure") {
        const graph = object(args.structure);
        const key = str(args.import_key, "import_key", 200);
        // The marker and whole scope commit together; a lost HTTP response is replay-safe.
        const prior = Object.values(model.state.nodes).find(n => n.attributes?.["m3e:flashImportKey"] === key);
        if (prior) {
          if (prior.parentId !== target) fail("IMPORT_CONFLICT", "The imported scope was moved; do not append it again.");
          return { ok: true, ...this.summary(context), changed: { created: 0, updated: 0, deleted: 0 }, created: [publicRef(refFor(mapId, model.state, prior.id))], replayed: true };
        }
        if (!Array.isArray(graph.nodes) || !graph.nodes.length || graph.nodes.length > MAX_BATCH || !Array.isArray(graph.roots) || graph.roots.length !== 1) fail("INVALID_STRUCTURE", "Use one rooted tree with at most 1000 nodes.");
        const byId = new Map<string, Args>();
        for (const raw of graph.nodes) {
          const n = object(raw), id = str(n.id, "node id", 200);
          str(n.title, "node title");
          // TreeNode text supports multiline content; preserve source text verbatim.
          if (!Array.isArray(n.children) || byId.has(id)) fail("INVALID_STRUCTURE", "Invalid children or duplicate id.");
          byId.set(id, n);
        }
        const visited = new Set<string>();
        const add = (id: string, parent: string, sourceParent: string | null): string => {
          const n = byId.get(id);
          if (!n || visited.has(id) || n.parent !== sourceParent) fail("INVALID_STRUCTURE", "The tree has missing, repeated or inconsistent ownership.");
          visited.add(id);
          const real = model.addNode(parent, n.title as string); created.push(real);
          // Reuse native attributes, including incoming tree-edge labels and provenance.
          if (n.attributes !== undefined) this.patchAttributes(model.state.nodes[real]!, n.attributes);
          for (const child of n.children as unknown[]) add(str(child, "child", 200), real, id);
          return real;
        };
        const root = add(str(graph.roots[0], "root", 200), target, null);
        if (visited.size !== byId.size) fail("INVALID_STRUCTURE", "The tree contains unreachable nodes.");
        model.setScopeBoundary(root, true);
        model.state.nodes[root]!.attributes = { ...model.state.nodes[root]!.attributes, "m3e:flashImportKey": key, "m3e:band": "flash", "m3e:status": "unverified" };
      } else if (kind === "import_mfh") {
        const text = str(args.mfh, "mfh", 300_000);
        let depth = 0, count = 0;
        for (const line of text.split(/\r?\n/)) {
          if (!line.trim()) continue;
          if (/^details:\s*/i.test(line.trim()) && count) continue;
          const heading = /^(#{1,6})\s+(.+)$/.exec(line);
          if (!heading || heading[2]!.length > MAX_TEXT || heading[1]!.length > depth + 1) fail("INVALID_MFH", "MF-H requires headings starting at # without skipped levels; details: may follow a heading.");
          depth = heading[1]!.length;
          if (++count > MAX_BATCH) fail("BATCH_LIMIT", "Use at most 1000 headings per atomic import.");
        }
        if (!count) fail("INVALID_MFH", "MF-H contains no headings.");
        const parsed = parseIndentedTextToNodes(text, target, () => model._newId());
        model._pushHistory();
        for (const node of parsed) { model.state.nodes[node.id] = node; created.push(node.id); if (node.parentId === target) model.state.nodes[target]!.children.push(node.id); }
      } else fail("INVALID_ARGUMENT", "Unknown create kind.");
    } else if (tool === "m3e_update") {
      const kind = str(args.kind, "kind", 30);
      fields(args, ["kind", "context_id", "target", "expected_revision", ...(kind === "content" ? ["text", "attributes"] : kind === "move" ? ["parent"] : [])]);
      if (kind === "content") {
        if (args.text === undefined && args.attributes === undefined) fail("INVALID_ARGUMENT", "Content update needs text or attributes.");
        if (args.text !== undefined) {
          const text = str(args.text, "text");
          if (model.state.nodes[target]!.nodeType === "alias") model.renameAlias(target, text); else model.editNode(target, text);
        }
        if (args.attributes !== undefined) this.patchAttributes(model.state.nodes[target]!, args.attributes);
      } else if (kind === "move") {
        const parent = this.resolve(args.parent);
        if (parent.ref.mapId !== mapId) fail("CROSS_MAP_MOVE", "Cross-map moves are not supported. Copy into the other map explicitly.");
        if (model.state.nodes[parent.ref.nodeId]!.nodeType === "alias") fail("INVALID_OPERATION", "Alias nodes cannot own children.");
        model.reparentNode(target, parent.ref.nodeId);
      } else if (kind === "scopen" || kind === "unscopen") model.setScopeBoundary(target, kind === "scopen");
      else fail("INVALID_ARGUMENT", "Unknown update kind.");
      updated = 1;
    } else model.deleteNode(target);
    // Core normalization must not add defaults to unrelated existing content.
    for (const [id, old] of Object.entries(current.state.nodes)) {
      const node = model.state.nodes[id];
      if (node && old.nodeType === undefined && node.nodeType === "text" && !(tool === "m3e_update" && args.kind === "unscopen" && id === target)) delete node.nodeType;
    }
    if (model.validate().length) fail("INVALID_STATE", "The requested operation violates the Core invariants.");
    const result = model.saveToSqliteIfUnchanged(this.options.dbPath(), mapId, expected);
    context.baseline.set(mapId, result);
    const changed = { created: created.length, updated, deleted: Math.max(0, before - Object.keys(result.state.nodes).length) };
    try {
      this.reconcile(context, mapId, result, true);
      // The shared server broadcast reaches other participants; this path also supports embedded consumers.
      this.notifyMapChanged(mapId);
      this.options.onSaved?.(mapId, result.savedAt);
      return { ok: true, ...this.summary(context), changed, created: created.slice(0, 100).map((id) => publicRef(refFor(mapId, result.state, id))), created_truncated: created.length > 100 };
    } catch {
      // Commit succeeded; downstream delivery must never invite a duplicate mutation retry.
      return { ok: true, committed: true, context_id: context.id, revision: revision(result), focus: publicRef(context.focus), requires_refocus: context.invalidated, event_cursor: context.cursor, changed, created: created.slice(0, 100).map((id) => publicRef(refFor(mapId, result.state, id))), created_truncated: created.length > 100, warning: "The map was committed, but downstream notification failed. Read current state if a listener missed it." };
    }
  }
  private patchAttributes(node: TreeNode, input: unknown): void {
    const patch = object(input);
    if (Object.keys(patch).length > 100) fail("INVALID_ARGUMENT", "Use at most 100 attribute changes at once.");
    node.attributes = { ...node.attributes };
    for (const [key, value] of Object.entries(patch)) {
      if (!key || key.length > 200 || ["__proto__", "prototype", "constructor"].includes(key)) fail("INVALID_ARGUMENT", "An attribute name is unsupported.");
      if (value === null) delete node.attributes[key];
      else if (typeof value === "string" && value.length <= MAX_TEXT) node.attributes[key] = value;
      else fail("INVALID_ARGUMENT", "Attribute values must be text or null to remove a key.");
    }
  }
  private feedback(args: Args, context?: Context): Args {
    fields(args, ["context_id", "what", "why", "where", "when", "who", "how"]);
    const entry: Args = { recorded_at: new Date().toISOString(), what: str(args.what, "what", 8192) };
    for (const key of ["why", "where", "when", "who", "how"]) entry[key] = args[key] === undefined ? null : str(args[key], key, 8192);
    entry.context = context ? { focus: publicRef(context.focus), revision: context.focus ? revision(context.baseline.get(context.focus.mapId)!) : null } : null;
    const dir = this.options.feedbackDir();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.appendFileSync(path.join(dir, "feedback.jsonl"), `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 });
    return { ok: true, recorded_at: entry.recorded_at, message: "Feedback was appended to the local durable log." };
  }
}

export function mcpRequestAllowed(req: http.IncomingMessage): boolean {
  const address = req.socket.remoteAddress;
  if (address && address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
  try {
    const host = new URL(`http://${req.headers.host || "localhost"}`).hostname;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) return false;
    if (req.headers.origin) {
      const origin = new URL(req.headers.origin);
      if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) || origin.host !== req.headers.host) return false;
    }
    return true;
  } catch { return false; }
}
