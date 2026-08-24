import { selectPorts, type EdgeDirection, type EdgeRect } from "../../shared/edge_port";
import { route, type EdgePath, type EdgeRouteStyle } from "../../shared/edge_route";
import type { LayoutBranchPortSide, LayoutDirection, LayoutMode, LayoutNodePosition } from "../../shared/layout_port";

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

/** Disperse has no branch direction: select ports from the center-to-center vector. */
function edgeDirectionForLayout(
  mode: LayoutMode,
  direction: LayoutDirection | undefined,
  branchPortSide: LayoutBranchPortSide | undefined,
): EdgeDirection {
  if (mode === "Disperse") return { view: "Disperse", direction: "free" };
  return treeBranchDirection(direction || "right", branchPortSide);
}

/** Exclusive seam: all Layout Lab edge geometry is selected then routed here. */
export function layoutLabEdgePath(
  source: LayoutNodePosition,
  target: LayoutNodePosition,
  mode: LayoutMode,
  direction: LayoutDirection | undefined,
  style: EdgeRouteStyle = DEFAULT_LAYOUT_LAB_EDGE_STYLE,
): EdgePath {
  const ports = selectPorts(rect(source), rect(target), edgeDirectionForLayout(mode, direction, target.branchPortSide));
  return route(ports, style);
}
