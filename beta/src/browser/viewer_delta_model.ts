import type { SaveTouches } from './save_command';
import type { AppState, TreeNode, MapScope, MapSurface, SurfaceNodeView, SurfaceKind, SurfaceLayout } from '../shared/types';
import { migrateSurfaceViewFromMapRead, isLegacyBalancedTreeSurface } from '../shared/surface_view_migration';

export function createMapNormalizer(h: {
  rawAttr(node: TreeNode, key: string): string;
  isFolderNode(node: TreeNode): boolean;
  uiLabel(node: TreeNode): string;
  surfaceLayoutForKind(kind: SurfaceKind): SurfaceLayout;
}) {
  const { rawAttr, isFolderNode, uiLabel, surfaceLayoutForKind } = h;
  let indexedState: AppState | null = null;
  const topology = new Map<string,{parent:string|null;folder:boolean;kind:SurfaceKind}>();
  const incident = new Map<string, Set<string>>();
  const linkOrder = new Map<string, number>();
  const linkScopes = new Map<string, Set<string>>();
  const scopeLinks = new Map<string, Set<string>>();
  const scopeSurfaces = new Map<string, Set<string>>();
  function scopeOf(state: AppState, id: string): string {
    let node: TreeNode | undefined = state.nodes[id];
    while (node) {
      if (isFolderNode(node)) return inferredScopeId(node.id);
      node = node.parentId ? state.nodes[node.parentId] : undefined;
    }
    return inferredScopeId(state.rootId);
  }
  function index(state: AppState): void {
    indexedState = state; linkOrder.clear(); incident.clear(); linkScopes.clear(); scopeLinks.clear(); scopeSurfaces.clear();
    topology.clear();
    for(const node of Object.values(state.nodes))topology.set(node.id,{parent:node.parentId,folder:isFolderNode(node),kind:defaultSurfaceKindForScopeNode(node)});
    for (const link of Object.values(state.links || {})) {
      linkOrder.set(link.id, linkOrder.size);
      for (const id of [link.sourceNodeId, link.targetNodeId]) {
        const bucket = incident.get(id) ?? new Set<string>(); bucket.add(link.id); incident.set(id, bucket);
      }
    }
    for (const scope of Object.values(state.scopes || {})) {
      scopeLinks.set(scope.id, new Set(scope.relationIds));
      for (const id of scope.relationIds) {
        const owners = linkScopes.get(id) ?? new Set<string>(); owners.add(scope.id); linkScopes.set(id, owners);
      }
    }
    for (const surface of Object.values(state.surfaces || {})) {
      const ids = scopeSurfaces.get(surface.scopeId) ?? new Set<string>(); ids.add(surface.id); scopeSurfaces.set(surface.scopeId, ids);
    }
  }
  function trackSurface(surface: MapSurface): void {
    const bucket = scopeSurfaces.get(surface.scopeId) ?? new Set<string>();
    bucket.add(surface.id); scopeSurfaces.set(surface.scopeId, bucket);
  }
  function syncTouchedNodeViews(state: AppState, surfaceId: string, ids: readonly string[]): boolean {
    const surface = state.surfaces?.[surfaceId]; if (!surface) return false;
    surface.nodeViews ??= {};
    let changed = false;
    for (const id of ids) {
      const node = state.nodes[id]; if (!node) continue;
      const before = surface.nodeViews[id], view = { ...before };
      const col = rawAttr(node, 'm3e:flow-col'), row = rawAttr(node, 'm3e:flow-row');
      const shape = rawAttr(node, 'm3e:shape') || rawAttr(node, 'pj04:shape');
      if (col) view.flowCol = Number(col); if (row) view.flowRow = Number(row);
      if (shape === 'rect' || shape === 'diamond' || shape === 'rounded') view.shape = shape;
      if (JSON.stringify(before || {}) !== JSON.stringify(view)) { surface.nodeViews[id] = view; changed = true; }
    }
    return changed;
  }
  function editTouches(state: AppState, ids: readonly string[]): SaveTouches | undefined {
    if (state !== indexedState) return undefined;
    const scopes = new Set(ids.map(inferredScopeId)), surfaces = new Set<string>(), seen = new Set<string>();
    const visit = (id: string, start: boolean) => {
      if (seen.has(id)) return; seen.add(id);
      const node = state.nodes[id]; if (!node) return;
      incident.get(id)?.forEach(link => linkScopes.get(link)?.forEach(scope => scopes.add(scope)));
      if (start || !isFolderNode(node)) node.children.forEach(child => visit(child, false));
    };
    ids.forEach(id => visit(id, true));
    for (const scope of scopes) {
      scopeSurfaces.get(scope)?.forEach(id => surfaces.add(id));
      const node = state.nodes[scope.slice('scope:'.length)];
      if (node) surfaces.add(inferredSurfaceId(node.id, defaultSurfaceKindForScopeNode(node)));
    }
    return { nodes: [...ids], scopes: [...scopes], surfaces: [...surfaces] };
  }
  function restoreIndex(state: AppState, touches: SaveTouches): void {
    if (state !== indexedState || touches.links?.length || touches.$map?.length) { indexedState = null; return; }
    for(const id of touches.nodes||[]){const node=state.nodes[id];if(node)topology.set(id,{parent:node.parentId,folder:isFolderNode(node),kind:defaultSurfaceKindForScopeNode(node)});else topology.delete(id);}
    // Restore only affected ownership buckets after an exact undo/redo patch.
    for (const scope of touches.scopes || []) {
      for (const id of scopeLinks.get(scope) || []) linkScopes.get(id)?.delete(scope);
      const ids = new Set(state.scopes?.[scope]?.relationIds || []); scopeLinks.set(scope, ids);
      for (const id of ids) { const owners = linkScopes.get(id) ?? new Set<string>(); owners.add(scope); linkScopes.set(id, owners); }
      scopeSurfaces.delete(scope);
    }
    for (const id of touches.surfaces || []) {
      const surface = state.surfaces?.[id]; if (!surface) continue;
      const bucket = scopeSurfaces.get(surface.scopeId) ?? new Set<string>(); bucket.add(id); scopeSurfaces.set(surface.scopeId, bucket);
    }
  }
  /** Normalized local edits use the incident relation/surface indexes. */
  function normalizeTouched(state: AppState, ids: readonly string[]): SaveTouches | null {
    if (state !== indexedState || ids.some(id => !state.nodes[id])) return null;
    const affectedScopes = new Set<string>(), affectedLinks = new Set<string>(), visited = new Set<string>();
    const visit = (id: string, start: boolean, descend = true) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = state.nodes[id]; if (!node) return;
      incident.get(id)?.forEach(link => affectedLinks.add(link));
      if (descend && (start || !isFolderNode(node))) node.children.forEach(child => visit(child, false));
    };
    for (const id of ids) {
      const node=state.nodes[id]!,old=topology.get(id);
      const structural=!old||old.parent!==node.parentId||old.folder!==isFolderNode(node);
      if (!structural && old.kind===defaultSurfaceKindForScopeNode(node)) continue;
      affectedScopes.add(inferredScopeId(id));
      visit(id,true,structural);
    }
    for(const id of visited){const node=state.nodes[id]!;topology.set(id,{parent:node.parentId,folder:isFolderNode(node),kind:defaultSurfaceKindForScopeNode(node)});}
    for (const id of affectedLinks) {
      const link = state.links?.[id];
      const next = new Set(link ? [scopeOf(state, link.sourceNodeId), scopeOf(state, link.targetNodeId)] : []);
      for (const old of linkScopes.get(id) || []) { scopeLinks.get(old)?.delete(id); affectedScopes.add(old); }
      for (const owner of next) {
        const bucket = scopeLinks.get(owner) ?? new Set<string>(); bucket.add(id); scopeLinks.set(owner, bucket); affectedScopes.add(owner);
      }
      linkScopes.set(id, next);
    }
    const surfaces: string[] = [];
    state.scopes ??= {}; state.surfaces ??= {};
    for (const scopeId of affectedScopes) {
      const id = scopeId.slice('scope:'.length), node = state.nodes[id];
      if (!node || (id !== state.rootId && !isFolderNode(node))) {
        delete state.scopes[scopeId]; scopeLinks.delete(scopeId);
        for (const surfaceId of scopeSurfaces.get(scopeId) || []) { delete state.surfaces[surfaceId]; surfaces.push(surfaceId); }
        scopeSurfaces.delete(scopeId); continue;
      }
      const previous: MapScope | undefined = state.scopes[scopeId];
      const kind = defaultSurfaceKindForScopeNode(node);
      const surfaceId = previous?.primarySurfaceId && state.surfaces[previous.primarySurfaceId]
        ? previous.primarySurfaceId : inferredSurfaceId(id, kind);
      state.scopes[scopeId] = { id: previous?.id || scopeId, label: previous?.label || uiLabel(node) || (id === state.rootId ? 'Root' : id),
        rootNodeIds: previous?.rootNodeIds?.length ? previous.rootNodeIds.filter(root => !!state.nodes[root]) : [id],
        relationIds: [...(scopeLinks.get(scopeId) || [])].sort((a, b) => (linkOrder.get(a) || 0) - (linkOrder.get(b) || 0)), primarySurfaceId: surfaceId };
      if (!state.surfaces[surfaceId]) {
        state.surfaces[surfaceId] = { id: surfaceId, scopeId, kind, layout: surfaceLayoutForKind(kind),
          surfaceView: migrateSurfaceViewFromMapRead(state, scopeId, undefined), nodeViews: {} };
        const bucket = scopeSurfaces.get(scopeId) ?? new Set<string>(); bucket.add(surfaceId); scopeSurfaces.set(scopeId, bucket); surfaces.push(surfaceId);
      }
    }
    return { scopes: [...affectedScopes], surfaces };
  }

