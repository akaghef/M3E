// `applyChanges` on the part of the state a Command can reach.
//
// `applyChanges` (shared/map_changes.ts) walks every node of the map for each edge change, which
// on a large map costs far more than the change itself. The result for a node depends only on the
// nodes the changes name, the parents involved (before, after and current) and the other children
// of those parents. This runs `applyChanges` on a state holding just those nodes and puts the
// result back into the full node table. Everything outside `nodes` is handed over as it is.
// The outcome (state or conflicts) is the same as that of `applyChanges` on the full state;
// tests/unit/record_store_apply_reduced.test.ts holds the two against each other.

import { applyChanges, type ApplyResult, type RecordChange } from "../../shared/map_changes";

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function applyChangesReduced(state: object, changes: readonly RecordChange[]): ApplyResult {
  const source = state as Dict;
  const nodes = source.nodes;
  if (!isDict(nodes) || !Array.isArray(changes)) return applyChanges(state, changes);

  const ids = new Set<string>();
  const parents = new Set<string>();
  for (const change of changes) {
    if (!change || typeof change !== "object" || !Array.isArray(change.key)) return applyChanges(state, changes);
    if (change.kind === "map-field") {
      // Presence of the node table itself: needs every node.
      if (change.key[0] === "nodes") return applyChanges(state, changes);
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
  const result = applyChanges({ ...source, nodes: reducedNodes }, changes);
  if (!result.ok) return result;
  const applied = result.state as Dict;
  const appliedNodes = applied.nodes;
  if (appliedNodes === reducedNodes) return { ok: true, state: { ...applied, nodes } };
  if (!isDict(appliedNodes)) return applyChanges(state, changes);

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
