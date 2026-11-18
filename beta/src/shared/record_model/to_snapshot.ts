// Current map rows -> snapshot records.
// Contract: .kiro/specs/rapid-persistence-redesign/snapshot-format.md section 3.

import { edgeScopeRootOf } from "../scope_plane";
import type { TreeNode } from "../types";
import { sha256Hex, type HashFn } from "./hash";
import { initialKeys } from "./order_key";
import {
  compareStrings,
  type AliasValue,
  type AnnotationRecord,
  type DetailsRecord,
  type EdgeConnectionRecord,
  type GraphLinkConnectionRecord,
  type IdMapRecord,
  type JsonObject,
  type JsonValue,
  type LinearTextRecord,
  type MapRecord,
  type NodeRecord,
  type NodeViewRecord,
  type ScopeRecord,
  type SnapshotRecord,
  type SnapshotRow,
  type SurfaceRecord,
} from "./types";

export interface ToSnapshotOptions {
  /** Time of the conversion, written to the seeded commit. Defaults to the current time. */
  now?: string;
  /** Hex digest used for generated ids. Defaults to sha256. */
  hash?: HashFn;
}

type Dict = Record<string, unknown>;

export const EDGE_LABEL_ATTRIBUTE = "m3e:edge-label";
export const MIGRATION_ACCOUNT_ID = "acct_migration";
const ID_MAX_LENGTH = 64;
const ID_PATTERN = /^[A-Za-z0-9_.:-]*$/;
const SCOPE_PREFIX = "scope:";

