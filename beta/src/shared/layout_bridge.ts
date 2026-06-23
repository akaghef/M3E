export type LayoutMode = "tree" | "mindmap" | "logic-chart" | "timeline";
export type LayoutDirection = "right" | "left" | "down" | "up";
export type LayoutDepthAlign = "aligned" | "packed";
export type LayoutDensity = "compact" | "balanced" | "spacious";
export type LayoutBranchDirection = "left" | "right" | "both";

export interface LayoutGraph {
  nodeIds: string[];
  childrenOf: (id: string) => string[];
  graphLinks: unknown[];
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
}

export interface LayoutResult {
  pos: Record<string, LayoutNodePosition>;
  order: string[];
  totalWidth: number;
  totalHeight: number;
}

export interface LayoutOptions {
  displayRootId?: string;
  structuredMode?: LayoutMode;
  density?: LayoutDensity;
  branchDirection?: LayoutBranchDirection;
  depthAlign?: LayoutDepthAlign;
  direction?: LayoutDirection;
  spacing?: {
    nodeGap?: number;
    levelGap?: number;
    padding?: number;
  };
}

interface StructuredLayoutConfig {
  mode: LayoutMode;
  density: LayoutDensity;
  branchDirection: LayoutBranchDirection;
  columnGap: number;
  siblingGap: number;
  sideGap: number;
  padding: number;
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

const LAYOUT_TUNING: Readonly<Record<
  | "rootHeight"
  | "columnGap"
  | "leafHeight"
  | "siblingGap"
  | "leftPad"
  | "topPad"
  | "nodeHitHeight"
  | "minCanvasWidth"
  | "minCanvasHeight"
  | "canvasRightPad"
  | "canvasBottomPad"
  | "nodeRightPad"
  | "depthOffsetFactor",
  number
>> = Object.freeze({
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
});

function structuredLayoutConfig(
  mode: LayoutMode,
  density: LayoutDensity = "balanced",
  branchDirection: LayoutBranchDirection = "both",
): StructuredLayoutConfig {
  const compact = density === "compact";
  const spacious = density === "spacious";
  const mapLike = mode === "mindmap";
  const nodeGap = density === "compact" ? 18 : spacious ? 34 : 26;
  const levelGap = mapLike ? (compact ? 78 : spacious ? 148 : 112) : compact ? 48 : spacious ? 142 : 86;
  return {
    mode,
    density,
    branchDirection,
    columnGap: levelGap,
    siblingGap: mapLike ? nodeGap : compact ? 7 : spacious ? 24 : 14,
    sideGap: mapLike ? (compact ? 64 : spacious ? 132 : 92) : compact ? 46 : spacious ? 110 : 72,
    padding: LAYOUT_TUNING.leftPad,
  };
}

function buildMeasuredTreeContext(
  displayRootId: string,
  mode: LayoutMode,
  graph: LayoutGraph,
  boxSizes: Record<string, LayoutNodeMetric>,
  options: LayoutOptions = {},
): MeasuredTreeContext {
  const config = structuredLayoutConfig(mode, options.density, options.branchDirection);
  if (Number.isFinite(options.spacing?.levelGap)) {
    config.columnGap = Number(options.spacing!.levelGap);
  }
  if (Number.isFinite(options.spacing?.nodeGap)) {
    config.siblingGap = Number(options.spacing!.nodeGap);
    config.sideGap = Number(options.spacing!.nodeGap);
  }
  if (Number.isFinite(options.spacing?.padding)) {
    config.padding = Number(options.spacing!.padding);
  }
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
  return {
    displayRootId,
    metrics,
    depthOf,
    depthMaxWidth,
    maxDepth,
    config,
    depthAlign: options.depthAlign || "packed",
  };
}

function subtreeSpanForLayout(
  nodeId: string,
  childrenOf: (id: string) => string[],
  metrics: Record<string, LayoutNodeMetric>,
  cache: Record<string, number>,
  siblingGap = LAYOUT_TUNING.siblingGap,
): number {
  if (cache[nodeId] !== undefined) return cache[nodeId]!;
  if (!metrics[nodeId]) return LAYOUT_TUNING.leafHeight;

  const children = childrenOf(nodeId);
  if (children.length === 0) {
    const leafSpan = Math.max(LAYOUT_TUNING.leafHeight, metrics[nodeId]!.h + siblingGap);
    cache[nodeId] = leafSpan;
    return leafSpan;
  }

  let sum = 0;
  children.forEach((childId, index) => {
    sum += subtreeSpanForLayout(childId, childrenOf, metrics, cache, siblingGap);
    if (index < children.length - 1) sum += siblingGap;
  });
  const span = Math.max(sum, metrics[nodeId]!.h + 24);
  cache[nodeId] = span;
  return span;
}

function finalizeLayoutBounds(
  pos: Record<string, LayoutNodePosition>,
  order: string[],
): Pick<LayoutResult, "totalHeight" | "totalWidth"> {
  let maxRight = LAYOUT_TUNING.minCanvasWidth;
  let maxBottom = LAYOUT_TUNING.minCanvasHeight;
  order.forEach((nodeId) => {
    const p = pos[nodeId];
    if (!p) return;
    const halfH = Math.max(LAYOUT_TUNING.nodeHitHeight, p.h) / 2;
    maxRight = Math.max(maxRight, p.x + p.w + LAYOUT_TUNING.nodeRightPad);
    maxBottom = Math.max(maxBottom, p.y + halfH + LAYOUT_TUNING.canvasBottomPad);
  });
  return {
    totalHeight: Math.max(maxBottom, LAYOUT_TUNING.minCanvasHeight),
    totalWidth: Math.max(maxRight + LAYOUT_TUNING.canvasRightPad, LAYOUT_TUNING.minCanvasWidth),
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

function buildRightTreeLayout(graph: LayoutGraph, ctx: MeasuredTreeContext): LayoutResult {
  const { displayRootId, metrics, depthOf, depthMaxWidth, maxDepth, config, depthAlign } = ctx;
  const xByDepth: Record<number, number> = {};
  let cursorX = config.padding;
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    xByDepth[depth] = cursorX;
    cursorX += (depthMaxWidth[depth] ?? 120) + (config.mode === "tree" ? LAYOUT_TUNING.columnGap : config.columnGap);
  }

  const subtreeHeightCache: Record<string, number> = {};
  const pos: Record<string, LayoutNodePosition> = {};
  const order: string[] = [];
  const depthOffsetFactor = depthAlign === "aligned" ? 0 : LAYOUT_TUNING.depthOffsetFactor;

  function place(nodeId: string, topY: number, parentX: number | null, parentW: number | null): number {
    if (!metrics[nodeId]) return LAYOUT_TUNING.leafHeight;
    const depth = depthOf[nodeId] ?? 0;
    const span = subtreeSpanForLayout(
      nodeId,
      graph.childrenOf,
      metrics,
      subtreeHeightCache,
      config.mode === "tree" ? LAYOUT_TUNING.siblingGap : config.siblingGap,
    );
    const centerY = topY + span / 2;
    const baseX = xByDepth[depth]!;
    const x = config.mode === "logic-chart"
      ? baseX
      : parentX === null || parentW === null
        ? baseX
        : baseX + ((parentX + parentW + LAYOUT_TUNING.columnGap) - baseX) * depthOffsetFactor;
    const metric = metrics[nodeId]!;
    pos[nodeId] = { x, y: centerY, depth, w: metric.w, h: metric.h, fontSize: metric.fontSize, labelLines: metric.labelLines };
    order.push(nodeId);

    let cursorY = topY;
    graph.childrenOf(nodeId).forEach((childId, index, siblings) => {
      const childSpan = place(childId, cursorY, x, metric.w);
      cursorY += childSpan;
      if (index < siblings.length - 1) cursorY += config.mode === "tree" ? LAYOUT_TUNING.siblingGap : config.siblingGap;
    });
    return span;
  }

  place(displayRootId, config.padding, null, null);
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

function splitMindmapBranches(
  graph: LayoutGraph,
  rootId: string,
  direction: LayoutBranchDirection,
): { left: string[]; right: string[] } {
  const children = graph.childrenOf(rootId);
  const left: string[] = [];
  const right: string[] = [];
  if (direction === "right") return { left, right: children };
  if (direction === "left") return { left: children, right };
  children.forEach((childId, index) => {
    (index % 2 === 0 ? right : left).push(childId);
  });
  return { left, right };
}

function buildMindmapLayout(graph: LayoutGraph, ctx: MeasuredTreeContext): LayoutResult {
  const { displayRootId, metrics, depthOf, depthMaxWidth, maxDepth, config } = ctx;
  const rootMetric = metrics[displayRootId] || { w: 280, h: LAYOUT_TUNING.rootHeight };
  const branchWidth = (fromDepth = 1): number => {
    let width = 0;
    for (let depth = fromDepth; depth <= maxDepth; depth += 1) {
      width += (depthMaxWidth[depth] ?? 120) + config.columnGap;
    }
    return width;
  };

  const leftBranchWidth = branchWidth();
  const rootX = config.branchDirection === "right"
    ? config.padding
    : config.branchDirection === "left"
      ? config.padding + leftBranchWidth
      : config.padding + leftBranchWidth + config.sideGap;

  const rightXByDepth: Record<number, number> = {};
  const leftXByDepth: Record<number, number> = {};
  rightXByDepth[1] = rootX + rootMetric.w + config.columnGap;
  leftXByDepth[1] = rootX - config.columnGap - (depthMaxWidth[1] ?? 120);
  for (let depth = 2; depth <= maxDepth; depth += 1) {
    rightXByDepth[depth] = rightXByDepth[depth - 1]! + (depthMaxWidth[depth - 1] ?? 120) + config.columnGap;
    leftXByDepth[depth] = leftXByDepth[depth - 1]! - config.columnGap - (depthMaxWidth[depth] ?? 120);
  }

  const spanCache: Record<string, number> = {};
  const { left, right } = splitMindmapBranches(graph, displayRootId, config.branchDirection);
  const sideSpan = (ids: string[]): number => ids.reduce((sum, id, index) => (
    sum + subtreeSpanForLayout(id, graph.childrenOf, metrics, spanCache, config.siblingGap) + (index > 0 ? config.sideGap : 0)
  ), 0);
  const totalSpan = Math.max(rootMetric.h + 60, sideSpan(left), sideSpan(right), LAYOUT_TUNING.rootHeight + 80);
  const rootY = config.padding + totalSpan / 2;
  const pos: Record<string, LayoutNodePosition> = {
    [displayRootId]: { x: rootX, y: rootY, depth: 0, w: rootMetric.w, h: rootMetric.h, fontSize: rootMetric.fontSize, labelLines: rootMetric.labelLines },
  };
  const order: string[] = [displayRootId];

  function placeSide(nodeId: string, topY: number, direction: -1 | 1): number {
    if (!metrics[nodeId]) return LAYOUT_TUNING.leafHeight;
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
    graph.childrenOf(nodeId).forEach((childId, index, siblings) => {
      const childSpan = placeSide(childId, cursorY, direction);
      cursorY += childSpan;
      if (index < siblings.length - 1) cursorY += config.siblingGap;
    });
    return span;
  }

  const placeGroup = (ids: string[], direction: -1 | 1): void => {
    let cursorY = rootY - sideSpan(ids) / 2;
    ids.forEach((childId, index) => {
      const span = placeSide(childId, cursorY, direction);
      cursorY += span + (index < ids.length - 1 ? config.sideGap : 0);
    });
  };
  placeGroup(left, -1);
  placeGroup(right, 1);

  const bounds = finalizeLayoutBounds(pos, order);
  return { pos, order, totalHeight: bounds.totalHeight, totalWidth: bounds.totalWidth };
}

function buildTimelineLayout(graph: LayoutGraph, ctx: MeasuredTreeContext): LayoutResult {
  const { displayRootId, metrics, depthOf, config } = ctx;
  const rootMetric = metrics[displayRootId] || { w: 280, h: LAYOUT_TUNING.rootHeight };
  const rootX = config.padding;
  const axisY = config.padding + 300;
  const pos: Record<string, LayoutNodePosition> = {
    [displayRootId]: { x: rootX, y: axisY, depth: 0, w: rootMetric.w, h: rootMetric.h, fontSize: rootMetric.fontSize, labelLines: rootMetric.labelLines },
  };
  const order: string[] = [displayRootId];
  const rootChildren = graph.childrenOf(displayRootId);
  const stepX = Math.max(config.density === "compact" ? 190 : 260, config.columnGap + 120);

  function placeDescendants(nodeId: string, baseX: number, baseY: number, sign: -1 | 1): void {
    graph.childrenOf(nodeId).forEach((childId, index) => {
      const metric = metrics[childId]!;
      const x = baseX + 54;
      const y = baseY + sign * (92 + index * 72);
      pos[childId] = { x, y, depth: depthOf[childId] ?? 1, w: metric.w, h: metric.h, fontSize: metric.fontSize, labelLines: metric.labelLines };
      order.push(childId);
      placeDescendants(childId, x, y, sign);
    });
  }

  rootChildren.forEach((childId, index) => {
    const metric = metrics[childId]!;
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

export function m3eLayout(
  graph: LayoutGraph,
  boxSizes: Record<string, LayoutNodeMetric>,
  mode: LayoutMode,
  options: LayoutOptions = {},
): LayoutResult {
  const displayRootId = options.displayRootId || graph.nodeIds[0] || "";
  const displayRootExists = Boolean(displayRootId && boxSizes[displayRootId]);
  if (!displayRootExists) {
    return { pos: {}, order: [], totalHeight: LAYOUT_TUNING.minCanvasHeight, totalWidth: LAYOUT_TUNING.minCanvasWidth };
  }

  const structuredMode = options.structuredMode || mode;
  const measuredContext = buildMeasuredTreeContext(displayRootId, structuredMode, graph, boxSizes, options);
  const result = structuredMode === "mindmap"
    ? buildMindmapLayout(graph, measuredContext)
    : structuredMode === "logic-chart" && measuredContext.config.branchDirection === "both"
      ? buildMindmapLayout(graph, measuredContext)
      : structuredMode === "timeline"
        ? buildTimelineLayout(graph, measuredContext)
        : buildRightTreeLayout(graph, measuredContext);
  return orientLayoutResult(result, options.direction);
}
