/**
 * Scope view: the part of a map that belongs to one scope.
 *
 * A scope root is the map root or a node with `nodeType === "folder"`. A node
 * belongs to the nearest ancestor-or-self that is a scope root. The scope view
 * of a scope root holds
 *   - the scope root and every descendant reached without passing through
 *     another scope root,
 *   - each nested scope root as an entry: its own fields with `children: []`,
 *   - the ancestors of the scope root up to the map root, each trimmed to the
 *     single child on the path.
 * `rootId` stays the map root, so code that walks from the root still works.
 *
 * Pure: the input state is not modified and no object of it is shared with the result.
 */
import type { AppState, TreeNode } from "./types";
import type { RecordChange } from "./map_changes";

/** Header a viewer in scope view sends on every write. The whole-map routes reject it. */
export const SCOPE_VIEW_HEADER = "X-M3E-Scope-View";

export interface ScopeViewEntry {
  /** Real number of children of the nested scope root. */
  childCount: number;
  /** Real number of descendants of the nested scope root. */
  descendantCount: number;
}

export interface ScopeViewAncestor {
  nodeId: string;
  text: string;
  /** True when this ancestor is itself a scope root (the map root or a scope node). */
  isScope: boolean;
  childCount: number;
  descendantCount: number;
  /** Real position, among this ancestor's children, of the next node on the path. */
  pathChildIndex: number;
}

export interface ScopeViewInfo {
  scopeRootId: string;
  /** Number of nodes of the whole map. */
  totalNodeCount: number;
  /** Number of nodes in the returned state. */
  loadedNodeCount: number;
  /** Real number of descendants of the scope root, nested scopes included. */
  scopeDescendantCount: number;
  /** Ordered map root -> parent of the scope root. Empty when the scope root is the map root. */
  ancestors: ScopeViewAncestor[];
  entries: Record<string, ScopeViewEntry>;
  /** GraphLinks left out because an endpoint is not in the view. */
  omittedLinks: number;
  /** Targets of included alias nodes that are not in the view. */
  externalAliasTargets: Record<string, { text: string }>;
  /**
   * Included nodes that something outside the view points at: alias nodes that are not
   * loaded, or GraphLinks that were left out. Deleting such a node would leave those behind.
   */
  outsideReferences: Record<string, { aliases: number; links: number }>;
}

export type ScopeViewErrorCode = "NODE_NOT_FOUND" | "NOT_A_SCOPE";

export class ScopeViewError extends Error {
  readonly code: ScopeViewErrorCode;
  constructor(code: ScopeViewErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function copy<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function childrenOf(node: TreeNode | undefined): string[] {
  return node && Array.isArray(node.children) ? node.children : [];
}

/** Key of the scope settings record the viewer keeps for a scope root. */
export function scopeRecordId(nodeId: string): string {
  return `scope:${nodeId}`;
}

export function isScopeRoot(state: AppState, nodeId: string): boolean {
  const node = state.nodes?.[nodeId];
  return Boolean(node) && (nodeId === state.rootId || node!.nodeType === "folder");
}

function countDescendants(state: AppState, nodeId: string): number {
  let count = 0;
  const seen = new Set<string>([nodeId]);
  const stack = [...childrenOf(state.nodes[nodeId])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id) || !state.nodes[id]) continue;
    seen.add(id);
    count += 1;
    stack.push(...childrenOf(state.nodes[id]));
  }
  return count;
}

