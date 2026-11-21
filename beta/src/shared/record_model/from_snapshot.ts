// Snapshot records -> rows in the current `AppState` shape.
// Contract: .kiro/specs/rapid-persistence-redesign/snapshot-format.md section 4.

import type { AppState, GraphLink, MapAnnotation, MapScope, MapSurface, SurfaceNodeView, TreeNode } from "../types";
import { recordKeyString } from "./jsonl";
import { EDGE_LABEL_ATTRIBUTE } from "./to_snapshot";
import {
  compareStrings,
  type AnnotationRecord,
  type DetailsRecord,
  type EdgeConnectionRecord,
  type ExtensionDefRecord,
  type GraphLinkConnectionRecord,
  type LinearTextRecord,
  type MapRecord,
  type GrantRecord,
  type LockRecord,
  type NodeRecord,
  type NodeViewRecord,
  type ScopeRecord,
  type SnapshotRecord,
  type SnapshotRow,
  type SurfaceRecord,
} from "./types";

export interface RestoredRow extends SnapshotRow {
  state: AppState;
}

export interface FromSnapshotResult {
  workspaceId?: string;
  rows: RestoredRow[];
}

type Dict = Record<string, unknown>;

function group<T extends { mapId: string }>(items: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const list = out.get(item.mapId);
    if (list) list.push(item);
    else out.set(item.mapId, [item]);
  }
  return out;
}

function copyDefined(target: Dict, source: Dict, fields: readonly string[]): void {
  for (const field of fields) {
    if (source[field] !== undefined) target[field] = source[field];
  }
}

