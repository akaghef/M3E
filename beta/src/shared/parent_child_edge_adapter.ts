import type { EdgeDirection, EdgeRect, EdgePorts, PrimaryDirection, TreeBranchSide, TreeDirection } from "./edge_port";
import { selectPorts } from "./edge_port";
import type { EdgePath, EdgeRouteStyle } from "./edge_route";
import { route } from "./edge_route";

export interface ParentChildEdgeRef {
  kind: "parent-child";
  parentNodeId: string;
  childNodeId: string;
}

export type ParentChildSurfaceMode = "tree" | "mindmap" | "logic-chart" | "timeline" | "scatter" | "system";

export interface ParentChildNodePosition extends EdgeRect {
  depth: number;
  branchPortSide?: TreeBranchSide;
}

export interface ParentChildEdgeRouteInput {
  relation: ParentChildEdgeRef;
  parentRect: EdgeRect;
  childRect: EdgeRect;
  childPosition?: Pick<ParentChildNodePosition, "branchPortSide">;
  surfaceMode: ParentChildSurfaceMode;
  direction: TreeDirection;
  routeStyle: EdgeRouteStyle;
}

export interface ParentChildEdgeRoute {
  relation: ParentChildEdgeRef;
  edgeDirection: EdgeDirection;
  ports: EdgePorts;
  path: EdgePath;
}

function primaryDirection(direction: TreeDirection, branchPortSide?: TreeBranchSide): PrimaryDirection {
  if (direction !== "left/right" && direction !== "up/down") return direction;
  if (!branchPortSide) {
    throw new Error(`LayoutResult.branchPortSide is required for Tree ${direction}.`);
  }
  return branchPortSide;
}

function treeDirection(direction: TreeDirection, branchPortSide?: TreeBranchSide): EdgeDirection {
  if (direction === "left/right" || direction === "up/down") {
    if (!branchPortSide) {
      throw new Error(`LayoutResult.branchPortSide is required for Tree ${direction}.`);
    }
    return { view: "Tree", direction, branchSide: branchPortSide };
  }
  return { view: "Tree", direction };
}

function vectorDirection(surfaceMode: "scatter" | "system", direction: PrimaryDirection): EdgeDirection {
  if (surfaceMode === "scatter") return { view: "Disperse", direction: "free" };
  return direction === "down"
    ? { view: "System", direction: "down" }
    : direction === "right"
      ? { view: "System", direction: "right" }
      : { view: "System", direction: "free" };
}

export function parentChildEdgeDirection(input: ParentChildEdgeRouteInput): EdgeDirection {
  const branchPortSide = input.childPosition?.branchPortSide;
  if (input.surfaceMode === "timeline") return { view: "Axial", direction: primaryDirection(input.direction, branchPortSide) };
  if (input.surfaceMode === "mindmap" || input.surfaceMode === "logic-chart" || input.surfaceMode === "tree") {
    return treeDirection(input.direction, branchPortSide);
  }
  return vectorDirection(input.surfaceMode, primaryDirection(input.direction, branchPortSide));
}

export function routeParentChildEdge(input: ParentChildEdgeRouteInput): ParentChildEdgeRoute {
  const edgeDirection = parentChildEdgeDirection(input);
  const ports = selectPorts(input.parentRect, input.childRect, edgeDirection);
  return {
    relation: input.relation,
    edgeDirection,
    ports,
    path: route(ports, input.routeStyle),
  };
}
