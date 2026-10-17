import type { ElkNode } from "elkjs/lib/elk-api";
import type { LayoutNodeMetric, LayoutResult } from "./layout_port";
import type { LaneProjection } from "./lane_view";

export interface LaneLayoutInput {
  projection: LaneProjection;
  metrics: Record<string, LayoutNodeMetric>;
  direction: "right" | "down";
  space: "tight" | "normal" | "loose";
}

export interface LaneLayoutEngine { layout(graph: ElkNode): Promise<ElkNode>; }
let nodeEngine: LaneLayoutEngine | undefined;

async function defaultEngine(): Promise<LaneLayoutEngine> {
  if (!nodeEngine) { const { default: ELK } = await import("elkjs/lib/elk.bundled.js"); nodeEngine = new ELK(); }
  return nodeEngine;
}

export function laneElkGraph(input: LaneLayoutInput): ElkNode {
  const spacing = { tight: [12, 32], normal: [24, 56], loose: [40, 88] }[input.space];
  return {
    id: "lane-layout",
    layoutOptions: {
      "elk.algorithm": "layered", "elk.direction": input.direction === "right" ? "RIGHT" : "DOWN",
      "elk.layered.thoroughness": "1", // Bound ELK's standard search effort for interactive layout.
      "elk.partitioning.activate": "true", "elk.separateConnectedComponents": "false", "elk.randomSeed": "1",
      "elk.spacing.nodeNode": String(spacing[0]), "elk.layered.spacing.nodeNodeBetweenLayers": String(spacing[1]),
    },
    children: input.projection.lanes.flatMap((lane, partition) => {
      const header = input.metrics[lane.id] ?? { w: 140, h: 40 };
      return (lane.nodeIds.length ? lane.nodeIds : [`lane-empty:${lane.id}`]).map(id => {
        const metric = input.metrics[id] ?? header;
        return { id, width: Math.max(metric.w, input.direction === "right" ? header.w : 0) + 24,
          height: Math.max(metric.h, input.direction === "down" ? header.h : 0) + 24,
          layoutOptions: { "elk.partitioning.partition": String(partition) } };
      });
    }),
    edges: input.projection.links.map(link => ({ id: link.id, sources: [link.sourceNodeId], targets: [link.targetNodeId] })),
  };
}

export async function computeLaneLayout(input: LaneLayoutInput, engine?: LaneLayoutEngine): Promise<LayoutResult> {
  const graph = laneElkGraph(input);
  const output = graph.children?.length ? await (engine ?? await defaultEngine()).layout(graph) : graph;
  const nodes = new Map((output.children ?? []).map(node => [node.id, node]));
  const headers = input.projection.lanes.map(lane => input.metrics[lane.id] ?? { w: 140, h: 40 });
  const offsetX = input.direction === "down" ? Math.max(0, ...headers.map(h => h.w)) + 48 : 24;
  const offsetY = input.direction === "right" ? Math.max(0, ...headers.map(h => h.h)) + 48 : 24;
  const pos: LayoutResult["pos"] = {};
  input.projection.nodeIds.forEach(id => {
    const placed = nodes.get(id), metric = input.metrics[id];
    if (!placed || !metric || !Number.isFinite(placed.x! + placed.y!)) throw new Error("Lane の配置結果が不正です。");
    pos[id] = { ...metric, x: placed.x! + offsetX + 12, y: placed.y! + offsetY + 12 + metric.h / 2, depth: 2 };
  });
  const fullWidth = Math.max(320, (output.width ?? 0) + offsetX + 24);
  const fullHeight = Math.max(180, (output.height ?? 0) + offsetY + 24);
  const boundaries = input.projection.lanes.map(lane => {
    const members = (lane.nodeIds.length ? lane.nodeIds : [`lane-empty:${lane.id}`]).map(id => nodes.get(id)!);
    const start = Math.min(...members.map(n => input.direction === "right" ? n.x! : n.y!));
    const end = Math.max(...members.map(n => input.direction === "right" ? n.x! + n.width! : n.y! + n.height!));
    const header = input.metrics[lane.id];
    return { id: lane.id, label: lane.label, labelLines: header?.labelLines, fontSize: header?.fontSize, x: input.direction === "right" ? start + offsetX : 12,
      y: input.direction === "down" ? start + offsetY : 12,
      w: input.direction === "right" ? end - start : fullWidth - 24,
      h: input.direction === "down" ? end - start : fullHeight - 24 };
  });
  for (let i = 1; i < boundaries.length; i++) {
    const a = boundaries[i-1], b = boundaries[i];
    if (input.direction === "right" ? a.x + a.w > b.x : a.y + a.h > b.y) throw new Error("elkjs が Lane の兄弟順序を保持できませんでした。");
  }
  const rectangles = Object.values(pos);
  for (let i = 0; i < rectangles.length; i++) for (let j = i + 1; j < rectangles.length; j++) {
    const a = rectangles[i], b = rectangles[j];
    if (!(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h / 2 <= b.y - b.h / 2 || b.y + b.h / 2 <= a.y - a.h / 2)) {
      throw new Error("elkjs の Lane 配置で node が重なっています。");
    }
  }
  return { pos, order: input.projection.nodeIds, totalWidth: fullWidth, totalHeight: fullHeight,
    lane: { rootId: input.projection.rootId, boundaries, hiddenCounts: input.projection.hiddenCounts, omittedLinkCount: input.projection.omittedLinkCount } };
}

export class LaneLayoutCache {
  private generation = 0;
  private key = "";
  private result?: LayoutResult;
  private error?: Error;
  phase: "idle" | "pending" | "ready" | "failed" = "idle";
  constructor(private compute: (input: LaneLayoutInput) => Promise<LayoutResult>, private changed: () => void) {}
  read(key: string, input: LaneLayoutInput): LayoutResult | undefined {
    if (key !== this.key) {
      this.key = key;
      this.result = undefined;
      this.error = undefined;
      this.phase = "pending";
      const generation = ++this.generation;
      let computation: Promise<LayoutResult>;
      try { computation = this.compute(input); } catch (error) { computation = Promise.reject(error); }
      computation.then(result => {
        if (generation !== this.generation) return;
        this.result = result; this.phase = "ready"; this.changed();
      }, error => {
        if (generation !== this.generation) return;
        this.error = error instanceof Error ? error : new Error(String(error));
        this.phase = "failed"; this.changed();
      });
    }
    if (this.error) throw this.error;
    return this.result;
  }
  invalidate(): void { this.generation++; this.key = ""; this.result = undefined; this.phase = "idle"; }
}
