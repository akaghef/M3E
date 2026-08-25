import {
  routeLayoutEdge,
  type EdgePath,
  type EdgeRouteStyle,
  type LayoutDirection,
  type LayoutMode,
  type LayoutNodePosition,
} from "../../shared/layout_port";

/** The lab deliberately uses the canonical curved EdgeStyle unless a control is added. */
export const DEFAULT_LAYOUT_LAB_EDGE_STYLE: EdgeRouteStyle = "curve";

/** Exclusive seam: all Layout Lab edge geometry is selected then routed here. */
export function layoutLabEdgePath(
  source: LayoutNodePosition,
  target: LayoutNodePosition,
  mode: LayoutMode,
  direction: LayoutDirection | undefined,
  style: EdgeRouteStyle = DEFAULT_LAYOUT_LAB_EDGE_STYLE,
): EdgePath {
  return routeLayoutEdge(source, target, mode, direction, style);
}
