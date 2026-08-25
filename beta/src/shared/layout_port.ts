import type { GraphLink, SurfaceNodeView } from "./types";
import { selectPorts, type EdgeDirection, type EdgeRect } from "./edge_port";
import { route, type EdgePath, type EdgeRouteStyle } from "./edge_route";
import {
  layoutDisperse,
  type DisperseEdge,
  type DisperseGroupBoundary,
  type DisperseSubtype,
  type EdgeAggregation,
  type SuperNodeFootprint,
} from "./disperse_layout";

export type LayoutMode = "Tree" | "Axial" | "Radial" | "Disperse" | "System";
export type LegacyLayoutMode =
  | "tree"
  | "right-tree"
  | "down-tree"
  | "system"
  | "scatter"
  | "force-directed"
  | "mindmap"
  | "balanced-tree"
  | "logic-chart"
  | "timeline";
export type LayoutModeInput = LayoutMode | LegacyLayoutMode;
export type StructuredLayoutMode = LayoutMode | "tree" | "mindmap" | "logic-chart" | "timeline" | "right-tree" | "down-tree" | "balanced-tree";
type LayoutAlgorithmMode = "tree" | "mindmap" | "logic-chart" | "timeline";
export type LayoutDirection = "right" | "left" | "down" | "up" | "left/right" | "up/down";
type CardinalLayoutDirection = Exclude<LayoutDirection, "left/right" | "up/down">;
export type LayoutDepthAlign = "aligned" | "packed";
export type LayoutSpace = "tight" | "normal" | "loose";

/** Normalizes persisted pre-2026-08-23 layout vocabulary at a read boundary. */
export function normalizeLayoutVocabulary(raw: unknown): { direction: LayoutDirection; space: LayoutSpace } {
  const legacy = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rawDirection = legacy["direction"] ?? legacy["branchDirection"];
  const rawSpace = legacy["space"] ?? legacy["density"];
  const direction: LayoutDirection = rawDirection === "both"
    ? "left/right"
    : rawDirection === "left/right" || rawDirection === "left" || rawDirection === "right" || rawDirection === "up/down" || rawDirection === "up" || rawDirection === "down"
      ? rawDirection
      : "right";
  const space: LayoutSpace = rawSpace === "tight" || rawSpace === "compact"
    ? "tight"
    : rawSpace === "loose" || rawSpace === "spacious"
      ? "loose"
      : "normal";
  return { direction, space };
}
/** Legacy horizontal branch label retained for existing viewer snapshots. */
export type LayoutBranchSide = "left" | "right";
/** Outbound cardinal side used as the authoritative Tree port input. */
export type LayoutBranchPortSide = "left" | "right" | "up" | "down";
export type LayoutEdgeRoute = "elbow" | "bezier" | "straight";
export type LayoutLinkRoute = "simple-bezier" | "orthogonal" | "straight";

export type GraphLinkLike = Pick<
  GraphLink,
  "id" | "sourceNodeId" | "targetNodeId" | "relationType" | "label" | "direction" | "style" | "color" | "sourcePort" | "targetPort"
>;

export interface VisibleLayoutGraph {
  nodeIds: string[];
  childrenOf: (id: string) => string[];
  graphLinks: GraphLinkLike[];
}

export interface LayoutNodeMetric {
  w: number;
  h: number;
  labelLines?: string[];
  fontSize?: number;
}

export interface LayoutNodePosition extends LayoutNodeMetric {
  x: number;
  y: number;
  depth: number;
  branchSide?: LayoutBranchSide;
  branchPortSide?: LayoutBranchPortSide;
  scatterCollapsedGroup?: boolean;
}

/**
 * Canonical layout seam for edge rendering: consumers provide layout positions,
 * while this port selects endpoints and builds the route.
 */
export function routeLayoutEdge(
  source: LayoutNodePosition,
  target: LayoutNodePosition,
  mode: LayoutMode,
  direction: LayoutDirection | undefined,
  style: EdgeRouteStyle,
): EdgePath {
  const edgeDirection = edgeDirectionForLayout(mode, direction, target.branchPortSide);
  return route(selectPorts(rectForLayoutPosition(source), rectForLayoutPosition(target), edgeDirection), style);
}

export type { EdgePath, EdgeRouteStyle };

function rectForLayoutPosition(position: LayoutNodePosition): EdgeRect {
  return { x: position.x, y: position.y - position.h / 2, w: position.w, h: position.h };
}

