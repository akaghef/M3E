import type { EdgePortPoint, EdgePorts } from "./edge_port";
import { route, type EdgePath, type EdgeRouteStyle } from "./edge_route";
import type { LayoutNodePosition } from "./layout_port";

export type DisperseEdgeStyle = Exclude<EdgeRouteStyle, "orthogonal">;

function center(position: LayoutNodePosition): EdgePortPoint {
  return { x: position.x + position.w / 2, y: position.y, side: "right" };
}

/**
 * Disperse edges are geometry-only centre-to-centre links. They deliberately
 * bypass EdgePort: a free layout has no directional node port semantics.
 */
export function disperseEdgePath(
  source: LayoutNodePosition,
  target: LayoutNodePosition,
  style: DisperseEdgeStyle,
): EdgePath {
  const ports: EdgePorts = {
    source: center(source),
    target: center(target),
    edgeDirection: { view: "Disperse", direction: "free" },
  };
  return route(ports, style);
}