function inferredScopeId(nodeId: string): string {
  return `scope:${nodeId}`;
}

function inferredSurfaceId(nodeId: string, kind: SurfaceKind): string {
  return `surface:${nodeId}:${kind}`;
}

function sanitizeSurfaceKind(raw: unknown): SurfaceKind | null {
  return raw === "tree"
    || raw === "system"
    || raw === "scatter"
    || raw === "logic-chart"
    || raw === "timeline" || raw === "lane"
    ? raw
    : null;
}

function sanitizeSurfaceLayout(raw: unknown): SurfaceLayout | null {
  return raw === "tree"
    || raw === "flow-lr"
    || raw === "scatter"
    || raw === "logic-chart"
    || raw === "timeline" || raw === "lane"
    ? raw
    : null;
}

function defaultSurfaceKindForScopeNode(node: TreeNode): SurfaceKind {
  const rawLayout = rawAttr(node, "m3e:layout");
  if (rawLayout === "flow-lr") return "system";
  // Legacy persisted layout: migrate on read to the Tree two-sided preset.
  if (rawLayout === "mindmap" || rawLayout === "balanced-tree") return "tree";
  if (rawLayout === "logic-chart") return "logic-chart";
  if (rawLayout === "timeline") return "timeline";
  if (rawLayout === "scatter") return "scatter";
  return "tree";
}