function edgeDirectionForLayout(
  mode: LayoutMode,
  direction: LayoutDirection | undefined,
  branchPortSide: LayoutBranchPortSide | undefined,
): EdgeDirection {
  const canonicalDirection = direction || "right";
  if (mode === "Tree") {
    if (canonicalDirection === "left/right" || canonicalDirection === "up/down") {
      if (!branchPortSide) throw new Error(`LayoutResult.branchPortSide is required for Tree ${canonicalDirection}.`);
      return { view: "Tree", direction: canonicalDirection, branchSide: branchPortSide };
    }
    return { view: "Tree", direction: canonicalDirection };
  }
  if (mode === "Axial") {
    return { view: "Axial", direction: canonicalDirection === "left" ? "left" : canonicalDirection === "up" ? "up" : canonicalDirection === "down" || canonicalDirection === "up/down" ? "down" : "right" };
  }
  if (mode === "Radial") return { view: "Radial", direction: "balanced" };
  if (mode === "Disperse") return { view: "Disperse", direction: "free" };
  return { view: "System", direction: "free" };
}

export interface LayoutOptions {
  displayRootId?: string;
  structuredMode?: StructuredLayoutMode;
  space?: LayoutSpace;
  depthAlign?: LayoutDepthAlign;
  direction?: LayoutDirection;
  spacing?: { nodeGap?: number; levelGap?: number; padding?: number };
  edge?: { route?: LayoutEdgeRoute };
  link?: { route?: LayoutLinkRoute };
  scatter?: { seed?: number; strength?: number; repulsion?: number; edgeLength?: number };
  disperse?: {
    subtype?: DisperseSubtype;
    collapsedNodeIds?: string[];
    superNodeFootprint?: SuperNodeFootprint;
    edgeAggregation?: EdgeAggregation;
  };
  surfaceNodeViews?: Record<string, SurfaceNodeView>;
  flowCells?: Record<string, { col: number; row: number; isReference: boolean }>;
  scatterCollapsedGroups?: Record<string, boolean>;
}

export interface LayoutResult {
  pos: Record<string, LayoutNodePosition>;
  order: string[];
  totalHeight: number;
  totalWidth: number;
  /** Disperse group boundaries; omitted by layouts without group geometry. */
  groups?: DisperseGroupBoundary[];
  /** Disperse-reduced edges; omitted by layouts that retain source graph edges. */
  edges?: DisperseEdge[];
}

interface StructuredLayoutConfig {
  mode: LayoutAlgorithmMode;
  space: LayoutSpace;
  spread: "both" | "right" | "left";
  columnGap: number;
  siblingGap: number;
  sideGap: number;
}

interface MeasuredTreeContext {
  displayRootId: string;
  metrics: Record<string, LayoutNodeMetric>;
  depthOf: Record<string, number>;
  depthMaxExtent: Record<number, number>;
  maxDepth: number;
  config: StructuredLayoutConfig;
  depthAlign: LayoutDepthAlign;
  axis: LayoutAxis;
}

interface LayoutAxis {
  depthExtent: (metric: LayoutNodeMetric) => number;
  breadthExtent: (metric: LayoutNodeMetric) => number;
}

const LAYOUT = {
  rootHeight: 104,
  columnGap: 255,
  leafHeight: 38,
  siblingGap: 1,
  leftPad: 80,
  topPad: 10,
  nodeHitHeight: 38,
  minCanvasWidth: 1400,
  minCanvasHeight: 760,
  canvasRightPad: 220,
  canvasBottomPad: 60,
  nodeRightPad: 260,
  depthOffsetFactor: 1.0,
};

// Preserve the pre-configurable Tree appearance when callers omit spacing.
// Explicit spacing and space must still pass through to the Tree algorithm.
const DEFAULT_TREE_SPACING = { nodeGap: 1, levelGap: 255, sidePadding: 72 };

const FLOW_SURFACE_ROW_GAP = 84;
const DEFAULT_SCATTER_EDGE_LENGTH = 180;

function structuredLayoutConfig(
  mode: LayoutAlgorithmMode,
  space: LayoutSpace = "normal",
  direction: LayoutDirection = "right",
  options: LayoutOptions = {},
): StructuredLayoutConfig {
  const tight = space === "tight";
  const loose = space === "loose";
  const mapLike = mode === "mindmap";
  const levelGap = options.spacing?.levelGap;
  const nodeGap = options.spacing?.nodeGap;
  return {
    mode,
    space,
    spread: direction === "left/right" || direction === "up/down" ? "both" : direction === "left" ? "left" : "right",
    columnGap: levelGap ?? (mapLike ? (tight ? 78 : loose ? 148 : 112) : tight ? 180 : loose ? 330 : DEFAULT_TREE_SPACING.levelGap),
    siblingGap: nodeGap ?? (mapLike ? (tight ? 18 : loose ? 34 : 26) : tight ? 7 : loose ? 24 : DEFAULT_TREE_SPACING.nodeGap),
    sideGap: options.spacing?.padding ?? (mapLike ? (tight ? 64 : loose ? 132 : 92) : tight ? 46 : loose ? 110 : DEFAULT_TREE_SPACING.sidePadding),
  };
}

