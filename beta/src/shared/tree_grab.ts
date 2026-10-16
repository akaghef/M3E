import type { LayoutDirection } from "./layout_port";

type Node = { parentId: string | null; children: string[] };
type Position = { x: number; y: number; w: number; branchPortSide?: string };
export type GrabMove = { parentId: string; index: number };

/** Plan a structural move; indices use applyMoveByParentAndIndex's pre-removal convention. */
export function treeGrabMove(
  nodes: Record<string, Node>, positions: Record<string, Position>, sourceId: string,
  scopeRootId: string, direction: LayoutDirection, key: string,
): GrabMove | null {
  const source = nodes[sourceId], p = positions[sourceId];
  if (!source?.parentId || sourceId === scopeRootId || !p) return null;
  const parent = nodes[source.parentId], parentPos = positions[source.parentId];
  if (!parent || !parentPos) return null;
  const vertical = direction === "up" || direction === "down" || direction === "up/down";
  const both = direction === "left/right" || direction === "up/down";
  const side = (id: string) => {
    const pos = positions[id];
    const delta = vertical ? pos.y - parentPos.y : pos.x + pos.w / 2 - parentPos.x - parentPos.w / 2;
    return delta < 0 ? -1 : 1;
  };
  const outward = both ? (side(sourceId) < 0 ? (vertical ? "up" : "left") : (vertical ? "down" : "right")) : direction;
  const depthKey = { right: "ArrowRight", left: "ArrowLeft", down: "ArrowDown", up: "ArrowUp" }[outward];
  const parentKey = { ArrowRight: "ArrowLeft", ArrowLeft: "ArrowRight", ArrowDown: "ArrowUp", ArrowUp: "ArrowDown" }[depthKey!];
  const siblings = parent.children.filter(id => positions[id] && (!both || side(id) === side(sourceId)))
    .sort((a, b) => vertical
      ? positions[a]!.x + positions[a]!.w / 2 - positions[b]!.x - positions[b]!.w / 2
      : positions[a]!.y - positions[b]!.y);
  const visualIndex = siblings.indexOf(sourceId);
  if (visualIndex < 0) return null;
  if (key === depthKey) {
    // The first sibling goes under the next sibling instead of being a dead end.
    const target = siblings[visualIndex - 1] ?? siblings[visualIndex + 1];
    return target ? { parentId: target, index: nodes[target]!.children.length } : null;
  }
  if (key === parentKey) {
    if (source.parentId === scopeRootId || !parent.parentId || !positions[parent.parentId]) return null;
    return { parentId: parent.parentId, index: nodes[parent.parentId]!.children.indexOf(source.parentId) + 1 };
  }
  const previous = vertical ? "ArrowLeft" : "ArrowUp";
  const next = vertical ? "ArrowRight" : "ArrowDown";
  if (key !== previous && key !== next) return null;
  const target = siblings[visualIndex + (key === previous ? -1 : 1)];
  if (!target) return null;
  const sourceIndex = parent.children.indexOf(sourceId), targetIndex = parent.children.indexOf(target);
  return { parentId: source.parentId, index: targetIndex + (targetIndex > sourceIndex ? 1 : 0) };
}
