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

function primaryDirection(direction: TreeDirection, branchPortSide?: TreeBranchSide): PrimaryDirection | undefined {
  if (direction !== "left/right" && direction !== "up/down") return direction;
  return branchPortSide;
}

function vectorFallback(): EdgeDirection {
  return { view: "Disperse", direction: "free" };
}

function treeDirection(direction: TreeDirection, branchPortSide?: TreeBranchSide): EdgeDirection {
  if (direction === "left/right" || direction === "up/down") {
    return branchPortSide ? { view: "Tree", direction, branchSide: branchPortSide } : vectorFallback();
  }
  return { view: "Tree", direction };
}

function vectorDirection(surfaceMode: "scatter" | "system", direction: PrimaryDirection | undefined): EdgeDirection {
  if (!direction) return vectorFallback();
  if (surfaceMode === "scatter") return { view: "Disperse", direction: "free" };
  return direction === "down"
    ? { view: "System", direction: "down" }
    : direction === "right"
      ? { view: "System", direction: "right" }
      : { view: "System", direction: "free" };
}

export function parentChildEdgeDirection(input: ParentChildEdgeRouteInput): EdgeDirection {
  const branchPortSide = input.childPosition?.branchPortSide;
  const primary = primaryDirection(input.direction, branchPortSide);
  if (input.surfaceMode === "timeline") return primary ? { view: "Axial", direction: primary } : vectorFallback();
  // `mindmap` is the product adapter for the canonical Radial surface. Its
  // endpoints must follow each parent-child vector: a global depth direction
  // and branchPortSide describe layout, but do not determine a Radial edge's
  // local boundary intersection.
  if (input.surfaceMode === "mindmap") return { view: "Radial", direction: "balanced" };
  if (input.surfaceMode === "logic-chart" || input.surfaceMode === "tree") {
    return treeDirection(input.direction, branchPortSide);
  }
  return vectorDirection(input.surfaceMode, primary);
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
