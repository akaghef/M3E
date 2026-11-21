// Invariants of post-migration-spec.md section 9, items 1-7, checked on the
// final state of a whole record set (not on a single write).

import { extensionValueErrors } from "./extensions";
import type {
  ConnectionRecord,
  EdgeConnectionRecord,
  ExtensionDefRecord,
  ExtensionTarget,
  JsonObject,
  MapRecord,
  NodeRecord,
  ScopeRecord,
  SnapshotRecord,
  SurfaceRecord,
} from "./types";
import { recordKeyParts } from "./types";
import { recordKeyString } from "./jsonl";

export interface InvariantProblem {
  /** Item number in Database_Spec section 4. 0 marks a record set that is malformed before any item applies. */
  rule: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 9 | 10;
  kind: string;
  key: string;
  message: string;
}

function isAlias(node: NodeRecord): boolean {
  return node.nodeType === "alias" || node.alias !== undefined;
}

export function checkInvariants(records: SnapshotRecord[]): InvariantProblem[] {
  const problems: InvariantProblem[] = [];
  const add = (rule: InvariantProblem["rule"], record: SnapshotRecord, message: string): void => {
    problems.push({ rule, kind: record.kind, key: recordKeyParts(record).join("+"), message });
  };

  const maps = new Map<string, MapRecord>();
  const nodes = new Map<string, NodeRecord>();
  const connections = new Map<string, ConnectionRecord>();
  const scopes = new Map<string, ScopeRecord>();
  const surfaces = new Map<string, SurfaceRecord>();
  const seenKeys = new Set<string>();

  for (const record of records) {
    const key = `${record.kind}\u0000${recordKeyParts(record).join("\u0000")}`;
    if (seenKeys.has(key)) {
      // 6: a connection id is unique across edge and GraphLink.
      add(record.kind === "connection" ? 6 : 0, record, "duplicate key");
      continue;
    }
    seenKeys.add(key);
    if (record.kind === "map") maps.set(record.id, record);
    else if (record.kind === "node") nodes.set(record.id, record);
    else if (record.kind === "connection") connections.set(record.id, record);
    else if (record.kind === "scope") scopes.set(record.id, record);
    else if (record.kind === "surface") surfaces.set(record.id, record);
  }

  for (const record of records) {
    if ("mapId" in record && !maps.has(record.mapId)) add(0, record, `map ${record.mapId} does not exist`);
  }

  // 1: every node but a map root has exactly one incoming edge; a map root has none.
  const rootIds = new Set<string>();
  for (const map of maps.values()) {
    if (map.rootNodeId === undefined || !nodes.has(map.rootNodeId)) {
      add(1, map, `root node ${map.rootNodeId ?? "(none)"} does not exist`);
    } else if (nodes.get(map.rootNodeId)!.mapId !== map.id) {
      add(1, map, `root node ${map.rootNodeId} belongs to another map`);
    } else {
      rootIds.add(map.rootNodeId);
    }
  }
  const edges: EdgeConnectionRecord[] = [];
  const incomingCount = new Map<string, number>();
  const parentOf = new Map<string, string>();
  for (const connection of connections.values()) {
    if (connection.type !== "edge") continue;
    edges.push(connection);
    incomingCount.set(connection.target, (incomingCount.get(connection.target) ?? 0) + 1);
    if (!parentOf.has(connection.target)) parentOf.set(connection.target, connection.source);
  }
  for (const node of nodes.values()) {
    const count = incomingCount.get(node.id) ?? 0;
    if (rootIds.has(node.id)) {
      if (count !== 0) add(1, node, `map root has ${count} incoming edge(s)`);
    } else if (count !== 1) {
      add(1, node, `node has ${count} incoming edges, expected exactly 1`);
    }
  }

  // 2: edges form no cycle. Follow parents upward; 1 = on the current walk, 2 = known clear.
  const mark = new Map<string, 1 | 2>();
  for (const start of nodes.keys()) {
    const walk: string[] = [];
    let current: string | undefined = start;
    while (current !== undefined && !mark.has(current)) {
      mark.set(current, 1);
      walk.push(current);
      current = parentOf.get(current);
    }
    if (current !== undefined && mark.get(current) === 1) {
      const cycle = walk.slice(walk.indexOf(current));
      const node = nodes.get(current);
      if (node) add(2, node, `edge cycle: ${[...cycle, current].join(" -> ")}`);
    }
    for (const id of walk) mark.set(id, 2);
  }

  // 3: an alias points to a node that is not an alias. An alias may have children (Database_Spec 3.2, 12.2).
  for (const node of nodes.values()) {
    if (!isAlias(node)) continue;
    const target = node.alias?.target;
    if (node.alias?.broken === true) continue; // a broken alias is one whose target is known to be gone
    if (target === undefined) add(3, node, "alias has no target");
    else if (!nodes.has(target)) add(3, node, `alias target ${target} does not exist`);
    else if (isAlias(nodes.get(target)!)) add(3, node, `alias target ${target} is an alias`);
  }

  // 4: connection endpoints exist. Edge: nodes only. GraphLink: node or connection.
  for (const connection of connections.values()) {
    for (const side of ["source", "target"] as const) {
      const id = connection[side];
      const exists = connection.type === "edge"
        ? nodes.has(id)
        : nodes.has(id) || (connections.has(id) && id !== connection.id);
      if (!exists) add(4, connection, `${side} ${id ?? "(none)"} does not exist`);
    }
  }

  // 5: a scope root is an existing node and not an alias. One node may root several scopes (DA60).
  for (const scope of scopes.values()) {
    const root = nodes.get(scope.rootNodeId);
    if (!root) add(5, scope, `root node ${scope.rootNodeId ?? "(none)"} does not exist`);
    else if (isAlias(root)) add(5, scope, `root node ${scope.rootNodeId} is an alias`);
  }

  // 5a: an edge lies on an existing scope of its map, and the edges of one scope form one tree
  // under the scope root: the edge's parent is the root of that scope, or the parent's own
  // incoming edge lies on the same scope (DA59). Checked edge by edge.
  const incomingEdge = new Map<string, EdgeConnectionRecord>();
  for (const edge of edges) if (!incomingEdge.has(edge.target)) incomingEdge.set(edge.target, edge);
  for (const edge of edges) {
    if (edge.scopeId === undefined) {
      add(5, edge, "edge has no scope");
      continue;
    }
    const scope = scopes.get(edge.scopeId);
    if (!scope) {
      add(5, edge, `scope ${edge.scopeId} does not exist`);
      continue;
    }
    if (scope.mapId !== edge.mapId) add(5, edge, `scope ${edge.scopeId} belongs to another map`);
    if (scope.rootNodeId === edge.source) continue;
    const parentEdge = incomingEdge.get(edge.source);
    if (parentEdge === undefined || parentEdge.scopeId !== edge.scopeId) {
      add(5, edge, `edge lies on scope ${edge.scopeId}, but its parent ${edge.source} is neither that scope's root nor on that scope`);
    }
  }

  // 7: details, linear text, surface settings, placement values and annotations point at something that exists.
  for (const record of records) {
    switch (record.kind) {
      case "details":
        if (!nodes.has(record.nodeId)) add(7, record, `node ${record.nodeId} does not exist`);
        break;
      case "linearText":
        if (record.scopeId !== undefined && !scopes.has(record.scopeId)) {
          add(7, record, `scope ${record.scopeId} does not exist`);
        }
        if (record.scopeId === undefined && record.orphanKey === undefined) {
          add(7, record, "neither scopeId nor orphanKey");
        }
        if (record.anchorNodeId !== undefined && !nodes.has(record.anchorNodeId)) {
          add(7, record, `anchor node ${record.anchorNodeId} does not exist`);
        }
        break;
      case "scope":
        if (record.primarySurfaceId !== undefined && !surfaces.has(record.primarySurfaceId)) {
          add(7, record, `primary surface ${record.primarySurfaceId} does not exist`);
        }
        break;
      case "surface":
        if (!scopes.has(record.scopeId)) add(7, record, `scope ${record.scopeId} does not exist`);
        break;
      case "nodeView":
        if (!surfaces.has(record.surfaceId)) add(7, record, `surface ${record.surfaceId} does not exist`);
        if (!nodes.has(record.nodeId)) add(7, record, `node ${record.nodeId} does not exist`);
        break;
      case "annotation":
        if (record.scopeId !== undefined && !scopes.has(record.scopeId)) {
          add(7, record, `scope ${record.scopeId} does not exist`);
        }
        break;
      default:
        break;
    }
  }

  // 9: under one parent, parent-edge ord values are unique. Different parents may share an ord.
  const ords = new Map<string, Set<string>>();
  for (const edge of edges) {
    const seen = ords.get(edge.source) ?? new Set<string>();
    if (seen.has(edge.ord)) add(9, edge, `duplicate ord ${JSON.stringify(edge.ord)} under parent ${edge.source}`);
    seen.add(edge.ord);
    ords.set(edge.source, seen);
  }

  // 10: an extension whose definition exists has its required fields, and every present field matches its type.
  const defs = new Map<string, ExtensionDefRecord>();
  for (const record of records) {
    if (record.kind === "extensionDef") defs.set(recordKeyString(record), record);
  }
  const checkCarrier = (record: SnapshotRecord, carrier: ExtensionTarget, extensions: unknown, attributes: JsonObject | undefined): void => {
    for (const problem of extensionValueErrors(extensions, attributes, carrier, defs)) add(10, record, problem.message);
  };
  for (const node of nodes.values()) checkCarrier(node, "node", node.extensions, node.attributes);
  for (const connection of connections.values()) {
    if (connection.type === "edge") checkCarrier(connection, "parentEdge", connection.extensions, connection.attributes);
    else checkCarrier(connection, "relationEdge", connection.extensions, connection.attributes);
  }
  return problems;
}
