import { selectPorts } from "./edge_port";
import type { GraphLink } from "./types";
import type { LayoutNodeMetric, LayoutResult } from "./layout_port";
import type { LaneProjection } from "./lane_view";

/** Geometry receives sibling arrays and measured sizes, never GraphLinks. */
export interface LaneLayoutInput {
  projection: Pick<LaneProjection, "rootId" | "lanes">;
  metrics: Record<string, LayoutNodeMetric>;
  direction: "right" | "down";
  space: "tight" | "normal" | "loose";
}

/** Equal sections on one row/column, using existing measured node dimensions. */
export function computeLaneLayout(input: LaneLayoutInput): LayoutResult {
  const { projection, metrics, direction } = input, down = direction === "down";
  const spacing = { tight: 0.8, normal: 1, loose: 1.3 }[input.space];
  const ids = projection.lanes.flatMap(lane => lane.nodeIds);
  for (const id of ids) {
    const m = metrics[id];
    if (!m || !Number.isFinite(m.w + m.h) || m.w <= 0 || m.h <= 0) throw new Error("Lane の node 寸法が不正です。");
  }
  // Reserve equal sections large enough for every existing measured label.
  const width = Math.max(80, ...ids.map(id => metrics[id].w));
  const height = Math.max(34, ...ids.map(id => metrics[id].h));
  const headers = projection.lanes.map(lane => metrics[lane.id] ?? { w: 100, h: 32 });
  const labelWidth = Math.max(136, ...headers.map(m => m.w + 16));
  const start = down ? 64 + labelWidth : 128 + 56 * spacing;
  // The longest lane sets the shared extent: n equal sections, each wide enough
  // for that lane's widest node plus a gap. Shorter lanes spread over the same
  // extent, so no lane is sized by another lane's widest label.
  const gap = 40 * spacing;
  const along = (id: string) => (down ? metrics[id].w : metrics[id].h);
  const extent = Math.max(1, ...projection.lanes.map(lane =>
    lane.nodeIds.length * (Math.max(0, ...lane.nodeIds.map(along)) + gap)));
  const thickness = down ? height + 88 * spacing : width + 48 * spacing;
  const bandLength = down ? labelWidth + extent + 24 : 56 * spacing + extent + 16 * spacing;
  const pos: LayoutResult["pos"] = {};
  const boundaries = projection.lanes.map((lane, index) => {
    const bandStart = (down ? 128 : 64) + index * thickness;
    const center = bandStart + thickness / 2;
    lane.nodeIds.forEach((id, j) => {
      const offset = start + extent * (j + 0.5) / lane.nodeIds.length;
      pos[id] = { ...metrics[id], depth: 2,
        x: (down ? offset : center) - metrics[id].w / 2, y: down ? center : offset };
    });
    return { id: lane.id, label: lane.label, count: lane.nodeIds.length,
      labelLines: headers[index].labelLines, fontSize: 12,
      x: down ? 64 : bandStart, y: down ? bandStart : 128,
      w: down ? bandLength : thickness, h: down ? thickness : bandLength };
  });
  // Lane names and the root heading are editable nodes: give them geometry so
  // selection and the inline editor can place them. They are not in `order`,
  // so the node renderer does not draw them as cards.
  boundaries.forEach((b, index) => {
    const m = headers[index]!;
    pos[b.id] = { x: b.x + 16, y: b.y + 26, w: m.w, h: 36, depth: 1, fontSize: 28, labelLines: m.labelLines };
  });
  const rootMetric = metrics[projection.rootId] ?? { w: 320, h: 44 };
  pos[projection.rootId] = { x: 64, y: 70, w: rootMetric.w, h: 44, depth: 0, fontSize: 36, labelLines: rootMetric.labelLines };
  return { pos, order: ids,
    totalWidth: down ? start + extent + 64 : Math.max(1440, 64 + boundaries.length * thickness + 80),
    totalHeight: (down ? 128 + boundaries.length * thickness : 128 + bandLength) + 64,
    lane: { rootId: projection.rootId, direction, boundaries, hiddenCounts: {}, omittedLinkCount: 0 } };
}

/** Port policy only: existing common GraphLink paths/markers/labels draw it. */
export function laneLinkGeometry(layout: LayoutResult, link: GraphLink) {
  const direction = layout.lane!.direction;
  const source = layout.pos[link.sourceNodeId], target = layout.pos[link.targetNodeId];
  const rect = (p: typeof source) => ({ x: p.x, y: p.y - p.h / 2, w: p.w, h: p.h });
  const explicit = (port: GraphLink["sourcePort"]) => port === "auto" ? undefined : port;
  const ports = selectPorts(rect(source), rect(target), { view: "Lane", direction },
    { sourceSide: explicit(link.sourcePort), targetSide: explicit(link.targetPort) });
  return ports;
}