export function extractScopeView(state: AppState, scopeRootId: string): { state: AppState; view: ScopeViewInfo } {
  const nodes = state.nodes ?? {};
  const scopeRoot = nodes[scopeRootId];
  if (!scopeRoot) throw new ScopeViewError("NODE_NOT_FOUND", `Node not found in map: ${scopeRootId}`);
  if (!isScopeRoot(state, scopeRootId)) throw new ScopeViewError("NOT_A_SCOPE", `Node is not a scope root: ${scopeRootId}`);

  const outNodes: Record<string, TreeNode> = {};
  const entries: Record<string, ScopeViewEntry> = {};
  let scopeDescendantCount = 0;

  // The scope root, its own nodes, and nested scope roots as entries.
  outNodes[scopeRootId] = copy(scopeRoot);
  const stack = [...childrenOf(scopeRoot)];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const node = nodes[id];
    if (!node || outNodes[id]) continue;
    scopeDescendantCount += 1;
    if (node.nodeType === "folder") {
      const descendantCount = countDescendants(state, id);
      entries[id] = { childCount: childrenOf(node).length, descendantCount };
      scopeDescendantCount += descendantCount;
      outNodes[id] = { ...copy(node), children: [] };
      continue;
    }
    outNodes[id] = copy(node);
    stack.push(...childrenOf(node));
  }

  // Ancestors, each trimmed to the single child on the path.
  const chain: string[] = [];
  const seen = new Set<string>([scopeRootId]);
  let cursor = scopeRootId === state.rootId ? null : scopeRoot.parentId;
  while (cursor && nodes[cursor] && !seen.has(cursor)) {
    chain.unshift(cursor);
    seen.add(cursor);
    if (cursor === state.rootId) break;
    cursor = nodes[cursor]!.parentId;
  }
  const ancestors: ScopeViewAncestor[] = new Array(chain.length);
  let below = scopeDescendantCount;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const id = chain[i]!;
    const node = nodes[id]!;
    const next = i + 1 < chain.length ? chain[i + 1]! : scopeRootId;
    let descendantCount = 0;
    for (const childId of childrenOf(node)) {
      if (!nodes[childId]) continue;
      descendantCount += 1 + (childId === next ? below : countDescendants(state, childId));
    }
    ancestors[i] = {
      nodeId: id,
      text: typeof node.text === "string" ? node.text : "",
      isScope: isScopeRoot(state, id),
      childCount: childrenOf(node).length,
      descendantCount,
      pathChildIndex: childrenOf(node).indexOf(next),
    };
    outNodes[id] = { ...copy(node), children: [next] };
    below = descendantCount;
  }

  const included = (id: unknown): boolean => typeof id === "string" && Object.prototype.hasOwnProperty.call(outNodes, id);

  const externalAliasTargets: Record<string, { text: string }> = {};
  for (const node of Object.values(outNodes)) {
    if (node.nodeType !== "alias" || !node.targetNodeId || included(node.targetNodeId)) continue;
    const target = nodes[node.targetNodeId];
    if (target) externalAliasTargets[node.targetNodeId] = { text: typeof target.text === "string" ? target.text : "" };
  }

  // Nodes of this scope itself: not the entries (their own scope) and not the ancestors.
  const own = (id: unknown): boolean => included(id) && !entries[id as string] && !chain.includes(id as string);

  const outsideReferences: Record<string, { aliases: number; links: number }> = {};
  const referenced = (id: string): { aliases: number; links: number } => (outsideReferences[id] ??= { aliases: 0, links: 0 });
  for (const node of Object.values(nodes)) {
    if (node.nodeType === "alias" && node.targetNodeId && !included(node.id) && included(node.targetNodeId)) {
      referenced(node.targetNodeId).aliases += 1;
    }
  }

  const out: Bag = {};
  let omittedLinks = 0;
  const source = state as unknown as Bag;
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (key === "nodes") {
      out.nodes = outNodes;
    } else if (key === "links" && isBag(value)) {
      const links: Bag = {};
      for (const [id, link] of Object.entries(value)) {
        if (isBag(link) && included(link.sourceNodeId) && included(link.targetNodeId)) {
          links[id] = copy(link);
          continue;
        }
        omittedLinks += 1;
        if (!isBag(link)) continue;
        if (included(link.sourceNodeId)) referenced(link.sourceNodeId as string).links += 1;
        if (included(link.targetNodeId)) referenced(link.targetNodeId as string).links += 1;
      }
      out.links = links;
    } else if (key === "scopes" && isBag(value)) {
      out.scopes = ownScopes(value, scopeRootId);
    } else if (key === "surfaces" && isBag(value)) {
      const scopeKeys = new Set([scopeRecordId(scopeRootId), ...Object.keys(ownScopes(source.scopes, scopeRootId))]);
      const surfaces: Bag = {};
      for (const [id, surface] of Object.entries(value)) {
        if (!isBag(surface) || !scopeKeys.has(String(surface.scopeId))) continue;
        const kept = copy(surface);
        if (isBag(kept.nodeViews)) {
          kept.nodeViews = Object.fromEntries(Object.entries(kept.nodeViews).filter(([nodeId]) => included(nodeId)));
        }
        surfaces[id] = kept;
      }
      out.surfaces = surfaces;
    } else if (key === "linearNotesByScope" && isBag(value)) {
      // A linear-text is kept per node that was opened as the current scope; every own node can be one.
      out.linearNotesByScope = Object.fromEntries(Object.entries(value).filter(([id]) => own(id)).map(([id, text]) => [id, copy(text)]));
    } else if (key === "annotations" && isBag(value)) {
      // Keyed by annotation id. An array (legacy shape) is copied whole below: its keys are positions.
      out.annotations = Object.fromEntries(
        Object.entries(value)
          // An annotation without a scope is drawn in every scope.
          .filter(([, annotation]) => isBag(annotation) && (!annotation.scopeId || own(annotation.scopeId)))
          .map(([id, annotation]) => [id, copy(annotation)]),
      );
    } else {
      out[key] = copy(value);
    }
  }
  if (!out.nodes) out.nodes = outNodes;

  return {
    state: out as unknown as AppState,
    view: {
      scopeRootId,
      totalNodeCount: Object.keys(nodes).length,
      loadedNodeCount: Object.keys(outNodes).length,
      scopeDescendantCount,
      ancestors,
      entries,
      omittedLinks,
      externalAliasTargets,
      outsideReferences,
    },
  };
}

