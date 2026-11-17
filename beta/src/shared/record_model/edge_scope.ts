// Which scope a parent-child edge lies on (record-schema DA59), for states that still mark
// scopes by node: an edge from parent `a` lies on the scope of the nearest scope root among
// `a` and its ancestors. Every child of a scope root is therefore inside that scope, which
// is how the current viewer shows scopes.

/**
 * Returns a lookup from a parent node id to the root of the scope its child edges lie on.
 * Undefined when no ancestor is a scope root or the parent chain loops.
 */
export function makeEdgeScopeRoot(
  parentOf: (id: string) => string | undefined,
  isScopeRoot: (id: string) => boolean,
): (parentId: string) => string | undefined {
  const memo = new Map<string, string | null>();
  return (parentId: string): string | undefined => {
    const walk: string[] = [];
    const onWalk = new Set<string>();
    let current: string | undefined = parentId;
    let found: string | null = null;
    while (current !== undefined) {
      const known = memo.get(current);
      if (known !== undefined) {
        found = known;
        break;
      }
      if (onWalk.has(current)) break; // a loop: no scope
      if (isScopeRoot(current)) {
        found = current;
        walk.push(current);
        break;
      }
      walk.push(current);
      onWalk.add(current);
      current = parentOf(current);
    }
    for (const id of walk) memo.set(id, found);
    return found ?? undefined;
  };
}
