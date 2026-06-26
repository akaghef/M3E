import type { EdgeBranchDirection, EdgeRect, EdgePorts, PrimaryDirection, TreeBranchSide } from "./edge_port";
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
  branchSide?: TreeBranchSide;
}

export interface ParentChildEdgeRouteInput {
  relation: ParentChildEdgeRef;
  parentRect: EdgeRect;
  childRect: EdgeRect;
  childPosition?: Pick<ParentChildNodePosition, "branchSide">;
  surfaceMode: ParentChildSurfaceMode;
  direction: PrimaryDirection;
  routeStyle: EdgeRouteStyle;
}

export interface ParentChildEdgeRoute {
  relation: ParentChildEdgeRef;
  branchDirection: EdgeBranchDirection;
  ports: EdgePorts;
  path: EdgePath;
}

function vectorDirection(surfaceMode: "scatter" | "system", direction: PrimaryDirection): EdgeBranchDirection {
  if (surfaceMode === "scatter") return { view: "Disperse", direction: "free" };
  return direction === "down"
    ? { view: "System", direction: "down" }
    : direction === "right"
      ? { view: "System", direction: "right" }
      : { view: "System", direction: "free" };
}

export function parentChildBranchDirection(input: ParentChildEdgeRouteInput): EdgeBranchDirection {
  if (input.surfaceMode === "timeline") return { view: "Axial", direction: input.direction };
  if (input.surfaceMode === "mindmap") {
    const branchSide = input.childPosition?.branchSide;
    if (!branchSide) {
      throw new Error(`LayoutResult.branchSide is required for Tree both edge ${input.relation.parentNodeId}->${input.relation.childNodeId}.`);
    }
    return { view: "Tree", direction: "both", branchSide };
  }
  if (input.surfaceMode === "logic-chart" || input.surfaceMode === "tree") return { view: "Tree", direction: input.direction };
  return vectorDirection(input.surfaceMode, input.direction);
}

export function routeParentChildEdge(input: ParentChildEdgeRouteInput): ParentChildEdgeRoute {
  const branchDirection = parentChildBranchDirection(input);
  const ports = selectPorts(input.parentRect, input.childRect, branchDirection);
  return {
    relation: input.relation,
    branchDirection,
    ports,
    path: route(ports, input.routeStyle),
  };
}

