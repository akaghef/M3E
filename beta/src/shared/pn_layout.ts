import type { EdgePortSide } from "./edge_port";
import type { EdgeRouteStyle } from "./edge_route";
import { routeParentChildEdge } from "./parent_child_edge_adapter";

export type PnId = string;

export interface PnNode {
  id: PnId;
  parentId?: PnId | null;
  label: string;
  hint: string;
  action?: "command" | "toggle" | "open" | "generate" | "noop";
}

export interface PnRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PnViewportSnapshot {
  width: number;
  height: number;
  cameraX?: number;
  cameraY?: number;
  zoom?: number;
}

export interface PnSafeZone {
  id: string;
  rect: PnRect;
  weight: number;
  reason: "canvas-content" | "selected-node" | "rail" | "topbar" | "right-panel" | "modal" | "custom";
}

export interface PnNodeMetrics {
  w: number;
  h: number;
}

export type PnPlacementMode = "right-of-anchor" | "compact" | "fixed-side-panel" | "scroll";
export type PnOverflowMode = "none" | "scroll" | "compact" | "side-panel";
export type PnRouteStyle = "orthogonal" | "line" | "curve";

export interface PnLayoutInput {
  nodes: PnNode[];
  rootId: PnId;
  activeId: PnId;
  anchorRect: PnRect;
  viewport: PnViewportSnapshot;
  safeZones: PnSafeZone[];
  nodeMetrics: Record<PnId, PnNodeMetrics>;
  options?: {
    maxDepth?: number;
    siblingPolicy?: "active-path-plus-siblings" | "active-path-plus-children";
    placementCandidates?: PnPlacementMode[];
    routeStyle?: PnRouteStyle;
    minColumnGap?: number;
    minRowGap?: number;
    searchQuery?: string;
  };
}

export interface PnPlacedNode {
  id: PnId;
  rect: PnRect;
  depth: number;
  selected: boolean;
  hasChildren: boolean;
  visibleReason: "root" | "active-path" | "sibling" | "child" | "search";
}

export interface PnRoutedEdge {
  id: string;
  sourceId: PnId;
  targetId: PnId;
  sourceRect: PnRect;
  targetRect: PnRect;
  sourceSide: EdgePortSide;
  targetSide: EdgePortSide;
  routeStyle: EdgeRouteStyle;
  d: string;
  active: boolean;
}

export interface PnPlacementDecision {
  mode: PnPlacementMode;
  rect: PnRect;
  overlapScore: number;
  canvasNodeOverlapScore: number;
  trialOrder: PnPlacementMode[];
  rejected: Array<{ mode: PnPlacementMode; rect: PnRect; overlapScore: number; canvasNodeOverlapScore: number }>;
}

export interface PnLayoutOutput {
  overlayRect: PnRect;
  placement: PnPlacementDecision;
  visibleNodeIds: PnId[];
  pathIds: PnId[];
  nodes: PnPlacedNode[];
  nodeRectsById: Record<PnId, PnRect>;
  edges: PnRoutedEdge[];
  focusOrder: PnId[];
  overflow: { mode: PnOverflowMode; clippedIds: PnId[]; scrollRect?: PnRect };
}

type InternalMode = PnPlacementMode;
type Direction = "right";

const DEFAULT_TRIAL_ORDER: PnPlacementMode[] = [
  "right-of-anchor",
];
const DEFAULT_NODE: PnNodeMetrics = { w: 172, h: 47 };
const ROOT_METRIC: PnNodeMetrics = { w: 44, h: 44 };
const VIEWPORT_MARGIN = 16;
const DEFAULT_MIN_WIDTH = 486;
const DEFAULT_MIN_HEIGHT = 420;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function rect(x: number, y: number, w: number, h: number): PnRect {
  return { x: round(x), y: round(y), w: round(w), h: round(h) };
}

function metricFor(id: PnId, input: PnLayoutInput): PnNodeMetrics {
  return input.nodeMetrics[id] || (id === input.rootId ? ROOT_METRIC : DEFAULT_NODE);
}

function rectRight(item: PnRect): number {
  return item.x + item.w;
}

function rectBottom(item: PnRect): number {
  return item.y + item.h;
}

