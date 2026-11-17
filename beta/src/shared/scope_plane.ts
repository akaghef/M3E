/**
 * Which scope each node and parent-child edge lies on (record-schema DA59, "scope は面").
 *
 * A scope is a plane that cuts out part of the map. Every parent-child edge lies on one
 * scope; a node lies on the scope of its incoming edge, and a scope root also shows as the
 * top of its own scope. Until scopes carry their own ids in the app, a scope is named by
 * its root node id: the map root or a node with `nodeType === "folder"`.
 *
 * The edge into a child lies on
 *   - the parent's own scope when the parent is a scope root, unless the child carries
 *     `edgeOutsideScope`: then on the scope the parent itself lies on (the child stays
 *     beside the scope entry, outside the scope);
 *   - otherwise the scope the parent lies on.
 * Without any `edgeOutsideScope` this is the old rule: a node belongs to its nearest
 * ancestor-or-self scope root, and all children of a scope root are inside it.
 */
import type { TreeNode } from "./types";

type Nodes = Record<string, TreeNode>;

export function isScopeRootNode(rootId: string, node: TreeNode | null | undefined): boolean {
  return Boolean(node && (node.id === rootId || node.nodeType === "folder"));
}

/**
 * Root of the scope the edge into `childId` lies on. For the map root, the map root.
 * Empty string when the node does not exist or its parent chain is broken or loops.
 */
export function edgeScopeRootOf(nodes: Nodes, rootId: string, childId: string): string {
  let cursor = childId;
  for (let steps = 0; steps <= 100_000; steps += 1) {
    const node = nodes[cursor];
    if (!node) return "";
    if (node.id === rootId) return rootId;
    const parent = node.parentId ? nodes[node.parentId] : undefined;
    if (!parent) return "";
    if (isScopeRootNode(rootId, parent)) {
      if (node.edgeOutsideScope !== true || parent.id === rootId) return parent.id;
      // Outside the parent's scope: on the scope the parent itself lies on.
      cursor = parent.id;
      continue;
    }
    cursor = parent.id;
  }
  return "";
}

/** True when the node shows on the scope rooted at `scopeRootId`: as its top or on its plane. */
export function isOnScope(nodes: Nodes, rootId: string, nodeId: string, scopeRootId: string): boolean {
  if (!scopeRootId || !nodes[nodeId]) return false;
  return nodeId === scopeRootId || edgeScopeRootOf(nodes, rootId, nodeId) === scopeRootId;
}

/** Children of `node` whose edge lies on the scope rooted at `scopeRootId`, in order. */
export function childrenOnScope(nodes: Nodes, rootId: string, node: TreeNode, scopeRootId: string): string[] {
  return (node.children || []).filter((childId) => {
    const child = nodes[childId];
    if (!child || child.parentId !== node.id) return false;
    return edgeScopeRootOf(nodes, rootId, childId) === scopeRootId;
  });
}

/**
 * Root of the scope the parent of a scope root `scopeRootId` shows it as an entry in:
 * the scope its incoming edge lies on. Empty for the map root.
 */
export function parentScopeRootOf(nodes: Nodes, rootId: string, scopeRootId: string): string {
  if (scopeRootId === rootId) return "";
  return edgeScopeRootOf(nodes, rootId, scopeRootId);
}

/**
 * Value of `edgeOutsideScope` a child must carry to lie on `scopeRootId` under `parentId`:
 * false for the default, true for outside, null when the edge cannot lie on that scope.
 */
export function edgeOutsideFor(nodes: Nodes, rootId: string, parentId: string, scopeRootId: string): boolean | null {
  const parent = nodes[parentId];
  if (!parent) return null;
  if (isScopeRootNode(rootId, parent)) {
    if (scopeRootId === parent.id) return false;
    if (parent.id !== rootId && edgeScopeRootOf(nodes, rootId, parent.id) === scopeRootId) return true;
    return null;
  }
  return edgeScopeRootOf(nodes, rootId, parent.id) === scopeRootId ? false : null;
}

/** Nodes that carry `edgeOutsideScope` although their parent is not a scope root below the map root. */
export function edgeScopeProblems(nodes: Nodes, rootId: string): string[] {
  const problems: string[] = [];
  for (const node of Object.values(nodes)) {
    if (node.edgeOutsideScope === undefined) continue;
    const parent = node.parentId ? nodes[node.parentId] : undefined;
    if (node.edgeOutsideScope !== true || !parent || !isScopeRootNode(rootId, parent) || parent.id === rootId) {
      problems.push(`${node.id}: edgeOutsideScope is set but its parent is not a scope root below the map root`);
    }
  }
  return problems;
}

/**
 * True when the node lies on the scope rooted at `scopeRootId` or on a scope nested in it:
 * following each scope out to the scope its root lies on reaches `scopeRootId`. Every node
 * is within the map root's scope.
 */
export function isWithinScope(nodes: Nodes, rootId: string, nodeId: string, scopeRootId: string): boolean {
  if (!nodes[nodeId] || !nodes[scopeRootId]) return false;
  if (scopeRootId === rootId || nodeId === scopeRootId) return true;
  let scope = edgeScopeRootOf(nodes, rootId, nodeId);
  for (let steps = 0; scope && steps <= 100_000; steps += 1) {
    if (scope === scopeRootId) return true;
    if (scope === rootId) return false;
    scope = parentScopeRootOf(nodes, rootId, scope);
  }
  return false;
}