function sanitizeSurfaceNodeViews(raw: unknown, nodes: Record<string, TreeNode>): Record<string, SurfaceNodeView> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const views: Record<string, SurfaceNodeView> = {};
  Object.entries(raw as Record<string, SurfaceNodeView>).forEach(([nodeId, view]) => {
    if (!nodes[nodeId] || !view || typeof view !== "object") {
      return;
    }
    const next: SurfaceNodeView = {};
    if (Number.isFinite(view.x)) next.x = Number(view.x);
    if (Number.isFinite(view.y)) next.y = Number(view.y);
    if (Number.isFinite(view.flowCol)) next.flowCol = Number(view.flowCol);
    if (Number.isFinite(view.flowRow)) next.flowRow = Number(view.flowRow);
    if (view.shape === "rect" || view.shape === "diamond" || view.shape === "rounded") {
      next.shape = view.shape;
    }
    if (Object.keys(next).length > 0) {
      views[nodeId] = next;
    }
  });
  return views;
}

function sanitizeMapModelState(state: AppState): void {
  const rawScopes = state.scopes && typeof state.scopes === "object" ? state.scopes : {};
  const rawSurfaces = state.surfaces && typeof state.surfaces === "object" ? state.surfaces : {};
  const scopes: Record<string, MapScope> = {};
  const surfaces: Record<string, MapSurface> = {};
  const folderScopeNodeIds = Object.values(state.nodes)
    .filter((node) => node.id === state.rootId || isFolderNode(node))
    .map((node) => node.id);
  const localScopeRootForNode = (nodeId: string): string => {
    let cursor: string | null = nodeId;
    while (cursor) {
      const current: TreeNode | undefined = state.nodes[cursor];
      if (!current) break;
      if (current.nodeType === "folder") {
        return current.id;
      }
      cursor = current.parentId ?? null;
    }
    return state.rootId;
  };
  const validScopeIds = new Set(folderScopeNodeIds.map((nodeId) => inferredScopeId(nodeId)));

  Object.entries(rawSurfaces).forEach(([surfaceKey, rawSurface]) => {
    if (!rawSurface || typeof rawSurface !== "object") {
      return;
    }
    const surface = rawSurface as MapSurface;
    const scopeId = typeof surface.scopeId === "string" ? surface.scopeId : "";
    if (!validScopeIds.has(scopeId)) {
      return;
    }
    const kind = sanitizeSurfaceKind(surface.kind) || "tree";
    surfaces[surfaceKey] = {
      id: typeof surface.id === "string" && surface.id ? surface.id : surfaceKey,
      scopeId,
      kind,
      layout: sanitizeSurfaceLayout(surface.layout) || surfaceLayoutForKind(kind),
      surfaceView: migrateSurfaceViewFromMapRead(
        state,
        scopeId,
        (surface as MapSurface & { surfaceView?: unknown }).surfaceView,
        isLegacyBalancedTreeSurface(surface.kind) || isLegacyBalancedTreeSurface(surface.layout),
      ),
      nodeViews: sanitizeSurfaceNodeViews(surface.nodeViews, state.nodes),
    };
  });

  folderScopeNodeIds.forEach((nodeId) => {
    const node = state.nodes[nodeId];
    if (!node) return;
    const scopeId = inferredScopeId(nodeId);
    const existingScope = rawScopes[scopeId];
    const surfaceKind = defaultSurfaceKindForScopeNode(node);
    const preferredPrimarySurfaceId = typeof existingScope?.primarySurfaceId === "string" && surfaces[existingScope.primarySurfaceId]
      ? existingScope.primarySurfaceId
      : inferredSurfaceId(nodeId, surfaceKind);
    const relationIds = Object.values(state.links || {})
      .filter((link) => {
        const source = state.nodes[link.sourceNodeId];
        const target = state.nodes[link.targetNodeId];
        if (!source || !target) return false;
        return localScopeRootForNode(source.id) === nodeId || localScopeRootForNode(target.id) === nodeId;
      })
      .map((link) => link.id);

    scopes[scopeId] = {
      id: existingScope?.id || scopeId,
      label: existingScope?.label || uiLabel(node) || (nodeId === state.rootId ? "Root" : nodeId),
      rootNodeIds: Array.isArray(existingScope?.rootNodeIds) && existingScope!.rootNodeIds.length > 0
        ? existingScope!.rootNodeIds.filter((id) => Boolean(state.nodes[id]))
        : [nodeId],
      relationIds,
      primarySurfaceId: preferredPrimarySurfaceId,
    };

    const existingSurface = surfaces[preferredPrimarySurfaceId];
    surfaces[preferredPrimarySurfaceId] = {
      id: existingSurface?.id || preferredPrimarySurfaceId,
      scopeId,
      kind: existingSurface?.kind || surfaceKind,
      layout: existingSurface?.layout || surfaceLayoutForKind(existingSurface?.kind || surfaceKind),
      surfaceView: existingSurface?.surfaceView || migrateSurfaceViewFromMapRead(state, scopeId, undefined),
      nodeViews: existingSurface?.nodeViews || {},
    };
  });

  state.scopes = scopes;
  state.surfaces = surfaces;
  index(state);
}

  return { trackSurface, syncTouchedNodeViews, editTouches, restoreIndex, normalizeTouched, inferredScopeId, inferredSurfaceId, sanitizeSurfaceKind, sanitizeSurfaceLayout,
    defaultSurfaceKindForScopeNode, sanitizeSurfaceNodeViews, sanitizeMapModelState };
}
