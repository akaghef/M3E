/**
 * Keyboard movement for Lane view, following what is on screen: along a lane
 * moves to the neighbouring grandchild, across lanes moves to the grandchild of
 * the next non-empty lane whose position is nearest. Never returns a node that
 * Lane does not draw (root, lane node, collapsed descendants).
 */
export type LaneDirection = "right" | "down";
type Position = { x: number; y: number; w: number; h: number };

export interface LaneGrid {
  /** Lane node ids in sibling order. */
  laneIds: string[];
  /** Drawn grandchildren of each lane, in sibling order. */
  lanes: string[][];
}

function step(direction: LaneDirection, key: string): { along: boolean; delta: -1 | 1 } | null {
  const down = direction === "down";
  switch (key) {
    case "ArrowLeft": return { along: down, delta: -1 };
    case "ArrowRight": return { along: down, delta: 1 };
    case "ArrowUp": return { along: !down, delta: -1 };
    case "ArrowDown": return { along: !down, delta: 1 };
    default: return null;
  }
}

/** Position along the lane: x centre for rows, y centre for columns. */
function alongOf(direction: LaneDirection, p: Position): number {
  return direction === "down" ? p.x + p.w / 2 : p.y;
}

function locate(grid: LaneGrid, id: string): { lane: number; index: number } | null {
  for (let lane = 0; lane < grid.lanes.length; lane++) {
    const index = grid.lanes[lane]!.indexOf(id);
    if (index >= 0) return { lane, index };
  }
  return null;
}

function nearestIndex(ids: string[], positions: Record<string, Position>, direction: LaneDirection, at: number): number {
  let best = 0, bestDistance = Number.POSITIVE_INFINITY;
  ids.forEach((id, index) => {
    const p = positions[id];
    if (!p) return;
    const distance = Math.abs(alongOf(direction, p) - at);
    if (distance < bestDistance) { best = index; bestDistance = distance; }
  });
  return best;
}

export function laneFirstNode(grid: LaneGrid): string | null {
  return grid.lanes.find(ids => ids.length > 0)?.[0] ?? null;
}

export function laneNavigationTarget(grid: LaneGrid, positions: Record<string, Position>,
  currentId: string, direction: LaneDirection, key: string): string | null {
  const move = step(direction, key);
  if (!move) return null;
  const here = locate(grid, currentId);
  if (!here) return laneFirstNode(grid);
  if (move.along) return grid.lanes[here.lane]![here.index + move.delta] ?? null;
  const current = positions[currentId];
  if (!current) return null;
  for (let lane = here.lane + move.delta; lane >= 0 && lane < grid.lanes.length; lane += move.delta) {
    const ids = grid.lanes[lane]!;
    if (ids.length) return ids[nearestIndex(ids, positions, direction, alongOf(direction, current))]!;
  }
  return null;
}

/**
 * Grab-move in Lane: along a lane reorders siblings, across lanes reparents into
 * the next lane at the nearest position. Index follows the existing
 * applyMoveByParentAndIndex convention (insertion index before removal).
 */
export function laneGrabMove(grid: LaneGrid, positions: Record<string, Position>,
  sourceId: string, direction: LaneDirection, key: string): { parentId: string; index: number } | null {
  const move = step(direction, key);
  const here = locate(grid, sourceId);
  if (!move || !here) return null;
  const ids = grid.lanes[here.lane]!;
  if (move.along) {
    const targetIndex = here.index + move.delta;
    if (targetIndex < 0 || targetIndex >= ids.length) return null;
    return { parentId: grid.laneIds[here.lane]!, index: targetIndex + (targetIndex > here.index ? 1 : 0) };
  }
  const lane = here.lane + move.delta;
  if (lane < 0 || lane >= grid.lanes.length) return null;
  const source = positions[sourceId];
  if (!source) return null;
  const at = alongOf(direction, source);
  const index = grid.lanes[lane]!.filter(id => positions[id] && alongOf(direction, positions[id]!) < at).length;
  return { parentId: grid.laneIds[lane]!, index };
}
