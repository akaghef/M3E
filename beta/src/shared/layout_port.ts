import type { GraphLink, SurfaceNodeView } from "./types";

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
export type LayoutDirection = "right" | "left" | "down" | "up";
export type LayoutDepthAlign = "aligned" | "packed";
export type LayoutDensity = "compact" | "balanced" | "spacious";
export type LayoutBranchDirection = "both" | "right" | "left";
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
  scatterCollapsedGroup?: boolean;
}

export interface LayoutOptions {
  displayRootId?: string;
  structuredMode?: StructuredLayoutMode;
  density?: LayoutDensity;
  branchDirection?: LayoutBranchDirection;
  depthAlign?: LayoutDepthAlign;
  direction?: LayoutDirection;
  spacing?: { nodeGap?: number; levelGap?: number; padding?: number };
  edge?: { route?: LayoutEdgeRoute };
  link?: { route?: LayoutLinkRoute };
  scatter?: { seed?: number; strength?: number; repulsion?: number; edgeLength?: number };
  surfaceNodeViews?: Record<string, SurfaceNodeView>;
  flowCells?: Record<string, { col: number; row: number; isReference: boolean }>;
  scatterCollapsedGroups?: Record<string, boolean>;
}

export interface LayoutResult {
  pos: Record<string, LayoutNodePosition>;
  order: string[];
  totalHeight: number;
  totalWidth: number;
}

interface StructuredLayoutConfig {
  mode: LayoutAlgorithmMode;
  density: LayoutDensity;
  branchDirection: LayoutBranchDirection;
  columnGap: number;
  siblingGap: number;
  sideGap: number;
}