const NODE_FIELDS = new Set([
  "id", "parentId", "children", "nodeType", "scopeId", "edgeOutsideScope", "text", "collapsed", "details", "note",
  "attributes", "link", "targetNodeId", "aliasLabel", "access", "targetSnapshotLabel", "isBroken", "aliasOf",
]);
const LINK_FIELDS = new Set([
  "id", "sourceNodeId", "targetNodeId", "relationType", "label", "direction", "style", "color",
  "sourcePort", "targetPort", "attributes",
]);
const ANNOTATION_COPIED_FIELDS = [
  "d", "points", "stroke", "strokeWidth", "opacity", "createdAt", "x", "y", "text", "fill",
  "fontSize", "fontWeight", "variant",
] as const;
const ANNOTATION_FIELDS = new Set<string>(["id", "kind", "scopeId", ...ANNOTATION_COPIED_FIELDS]);
const STATE_FIELDS = new Set([
  "rootId", "nodes", "links", "annotations", "scopes", "surfaces", "linearNotesByScope",
  "linearTextFontScale", "linearPanelWidth",
]);
const STATE_DROPPED_FIELDS = new Set(["selectedId", "scopeId", "savedAt"]);
const NODE_VIEW_FIELDS = ["x", "y", "flowCol", "flowRow", "shape"] as const;

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function present(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function dictOf(value: unknown): Dict {
  return isDict(value) ? value : {};
}

/** Entries that are objects, in string order of their key. */
function sortedEntries(value: unknown): Array<[string, Dict]> {
  return Object.keys(dictOf(value))
    .sort(compareStrings)
    .map((key): [string, unknown] => [key, (value as Dict)[key]])
    .filter((entry): entry is [string, Dict] => isDict(entry[1]));
}

/** Copies the fields that are present (not null / undefined) onto `target`. */
function copyPresent(target: Dict, source: Dict, fields: readonly string[]): void {
  for (const field of fields) {
    if (present(source[field])) target[field] = source[field];
  }
}

/** Fields outside the type definition, as they are. Returns undefined when there are none. */
function collectExtra(source: Dict, known: Set<string>, dropped?: Set<string>): JsonObject | undefined {
  const extra: Dict = {};
  for (const key of Object.keys(source)) {
    if (known.has(key) || dropped?.has(key) || !present(source[key])) continue;
    extra[key] = source[key];
  }
  return Object.keys(extra).length > 0 ? (extra as JsonObject) : undefined;
}

/** Attribute pairs without null values. Returns undefined when nothing is left. */
function cleanAttributes(value: unknown, skipKey?: string): JsonObject | undefined {
  if (!isDict(value)) return undefined;
  const out: Dict = {};
  for (const key of Object.keys(value)) {
    if (key === skipKey || !present(value[key])) continue;
    out[key] = value[key];
  }
  return Object.keys(out).length > 0 ? (out as JsonObject) : undefined;
}

interface MapContext {
  mapId: string;
  row: SnapshotRow;
  state: Dict;
  nodes: Array<[string, Dict]>;
  links: Array<[string, Dict]>;
  annotations: Array<[string, Dict]>;
  nodeIds: Map<string, string>;
  linkIds: Map<string, string>;
  annotationIds: Map<string, string>;
}

export function toSnapshot(workspaceId: string, rows: SnapshotRow[], options: ToSnapshotOptions = {}): SnapshotRecord[] {
  const hash = options.hash ?? sha256Hex;
  const now = options.now ?? new Date().toISOString();
  const records: SnapshotRecord[] = [{ kind: "snapshot", format: 1, workspaceId, seq: 0 }];

  const makeId = (prefix: string, mapId: string, recordKind: string, seed: string): string =>
    prefix + hash(`${workspaceId}|${mapId}|${recordKind}|${seed}`).slice(0, 24);

  // 3.1: decide every node / GraphLink / annotation id of the workspace first.
  const used = new Set<string>();
  const contexts: MapContext[] = [...rows]
    .sort((a, b) => compareStrings(a.id, b.id))
    .map((row) => {
      const state = dictOf(row.state);
      const context: MapContext = {
        mapId: row.id,
        row,
        state,
        nodes: sortedEntries(state.nodes),
        links: sortedEntries(state.links),
        annotations: sortedEntries(state.annotations),
        nodeIds: new Map(),
        linkIds: new Map(),
        annotationIds: new Map(),
      };
      const assign = (
        entries: Array<[string, Dict]>,
        ids: Map<string, string>,
        prefix: string,
        recordKind: IdMapRecord["recordKind"],
      ): void => {
        for (const [oldId] of entries) {
          const keep = !used.has(oldId) && oldId.length <= ID_MAX_LENGTH && ID_PATTERN.test(oldId);
          const newId = keep ? oldId : makeId(prefix, row.id, recordKind, oldId);
          used.add(newId);
          ids.set(oldId, newId);
          if (!keep) records.push({ kind: "idMap", recordKind, mapId: row.id, oldId, newId });
        }
      };
      assign(context.nodes, context.nodeIds, "n_", "node");
      assign(context.links, context.linkIds, "c_", "graphlink");
      assign(context.annotations, context.annotationIds, "a_", "annotation");
      return context;
    });

  for (const context of contexts) convertMap(context, makeId, records);

  // 3.5: records present from the start.
  records.push(
    { kind: "relationTypeDef", name: "m3e:consist-of", reads: "source-to-target", rev: 0 },
    { kind: "relationTypeDef", name: "m3e:detail", reads: "source-to-target", rev: 0 },
    { kind: "relationTypeDef", name: "rdfs:subClassOf", reads: "target-to-source", rev: 0 },
    { kind: "relationTypeDef", name: "rdf:type", reads: "target-to-source", rev: 0 },
    { kind: "prefix", prefix: "rdf", uri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#", rev: 0 },
    { kind: "prefix", prefix: "rdfs", uri: "http://www.w3.org/2000/01/rdf-schema#", rev: 0 },
    { kind: "account", id: MIGRATION_ACCOUNT_ID, accountKind: "system", displayName: "移行", rev: 0 },
    { kind: "commit", seq: 0, committedAt: now, issuer: MIGRATION_ACCOUNT_ID },
  );
  return records;
}

function convertMap(
  context: MapContext,
  makeId: (prefix: string, mapId: string, recordKind: string, seed: string) => string,
  records: SnapshotRecord[],
): void {
  const { mapId, row, state, nodeIds, linkIds, annotationIds } = context;
  const nodeByOldId = new Map(context.nodes);

  // --- map ---
  const mapRecord: Dict = { kind: "map", id: mapId };
  if (typeof state.rootId === "string") mapRecord.rootNodeId = nodeIds.get(state.rootId) ?? state.rootId;
  copyPresent(mapRecord, row as unknown as Dict, ["tags", "archived", "pinned", "source"]);
  if (present(row.version)) mapRecord.legacyVersion = row.version;
  if (present(row.saved_at)) mapRecord.legacySavedAt = row.saved_at;
  copyPresent(mapRecord, state, ["linearTextFontScale", "linearPanelWidth"]);
  const mapExtra = collectExtra(state, STATE_FIELDS, STATE_DROPPED_FIELDS);
  if (mapExtra) mapRecord.extra = mapExtra;
  mapRecord.rev = 0;
  records.push(mapRecord as unknown as MapRecord);

  // --- node, details ---
  const edgeLabels = new Map<string, unknown>();
  for (const [oldId, node] of context.nodes) {
    const id = nodeIds.get(oldId)!;
    const record: Dict = { kind: "node", id, mapId };
    const nodeType = node.nodeType;
    if (present(nodeType) && nodeType !== "folder" && nodeType !== "leaf" && nodeType !== "text") {
      record.nodeType = nodeType;
    }
    record.text = present(node.text) ? node.text : "";
    if (node.collapsed === true) record.collapsed = true;
    const attributes = cleanAttributes(node.attributes, EDGE_LABEL_ATTRIBUTE);
    if (attributes) record.attributes = attributes;
    if (isDict(node.attributes) && present(node.attributes[EDGE_LABEL_ATTRIBUTE])) {
      edgeLabels.set(oldId, node.attributes[EDGE_LABEL_ATTRIBUTE]);
    }
    const alias: Dict = {};
    if (typeof node.targetNodeId === "string") alias.target = nodeIds.get(node.targetNodeId) ?? node.targetNodeId;
    if (present(node.aliasLabel)) alias.label = node.aliasLabel;
    if (present(node.access)) alias.access = node.access;
    if (present(node.targetSnapshotLabel)) alias.snapshotLabel = node.targetSnapshotLabel;
    if (node.isBroken === true) alias.broken = true;
    if (Object.keys(alias).length > 0) record.alias = alias as AliasValue;
    const extra = collectExtra(node, NODE_FIELDS);
    if (extra) record.extra = extra;
    record.rev = 0;
    records.push(record as unknown as NodeRecord);

    const details: Dict = { kind: "details", nodeId: id, mapId, v: 1 };
    if (present(node.details) && node.details !== "") details.body = node.details;
    if (present(node.note) && node.note !== "") details.note = node.note;
    if (present(node.link) && node.link !== "") details.link = node.link;
    if ("body" in details || "note" in details || "link" in details) {
      details.rev = 0;
      records.push(details as unknown as DetailsRecord);
    }
  }

  // --- scope ---
  // One per map root node and per `folder` node. Keyed here by the current node id.
  const scopeIdByRoot = new Map<string, string>();
  for (const [oldId, node] of context.nodes) {
    if (oldId === state.rootId || node.nodeType === "folder") {
      scopeIdByRoot.set(oldId, makeId("s_", mapId, "scope", nodeIds.get(oldId)!));
    }
  }
  // The scope each edge lies on (DA59), by the rule of shared/scope_plane.ts.
  const planeNodes = Object.fromEntries(context.nodes) as unknown as Record<string, TreeNode>;
  const planeRootId = typeof state.rootId === "string" ? state.rootId : "";

  // --- connection: edge ---
  // Children grouped by the parent they name; order follows the parent's `children`,
  // then the children the parent does not list, by current id.
  const childrenByParent = new Map<string, string[]>();
  for (const [oldId, node] of context.nodes) {
    if (typeof node.parentId !== "string") continue;
    const siblings = childrenByParent.get(node.parentId);
    if (siblings) siblings.push(oldId);
    else childrenByParent.set(node.parentId, [oldId]);
  }
  for (const parentOldId of [...childrenByParent.keys()].sort(compareStrings)) {
    const members = childrenByParent.get(parentOldId)!; // already in id order
    const memberSet = new Set(members);
    const ordered: string[] = [];
    const seen = new Set<string>();
    const listed = nodeByOldId.get(parentOldId)?.children;
    for (const childId of Array.isArray(listed) ? listed : []) {
      if (typeof childId !== "string" || !memberSet.has(childId) || seen.has(childId)) continue;
      seen.add(childId);
      ordered.push(childId);
    }
    for (const childId of members) {
      if (!seen.has(childId)) ordered.push(childId);
    }
    const keys = initialKeys(ordered.length);
    ordered.forEach((childOldId, index) => {
      const target = nodeIds.get(childOldId)!;
      const edge: Dict = {
        kind: "connection",
        id: makeId("c_", mapId, "edge", target),
        mapId,
        type: "edge",
        source: nodeIds.get(parentOldId) ?? parentOldId,
        target,
      };
      const label = edgeLabels.get(childOldId);
      if (present(label) && label !== "") edge.label = label;
      edge.ord = keys[index];
      const scopeRoot = edgeScopeRootOf(planeNodes, planeRootId, childOldId);
      if (scopeIdByRoot.has(scopeRoot)) edge.scopeId = scopeIdByRoot.get(scopeRoot)!;
      edge.rev = 0;
      records.push(edge as unknown as EdgeConnectionRecord);
    });
  }

  // --- connection: graphlink ---
  const endpoint = (value: unknown): unknown =>
    typeof value === "string" ? nodeIds.get(value) ?? linkIds.get(value) ?? value : value;
  for (const [oldId, link] of context.links) {
    const record: Dict = { kind: "connection", id: linkIds.get(oldId)!, mapId, type: "graphlink" };
    if (present(link.sourceNodeId)) record.source = endpoint(link.sourceNodeId);
    if (present(link.targetNodeId)) record.target = endpoint(link.targetNodeId);
    copyPresent(record, link, ["relationType", "label"]);
    const attributes = cleanAttributes(link.attributes);
    if (attributes) record.attributes = attributes;
    copyPresent(record, link, ["direction", "style", "color"]);
    if (present(link.sourcePort) && link.sourcePort !== "auto") record.sourcePort = link.sourcePort;
    if (present(link.targetPort) && link.targetPort !== "auto") record.targetPort = link.targetPort;
    const extra = collectExtra(link, LINK_FIELDS);
    if (extra) record.extra = extra;
    record.rev = 0;
    records.push(record as unknown as GraphLinkConnectionRecord);
  }

  /** Current scope reference (`<nodeId>` or `scope:<nodeId>`) -> current root node id. */
  const scopeRootOf = (ref: unknown): string | undefined => {
    if (typeof ref !== "string") return undefined;
    if (scopeIdByRoot.has(ref)) return ref;
    if (ref.startsWith(SCOPE_PREFIX) && scopeIdByRoot.has(ref.slice(SCOPE_PREFIX.length))) {
      return ref.slice(SCOPE_PREFIX.length);
    }
    return undefined;
  };

  // --- surface, nodeView ---
  const surfaceIds = new Map<string, string>();
  const surfaceRecords: SnapshotRecord[] = [];
  for (const [oldId, surface] of sortedEntries(state.surfaces)) {
    const root = scopeRootOf(surface.scopeId);
    if (root === undefined) continue; // its scope is dropped, so the surface and its node views are too
    const id = makeId("v_", mapId, "surface", oldId);
    surfaceIds.set(oldId, id);
    surfaceRecords.push({ kind: "idMap", recordKind: "surface", mapId, oldId, newId: id });
    const record: Dict = { kind: "surface", id, mapId, scopeId: scopeIdByRoot.get(root)! };
    if (present(surface.kind)) record.surfaceKind = surface.kind;
    copyPresent(record, surface, ["layout", "surfaceView"]);
    record.rev = 0;
    surfaceRecords.push(record as unknown as SurfaceRecord);
    for (const [nodeOldId, view] of sortedEntries(surface.nodeViews)) {
      const nodeId = nodeIds.get(nodeOldId);
      if (nodeId === undefined) continue;
      const viewRecord: Dict = { kind: "nodeView", surfaceId: id, nodeId, mapId };
      copyPresent(viewRecord, view, NODE_VIEW_FIELDS);
      if (NODE_VIEW_FIELDS.some((field) => field in viewRecord)) {
        surfaceRecords.push(viewRecord as unknown as NodeViewRecord);
      }
    }
  }

  const currentScopes = dictOf(state.scopes);
  for (const root of [...scopeIdByRoot.keys()].sort(compareStrings)) {
    const record: Dict = { kind: "scope", id: scopeIdByRoot.get(root)!, mapId, rootNodeId: nodeIds.get(root)! };
    const current = currentScopes[SCOPE_PREFIX + root];
    const primary = isDict(current) && typeof current.primarySurfaceId === "string"
      ? surfaceIds.get(current.primarySurfaceId)
      : undefined;
    if (primary !== undefined) record.primarySurfaceId = primary;
    record.rev = 0;
    records.push(record as unknown as ScopeRecord);
  }
  records.push(...surfaceRecords);

  // --- linearText ---
  const notes = dictOf(state.linearNotesByScope);
  const scopesWithText = new Set<string>();
  for (const key of Object.keys(notes).sort(compareStrings)) {
    const text = notes[key];
    if (!present(text) || text === "") continue;
    const record: Dict = { kind: "linearText" };
    const root = scopeRootOf(key);
    if (root !== undefined && !scopesWithText.has(root)) {
      scopesWithText.add(root);
      record.scopeId = scopeIdByRoot.get(root)!;
      record.mapId = mapId;
    } else {
      record.mapId = mapId;
      record.orphanKey = key;
    }
    record.text = text;
    if (root === undefined) {
      const stripped = key.startsWith(SCOPE_PREFIX) ? key.slice(SCOPE_PREFIX.length) : key;
      const anchor = nodeIds.get(key) ?? nodeIds.get(stripped);
      if (anchor !== undefined) record.anchorNodeId = anchor;
    }
    record.rev = 0;
    records.push(record as unknown as LinearTextRecord);
  }

  // --- annotation ---
  for (const [oldId, annotation] of context.annotations) {
    const record: Dict = { kind: "annotation", id: annotationIds.get(oldId)!, mapId };
    const extra: Dict = collectExtra(annotation, ANNOTATION_FIELDS) ?? {};
    if (present(annotation.scopeId)) {
      const root = scopeRootOf(annotation.scopeId);
      if (root !== undefined) record.scopeId = scopeIdByRoot.get(root)!;
      else extra.scopeId = annotation.scopeId;
    }
    if (present(annotation.kind)) record.annotationKind = annotation.kind;
    copyPresent(record, annotation, ANNOTATION_COPIED_FIELDS);
    if (Object.keys(extra).length > 0) record.extra = extra as { [key: string]: JsonValue };
    record.rev = 0;
    records.push(record as unknown as AnnotationRecord);
  }
}