function ownScopes(raw: unknown, scopeRootId: string): Bag {
  const result: Bag = {};
  if (!isBag(raw)) return result;
  for (const [id, scope] of Object.entries(raw)) {
    if (!isBag(scope)) continue;
    const roots = Array.isArray(scope.rootNodeIds) ? scope.rootNodeIds : [];
    if (id === scopeRecordId(scopeRootId) || roots.includes(scopeRootId)) result[id] = copy(scope);
  }
  return result;
}

export type ScopeViewChangeResult =
  | { ok: true; changes: RecordChange[] }
  | { ok: false; reason: string };

/**
 * Turns the changes between two states of a scope view into changes of the whole map.
 *
 * `before` and `after` are scope view states (the last server base and the current one).
 *  - An edge under an entry is counted from the entry's real child count, because the
 *    view holds the entry with `children: []`: a node moved onto an entry is appended.
 *  - Scope settings and Surface View records of other scopes are not in the view; the
 *    records a viewer derives for them locally are dropped. `relationIds` of the own
 *    scope is derived from the loaded GraphLinks only and is dropped as well.
 *  - A change that needs nodes that are not loaded is refused: deleting an entry or a
 *    node on the ancestor path, or attaching a node under an ancestor.
 */
export function scopeViewChanges(
  changes: readonly RecordChange[],
  view: ScopeViewInfo,
  before: AppState,
  after: AppState,
): ScopeViewChangeResult {
  const ancestorById = new Map(view.ancestors.map((ancestor) => [ancestor.nodeId, ancestor]));
  const pathIds = new Set<string>([...ancestorById.keys(), view.scopeRootId]);
  const ownScopeKey = scopeRecordId(view.scopeRootId);
  const ownScope = (id: string): boolean => {
    if (id === ownScopeKey) return true;
    const record = (after.scopes?.[id] ?? before.scopes?.[id]) as { rootNodeIds?: unknown } | undefined;
    return Array.isArray(record?.rootNodeIds) && record!.rootNodeIds.includes(view.scopeRootId);
  };
  const ownSurface = (id: string): boolean => {
    const surface = after.surfaces?.[id] ?? before.surfaces?.[id];
    return Boolean(surface) && ownScope(String(surface!.scopeId));
  };
  /** The edge of a node in a view state, with the position under an entry counted from its real child count. */
  const realEdge = (state: AppState, nodeId: string): Record<string, unknown> | null => {
    const parentId = state.nodes?.[nodeId]?.parentId;
    if (typeof parentId !== "string") return null;
    const index = childrenOf(state.nodes[parentId]).indexOf(nodeId);
    const entry = view.entries[parentId];
    return { parentId, index: entry && index >= 0 ? entry.childCount + index : index };
  };

  const result: RecordChange[] = [];
  for (const change of changes) {
    const id = change.key[0] ?? "";
    if (change.kind === "scope-setting") {
      if (!ownScope(id)) continue;
      const strip = (fields: Record<string, unknown> | undefined) => {
        if (!fields) return fields;
        const { relationIds: _dropped, ...rest } = fields;
        return rest;
      };
      if (change.op !== "update") {
        result.push(change);
        continue;
      }
      const beforeFields = strip(change.before) ?? {};
      const afterFields = strip(change.after) ?? {};
      if (Object.keys(beforeFields).length + Object.keys(afterFields).length === 0) continue;
      result.push({ ...change, before: beforeFields, after: afterFields });
      continue;
    }
    if (change.kind === "surface" || change.kind === "surface-node-view") {
      if (ownSurface(id)) result.push(change);
      continue;
    }
    if (change.kind === "node" && change.op === "delete") {
      if (view.entries[id]) return { ok: false, reason: "a nested scope cannot be deleted in scope view: its contents are not loaded" };
      if (pathIds.has(id)) return { ok: false, reason: "the opened scope and its ancestors cannot be deleted in scope view" };
      if (view.outsideReferences[id]) return { ok: false, reason: "a node that an alias or a GraphLink outside the loaded scope points at cannot be deleted in scope view" };
    }
    if (change.kind === "node" && change.op === "create" && pathIds.has(id)) {
      return { ok: false, reason: "the opened scope and its ancestors cannot be replaced in scope view" };
    }
    if (change.kind === "edge") {
      const beforeParent = typeof change.before?.parentId === "string" ? change.before.parentId : null;
      const afterParent = typeof change.after?.parentId === "string" ? change.after.parentId : null;
      if (pathIds.has(id)) return { ok: false, reason: "the opened scope and its ancestors cannot be moved in scope view" };
      if ((afterParent && ancestorById.has(afterParent)) || (beforeParent && ancestorById.has(beforeParent))) {
        return { ok: false, reason: "nodes cannot be moved to or from an ancestor of the opened scope in scope view" };
      }
      // A reorder carries only the index: the parent comes from the states.
      const fromEdge = change.op === "create" ? null : realEdge(before, id);
      const toEdge = change.op === "delete" ? null : realEdge(after, id);
      const underEntry = [fromEdge, toEdge].some((edge) => edge !== null && Boolean(view.entries[String(edge.parentId)]));
      if (!underEntry) {
        result.push(change);
        continue;
      }
      // Both sides in full, so the position the server holds is checked and set explicitly.
      const mapped: RecordChange = { kind: change.kind, key: change.key, op: change.op };
      if (fromEdge) mapped.before = fromEdge;
      if (toEdge) mapped.after = toEdge;
      result.push(mapped);
      continue;
    }
    result.push(change);
  }
  return { ok: true, changes: result };
}