function buildMeasuredTreeContext(
  displayRootId: string,
  mode: LayoutAlgorithmMode,
  graph: VisibleLayoutGraph,
  boxSizes: Record<string, LayoutNodeMetric>,
  options: LayoutOptions = {},
): MeasuredTreeContext {
  const config = structuredLayoutConfig(mode, options.space, options.direction, options);
  const vertical = options.direction === "up" || options.direction === "down" || options.direction === "up/down";
  const axis: LayoutAxis = vertical
    ? { depthExtent: (metric) => metric.h, breadthExtent: (metric) => metric.w }
    : { depthExtent: (metric) => metric.w, breadthExtent: (metric) => metric.h };
  const metrics: Record<string, LayoutNodeMetric> = {};
  const depthOf: Record<string, number> = {};
  const depthMaxExtent: Record<number, number> = {};
  let maxDepth = 0;

  function visit(nodeId: string, depth: number): void {
    const metric = boxSizes[nodeId];
    if (!metric) return;
    maxDepth = Math.max(maxDepth, depth);
    depthOf[nodeId] = depth;
    metrics[nodeId] = metric;
    depthMaxExtent[depth] = Math.max(depthMaxExtent[depth] ?? 0, axis.depthExtent(metric));
    graph.childrenOf(nodeId).forEach((childId) => visit(childId, depth + 1));
  }

  visit(displayRootId, 0);
  return { displayRootId, metrics, depthOf, depthMaxExtent, maxDepth, config, depthAlign: options.depthAlign || "packed", axis };
}

function normalizeLayoutMode(mode: LayoutModeInput): LayoutMode {
  if (mode === "Tree" || mode === "Axial" || mode === "Radial" || mode === "Disperse" || mode === "System") return mode;
  if (mode === "mindmap" || mode === "balanced-tree") return "Radial";
  if (mode === "timeline") return "Axial";
  if (mode === "scatter" || mode === "force-directed") return "Disperse";
  if (mode === "system") return "System";
  return "Tree";
}

function normalizeStructuredLayoutMode(
  mode: LayoutModeInput,
  structuredMode?: StructuredLayoutMode,
): LayoutAlgorithmMode {
  const source = structuredMode ?? mode;
  if (source === "Radial" || source === "mindmap" || source === "balanced-tree") return "mindmap";
  if (source === "Axial" || source === "timeline") return "timeline";
  if (source === "logic-chart") return "logic-chart";
  return "tree";
}

function subtreeSpanForLayout(
  nodeId: string,
  childrenOf: (id: string) => string[],
  metrics: Record<string, LayoutNodeMetric>,
  cache: Record<string, number>,
  breadthExtent: (metric: LayoutNodeMetric) => number,
  siblingGap = LAYOUT.siblingGap,
): number {
  if (cache[nodeId] !== undefined) return cache[nodeId]!;
  if (!metrics[nodeId]) return LAYOUT.leafHeight;
  const children = childrenOf(nodeId);
  if (children.length === 0) {
    const leafSpan = Math.max(LAYOUT.leafHeight, breadthExtent(metrics[nodeId]!) + siblingGap);
    cache[nodeId] = leafSpan;
    return leafSpan;
  }
  let sum = 0;
  children.forEach((childId, i) => {
    sum += subtreeSpanForLayout(childId, childrenOf, metrics, cache, breadthExtent, siblingGap);
    if (i < children.length - 1) sum += siblingGap;
  });
  const result = Math.max(sum, breadthExtent(metrics[nodeId]!) + 24);
  cache[nodeId] = result;
  return result;
}

function finalizeLayoutBounds(pos: Record<string, LayoutNodePosition>, order: string[]): Pick<LayoutResult, "totalHeight" | "totalWidth"> {
  let maxRight = LAYOUT.minCanvasWidth;
  let maxBottom = LAYOUT.minCanvasHeight;
  order.forEach((nodeId) => {
    const p = pos[nodeId];
    if (!p) return;
    const halfH = Math.max(LAYOUT.nodeHitHeight, p.h) / 2;
    maxRight = Math.max(maxRight, p.x + p.w + LAYOUT.nodeRightPad);
    maxBottom = Math.max(maxBottom, p.y + halfH + LAYOUT.canvasBottomPad);
  });
  return {
    totalHeight: Math.max(maxBottom, LAYOUT.minCanvasHeight),
    totalWidth: Math.max(maxRight + LAYOUT.canvasRightPad, LAYOUT.minCanvasWidth),
  };
}