function overlapArea(a: PnRect, b: PnRect): number {
  const x = Math.max(0, Math.min(rectRight(a), rectRight(b)) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(rectBottom(a), rectBottom(b)) - Math.max(a.y, b.y));
  return round(x * y);
}

function viewportOverflow(rectangle: PnRect, viewport: PnViewportSnapshot): number {
  const left = Math.max(0, -rectangle.x);
  const top = Math.max(0, -rectangle.y);
  const right = Math.max(0, rectRight(rectangle) - viewport.width);
  const bottom = Math.max(0, rectBottom(rectangle) - viewport.height);
  return round((left + top + right + bottom) * 1000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildIndexes(nodes: PnNode[]): {
  nodeById: Map<PnId, PnNode>;
  childrenByParent: Map<PnId, PnNode[]>;
} {
  const nodeById = new Map<PnId, PnNode>();
  const childrenByParent = new Map<PnId, PnNode[]>();
  nodes.forEach((node) => nodeById.set(node.id, node));
  nodes.forEach((node) => {
    if (!node.parentId) return;
    const siblings = childrenByParent.get(node.parentId) || [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  });
  return { nodeById, childrenByParent };
}

function pathToRoot(activeId: PnId, rootId: PnId, nodeById: Map<PnId, PnNode>): PnId[] {
  const path: PnId[] = [];
  const seen = new Set<PnId>();
  let current = nodeById.get(activeId) || nodeById.get(rootId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.id);
    current = current.parentId ? nodeById.get(current.parentId) : undefined;
  }
  if (path[0] !== rootId) path.unshift(rootId);
  return path;
}

function matchesSearch(node: PnNode, query: string): boolean {
  const haystack = `${node.label} ${node.hint}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function visibleIds(input: PnLayoutInput): {
  pathIds: PnId[];
  visibleNodeIds: PnId[];
  visibleReason: Map<PnId, PnPlacedNode["visibleReason"]>;
} {
  const { nodeById, childrenByParent } = buildIndexes(input.nodes);
  const pathIds = pathToRoot(input.activeId, input.rootId, nodeById);
  const visible = new Set<PnId>([input.rootId]);
  const reason = new Map<PnId, PnPlacedNode["visibleReason"]>([[input.rootId, "root"]]);
  const searchQuery = input.options?.searchQuery?.trim();

  pathIds.forEach((id, index) => {
    visible.add(id);
    if (id !== input.rootId) reason.set(id, "active-path");
    const children = childrenByParent.get(id) || [];
    children.forEach((child) => {
      visible.add(child.id);
      reason.set(child.id, pathIds.includes(child.id) ? "active-path" : "child");
    });
    if (input.options?.siblingPolicy !== "active-path-plus-children" && index > 0) {
      const parentId = nodeById.get(id)?.parentId;
      (parentId ? childrenByParent.get(parentId) || [] : []).forEach((sibling) => {
        visible.add(sibling.id);
        if (!reason.has(sibling.id)) reason.set(sibling.id, "sibling");
      });
    }
  });

  if (searchQuery) {
    input.nodes.forEach((node) => {
      if (!matchesSearch(node, searchQuery)) return;
      let current: PnNode | undefined = node;
      while (current) {
        visible.add(current.id);
        reason.set(current.id, current.id === node.id ? "search" : reason.get(current.id) || "active-path");
        current = current.parentId ? nodeById.get(current.parentId) : undefined;
      }
    });
  }

  const order = input.nodes.filter((node) => visible.has(node.id)).map((node) => node.id);
  return { pathIds, visibleNodeIds: order, visibleReason: reason };
}

function depthOf(id: PnId, nodeById: Map<PnId, PnNode>, rootId: PnId): number {
  let depth = 0;
  let current = nodeById.get(id);
  const seen = new Set<PnId>();
  while (current?.parentId && current.id !== rootId && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = nodeById.get(current.parentId);
  }
  return depth;
}

function columnsForVisible(input: PnLayoutInput, visibleNodeIds: PnId[]): PnId[][] {
  const { nodeById } = buildIndexes(input.nodes);
  const columns: PnId[][] = [];
  visibleNodeIds.forEach((id) => {
    if (id === input.rootId) return;
    const depth = depthOf(id, nodeById, input.rootId);
    if (!columns[depth]) columns[depth] = [];
    columns[depth]!.push(id);
  });
  return columns.filter(Boolean);
}

function estimateSize(input: PnLayoutInput, visibleNodeIds: PnId[], mode: PnPlacementMode): { w: number; h: number; columnGap: number; rowGap: number } {
  const columns = columnsForVisible(input, visibleNodeIds);
  const compact = mode === "compact" || mode === "scroll";
  const columnGap = compact ? Math.max(28, input.options?.minColumnGap || 32) : input.options?.minColumnGap || 48;
  const rowGap = compact ? Math.max(5, input.options?.minRowGap || 5) : input.options?.minRowGap || 7;
  const maxColumnWidth = Math.max(DEFAULT_NODE.w, ...visibleNodeIds.map((id) => metricFor(id, input).w));
  const maxRows = Math.max(1, ...columns.map((column) => column.length));
  const depthCount = Math.max(1, columns.length);
  const w = Math.max(DEFAULT_MIN_WIDTH, 36 + depthCount * maxColumnWidth + Math.max(0, depthCount - 1) * columnGap + 28);
  const h = Math.max(DEFAULT_MIN_HEIGHT, 36 + maxRows * DEFAULT_NODE.h + Math.max(0, maxRows - 1) * rowGap + 36);
  return { w, h, columnGap, rowGap };
}

function candidateRect(input: PnLayoutInput, mode: PnPlacementMode, size: { w: number; h: number }): PnRect {
  const anchor = input.anchorRect;
  const viewport = input.viewport;
  const top = clamp(anchor.y + anchor.h / 2 - size.h / 2, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, viewport.height - size.h - VIEWPORT_MARGIN));
  if (mode === "right-of-anchor") return rect(anchor.x + anchor.w + 18, top, size.w, size.h);
  if (mode === "compact") {
    const compactWidth = Math.min(size.w, Math.max(360, viewport.width - 112));
    const left = anchor.x + anchor.w + 12;
    return rect(clamp(left, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, viewport.width - compactWidth - VIEWPORT_MARGIN)), top, compactWidth, size.h);
  }
  if (mode === "fixed-side-panel") {
    const panelWidth = Math.min(420, Math.max(320, viewport.width - 64));
    return rect(VIEWPORT_MARGIN, VIEWPORT_MARGIN + 56, panelWidth, Math.max(320, viewport.height - 104));
  }
  return rect(VIEWPORT_MARGIN, VIEWPORT_MARGIN + 56, Math.max(320, viewport.width - 32), Math.max(320, viewport.height - 104));
}

function placeNodes(
  input: PnLayoutInput,
  visibleNodeIds: PnId[],
  pathIds: PnId[],
  visibleReason: Map<PnId, PnPlacedNode["visibleReason"]>,
  overlayRect: PnRect,
  mode: InternalMode,
): { nodes: PnPlacedNode[]; nodeRectsById: Record<PnId, PnRect>; overflow: PnLayoutOutput["overflow"] } {
  const { nodeById, childrenByParent } = buildIndexes(input.nodes);
  const size = estimateSize(input, visibleNodeIds, mode);
  const direction: Direction = "right";
  const rootMetric = metricFor(input.rootId, input);
  const root = rect(input.anchorRect.x - overlayRect.x, input.anchorRect.y - overlayRect.y, rootMetric.w, rootMetric.h);
  const byId: Record<PnId, PnRect> = { [input.rootId]: root };
  const visibleSet = new Set(visibleNodeIds);
  const placed: PnPlacedNode[] = [];
  const queue: PnId[] = [input.rootId];
  const seen = new Set<PnId>();

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    if (seen.has(parentId)) continue;
    seen.add(parentId);
    const parentRect = byId[parentId];
    if (!parentRect) continue;
    const children = (childrenByParent.get(parentId) || []).filter((child) => visibleSet.has(child.id));
    if (children.length === 0) continue;
    const totalHeight = children.reduce((sum, child, index) => sum + metricFor(child.id, input).h + (index > 0 ? size.rowGap : 0), 0);
    let childTop = parentRect.y + parentRect.h / 2 - totalHeight / 2;
    children.forEach((child) => {
      const metric = metricFor(child.id, input);
      const x = direction === "right"
        ? rectRight(parentRect) + size.columnGap
        : parentRect.x - size.columnGap - metric.w;
      byId[child.id] = rect(x, childTop, metric.w, metric.h);
      childTop += metric.h + size.rowGap;
      queue.push(child.id);
    });
  }

  const renderedIds = visibleNodeIds.filter((id) => id !== input.rootId && byId[id]);
  const minTop = Math.min(0, ...renderedIds.map((id) => byId[id]!.y));
  const maxBottom = Math.max(overlayRect.h, ...renderedIds.map((id) => rectBottom(byId[id]!)));
  if (minTop < 0) {
    renderedIds.forEach((id) => {
      const current = byId[id]!;
      byId[id] = rect(current.x, current.y - minTop + 12, current.w, current.h);
    });
  }
  const clippedIds = renderedIds.filter((id) => {
    const item = byId[id]!;
    return item.x < 0 || item.y < 0 || rectRight(item) > overlayRect.w || rectBottom(item) > overlayRect.h;
  });
  const overflowMode: PnOverflowMode = clippedIds.length > 0 || maxBottom > overlayRect.h
    ? mode === "fixed-side-panel" ? "side-panel" : mode === "compact" ? "compact" : "scroll"
    : "none";

  visibleNodeIds.forEach((id) => {
    const node = nodeById.get(id);
    const item = byId[id];
    if (!node || !item) return;
    placed.push({
      id,
      rect: item,
      depth: depthOf(id, nodeById, input.rootId),
      selected: pathIds.includes(id) || id === input.activeId,
      hasChildren: Boolean(childrenByParent.get(id)?.length),
      visibleReason: visibleReason.get(id) || "child",
    });
  });

  return {
    nodes: placed,
    nodeRectsById: byId,
    overflow: {
      mode: overflowMode,
      clippedIds,
      ...(overflowMode === "none" ? {} : { scrollRect: rect(0, 0, overlayRect.w, overlayRect.h) }),
    },
  };
}

function absoluteRect(overlay: PnRect, local: PnRect): PnRect {
  return rect(overlay.x + local.x, overlay.y + local.y, local.w, local.h);
}

function canvasScore(overlay: PnRect, nodes: PnPlacedNode[], safeZones: PnSafeZone[]): number {
  const canvasZones = safeZones.filter((zone) => zone.reason === "canvas-content" || zone.reason === "selected-node");
  return round(canvasZones.reduce((sum, zone) => {
    const overlayOverlap = overlapArea(overlay, zone.rect);
    const nodeOverlap = nodes
      .filter((node) => node.id !== nodes[0]?.id)
      .reduce((nodeSum, node) => nodeSum + overlapArea(absoluteRect(overlay, node.rect), zone.rect), 0);
    return sum + overlayOverlap + nodeOverlap;
  }, 0));
}

function weightedScore(overlay: PnRect, nodes: PnPlacedNode[], safeZones: PnSafeZone[], viewport: PnViewportSnapshot): number {
  const safeScore = safeZones.reduce((sum, zone) => {
    const overlayOverlap = overlapArea(overlay, zone.rect);
    const nodeOverlap = nodes.reduce((nodeSum, node) => nodeSum + overlapArea(absoluteRect(overlay, node.rect), zone.rect), 0);
    return sum + (overlayOverlap + nodeOverlap) * zone.weight;
  }, 0);
  return round(safeScore + viewportOverflow(overlay, viewport));
}

function routeEdges(
  input: PnLayoutInput,
  visibleNodeIds: PnId[],
  pathIds: PnId[],
  rects: Record<PnId, PnRect>,
  mode: PnPlacementMode,
): PnRoutedEdge[] {
  const { childrenByParent } = buildIndexes(input.nodes);
  const visible = new Set(visibleNodeIds);
  const routeStyle = input.options?.routeStyle || "orthogonal";
  const direction: Direction = "right";
  const edges: PnRoutedEdge[] = [];
  visibleNodeIds.forEach((parentId) => {
    const parentRect = rects[parentId];
    if (!parentRect) return;
    (childrenByParent.get(parentId) || []).forEach((child) => {
      if (!visible.has(child.id)) return;
      const childRect = rects[child.id];
      if (!childRect) return;
      const routed = routeParentChildEdge({
        relation: { kind: "parent-child", parentNodeId: parentId, childNodeId: child.id },
        parentRect,
        childRect,
        surfaceMode: "tree",
        direction,
        routeStyle,
      });
      edges.push({
        id: `${parentId}-${child.id}`,
        sourceId: parentId,
        targetId: child.id,
        sourceRect: parentRect,
        targetRect: childRect,
        sourceSide: routed.ports.source.side,
        targetSide: routed.ports.target.side,
        routeStyle: routed.path.style,
        d: routed.path.d,
        active: pathIds.indexOf(parentId) >= 0 && pathIds.indexOf(child.id) === pathIds.indexOf(parentId) + 1,
      });
    });
  });
  return edges;
}

function explicitOverflow(
  current: PnLayoutOutput["overflow"],
  overlayRect: PnRect,
  viewport: PnViewportSnapshot,
  mode: PnPlacementMode,
): PnLayoutOutput["overflow"] {
  if (current.mode !== "none" || viewportOverflow(overlayRect, viewport) === 0) return current;
  const overflowMode: PnOverflowMode = mode === "fixed-side-panel"
    ? "side-panel"
    : mode === "compact"
      ? "compact"
      : "scroll";
  return {
    mode: overflowMode,
    clippedIds: current.clippedIds,
    scrollRect: rect(0, 0, overlayRect.w, overlayRect.h),
  };
}

export function layoutProgressiveNav(input: PnLayoutInput): PnLayoutOutput {
  const visibility = visibleIds(input);
  const trialOrder = input.options?.placementCandidates || DEFAULT_TRIAL_ORDER;
  const rejected: PnPlacementDecision["rejected"] = [];
  let best: PnLayoutOutput | null = null;

  for (const mode of trialOrder) {
    const size = estimateSize(input, visibility.visibleNodeIds, mode);
    const overlayRect = candidateRect(input, mode, size);
    const placed = placeNodes(input, visibility.visibleNodeIds, visibility.pathIds, visibility.visibleReason, overlayRect, mode);
    const candidateCanvasScore = canvasScore(overlayRect, placed.nodes, input.safeZones);
    const candidateOverlapScore = weightedScore(overlayRect, placed.nodes, input.safeZones, input.viewport);
    const decision: PnPlacementDecision = {
      mode,
      rect: overlayRect,
      overlapScore: candidateOverlapScore,
      canvasNodeOverlapScore: candidateCanvasScore,
      trialOrder,
      rejected: [...rejected],
    };
    const output: PnLayoutOutput = {
      overlayRect,
      placement: decision,
      visibleNodeIds: visibility.visibleNodeIds,
      pathIds: visibility.pathIds,
      nodes: placed.nodes,
      nodeRectsById: placed.nodeRectsById,
      edges: routeEdges(input, visibility.visibleNodeIds, visibility.pathIds, placed.nodeRectsById, mode),
      focusOrder: visibility.visibleNodeIds.filter((id) => id !== input.rootId),
      overflow: explicitOverflow(placed.overflow, overlayRect, input.viewport, mode),
    };
    if (!best || candidateCanvasScore < best.placement.canvasNodeOverlapScore) {
      best = output;
    }
    if (candidateCanvasScore === 0 || trialOrder.length === 1) return output;
    rejected.push({ mode, rect: overlayRect, overlapScore: candidateOverlapScore, canvasNodeOverlapScore: candidateCanvasScore });
  }

  if (!best) {
    throw new Error("layoutProgressiveNav requires at least one placement candidate.");
  }
  return {
    ...best,
    placement: {
      ...best.placement,
      rejected,
    },
    overflow: {
      ...best.overflow,
      mode: best.overflow.mode === "none" ? "scroll" : best.overflow.mode,
      scrollRect: best.overflow.scrollRect || rect(0, 0, best.overlayRect.w, best.overlayRect.h),
    },
  };
}
