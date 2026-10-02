/** Convert a visible drop slot (source already excluded) to a pre-removal index.
 * The move command removes the source and adjusts that index exactly once.
 * Resolve through sibling IDs so hidden children do not shift the chosen slot.
 */
export function reorderInsertionIndex(
  children: readonly string[],
  visibleChildrenWithoutSource: readonly string[],
  slot: number,
): number {
  const boundedSlot = Math.max(0, Math.min(slot, visibleChildrenWithoutSource.length));
  const nextId = visibleChildrenWithoutSource[boundedSlot];
  if (nextId !== undefined) return children.indexOf(nextId);
  const previousId = visibleChildrenWithoutSource[boundedSlot - 1];
  return previousId === undefined ? children.length : children.indexOf(previousId) + 1;
}