function orientLayoutResult(result: LayoutResult, direction: CardinalLayoutDirection | undefined): LayoutResult {
  if (!direction || direction === "right") return result;
  const order = result.order.filter((nodeId) => result.pos[nodeId]);
  if (order.length === 0) return result;
  const positions = order.map((nodeId) => result.pos[nodeId]!);
  const minX = Math.min(...positions.map((p) => p.x));
  const maxX = Math.max(...positions.map((p) => p.x + p.w));
  // Vertical results originate in logical depth/breadth coordinates.  In that
  // coordinate system depth uses h and breadth uses w, so conversion must use
  // those extents rather than merely rotate the old horizontal rectangle.
  const minBreadth = Math.min(...positions.map((p) => p.y - p.w / 2));
  const maxBreadth = Math.max(...positions.map((p) => p.y + p.w / 2));
  const maxDepth = Math.max(...positions.map((p) => p.x + p.h));
  const oriented: Record<string, LayoutNodePosition> = {};
  order.forEach((nodeId) => {
    const p = result.pos[nodeId]!;
    if (direction === "left") {
      oriented[nodeId] = {
        ...p,
        x: minX + maxX - (p.x + p.w),
        branchSide: p.branchSide === "right" ? "left" : p.branchSide === "left" ? "right" : undefined,
        branchPortSide: p.branchPortSide === "right" ? "left" : p.branchPortSide === "left" ? "right" : p.branchPortSide,
      };
      return;
    }
    if (direction === "down") {
      oriented[nodeId] = {
        ...p,
        x: p.y - p.w / 2,
        y: p.x + p.h / 2,
        branchPortSide: p.branchPortSide === "left" ? "up" : p.branchPortSide === "right" ? "down" : p.branchPortSide,
      };
      return;
    }
    oriented[nodeId] = {
      ...p,
      x: minBreadth + (maxBreadth - (p.y + p.w / 2)),
      y: maxDepth - p.x - p.h / 2,
      branchPortSide: p.branchPortSide === "left" ? "up" : p.branchPortSide === "right" ? "down" : p.branchPortSide,
    };
  });
  const bounds = finalizeLayoutBounds(oriented, order);
  return { ...result, pos: oriented, totalHeight: bounds.totalHeight, totalWidth: bounds.totalWidth };
}

function timelineDirectionConfig(direction: LayoutDirection | undefined): {
  bifurcated: boolean;
  orientation: CardinalLayoutDirection;
} {
  switch (direction) {
    case "left/right":
      return { bifurcated: true, orientation: "right" };
    case "up/down":
      return { bifurcated: true, orientation: "down" };
    case "left":
    case "up":
    case "down":
      return { bifurcated: false, orientation: direction };
    case "right":
    default:
      return { bifurcated: false, orientation: "right" };
  }
}

function buildRightTreeLayout(graph: VisibleLayoutGraph, ctx: MeasuredTreeContext): LayoutResult {
  const { displayRootId, metrics, depthOf, depthMaxExtent, maxDepth, config, depthAlign, axis } = ctx;
  const xByDepth: Record<number, number> = {};
  let cursorX = LAYOUT.leftPad + (config.sideGap - DEFAULT_TREE_SPACING.sidePadding);
  for (let d = 0; d <= maxDepth; d += 1) {
    xByDepth[d] = cursorX;
    cursorX += (depthMaxExtent[d] ?? 120) + config.columnGap;
  }

  const subtreeHeightCache: Record<string, number> = {};
  const pos: Record<string, LayoutNodePosition> = {};
  const order: string[] = [];
  const depthOffsetFactor = depthAlign === "aligned" ? 0 : LAYOUT.depthOffsetFactor;

  function place(nodeId: string, topY: number, parentX: number | null, parentDepthExtent: number | null): number {
    if (!metrics[nodeId]) return LAYOUT.leafHeight;
    const depth = depthOf[nodeId] ?? 0;
    const h = subtreeSpanForLayout(
      nodeId,
      graph.childrenOf,
      metrics,
      subtreeHeightCache,
      axis.breadthExtent,
      config.siblingGap,
    );
    const centerY = topY + h / 2;
    const baseX = xByDepth[depth]!;
    const nodeX = config.mode === "logic-chart"
      ? baseX
      : parentX === null || parentDepthExtent === null
        ? baseX
        : baseX + ((parentX + parentDepthExtent + config.columnGap) - baseX) * depthOffsetFactor;
    const metric = metrics[nodeId]!;
    pos[nodeId] = {
      x: nodeX,
      y: centerY,
      depth,
      w: metric.w,
      h: metric.h,
      fontSize: metric.fontSize,
      labelLines: metric.labelLines,
      branchSide: depth === 0 ? undefined : config.spread === "left" ? "left" : "right",
      branchPortSide: depth === 0 ? undefined : config.spread === "left" ? "left" : "right",
    };
    order.push(nodeId);
    const children = graph.childrenOf(nodeId);
    const childrenSpan = children.reduce((sum, childId, index) => (
      sum
      + subtreeSpanForLayout(childId, graph.childrenOf, metrics, subtreeHeightCache, axis.breadthExtent, config.siblingGap)
      + (index > 0 ? config.siblingGap : 0)
    ), 0);
    let placeCursorY = topY + (h - childrenSpan) / 2;
    children.forEach((childId, i, arr) => {
      const childH = place(childId, placeCursorY, nodeX, axis.depthExtent(metric));
      placeCursorY += childH;
      if (i < arr.length - 1) placeCursorY += config.siblingGap;
    });
    return h;
  }

  place(displayRootId, LAYOUT.topPad, null, null);
  if (config.mode === "logic-chart" && config.spread === "left" && order.length > 0) {
    const contentLeft = Math.min(...order.map((nodeId) => pos[nodeId]!.x));
    const contentRight = Math.max(...order.map((nodeId) => pos[nodeId]!.x + pos[nodeId]!.w));
    order.forEach((nodeId) => {
      const p = pos[nodeId]!;
      p.x = contentLeft + contentRight - (p.x + p.w);
    });
  }
  const bounds = finalizeLayoutBounds(pos, order);
  return { pos, order, totalHeight: bounds.totalHeight, totalWidth: bounds.totalWidth };
}

