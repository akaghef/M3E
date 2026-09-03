export type EdgePortSide = "left" | "right" | "top" | "bottom";

export interface EdgeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EdgePortPoint {
  x: number;
  y: number;
  side: EdgePortSide;
}

export type SurfaceViewName = "Tree" | "Axial" | "Disperse" | "System";
export type PrimaryDirection = "right" | "left" | "up" | "down";
export type TreeDirection = "left/right" | "left" | "right" | "up/down" | "up" | "down";
export type TreeBranchSide = "left" | "right" | "up" | "down";
export type DisperseDirection = "free";
export type SystemDirection = "right" | "down" | "free";

export type EdgeDirection =
  | { view: "Tree"; direction: TreeDirection; branchSide?: TreeBranchSide }
  // Compatibility for existing persisted/golden inputs. New callers must use
  // the canonical `left/right` direction instead.
  | { view: "Tree"; direction: "both"; branchSide: TreeBranchSide }
  | { view: "Axial"; direction: PrimaryDirection }
  | { view: "Disperse"; direction: DisperseDirection; vector?: { x: number; y: number } }
  | { view: "System"; direction: SystemDirection; vector?: { x: number; y: number } };

export interface EdgePorts {
  source: EdgePortPoint;
  target: EdgePortPoint;
  edgeDirection: EdgeDirection;
}

function center(rect: EdgeRect): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function portForSide(rect: EdgeRect, side: EdgePortSide): EdgePortPoint {
  const c = center(rect);
  if (side === "left") return { x: rect.x, y: c.y, side };
  if (side === "right") return { x: rect.x + rect.w, y: c.y, side };
  if (side === "top") return { x: c.x, y: rect.y, side };
  return { x: c.x, y: rect.y + rect.h, side };
}

function opposite(side: EdgePortSide): EdgePortSide {
  if (side === "left") return "right";
  if (side === "right") return "left";
  if (side === "top") return "bottom";
  return "top";
}

function sideForPrimaryDirection(direction: PrimaryDirection): EdgePortSide {
  if (direction === "right") return "right";
  if (direction === "left") return "left";
  if (direction === "up") return "top";
  return "bottom";
}

function sideForVector(srcRect: EdgeRect, dstRect: EdgeRect, explicitVector?: { x: number; y: number }): EdgePortSide {
  const src = center(srcRect);
  const dst = center(dstRect);
  const dx = explicitVector?.x ?? (dst.x - src.x);
  const dy = explicitVector?.y ?? (dst.y - src.y);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

function sourceSideForDirection(srcRect: EdgeRect, dstRect: EdgeRect, edgeDirection: EdgeDirection): EdgePortSide {
  if (edgeDirection.view === "Tree") {
    if (edgeDirection.direction === "left/right") {
      if (edgeDirection.branchSide !== "left" && edgeDirection.branchSide !== "right") {
        throw new Error("Tree left/right requires LayoutResult.branchSide left or right.");
      }
      return edgeDirection.branchSide;
    }
    if (edgeDirection.direction === "up/down") {
      if (edgeDirection.branchSide !== "up" && edgeDirection.branchSide !== "down") {
        throw new Error("Tree up/down requires LayoutResult.branchSide up or down.");
      }
      return sideForPrimaryDirection(edgeDirection.branchSide);
    }
    if (edgeDirection.direction === "both") return sideForPrimaryDirection(edgeDirection.branchSide);
    return sideForPrimaryDirection(edgeDirection.direction);
  }
  if (edgeDirection.view === "Axial") return sideForPrimaryDirection(edgeDirection.direction);
  if (edgeDirection.view === "Disperse") return sideForVector(srcRect, dstRect, edgeDirection.vector);
  if (edgeDirection.direction === "free") return sideForVector(srcRect, dstRect, edgeDirection.vector);
  return sideForPrimaryDirection(edgeDirection.direction);
}

export function selectPorts(srcRect: EdgeRect, dstRect: EdgeRect, edgeDirection: EdgeDirection): EdgePorts {
  const sourceSide = sourceSideForDirection(srcRect, dstRect, edgeDirection);
  const targetSide = opposite(sourceSide);
  return {
    source: portForSide(srcRect, sourceSide),
    target: portForSide(dstRect, targetSide),
    edgeDirection,
  };
}
