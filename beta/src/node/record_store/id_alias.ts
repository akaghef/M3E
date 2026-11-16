// Ids a client uses for the records of a map, and the ids the store keeps for them.
//
// The store keeps node, GraphLink and annotation ids unique across the maps of a workspace, and
// surface ids too (a surface is keyed by its id). A map state that arrives from a client may use
// ids another map already holds (`root`, `A`, a copy of a map, an import of the same file twice).
// Such an id gets a new stored id, made the way the migration makes them (snapshot-format.md
// section 3.1): prefix + first 24 hex characters of sha256("<workspaceId>|<mapId>|<recordKind>|<id>").
// The pair is kept as an `idMap` record with `alias: true`, and from then on the store translates:
// what comes in (whole-map states, Command changes) from the client's id to the stored id, what
// goes out (states, conflicts) back. The client never sees a stored id it did not choose.
//
// This file holds the translation itself: which fields of a state and of a change hold ids.
// Nothing else is read as an id; text, attributes and unknown fields pass through untouched.

import type { FieldConflict, RecordChange } from "../../shared/map_changes";
import { sha256Hex } from "../../shared/record_model/hash";
import type { IdMapRecord } from "../../shared/record_model/types";

export type AliasKind = IdMapRecord["recordKind"];

export const ALIAS_KINDS: readonly AliasKind[] = ["node", "graphlink", "annotation", "surface"];

const ALIAS_PREFIX: Record<AliasKind, string> = { node: "n_", graphlink: "c_", annotation: "a_", surface: "v_" };
const SCOPE_PREFIX = "scope:";

/** One direction of the translation. Each function returns its argument when the id has no alias. */
export interface IdTranslator {
  node(id: string): string;
  graphlink(id: string): string;
  annotation(id: string): string;
  surface(id: string): string;
}

export type AliasTable = Record<AliasKind, Map<string, string>>;

export function emptyAliasTable(): AliasTable {
  return { node: new Map(), graphlink: new Map(), annotation: new Map(), surface: new Map() };
}

export function translatorOf(table: AliasTable): IdTranslator {
  return {
    node: (id) => table.node.get(id) ?? id,
    graphlink: (id) => table.graphlink.get(id) ?? id,
    annotation: (id) => table.annotation.get(id) ?? id,
    surface: (id) => table.surface.get(id) ?? id,
  };
}

/** The stored id for a client id that cannot be kept. `attempt` > 0 only when the first one is taken. */
export function aliasId(workspaceId: string, mapId: string, kind: AliasKind, oldId: string, attempt = 0): string {
  const seed = attempt === 0 ? oldId : `${oldId}#${attempt}`;
  return ALIAS_PREFIX[kind] + sha256Hex(`${workspaceId}|${mapId}|${kind}|${seed}`).slice(0, 24);
}

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, map: (id: string) => string): unknown {
  return typeof value === "string" ? map(value) : value;
}

function list(value: unknown, map: (id: string) => string): unknown {
  return Array.isArray(value) ? value.map((item) => str(item, map)) : value;
}

/** A scope is named by its root node: `scope:<node id>` or the node id alone. */
function scopeRef(value: string, t: IdTranslator): string {
  return value.startsWith(SCOPE_PREFIX) ? SCOPE_PREFIX + t.node(value.slice(SCOPE_PREFIX.length)) : t.node(value);
}

function rekey(source: Dict, key: (id: string) => string, item: (value: unknown) => unknown): Dict {
  const out: Dict = {};
  for (const id of Object.keys(source)) out[key(id)] = item(source[id]);
  return out;
}

function nodeFields(value: unknown, t: IdTranslator): unknown {
  if (!isDict(value)) return value;
  const out: Dict = { ...value };
  if ("id" in out) out.id = str(out.id, t.node);
  if ("parentId" in out) out.parentId = str(out.parentId, t.node);
  if ("children" in out) out.children = list(out.children, t.node);
  if ("targetNodeId" in out) out.targetNodeId = str(out.targetNodeId, t.node);
  return out;
}

function linkFields(value: unknown, t: IdTranslator): unknown {
  if (!isDict(value)) return value;
  const out: Dict = { ...value };
  if ("id" in out) out.id = str(out.id, t.graphlink);
  if ("sourceNodeId" in out) out.sourceNodeId = str(out.sourceNodeId, t.node);
  if ("targetNodeId" in out) out.targetNodeId = str(out.targetNodeId, t.node);
  return out;
}

function annotationFields(value: unknown, t: IdTranslator): unknown {
  if (!isDict(value)) return value;
  const out: Dict = { ...value };
  if ("id" in out) out.id = str(out.id, t.annotation);
  if ("scopeId" in out) out.scopeId = str(out.scopeId, (id) => scopeRef(id, t));
  return out;
}

function scopeFields(value: unknown, t: IdTranslator): unknown {
  if (!isDict(value)) return value;
  const out: Dict = { ...value };
  if ("id" in out) out.id = str(out.id, (id) => scopeRef(id, t));
  if ("rootNodeIds" in out) out.rootNodeIds = list(out.rootNodeIds, t.node);
  if ("relationIds" in out) out.relationIds = list(out.relationIds, t.graphlink);
  if ("primarySurfaceId" in out) out.primarySurfaceId = str(out.primarySurfaceId, t.surface);
  return out;
}

function surfaceFields(value: unknown, t: IdTranslator): unknown {
  if (!isDict(value)) return value;
  const out: Dict = { ...value };
  if ("id" in out) out.id = str(out.id, t.surface);
  if ("scopeId" in out) out.scopeId = str(out.scopeId, (id) => scopeRef(id, t));
  if (isDict(out.nodeViews)) out.nodeViews = rekey(out.nodeViews, t.node, (view) => view);
  return out;
}