function splitMindmapSides(graph: VisibleLayoutGraph, rootId: string, spread: StructuredLayoutConfig["spread"]): { left: string[]; right: string[] } {
  const children = graph.childrenOf(rootId);
  const left: string[] = [];
  const right: string[] = [];
  if (spread === "right") return { left, right: children };
  if (spread === "left") return { left: children, right };
  children.forEach((childId, index) => (index % 2 === 0 ? right : left).push(childId));
  return { left, right };
}

function buildMindmapLayout(graph: VisibleLayoutGraph, ctx: MeasuredTreeContext): LayoutResult {
  const { displayRootId, metrics, depthOf, depthMaxExtent, maxDepth, config, depthAlign, axis } = ctx;
  const rootMetric = metrics[displayRootId] || { w: 280, h: LAYOUT.rootHeight };
  const branchWidth = (fromDepth = 1): number => {
    let width = 0;
    for (let d = fromDepth; d <= maxDepth; d += 1) {
      width += (depthMaxExtent[d] ?? 120) + config.columnGap;
    }
    return width;
  };
  const leftBranchWidth = branchWidth();
  const rootX = config.spread === "right"
    ? LAYOUT.leftPad
    : config.spread === "left"
      ? LAYOUT.leftPad + leftBranchWidth
      : LAYOUT.leftPad + leftBranchWidth + config.sideGap;
  const rightXByDepth: Record<number, number> = {};
  const leftXByDepth: Record<number, number> = {};
  rightXByDepth[1] = rootX + axis.depthExtent(rootMetric) + config.columnGap;
  leftXByDepth[1] = rootX - config.columnGap - (depthMaxExtent[1] ?? 120);
  for (let d = 2; d <= maxDepth; d += 1) {
    rightXByDepth[d] = rightXByDepth[d - 1]! + (depthMaxExtent[d - 1] ?? 120) + config.columnGap;
    leftXByDepth[d] = leftXByDepth[d - 1]! - config.columnGap - (depthMaxExtent[d] ?? 120);
  }
  const spanCache: Record<string, number> = {};
  const { left, right } = splitMindmapSides(graph, displayRootId, config.spread);
  const sideGap = config.sideGap;
  const sideSpan = (ids: string[]) => ids.reduce((sum, id, index) => (
    sum + subtreeSpanForLayout(id, graph.childrenOf, metrics, spanCache, axis.breadthExtent, config.siblingGap) + (index > 0 ? sideGap : 0)
  ), 0);
  const totalSpan = Math.max(axis.breadthExtent(rootMetric) + 60, sideSpan(left), sideSpan(right), LAYOUT.rootHeight + 80);
  const rootY = LAYOUT.topPad + totalSpan / 2;
  const pos: Record<string, LayoutNodePosition> = {
    [displayRootId]: { x: rootX, y: rootY, depth: 0, w: rootMetric.w, h: rootMetric.h, fontSize: rootMetric.fontSize, labelLines: rootMetric.labelLines },
  };
  const order: string[] = [displayRootId];

  function placeSide(nodeId: string, topY: number, direction: -1 | 1, parentX?: number, parentDepthExtent?: number): number {
    if (!metrics[nodeId]) return LAYOUT.leafHeight;
    const depth = Math.max(1, depthOf[nodeId] ?? 1);
    const span = subtreeSpanForLayout(nodeId, graph.childrenOf, metrics, spanCache, axis.breadthExtent, config.siblingGap);
    const metric = metrics[nodeId]!;
    const centerY = topY + span / 2;
    const depthWidth = depthMaxExtent[depth] ?? axis.depthExtent(metric);
    const alignedX = direction > 0
      ? rightXByDepth[depth] ?? (rootX + axis.depthExtent(rootMetric) + config.columnGap)
      : (leftXByDepth[depth] ?? (rootX - config.columnGap - depthWidth)) + Math.max(0, depthWidth - axis.depthExtent(metric));
    const x = config.mode === "tree" && depthAlign === "packed" && parentX !== undefined && parentDepthExtent !== undefined
      ? direction > 0
        ? parentX + parentDepthExtent + config.columnGap
        : parentX - config.columnGap - axis.depthExtent(metric)
      : alignedX;
    pos[nodeId] = {
      x,
      y: centerY,
      depth,
      w: metric.w,
      h: metric.h,
      fontSize: metric.fontSize,
      labelLines: metric.labelLines,
      branchSide: direction > 0 ? "right" : "left",
      branchPortSide: direction > 0 ? "right" : "left",
    };
    order.push(nodeId);
    const children = graph.childrenOf(nodeId);
    const childrenSpan = children.reduce((sum, childId, index) => (
      sum
      + subtreeSpanForLayout(childId, graph.childrenOf, metrics, spanCache, axis.breadthExtent, config.siblingGap)
      + (index > 0 ? config.siblingGap : 0)
    ), 0);
    let cursorY = topY + (span - childrenSpan) / 2;
    children.forEach((childId, i, arr) => {
      const childSpan = placeSide(childId, cursorY, direction, x, axis.depthExtent(metric));
      cursorY += childSpan;
      if (i < arr.length - 1) cursorY += config.siblingGap;
    });
    return span;
  }

  const placeGroup = (ids: string[], direction: -1 | 1): void => {
    let cursorY = rootY - sideSpan(ids) / 2;
    ids.forEach((childId, index) => {
      const span = placeSide(childId, cursorY, direction, rootX, axis.depthExtent(rootMetric));
      cursorY += span + (index < ids.length - 1 ? sideGap : 0);
    });
  };
  placeGroup(left, -1);
  placeGroup(right, 1);

  const bounds = finalizeLayoutBounds(pos, order);
  return { pos, order, totalHeight: bounds.totalHeight, totalWidth: bounds.totalWidth };
}

