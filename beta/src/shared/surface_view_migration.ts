import { normalizeLayoutVocabulary, type LayoutDirection, type LayoutSpace } from "./layout_port";

export interface SurfaceViewVocabulary {
  direction: LayoutDirection;
  space: LayoutSpace;
}

/** Legacy Radial storage values are read as the Tree two-sided preset. */
export function isLegacyBalancedTreeSurface(raw: unknown): boolean {
  return raw === "mindmap" || raw === "balanced-tree";
}

interface MapReadNode { attributes?: unknown; }
interface MapReadScope { rootNodeIds?: unknown; }

/** Minimal durable-map contract at the viewer read boundary. */
export interface SurfaceViewMapReadState {
  rootId: string;
  nodes: Record<string, MapReadNode>;
  scopes?: Record<string, MapReadScope>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function sanitizeSurfaceSpace(value: unknown): LayoutSpace {
  return normalizeLayoutVocabulary({ space: value }).space;
}

export function sanitizeSurfaceLayoutDirection(value: unknown): LayoutDirection {
  return normalizeLayoutVocabulary({ direction: value }).direction;
}

function legacyAttributesForScope(state: SurfaceViewMapReadState, scopeId: string): Record<string, unknown> {
  const scope = state.scopes?.[scopeId];
  const rootNodeId = Array.isArray(scope?.rootNodeIds) && typeof scope.rootNodeIds[0] === "string"
    ? scope.rootNodeIds[0]
    : scopeId.startsWith("scope:") ? scopeId.slice("scope:".length) : state.rootId;
  return asRecord(state.nodes[rootNodeId]?.attributes);
}

/**
 * Read-boundary migration for maps saved before `surfaceView`. New surface
 * fields win per field; missing values are restored from the scope root.
 */
export function migrateSurfaceViewFromMapRead(
  state: SurfaceViewMapReadState,
  scopeId: string,
  rawSurfaceView: unknown,
  legacyBalancedTree = false,
): SurfaceViewVocabulary {
  const surfaceView = asRecord(rawSurfaceView);
  const attributes = legacyAttributesForScope(state, scopeId);
  const vocabulary = normalizeLayoutVocabulary({
    direction: surfaceView.direction,
    branchDirection: surfaceView.branchDirection ?? attributes["m3e:branch-direction"],
    space: surfaceView.space,
    density: surfaceView.density ?? attributes["m3e:layout-density"],
  });
  return legacyBalancedTree ? { ...vocabulary, direction: "left/right" } : vocabulary;
}