export function fromSnapshot(records: SnapshotRecord[]): FromSnapshotResult {
  let workspaceId: string | undefined;
  const maps: MapRecord[] = [];
  const nodes: NodeRecord[] = [];
  const details = new Map<string, DetailsRecord>();
  const edges: EdgeConnectionRecord[] = [];
  const graphLinks: GraphLinkConnectionRecord[] = [];
  const scopes: ScopeRecord[] = [];
  const linearTexts: LinearTextRecord[] = [];
  const surfaces: SurfaceRecord[] = [];
  const nodeViews: NodeViewRecord[] = [];
  const annotations: AnnotationRecord[] = [];
  const extensionDefs: ExtensionDefRecord[] = [];
  const locks: LockRecord[] = [];
  const grants: GrantRecord[] = [];
  for (const record of records) {
    switch (record.kind) {
      case "snapshot": workspaceId = record.workspaceId; break;
      case "map": maps.push(record); break;
      case "node": nodes.push(record); break;
      case "details": details.set(record.nodeId, record); break;
      case "connection":
        if (record.type === "edge") edges.push(record);
        else graphLinks.push(record);
        break;
      case "scope": scopes.push(record); break;
      case "linearText": linearTexts.push(record); break;
      case "surface": surfaces.push(record); break;
      case "nodeView": nodeViews.push(record); break;
      case "annotation": annotations.push(record); break;
      case "extensionDef": extensionDefs.push(record); break;
      case "lock": locks.push(record); break;
      case "grant": grants.push(record); break;
      default: break; // seeded records and idMap carry nothing of the current shape
    }
  }

  const nodesByMap = group(nodes);
  const edgesByMap = group(edges);
  const linksByMap = group(graphLinks);
  const scopesByMap = group(scopes);
  const textsByMap = group(linearTexts);
  const surfacesByMap = group(surfaces);
  const viewsByMap = group(nodeViews);
  const annotationsByMap = group(annotations);
  const byId = (a: { id: string }, b: { id: string }): number => compareStrings(a.id, b.id);

  const rows: RestoredRow[] = [];
  for (const map of [...maps].sort(byId)) {
    const mapId = map.id;
    const mapScopes = [...(scopesByMap.get(mapId) ?? [])].sort(byId);
    const scopeRootById = new Map(mapScopes.map((scope) => [scope.id, scope.rootNodeId]));
    const scopeRoots = new Set(scopeRootById.values());
    const scopeIdOfRoot = new Map<string, string>();
    for (const scope of mapScopes) if (!scopeIdOfRoot.has(scope.rootNodeId)) scopeIdOfRoot.set(scope.rootNodeId, scope.id);

    // tree: parent and ordered children come from the edges
    const incoming = new Map<string, EdgeConnectionRecord>();
    const outgoing = new Map<string, EdgeConnectionRecord[]>();
    for (const edge of [...(edgesByMap.get(mapId) ?? [])].sort(byId)) {
      if (!incoming.has(edge.target)) incoming.set(edge.target, edge);
      const list = outgoing.get(edge.source);
      if (list) list.push(edge);
      else outgoing.set(edge.source, [edge]);
    }

    const stateNodes: Record<string, TreeNode> = {};
    for (const record of [...(nodesByMap.get(mapId) ?? [])].sort(byId)) {
      const edge = incoming.get(record.id);
      const children = [...(outgoing.get(record.id) ?? [])]
        .sort((a, b) => compareStrings(a.ord, b.ord) || compareStrings(a.id, b.id))
        .map((child) => child.target);
      const body = details.get(record.id);
      const attributes: Record<string, string> = { ...((record.attributes ?? {}) as Record<string, string>) };
      if (edge?.label !== undefined) attributes[EDGE_LABEL_ATTRIBUTE] = edge.label;
      const node: Dict = {
        ...(record.extra ?? {}),
        id: record.id,
        parentId: edge ? edge.source : null,
        children,
        nodeType: record.nodeType ?? (scopeRoots.has(record.id) && record.id !== map.rootNodeId ? "folder" : "text"),
        text: record.text,
        collapsed: record.collapsed === true,
        details: body?.body ?? "",
        note: body?.note ?? "",
        attributes,
        link: body?.link ?? "",
      };
      const alias = record.alias;
      if (alias) {
        if (alias.target !== undefined) node.targetNodeId = alias.target;
        if (alias.label !== undefined) node.aliasLabel = alias.label;
        if (alias.access !== undefined) node.access = alias.access;
        if (alias.snapshotLabel !== undefined) node.targetSnapshotLabel = alias.snapshotLabel;
        if (alias.broken === true) node.isBroken = true;
      }
      if (record.extensions !== undefined) node.extensions = record.extensions;
      if (record.valid !== undefined) node.valid = record.valid;
      if (record.copyOf !== undefined) node.copyOf = record.copyOf;
      if (edge?.relationType !== undefined) node.edgeRelationType = edge.relationType;
      if (edge?.attributes !== undefined) node.edgeAttributes = edge.attributes;
      if (edge?.extensions !== undefined) node.edgeExtensions = edge.extensions;
      // An edge out of a scope root that lies on another scope: the child stays outside (DA59).
      if (edge?.scopeId !== undefined && edge.source !== map.rootNodeId) {
        const ownScope = scopeIdOfRoot.get(edge.source);
        if (ownScope !== undefined && edge.scopeId !== ownScope) node.edgeOutsideScope = true;
      }
      stateNodes[record.id] = node as unknown as TreeNode;
    }

    const state: Dict = { ...(map.extra ?? {}) };
    if (map.rootNodeId !== undefined) state.rootId = map.rootNodeId;
    state.nodes = stateNodes;

    const stateLinks: Record<string, GraphLink> = {};
    for (const record of [...(linksByMap.get(mapId) ?? [])].sort(byId)) {
      const link: Dict = { ...(record.extra ?? {}), id: record.id };
      if (record.source !== undefined) link.sourceNodeId = record.source;
      if (record.target !== undefined) link.targetNodeId = record.target;
      copyDefined(link, record as unknown as Dict, [
        "relationType", "label", "direction", "style", "color", "sourcePort", "targetPort", "attributes", "extensions",
      ]);
      stateLinks[record.id] = link as unknown as GraphLink;
    }
    if (Object.keys(stateLinks).length > 0) state.links = stateLinks;

    const stateAnnotations: Record<string, MapAnnotation> = {};
    for (const record of [...(annotationsByMap.get(mapId) ?? [])].sort(byId)) {
      const { kind: _kind, id, mapId: _mapId, scopeId, annotationKind, extra, rev: _rev, ...fields } = record;
      const annotation: Dict = { ...(extra ?? {}), id };
      if (annotationKind !== undefined) annotation.kind = annotationKind;
      // Current annotations name their scope by the scope root node id.
      if (scopeId !== undefined) annotation.scopeId = scopeRootById.get(scopeId) ?? scopeId;
      Object.assign(annotation, fields);
      stateAnnotations[id] = annotation as unknown as MapAnnotation;
    }
    if (Object.keys(stateAnnotations).length > 0) state.annotations = stateAnnotations;

    const stateScopes: Record<string, MapScope> = {};
    for (const record of mapScopes) {
      const id = `scope:${record.rootNodeId}`;
      const scope: MapScope = {
        id,
        label: stateNodes[record.rootNodeId]?.text ?? "",
        rootNodeIds: [record.rootNodeId],
        relationIds: [],
      };
      if (record.primarySurfaceId !== undefined) scope.primarySurfaceId = record.primarySurfaceId;
      stateScopes[id] = scope;
    }
    if (Object.keys(stateScopes).length > 0) state.scopes = stateScopes;

    const viewsBySurface = new Map<string, Record<string, SurfaceNodeView>>();
    for (const view of viewsByMap.get(mapId) ?? []) {
      const { kind: _kind, surfaceId, nodeId, mapId: _mapId, ...fields } = view;
      const views = viewsBySurface.get(surfaceId) ?? {};
      views[nodeId] = fields as SurfaceNodeView;
      viewsBySurface.set(surfaceId, views);
    }
    const stateSurfaces: Record<string, MapSurface> = {};
    for (const record of [...(surfacesByMap.get(mapId) ?? [])].sort(byId)) {
      const root = scopeRootById.get(record.scopeId);
      const surface: Dict = {
        id: record.id, // the new id stays; old surface ids are not restored
        scopeId: root !== undefined ? `scope:${root}` : record.scopeId,
      };
      if (record.surfaceKind !== undefined) surface.kind = record.surfaceKind;
      if (record.layout !== undefined) surface.layout = record.layout;
      if (record.surfaceView !== undefined) surface.surfaceView = record.surfaceView;
      const views = viewsBySurface.get(record.id);
      if (views) surface.nodeViews = views;
      stateSurfaces[record.id] = surface as unknown as MapSurface;
    }
    if (Object.keys(stateSurfaces).length > 0) state.surfaces = stateSurfaces;

    const notes: Record<string, string> = {};
    for (const record of textsByMap.get(mapId) ?? []) {
      // Current linear texts are keyed by the scope root node id.
      const key = record.scopeId !== undefined ? scopeRootById.get(record.scopeId) ?? record.scopeId : record.orphanKey;
      if (key !== undefined) notes[key] = record.text;
    }
    if (Object.keys(notes).length > 0) state.linearNotesByScope = notes;

    if (map.linearTextFontScale !== undefined) state.linearTextFontScale = map.linearTextFontScale;
    if (map.linearPanelWidth !== undefined) state.linearPanelWidth = map.linearPanelWidth;
    if (extensionDefs.length > 0) {
      state.extensionDefs = [...extensionDefs].sort((a, b) => compareStrings(recordKeyString(a), recordKeyString(b)));
    }

    const stateLocks: Dict = {};
    for (const lock of locks.filter((lock) => lock.mapId === mapId).sort((a, b) => compareStrings(a.target, b.target))) {
      stateLocks[lock.target] = { target: lock.target };
    }
    if (Object.keys(stateLocks).length > 0) state.locks = stateLocks;
    const stateGrants: Dict = {};
    for (const grant of grants.filter((grant) => grant.mapId === mapId).sort((a, b) => compareStrings(a.id, b.id))) {
      const body: Dict = {
        scopeId: grant.scopeId,
        principal: { account: grant.principal.account },
        capability: grant.capability,
        grantedBy: grant.grantedBy,
      };
      if (grant.expiresAt !== undefined) body.expiresAt = grant.expiresAt;
      stateGrants[grant.id] = body;
    }
    if (Object.keys(stateGrants).length > 0) state.grants = stateGrants;

    const row: Dict = { id: mapId, state };
    copyDefined(row, map as unknown as Dict, ["tags", "archived", "pinned", "source"]);
    if (map.legacyVersion !== undefined) row.version = map.legacyVersion;
    if (map.legacySavedAt !== undefined) row.saved_at = map.legacySavedAt;
    rows.push(row as unknown as RestoredRow);
  }
  return { workspaceId, rows };
}