function buildTimelineLayout(
  graph: VisibleLayoutGraph,
  ctx: MeasuredTreeContext,
  bifurcated: boolean,
): LayoutResult {
  const { displayRootId, metrics, depthOf, config } = ctx;
  const rootMetric = metrics[displayRootId] || { w: 280, h: LAYOUT.rootHeight };
  const rootX = LAYOUT.leftPad;
  const axisY = LAYOUT.topPad + 300;
  const pos: Record<string, LayoutNodePosition> = {
    [displayRootId]: { x: rootX, y: axisY, depth: 0, w: rootMetric.w, h: rootMetric.h, fontSize: rootMetric.fontSize, labelLines: rootMetric.labelLines },
  };
  const order: string[] = [displayRootId];
  const rootChildren = graph.childrenOf(displayRootId);
  const stepX = Math.max(config.space === "tight" ? 190 : 260, config.columnGap + 120);

  function placeDescendants(
    nodeId: string,
    baseX: number,
    baseY: number,
    sign: -1 | 1,
    depthDirection: -1 | 1,
  ): void {
    graph.childrenOf(nodeId).forEach((childId, index) => {
      const metric = metrics[childId];
      if (!metric) return;
      const x = depthDirection > 0 ? baseX + 54 : baseX - 54 - metric.w;
      const y = baseY + sign * (92 + index * 72);
      pos[childId] = { x, y, depth: depthOf[childId] ?? 1, w: metric.w, h: metric.h, fontSize: metric.fontSize, labelLines: metric.labelLines };
      order.push(childId);
      placeDescendants(childId, x, y, sign, depthDirection);
    });
  }

  rootChildren.forEach((childId, index) => {
    const metric = metrics[childId];
    if (!metric) return;
    const depthDirection: -1 | 1 = bifurcated && index % 2 === 1 ? -1 : 1;
    const x = depthDirection > 0
      ? rootX + rootMetric.w + config.columnGap + Math.floor(index / 2) * stepX
      : rootX - config.columnGap - metric.w - Math.floor(index / 2) * stepX;
    const sign: -1 | 1 = index % 2 === 0 ? -1 : 1;
    const y = axisY + sign * 132;
    pos[childId] = { x, y, depth: depthOf[childId] ?? 1, w: metric.w, h: metric.h, fontSize: metric.fontSize, labelLines: metric.labelLines };
    order.push(childId);
    placeDescendants(childId, x, y, sign, depthDirection);
  });

  const bounds = finalizeLayoutBounds(pos, order);
  return { pos, order, totalHeight: bounds.totalHeight, totalWidth: bounds.totalWidth };
}

function treeDirectionConfig(direction: LayoutDirection = "right"): {
  spread: StructuredLayoutConfig["spread"];
  bifurcated: boolean;
  orientation?: CardinalLayoutDirection;
} {
  switch (direction) {
    case "left/right": return { spread: "both", bifurcated: true };
    case "left": return { spread: "right", bifurcated: false, orientation: "left" };
    case "right": return { spread: "right", bifurcated: false };
    case "up/down": return { spread: "both", bifurcated: true, orientation: "down" };
    case "up": return { spread: "right", bifurcated: false, orientation: "up" };
    case "down": return { spread: "right", bifurcated: false, orientation: "down" };
  }
}

function scatterSeedCenter(): { x: number; y: number } {
  return { x: LAYOUT.leftPad + 620, y: LAYOUT.topPad + 390 };
}