/**
 * The state with every id and reference sent through `t`. The top-level object and the tables
 * that hold ids are new objects; everything below a record is shared with the input.
 */
export function translateState<T extends object>(state: T, t: IdTranslator): T {
  if (!isDict(state)) return state;
  const out: Dict = { ...state };
  if ("rootId" in out) out.rootId = str(out.rootId, t.node);
  if (isDict(out.nodes)) out.nodes = rekey(out.nodes, t.node, (node) => nodeFields(node, t));
  if (isDict(out.links)) out.links = rekey(out.links, t.graphlink, (link) => linkFields(link, t));
  if (isDict(out.annotations)) out.annotations = rekey(out.annotations, t.annotation, (item) => annotationFields(item, t));
  else if (Array.isArray(out.annotations)) out.annotations = out.annotations.map((item) => annotationFields(item, t));
  if (isDict(out.scopes)) out.scopes = rekey(out.scopes, (id) => scopeRef(id, t), (scope) => scopeFields(scope, t));
  if (isDict(out.surfaces)) out.surfaces = rekey(out.surfaces, t.surface, (surface) => surfaceFields(surface, t));
  if (isDict(out.linearNotesByScope)) out.linearNotesByScope = rekey(out.linearNotesByScope, (id) => scopeRef(id, t), (text) => text);
  return out as T;
}

function translateKey(kind: RecordChange["kind"], key: string[], t: IdTranslator): string[] {
  if (!Array.isArray(key) || typeof key[0] !== "string") return key;
  switch (kind) {
    case "node":
    case "edge":
      return [t.node(key[0]), ...key.slice(1)];
    case "attribute":
      if (typeof key[1] !== "string") return key;
      return [key[0], key[0] === "graph-link" ? t.graphlink(key[1]) : t.node(key[1]), ...key.slice(2)];
    case "graph-link":
      return [t.graphlink(key[0]), ...key.slice(1)];
    case "linear-text":
    case "scope-setting":
      return [scopeRef(key[0], t), ...key.slice(1)];
    case "surface":
      return [t.surface(key[0]), ...key.slice(1)];
    case "surface-node-view":
      return typeof key[1] === "string" ? [t.surface(key[0]), t.node(key[1]), ...key.slice(2)] : [t.surface(key[0])];
    case "annotation":
      return [t.annotation(key[0]), ...key.slice(1)];
    default:
      return key;
  }
}

function translateBag(change: RecordChange, bag: Dict | undefined, t: IdTranslator): Dict | undefined {
  if (!isDict(bag)) return bag;
  switch (change.kind) {
    case "node":
      return nodeFields(bag, t) as Dict;
    case "edge":
      return "parentId" in bag ? { ...bag, parentId: str(bag.parentId, t.node) } : bag;
    case "graph-link":
      return linkFields(bag, t) as Dict;
    case "scope-setting":
      return scopeFields(bag, t) as Dict;
    case "surface":
      return surfaceFields(bag, t) as Dict;
    case "annotation":
      // An annotation that is not an object travels as `{ value }`.
      if ("value" in bag && !("kind" in bag) && Object.keys(bag).length === 1) return { value: annotationFields(bag.value, t) };
      return annotationFields(bag, t) as Dict;
    case "map-field":
      return change.key[0] === "rootId" && "value" in bag ? { ...bag, value: str(bag.value, t.node) } : bag;
    default:
      return bag;
  }
}

/** The changes with keys and id-valued fields sent through `t`. The input is not modified. */
export function translateChanges(changes: readonly RecordChange[], t: IdTranslator): RecordChange[] {
  return changes.map((change) => {
    if (!change || typeof change !== "object" || !Array.isArray(change.key)) return change;
    const out: RecordChange = { ...change, key: translateKey(change.kind, change.key, t) };
    if (change.before !== undefined) out.before = translateBag(change, change.before, t);
    if (change.after !== undefined) out.after = translateBag(change, change.after, t);
    return out;
  });
}

export function translateConflicts(conflicts: readonly FieldConflict[], t: IdTranslator): FieldConflict[] {
  return conflicts.map((conflict) => ({ ...conflict, key: translateKey(conflict.kind, conflict.key, t) }));
}

/** Client ids a state or a list of changes brings in, by the kind of record they name. */
export type IntroducedIds = Record<AliasKind, string[]>;

export function idsOfState(state: object): IntroducedIds {
  const source = state as Dict;
  const keys = (value: unknown): string[] => (isDict(value) ? Object.keys(value).filter((id) => isDict((value as Dict)[id])) : []);
  return { node: keys(source.nodes), graphlink: keys(source.links), annotation: keys(source.annotations), surface: keys(source.surfaces) };
}

const CREATED_KIND: Partial<Record<RecordChange["kind"], AliasKind>> = {
  node: "node",
  "graph-link": "graphlink",
  annotation: "annotation",
  surface: "surface",
};

export function idsCreatedBy(changes: readonly RecordChange[]): IntroducedIds {
  const out: IntroducedIds = { node: [], graphlink: [], annotation: [], surface: [] };
  for (const change of changes) {
    if (!change || typeof change !== "object" || change.op !== "create" || !Array.isArray(change.key)) continue;
    const kind = CREATED_KIND[change.kind];
    if (kind !== undefined && typeof change.key[0] === "string") out[kind].push(change.key[0]);
  }
  return out;
}
