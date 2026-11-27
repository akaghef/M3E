// `applyChanges` on the part of the state a Command can reach.
//
// `applyChanges` (shared/map_changes.ts) walks every node of the map for each edge change, which
// on a large map costs far more than the change itself. The result for a node depends only on the
// nodes the changes name, the parents involved (before, after and current) and the other children
// of those parents. This runs `applyChanges` on a state holding just those nodes and puts the
// result back into the full node table. Everything outside `nodes` is handed over as it is.
// The outcome (state or conflicts) is the same as that of `applyChanges` on the full state;
// tests/unit/record_store_apply_reduced.test.ts holds the two against each other.

import { isOrderKey } from "../../shared/record_model/order_key";
import { applyChanges, type ApplyResult, type RecordChange } from "../../shared/map_changes";

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function applyChangesReduced(state: object, changes: readonly RecordChange[], allowAfter = false): ApplyResult {
  const source = state as Dict;
  const nodes = source.nodes;
  if (!isDict(nodes) || !Array.isArray(changes)) return applyChanges(state, changes, allowAfter);

  const ids = new Set<string>();
  const parents = new Set<string>();
  for (const change of changes) {
    if (!change || typeof change !== "object" || !Array.isArray(change.key)) return applyChanges(state, changes, allowAfter);
    if (change.kind === "map-field") {
      // Presence of the node table itself: needs every node.
      if (change.key[0] === "nodes") return applyChanges(state, changes, allowAfter);
    } else if (change.kind === "node") {
      ids.add(change.key[0] ?? "");
    } else if (change.kind === "edge") {
      const id = change.key[0] ?? "";
      ids.add(id);
      const current = nodes[id];
      for (const parentId of [change.before?.parentId, change.after?.parentId, isDict(current) ? current.parentId : undefined]) {
        if (typeof parentId === "string") parents.add(parentId);
      }
    } else if (change.kind === "attribute" && change.key[0] !== "graph-link") {
      ids.add(change.key[1] ?? "");
    }
  }
  if (parents.size > 0) {
    for (const id in nodes) {
      const node = nodes[id];
      if (isDict(node) && typeof node.parentId === "string" && parents.has(node.parentId)) ids.add(id);
    }
    for (const parentId of parents) ids.add(parentId);
  }

  const reducedNodes: Dict = {};
  for (const id of ids) {
    if (hasOwn(nodes, id)) reducedNodes[id] = nodes[id];
  }
  // Preserve the complete viewer state's metadata visibility even when its only keyed
  // node is outside the reduced set (legacy array-only states omit these properties).
  const exposeOrders = Object.values(nodes).some(node => isDict(node) && hasOwn(node, "edgeOrder"));
  const result = applyChanges({ ...source, nodes: reducedNodes }, changes, allowAfter, exposeOrders);
  if (!result.ok) return result;
  const applied = result.state as Dict;
  const appliedNodes = applied.nodes;
  if (appliedNodes === reducedNodes) return { ok: true, state: { ...applied, nodes } };
  if (!isDict(appliedNodes)) return applyChanges(state, changes, allowAfter);

  const merged: Dict = { ...nodes };
  for (const id of ids) {
    if (hasOwn(appliedNodes, id)) merged[id] = appliedNodes[id];
    else delete merged[id];
  }
  for (const id of Object.keys(appliedNodes)) {
    if (!ids.has(id)) merged[id] = appliedNodes[id];
  }
  return { ok: true, state: { ...applied, nodes: merged } };
}

export interface AppendedLeaves {
  nodes: Dict;
  parents: Map<string, string[]>;
}

/**
 * A monotone suffix insertion on a valid warm map cannot change existing validation facts.
 * Anything that can alter scope, alias or existing topology semantics uses the general path.
 * This only prepares new nodes: the projector owns transactional installation and rollback.
 */
export function appendedLeaves(state: object, changes: readonly RecordChange[]): AppendedLeaves | undefined {
  const source = state as Dict;
  const nodes = source.nodes;
  if (!isDict(nodes) || changes.length === 0) return undefined;
  const created = new Set<string>();
  for (const change of changes) {
    if (change.kind !== "node") continue;
    const id = change.key[0];
    if (change.op !== "create" || hasOwn(nodes, id) || created.has(id)) return undefined;
    const notes = source.linearNotesByScope;
    if (isDict(notes) && (hasOwn(notes, id) || hasOwn(notes, `scope:${id}`))) return undefined;
    const body = change.after ?? {};
    if (body.id !== id || ![undefined, "text", "leaf", "image", "agent"].includes(body.nodeType as string | undefined)) return undefined;
    for (const field of ["parentId", "children", "scopeId", "edgeOutsideScope", "targetNodeId", "access", "isBroken", "aliasOf"]) {
      if (hasOwn(body, field)) return undefined;
    }
    created.add(id);
  }
  if (created.size === 0) return undefined;
  const positions = new Map<string, Array<{ id: string; index: number; stable: boolean }>>();
  const edged = new Set<string>();
  for (const change of changes) {
    if (change.kind === "node") continue;
    if (change.kind === "attribute" && change.key[0] === "node" && created.has(change.key[1])) continue;
    if (change.kind !== "edge" || change.op !== "create" || !created.has(change.key[0]) || edged.has(change.key[0])) return undefined;
    const parentId = change.after?.parentId;
    const parent = nodes[parentId as string];
    const ord = change.after?.ord;
    const index = isOrderKey(ord) ? positions.get(parentId as string)?.length ?? 0 : change.after?.index;
    if (typeof parentId !== "string" || typeof index !== "number" || !Number.isSafeInteger(index)) return undefined;
    if (!isDict(parent)) return undefined;
    edged.add(change.key[0]);
    let group = positions.get(parentId);
    if (!group) positions.set(parentId, group = []);
    group.push({ id: change.key[0], index, stable: isOrderKey(ord) });
  }
  if (edged.size !== created.size) return undefined;
  const parents = new Map<string, string[]>();
  for (const [id, group] of positions) {
    group.sort((a, b) => a.index - b.index);
    const stable = group.every(entry => entry.stable);
    if (!stable) {
      const length = ((nodes[id] as Dict).children as unknown[]).length;
      if (group.some((entry, i) => entry.index !== length + i)) return undefined;
    }
    parents.set(id, group.map((entry) => entry.id));
  }
  const applied = applyChanges({ ...source, nodes: {} }, changes);
  if (!applied.ok) return undefined;
  return { nodes: (applied.state as Dict).nodes as Dict, parents };
}