function scatterFontSizeFor(radius: number): number {
  return Math.max(12, Math.min(36, Math.round(radius * 0.42)));
}

function scatterSeedPositionsFromGraph(
  rootId: string,
  ids: string[],
  depthOf: Record<string, number>,
  childrenOf: (id: string) => string[] = () => [],
  edgeLength = DEFAULT_SCATTER_EDGE_LENGTH,
): Record<string, { x: number; y: number }> {
  const center = scatterSeedCenter();
  const idSet = new Set(ids);
  const visibleChildrenForSeed = (nodeId: string): string[] =>
    childrenOf(nodeId).filter((childId) => idSet.has(childId));
  const childLeafCount = new Map<string, number>();
  const leafCount = (nodeId: string): number => {
    const cached = childLeafCount.get(nodeId);
    if (cached != null) return cached;
    const children = visibleChildrenForSeed(nodeId);
    const count = children.length ? children.reduce((sum, childId) => sum + leafCount(childId), 0) : 1;
    childLeafCount.set(nodeId, count);
    return count;
  };

  const yByNode: Record<string, number> = {};
  const assignBreadth = (nodeId: string, top: number): number => {
    const children = visibleChildrenForSeed(nodeId);
    if (!children.length) {
      yByNode[nodeId] = top;
      return top + edgeLength * 0.76;
    }
    let cursor = top;
    children.forEach((childId) => {
      cursor = assignBreadth(childId, cursor);
    });
    yByNode[nodeId] = (yByNode[children[0]!]! + yByNode[children[children.length - 1]!]!) / 2;
    return cursor;
  };
  const totalBreadth = leafCount(rootId) * edgeLength * 0.76;
  assignBreadth(rootId, center.y - totalBreadth / 2);

  const rankPeers: Record<number, string[]> = {};
  ids.forEach((nodeId) => {
    const depth = depthOf[nodeId] ?? 0;
    if (!rankPeers[depth]) rankPeers[depth] = [];
    rankPeers[depth]!.push(nodeId);
  });

  const seeded: Record<string, { x: number; y: number }> = {};
  ids.forEach((nodeId) => {
    const depth = depthOf[nodeId] ?? 0;
    const peers = rankPeers[depth] || [];
    const peerIndex = Math.max(0, peers.indexOf(nodeId));
    const siblingNudge = ((peerIndex % 3) - 1) * 12;
    seeded[nodeId] = {
      x: center.x + (depth - 1) * edgeLength * 1.26,
      y: (yByNode[nodeId] ?? center.y) + siblingNudge,
    };
  });
  if (ids.includes(rootId)) {
    seeded[rootId] = {
      x: center.x - edgeLength * 1.18,
      y: yByNode[rootId] ?? center.y,
    };
  }
  return seeded;
}