interface MeasuredTreeContext {
  displayRootId: string;
  metrics: Record<string, LayoutNodeMetric>;
  depthOf: Record<string, number>;
  depthMaxWidth: Record<number, number>;
  maxDepth: number;
  config: StructuredLayoutConfig;
  depthAlign: LayoutDepthAlign;
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

const FLOW_SURFACE_ROW_GAP = 84;
const DEFAULT_SCATTER_EDGE_LENGTH = 180;

function structuredLayoutConfig(
  mode: LayoutAlgorithmMode,
  density: LayoutDensity = "balanced",
  branchDirection: LayoutBranchDirection = "both",
  options: LayoutOptions = {},
): StructuredLayoutConfig {
  const compact = density === "compact";
  const spacious = density === "spacious";
  const mapLike = mode === "mindmap";
  const levelGap = options.spacing?.levelGap;
  const nodeGap = options.spacing?.nodeGap;
  return {
    mode,
    density,
    branchDirection,
    columnGap: levelGap ?? (mapLike ? (compact ? 78 : spacious ? 148 : 112) : compact ? 48 : spacious ? 142 : 86),
    siblingGap: nodeGap ?? (mapLike ? (compact ? 18 : spacious ? 34 : 26) : compact ? 7 : spacious ? 24 : 14),
    sideGap: options.spacing?.padding ?? (mapLike ? (compact ? 64 : spacious ? 132 : 92) : compact ? 46 : spacious ? 110 : 72),
  };
}

function buildMeasuredTreeContext(
  displayRootId: string,
  mode: LayoutAlgorithmMode,
  graph: VisibleLayoutGraph,
  boxSizes: Record<string, LayoutNodeMetric>,
  options: LayoutOptions = {},
): MeasuredTreeContext {
  const config = structuredLayoutConfig(mode, options.density, options.branchDirection, options);
  const metrics: Record<string, LayoutNodeMetric> = {};
  const depthOf: Record<string, number> = {};
  const depthMaxWidth: Record<number, number> = {};
  let maxDepth = 0;

  function visit(nodeId: string, depth: number): void {
    const metric = boxSizes[nodeId];
    if (!metric) return;
    maxDepth = Math.max(maxDepth, depth);
    depthOf[nodeId] = depth;
    metrics[nodeId] = metric;
    depthMaxWidth[depth] = Math.max(depthMaxWidth[depth] ?? 0, metric.w);
    graph.childrenOf(nodeId).forEach((childId) => visit(childId, depth + 1));
  }

  visit(displayRootId, 0);
  return { displayRootId, metrics, depthOf, depthMaxWidth, maxDepth, config, depthAlign: options.depthAlign || "packed" };
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
  siblingGap = LAYOUT.siblingGap,
): number {
  if (cache[nodeId] !== undefined) return cache[nodeId]!;
  if (!metrics[nodeId]) return LAYOUT.leafHeight;
  const children = childrenOf(nodeId);
  if (children.length === 0) {
    const leafSpan = Math.max(LAYOUT.leafHeight, metrics[nodeId]!.h + siblingGap);
    cache[nodeId] = leafSpan;
    return leafSpan;
  }
  let sum = 0;
  children.forEach((childId, i) => {
    sum += subtreeSpanForLayout(childId, childrenOf, metrics, cache, siblingGap);
    if (i < children.length - 1) sum += siblingGap;
  });
  const result = Math.max(sum, metrics[nodeId]!.h + 24);
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

function orientLayoutResult(result: LayoutResult, direction: LayoutDirection | undefined): LayoutResult {
  if (!direction || direction === "right") return result;
  const order = result.order.filter((nodeId) => result.pos[nodeId]);
  if (order.length === 0) return result;
  const positions = order.map((nodeId) => result.pos[nodeId]!);
  const minX = Math.min(...positions.map((p) => p.x));
  const maxX = Math.max(...positions.map((p) => p.x + p.w));
  const minY = Math.min(...positions.map((p) => p.y - p.h / 2));
  const maxY = Math.max(...positions.map((p) => p.y + p.h / 2));
  const oriented: Record<string, LayoutNodePosition> = {};
  order.forEach((nodeId) => {
    const p = result.pos[nodeId]!;
    if (direction === "left") {
      oriented[nodeId] = { ...p, x: minX + maxX - (p.x + p.w) };
      return;
    }
    if (direction === "down") {
      oriented[nodeId] = { ...p, x: minY + (p.y - p.h / 2), y: minX + (p.x - minX) + p.w / 2 };
      return;
    }
    oriented[nodeId] = { ...p, x: minY + (maxY - (p.y + p.h / 2)), y: minX + (p.x - minX) + p.w / 2 };
  });
  const bounds = finalizeLayoutBounds(oriented, order);
  return { ...result, pos: oriented, totalHeight: bounds.totalHeight, totalWidth: bounds.totalWidth };
}

function buildRightTreeLayout(graph: VisibleLayoutGraph, ctx: MeasuredTreeContext): LayoutResult {
  const { displayRootId, metrics, depthOf, depthMaxWidth, maxDepth, config, depthAlign } = ctx;
  const xByDepth: Record<number, number> = {};
  let cursorX = LAYOUT.leftPad;
  for (let d = 0; d <= maxDepth; d += 1) {
    xByDepth[d] = cursorX;
    cursorX += (depthMaxWidth[d] ?? 120) + (config.mode === "tree" ? LAYOUT.columnGap : config.columnGap);
  }

  const subtreeHeightCache: Record<string, number> = {};
  const pos: Record<string, LayoutNodePosition> = {};
  const order: string[] = [];
  const depthOffsetFactor = depthAlign === "aligned" ? 0 : LAYOUT.depthOffsetFactor;

  function place(nodeId: string, topY: number, parentX: number | null, parentW: number | null): number {
    if (!metrics[nodeId]) return LAYOUT.leafHeight;
    const depth = depthOf[nodeId] ?? 0;
    const h = subtreeSpanForLayout(
      nodeId,
      graph.childrenOf,
      metrics,
      subtreeHeightCache,
      config.mode === "tree" ? LAYOUT.siblingGap : config.siblingGap,
    );
    const centerY = topY + h / 2;
    const baseX = xByDepth[depth]!;
    const nodeX = config.mode === "logic-chart"
      ? baseX
      : parentX === null || parentW === null
        ? baseX
        : baseX + ((parentX + parentW + LAYOUT.columnGap) - baseX) * depthOffsetFactor;
    const metric = metrics[nodeId]!;
    pos[nodeId] = { x: nodeX, y: centerY, depth, w: metric.w, h: metric.h, fontSize: metric.fontSize, labelLines: metric.labelLines };
    order.push(nodeId);
    let placeCursorY = topY;
    graph.childrenOf(nodeId).forEach((childId, i, arr) => {
      const childH = place(childId, placeCursorY, nodeX, metric.w);
      placeCursorY += childH;
      if (i < arr.length - 1) placeCursorY += config.mode === "tree" ? LAYOUT.siblingGap : config.siblingGap;
    });
    return h;
  }

  place(displayRootId, LAYOUT.topPad, null, null);
  if (config.mode === "logic-chart" && config.branchDirection === "left" && order.length > 0) {
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

function splitMindmapBranches(graph: VisibleLayoutGraph, rootId: string, direction: LayoutBranchDirection): { left: string[]; right: string[] } {
  const children = graph.childrenOf(rootId);
  const left: string[] = [];
  const right: string[] = [];
  if (direction === "right") return { left, right: children };
  if (direction === "left") return { left: children, right };
  children.forEach((childId, index) => (index % 2 === 0 ? right : left).push(childId));
  return { left, right };
}

function buildMindmapLayout(graph: VisibleLayoutGraph, ctx: MeasuredTreeContext): LayoutResult {
  const { displayRootId, metrics, depthOf, depthMaxWidth, maxDepth, config } = ctx;
  const rootMetric = metrics[displayRootId] || { w: 280, h: LAYOUT.rootHeight };
  const branchWidth = (fromDepth = 1): number => {
    let width = 0;
    for (let d = fromDepth; d <= maxDepth; d += 1) {
      width += (depthMaxWidth[d] ?? 120) + config.columnGap;
    }
    return width;
  };
  const leftBranchWidth = branchWidth();
  const rootX = config.branchDirection === "right"
    ? LAYOUT.leftPad
    : config.branchDirection === "left"
      ? LAYOUT.leftPad + leftBranchWidth
      : LAYOUT.leftPad + leftBranchWidth + config.sideGap;
  const rightXByDepth: Record<number, number> = {};
  const leftXByDepth: Record<number, number> = {};
  rightXByDepth[1] = rootX + rootMetric.w + config.columnGap;
  leftXByDepth[1] = rootX - config.columnGap - (depthMaxWidth[1] ?? 120);
  for (let d = 2; d <= maxDepth; d += 1) {
    rightXByDepth[d] = rightXByDepth[d - 1]! + (depthMaxWidth[d - 1] ?? 120) + config.columnGap;
    leftXByDepth[d] = leftXByDepth[d - 1]! - config.columnGap - (depthMaxWidth[d] ?? 120);
  }
  const spanCache: Record<string, number> = {};
  const { left, right } = splitMindmapBranches(graph, displayRootId, config.branchDirection);
  const sideGap = config.sideGap;
  const sideSpan = (ids: string[]) => ids.reduce((sum, id, index) => (
    sum + subtreeSpanForLayout(id, graph.childrenOf, metrics, spanCache, config.siblingGap) + (index > 0 ? sideGap : 0)
  ), 0);
  const totalSpan = Math.max(rootMetric.h + 60, sideSpan(left), sideSpan(right), LAYOUT.rootHeight + 80);
  const rootY = LAYOUT.topPad + totalSpan / 2;
  const pos: Record<string, LayoutNodePosition> = {
    [displayRootId]: { x: rootX, y: rootY, depth: 0, w: rootMetric.w, h: rootMetric.h, fontSize: rootMetric.fontSize, labelLines: rootMetric.labelLines },
  };
  const order: string[] = [displayRootId];

  function placeSide(nodeId: string, topY: number, direction: -1 | 1): number {
    if (!metrics[nodeId]) return LAYOUT.leafHeight;
    const depth = Math.max(1, depthOf[nodeId] ?? 1);
    const span = subtreeSpanForLayout(nodeId, graph.childrenOf, metrics, spanCache, config.siblingGap);
    const metric = metrics[nodeId]!;
    const centerY = topY + span / 2;
    const depthWidth = depthMaxWidth[depth] ?? metric.w;
    const x = direction > 0
      ? rightXByDepth[depth] ?? (rootX + rootMetric.w + config.columnGap)
      : (leftXByDepth[depth] ?? (rootX - config.columnGap - depthWidth)) + Math.max(0, depthWidth - metric.w);
    pos[nodeId] = { x, y: centerY, depth, w: metric.w, h: metric.h, fontSize: metric.fontSize, labelLines: metric.labelLines };
    order.push(nodeId);
    let cursorY = topY;
    graph.childrenOf(nodeId).forEach((childId, i, arr) => {
      const childSpan = placeSide(childId, cursorY, direction);
      cursorY += childSpan;
      if (i < arr.length - 1) cursorY += config.siblingGap;
    });
    return span;
  }

  const placeGroup = (ids: string[], direction: -1 | 1): void => {
    let cursorY = rootY - sideSpan(ids) / 2;
    ids.forEach((childId, index) => {
      const span = placeSide(childId, cursorY, direction);
      cursorY += span + (index < ids.length - 1 ? sideGap : 0);
    });
  };
  placeGroup(left, -1);
  placeGroup(right, 1);

  const bounds = finalizeLayoutBounds(pos, order);
  return { pos, order, totalHeight: bounds.totalHeight, totalWidth: bounds.totalWidth };
}

function buildTimelineLayout(graph: VisibleLayoutGraph, ctx: MeasuredTreeContext): LayoutResult {
  const { displayRootId, metrics, depthOf, config } = ctx;
  const rootMetric = metrics[displayRootId] || { w: 280, h: LAYOUT.rootHeight };
  const rootX = LAYOUT.leftPad;
  const axisY = LAYOUT.topPad + 300;
  const pos: Record<string, LayoutNodePosition> = {
    [displayRootId]: { x: rootX, y: axisY, depth: 0, w: rootMetric.w, h: rootMetric.h, fontSize: rootMetric.fontSize, labelLines: rootMetric.labelLines },
  };
  const order: string[] = [displayRootId];
  const rootChildren = graph.childrenOf(displayRootId);
  const stepX = Math.max(config.density === "compact" ? 190 : 260, config.columnGap + 120);

  function placeDescendants(nodeId: string, baseX: number, baseY: number, sign: -1 | 1): void {
    graph.childrenOf(nodeId).forEach((childId, index) => {
      const metric = metrics[childId];
      if (!metric) return;
      const x = baseX + 54;
      const y = baseY + sign * (92 + index * 72);
      pos[childId] = { x, y, depth: depthOf[childId] ?? 1, w: metric.w, h: metric.h, fontSize: metric.fontSize, labelLines: metric.labelLines };
      order.push(childId);
      placeDescendants(childId, x, y, sign);
    });
  }

  rootChildren.forEach((childId, index) => {
    const metric = metrics[childId];
    if (!metric) return;
    const x = rootX + rootMetric.w + config.columnGap + index * stepX;
    const sign: -1 | 1 = index % 2 === 0 ? -1 : 1;
    const y = axisY + sign * 132;
    pos[childId] = { x, y, depth: depthOf[childId] ?? 1, w: metric.w, h: metric.h, fontSize: metric.fontSize, labelLines: metric.labelLines };
    order.push(childId);
    placeDescendants(childId, x, y, sign);
  });

  const bounds = finalizeLayoutBounds(pos, order);
  return { pos, order, totalHeight: bounds.totalHeight, totalWidth: bounds.totalWidth };
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
    const descendants = visibleGraph.nodeIds;
    const scatterDepthOf: Record<string, number> = {};
    const visitDepth = (nodeId: string, depth: number): void => {
      scatterDepthOf[nodeId] = depth;
      visibleGraph.childrenOf(nodeId).forEach((childId) => visitDepth(childId, depth + 1));
    };
    descendants.forEach((nodeId) => {
      if (scatterDepthOf[nodeId] === undefined) visitDepth(nodeId, 0);
    });
    const seededByNode = scatterSeedPositionsFromGraph(
      displayRootId,
      descendants,
      scatterDepthOf,
      visibleGraph.childrenOf,
      options.scatter?.edgeLength,
    );
    const pos: Record<string, LayoutNodePosition> = {};
    let maxRight = LAYOUT.minCanvasWidth;
    let maxBottom = LAYOUT.minCanvasHeight;
    descendants.forEach((nodeId) => {
      const metric = boxSizes[nodeId];
      if (!metric) return;
      const depth = scatterDepthOf[nodeId] ?? 0;
      const radius = metric.w / 2;
      const diameter = radius * 2;
      const saved = options.surfaceNodeViews?.[nodeId];
      const seeded = seededByNode[nodeId] || scatterSeedCenter();
      const seededX = seeded.x - radius;
      const seededY = seeded.y;
      const x = Number.isFinite(saved?.x) ? Number(saved!.x) : seededX;
      const y = Number.isFinite(saved?.y) ? Number(saved!.y) : seededY;
      pos[nodeId] = {
        x,
        y,
        depth,
        w: diameter,
        h: diameter,
        fontSize: scatterFontSizeFor(radius),
        scatterCollapsedGroup: Boolean(options.scatterCollapsedGroups?.[nodeId]),
      };
      maxRight = Math.max(maxRight, x + diameter + LAYOUT.canvasRightPad);
      maxBottom = Math.max(maxBottom, y + radius + LAYOUT.canvasBottomPad);
    });

    return {
      pos,
      order: descendants,
      totalHeight: Math.max(maxBottom, LAYOUT.minCanvasHeight),
      totalWidth: Math.max(maxRight, LAYOUT.minCanvasWidth),
    };
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
  if (structuredMode === "mindmap") {
    return orientLayoutResult(buildMindmapLayout(visibleGraph, measuredContext), options.direction);
  }
  if (structuredMode === "logic-chart" && measuredContext.config.branchDirection === "both") {
    return orientLayoutResult(buildMindmapLayout(visibleGraph, measuredContext), options.direction);
  }
  if (structuredMode === "timeline") {
    return orientLayoutResult(buildTimelineLayout(visibleGraph, measuredContext), options.direction);
  }
  return orientLayoutResult(buildRightTreeLayout(visibleGraph, measuredContext), options.direction);
}
