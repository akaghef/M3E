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

export type SurfaceViewName = "Tree" | "Axial" | "Radial" | "Disperse" | "System";
export type PrimaryDirection = "right" | "left" | "up" | "down";
export type TreeBranchSide = "left" | "right";
export type RadialDirection = "clockwise" | "counterclockwise" | "balanced";
export type DisperseDirection = "free";
export type SystemDirection = "right" | "down" | "free";

export type EdgeBranchDirection =
  | { view: "Tree"; direction: PrimaryDirection }
  | { view: "Tree"; direction: "both"; branchSide: TreeBranchSide }
  | { view: "Axial"; direction: PrimaryDirection }
  | { view: "Radial"; direction: RadialDirection; radialVector?: { x: number; y: number } }
  | { view: "Disperse"; direction: DisperseDirection; vector?: { x: number; y: number } }
  | { view: "System"; direction: SystemDirection; vector?: { x: number; y: number } };

export interface EdgePorts {
  source: EdgePortPoint;
  target: EdgePortPoint;
  branchDirection: EdgeBranchDirection;
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

function sourceSideForDirection(srcRect: EdgeRect, dstRect: EdgeRect, branchDirection: EdgeBranchDirection): EdgePortSide {
  if (branchDirection.view === "Tree") {
    if (branchDirection.direction === "both") return branchDirection.branchSide;
    return sideForPrimaryDirection(branchDirection.direction);
  }
  if (branchDirection.view === "Axial") return sideForPrimaryDirection(branchDirection.direction);
  if (branchDirection.view === "Radial") return sideForVector(srcRect, dstRect, branchDirection.radialVector);
  if (branchDirection.view === "Disperse") return sideForVector(srcRect, dstRect, branchDirection.vector);
  if (branchDirection.direction === "free") return sideForVector(srcRect, dstRect, branchDirection.vector);
  return sideForPrimaryDirection(branchDirection.direction);
}

export function selectPorts(srcRect: EdgeRect, dstRect: EdgeRect, branchDirection: EdgeBranchDirection): EdgePorts {
  const sourceSide = sourceSideForDirection(srcRect, dstRect, branchDirection);
  const targetSide = opposite(sourceSide);
  return {
    source: portForSide(srcRect, sourceSide),
    target: portForSide(dstRect, targetSide),
    branchDirection,
  };
}