export function layout(
  visibleGraph: VisibleLayoutGraph,
  boxSizes: Record<string, LayoutNodeMetric>,
  mode: LayoutModeInput,
  options: LayoutOptions = {},
): LayoutResult {
  const canonicalMode = normalizeLayoutMode(mode);
  const displayRootId = options.displayRootId || visibleGraph.nodeIds[0] || "";
  const displayRootExists = Boolean(displayRootId && boxSizes[displayRootId]);

  if (canonicalMode === "Disperse" && visibleGraph.nodeIds.length > 0) {
    const result = layoutDisperse({
      nodeIds: visibleGraph.nodeIds,
      childrenOf: visibleGraph.childrenOf,
      graphLinks: visibleGraph.graphLinks,
    }, boxSizes, {
      displayRootId,
      subtype: options.disperse?.subtype || "force",
      space: options.space,
      collapsedNodeIds: options.disperse?.collapsedNodeIds,
      superNodeFootprint: options.disperse?.superNodeFootprint,
      edgeAggregation: options.disperse?.edgeAggregation,
      savedPositions: Object.fromEntries(Object.entries(options.surfaceNodeViews || {}).flatMap(([id, node]) =>
        Number.isFinite(node.x) && Number.isFinite(node.y) ? [[id, { x: Number(node.x), y: Number(node.y) }]] : [],
      )),
    });
    const pos = Object.fromEntries(Object.entries(result.pos).map(([id, position]) => {
      const sourceNodeId = position.sourceNodeId || id;
      const metric = boxSizes[sourceNodeId];
      return [id, {
        ...position,
        labelLines: metric?.labelLines,
        fontSize: metric?.fontSize,
        scatterCollapsedGroup: Boolean(options.scatterCollapsedGroups?.[sourceNodeId]),
      }];
    }));
    return { ...result, pos };
  }

  if (canonicalMode === "System" && displayRootExists) {
    const surfaceNodes = visibleGraph.childrenOf(displayRootId);
    const flowCells = options.flowCells || {};
    const primarySurfaceNodes = surfaceNodes.filter((nodeId) => !flowCells[nodeId]?.isReference);
    const referenceSurfaceNodes = surfaceNodes.filter((nodeId) => flowCells[nodeId]?.isReference);
    const pos: Record<string, LayoutNodePosition> = {};
    const order: string[] = [];
    const colMaxWidth: Record<number, number> = {};
    const rowMaxHeight: Record<number, number> = {};
    const surfaceCells: Record<string, { col: number; row: number }> = {};
    const occupiedRowsByCol: Record<number, Set<number>> = {};
    let maxCol = 0;
    let maxRow = 0;

    surfaceNodes.forEach((nodeId, index) => {
      const metric = boxSizes[nodeId];
      if (!metric || flowCells[nodeId]?.isReference) return;
      const col = flowCells[nodeId]?.col ?? index;
      const occupiedRows = occupiedRowsByCol[col] || new Set<number>();
      let row = flowCells[nodeId]?.row ?? 0;
      while (occupiedRows.has(row)) row += 1;
      occupiedRows.add(row);
      occupiedRowsByCol[col] = occupiedRows;
      surfaceCells[nodeId] = { col, row };
      maxCol = Math.max(maxCol, col);
      maxRow = Math.max(maxRow, row);
      colMaxWidth[col] = Math.max(colMaxWidth[col] ?? 0, metric.w);
      rowMaxHeight[row] = Math.max(rowMaxHeight[row] ?? 0, Math.max(LAYOUT.leafHeight + 18, metric.h + 18));
    });

    const xByCol: Record<number, number> = {};
    let cursorX = LAYOUT.leftPad;
    for (let col = 0; col <= maxCol; col += 1) {
      xByCol[col] = cursorX;
      cursorX += (colMaxWidth[col] ?? 180) + LAYOUT.columnGap;
    }

    const yByRow: Record<number, number> = {};
    let cursorY = LAYOUT.topPad + 132;
    for (let row = 0; row <= maxRow; row += 1) {
      const rowHeight = rowMaxHeight[row] ?? (LAYOUT.leafHeight + 18);
      yByRow[row] = cursorY + rowHeight / 2;
      cursorY += rowHeight + FLOW_SURFACE_ROW_GAP;
    }

    primarySurfaceNodes.forEach((nodeId, index) => {
      const resolvedCell = surfaceCells[nodeId] || { col: flowCells[nodeId]?.col ?? index, row: flowCells[nodeId]?.row ?? 0 };
      const { col, row } = resolvedCell;
      const metric = boxSizes[nodeId]!;
      pos[nodeId] = { x: xByCol[col]!, y: yByRow[row]!, depth: col, w: metric.w, h: metric.h };
      order.push(nodeId);
    });

    if (referenceSurfaceNodes.length > 0) {
      const referenceTop = cursorY + 26;
      let referenceCursorX = LAYOUT.leftPad;
      referenceSurfaceNodes.forEach((nodeId) => {
        const metric = boxSizes[nodeId]!;
        pos[nodeId] = { x: referenceCursorX, y: referenceTop + metric.h / 2, depth: maxCol + 1, w: metric.w, h: metric.h };
        order.push(nodeId);
        referenceCursorX += metric.w + LAYOUT.columnGap;
      });
      cursorY = referenceTop + Math.max(...referenceSurfaceNodes.map((nodeId) => boxSizes[nodeId]!.h)) + FLOW_SURFACE_ROW_GAP;
      cursorX = Math.max(cursorX, referenceCursorX);
    }

    return {
      pos,
      order,
      totalHeight: Math.max(cursorY + LAYOUT.canvasBottomPad, LAYOUT.minCanvasHeight),
      totalWidth: Math.max(cursorX + LAYOUT.canvasRightPad, LAYOUT.minCanvasWidth),
    };
  }

  const structuredMode = normalizeStructuredLayoutMode(mode, options.structuredMode);
  const measuredContext = buildMeasuredTreeContext(displayRootId, structuredMode, visibleGraph, boxSizes, options);
  const treeDirection = treeDirectionConfig(options.direction);
  const directionalContext: MeasuredTreeContext = {
    ...measuredContext,
    config: { ...measuredContext.config, spread: treeDirection.spread },
  };
  if (structuredMode === "mindmap") {
    return orientLayoutResult(buildMindmapLayout(visibleGraph, directionalContext), treeDirection.orientation);
  }
  if (structuredMode === "logic-chart" && treeDirection.bifurcated) {
    return orientLayoutResult(buildMindmapLayout(visibleGraph, directionalContext), treeDirection.orientation);
  }
  if (structuredMode === "timeline") {
    const timelineDirection = timelineDirectionConfig(options.direction);
    return orientLayoutResult(
      buildTimelineLayout(visibleGraph, measuredContext, timelineDirection.bifurcated),
      timelineDirection.orientation,
    );
  }
  const treeResult = treeDirection.bifurcated
    ? buildMindmapLayout(visibleGraph, directionalContext)
    : buildRightTreeLayout(visibleGraph, directionalContext);
  return orientLayoutResult(treeResult, treeDirection.orientation);
}
