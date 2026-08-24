import { selectPorts, type EdgeDirection, type EdgeRect } from "../../shared/edge_port";
import { route, type EdgePath, type EdgeRouteStyle } from "../../shared/edge_route";
import type { LayoutBranchPortSide, LayoutDirection, LayoutNodePosition } from "../../shared/layout_port";

export { disperseEdgePath, type DisperseEdgeStyle } from "../../shared/layout_edge_paths";

/** The lab deliberately uses the canonical curved EdgeStyle unless a control is added. */
export const DEFAULT_LAYOUT_LAB_EDGE_STYLE: EdgeRouteStyle = "curve";

function rect(position: LayoutNodePosition): EdgeRect {
  return { x: position.x, y: position.y - position.h / 2, w: position.w, h: position.h };
}

function treeBranchDirection(direction: LayoutDirection, branchPortSide: LayoutBranchPortSide | undefined): EdgeDirection {
  if (direction === "left/right" || direction === "up/down") {
    if (!branchPortSide) throw new Error(`LayoutResult.branchPortSide is required for Tree ${direction}.`);
    return { view: "Tree", direction, branchSide: branchPortSide };
  }
  return { view: "Tree", direction };
}

/** Exclusive seam: all Layout Lab edge geometry is selected then routed here. */
export function layoutLabEdgePath(
  source: LayoutNodePosition,
  target: LayoutNodePosition,
  direction: LayoutDirection,
  style: EdgeRouteStyle = DEFAULT_LAYOUT_LAB_EDGE_STYLE,
): EdgePath {
  const ports = selectPorts(rect(source), rect(target), treeBranchDirection(direction, target.branchPortSide));
  return route(ports, style);
}
