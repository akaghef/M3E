import type { EdgePortSide, EdgeRect } from "../../shared/edge_port";

function portsForGraphLinkEdit(rect: EdgeRect): Array<{ x: number; y: number; side: EdgePortSide }> {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return [
    { x: rect.x, y: cy, side: "left" },
    { x: rect.x + rect.w, y: cy, side: "right" },
    { x: cx, y: rect.y, side: "top" },
    { x: cx, y: rect.y + rect.h, side: "bottom" },
  ];
}

export function nearestEdgePortSideForGraphLinkEdit(
  rect: EdgeRect,
  point: { x: number; y: number },
): EdgePortSide {
  const candidates = portsForGraphLinkEdit(rect).map((port) => ({
    side: port.side,
    distance: Math.hypot(point.x - port.x, point.y - port.y),
  }));
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.side || "right";
}

