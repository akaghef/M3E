import type { AppState, GraphLink, MapSurface, TreeNode } from "./types";

export interface LaneProjection {
  rootId: string;
  lanes: Array<{ id: string; label: string; nodeIds: string[] }>;
  nodeIds: string[];
  links: GraphLink[];
  hiddenCounts: Record<string, number>;
  omittedLinkCount: number;
}

export interface LaneLayoutMetadata {
  rootId: string;
  rootLabel?: string;
  direction: "down" | "right";
  boundaries: Array<{ id: string; label: string; count: number; labelLines?: string[]; fontSize?: number; x: number; y: number; w: number; h: number }>;
  hiddenCounts: Record<string, number>;
  omittedLinkCount: number;
}

export function laneDirection(raw: unknown): "right" | "down" {
  return raw === "down" ? "down" : "right";
}

export function resolveLaneRoot(state: AppState, scopeRootId: string, surface?: MapSurface | null): string {
  const rootId = surface?.displayRootId ?? scopeRootId;
  const visited = new Set<string>();
  let cursor: string | null = rootId;
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const node: TreeNode | undefined = state.nodes[cursor];
    if (!node) break;
    if (cursor === scopeRootId) return rootId;
    if (node.nodeType === "folder") break;
    cursor = node.parentId;
  }
  throw new Error("Lane の root node が見つからないか、別の scope に属しています。");
}

/** Select existing surface settings without altering nodes, links, or scope roots. */
export function selectLaneSurface(state: AppState, scopeRootId: string, rootId?: string): MapSurface {
  const scopeId = `scope:${scopeRootId}`;
  const scope = state.scopes?.[scopeId];
  if (!scope) throw new Error("Lane を保存する scope が見つかりません。");
  const id = `surface:${scopeRootId}:lane`;
  const previous = state.surfaces?.[id];
  resolveLaneRoot(state, scopeRootId, { ...previous, displayRootId: rootId ?? previous?.displayRootId } as MapSurface);
  state.surfaces ??= {};
  const surface: MapSurface = previous ?? { id, scopeId, kind: "lane", layout: "lane", surfaceView: { direction: "right", space: "normal" }, nodeViews: {} };
  if (rootId !== undefined) surface.displayRootId = rootId;
  surface.surfaceView = { direction: laneDirection(surface.surfaceView?.direction), space: surface.surfaceView?.space ?? "normal" };
  state.surfaces[id] = surface;
  scope.primarySurfaceId = id;
  return surface;
}

/** Existing scoped persistence carries settings only for wholly included scopes
 * that have Lane settings; unrelated Surface Views keep their existing path. */
export function scopedLaneSettings(state: AppState, included: ReadonlySet<string>): Pick<AppState, "scopes" | "surfaces"> {
  const scopes = Object.fromEntries(Object.entries(state.scopes ?? {}).filter(([id, scope]) =>
    scope.rootNodeIds.length > 0 && scope.rootNodeIds.every(root => included.has(root)) &&
    Object.values(state.surfaces ?? {}).some(surface => surface.kind === "lane" && surface.scopeId === id)));
  if (!Object.keys(scopes).length) return {};
  const surfaces = Object.fromEntries(Object.entries(state.surfaces ?? {}).filter(([, surface]) => scopes[surface.scopeId]).map(([id, surface]) =>
    [id, { ...surface, nodeViews: Object.fromEntries(Object.entries(surface.nodeViews ?? {}).filter(([node]) => included.has(node))) }]));
  return { scopes, surfaces };
}

export function projectLane(state: AppState, rootId: string, collapsed: ReadonlySet<string>): LaneProjection {
  const root = state.nodes[rootId];
  if (!root) throw new Error("Lane の root node が見つかりません。");
  const descendants = new Set<string>();
  const collect = (id: string, into: Set<string>): void => {
    if (!state.nodes[id] || into.has(id)) return;
    into.add(id);
    state.nodes[id].children.forEach(child => collect(child, into));
  };
  collect(rootId, descendants);
  const hiddenCounts: Record<string, number> = {};
  const lanes = root.children.filter(id => state.nodes[id]).map(id => {
    const node = state.nodes[id];
    const nodeIds = collapsed.has(id) || node.collapsed || node.nodeType === "folder"
      ? [] : node.children.filter(child => state.nodes[child]);
    nodeIds.forEach(child => {
      const hidden = new Set<string>();
      state.nodes[child].children.forEach(id => collect(id, hidden));
      hiddenCounts[child] = hidden.size;
    });
    return { id, label: node.aliasLabel?.trim() || node.text.trim() || "名称未設定", nodeIds };
  });
  const nodeIds = lanes.flatMap(lane => lane.nodeIds);
  const visible = new Set(nodeIds);
  const relevant = Object.values(state.links ?? {}).filter(link => descendants.has(link.sourceNodeId) || descendants.has(link.targetNodeId));
  const links = relevant.filter(link => visible.has(link.sourceNodeId) && visible.has(link.targetNodeId));
  return { rootId, lanes, nodeIds, links, hiddenCounts, omittedLinkCount: relevant.length - links.length };
}
